import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { decryptKey } from "@/lib/ai/encryption";
import { buildChatContext } from "@/lib/ai/buildChatContext";
import {
  getSystemPrompt,
  buildUserPrompt,
  type ChatMode,
  type ChatMessageHistoryItem,
} from "@/lib/ai/chatPrompt";
import { streamChatAnswer } from "@/lib/ai/streamChat";
import type { AIProvider } from "@/lib/ai/providers";

/**
 * POST /api/insights/chat/stream
 *
 * Streams an AI assistant reply to the user's chat message via raw SSE.
 *
 * Request body:
 *   { conversationId?: string, message: string }
 *
 * Flow:
 *  1. Auth → load or create conversation
 *  2. Save the user's message to db.chatMessage
 *  3. Build RAG context via buildChatContext
 *  4. Load the last 4 messages in this conversation as history
 *  5. Build system + user prompts
 *  6. Stream the AI response, emitting SSE `delta` events to the client
 *  7. Save the assistant's message (with contextSnapshot) to db.chatMessage
 *  8. Emit a final `done` event with messageId + model + tokensUsed
 *
 * SSE shape:
 *   data: {"delta":"text chunk"}\n\n        — streamed token deltas
 *   data: {"done":true,"messageId":"...","model":"...","tokensUsed":N}\n\n
 *   data: {"error":"..."}\n\n                — on failure
 *
 * Rate limit: 20 / hour, 100 / day per user (in-memory Map).
 * If user has no API key → SSE error with payload {"error":"no_api_key"}.
 *
 * Conversation title is auto-generated from the first 6 words of the
 * user's first message in the conversation (only when the conversation
 * still has its default "New chat" title).
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Bumped from 20→50/hr and 100→200/day so a user actively chatting
// (which can fire many short questions in a session) doesn't hit the
// limit mid-conversation. The provider's own RPM cap is the real ceiling.
const HOURLY_LIMIT = 50;
const DAILY_LIMIT = 200;

interface RateBucket {
  hourlyCount: number;
  hourlyFirstAt: number;
  dailyCount: number;
  dailyFirstAt: number;
}
const rateBuckets = new Map<string, RateBucket>();

function checkRate(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  let bucket = rateBuckets.get(userId);
  if (!bucket) {
    bucket = {
      hourlyCount: 0,
      hourlyFirstAt: now,
      dailyCount: 0,
      dailyFirstAt: now,
    };
    rateBuckets.set(userId, bucket);
  }

  // Reset windows if expired
  if (now - bucket.hourlyFirstAt > HOUR_MS) {
    bucket.hourlyFirstAt = now;
    bucket.hourlyCount = 0;
  }
  if (now - bucket.dailyFirstAt > DAY_MS) {
    bucket.dailyFirstAt = now;
    bucket.dailyCount = 0;
  }

  if (bucket.hourlyCount >= HOURLY_LIMIT) {
    return { ok: false, reason: "hourly" };
  }
  if (bucket.dailyCount >= DAILY_LIMIT) {
    return { ok: false, reason: "daily" };
  }
  bucket.hourlyCount++;
  bucket.dailyCount++;
  return { ok: true };
}

export const runtime = "nodejs";
// Streaming responses can take longer than the default Next.js route
// timeout (10s on Vercel, longer in `next dev`); allow up to 5 minutes
// so a slow provider doesn't surface as "Runtime TimeoutError: signal timed out".
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Encodes a string as a single SSE `data:` line. SSE requires the payload
 * to fit on one logical line — JSON.stringify without embedded newlines is
 * fine, but we replace any stray newlines in string values defensively.
 */
