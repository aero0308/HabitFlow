import { z } from "zod";
import { db } from "@/lib/db";
import { decryptKey } from "@/lib/ai/encryption";
import {
  generateNarrative,
  AIProvider,
  AIProviderError,
} from "@/lib/ai/providers";
import { buildSuggestionContext } from "@/lib/ai/buildSuggestionContext";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  buildRetryUserPrompt,
  buildFinalRetryUserPrompt,
} from "@/lib/ai/suggestionPrompt";
import { ICON_NAMES, HABIT_ICONS, resolveIcon } from "@/lib/ai/habitIcons";

/* ============================================================================
   Zod schema — defines the valid shape of a single habit suggestion
============================================================================ */

const frequencyEnum = z.enum(["daily", "custom"]);
const timeOfDayEnum = z.enum(["ANY_TIME", "MORNING", "AFTERNOON", "EVENING"]);

export const suggestionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(60)
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: "name cannot be empty" }),
  icon: z.string().min(1).max(20),
  frequency: frequencyEnum,
  days: z.array(z.number().int().min(0).max(6)).nullable(),
  timeOfDay: timeOfDayEnum,
  targetCount: z.number().int().min(1).max(100),
  unit: z.string().max(20).nullable(),
  color: z
    .string()
    .min(4)
    .max(9)
    .refine((s) => /^#[0-9a-fA-F]{3,8}$/.test(s), {
      message: "color must be a hex string like #10b981",
    }),
  reason: z
    .string()
    .min(1)
    .max(400)
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: "reason cannot be empty" }),
});

export type HabitSuggestion = z.infer<typeof suggestionSchema>;

/* ============================================================================
   Helpers
============================================================================ */

/**
 * Strip a possible ```json fenced block from the model's response so we can
 * recover from providers that wrap output in markdown fences despite
 * instructions. Returns the inner JSON string (or the original if no fence).
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const withoutOpen = trimmed.replace(/^```(?:json)?\s*\n?/i, "");
    const withoutClose = withoutOpen.replace(/\n?```\s*$/i, "");
    return withoutClose.trim();
  }
  return trimmed;
}

/**
 * Normalize the icon field — accept either a known icon name (preferred) or
 * a raw emoji string. Always returns the actual emoji that will be stored
 * on the Habit record.
 */
function normalizeIcon(icon: string): string {
  const trimmed = icon.trim();
  if (HABIT_ICONS[trimmed]) return HABIT_ICONS[trimmed];
  // Already an emoji or some unknown name — keep as-is (max 20 chars enforced by schema)
  return resolveIcon(trimmed);
}

/**
 * Defensive JSON.parse — some providers prepend stray text, wrap output in
 * prose, add trailing commas, or truncate. Try multiple strategies:
 * 1. Strip code fences, try strict parse
 * 2. Find first `{` and last `}`, try that slice
 * 3. Fix trailing commas (common LLM mistake)
 * 4. Fix unescaped newlines in strings
 */
