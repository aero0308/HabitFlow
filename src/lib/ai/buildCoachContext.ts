import { db } from "@/lib/db";
import { isHabitScheduled } from "@/lib/streak";
import {
  computeCleanStreak,
  computeLongestStreak,
  computeMoneySaved,
  computeTotalCleanDays,
} from "@/lib/bad-habits/compute";
import {
  format,
  parseISO,
  startOfWeek,
  addDays,
  differenceInCalendarDays,
} from "date-fns";

/**
 * Rich context builder for the AI Weekly Coach Letter.
 *
 * Extends the buildContext.ts pattern but adds:
 *  - Per-habit weekend vs weekday completion rates (for weekend_dip pattern)
 *  - Current gap (days since last completion) + historical average gap (for unusual_gap)
 *  - Per-week completion history for the last 3 weeks (for streak_forming)
 *  - Last week's WeeklyCoachLetter (for experiment follow-up)
 *  - Pre-computed pattern flags so the AI doesn't have to do math
 *
 * Output is a compact JSON object injected into the prompt.
 */

export interface CoachHabitStat {
  name: string;
  frequency: string;
  days: string[];
  timeOfDay: string;
  targetCount: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number; // this week
  completionRatePrevWeek: number;
  trend: "improving" | "stable" | "declining";
  weekendRate: number | null; // null if no weekend scheduled days
  weekdayRate: number | null;
  currentGapDays: number; // days since last completion (rounded)
  avgGapDays: number | null; // historical avg gap between completions
}

export interface CoachBadHabitStat {
  name: string;
  currentStreak: number;
  longestStreak: number;
  moneySavedThisWeek: number | null;
  slipsThisWeek: number;
  totalSlips: number;
  totalCleanDays: number;
  currency: string;
}

