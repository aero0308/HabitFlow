/**
 * Pure compute functions for bad habits.
 *
 * Philosophy: clean streaks are COMPUTED (not stored). Milestones ARE stored
 * (audit trail). Mirrors the streak.ts pattern from the good-habits side
 * where the source of truth is the slip history + quitDate.
 *
 * Inputs are plain DB-shaped objects:
 *   - badHabit: { quitDate: Date; costPerDay?: number; currency: string; minutesPerDay?: number; ... }
 *   - slips: Array<{ date: string }>  (YYYY-MM-DD)
 *   - moodEntries: Array<{ date: string; score: number }>  (only used by computeMoodCorrelation)
 */

import {
  DAY_MILESTONES,
  MONEY_MILESTONES_USD,
  TIME_MILESTONES_HOURS,
  formatCurrency,
  dayMilestoneLabel,
  timeMilestoneLabel,
  type MilestoneType,
} from "./milestones";

export interface BadHabitLike {
  id: string;
  name: string;
  icon: string;
  color: string;
  quitDate: Date | string;
  reason?: string | null;
  triggers?: string | null;
  costPerDay?: number | null;
  currency?: string | null;
  minutesPerDay?: number | null;
  isArchived?: boolean;
}

export interface SlipLike {
  id: string;
  date: string; // YYYY-MM-DD
  trigger?: string | null;
  note?: string | null;
}

export interface MoneySaved {
  amount: number;
  formatted: string;
}

export interface TimeSaved {
  hours: number;
  formatted: string;
}

export interface NextMilestone {
  type: MilestoneType;
  value: number;
  label: string;
  daysRemaining: number;
  progressPct: number;
}

/**
 * Parse a YYYY-MM-DD string into a local-midnight Date (no timezone drift).
 */
function parseDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function differenceInCalendarDays(a: Date, b: Date): number {
  const aMid = startOfDay(a).getTime();
  const bMid = startOfDay(b).getTime();
  return Math.round((aMid - bMid) / (24 * 60 * 60 * 1000));
}

/**
 * Current clean streak: days since the most recent slip OR quitDate (whichever
 * is more recent), capped at the number of days elapsed since quitDate.
 *
 * - If the user slipped today, current streak = 0.
 * - If the user slipped yesterday, current streak = 1 (one clean day today).
 * - If no slips yet, current streak = (today - quitDate) in days.
 *
 * Returns 0 or a positive integer.
 */
export function computeCleanStreak(
  badHabit: BadHabitLike,
  slips: SlipLike[],
  today: Date = new Date(),
): number {
  const quit = new Date(badHabit.quitDate);
  const todayOnly = startOfDay(today);
  const quitOnly = startOfDay(quit);

  if (slips.length === 0) {
    // No slips: clean streak = days since quit date (inclusive of today if today == quit date -> 1)
    const diff = differenceInCalendarDays(todayOnly, quitOnly);
    return Math.max(0, diff + 1);
  }

  // Find most recent slip date
  const sortedSlipDates = slips.map((s) => s.date).sort();
  const lastSlipDateStr = sortedSlipDates[sortedSlipDates.length - 1];
  const lastSlipDate = parseDateString(lastSlipDateStr);

  // If the last slip was today, streak is 0 (today is not a clean day)
  if (differenceInCalendarDays(todayOnly, lastSlipDate) === 0) {
    return 0;
  }

  // If the last slip was after today (future-dated, shouldn't normally happen),
  // treat it as today for safety.
  if (differenceInCalendarDays(todayOnly, lastSlipDate) < 0) {
    return 0;
  }

  // Days since last slip. Since the user didn't slip today, today counts as a clean day.
  // last slip on day X -> today is X+N, so clean days = N (the days after the slip, including today).
  return differenceInCalendarDays(todayOnly, lastSlipDate);
}

