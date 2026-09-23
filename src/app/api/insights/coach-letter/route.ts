import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";
import { getWeekStart } from "@/lib/ai/buildCoachContext";
import { generateCoachLetter, AIProviderError } from "@/lib/ai/generateCoachLetter";

/**
 * GET /api/insights/coach-letter?week=YYYY-MM-DD
 *
 * Returns the cached WeeklyCoachLetter for the given week (or current week
 * if no `week` query param). If not cached:
 *   - If user has an AI key → generate on demand and return cached:false
 *   - If no AI key → return { letter: null, reason: "no_api_key" }
 *
 * Rate limit: max 3 generations per user per day (only counts toward actual
 * AI generations, not cached reads).
 */

const generationAttempts = new Map<string, { count: number; firstAt: number }>();
const DAILY_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// AI generation can take 5-15s on slow providers — allow up to 60s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const weekParam = req.nextUrl.searchParams.get("week");

    const weekStart = weekParam
      ? getWeekStart(new Date(weekParam))
      : getWeekStart();
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    // Check for cached letter
    const cached = await db.weeklyCoachLetter.findUnique({
      where: {
        userId_weekStart: { userId: user.id, weekStart: weekStartStr },
      },
    });

    if (cached) {
      return apiOk({
        letter: {
          id: cached.id,
          weekStart: cached.weekStart,
          subject: cached.subject,
          bodyMarkdown: cached.bodyMarkdown,
          sections: cached.sections, // raw JSON string — client parses
          model: cached.model,
          tokensUsed: cached.tokensUsed,
          generatedAt: cached.generatedAt,
          readAt: cached.readAt,
          shareToken: cached.shareToken,
        },
        cached: true,
      });
    }

    // Not cached — check if user has an API key
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { aiProvider: true, aiApiKeyEncrypted: true },
    });

    if (!dbUser?.aiProvider || !dbUser?.aiApiKeyEncrypted) {
      return apiOk({ letter: null, reason: "no_api_key" });
    }

    // Rate limit: max 3 generations per user per day
    const now = Date.now();
    const key = user.id;
    const record = generationAttempts.get(key);
    if (record && now - record.firstAt < DAY_MS) {
      if (record.count >= DAILY_LIMIT) {
        return apiError(
          "Daily letter limit reached. Try again tomorrow.",
          429,
          "RATE_LIMITED",
        );
      }
      record.count++;
    } else {
      generationAttempts.set(key, { count: 1, firstAt: now });
    }

    // Generate on demand
    try {
      const saved = await generateCoachLetter(user.id, weekStart);

      return apiOk({
        letter: {
          id: saved.id,
          weekStart: saved.weekStart,
          subject: saved.subject,
          bodyMarkdown: saved.bodyMarkdown,
          sections: JSON.stringify(saved.sections),
          model: saved.model,
          tokensUsed: saved.tokensUsed,
          generatedAt: saved.generatedAt,
          readAt: saved.readAt,
          shareToken: saved.shareToken,
        },
        cached: false,
      });
    } catch (e) {
      if (e instanceof AIProviderError) {
        if (e.status === 401) {
          // Auto-clear stored key on invalid auth
          await db.user.update({
            where: { id: user.id },
            data: {
              aiProvider: null,
              aiModel: null,
              aiApiKeyEncrypted: null,
            },
          });
          return apiError(
            "Your AI key is invalid. Please re-add it in Settings.",
            401,
            "INVALID_KEY",
          );
        }
        if (e.status === 429) {
          return apiError(
            "Your provider is rate limiting you. Try again later.",
            429,
            "RATE_LIMITED",
          );
        }
        return apiError(e.message, 502, "PROVIDER_ERROR");
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof Error && e.message === "NO_API_KEY") {
      return apiOk({ letter: null, reason: "no_api_key" });
    }
    return apiError(
      e instanceof Error ? e.message : "Failed to fetch coach letter",
    );
  }
}
