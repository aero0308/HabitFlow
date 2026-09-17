import { db } from "@/lib/db";
import { isHabitScheduled, toDateString } from "@/lib/streak";
import { todayInTimezone, getBrowserTimezone } from "@/lib/timezone";
import type { Habit, Streak, MoodEntry, Checkin } from "@prisma/client";

/**
 * Weekly email stats — built once per user, used by both the cron job
 * (sends to all subscribed users) and the per-user "send test email" route.
 *
 * Week window is Mon–Sun in the user's *effective* timezone (their saved
 * timezone, or the browser timezone if not set). Stats computed:
 *   - overallPct: rounded completion % across scheduled habits Mon→today
 *   - deltaVsLastWeek: pct points vs last full week (Mon–Sun)
 *   - habits: per-habit breakdown {name, icon, scheduled, completed, rate, streak}
 *   - topWin: highest-rate habit with at least one scheduled day
 *   - needsAttention: lowest-rate habit (≤50%) with at least one scheduled day
 *   - avgMood: average mood score 1–10 across the week (or null)
 */

export interface WeeklyEmailHabitRow {
  id: string;
  name: string;
  icon: string;
  scheduled: number;
  completed: number;
  rate: number;
  currentStreak: number;
  longestStreak: number;
}

export interface WeeklyEmailStats {
  userId: string;
  email: string;
  name: string;
  timezone: string;
  weekStart: string;
  weekEnd: string;
  totalScheduled: number;
  totalCompleted: number;
  overallPct: number;
  deltaVsLastWeek: number;
  maxCurrentStreak: number;
  habits: WeeklyEmailHabitRow[];
  topWin: WeeklyEmailHabitRow | null;
  needsAttention: WeeklyEmailHabitRow | null;
  avgMood: number | null;
  moodEntriesCount: number;
}

interface UserRef {
  id: string;
  email: string;
  name: string;
  timezone: string;
}

interface HabitWithStreak extends Habit {
  streak: Streak | null;
}

/**
 * Get the start-of-week (Monday) and end-of-week (Sunday) Date objects for
 * a given "today" anchor. Uses Mon-first indexing (matches isHabitScheduled).
 */
function getWeekBounds(today: Date): {
  thisMonday: Date;
  thisSunday: Date;
  lastMonday: Date;
  lastSunday: Date;
} {
  const jsDay = today.getDay();
  const monFirst = jsDay === 0 ? 6 : jsDay - 1;
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - monFirst);
  const thisSunday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 6);
  const lastMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate() + 6);
  return { thisMonday, thisSunday, lastMonday, lastSunday };
}

/**
 * Format a Date to a YYYY-MM-DD string in the user's timezone.
 * Falls back to UTC if no timezone is available.
 *
 * (This mirrors `todayInTimezone` but for an arbitrary Date.)
 */
function fmtTz(date: Date, timezone?: string | null): string {
  const tz = timezone && timezone !== "UTC" ? timezone : null;
  if (!tz) {
    return toDateString(date);
  }
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return toDateString(date);
  }
}

/**
 * Build the date-string array for [start..end] inclusive, each formatted in
 * the given timezone. Used to drive the per-habit "is scheduled today" loop
 * without accidentally letting local-time Date arithmetic drift into DST gaps.
 */
