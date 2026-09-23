import { z } from "zod";
import { db } from "@/lib/db";
import { decryptKey } from "@/lib/ai/encryption";
import {
  generateNarrative,
  AIProvider,
  AIProviderError,
} from "@/lib/ai/providers";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  buildRetryUserPrompt,
} from "@/lib/ai/coachLetterPrompt";
import {
  buildCoachContext,
  getWeekStart,
} from "@/lib/ai/buildCoachContext";

/**
 * Generates and persists a structured Weekly Coach Letter.
 *
 * Pipeline:
 *  1. Load user + validate AI key (decrypt via @/lib/ai/encryption)
 *  2. Build context via buildCoachContext
 *  3. Load last week's WeeklyCoachLetter for experiment follow-up (handled
 *     inside buildCoachContext — exposed as context.lastWeekExperiment)
 *  4. Build prompts
 *  5. Call generateNarrative with maxTokens 1200
 *  6. Parse JSON response with Zod schema validation
 *  7. If parse fails → retry once with stricter prompt
 *  8. Build bodyMarkdown from sections
 *  9. Save to db.weeklyCoachLetter (upsert on userId+weekStart)
 * 10. Return the saved letter
 */

/* ============================================================================
   Zod schema — defines the valid shape of the model's JSON output
============================================================================ */

export const coachLetterSchema = z.object({
  subject: z.string().min(1).max(200),
  greeting: z.string().min(1).max(200),
  intro: z.string().min(1).max(800),
  whatsWorking: z.string().min(1).max(800),
  whereYouSlipped: z.string().min(1).max(800),
  experiment: z.string().min(1).max(800),
  closing: z.string().min(1).max(400),
});

export type CoachLetter = z.infer<typeof coachLetterSchema>;

/** Type returned by the persistence step — what the API & UI consume. */
export interface SavedCoachLetter {
  id: string;
  userId: string;
  weekStart: string;
  subject: string;
  bodyMarkdown: string;
  sections: CoachLetter;
  model: string;
  tokensUsed: number | null;
  generatedAt: Date;
  readAt: Date | null;
  emailedAt: Date | null;
  shareToken: string | null;
}

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
    // Remove the opening fence (with or without language tag) and the closing fence
    const withoutOpen = trimmed.replace(/^```(?:json)?\s*\n?/i, "");
    const withoutClose = withoutOpen.replace(/\n?```\s*$/i, "");
    return withoutClose.trim();
  }
  return trimmed;
}

/**
 * Compose the markdown body shown in the modal / email preview. Uses the
 * validated sections object. Kept in sync with the modal's structured render
 * (subject → greeting → intro → whatsWorking → whereYouSlipped → experiment → closing).
 */
function buildBodyMarkdown(sections: CoachLetter): string {
  return [
    `# ${sections.subject}`,
    ``,
    sections.greeting,
    ``,
    sections.intro,
    ``,
    `## What's working`,
    ``,
    sections.whatsWorking,
    ``,
    `## Where you slipped`,
    ``,
    sections.whereYouSlipped,
    ``,
    `## One experiment for next week`,
    ``,
    `> ${sections.experiment}`,
    ``,
    sections.closing,
  ].join("\n");
}

/* ============================================================================
   Main entry point
============================================================================ */

export async function generateCoachLetter(
  userId: string,
  weekStart: Date,
): Promise<SavedCoachLetter> {
  const weekStartStr = weekStart.toISOString().slice(0, 10);

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
  const firstName = dbUser.firstName || dbUser.name?.split(" ")[0] || "there";

  // 2. Build context (also loads last week's letter for experiment follow-up)
  const context = await buildCoachContext(userId, weekStart);
  const contextJson = JSON.stringify(context);

  // 4. Build prompts
  const userPrompt = buildUserPrompt(firstName, weekStartStr, contextJson);

  // 5 + 6 + 7. Call generateNarrative, parse, retry once on parse failure
  const result = await generateNarrative({
    apiKey,
    provider,
    model,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1200, jsonMode: true,
  });

  let parsed: CoachLetter | null = null;
  let tokensUsed: number | null = null;
  try {
    parsed = coachLetterSchema.parse(JSON.parse(stripCodeFences(result.text)));
  } catch {
    // Retry with stricter prompt
    const retryResult = await generateNarrative({
      apiKey,
      provider,
      model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildRetryUserPrompt(firstName, weekStartStr, contextJson),
      maxTokens: 1200, jsonMode: true,
    });
    try {
      parsed = coachLetterSchema.parse(
        JSON.parse(stripCodeFences(retryResult.text)),
      );
      tokensUsed = null;
    } catch (e2) {
      // Both attempts failed to parse — surface a clear error
      throw new Error(
        `Coach letter JSON parse failed after retry: ${
          e2 instanceof Error ? e2.message : "unknown error"
        }`,
      );
    }
  }

  if (!parsed) {
    throw new Error("Coach letter generation produced no parseable output");
  }

  // 8. Build bodyMarkdown
  const bodyMarkdown = buildBodyMarkdown(parsed);

  // 9. Save (upsert on userId + weekStart)
  const saved = await db.weeklyCoachLetter.upsert({
    where: {
      userId_weekStart: { userId, weekStart: weekStartStr },
    },
    create: {
      userId,
      weekStart: weekStartStr,
      subject: parsed.subject,
      bodyMarkdown,
      sections: JSON.stringify(parsed),
      model: result.model,
      tokensUsed,
      generatedAt: new Date(),
    },
    update: {
      subject: parsed.subject,
      bodyMarkdown,
      sections: JSON.stringify(parsed),
      model: result.model,
      tokensUsed,
      generatedAt: new Date(),
    },
  });

  // 10. Return the saved letter
  return {
    id: saved.id,
    userId: saved.userId,
    weekStart: saved.weekStart,
    subject: saved.subject,
    bodyMarkdown: saved.bodyMarkdown,
    sections: parsed,
    model: saved.model,
    tokensUsed: saved.tokensUsed,
    generatedAt: saved.generatedAt,
    readAt: saved.readAt,
    emailedAt: saved.emailedAt,
    shareToken: saved.shareToken,
  };
}

/* ============================================================================
   Re-export so consumers don't need a second import line
============================================================================ */

export { AIProviderError, getWeekStart };
