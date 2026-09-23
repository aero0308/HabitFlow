/**
 * Raw SSE streaming for the chat-with-data feature, across the supported
 * providers (Groq and NVIDIA NIM). Both implement OpenAI's
 * /v1/chat/completions streaming protocol, so we share one parser.
 *
 * The single entry point `streamChatAnswer` returns a Promise that resolves
 * once the stream completes, but it emits chunks in real time via the
 * `onChunk` callback. The caller is responsible for relaying those chunks
 * to the client (e.g. via a Next.js ReadableStream).
 *
 * Every request is wrapped in an AbortController with a 90s timeout — long
 * enough for long completions but short enough to surface a clean error
 * instead of leaving the Next.js route hanging indefinitely (which is what
 * surfaces as "Runtime TimeoutError: signal timed out" in the dev server).
 *
 * SSE format reminder:
 *   - Events are separated by a blank line (`\n\n`).
 *   - Each event has zero or more `field: value` lines.
 *   - `data:` lines carry JSON payloads (or the literal `[DONE]`).
 */

import type { AIProvider } from "@/lib/ai/providers";
import { AIProviderError } from "@/lib/ai/providers";

// Mirror of MODELS in providers.ts — kept here so the streaming path is
// independent of the non-streaming path (and we can swap one without
// touching the other).
const STREAM_MODELS: Record<AIProvider, string> = {
  groq: "openai/gpt-oss-120b",
  nvidia: "nvidia/nemotron-3-super-120b-a12b",
};

const STREAM_ENDPOINTS: Record<AIProvider, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
};

const STREAM_TIMEOUT_MS = 90_000;

export interface StreamChatArgs {
  apiKey: string;
  provider: AIProvider;
  systemPrompt: string;
  userPrompt: string;
  onChunk: (delta: string) => void;
  signal?: AbortSignal;
  /**
   * Override the model id (e.g. "nvidia/nemotron-3-super-120b-a12b").
   * Falls back to the provider default in `STREAM_MODELS` when omitted.
   */
  model?: string;
}

export interface StreamChatResult {
  text: string;
  model: string;
  tokensUsed?: number;
}

/**
 * Dispatches to the OpenAI-compatible streaming endpoint for the chosen
 * provider. Throws an `AIProviderError`-shaped Error on non-2xx responses
 * so the caller can surface a useful error to the user.
 */
export async function streamChatAnswer(
  args: StreamChatArgs,
): Promise<StreamChatResult> {
  const model = args.model ?? STREAM_MODELS[args.provider];
  const url = STREAM_ENDPOINTS[args.provider];
  switch (args.provider) {
    case "groq":
    case "nvidia":
      return streamOpenAICompatible(args, model, url);
    default:
      throw new AIProviderError(
        args.provider,
        400,
        `Unknown provider: ${args.provider as string}`,
      );
  }
}

/* ============================================================================
   OpenAI-compatible streaming caller (Groq + NVIDIA NIM).
   SSE lines: `data: {json}` with `choices[0].delta.content`.
   Final line: `data: [DONE]`.
============================================================================ */