function looseJsonParse(text: string): unknown {
  const cleaned = stripCodeFences(text);

  // Strategy 1: strict parse
  try {
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  // Strategy 2: extract the JSON object substring
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch { /* continue */ }

    // Strategy 3: fix trailing commas (common LLM mistake: `{"a": 1,}`)
    const noTrailingCommas = slice.replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(noTrailingCommas);
    } catch { /* continue */ }

    // Strategy 4: fix unescaped control characters in strings
    const escaped = slice.replace(/[\t\r\n]/g, (m) => {
      if (m === "\t") return "\\t";
      if (m === "\r") return "\\r";
      return "\\n";
    }).replace(/\\(?!["\\\/bfnrtu])/g, "\\\\");
    try {
      return JSON.parse(escaped);
    } catch { /* continue */ }
  }

  // Strategy 5: try to find a JSON array instead of an object
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    const slice = cleaned.slice(arrStart, arrEnd + 1);
    try {
      return { suggestions: JSON.parse(slice) };
    } catch { /* continue */ }
  }

  throw new Error("No JSON object found in model response");
}

/**
 * Validate the model's parsed output against the suggestion schema.
 *
 * Returns only the suggestions that pass validation — invalid entries are
 * dropped (rather than failing the whole call) so the user still gets
 * *something* usable even if one suggestion was malformed.
 */
function validateSuggestions(parsed: unknown): HabitSuggestion[] {
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  const arr = obj.suggestions;
  if (!Array.isArray(arr)) return [];

  const valid: HabitSuggestion[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    // Cross-field rule: if frequency === "custom", days must be a non-empty array.
    const candidate = raw as Record<string, unknown>;
    if (
      candidate.frequency === "custom" &&
      (!Array.isArray(candidate.days) || candidate.days.length === 0)
    ) {
      // Auto-repair: force daily if the model said custom but gave no days.
      candidate.frequency = "daily";
      candidate.days = null;
    }
    if (candidate.frequency === "daily") {
      candidate.days = null;
    }
    const result = suggestionSchema.safeParse(candidate);
    if (result.success) {
      valid.push({ ...result.data, icon: normalizeIcon(result.data.icon) });
    }
  }
  return valid;
}

/* ============================================================================
   Main entry point
============================================================================ */

export interface GenerateSuggestionsResult {
  suggestions: HabitSuggestion[];
  model: string;
  tokensUsed?: number;
}

export async function generateSuggestions(
  userId: string,
  goal: string,
): Promise<GenerateSuggestionsResult> {
  // 1. Load user + validate AI key
  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      name: true,
      aiProvider: true,
      aiModel: true,
      aiApiKeyEncrypted: true,
    },
  });

  if (!dbUser) {
    throw new Error("User not found");
  }
  if (!dbUser.aiProvider || !dbUser.aiApiKeyEncrypted) {
    throw new Error("NO_API_KEY");
  }

  const apiKey = decryptKey(dbUser.aiApiKeyEncrypted);
  const provider = dbUser.aiProvider as AIProvider;
  const model = dbUser.aiModel ?? undefined;

  // 2. Build context (lightweight — no checkins/streaks)
  const context = await buildSuggestionContext(userId);
  const contextJson = JSON.stringify(context);

  // 3. Build prompts + call generateNarrative (maxTokens 1500 — enough room
  //    for 5 fully-formed suggestions even with verbose models like Nemotron)
  const firstResult = await generateNarrative({
    apiKey,
    provider,
    model,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(goal, contextJson),
    maxTokens: 1500, jsonMode: true,
  });

  // 4. Parse JSON + validate with Zod. We wrap looseJsonParse failures in
  //    an AIProviderError so the route returns a 502 (PROVIDER_ERROR)
  //    instead of a generic 500 (which the user can't act on).
  let suggestions: HabitSuggestion[];
  try {
    suggestions = validateSuggestions(looseJsonParse(firstResult.text));
  } catch (parseErr) {
    // Surface the model output (truncated) so the user / dev log can diagnose
    const preview = firstResult.text.slice(0, 200);
    console.error("[generateSuggestions] first parse failed:", {
      provider,
      model: firstResult.model,
      preview,
      err: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    // Fall through to retry — don't throw yet
    suggestions = [];
  }

  // 5. If parse yielded zero valid suggestions, retry once with stricter prompt
  if (suggestions.length === 0) {
    const retryResult = await generateNarrative({
      apiKey,
      provider,
      model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildRetryUserPrompt(goal, contextJson),
      maxTokens: 1500, jsonMode: true,
    });

    try {
      suggestions = validateSuggestions(looseJsonParse(retryResult.text));
    } catch (parseErr) {
      const preview = retryResult.text.slice(0, 200);
      console.error("[generateSuggestions] retry parse failed:", {
        provider,
        model: retryResult.model,
        preview,
        err: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      suggestions = [];
    }

    // 6. Final retry with the absolute-strictest prompt — small max_tokens,
    //    single-suggestion shape, no prose allowed. This almost always works
    //    for stubborn models (e.g. Nemotron 3 Super sometimes wraps output
    //    in markdown despite all instructions).
    if (suggestions.length === 0) {
      const finalResult = await generateNarrative({
        apiKey,
        provider,
        model,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildFinalRetryUserPrompt(goal, contextJson),
        maxTokens: 800, jsonMode: true,
      });

      try {
        suggestions = validateSuggestions(looseJsonParse(finalResult.text));
      } catch (parseErr2) {
        const preview = finalResult.text.slice(0, 200);
        console.error("[generateSuggestions] final parse failed:", {
          provider,
          model: finalResult.model,
          preview,
          err: parseErr2 instanceof Error ? parseErr2.message : String(parseErr2),
        });
      }

      if (suggestions.length === 0) {
        // All three attempts failed to produce valid suggestions. Surface
        // as a 502 (PROVIDER_ERROR) so the route's catch returns 502,
        // not 500. The message is actionable for the user.
        throw new AIProviderError(
          provider,
          502,
          `The ${provider} model produced output we couldn't parse as JSON after 3 attempts. Please try again — if it keeps failing, switch models in Settings, or rephrase your goal to be more specific.`,
        );
      }
    }
  }

  // 7. Cap at 5 suggestions (model might return more)
  suggestions = suggestions.slice(0, 5);

  // 8. Log to HabitSuggestionLog (best-effort — don't fail the call on log error)
  try {
    await db.habitSuggestionLog.create({
      data: {
        userId,
        goal,
        suggested: JSON.stringify(suggestions),
        accepted: null,
        model: firstResult.model,
        tokensUsed: null,
      },
    });
  } catch (e) {
    // Non-fatal — logging is observability, not user-affecting
    console.error("[habitSuggestionLog] failed to log:", e);
  }

  return {
    suggestions,
    model: firstResult.model,
    tokensUsed: undefined,
  };
}

/* ============================================================================
   Re-export
============================================================================ */

export { AIProviderError, ICON_NAMES, HABIT_ICONS };
