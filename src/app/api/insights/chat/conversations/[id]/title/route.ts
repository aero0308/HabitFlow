import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";

/**
 * POST /api/insights/chat/conversations/[id]/title
 *
 * Updates a conversation's title (used by the inline rename UI).
 *
 * Body: { "title": "new title" }
 * Returns { ok: true, title: "new title" }
 *
 * Validates:
 *  - User owns the conversation + it's not archived
 *  - Title is 1..120 chars
 */

const MAX_TITLE = 120;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    let body: { title?: string };
    try {
      body = (await req.json()) as { title?: string };
    } catch {
      body = {};
    }
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return apiError("Title is required", 400, "INVALID_TITLE");
    }
    if (title.length > MAX_TITLE) {
      return apiError(
        `Title too long (max ${MAX_TITLE} chars)`,
        400,
        "INVALID_TITLE",
      );
    }

    const result = await db.chatConversation.updateMany({
      where: { id, userId: user.id, archivedAt: null },
      data: { title },
    });

    if (result.count === 0) {
      return apiError("Conversation not found", 404, "NOT_FOUND");
    }

    return apiOk({ ok: true, title });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return apiError("Not authenticated", 401, "UNAUTHORIZED");
    }
    return apiError(e instanceof Error ? e.message : "Failed to rename conversation");
  }
}