function dateRangeTz(start: Date, end: Date, timezone?: string | null): string[] {
  const out: string[] = [];
  // Walk day-by-day using local-time Date increments.
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    out.push(fmtTz(cursor, timezone));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Compute weekly stats for a single user.
 *
 * @param user The user (must have at least {id,email,name,timezone})
 * @param browserTz Optional browser timezone header (x-browser-timezone).
 *                  Used as a fallback when user.timezone is "UTC"/unset.
 */
export async function computeWeeklyStats(
  user: UserRef,
  browserTz?: string | null,
): Promise<WeeklyEmailStats | null> {
  // Resolve effective timezone once.
  const effectiveTz = user.timezone && user.timezone !== "UTC" ? user.timezone : browserTz || null;

  // "Now" in the user's tz, as a Date — we anchor the week window on this.
  const now = new Date();
  const todayStrTz = todayInTimezone(user.timezone, browserTz || null);

  const { thisMonday, thisSunday, lastMonday, lastSunday } = getWeekBounds(now);

  const habits: HabitWithStreak[] = await db.habit.findMany({
    where: { userId: user.id, isArchived: false },
    include: { streak: true },
  });
  if (habits.length === 0) return null;

  const habitIds = habits.map((h) => h.id);

  // Build the wider date span we need checkins for: last Monday → this Sunday.
  const fromStr = fmtTz(lastMonday, effectiveTz);
  const toStr = fmtTz(thisSunday, effectiveTz);
  const checkins: Checkin[] = await db.checkin.findMany({
    where: { habitId: { in: habitIds }, date: { gte: fromStr, lte: toStr } },
  });

  // Mood entries for this week (Mon→today) in user tz.
  const moodEntries: MoodEntry[] = await db.moodEntry.findMany({
    where: {
      userId: user.id,
      date: { gte: fmtTz(thisMonday, effectiveTz), lte: todayStrTz },
    },
  });

  // Build per-day tz date strings for the two windows.
  const thisWeekDays = dateRangeTz(thisMonday, thisSunday, effectiveTz);
  // For "this week up to today" we cut off at todayStrTz.
  const thisWeekUpToToday = thisWeekDays.filter((d) => d <= todayStrTz);
  const lastWeekDays = dateRangeTz(lastMonday, lastSunday, effectiveTz);

  // Build checkin lookup: habitId -> Set of YYYY-MM-DD where count >= target.
  const checkinCompleteByHabit = new Map<string, Set<string>>();
  for (const c of checkins) {
    const h = habits.find((x) => x.id === c.habitId);
    if (!h) continue;
    if (c.count >= h.targetCount) {
      let set = checkinCompleteByHabit.get(c.habitId);
      if (!set) {
        set = new Set();
        checkinCompleteByHabit.set(c.habitId, set);
      }
      set.add(c.date);
    }
  }

  // Convert a YYYY-MM-DD string (already in user tz) into a Date whose getDay()
  // reflects the weekday of that calendar date. We construct it as a
  // local-time Date so Date.getDay() returns the local weekday, which matches
  // the weekday implied by the date string (since fmtTz formats based on
  // calendar day in that tz).
  function dateFromStr(s: string): Date {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  // Per-habit + totals for this week (Mon → today).
  let thisScheduled = 0;
  let thisCompleted = 0;
  const habitRows: WeeklyEmailHabitRow[] = habits.map((h: HabitWithStreak) => {
    let hScheduled = 0;
    let hCompleted = 0;
    for (const ds of thisWeekUpToToday) {
      const d = dateFromStr(ds);
      if (isHabitScheduled(h, d)) {
        hScheduled += 1;
        const set = checkinCompleteByHabit.get(h.id);
        if (set && set.has(ds)) hCompleted += 1;
      }
    }
    thisScheduled += hScheduled;
    thisCompleted += hCompleted;
    const rate = hScheduled === 0 ? 0 : Math.round((hCompleted / hScheduled) * 100);
    return {
      id: h.id,
      name: h.name,
      icon: h.icon || "✅",
      scheduled: hScheduled,
      completed: hCompleted,
      rate,
      currentStreak: h.streak?.currentStreak ?? 0,
      longestStreak: h.streak?.longestStreak ?? 0,
    };
  });

  // Last week totals (full Mon–Sun).
  let lastScheduled = 0;
  let lastCompleted = 0;
  for (const h of habits) {
    for (const ds of lastWeekDays) {
      const d = dateFromStr(ds);
      if (isHabitScheduled(h, d)) {
        lastScheduled += 1;
        const set = checkinCompleteByHabit.get(h.id);
        if (set && set.has(ds)) lastCompleted += 1;
      }
    }
  }

  const thisPct = thisScheduled === 0 ? 0 : Math.round((thisCompleted / thisScheduled) * 100);
  const lastPct = lastScheduled === 0 ? 0 : Math.round((lastCompleted / lastScheduled) * 100);
  const maxCurrentStreak = Math.max(0, ...habitRows.map((r) => r.currentStreak));

  // Top win / needs attention — only consider habits with at least one
  // scheduled day this week so we don't surface inactive habits.
  const eligible = habitRows.filter((r) => r.scheduled > 0);
  const sortedByRateDesc = eligible.slice().sort((a, b) => b.rate - a.rate || b.completed - a.completed);
  const sortedByRateAsc = eligible.slice().sort((a, b) => a.rate - b.rate);
  const topWin = sortedByRateDesc[0] || null;
  const lowest = sortedByRateAsc[0] || null;
  const needsAttention = lowest && lowest.rate <= 50 ? lowest : null;

  // Avg mood for the week.
  let avgMood: number | null = null;
  if (moodEntries.length > 0) {
    const total = moodEntries.reduce((s, m) => s + m.score, 0);
    avgMood = Math.round((total / moodEntries.length) * 10) / 10;
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone || "UTC",
    weekStart: fmtTz(thisMonday, effectiveTz),
    weekEnd: fmtTz(thisSunday, effectiveTz),
    totalScheduled: thisScheduled,
    totalCompleted: thisCompleted,
    overallPct: thisPct,
    deltaVsLastWeek: thisPct - lastPct,
    maxCurrentStreak,
    habits: habitRows,
    topWin,
    needsAttention,
    avgMood,
    moodEntriesCount: moodEntries.length,
  };
}

/**
 * Cron-friendly wrapper: looks up a full user record from the DB, then calls
 * computeWeeklyStats with no browser-timezone fallback (cron has no Request).
 */
export async function computeWeeklyStatsForCron(userId: string): Promise<WeeklyEmailStats | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, timezone: true },
  });
  if (!user) return null;
  return computeWeeklyStats(user, null);
}

