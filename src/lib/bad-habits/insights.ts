/**
 * Insight helpers for bad habits.
 *
 * These compute aggregate patterns from the slip history (and optional mood
 * data). All functions are pure (no DB calls) so they can be composed in
 * API routes and tested in isolation.
 *
 * Design rule: tone is supportive, NEVER shaming. Slips are "learning
 * opportunities". Insights describe patterns neutrally + offer a kind
 * observation if relevant.
 */

import type { SlipLike, BadHabitLike } from "./compute";
import { computeTotalCleanDays, computeTotalElapsedDays } from "./compute";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Returns JS getDay() index converted to Mon-first (0=Mon..6=Sun) — matches
 * the convention used elsewhere in the codebase (streak.ts, analytics).
 */
function monFirstDayIndex(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export interface TriggerFrequency {
  trigger: string;
  count: number;
  pct: number;
}

/**
 * Frequency of each trigger mentioned across the slip history.
 * - Triggers with no name are bucketed as "(no trigger)".
 * - Returns sorted by count descending.
 * - `pct` is rounded 0..100 of the slip total.
 */
export function computeTriggerFrequency(slips: SlipLike[]): TriggerFrequency[] {
  if (slips.length === 0) return [];
  const counts = new Map<string, number>();
  for (const s of slips) {
    const t = (s.trigger ?? "").trim() || "(no trigger)";
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const total = slips.length;
  return Array.from(counts.entries())
    .map(([trigger, count]) => ({
      trigger,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export interface DayOfWeekPattern {
  day: string;
  count: number;
}

/**
 * Slip count per day of week (Mon-Sun). Always returns a 7-element array in
 * Mon-first order, even for days with 0 slips.
 */
export function computeDayOfWeekPattern(slips: SlipLike[]): DayOfWeekPattern[] {
  const buckets = new Array(7).fill(0) as number[];
  for (const s of slips) {
    if (!s.date) continue;
    const d = parseDateString(s.date);
    buckets[monFirstDayIndex(d)] += 1;
  }
  return DAY_NAMES.map((day, i) => ({ day, count: buckets[i] }));
}

/**
 * Total clean days vs total elapsed days since quitDate.
 * Returns { cleanDays, totalDays, slipDays, pct }.
 */
export function computeCleanDaysPct(
  badHabit: BadHabitLike,
  slips: SlipLike[],
  today: Date = new Date(),
): { cleanDays: number; totalDays: number; slipDays: number; pct: number } {
  const totalDays = computeTotalElapsedDays(badHabit, today);
  const cleanDays = computeTotalCleanDays(badHabit, slips, today);
  const slipDays = Math.max(0, totalDays - cleanDays);
  const pct = totalDays === 0 ? 0 : Math.round((cleanDays / totalDays) * 100);
  return { cleanDays, totalDays, slipDays, pct };
}

export interface MoodCorrelation {
  cleanAvg: number | null;
  slipAvg: number | null;
  delta: number | null;
  summary: string;
}

/**
 * Compare the average mood on clean days vs slip days for a bad habit.
 *
 * - cleanAvg: average of mood scores on days that were NOT slip days (and
 *   after quitDate).
 * - slipAvg:  average of mood scores on slip days.
 * - delta:   cleanAvg - slipAvg (positive => user felt better on clean days).
 * - summary: a one-line friendly observation, ONLY if both averages exist.
 *   Tone is supportive — describes what the data shows, never "you should".
 *
 * Returns null if the user has no mood data at all in the relevant range.
 */
export function computeMoodCorrelation(
  badHabit: BadHabitLike,
  slips: SlipLike[],
  moodEntries: Array<{ date: string; score: number }>,
): MoodCorrelation | null {
  if (moodEntries.length === 0) return null;

  const slipDateSet = new Set(slips.map((s) => s.date));
  const cleanScores: number[] = [];
  const slipScores: number[] = [];

  for (const m of moodEntries) {
    if (slipDateSet.has(m.date)) {
      slipScores.push(m.score);
    } else {
      cleanScores.push(m.score);
    }
  }

  const cleanAvg =
    cleanScores.length > 0
      ? Math.round((cleanScores.reduce((s, v) => s + v, 0) / cleanScores.length) * 10) / 10
      : null;
  const slipAvg =
    slipScores.length > 0
      ? Math.round((slipScores.reduce((s, v) => s + v, 0) / slipScores.length) * 10) / 10
      : null;

  let delta: number | null = null;
  if (cleanAvg != null && slipAvg != null) {
    delta = Math.round((cleanAvg - slipAvg) * 10) / 10;
  }

  let summary = "";
  if (cleanAvg != null && slipAvg != null) {
    if (delta != null && delta > 0.4) {
      summary = `Your mood runs about ${delta.toFixed(1)} points higher on clean days. That's a meaningful signal — worth noticing.`;
    } else if (delta != null && delta < -0.4) {
      summary = `Your mood has been a touch lower on clean days lately. Be gentle with yourself — quitting is hard, and low moods can make urges stronger. A smaller version of the habit might be worth trying.`;
    } else {
      summary = `Your mood is fairly similar across clean and slip days. No clear mood-habit link yet — keep logging and patterns will surface.`;
    }
  } else if (cleanAvg != null) {
    summary = `You haven't logged any slips yet — your average mood is ${cleanAvg.toFixed(1)} / 10 since you quit.`;
  } else if (slipAvg != null) {
    summary = `On slip days, your mood averages ${slipAvg.toFixed(1)} / 10. Logging clean days too will help us see the full picture.`;
  }

  return { cleanAvg, slipAvg, delta, summary };
}
