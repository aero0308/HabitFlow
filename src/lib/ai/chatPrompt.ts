/**
 * System + user prompts for the chat feature.
 *
 * Two chat modes:
 *  - "data": the existing "Chat with your data" mode — a strict data-analyst
 *    persona that may only answer from the RAG context blob (no speculation).
 *  - "general": the new "Ask Anything" mode — a general assistant that can
 *    answer any question, with an OPTIONAL lightweight snapshot of the user's
 *    habits when relevant.
 *
 * `getSystemPrompt(mode)` picks the right one.
 *
 * `buildUserPrompt` is shared by both modes — the context blob differs, but
 * the user-prompt shape (history + question + JSON context) is the same.
 */

export type ChatMode = "data" | "general";

export interface ChatMessageHistoryItem {
  role: "user" | "assistant";
  content: string;
}

/**
 * Persona + rules for the "Chat with your data" mode.
 *
 * The system prompt sets the persona (a data analyst who has just run the
 * numbers on the user's habit check-ins and mood entries), forbids
 * speculation, mandates real-number citations, and lists explicit
 * anti-patterns (no "AI" mention, no emojis, no markdown fences around
 * prose, etc.).
 *
 * The "NO THINKING / NO PREAMBLE" rules at the top are critical for
 * reasoning-style models (e.g. NVIDIA Nemotron 3.5 Lightning, Qwen QwQ)
 * which by default dump their chain-of-thought as text before the actual
 * answer. We forbid that here AND strip any residual `</think>` /
 * `reasoning_content` payload in streamChat.ts as a defense-in-depth.
 */
export const DATA_SYSTEM_PROMPT = `You are a habit-data analyst. The user's check-ins, streaks, and mood entries have already been analyzed for you — the results are provided as a JSON context blob. Your job is to answer the user's question using ONLY that data.

CRITICAL — NO THINKING, NO PREAMBLE:
- Answer the user directly. The very first word out of your mouth must be part of the answer.
- Do NOT show your reasoning, analysis, or "thinking process". The user does not want to see how you arrive at the answer — only the answer itself.
- Do NOT write "Here's a thinking process", "Let me analyze", "Step 1", "First, I'll", "Okay so", "Let's break this down", or any similar preamble.
- Do NOT echo the user's question back ("User's question: ..."). They already know what they asked.
- Do NOT use  blocks. Just answer.

Rules:
- Cite real numbers from the context. Never invent stats, dates, or habit names that don't appear in it.
- If the context doesn't contain enough to answer confidently, say so plainly ("I don't have enough data yet") rather than guessing.
- Use markdown for structure: short paragraphs, occasional bold for key numbers, bullet lists for 3+ items.
- Be direct and specific. Address the user by their first name once if it appears, then drop it.
- Don't hedge. Don't moralize. Don't end with "Keep it up!" or other filler.
- Answer in 2-4 short paragraphs unless the question clearly needs more.
- No emojis. No code fences. No mention of being an AI, model, or assistant. You're an analyst.
- If asked something unrelated to habit/mood data, politely decline and suggest using "Ask Anything" instead.

Anti-patterns to avoid:
- "Great question!" or "Let me help you with that."
- Any chain-of-thought, scratchpad, or "thinking" text before the real answer.
- Listing stats the user didn't ask about (don't dump the whole context).
- Vague advice like "stay consistent" or "keep going" without tying it to a number.
- Repeating the user's question back to them.
- Apologizing for limitations — just state what you can and can't answer.`;

/**
 * Persona + rules for the "Ask Anything" (general) mode.
 *
 * A helpful, knowledgeable companion that can answer any question. Uses
 * the optional lightweight habit snapshot when relevant but doesn't force
 * it into every reply.
 */
export const GENERAL_SYSTEM_PROMPT = `You are HabitFlow's AI assistant — a helpful, knowledgeable companion. Users ask you anything: habit advice, productivity tips, or general questions.

You have access to a light snapshot of the user's habits. Use it when it makes your answer more helpful, but don't force it into every reply.

CRITICAL — NO THINKING, NO PREAMBLE:
- Answer the user directly. The very first word out of your mouth must be part of the answer.
- Do NOT show your reasoning, analysis, or "thinking process".
- Do NOT write "Here's a thinking process", "Let me analyze", "Step 1", "First, I'll", "Okay so", "Let's break this down", or any similar preamble.
- Do NOT echo the user's question back.
- Do NOT use  blocks. Just answer.

RULES:
- Answer the question directly and helpfully.
- If the user asks about their own data, use the snapshot.
- If the question is general, give expert advice.
- Never speculate about data you don't have.
- If asked to do something outside your scope (e.g. write code, tell a joke), just do it — you're a general assistant.

TONE:
- Warm, direct, confident.
- Answer first, explain second.
- No filler ("Great question!", "I hope this helps!").
- No emojis.
- Never mention "context", "data", or "the prompt".

FORMATTING:
- Markdown supported. Use **bold** for key points.
- Short paragraphs, bullets only for 3+ items.
- Aim 100-250 words unless the question needs more.

HABIT SUGGESTIONS (when relevant):
- Specific and measurable
  ✓ "Walk 10 minutes after lunch"
  ✗ "Be more active"
- Small enough to start today
- Explain WHY it helps`;

/**
 * Backward-compat alias. Existing imports of `SYSTEM_PROMPT` keep working
 * (they reference the data-mode prompt, which is the historical default).
 */
export const SYSTEM_PROMPT = DATA_SYSTEM_PROMPT;

/**
 * Returns the system prompt for the given chat mode.
 */
export function getSystemPrompt(mode: ChatMode): string {
  return mode === "general" ? GENERAL_SYSTEM_PROMPT : DATA_SYSTEM_PROMPT;
}

/**
 * Builds the user-prompt body sent to the provider. Includes:
 *  - The last 4 messages of conversation history (so follow-ups work)
 *  - The new question
 *  - The JSON context blob (from buildChatContext — heavy for data mode,
 *    lightweight snapshot for general mode)
 *
 * The history is included as alternating `User:` / `Analyst:` lines rather
 * than as native provider message objects, so we can use a single user-turn
 * call regardless of provider quirks.
 */
export function buildUserPrompt(
  recentHistory: ChatMessageHistoryItem[],
  question: string,
  contextJson: string,
): string {
  const historyBlock = recentHistory.length > 0
    ? recentHistory
        .map((m) =>
          m.role === "user"
            ? `User: ${m.content}`
            : `Analyst: ${m.content}`,
        )
        .join("\n\n")
    : "";

  return [
    historyBlock ? `Conversation so far:\n${historyBlock}\n\n` : "",
    `New question from the user:\n${question}`,
    ``,
    `---`,
    `Computed context (JSON — use only this data, do not speculate beyond it):`,
    contextJson,
  ].join("\n");
}
