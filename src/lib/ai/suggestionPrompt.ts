import { ICON_NAMES } from "./habitIcons";

/**
 * System + user prompts for AI-powered habit suggestions.
 *
 * The model is asked to return a strict JSON object — no markdown fences,
 * no commentary — with a `suggestions` array of 3-5 well-formed habit
 * suggestions. The shape is validated by Zod on the server (see
 * generateSuggestions.ts) before being persisted or returned to the client.
 */

export const SYSTEM_PROMPT = `You are a habit-design expert for HabitFlow. Given a user's goal and a small amount of context about their existing habits, you propose 3-5 specific, measurable, achievable habits that move them toward the goal.

OUTPUT FORMAT (STRICT):
Respond with ONLY a single valid JSON object — no markdown fences, no commentary, no prose outside the JSON. The object MUST have EXACTLY this shape:

{
  "suggestions": [
    {
      "name": string,           // 2-60 chars, action-oriented ("Drink 8 glasses of water")
      "icon": string,           // MUST be one of: ${ICON_NAMES.join(", ")}
      "frequency": "daily" | "custom",
      "days": number[] | null,  // 0=Mon..6=Sun; REQUIRED when frequency=="custom", null otherwise
      "timeOfDay": "ANY_TIME" | "MORNING" | "AFTERNOON" | "EVENING",
      "targetCount": number,    // positive integer (1 for binary habits, e.g. 8 for "8 glasses of water")
      "unit": string | null,    // short unit label (e.g. "glasses", "pages", "min") or null
      "color": string,          // hex like "#10b981"
      "reason": string           // 1-2 sentences: why this habit, given the goal
    }
  ]
}

CONTENT RULES:
- Propose 3-5 habits — never fewer, never more.
- Each suggestion must be SPECIFIC and MEASURABLE. "Be healthy" is too vague; "Drink 8 glasses of water" is good. The targetCount + unit together should make the daily target obvious.
- Never duplicate an existing habit (the context lists existing habit names — do not re-propose them).
- Vary the icons — don't reuse the same icon for every suggestion.
- Vary the colors across the palette; pick colors that fit the habit (water → blue, fitness → red/orange, learning → purple, mindfulness → green, etc.).
- Use "custom" frequency (with a sensible days array, e.g. weekdays [0,1,2,3,4]) only for habits that genuinely don't make sense every day (e.g. "Practice coding" on weekdays). Default to "daily".
- Pick the timeOfDay based on when the habit naturally fits ("Meditate" → MORNING, "Read before bed" → EVENING, "Drink water" → ANY_TIME, etc.). Prefer the user's existing preferred time slot if it fits.
- The reason should be 1-2 sentences, written in second person ("you"), and reference the goal.
- Tone: warm, practical, no emojis, no marketing fluff.
- The JSON must be parseable by JSON.parse with no repair. No trailing commas, no comments, no code fences.`;

/**
 * Build the user-facing prompt that wraps the goal + context JSON.
 * `goal` is the user's free-text goal (e.g. "I want to be healthier").
 * `contextJson` is the stringified SuggestionContext object.
 */
export function buildUserPrompt(goal: string, contextJson: string): string {
  return `Suggest 3-5 habits for this goal.

Goal: ${goal}

User context (JSON):
${contextJson}

Return ONLY a valid JSON object with a "suggestions" array. Each suggestion must have: name, icon, frequency, days, timeOfDay, targetCount, unit, color, reason. No markdown fences, no prose outside the JSON.`;
}

/**
 * Stricter retry prompt — used when the first response failed Zod parsing.
 */
export function buildRetryUserPrompt(goal: string, contextJson: string): string {
  return `RETRY: Your previous response was not valid JSON or did not match the schema. Try again.

Suggest 3-5 habits for this goal.

Goal: ${goal}

User context (JSON):
${contextJson}

Output ONLY this JSON shape — no markdown fences, no commentary, no trailing text:

{"suggestions":[{"name":"...","icon":"...","frequency":"daily","days":null,"timeOfDay":"ANY_TIME","targetCount":1,"unit":null,"color":"#10b981","reason":"..."}]}

Icon MUST be one of: ${ICON_NAMES.join(", ")}. Frequency MUST be "daily" or "custom". If "custom", days MUST be a non-empty array of 0-6 (Mon-Sun). If "daily", days MUST be null.`;
}

/**
 * Final-attempt prompt — used after two parse failures. Drops the
 * pretty-printed schema example, drops the per-suggestion reason, and asks
 * for an absolute minimum valid shape. This reliably recovers from
 * stubborn models (e.g. Nemotron 3 Super wrapping output in markdown
 * fences despite all instructions) because the request is so small that
 * the model rarely has room to add prose.
 *
 * The validator in generateSuggestions.ts still re-validates with the full
 * schema, so the model's "minimal" output must still match — but we accept
 * suggestions with truncated/missing `reason` fields here by allowing the
 * schema validator to drop them rather than failing the whole call.
 */
export function buildFinalRetryUserPrompt(goal: string, contextJson: string): string {
  return `FINAL ATTEMPT. Output ONE JSON object and nothing else. No prose, no markdown fences.

Goal: ${goal}

User context: ${contextJson}

JSON shape (copy this structure, fill in real values, output 3-5 suggestions):

{"suggestions":[{"name":"Habit name","icon":"water","frequency":"daily","days":null,"timeOfDay":"ANY_TIME","targetCount":1,"unit":"glasses","color":"#10b981","reason":"Reason"}]}

Icons allowed: ${ICON_NAMES.join(", ")}.
Begin with { and end with }. Nothing before the { and nothing after the }.`;
}
