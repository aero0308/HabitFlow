import { buildChatContext, type ChatContext } from "@/lib/ai/buildChatContext";

/**
 * Generates 3-4 specific suggested questions for the user, based purely on
 * their data — no LLM call. We pull a compact context (reusing
 * buildChatContext with a generic "summarize my habits" question) and
 * inspect the detected patterns + per-habit stats to pick the most
 * relevant question templates.
 *
 * If no patterns are detected and no habit has a meaningful streak, we
 * fall back to a small set of generic questions ("What's my strongest
 * habit?", "How does mood correlate with completions?").
 *
 * Questions are returned as user-readable strings ready to drop into the
 * chat input.
 */

const GENERIC_QUESTIONS = [
  "What's my strongest habit right now?",
  "How does my mood correlate with completions?",
  "Which habit should I focus on improving?",
];

/**
 * Returns 3-4 suggested questions tailored to the user's data.
 */
export async function generateSuggestedQuestions(
  userId: string,
): Promise<string[]> {
  // Generic question triggers the base context (no deep dives) but gives
  // us patterns + stats + habit list.
  const ctx = (await buildChatContext(
    userId,
    "summarize my habits",
  )) as ChatContext;

  const picked: string[] = [];

  // Pattern-driven questions (priority order)
  for (const p of ctx.patterns) {
    if (p.type === "weekend_dip") {
      picked.push(`Why do I skip ${p.habitName} on weekends?`);
    } else if (p.type === "unusual_gap") {
      picked.push(
        `Why did I stop doing ${p.habitName}? It's been ${p.currentGap} days.`,
      );
    } else if (p.type === "streak_forming") {
      picked.push(`What's making ${p.habitName} stick?`);
    } else if (p.type === "mood_lift") {
      picked.push(
        `How does my mood change when I complete more habits?`,
      );
    }
    if (picked.length >= 4) break;
  }

  // Stats-driven questions
  if (picked.length < 4) {
    const declining = ctx.habits.find((h) => h.trend === "declining");
    if (declining && !picked.some((q) => q.includes(declining.name))) {
      picked.push(`Why is ${declining.name} declining this month?`);
    }
  }

  if (picked.length < 4) {
    const bestHabit = [...ctx.habits].sort(
      (a, b) => b.completionRate30d - a.completionRate30d,
    )[0];
    if (
      bestHabit &&
      bestHabit.completionRate30d > 0 &&
      !picked.some((q) => q.includes(bestHabit.name))
    ) {
      picked.push(`What's making ${bestHabit.name} my top habit?`);
    }
  }

  if (picked.length < 3) {
    // Pad with generic questions we haven't already used
    for (const g of GENERIC_QUESTIONS) {
      if (picked.length >= 4) break;
      if (!picked.some((q) => q.toLowerCase().includes(g.toLowerCase().slice(0, 10)))) {
        picked.push(g);
      }
    }
  }

  // Final cap — return at most 4
  return picked.slice(0, 4);
}
