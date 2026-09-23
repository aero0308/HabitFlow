import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";
import { getWeekStart } from "@/lib/ai/buildCoachContext";
import { generateCoachLetter, AIProviderError } from "@/lib/ai/generateCoachLetter";

/**
 * POST /api/insights/coach-letter/regenerate
 *
 * Deletes the cached letter for the current (or specified) week and
 * regenerates a new one. Rate limit: 1 per 30 minutes per user.
 *
 * Body: optional `{ "week": "YYYY-MM-DD" }`. If omitted, uses current week.
 */

const regenerateAttempts = new Map<string, number>();
const WINDOW_MS = 30 * 60 * 1000; // 30 min

// AI generation can take 5-15s on slow providers — allow up to 60s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    // Rate limit: 1 per 30 min
    const now = Date.now();
    const key = user.id;
    const lastAt = regenerateAttempts.get(key);
    if (lastAt && now - lastAt < WINDOW_MS) {
      const minsLeft = Math.ceil((WINDOW_MS - (now - lastAt)) / 60000);
      return apiError(
        `Too soon. Try again in ${minsLeft} min.`,
        429,
        "RATE_LIMITED",
      );
    }
    regenerateAttempts.set(key, now);

    // Resolve target week (query or body or current)
    const url = new URL(req.url);
    const queryWeek = url.searchParams.get("week");
    let bodyWeek: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.week === "string") bodyWeek = body.week;
    } catch {
      // Body may be empty — that's fine
    }
    const weekParam = queryWeek ?? bodyWeek;
    const weekStart = weekParam
      ? getWeekStart(new Date(weekParam))
      : getWeekStart();
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    // Check for API key
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { aiProvider: true, aiApiKeyEncrypted: true },
    });

    if (!dbUser?.aiProvider || !dbUser?.aiApiKeyEncrypted) {
      return apiError(
        "No API key set. Add one in Settings.",
        400,
        "NO_API_KEY",
      );
    }

    // Delete old cached letter (if any)
    await db.weeklyCoachLetter.deleteMany({
      where: { userId: user.id, weekStart: weekStartStr },
    });

    // Generate fresh
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
      return apiError(
        "No API key set. Add one in Settings.",
        400,
        "NO_API_KEY",
      );
    }
    return apiError(
      e instanceof Error ? e.message : "Failed to regenerate coach letter",
    );
  }
}
