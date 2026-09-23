import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { decryptKey } from "@/lib/ai/encryption";
import { generateNarrative, AIProvider, AIProviderError } from "@/lib/ai/providers";
import { buildWeeklyContext, getWeekStart } from "@/lib/ai/buildContext";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/weeklyPrompt";
import { apiOk, apiError } from "@/lib/api";

/**
 * GET /api/insights/weekly?week=YYYY-MM-DD
 *
 * - Looks for cached WeeklyInsight for (userId, weekStart)
 * - If found → returns it (cached)
 * - If not found AND user has an API key → generate on demand:
 *     * Build context from Prisma data
 *     * Call generateNarrative
 *     * Save to WeeklyInsight
 *     * Return { narrative, model, generatedAt, cached: false }
 * - If not found AND no API key → { narrative: null, reason: "no_api_key" }
 * - If generation fails → 500 with normalized error
 *
 * Rate limit: max 3 generations per user per day.
 */

const generationAttempts = new Map<string, { count: number; firstAt: number }>();

// AI generation can take 5-15s on slow providers — allow up to 60s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const weekParam = req.nextUrl.searchParams.get("week");

    let weekStart: Date;
    if (weekParam) {
      weekStart = new Date(weekParam);
      weekStart = getWeekStart(weekStart);
    } else {
      weekStart = getWeekStart();
    }

    const weekStartStr = weekStart.toISOString().slice(0, 10);

    // Check for cached insight
    const cached = await db.weeklyInsight.findUnique({
      where: {
        userId_weekStart: { userId: user.id, weekStart: weekStartStr },
      },
    });

    if (cached) {
      // Mark as read if not yet read
      if (!cached.readAt) {
        await db.weeklyInsight.update({
          where: { id: cached.id },
          data: { readAt: new Date() },
        });
      }
      return apiOk({
        narrative: cached.narrative,
        model: cached.model,
        generatedAt: cached.generatedAt,
        readAt: cached.readAt ?? new Date(),
        cached: true,
      });
    }

    // Not cached — check if user has an API key
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { aiProvider: true, aiModel: true, aiApiKeyEncrypted: true },
    });

    if (!dbUser?.aiProvider || !dbUser?.aiApiKeyEncrypted) {
      return apiOk({ narrative: null, reason: "no_api_key" });
    }

    // Rate limit: max 3 generations per user per day
    const now = Date.now();
    const key = user.id;
    const record = generationAttempts.get(key);
    if (record && now - record.firstAt < 24 * 60 * 60 * 1000) {
      if (record.count >= 3) {
        return apiError("Daily generation limit reached. Try again tomorrow.", 429, "RATE_LIMITED");
      }
      record.count++;
    } else {
      generationAttempts.set(key, { count: 1, firstAt: now });
    }

    // Generate on demand
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

      // Save to DB
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
        readAt: saved.readAt,
        cached: false,
      });
    } catch (e) {
      if (e instanceof AIProviderError) {
        // If invalid key (401), auto-clear the stored key
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
    return apiError(e instanceof Error ? e.message : "Failed to get weekly insight");
  }
}
