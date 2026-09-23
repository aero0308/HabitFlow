import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { decryptKey } from "@/lib/ai/encryption";
import { generateNarrative, AIProvider, AIProviderError } from "@/lib/ai/providers";
import { buildWeeklyContext, getWeekStart } from "@/lib/ai/buildContext";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/weeklyPrompt";
import { apiOk, apiError } from "@/lib/api";

/**
 * POST /api/insights/weekly/regenerate
 *
 * Deletes the cached insight for this week and regenerates a new one.
 * Rate limit: 1 regenerate per 15 min per user.
 */

const regenerateAttempts = new Map<string, number>();

// AI generation can take 5-15s on slow providers — allow up to 60s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    // Rate limit: 1 per 15 min
    const now = Date.now();
    const key = user.id;
    const lastAt = regenerateAttempts.get(key);
    if (lastAt && now - lastAt < 15 * 60 * 1000) {
      const minsLeft = Math.ceil((15 * 60 * 1000 - (now - lastAt)) / 60000);
      return apiError(`Too soon. Try again in ${minsLeft} min.`, 429, "RATE_LIMITED");
    }
    regenerateAttempts.set(key, now);

    const weekParam = req.nextUrl.searchParams.get("week");
    let weekStart: Date;
    if (weekParam) {
      weekStart = getWeekStart(new Date(weekParam));
    } else {
      weekStart = getWeekStart();
    }
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    // Check for API key
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { aiProvider: true, aiModel: true, aiApiKeyEncrypted: true },
    });

    if (!dbUser?.aiProvider || !dbUser?.aiApiKeyEncrypted) {
      return apiError("No API key set. Add one in Settings.", 400, "NO_API_KEY");
    }

    // Delete old cached insight (if any)
    await db.weeklyInsight.deleteMany({
      where: { userId: user.id, weekStart: weekStartStr },
    });

    // Generate fresh
    const apiKey = decryptKey(dbUser.aiApiKeyEncrypted);
    const context = await buildWeeklyContext(user.id, weekStart);
    const contextJson = JSON.stringify(context);
    const userPrompt = buildUserPrompt(weekStartStr, contextJson);

    try {
      const result = await generateNarrative({
        apiKey,
        provider: dbUser.aiProvider as AIProvider,
        model: dbUser.aiModel ?? undefined,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 600,
      });

      const saved = await db.weeklyInsight.create({
        data: {
          userId: user.id,
          weekStart: weekStartStr,
          narrative: result.text,
          model: result.model,
          readAt: new Date(),
        },
      });

      return apiOk({
        narrative: result.text,
        model: result.model,
        generatedAt: saved.generatedAt,
        cached: false,
      });
    } catch (e) {
      if (e instanceof AIProviderError) {
        if (e.status === 401) {
          await db.user.update({
            where: { id: user.id },
            data: { aiProvider: null, aiModel: null, aiApiKeyEncrypted: null },
          });
          return apiError("Your AI key is invalid. Please re-add it in Settings.", 401, "INVALID_KEY");
        }
        if (e.status === 429) {
          return apiError("Your provider is rate limiting you. Try again later.", 429, "RATE_LIMITED");
        }
        return apiError(e.message, 500, "PROVIDER_ERROR");
      }
      throw e;
    }
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to regenerate insight");
  }
}