function sseData(payload: unknown): Uint8Array {
  const json = JSON.stringify(payload);
  // Replace literal \n inside JSON strings with escaped form so the SSE
  // frame stays a single line. (JSON.stringify already does this for
  // control chars, but we double-guard against any custom serialization.)
  const safe = json.replace(/\r?\n/g, "\\n");
  const text = `data: ${safe}\n\n`;
  return new TextEncoder().encode(text);
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return new Response(
      new TextEncoder().encode(
        `data: ${JSON.stringify({ error: "unauthorized" })}\n\n`,
      ),
      {
        status: 401,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store, no-transform",
        },
      },
    );
  }

  // Parse body
  let body: { conversationId?: string; message?: string; mode?: string };
  try {
    body = (await req.json()) as {
      conversationId?: string;
      message?: string;
      mode?: string;
    };
  } catch {
    body = {};
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const conversationIdIn = typeof body.conversationId === "string" ? body.conversationId : undefined;
  // Validate mode — must be "data" or "general"; default to "data".
  const rawMode = typeof body.mode === "string" ? body.mode : "data";
  const mode: ChatMode = rawMode === "general" ? "general" : "data";

  if (!message) {
    return new Response(
      new TextEncoder().encode(
        `data: ${JSON.stringify({ error: "Message is required" })}\n\n`,
      ),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store, no-transform",
        },
      },
    );
  }
  if (message.length > 2000) {
    return new Response(
      new TextEncoder().encode(
        `data: ${JSON.stringify({ error: "Message is too long (max 2000 chars)" })}\n\n`,
      ),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store, no-transform",
        },
      },
    );
  }

  // Load user + validate AI key
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { aiProvider: true, aiModel: true, aiApiKeyEncrypted: true },
  });
  if (!dbUser?.aiProvider || !dbUser?.aiApiKeyEncrypted) {
    return new Response(sseData({ error: "no_api_key" }), {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Rate limit
  const rl = checkRate(user.id);
  if (!rl.ok) {
    const msg =
      rl.reason === "hourly"
        ? `Rate limit reached (${HOURLY_LIMIT}/hour). Try again later.`
        : `Daily limit reached (${DAILY_LIMIT}/day).`;
    return new Response(sseData({ error: msg }), {
      status: 429,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store, no-transform",
      },
    });
  }

  const apiKey = decryptKey(dbUser.aiApiKeyEncrypted);
  const provider = dbUser.aiProvider as AIProvider;
  const model = dbUser.aiModel ?? undefined;

  // Load or create conversation
  let conversation;
  if (conversationIdIn) {
    conversation = await db.chatConversation.findFirst({
      where: { id: conversationIdIn, userId: user.id, archivedAt: null },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    // Mode mismatch — refuse to mix modes between the request and the existing conversation.
    if (conversation && conversation.mode !== mode) {
      return new Response(
        sseData({
          error: `This conversation is in a different mode ("${conversation.mode}"). Start a new chat in the "${mode}" tab.`,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store, no-transform",
          },
        },
      );
    }
  }
  if (!conversation) {
    conversation = await db.chatConversation.create({
      data: { userId: user.id, title: "New chat", mode },
      include: { messages: true },
    });
  }

  // Save user message
  await db.chatMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: message,
    },
  });

  // Build context
  let contextJson: string;
  try {
    const context = await buildChatContext(user.id, message, mode);
    contextJson = JSON.stringify(context);
  } catch (e) {
    console.error("[chat/stream] buildChatContext failed", e);
    return new Response(
      sseData({
        error: "Failed to build context for your question.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store, no-transform",
        },
      },
    );
  }

  // Load last 4 messages (excluding the one we just saved) as history
  // We re-query because the save above mutated state.
  const recentDbMessages = await db.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 8, // over-fetch then slice the last 4 before the new user msg
  });
  // Take the last 4 prior to the just-saved user message.
  // The just-saved message is the LAST in the list. We want 4 messages
  // BEFORE it for history (so the AI sees the recent back-and-forth).
  const historyItems: ChatMessageHistoryItem[] = recentDbMessages
    .slice(-5, -1) // drop the just-saved user msg + slice the prior 4
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  const userPrompt = buildUserPrompt(historyItems, message, contextJson);

  // Auto-generate title after first response — the user's first message
  // truncated to the first 6 words.
  const isFirstMessage = conversation.messages.length === 0;
  const autoTitle = isFirstMessage
    ? message
        .split(/\s+/)
        .slice(0, 6)
        .join(" ")
        .replace(/[^\w\s?!.,-]/g, "")
        .slice(0, 60)
    : null;

  // Build SSE response stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Send conversationId first so the client can switch its UI state
      // even before the first token arrives.
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ conversationId: conversation.id })}\n\n`,
        ),
      );

      try {
        const result = await streamChatAnswer({
          apiKey,
          provider,
          model,
          systemPrompt: getSystemPrompt(mode),
          userPrompt,
          onChunk: (delta) => {
            try {
              controller.enqueue(sseData({ delta }));
            } catch {
              // Controller closed — client disconnected mid-stream. Swallow.
            }
          },
        });

        // Save assistant message with context snapshot
        const saved = await db.chatMessage.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: result.text,
            contextSnapshot: contextJson,
            model: result.model,
            tokensUsed: result.tokensUsed ?? null,
          },
        });

        // Update conversation updatedAt + auto-title if first message
        await db.chatConversation.update({
          where: { id: conversation.id },
          data: {
            updatedAt: new Date(),
            ...(autoTitle && autoTitle.length > 0
              ? { title: autoTitle }
              : {}),
          },
        });

        controller.enqueue(
          sseData({
            done: true,
            messageId: saved.id,
            model: result.model,
            tokensUsed: result.tokensUsed ?? null,
            conversationId: conversation.id,
          }),
        );
      } catch (e) {
        const err = e as Error & { status?: number; provider?: AIProvider };
        let msg = err.message || "Stream failed";
        if (err.status === 401) {
          msg = "Your AI key is invalid. Re-add it in Settings.";
          // Auto-clear the bad key
          await db.user.update({
            where: { id: user.id },
            data: { aiProvider: null, aiModel: null, aiApiKeyEncrypted: null },
          });
        } else if (err.status === 429) {
          msg = "Provider rate limit reached. Try again shortly.";
        }
        try {
          controller.enqueue(sseData({ error: msg }));
        } catch {
          // Already closed
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