/**
 * Longest clean streak: walk the slip history and find the maximum gap between
 * consecutive slips (and from quitDate to first slip, and from last slip to today).
 *
 * Algorithm:
 *   - Start: quitDate (the beginning of the user's journey).
 *   - For each slip in chronological order: the gap (slip.date - prev) is a clean-stretch.
 *     A slip on day X means the user was clean from prev to X-1 (inclusive).
 *     So the clean stretch = days from prev to X-1 inclusive = (X - prev) days where prev is the day BEFORE the slip reset.
 *   - Actually, since a slip on day X resets the streak on day X (that day is "unclean"),
 *     the clean stretch from prev (inclusive) to (X-1) inclusive is (X - prev) days.
 *   - After the last slip: clean stretch = today - lastSlip (with the same +1 logic as computeCleanStreak
 *     IF the user didn't slip today).
 *
 * Returns 0 or a positive integer.
 */
export function computeLongestStreak(
  badHabit: BadHabitLike,
  slips: SlipLike[],
  today: Date = new Date(),
): number {
  const quit = startOfDay(new Date(badHabit.quitDate));
  const todayOnly = startOfDay(today);

  if (slips.length === 0) {
    const diff = differenceInCalendarDays(todayOnly, quit);
    return Math.max(0, diff + 1);
  }

  const sortedDates = slips
    .map((s) => s.date)
    .filter((d) => d)
    .sort()
    .map((d) => parseDateString(d));

  let longest = 0;
  let cursor = quit; // start of the current clean window

  for (const slipDate of sortedDates) {
    // If slip is before quitDate, ignore (data quality)
    if (slipDate < quit) continue;

    // Clean window is [cursor, slipDate - 1] inclusive = (slipDate - cursor) days
    // BUT if slip happened on the cursor day itself, that's 0 clean days — fine.
    const diff = differenceInCalendarDays(slipDate, cursor);
    if (diff > longest) longest = diff;

    // After the slip, the clean window starts the day after the slip
    const next = new Date(slipDate);
    next.setDate(next.getDate() + 1);
    cursor = next;
  }

  // Final window: from cursor (day after last slip, or quitDate if no slips survived) to today
  // Same +1 logic as computeCleanStreak (today counts as a clean day if not slipped)
  const lastSlipDate = sortedDates[sortedDates.length - 1];
  if (differenceInCalendarDays(todayOnly, lastSlipDate) === 0) {
    // Slipped today: no clean window after
    return longest;
  }
  const finalDiff = differenceInCalendarDays(todayOnly, cursor) + 1;
  if (finalDiff > longest) longest = finalDiff;

  return Math.max(0, longest);
}

/**
 * Money saved since quitting. Returns null if costPerDay is not set.
 *
 * Formula: cleanDays × costPerDay, where cleanDays = total days elapsed since
 * quitDate minus the number of slip days (slip days are NOT counted as "saved"
 * because the user engaged in the habit that day).
 *
 * This gives a fair "money NOT spent" estimate.
 */
export function computeMoneySaved(
  badHabit: BadHabitLike,
  slips: SlipLike[],
  today: Date = new Date(),
): MoneySaved | null {
  if (badHabit.costPerDay == null || badHabit.costPerDay <= 0) return null;
  const currency = badHabit.currency || "USD";
  const totalDays = computeTotalElapsedDays(badHabit, today);
  const slipDays = slips.filter((s) => s.date <= toDateString(today)).length;
  const cleanDays = Math.max(0, totalDays - slipDays);
  const amount = Math.round(cleanDays * badHabit.costPerDay * 100) / 100;
  return {
    amount,
    formatted: formatCurrency(amount, currency),
  };
}

/**
 * Time reclaimed since quitting. Returns null if minutesPerDay is not set.
 *
 * Formula: cleanDays × minutesPerDay / 60.
 */
export function computeTimeSaved(
  badHabit: BadHabitLike,
  slips: SlipLike[],
  today: Date = new Date(),
): TimeSaved | null {
  if (badHabit.minutesPerDay == null || badHabit.minutesPerDay <= 0) return null;
  const totalDays = computeTotalElapsedDays(badHabit, today);
  const slipDays = slips.filter((s) => s.date <= toDateString(today)).length;
  const cleanDays = Math.max(0, totalDays - slipDays);
  const hours = Math.round((cleanDays * badHabit.minutesPerDay) / 60 * 10) / 10;
  return {
    hours,
    formatted: hours === 1 ? "1 hour" : `${hours} hours`,
  };
}