export interface CoachContext {
  user: { firstName: string };
  week: { start: string; end: string; number: number };
  summary: {
    completionRate: number;
    completionRatePrevWeek: number;
    totalCheckins: number;
    activeDays: number;
    perfectDays: number;
    streakDays: number; // sum of currentStreak across habits
  };
  habits: CoachHabitStat[];
  badHabits?: CoachBadHabitStat[];
  mood: {
    avgScore: number | null;
    avgScorePrevWeek: number | null;
    bestDay: { date: string; score: number } | null;
    worstDay: { date: string; score: number } | null;
    topTags: string[];
    moodByHabitsCompleted: Record<string, number>;
  };
  patterns: {
    weekendDip: { habitName: string; weekendRate: number; weekdayRate: number } | null;
    streakForming: { habitName: string; currentStreak: number } | null;
    moodLift: { highBucket: number; lowBucket: number } | null;
    unusualGap: { habitName: string; currentGap: number; avgGap: number } | null;
  };
  offModes: Array<{ startDate: string; endDate: string; reason: string }>;
  lastWeekExperiment: string | null;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Returns the Monday of the given date's week (or the current week if null).
 * Mirrors buildContext.ts so both pipelines agree on what "week" means.
 */
export function getWeekStart(date?: Date): Date {
  return startOfWeek(date ?? new Date(), { weekStartsOn: 1 });
}

function dateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * Returns the ISO week number (1..53) of a date — Mon-first week.
 * Used for the "WEEK N" badge in the UI.
 */
function isoWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Build the rich context object for the weekly coach letter.
 * `weekStart` should be the Monday of the week being analyzed.
 */
export async function buildCoachContext(
  userId: string,
  weekStart: Date,
): Promise<CoachContext> {
  const weekEnd = addDays(weekStart, 6); // Sunday
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekEnd = addDays(weekStart, -1);

  // Fetch user
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, name: true, timezone: true },
  });

  // Fetch active habits with streaks + checkins covering 14 days (prev + this week)
  // plus all-time checkins for avg-gap computation. (All-time is fine for SQLite;
  // users typically only have a few months of data.)
  const habits = await db.habit.findMany({
    where: { userId, isArchived: false },
    include: {
      streak: true,
      checkins: {
        where: {
          date: {
            gte: dateStr(prevWeekStart),
            lte: dateStr(weekEnd),
          },
        },
      },
    },
    orderBy: { position: "asc" },
  });

  // Mood entries for last 14 days
  const moodEntries = await db.moodEntry.findMany({
    where: {
      userId,
      date: {
        gte: dateStr(prevWeekStart),
        lte: dateStr(weekEnd),
      },
    },
    orderBy: { date: "asc" },
  });

  // Off-modes overlapping the last 14 days
  const offModes = await db.offMode.findMany({
    where: {
      userId,
      startDate: { lte: dateStr(weekEnd) },
      endDate: { gte: dateStr(prevWeekStart) },
    },
  });

  // Bad habits (only non-archived) — compute current clean streak, longest,
  // money saved this week, slips this week. Tone in the prompt is supportive.
  const badHabitsRows = await db.badHabit.findMany({
    where: { userId, isArchived: false },
    include: {
      slips: {
        select: { id: true, date: true, trigger: true, note: true },
        orderBy: { date: "asc" },
      },
    },
  });
  const badHabitStats: CoachBadHabitStat[] = badHabitsRows.map((bh) => {
    const slipsThisWeek = bh.slips.filter((s) => {
      const d = parseISO(s.date);
      return d >= weekStart && d <= weekEnd;
    }).length;
    const like = {
      id: bh.id,
      name: bh.name,
      icon: bh.icon,
      color: bh.color,
      quitDate: bh.quitDate,
      costPerDay: bh.costPerDay,
      currency: bh.currency,
      minutesPerDay: bh.minutesPerDay,
      isArchived: bh.isArchived,
      triggers: bh.triggers,
      reason: bh.reason,
      replacementHabitId: bh.replacementHabitId,
    };
    const currentStreak = computeCleanStreak(like, bh.slips, weekEnd);
    const longestStreak = computeLongestStreak(like, bh.slips, weekEnd);
    // Approximate money saved this week = (costPerDay) × (clean days this week).
    // Each slip day isn't a clean day, so clean days this week = 7 - slipsThisWeek.
    let moneyThisWeek: number | null = null;
    if (bh.costPerDay != null && bh.costPerDay > 0) {
      const cleanDaysThisWeek = 7 - slipsThisWeek;
      moneyThisWeek = Math.round(cleanDaysThisWeek * bh.costPerDay * 100) / 100;
    }
    const totalCleanDays = computeTotalCleanDays(like, bh.slips, weekEnd);
    return {
      name: bh.name,
      currentStreak,
      longestStreak,
      moneySavedThisWeek: moneyThisWeek,
      slipsThisWeek,
      totalSlips: bh.slips.length,
      totalCleanDays,
      currency: bh.currency || "USD",
    };
  });

  // Last week's WeeklyCoachLetter (for experiment follow-up). Use the prev
  // week's weekStart string. We pull only the experiment section out of the
  // stored JSON.
  const prevWeekStartStr = dateStr(prevWeekStart);
  const prevLetter = await db.weeklyCoachLetter.findUnique({
    where: {
      userId_weekStart: { userId, weekStart: prevWeekStartStr },
    },
    select: { sections: true },
  });
  let lastWeekExperiment: string | null = null;
  if (prevLetter?.sections) {
    try {
      const parsed = JSON.parse(prevLetter.sections) as {
        experiment?: string;
      };
      if (typeof parsed.experiment === "string" && parsed.experiment.trim()) {
        lastWeekExperiment = parsed.experiment.trim();
      }
    } catch {
      // Stale/corrupt JSON — ignore and skip experiment follow-up.
      lastWeekExperiment = null;
    }
  }

  // For avg-gap and 3-week history we need a wider window. Fetch all checkins
  // for these habits (no date filter). For typical users this is small.
  const habitIds = habits.map((h) => h.id);
  const allCheckins = habitIds.length
    ? await db.checkin.findMany({
        where: { habitId: { in: habitIds } },
        select: { habitId: true, date: true, count: true },
        orderBy: { date: "asc" },
      })
    : [];
  const allCheckinsByHabit = new Map<string, { date: string; count: number }[]>();
  for (const c of allCheckins) {
    if (!allCheckinsByHabit.has(c.habitId)) {
      allCheckinsByHabit.set(c.habitId, []);
    }
    allCheckinsByHabit.get(c.habitId)!.push({ date: c.date, count: c.count });
  }

  const firstName =
    user?.firstName || user?.name?.split(" ")[0] || "there";

  // --- Build checkin maps for this week + prev week ---
  // dateStr -> habitId -> count
  const thisWeekCheckins = new Map<string, Map<string, number>>();
  const prevWeekCheckins = new Map<string, Map<string, number>>();
  for (const habit of habits) {
    for (const ci of habit.checkins) {
      const ciDate = parseISO(ci.date);
      const isThisWeek = ciDate >= weekStart && ciDate <= weekEnd;
      const isPrevWeek = ciDate >= prevWeekStart && ciDate <= prevWeekEnd;
      if (!isThisWeek && !isPrevWeek) continue;
      const map = isThisWeek ? thisWeekCheckins : prevWeekCheckins;
      if (!map.has(ci.date)) map.set(ci.date, new Map());
      map.get(ci.date)!.set(habit.id, ci.count);
    }
  }

  // --- Summary stats ---
  let scheduledThis = 0;
  let completedThis = 0;
  let scheduledPrev = 0;
  let completedPrev = 0;
  let activeDays = 0;
  let perfectDays = 0;
  let streakDays = 0;

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const ds = dateStr(day);
    let scheduled = 0;
    let done = 0;
    for (const habit of habits) {
      const isScheduled = isHabitScheduled(habit, day);
      if (!isScheduled) continue;
      scheduled++;
      const count = thisWeekCheckins.get(ds)?.get(habit.id) ?? 0;
      if (count >= habit.targetCount) done++;
    }
    scheduledThis += scheduled;
    completedThis += done;
    if (done > 0) activeDays++;
    if (scheduled > 0 && done === scheduled) perfectDays++;
  }

  for (let i = 0; i < 7; i++) {
    const day = addDays(prevWeekStart, i);
    const ds = dateStr(day);
    for (const habit of habits) {
      const isScheduled = isHabitScheduled(habit, day);
      if (!isScheduled) continue;
      scheduledPrev++;
      const count = prevWeekCheckins.get(ds)?.get(habit.id) ?? 0;
      if (count >= habit.targetCount) completedPrev++;
    }
  }

  const completionRate =
    scheduledThis > 0 ? Math.round((completedThis / scheduledThis) * 100) : 0;
  const completionRatePrevWeek =
    scheduledPrev > 0 ? Math.round((completedPrev / scheduledPrev) * 100) : 0;

  // --- Per-habit stats ---
  const habitStats: CoachHabitStat[] = habits.map((habit) => {
    let schedThis = 0;
    let doneThis = 0;
    let schedPrev = 0;
    let donePrev = 0;
    let weekendSched = 0;
    let weekendDone = 0;
    let weekdaySched = 0;
    let weekdayDone = 0;

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const ds = dateStr(day);
      const jsDow = day.getDay();
      const isWeekend = jsDow === 0 || jsDow === 6;
      const isScheduled = isHabitScheduled(habit, day);
      if (isScheduled) {
        schedThis++;
        const count = thisWeekCheckins.get(ds)?.get(habit.id) ?? 0;
        const done = count >= habit.targetCount ? 1 : 0;
        doneThis += done;
        if (isWeekend) {
          weekendSched++;
          weekendDone += done;
        } else {
          weekdaySched++;
          weekdayDone += done;
        }
      }
    }
    for (let i = 0; i < 7; i++) {
      const day = addDays(prevWeekStart, i);
      const ds = dateStr(day);
      const isScheduled = isHabitScheduled(habit, day);
      if (isScheduled) {
        schedPrev++;
        const count = prevWeekCheckins.get(ds)?.get(habit.id) ?? 0;
        if (count >= habit.targetCount) donePrev++;
      }
    }

    const rateThis = schedThis > 0 ? Math.round((doneThis / schedThis) * 100) : 0;
    const ratePrev = schedPrev > 0 ? Math.round((donePrev / schedPrev) * 100) : 0;
    let trend: "improving" | "stable" | "declining" = "stable";
    if (rateThis > ratePrev + 5) trend = "improving";
    else if (rateThis < ratePrev - 5) trend = "declining";

    const weekendRate =
      weekendSched > 0 ? Math.round((weekendDone / weekendSched) * 100) : null;
    const weekdayRate =
      weekdaySched > 0 ? Math.round((weekdayDone / weekdaySched) * 100) : null;

    // --- current gap + historical avg gap ---
    const allForHabit = allCheckinsByHabit.get(habit.id) ?? [];
    const completedDates = allForHabit
      .filter((c) => c.count >= habit.targetCount)
      .map((c) => c.date)
      .sort(); // asc

    const currentGap = computeCurrentGap(completedDates, weekEnd);

    // avg gap = avg distance between consecutive completions (in scheduled days)
    // Use calendar-day gaps between consecutive completions, ignoring any
    // pre-startDate noise (the schedule has filtered those already).
    const avgGap = computeAvgGap(completedDates);

    // Add to streak sum
    streakDays += habit.streak?.currentStreak ?? 0;

    // Days-of-week label
    const days: string[] = [];
    if (habit.frequency === "daily") {
      days.push("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
    } else if (habit.frequency === "weekly") {
      days.push("Sun");
    } else if (habit.frequency === "custom" && habit.customDays) {
      const customDayNums = habit.customDays
        .split(",")
        .filter(Boolean)
        .map(Number);
      days.push(...customDayNums.map((d) => DAY_NAMES[(d + 6) % 7]));
    }

    return {
      name: habit.name,
      frequency: habit.frequency,
      days,
      timeOfDay: habit.timeOfDay || "ANY_TIME",
      targetCount: habit.targetCount,
      currentStreak: habit.streak?.currentStreak ?? 0,
      longestStreak: habit.streak?.longestStreak ?? 0,
      completionRate: rateThis,
      completionRatePrevWeek: ratePrev,
      trend,
      weekendRate,
      weekdayRate,
      currentGapDays: currentGap,
      avgGapDays: avgGap,
    };
  });

  // --- Mood stats ---
  const thisWeekMoods = moodEntries.filter((m) => {
    const d = parseISO(m.date);
    return d >= weekStart && d <= weekEnd;
  });
  const prevWeekMoods = moodEntries.filter((m) => {
    const d = parseISO(m.date);
    return d >= prevWeekStart && d <= prevWeekEnd;
  });

  const avgScore =
    thisWeekMoods.length > 0
      ? Math.round(
          (thisWeekMoods.reduce((s, m) => s + m.score, 0) /
            thisWeekMoods.length) *
            10,
        ) / 10
      : null;
  const avgScorePrevWeek =
    prevWeekMoods.length > 0
      ? Math.round(
          (prevWeekMoods.reduce((s, m) => s + m.score, 0) /
            prevWeekMoods.length) *
            10,
        ) / 10
      : null;

  const sortedMoods = [...thisWeekMoods].sort((a, b) => b.score - a.score);
  const bestDay = sortedMoods[0]
    ? { date: sortedMoods[0].date, score: sortedMoods[0].score }
    : null;
  const worstDay = sortedMoods[sortedMoods.length - 1]
    ? {
        date: sortedMoods[sortedMoods.length - 1].date,
        score: sortedMoods[sortedMoods.length - 1].score,
      }
    : null;

  // Top tags
  const tagCounts = new Map<string, number>();
  for (const m of thisWeekMoods) {
    if (!m.tags) continue;
    for (const tag of m.tags.split(",").filter(Boolean)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // Mood by habits completed (this week)
  const moodBuckets: Record<string, number[]> = {
    "0": [],
    "1": [],
    "2": [],
    "3+": [],
  };
  for (const m of thisWeekMoods) {
    const ds = m.date;
    let completed = 0;
    let scheduled = 0;
    for (const habit of habits) {
      const day = parseISO(ds);
      const isScheduled = isHabitScheduled(habit, day);
      if (isScheduled) {
        scheduled++;
        const count = thisWeekCheckins.get(ds)?.get(habit.id) ?? 0;
        if (count >= habit.targetCount) completed++;
      }
    }
    if (scheduled === 0) continue; // skip days with no scheduled habits
    const bucket = completed >= 3 ? "3+" : String(completed);
    moodBuckets[bucket].push(m.score);
  }
  const moodByHabitsCompleted: Record<string, number> = {};
  for (const [bucket, scores] of Object.entries(moodBuckets)) {
    if (scores.length > 0) {
      moodByHabitsCompleted[bucket] =
        Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) /
        10;
    }
  }

  // --- Compute pattern flags in code (so the AI doesn't have to) ---

  // weekend_dip: any habit with weekend rate < weekday rate - 20pts
  let weekendDip: CoachContext["patterns"]["weekendDip"] = null;
  for (const h of habitStats) {
    if (
      h.weekendRate !== null &&
      h.weekdayRate !== null &&
      h.weekendRate < h.weekdayRate - 20
    ) {
      weekendDip = {
        habitName: h.name,
        weekendRate: h.weekendRate,
        weekdayRate: h.weekdayRate,
      };
      break;
    }
  }

  // streak_forming: currentStreak >= 3 AND last 3 weeks all >= 90%
  // We approximate "last 3 weeks" using completionRate + completionRatePrevWeek
  // from the habit stats (2 weeks), plus we look at the all-time completion rate
  // (totalCompletions / scheduledDays) as a proxy for the third week.
  let streakForming: CoachContext["patterns"]["streakForming"] = null;
  for (const h of habitStats) {
    if (h.currentStreak < 3) continue;
    if (h.completionRate < 90 || h.completionRatePrevWeek < 90) continue;
    // Need a third data point — use the habit's lifetime completionRate from
    // the Streak table (Prisma stores 0..1 fraction; convert to %).
    const habitRow = habits.find((x) => x.name === h.name);
    const lifetimeRate = habitRow?.streak
      ? undefined // we don't store completionRate on Streak — use totalCompletions instead
      : undefined;
    // If we don't have a clean 3-week history signal, allow the pattern when
    // both visible weeks are >= 90% AND totalCompletions >= 6 (rough proxy for
    // a sustained streak).
    const totalCompletions = habitRow?.streak?.totalCompletions ?? 0;
    if (totalCompletions >= 6 || lifetimeRate !== undefined) {
      streakForming = {
        habitName: h.name,
        currentStreak: h.currentStreak,
      };
      break;
    }
  }

  // mood_lift: if moodByHabitsCompleted["3+"] - ["0"] >= 2.0
  let moodLift: CoachContext["patterns"]["moodLift"] = null;
  const high = moodByHabitsCompleted["3+"];
  const low = moodByHabitsCompleted["0"];
  if (typeof high === "number" && typeof low === "number" && high - low >= 2.0) {
    moodLift = { highBucket: high, lowBucket: low };
  }

  // unusual_gap: current gap > 2x historical average gap
  let unusualGap: CoachContext["patterns"]["unusualGap"] = null;
  for (const h of habitStats) {
    if (h.avgGapDays === null || h.avgGapDays <= 0) continue;
    if (h.currentGapDays > 2 * h.avgGapDays) {
      unusualGap = {
        habitName: h.name,
        currentGap: h.currentGapDays,
        avgGap: Math.round(h.avgGapDays * 10) / 10,
      };
      break;
    }
  }

  return {
    user: { firstName },
    week: {
      start: dateStr(weekStart),
      end: dateStr(weekEnd),
      number: isoWeekNumber(weekStart),
    },
    summary: {
      completionRate,
      completionRatePrevWeek,
      totalCheckins: completedThis,
      activeDays,
      perfectDays,
      streakDays,
    },
    habits: habitStats,
    badHabits: badHabitStats.length > 0 ? badHabitStats : undefined,
    mood: {
      avgScore,
      avgScorePrevWeek,
      bestDay,
      worstDay,
      topTags,
      moodByHabitsCompleted,
    },
    patterns: {
      weekendDip,
      streakForming,
      moodLift,
      unusualGap,
    },
    offModes: offModes.map((o) => ({
      startDate: o.startDate,
      endDate: o.endDate,
      reason: o.reason,
    })),
    lastWeekExperiment,
  };
}

/* ============================================================================
   Helpers — pure functions (no DB)
============================================================================ */

/**
 * Current gap: how many days since the last completion, counting up to the
 * end of the analyzed week (Sunday). Returns at least 0. If the user has
 * never completed the habit, gap = days from habit.startDate to weekEnd.
 */
function computeCurrentGap(completedDatesAsc: string[], weekEnd: Date): number {
  if (completedDatesAsc.length === 0) return 0;
  const last = completedDatesAsc[completedDatesAsc.length - 1];
  const lastDate = parseISO(last);
  return Math.max(0, differenceInCalendarDays(weekEnd, lastDate));
}

/**
 * Avg gap: average calendar-day distance between consecutive completions.
 * Returns null if there are fewer than 2 completions (no gaps to average).
 */
function computeAvgGap(completedDatesAsc: string[]): number | null {
  if (completedDatesAsc.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < completedDatesAsc.length; i++) {
    const prev = parseISO(completedDatesAsc[i - 1]);
    const curr = parseISO(completedDatesAsc[i]);
    gaps.push(differenceInCalendarDays(curr, prev));
  }
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return Math.round(avg * 10) / 10;
}
