import { db } from "@/lib/db";
import type { Habit } from "@prisma/client";

export interface HabitWithScheduling {
  id: string;
  frequency: string;
  customDays: string;
  targetCount: number;
  startDate: Date | string;
}

/**
 * Parse customDays stored as comma-separated "0,1,2" (Mon=0..Sun=6)
 */
export function parseCustomDays(customDays: string): number[] {
  if (!customDays) return [];
  return customDays
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

/**
 * Returns true if the habit is scheduled to be performed on `date`.
 * Mirrors the spec's is_habit_scheduled exactly.
 *  - date < start_date -> False
 *  - daily -> True
 *  - weekly -> same weekday as start_date
 *  - custom -> weekday in custom_days
 *
 * NOTE: JS Date.getDay() returns 0=Sunday..6=Saturday. The spec uses
 * 0=Mon..6=Sun. We normalize: store customDays as 0=Mon..6=Sun (per spec),
 * and convert JS getDay() into the same Mon-first convention here.
 */
export function isHabitScheduled(habit: HabitWithScheduling, date: Date): boolean {
  const start = new Date(habit.startDate);
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (dateOnly < startDateOnly) return false;

  // Convert JS getDay() (0=Sun..6=Sat) to Mon-first index (0=Mon..6=Sun)
  const jsDay = date.getDay();
  const monFirstDay = jsDay === 0 ? 6 : jsDay - 1;

  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly") {
    const startJsDay = start.getDay();
    const startMonFirst = startJsDay === 0 ? 6 : startJsDay - 1;
    return monFirstDay === startMonFirst;
  }
  if (habit.frequency === "custom") {
    const days = parseCustomDays(habit.customDays);
    return days.includes(monFirstDay);
  }
  return false;
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateString(s: string): Date {
  // Parse YYYY-MM-DD as local date (avoid timezone drift)
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate: number;
}

/**
 * Calculate streaks from a map of {dateString: count}.
 * Mirrors the spec's calculate_current_streak exactly.
 */
export function calculateStreaks(
  habit: HabitWithScheduling,
  checkinsByDate: Record<string, number>,
  today: Date,
  frozenDates: Set<string> = new Set(),
  offModeDates: Set<string> = new Set(),
): StreakResult {
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(habit.startDate);
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  // ---- Current streak ----
  let currentStreak = 0;
  let cursor = new Date(todayOnly);
  // If today is scheduled but not yet completed (and not frozen), start from yesterday
  if (
    isHabitScheduled(habit, cursor) &&
    !(toDateString(cursor) in checkinsByDate) &&
    !frozenDates.has(toDateString(cursor)) &&
    !offModeDates.has(toDateString(cursor))
  ) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  while (cursor >= startDateOnly) {
    const ds = toDateString(cursor);
    // Skip off-mode days entirely — they don't break or extend streaks
    if (offModeDates.has(ds)) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
      continue;
    }
    if (isHabitScheduled(habit, cursor)) {
      const key = toDateString(cursor);
      const isCompleted = (checkinsByDate[key] || 0) >= habit.targetCount;
      const isFrozen = frozenDates.has(key);
      if (isCompleted || isFrozen) {
        currentStreak += 1;
      } else {
        break;
      }
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }

  // ---- Longest streak ----
  let longestStreak = 0;
  let running = 0;
  const iter = new Date(startDateOnly);
  while (iter <= todayOnly) {
    const iterDs = toDateString(iter);
    // Skip off-mode days — they don't break or extend streaks
    if (offModeDates.has(iterDs)) {
      iter.setDate(iter.getDate() + 1);
      continue;
    }
    if (isHabitScheduled(habit, iter)) {
      const key = toDateString(iter);
      const isCompleted = (checkinsByDate[key] || 0) >= habit.targetCount;
      const isFrozen = frozenDates.has(key);
      if (isCompleted || isFrozen) {
        running += 1;
        if (running > longestStreak) longestStreak = running;
      } else {
        running = 0;
      }
    }
    iter.setDate(iter.getDate() + 1);
  }

  // ---- Completion rate over scheduled days so far ----
  let scheduled = 0;
  let completed = 0;
  let totalCompletions = 0;
  const iter2 = new Date(startDateOnly);
  while (iter2 <= todayOnly) {
    if (isHabitScheduled(habit, iter2)) {
      scheduled += 1;
      const key = toDateString(iter2);
      const cnt = checkinsByDate[key] || 0;
      if (cnt > 0) totalCompletions += 1;
      if (cnt >= habit.targetCount) completed += 1;
    }
    iter2.setDate(iter2.getDate() + 1);
  }
  const completionRate = scheduled === 0 ? 0 : completed / scheduled;

  return {
    currentStreak,
    longestStreak,
    totalCompletions,
    completionRate,
  };
}

/**
 * Recalculate and persist streaks for a habit (accounting for frozen days).
 */
export async function recalculateStreak(habitId: string, today = new Date()): Promise<StreakResult> {
  const habit = await db.habit.findUnique({ where: { id: habitId } });
  if (!habit) throw new Error("Habit not found");

  const [checkins, freezes, offModes] = await Promise.all([
    db.checkin.findMany({ where: { habitId } }),
    db.habitFreeze.findMany({ where: { habitId } }),
    db.offMode.findMany({ where: { userId: habit.userId } }),
  ]);
  const byDate: Record<string, number> = {};
  for (const c of checkins) {
    byDate[c.date] = c.count;
  }
  const frozenSet = new Set(freezes.map((f) => f.date));
  const offModeSet = new Set<string>();
  for (const om of offModes) {
    // Expand date range into individual dates
    const start = new Date(om.startDate + "T00:00:00");
    const end = new Date(om.endDate + "T00:00:00");
    const iter = new Date(start);
    while (iter <= end) {
      offModeSet.add(toDateString(iter));
      iter.setDate(iter.getDate() + 1);
    }
  }

  const result = calculateStreaks(habit, byDate, today, frozenSet, offModeSet);
  const lastCompleted = checkins
    .filter((c) => c.count >= habit.targetCount)
    .map((c) => c.date)
    .sort()
    .pop();

  await db.streak.upsert({
    where: { habitId },
    create: {
      habitId,
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      totalCompletions: result.totalCompletions,
      lastCompletedDate: lastCompleted ?? null,
      updatedAt: new Date(),
    },
    update: {
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      totalCompletions: result.totalCompletions,
      lastCompletedDate: lastCompleted ?? null,
      updatedAt: new Date(),
    },
  });

  return result;
}
