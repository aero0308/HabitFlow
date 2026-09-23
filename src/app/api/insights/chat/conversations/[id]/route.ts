import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";

/**
 * GET /api/insights/chat/conversations/[id]
 *
 * Returns a single conversation with all of its messages, oldest first.
 *
 * Response shape:
 *   {
 *     conversation: {
 *       id, title, createdAt, updatedAt,
 *       messages: Array<{ id, role, content, model, tokensUsed, createdAt }>
 *     }
 *   }
 *
 * DELETE /api/insights/chat/conversations/[id]
 *
 * Soft-deletes a conversation (sets archivedAt = now). Messages are kept
 * for audit / recovery; the conversation just disappears from the list.
 */

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const conversation = await db.chatConversation.findFirst({
      where: { id, userId: user.id, archivedAt: null },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return apiError("Conversation not found", 404, "NOT_FOUND");
    }

    return apiOk({
      conversation: {
        id: conversation.id,
        title: conversation.title || "New chat",
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          model: m.model,
          tokensUsed: m.tokensUsed,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return apiError("Not authenticated", 401, "UNAUTHORIZED");
    }
    return apiError(e instanceof Error ? e.message : "Failed to load conversation");
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const result = await db.chatConversation.updateMany({
      where: { id, userId: user.id, archivedAt: null },
      data: { archivedAt: new Date() },
    });

    if (result.count === 0) {
      return apiError("Conversation not found", 404, "NOT_FOUND");
    }

    return apiOk({ archived: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return apiError("Not authenticated", 401, "UNAUTHORIZED");
    }
    return apiError(e instanceof Error ? e.message : "Failed to archive conversation");
  }
}
