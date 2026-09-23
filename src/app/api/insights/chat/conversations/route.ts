import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";

/**
 * GET /api/insights/chat/conversations?mode=data|general
 *
 * Returns the user's active (non-archived) chat conversations for the given
 * mode, newest first, capped at 30. Each conversation includes a `lastMessage`
 * preview (the most recent message's content truncated to one line / 120
 * chars).
 *
 * `mode` defaults to "data" if not specified (backward compat with the
 * existing UI which only had a single chat mode).
 *
 * Response shape:
 *   {
 *     conversations: Array<{
 *       id: string,
 *       title: string,
 *       mode: string,
 *       createdAt: string,
 *       updatedAt: string,
 *       lastMessage: { role: string, content: string, createdAt: string } | null
 *     }>
 *   }
 */

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();

    // Resolve mode — accept "data" or "general"; default to "data".
    const modeParam = req.nextUrl.searchParams.get("mode");
    const mode =
      modeParam === "general" || modeParam === "data" ? modeParam : "data";

    const conversations = await db.chatConversation.findMany({
      where: { userId: user.id, mode, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return apiOk({
      conversations: conversations.map((c) => {
        const last = c.messages[0];
        return {
          id: c.id,
          title: c.title || "New chat",
          mode: c.mode,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          lastMessage: last
            ? {
                role: last.role,
                content: truncatePreview(last.content),
                createdAt: last.createdAt.toISOString(),
              }
            : null,
        };
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return apiError("Not authenticated", 401, "UNAUTHORIZED");
    }
    return apiError(e instanceof Error ? e.message : "Failed to list conversations");
  }
}

/**
 * Truncate a message body to a single preview line — collapse newlines
 * to spaces and cap at ~120 chars.
 */
function truncatePreview(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  if (flat.length <= 120) return flat;
  return flat.slice(0, 119).trimEnd() + "…";
}
