import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";
import { recalculateStreak } from "@/lib/streak";
import { resolveIcon } from "@/lib/ai/habitIcons";
import { suggestionSchema, type HabitSuggestion } from "@/lib/ai/generateSuggestions";

/**
 * POST /api/habits/suggest/accept
 *
 * Body: { suggestions: HabitSuggestion[], goal: string }
 *
 * Accepts the user's selected (possibly edited) suggestions and creates
 * real Habit records in a single transaction. Each new habit:
 *   - name, icon (resolved via resolveIcon), color, frequency
 *   - customDays (joined as comma-separated string when frequency==="custom")
 *   - targetCount, timeOfDay
 *   - category derived from the goal + suggestion name via simple keyword match
 *   - position = (max existing position + 1) per habit (incremented)
 *
 * After creating, the most recent HabitSuggestionLog for this user is
 * updated with the accepted payload (so we can compare suggested vs accepted).
 */

const CATEGORY_KEYWORDS: { match: RegExp; category: string }[] = [
  { match: /(health|fit|exercise|workout|gym|run|walk|stretch|yoga|water|sleep|eat|drink|diet|nutrition|weight)/i, category: "Health" },
  { match: /(learn|read|book|study|language|code|skill|knowledge|practice)/i, category: "Learning" },
  { match: /(productiv|focus|deep work|pomodoro|plan|inbox|workspace|task|todo)/i, category: "Productivity" },
  { match: /(mindful|meditat|breath|calm|gratitude|present|journal|reflect)/i, category: "Mindfulness" },
  { match: /(creat|draw|paint|music|instrument|art|write|story|design)/i, category: "Creative" },
  { match: /(money|finance|budget|save|spend|invest)/i, category: "Finance" },
  { match: /(social|family|friend|call|connect|relationship)/i, category: "Social" },
  { match: /(sleep|wind down|evening|night|bedtime)/i, category: "Sleep" },
];

function deriveCategory(goal: string, suggestionName: string): string {
  const haystack = `${goal} ${suggestionName}`;
  for (const { match, category } of CATEGORY_KEYWORDS) {
    if (match.test(haystack)) return category;
  }
  return "";
}

const acceptSchema = z.object({
  suggestions: z.array(suggestionSchema).min(1).max(10),
  goal: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as unknown;
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message || "Invalid suggestions",
        400,
        "VALIDATION",
      );
    }

    const { suggestions, goal } = parsed.data;

    // Find the most recent HabitSuggestionLog for this user (best-effort —
    // we update its `accepted` field so we can later compare suggested vs
    // accepted). If no log exists (e.g. user accepted something generated
    // out-of-band), we just skip the update.
    const latestLog = await db.habitSuggestionLog.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const result = await db.$transaction(async (tx) => {
      // Compute base position from max position in user's habits
      const maxAgg = await tx.habit.aggregate({
        where: { userId: user.id },
        _max: { position: true },
      });
      let nextPos = (maxAgg._max.position ?? -1) + 1;

      const created: { id: string; name: string }[] = [];
      for (const s of suggestions) {
        const icon = resolveIcon(s.icon);
        const customDays =
          s.frequency === "custom" && s.days && s.days.length > 0
            ? s.days.slice().sort((a, b) => a - b).join(",")
            : "";
        const category = deriveCategory(goal, s.name);
        const habit = await tx.habit.create({
          data: {
            userId: user.id,
            name: s.name,
            description: "",
            color: s.color,
            icon,
            frequency: s.frequency,
            customDays,
            targetCount: s.targetCount,
            startDate: new Date(),
            position: nextPos++,
            isArchived: false,
            category,
            timeOfDay: s.timeOfDay,
          },
        });
        created.push({ id: habit.id, name: habit.name });
      }

      // Update the most recent log with the accepted payload
      if (latestLog) {
        await tx.habitSuggestionLog.update({
          where: { id: latestLog.id },
          data: { accepted: JSON.stringify(suggestions) },
        });
      }

      return created;
    });

    // Recalculate streaks outside the transaction (per-habit, not dependent on tx)
    await Promise.all(
      result.map((h) => recalculateStreak(h.id).catch(() => undefined)),
    );

    return apiOk({ created: result.length, habits: result });
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.message === "UNAUTHORIZED" || err.status === 401) {
      return apiError("Not authenticated", 401, "UNAUTHORIZED");
    }
    return apiError(
      err instanceof Error ? err.message : "Failed to accept suggestions",
      500,
    );
  }
}