async function streamOpenAICompatible(
  args: StreamChatArgs,
  model: string,
  url: string,
): Promise<StreamChatResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${args.apiKey}`,
    Accept: "text/event-stream",
  };

  // Compose our own AbortController so we can attach a timeout. If the
  // caller passes an AbortSignal too (e.g. client disconnect), we
  // forward it via addEventListener so either trigger aborts the fetch.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  if (args.signal) {
    if (args.signal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      args.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 800,
        messages: [
          { role: "system", content: args.systemPrompt },
          { role: "user", content: args.userPrompt },
        ],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      throw new AIProviderError(
        args.provider,
        408,
        `Stream timed out after ${Math.round(STREAM_TIMEOUT_MS / 1000)}s. Please try again.`,
      );
    }
    throw new AIProviderError(
      args.provider,
      502,
      `Network error contacting ${args.provider}: ${e instanceof Error ? e.message : "unknown"}`,
    );
  }

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    throw await buildProviderError(args.provider, res);
  }

  let assembled = "";
  let tokensUsed: number | undefined;

  // Reasoning-model defense. Some chat models (notably NVIDIA Nemotron 3.5
  // Lightning, Qwen QwQ, DeepSeek-R1) dump their chain-of-thought BEFORE
  // the actual answer. We must NOT forward that to the UI:
  //   1. `delta.reasoning_content` — explicit reasoning channel (skip entirely)
  //   2. `</think>...IMD` — inline thinking tags inside `content` (strip them)
  //   3. "Here's a thinking process:" / "Let me analyze" preambles — the
  //      system prompt forbids these, but as a fallback we also strip the
  //      very first chunk if it matches one of these prefixes.
  let inThinkingBlock = false;
  let preambleBuffer = "";
  let preambleChecked = false;

  // Build the tag names via concatenation so tooling that strips literal
  // "thinking" tags from chat content can't mangle these regexes.
  const T = "think" + "ing";
  const OPEN_TAG = "<" + T + ">";
  const CLOSE_TAG = "</" + T + ">";
  const PREAMBLE_PREFIXES = [
    "here's a thinking process",
    "here is a thinking process",
    "let me analyze",
    "let's break this down",
    "step 1",
    "first, i'll",
    "first i'll",
    "okay so",
    "let's think",
    "thinking process",
  ];

  try {
    await parseSSEStream(res.body, (dataStr) => {
      if (dataStr === "[DONE]") return;
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(dataStr) as Record<string, unknown>;
      } catch {
        return;
      }
      const choices = json.choices as
        | Array<{
            delta?: {
              content?: string;
              reasoning_content?: string;
              reasoning?: string;
            };
            finish_reason?: string | null;
          }>
        | undefined;
      if (choices && choices.length > 0) {
        const delta = choices[0].delta;

        // (1) Skip explicit reasoning_content / reasoning channels entirely
        // — these are NOT shown to the user.
        // (Some providers emit reasoning in a separate field; we just drop it.)

        if (delta?.content) {
          let piece = delta.content;

          // (2) Strip inline  ...  blocks via a small state
          // machine. We may receive the open and close tags split across
          // multiple chunks, so we track state between chunks.
          if (inThinkingBlock || piece.includes(OPEN_TAG)) {
            let safety = 0;
            while (safety++ < 50) {
              if (inThinkingBlock) {
                const closeIdx = piece.indexOf(CLOSE_TAG);
                if (closeIdx >= 0) {
                  piece = piece.slice(closeIdx + CLOSE_TAG.length);
                  inThinkingBlock = false;
                } else {
                  // Still inside the thinking block — drop entire chunk
                  piece = "";
                  break;
                }
              }
              if (!inThinkingBlock && piece.includes(OPEN_TAG)) {
                const openIdx = piece.indexOf(OPEN_TAG);
                // Drop content before the tag (typically empty when we're
                // already in the stripping path)
                piece = piece.slice(openIdx + OPEN_TAG.length);
                inThinkingBlock = true;
                continue;
              }
              break;
            }
          }

          // (3) Preamble defense: buffer the first ~80 chars and check
          // whether it starts with a thinking-preamble. If so, drop the
          // preamble (and any lines up to the first double-newline, which
          // typically marks the start of the real answer).
          if (!preambleChecked) {
            preambleBuffer += piece;
            if (preambleBuffer.length >= 80 || preambleBuffer.includes("\n\n")) {
              preambleChecked = true;
              const lower = preambleBuffer.toLowerCase();
              const isPreamble = PREAMBLE_PREFIXES.some((p) =>
                lower.startsWith(p),
              );
              if (isPreamble) {
                // Drop everything up to the first double-newline (the
                // model typically writes its preamble, then a blank line,
                // then the actual answer).
                const dblNl = preambleBuffer.indexOf("\n\n");
                if (dblNl >= 0) {
                  piece = preambleBuffer.slice(dblNl + 2);
                } else {
                  // No double-newline yet — keep buffering, drop this chunk
                  piece = "";
                  preambleChecked = false; // re-check next chunk
                }
              } else {
                // Not a preamble — flush the buffer to the UI
                piece = preambleBuffer;
              }
            } else {
              // Still accumulating preamble buffer — don't emit yet
              piece = "";
            }
          }

          if (piece) {
            assembled += piece;
            args.onChunk(piece);
          }
        }
      }
      // Extract usage if present (last chunk — sent when stream_options.include_usage is true)
      const usage = json.usage as
        | { total_tokens?: number; completion_tokens?: number }
        | undefined;
      if (usage) {
        tokensUsed = usage.total_tokens ?? usage.completion_tokens ?? undefined;
      }
    });
  } finally {
    clearTimeout(timer);
  }

  return {
    text: assembled,
    model,
    tokensUsed: tokensUsed ?? estimateTokens(assembled),
  };
}

/* ============================================================================
   SSE parser — generic over ReadableStream<Uint8Array>
============================================================================ */

/**
 * Reads a ReadableStream of bytes, decodes to text, and emits complete SSE
 * `data:` payloads to the callback. The callback receives:
 *   - `dataStr` — the JSON payload (or empty string for keep-alive comments)
 *   - `eventName` — the value of the most recent `event:` line (or "")
 *
 * Incomplete chunks are buffered until the next `\n` arrives.
 */
async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (dataStr: string, eventName: string) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let eventName = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line. We process complete
      // events and leave any trailing partial in the buffer.
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        eventName = "";
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            onEvent(data, eventName);
          } else if (line.startsWith(":")) {
            // SSE comment / keep-alive — ignore
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already released — fine
    }
  }
}

/* ============================================================================
   Error helper + token estimator
============================================================================ */

/**
 * Reads the response body and returns an Error that mimics the
 * AIProviderError shape (so the caller can check `status` and surface
 * the right message). We attach the same fields (`provider`, `status`,
 * `message`) on the Error instance.
 */
async function buildProviderError(
  provider: AIProvider,
  res: Response,
): Promise<Error> {
  const body = await res.text().catch(() => "");
  let message = `${provider} request failed (${res.status})`;
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const nested = json.error;
    const nestedMsg =
      typeof nested === "string" ? nested : nested?.message;
    message = nestedMsg ?? json.message ?? message;
  } catch {
    if (body) message = body.slice(0, 200);
  }
  if (res.status === 401) {
    message = `Your ${provider} API key is invalid or unauthorized. Please re-enter it in Settings.`;
  } else if (res.status === 429) {
    message = `${provider} rate limit reached. Please wait a moment and try again.`;
  }
  const err = new Error(message) as Error & {
    provider: AIProvider;
    status: number;
  };
  err.provider = provider;
  err.status = res.status;
  err.name = "AIProviderError";
  return err;
}

/**
 * Rough token estimate: ~4 characters per token for English text. Used as
 * a fallback when the provider doesn't return usage metadata.
 */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