/**
 * Total days elapsed since quitDate (inclusive of today if today >= quitDate).
 */
export function computeTotalElapsedDays(
  badHabit: BadHabitLike,
  today: Date = new Date(),
): number {
  const quit = startOfDay(new Date(badHabit.quitDate));
  const todayOnly = startOfDay(today);
  const diff = differenceInCalendarDays(todayOnly, quit);
  return Math.max(0, diff + 1);
}

/**
 * Total days clean (since quit, excluding slip days). Used by insights.
 */
export function computeTotalCleanDays(
  badHabit: BadHabitLike,
  slips: SlipLike[],
  today: Date = new Date(),
): number {
  const total = computeTotalElapsedDays(badHabit, today);
  const slipDays = slips.filter((s) => s.date <= toDateString(today)).length;
  return Math.max(0, total - slipDays);
}

/**
 * Compute the next day-milestone the user has NOT yet reached.
 *
 * Returns the next "days clean" milestone with:
 *   - daysRemaining: how many more clean days until it unlocks
 *   - progressPct: current / target × 100, capped at 99 (so the next milestone
 *     shows 99% not 100% while still in progress; 100% is reserved for unlocked state)
 */
export function computeNextMilestone(
  badHabit: BadHabitLike,
  slips: SlipLike[],
  today: Date = new Date(),
): NextMilestone {
  const cleanStreak = computeCleanStreak(badHabit, slips, today);

  // Find the first DAY milestone strictly greater than cleanStreak.
  let next: number | null = null;
  for (const m of DAY_MILESTONES) {
    if (m > cleanStreak) {
      next = m;
      break;
    }
  }
  if (next == null) {
    // User has passed the largest day milestone — show the last one at 100% with 0 remaining.
    const last = DAY_MILESTONES[DAY_MILESTONES.length - 1];
    return {
      type: "days",
      value: last,
      label: dayMilestoneLabel(last),
      daysRemaining: 0,
      progressPct: 100,
    };
  }

  const daysRemaining = Math.max(0, next - cleanStreak);
  const progressPct = Math.min(99, Math.round((cleanStreak / next) * 100));
  return {
    type: "days",
    value: next,
    label: dayMilestoneLabel(next),
    daysRemaining,
    progressPct,
  };
}

/**
 * Compute all milestones that should be unlocked given the current state.
 * Returns an array of { type, value, label } for each unlocked milestone.
 *
 * Used by the API after creating/updating a bad habit (in case the user
 * backdated the quitDate) and after a slip undo (since the clean streak is now
 * longer, more milestones may unlock).
 */
export function computeUnlockedMilestones(
  badHabit: BadHabitLike,
  slips: SlipLike[],
  today: Date = new Date(),
): Array<{ type: MilestoneType; value: number; label: string }> {
  const cleanStreak = computeCleanStreak(badHabit, slips, today);
  const money = computeMoneySaved(badHabit, slips, today);
  const time = computeTimeSaved(badHabit, slips, today);

  const unlocked: Array<{ type: MilestoneType; value: number; label: string }> = [];

  for (const d of DAY_MILESTONES) {
    if (cleanStreak >= d) {
      unlocked.push({ type: "days", value: d, label: dayMilestoneLabel(d) });
    }
  }
  if (money) {
    for (const m of MONEY_MILESTONES_USD) {
      if (money.amount >= m) {
        unlocked.push({
          type: "money",
          value: m,
          label: `${formatCurrency(m, badHabit.currency || "USD")} saved`,
        });
      }
    }
  }
  if (time) {
    for (const h of TIME_MILESTONES_HOURS) {
      if (time.hours >= h) {
        unlocked.push({
          type: "time",
          value: h,
          label: timeMilestoneLabel(h),
        });
      }
    }
  }

  return unlocked;
}
