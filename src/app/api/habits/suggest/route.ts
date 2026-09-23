import { NextRequest } from "next/server";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";
import {
  generateSuggestions,
  AIProviderError,
} from "@/lib/ai/generateSuggestions";

/**
 * POST /api/habits/suggest
 *
 * Body: { goal: string }
 *
 * Generates 3-5 AI-suggested habits for the given goal. The user must have
 * an AI provider + key configured (otherwise returns 402 NO_API_KEY).
 *
 * Rate limit: 5 generations per user per hour (in-memory Map).
 * Each successful generation is logged to HabitSuggestionLog.
 */

const HOUR_MS = 60 * 60 * 1000;
// Note: a single Generate click can trigger up to 3 internal retries inside
// generateSuggestions (when the model's JSON output fails to parse). Each
// retry counts as a separate request to the provider, but only ONE against
// the user's hourly budget. The limits below are intentionally generous
// (50/hr, 200/day) so a user actively iterating on suggestions doesn't get
// blocked during normal use; the provider's own RPM cap (NVIDIA: 40 RPM,
// Groq: 30 RPM free) is the real ceiling.
const HOURLY_LIMIT = 50;
const DAILY_LIMIT = 200;
const rateBuckets = new Map<string, {
  count: number;
  firstAt: number;
  dailyCount: number;
  dailyFirstAt: number;
}>();

// AI generation can take 5-15s on slow providers — allow up to 60s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const body = (await req.json().catch(() => ({}))) as {
      goal?: unknown;
    };
    const rawGoal = typeof body.goal === "string" ? body.goal.trim() : "";

    if (rawGoal.length < 3) {
      return apiError(
        "Tell us a bit more about your goal (at least 3 characters).",
        400,
        "GOAL_TOO_SHORT",
      );
    }
    if (rawGoal.length > 200) {
      return apiError(
        "Goal is too long — keep it under 200 characters.",
        400,
        "GOAL_TOO_LONG",
      );
    }

    // Rate limit: 50/hr + 200/day per user. The hourly cap protects against
    // accidental infinite loops; the daily cap protects against budget abuse.
    const now = Date.now();
    const DAY_MS = 24 * HOUR_MS;
    const DAY_LIMIT = DAILY_LIMIT;
    let record = rateBuckets.get(user.id);
    if (!record) {
      record = { count: 0, firstAt: now, dailyCount: 0, dailyFirstAt: now };
      rateBuckets.set(user.id, record);
    }
    // Reset windows if expired
    if (now - record.firstAt > HOUR_MS) {
      record.firstAt = now;
      record.count = 0;
    }
    if (now - record.dailyFirstAt > DAY_MS) {
      record.dailyFirstAt = now;
      record.dailyCount = 0;
    }
    if (record.count >= HOURLY_LIMIT) {
      const minsLeft = Math.ceil((HOUR_MS - (now - record.firstAt)) / 60000);
      return apiError(
        `You've generated ${HOURLY_LIMIT}+ suggestions this hour. Try again in ${minsLeft} min.`,
        429,
        "RATE_LIMITED",
      );
    }
    if (record.dailyCount >= DAY_LIMIT) {
      return apiError(
        `Daily limit reached (${DAY_LIMIT} generations/day). Try again tomorrow.`,
        429,
        "RATE_LIMITED_DAILY",
      );
    }
    record.count++;
    record.dailyCount++;

    try {
      const result = await generateSuggestions(user.id, rawGoal);
      return apiOk(result);
    } catch (e) {
      if (e instanceof Error && e.message === "NO_API_KEY") {
        return apiError(
          "No AI key set. Add one in Settings.",
          402,
          "NO_API_KEY",
        );
      }
      if (e instanceof AIProviderError) {
        // Log provider errors with full context so we can diagnose
        // intermittent failures (e.g. Groq JSON-mode rejections).
        console.error("[habit-suggest] provider error:", {
          provider: e.provider,
          status: e.status,
          message: e.message,
          goal: rawGoal,
        });
        if (e.status === 401) {
          // Auto-clear the stored key on invalid auth so the user is forced
          // to re-add it in Settings (matches the coach-letter pattern).
          const { db } = await import("@/lib/db");
          await db.user.update({
            where: { id: user.id },
            data: { aiProvider: null, aiModel: null, aiApiKeyEncrypted: null },
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
            "PROVIDER_RATE_LIMITED",
          );
        }
        return apiError(e.message, 502, "PROVIDER_ERROR");
      }
      // Unexpected non-provider error — log full context for diagnosis
      console.error("[habit-suggest] unexpected error:", e);
      throw e;
    }
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.message === "UNAUTHORIZED" || err.status === 401) {
      return apiError("Not authenticated", 401, "UNAUTHORIZED");
    }
    // Log the full error for debugging
    console.error("[habit-suggest] error:", e);
    return apiError(
      err instanceof Error ? err.message : "Failed to generate suggestions",
      500,
      "INTERNAL_ERROR",
    );
  }
}