/**
 * Sample fallback used by the per-user "send test email" route when the user
 * has no habits/checkins to summarize yet. Keeps the template rendering path
 * exercised without forcing the user to seed data first.
 */
export function sampleWeeklyStats(user: UserRef): WeeklyEmailStats {
  const now = new Date();
  const { thisMonday, thisSunday } = getWeekBounds(now);
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone || "UTC",
    weekStart: toDateString(thisMonday),
    weekEnd: toDateString(thisSunday),
    totalScheduled: 7,
    totalCompleted: 5,
    overallPct: 71,
    deltaVsLastWeek: 14,
    maxCurrentStreak: 5,
    avgMood: 7.5,
    moodEntriesCount: 4,
    topWin: {
      id: "sample-top",
      name: "Morning meditation",
      icon: "🧘",
      scheduled: 7,
      completed: 7,
      rate: 100,
      currentStreak: 7,
      longestStreak: 12,
    },
    needsAttention: {
      id: "sample-att",
      name: "Evening journaling",
      icon: "📓",
      scheduled: 7,
      completed: 2,
      rate: 29,
      currentStreak: 0,
      longestStreak: 4,
    },
    habits: [
      { id: "s1", name: "Morning meditation", icon: "🧘", scheduled: 7, completed: 7, rate: 100, currentStreak: 7, longestStreak: 12 },
      { id: "s2", name: "Drink 2L water", icon: "💧", scheduled: 7, completed: 6, rate: 86, currentStreak: 6, longestStreak: 9 },
      { id: "s3", name: "Read 20 pages", icon: "📖", scheduled: 7, completed: 5, rate: 71, currentStreak: 5, longestStreak: 7 },
      { id: "s4", name: "Workout", icon: "💪", scheduled: 4, completed: 2, rate: 50, currentStreak: 0, longestStreak: 3 },
      { id: "s5", name: "Evening journaling", icon: "📓", scheduled: 7, completed: 2, rate: 29, currentStreak: 0, longestStreak: 4 },
    ],
  };
}

// Re-export timezone helpers so callers can stay in one import namespace.
export { todayInTimezone, getBrowserTimezone };
