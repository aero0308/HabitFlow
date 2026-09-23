import { db } from "@/lib/db";

/**
 * Light context builder for AI habit suggestions.
 *
 * Unlike buildChatContext / buildCoachContext (which assemble rich analytics
 * for chat & weekly letter), this only gathers a *minimal* snapshot that
 * helps the model avoid suggesting duplicate habits and tailor the cadence
 * to the user's existing setup:
 *
 *   - existing habit names (so the AI doesn't propose "Drink water" twice)
 *   - the most common timeOfDay across existing habits (preferred slot)
 *   - the most common frequency (preferred cadence)
 *   - a typical targetCount (median) for non-binary habits
 *   - existing categories (so suggestions land in familiar buckets)
 *
 * No checkins, streaks, or mood data — suggestions are forward-looking and
 * shouldn't be biased by recent completion noise.
 */
export interface SuggestionContext {
  user: { firstName: string };
  existingHabits: string[];
  preferredTimeOfDay: string | null;
  preferredFrequency: string | null;
  existingCategories: string[];
}

export async function buildSuggestionContext(
  userId: string,
): Promise<SuggestionContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, name: true },
  });

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";

  const habits = await db.habit.findMany({
    where: { userId, isArchived: false },
    select: {
      name: true,
      frequency: true,
      timeOfDay: true,
      targetCount: true,
      category: true,
    },
  });

  const existingHabits = habits
    .map((h) => h.name.trim())
    .filter((n) => n.length > 0);

  const existingCategories = Array.from(
    new Set(habits.map((h) => h.category).filter((c) => c && c.trim() !== "")),
  ).sort();

  // Pick the most common timeOfDay (excluding ANY_TIME so a real slot wins).
  const todCounts = new Map<string, number>();
  for (const h of habits) {
    const tod = (h.timeOfDay || "ANY_TIME").toUpperCase();
    if (tod === "ANY_TIME") continue;
    todCounts.set(tod, (todCounts.get(tod) ?? 0) + 1);
  }
  let preferredTimeOfDay: string | null = null;
  let bestTodCount = 0;
  for (const [tod, count] of todCounts) {
    if (count > bestTodCount) {
      bestTodCount = count;
      preferredTimeOfDay = tod;
    }
  }

  // Pick the most common frequency.
  const freqCounts = new Map<string, number>();
  for (const h of habits) {
    const f = (h.frequency || "daily").toLowerCase();
    freqCounts.set(f, (freqCounts.get(f) ?? 0) + 1);
  }
  let preferredFrequency: string | null = null;
  let bestFreqCount = 0;
  for (const [f, count] of freqCounts) {
    if (count > bestFreqCount) {
      bestFreqCount = count;
      preferredFrequency = f;
    }
  }

  return {
    user: { firstName },
    existingHabits,
    preferredTimeOfDay,
    preferredFrequency,
    existingCategories,
  };
}
