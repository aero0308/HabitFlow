import { db } from "@/lib/db";
import { isHabitScheduled } from "@/lib/streak";
import { format, parseISO, startOfWeek, addDays, differenceInCalendarDays } from "date-fns";

/**
 * Builds a compact JSON context from Prisma data for the AI weekly narrative.
 * This is what gets injected into the prompt. Kept under ~1500 tokens.
 *
 * Fetches:
 * - user's firstName
 * - active habits with streak + completion data
 * - check-ins for last 14 days (this week + prev week for comparison)
 * - mood entries for last 14 days with tags
 * - off-mode ranges overlapping the last 14 days
 */

export interface WeeklyContext {
  user: { firstName: string };
  week: { start: string; end: string };
  summary: {
    completionRate: number;
    completionRatePrevWeek: number;
    totalCheckins: number;
    activeDays: number;
    perfectDays: number;
  };
  habits: Array<{
    name: string;
    frequency: string;
    days: string[];
    timeOfDay: string;
    targetCount: number;
    currentStreak: number;
    longestStreak: number;
    completionRate: number;
    trend: "improving" | "stable" | "declining";
  }>;
  mood: {
    avgScore: number | null;
    avgScorePrevWeek: number | null;
    bestDay: { date: string; score: number } | null;
    worstDay: { date: string; score: number } | null;
    topTags: string[];
    moodByHabitsCompleted: Record<string, number>;
  };
  anomalies: string[];
  offModes: Array<{ startDate: string; endDate: string; reason: string }>;
}

/**
 * Returns the Monday of the given date's week (or the current week if null).
 */
export function getWeekStart(date?: Date): Date {
  return startOfWeek(date ?? new Date(), { weekStartsOn: 1 });
}

/**
 * Returns YYYY-MM-DD string for a Date.
 */
function dateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function buildWeeklyContext(
  userId: string,
  weekStart: Date,
): Promise<WeeklyContext> {
  const weekEnd = addDays(weekStart, 6); // Sunday
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekEnd = addDays(weekStart, -1);

  // Fetch user
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, name: true, timezone: true },
  });

  // Fetch active habits with streaks
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

  // Fetch mood entries for last 14 days
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

  // Fetch off-modes overlapping last 14 days
  const offModes = await db.offMode.findMany({
    where: {
      userId,
      startDate: { lte: dateStr(weekEnd) },
      endDate: { gte: dateStr(prevWeekStart) },
    },
  });

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";

  // --- Build checkin maps ---
  // Map: dateStr → Map(habitId → count)
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

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const ds = dateStr(day);
    let scheduled = 0;
    let done = 0;
    for (const habit of habits) {
      const isScheduled = isHabitScheduled(
        habit.frequency,
        habit.customDays,
        day,
      );
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

  // Prev week
  for (let i = 0; i < 7; i++) {
    const day = addDays(prevWeekStart, i);
    const ds = dateStr(day);
    for (const habit of habits) {
      const isScheduled = isHabitScheduled(
        habit.frequency,
        habit.customDays,
        day,
      );
      if (!isScheduled) continue;
      scheduledPrev++;
      const count = prevWeekCheckins.get(ds)?.get(habit.id) ?? 0;
      if (count >= habit.targetCount) completedPrev++;
    }
  }

  const completionRate = scheduledThis > 0 ? Math.round((completedThis / scheduledThis) * 100) : 0;
  const completionRatePrevWeek = scheduledPrev > 0 ? Math.round((completedPrev / scheduledPrev) * 100) : 0;

  // --- Per-habit stats ---
  const habitStats = habits.map((habit) => {
    let schedThis = 0;
    let doneThis = 0;
    let schedPrev = 0;
    let donePrev = 0;

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const ds = dateStr(day);
      const isScheduled = isHabitScheduled(habit.frequency, habit.customDays, day);
      if (isScheduled) {
        schedThis++;
        const count = thisWeekCheckins.get(ds)?.get(habit.id) ?? 0;
        if (count >= habit.targetCount) doneThis++;
      }
    }
    for (let i = 0; i < 7; i++) {
      const day = addDays(prevWeekStart, i);
      const ds = dateStr(day);
      const isScheduled = isHabitScheduled(habit.frequency, habit.customDays, day);
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

    const days: string[] = [];
    if (habit.frequency === "daily") {
      days.push("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
    } else if (habit.frequency === "weekly") {
      days.push("Sun");
    } else if (habit.frequency === "custom" && habit.customDays) {
      const customDayNums = habit.customDays.split(",").filter(Boolean).map(Number);
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
      trend,
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

  const avgScore = thisWeekMoods.length > 0
    ? Math.round((thisWeekMoods.reduce((s, m) => s + m.score, 0) / thisWeekMoods.length) * 10) / 10
    : null;
  const avgScorePrevWeek = prevWeekMoods.length > 0
    ? Math.round((prevWeekMoods.reduce((s, m) => s + m.score, 0) / prevWeekMoods.length) * 10) / 10
    : null;

  const sortedMoods = [...thisWeekMoods].sort((a, b) => b.score - a.score);
  const bestDay = sortedMoods[0] ? { date: sortedMoods[0].date, score: sortedMoods[0].score } : null;
  const worstDay = sortedMoods[sortedMoods.length - 1]
    ? { date: sortedMoods[sortedMoods.length - 1].date, score: sortedMoods[sortedMoods.length - 1].score }
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

  // Mood by habits completed
  const moodBuckets: Record<string, number[]> = { "0": [], "1": [], "2": [], "3+": [] };
  for (const m of thisWeekMoods) {
    const ds = m.date;
    let completed = 0;
    let scheduled = 0;
    for (const habit of habits) {
      const day = parseISO(ds);
      const isScheduled = isHabitScheduled(habit.frequency, habit.customDays, day);
      if (isScheduled) {
        scheduled++;
        const count = thisWeekCheckins.get(ds)?.get(habit.id) ?? 0;
        if (count >= habit.targetCount) completed++;
      }
    }
    const bucket = completed >= 3 ? "3+" : String(completed);
    moodBuckets[bucket].push(m.score);
  }

  const moodByHabitsCompleted: Record<string, number> = {};
  for (const [bucket, scores] of Object.entries(moodBuckets)) {
    if (scores.length > 0) {
      moodByHabitsCompleted[bucket] = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;
    }
  }

  // --- Anomalies ---
  const anomalies: string[] = [];

  // Check for unusual streaks of misses
  for (const habit of habitStats) {
    if (habit.trend === "declining" && habit.completionRate < 50) {
      anomalies.push(`${habit.name} completion dropped to ${habit.completionRate}% this week`);
    }
  }

  // Check weekend vs weekday
  let weekendDone = 0;
  let weekdayDone = 0;
  let weekendSched = 0;
  let weekdaySched = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const ds = dateStr(day);
    const dow = day.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    for (const habit of habits) {
      const isScheduled = isHabitScheduled(habit.frequency, habit.customDays, day);
      if (isScheduled) {
        if (isWeekend) {
          weekendSched++;
          const count = thisWeekCheckins.get(ds)?.get(habit.id) ?? 0;
          if (count >= habit.targetCount) weekendDone++;
        } else {
          weekdaySched++;
          const count = thisWeekCheckins.get(ds)?.get(habit.id) ?? 0;
          if (count >= habit.targetCount) weekdayDone++;
        }
      }
    }
  }
  if (weekendSched > 0 && weekdaySched > 0) {
    const weekendRate = Math.round((weekendDone / weekendSched) * 100);
    const weekdayRate = Math.round((weekdayDone / weekdaySched) * 100);
    if (weekendRate < weekdayRate - 20) {
      anomalies.push(`Weekend completion (${weekendRate}%) much lower than weekdays (${weekdayRate}%)`);
    }
  }

  // --- Build final context ---
  return {
    user: { firstName },
    week: { start: dateStr(weekStart), end: dateStr(weekEnd) },
    summary: {
      completionRate,
      completionRatePrevWeek,
      totalCheckins: completedThis,
      activeDays,
      perfectDays,
    },
    habits: habitStats,
    mood: {
      avgScore,
      avgScorePrevWeek,
      bestDay,
      worstDay,
      topTags,
      moodByHabitsCompleted,
    },
    anomalies,
    offModes: offModes.map((o) => ({
      startDate: o.startDate,
      endDate: o.endDate,
      reason: o.reason,
    })),
  };
}
