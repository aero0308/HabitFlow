import { db } from "@/lib/db";
import { isHabitScheduled, type HabitWithScheduling } from "@/lib/streak";
import {
  format,
  parseISO,
  subDays,
  startOfDay,
  differenceInCalendarDays,
  eachDayOfInterval,
} from "date-fns";
import { getCached, setCached } from "@/lib/ai/chatCache";

/**
 * RAG context builder for the "Chat with your data" feature.
 *
 * Unlike `buildWeeklyContext` (fixed 2-week window for the weekly narrative)
 * and `buildCoachContext` (focused on this week vs last week), this one
 * answers free-form user questions over the user's full history. The base
 * context is always included (30-day / 90-day rolling stats + pattern
 * flags), and conditional "deep dives" are added when the question
 * mentions specific habits, days of the week, mood, etc. — to keep token
 * usage proportional to what the user actually asked.
 *
 * Output is a plain `Record<string, unknown>` so it can be JSON.stringify'd
 * and passed straight into the prompt. Internally we type it via the
 * `ChatContext` interface below for compile-time safety.
 *
 * Caching: results are cached per (userId, hash-of-question) for 5 min
 * in `chatCache`. We invalidate per-user when their data changes (see
 * clearCache in chatCache.ts — wire that into checkin create/delete if
 * we want instant invalidation).
 */

export interface ChatContext {
  user: { firstName: string };
  generatedAt: string;
  window: { from: string; to: string };
  stats: {
    totalHabits: number;
    totalCheckins: number;
    longestStreak: number;
    avgCompletionRate30d: number;
    activeDays: number; // distinct days with ≥1 completed habit in last 30d
  };
  habits: Array<{
    id: string;
    name: string;
    icon: string;
    frequency: string;
    days: string[];
    timeOfDay: string;
    targetCount: number;
    currentStreak: number;
    longestStreak: number;
    completionRate30d: number;
    completionRate90d: number;
    trend: "improving" | "stable" | "declining";
  }>;
  mood: {
    avg30d: number | null;
    trend: "up" | "stable" | "down";
    moodByHabitsCompleted: Record<string, number>;
  };
  patterns: Array<
    | {
        type: "weekend_dip";
        habitName: string;
        weekendRate: number;
        weekdayRate: number;
      }
    | { type: "streak_forming"; habitName: string; currentStreak: number }
    | { type: "mood_lift"; highBucket: number; lowBucket: number }
    | { type: "unusual_gap"; habitName: string; currentGap: number; avgGap: number }
  >;
  // Conditional deep dives — present only when the question triggers them.
  habitDetails?: Array<{
    id: string;
    name: string;
    dayOfWeekRates: Record<string, number>;
    recentCheckins: Array<{ date: string; count: number; completed: boolean }>;
    gaps: Array<{ start: string; end: string; length: number }>;
    currentGapDays: number;
    avgGapDays: number | null;
  }>;
  dayOfWeekAnalysis?: {
    rates: Record<string, number>;
    bestDay: string | null;
    worstDay: string | null;
  };
  moodDeepDive?: {
    avg30d: number | null;
    avg90d: number | null;
    bestDay30d: { date: string; score: number } | null;
    worstDay30d: { date: string; score: number } | null;
    topTags30d: string[];
    byCompletionBuckets: Record<string, number>;
  };
  correlations?: Array<{ description: string }>;
  opportunities?: Array<{ habitName: string; suggestion: string }>;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function dateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * Cheap non-crypto hash of a string → unsigned 32-bit. Good enough for
 * cache keys; we don't need cryptographic strength here.
 */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Builds the chat context. Returns a plain object suitable for JSON.stringify
 * into the user prompt. See the ChatContext interface for the shape.
 *
 * `mode`:
 *  - "data" (default): the existing heavy RAG context (deep dives, patterns,
 *    correlations, etc.) — grounded strictly in the user's data.
 *  - "general": a small lightweight snapshot (habit names + streaks +
 *    timeOfDay + optional 30-day snapshot if the user mentions their data).
 *    Used by the "Ask Anything" general assistant.
 */
export async function buildChatContext(
  userId: string,
  question: string,
  mode: "data" | "general" = "data",
): Promise<Record<string, unknown>> {
  if (mode === "general") {
    return buildGeneralContext(userId, question);
  }
  const cacheKey = `u:${userId}:q:${hashStr(question.toLowerCase().trim())}`;
  const cached = getCached<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  const context = await buildContextInternal(userId, question);
  setCached(cacheKey, context);
  return context;
}

/**
 * Lightweight context for the "Ask Anything" (general) chat mode.
 *
 * Returns a SMALL object — only habit names + frequency + timeOfDay +
 * current streaks. If the user's question mentions their own data
 * ("my habits", "my streak", "am i doing", etc.), ALSO add a `dataSnapshot`
 * with 30-day completion rate, current streaks, and 30-day average mood.
 *
 * Total target: under ~800 tokens.
 */
export async function buildGeneralContext(
  userId: string,
  question: string,
): Promise<Record<string, unknown>> {
  const today = startOfDay(new Date());
  const from30 = subDays(today, 29);

  // ---- Fetch user ----
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, name: true },
  });
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";

  // ---- Fetch habits + streaks ----
  const habits = await db.habit.findMany({
    where: { userId, isArchived: false },
    include: { streak: true },
    orderBy: { position: "asc" },
  });

  const habitSnapshots = habits.map((h) => ({
    name: h.name,
    frequency: h.frequency,
    timeOfDay: h.timeOfDay || "ANY_TIME",
    currentStreak: h.streak?.currentStreak ?? 0,
  }));

  const base: Record<string, unknown> = {
    user: { firstName },
    mode: "general" as const,
    generatedAt: new Date().toISOString(),
    habits: habitSnapshots,
  };

  // ---- Conditional dataSnapshot if question mentions user's own data ----
  const lc = question.toLowerCase();
  const mentionsOwnData =
    /\bmy (habits?|streak|progress|mood|data|stats)\b/i.test(question) ||
    /how am i|am i doing|my week/i.test(lc);

  if (mentionsOwnData && habits.length > 0) {
    // 30-day completion rate (weighted by scheduled days)
    const habitIds = habits.map((h) => h.id);
    const recentCheckins = await db.checkin.findMany({
      where: { habitId: { in: habitIds }, date: { gte: dateStr(from30) } },
      select: { habitId: true, date: true, count: true },
    });
    const checkinByHabit = new Map<string, Map<string, number>>();
    for (const c of recentCheckins) {
      if (!checkinByHabit.has(c.habitId)) {
        checkinByHabit.set(c.habitId, new Map());
      }
      checkinByHabit.get(c.habitId)!.set(c.date, c.count);
    }

    let schedTotal = 0;
    let completedTotal = 0;
    for (const habit of habits) {
      const habitSched: HabitWithScheduling = {
        id: habit.id,
        frequency: habit.frequency,
        customDays: habit.customDays,
        targetCount: habit.targetCount,
        startDate: habit.startDate,
      };
      const ck = checkinByHabit.get(habit.id) ?? new Map<string, number>();
      for (const day of eachDayOfInterval({ start: from30, end: today })) {
        if (!isHabitScheduled(habitSched, day)) continue;
        schedTotal++;
        const cnt = ck.get(dateStr(day)) ?? 0;
        if (cnt >= habit.targetCount) completedTotal++;
      }
    }
    const completionRate30d =
      schedTotal > 0 ? Math.round((completedTotal / schedTotal) * 100) : 0;

    const currentStreaks = habits.map((h) => ({
      name: h.name,
      current: h.streak?.currentStreak ?? 0,
    }));

    // 30-day average mood
    const mood30 = await db.moodEntry.findMany({
      where: { userId, date: { gte: dateStr(from30) } },
      select: { score: true },
    });
    const avgMood30d =
      mood30.length > 0
        ? Math.round((mood30.reduce((s, m) => s + m.score, 0) / mood30.length) * 10) / 10
        : null;

    base.dataSnapshot = {
      completionRate30d,
      currentStreaks,
      avgMood30d,
    };
  }

  return base;
}

async function buildContextInternal(
  userId: string,
  question: string,
): Promise<Record<string, unknown>> {
  const today = startOfDay(new Date());
  const from30 = subDays(today, 29); // 30 days inclusive
  const from90 = subDays(today, 89); // 90 days inclusive

  // ---- Fetch user ----
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, name: true },
  });
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";

  // ---- Fetch habits + streaks ----
  const habits = await db.habit.findMany({
    where: { userId, isArchived: false },
    include: {
      streak: true,
      checkins: {
        where: {
          date: { gte: dateStr(from90) },
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { position: "asc" },
  });

  // ---- Fetch all-time checkins (for gap analysis) ----
  const habitIds = habits.map((h) => h.id);
  const allCheckins =
    habitIds.length > 0
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

  // ---- Fetch mood entries (90-day window for trend) ----
  const moodEntries = await db.moodEntry.findMany({
    where: { userId, date: { gte: dateStr(from90) } },
    orderBy: { date: "asc" },
  });

  // ---- Build checkin lookup: habitId → Map(dateStr → count) ----
  const checkinMaps = new Map<string, Map<string, number>>();
  for (const habit of habits) {
    const m = new Map<string, number>();
    for (const c of habit.checkins) m.set(c.date, c.count);
    checkinMaps.set(habit.id, m);
  }

  // ---- Per-habit stats (30d, 90d, trend) ----
  const habitStats: ChatContext["habits"] = habits.map((habit) => {
    const habitSched: HabitWithScheduling = {
      id: habit.id,
      frequency: habit.frequency,
      customDays: habit.customDays,
      targetCount: habit.targetCount,
      startDate: habit.startDate,
    };

    const r30 = computeRate(habitSched, checkinMaps.get(habit.id) ?? new Map(), from30, today);
    const r90 = computeRate(habitSched, checkinMaps.get(habit.id) ?? new Map(), from90, today);

    // Trend: 30d (recent) vs 60d window for comparison
    const from60 = subDays(today, 59);
    const from30start = subDays(today, 29);
    const recentRate = r30;
    const priorRate = computeRateForRange(
      habitSched,
      checkinMaps.get(habit.id) ?? new Map(),
      from60,
      from30start,
    );
    let trend: "improving" | "stable" | "declining" = "stable";
    if (recentRate > priorRate + 5) trend = "improving";
    else if (recentRate < priorRate - 5) trend = "declining";

    const days: string[] = [];
    if (habit.frequency === "daily") {
      days.push(...DAY_NAMES);
    } else if (habit.frequency === "weekly") {
      days.push("Sun");
    } else if (habit.frequency === "custom" && habit.customDays) {
      const nums = habit.customDays.split(",").filter(Boolean).map(Number);
      days.push(...nums.map((d) => DAY_NAMES[(d + 6) % 7]));
    }

    return {
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      frequency: habit.frequency,
      days,
      timeOfDay: habit.timeOfDay || "ANY_TIME",
      targetCount: habit.targetCount,
      currentStreak: habit.streak?.currentStreak ?? 0,
      longestStreak: habit.streak?.longestStreak ?? 0,
      completionRate30d: r30,
      completionRate90d: r90,
      trend,
    };
  });

  // ---- Global stats ----
  const totalHabits = habits.length;
  const totalCheckins = allCheckins.length;
  const longestStreak = habits.reduce(
    (m, h) => Math.max(m, h.streak?.longestStreak ?? 0),
    0,
  );

  // avgCompletionRate30d: weighted by scheduled days
  let schedTotal30 = 0;
  let completedTotal30 = 0;
  const activeDaysSet = new Set<string>();
  for (const habit of habits) {
    const habitSched: HabitWithScheduling = {
      id: habit.id,
      frequency: habit.frequency,
      customDays: habit.customDays,
      targetCount: habit.targetCount,
      startDate: habit.startDate,
    };
    const ck = checkinMaps.get(habit.id) ?? new Map();
    for (const day of eachDayOfInterval({ start: from30, end: today })) {
      if (!isHabitScheduled(habitSched, day)) continue;
      schedTotal30++;
      const cnt = ck.get(dateStr(day)) ?? 0;
      if (cnt >= habit.targetCount) {
        completedTotal30++;
        activeDaysSet.add(dateStr(day));
      }
    }
  }
  const avgCompletionRate30d = schedTotal30 > 0 ? Math.round((completedTotal30 / schedTotal30) * 100) : 0;

  // ---- Mood stats (30d avg + trend + by completion buckets) ----
  const mood30 = moodEntries.filter((m) => parseISO(m.date) >= from30);
  const mood60prior = moodEntries.filter((m) => {
    const d = parseISO(m.date);
    return d >= from90 && d < from30;
  });

  const avg30 =
    mood30.length > 0
      ? Math.round((mood30.reduce((s, m) => s + m.score, 0) / mood30.length) * 10) / 10
      : null;
  const avgPrior =
    mood60prior.length > 0
      ? Math.round((mood60prior.reduce((s, m) => s + m.score, 0) / mood60prior.length) * 10) / 10
      : null;

  let moodTrend: "up" | "stable" | "down" = "stable";
  if (avg30 !== null && avgPrior !== null) {
    if (avg30 > avgPrior + 0.3) moodTrend = "up";
    else if (avg30 < avgPrior - 0.3) moodTrend = "down";
  }

  // Mood by habit-completion buckets (30d)
  const moodBuckets: Record<string, number[]> = { "0": [], "1": [], "2": [], "3+": [] };
  for (const m of mood30) {
    let completed = 0;
    let scheduled = 0;
    for (const habit of habits) {
      const habitSched: HabitWithScheduling = {
        id: habit.id,
        frequency: habit.frequency,
        customDays: habit.customDays,
        targetCount: habit.targetCount,
        startDate: habit.startDate,
      };
      const day = parseISO(m.date);
      if (isHabitScheduled(habitSched, day)) {
        scheduled++;
        const cnt = checkinMaps.get(habit.id)?.get(m.date) ?? 0;
        if (cnt >= habit.targetCount) completed++;
      }
    }
    if (scheduled === 0) continue;
    const bucket = completed >= 3 ? "3+" : String(completed);
    moodBuckets[bucket].push(m.score);
  }
  const moodByHabitsCompleted: Record<string, number> = {};
  for (const [b, scores] of Object.entries(moodBuckets)) {
    if (scores.length > 0) {
      moodByHabitsCompleted[b] = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;
    }
  }

  // ---- Pattern detection (mirrors buildCoachContext) ----
  const patterns: ChatContext["patterns"] = [];

  // weekend_dip + streak_forming + unusual_gap per-habit
  for (const habit of habits) {
    const stat = habitStats.find((s) => s.id === habit.id);
    if (!stat) continue;
    const habitSched: HabitWithScheduling = {
      id: habit.id,
      frequency: habit.frequency,
      customDays: habit.customDays,
      targetCount: habit.targetCount,
      startDate: habit.startDate,
    };
    const ck = checkinMaps.get(habit.id) ?? new Map();

    // weekend vs weekday (30d)
    let weekendSched = 0;
    let weekendDone = 0;
    let weekdaySched = 0;
    let weekdayDone = 0;
    for (const day of eachDayOfInterval({ start: from30, end: today })) {
      if (!isHabitScheduled(habitSched, day)) continue;
      const jsDow = day.getDay();
      const isWeekend = jsDow === 0 || jsDow === 6;
      const cnt = ck.get(dateStr(day)) ?? 0;
      const done = cnt >= habit.targetCount ? 1 : 0;
      if (isWeekend) {
        weekendSched++;
        weekendDone += done;
      } else {
        weekdaySched++;
        weekdayDone += done;
      }
    }
    if (weekendSched > 0 && weekdaySched > 0) {
      const wkndRate = Math.round((weekendDone / weekendSched) * 100);
      const wkdyRate = Math.round((weekdayDone / weekdaySched) * 100);
      if (wkndRate < wkdyRate - 20) {
        patterns.push({
          type: "weekend_dip",
          habitName: habit.name,
          weekendRate: wkndRate,
          weekdayRate: wkdyRate,
        });
      }
    }

    // streak_forming: currentStreak >= 3 AND last 2 visible weeks >= 90%
    if (stat.currentStreak >= 3 && stat.completionRate30d >= 90) {
      const from14 = subDays(today, 13);
      const from30start = subDays(today, 29);
      const prior14 = computeRateForRange(habitSched, ck, from30start, from14);
      const recent14 = computeRateForRange(habitSched, ck, from14, today);
      if (recent14 >= 90 && prior14 >= 90) {
        patterns.push({
          type: "streak_forming",
          habitName: habit.name,
          currentStreak: stat.currentStreak,
        });
      }
    }

    // unusual_gap: current gap > 2x historical average gap
    const allForHabit = allCheckinsByHabit.get(habit.id) ?? [];
    const completedDates = allForHabit
      .filter((c) => c.count >= habit.targetCount)
      .map((c) => c.date)
      .sort();
    const currentGap = computeCurrentGap(completedDates, today);
    const avgGap = computeAvgGap(completedDates);
    if (avgGap !== null && avgGap > 0 && currentGap > 2 * avgGap) {
      patterns.push({
        type: "unusual_gap",
        habitName: habit.name,
        currentGap,
        avgGap: Math.round(avgGap * 10) / 10,
      });
    }
  }

  // mood_lift: 3+ bucket ≥ 2.0 higher than 0 bucket
  const high = moodByHabitsCompleted["3+"];
  const low = moodByHabitsCompleted["0"];
  if (typeof high === "number" && typeof low === "number" && high - low >= 2.0) {
    patterns.push({ type: "mood_lift", highBucket: high, lowBucket: low });
  }

  // Deduplicate weekend_dip per habit name (take first per habit)
  // The current loop can push multiple weekend_dip for the same habit if both
  // 30-day and 90-day windows hit — we only want the 30d one. Already handled
  // because we only compute one window per habit.
  // Dedupe unusual_gap by habitName
  const seenGaps = new Set<string>();
  const dedupedPatterns: ChatContext["patterns"] = [];
  for (const p of patterns) {
    if (p.type === "unusual_gap" || p.type === "weekend_dip" || p.type === "streak_forming") {
      if (seenGaps.has(p.habitName)) continue;
      seenGaps.add(p.habitName);
    }
    dedupedPatterns.push(p);
  }

  const baseContext: ChatContext = {
    user: { firstName },
    generatedAt: new Date().toISOString(),
    window: { from: dateStr(from30), to: dateStr(today) },
    stats: {
      totalHabits,
      totalCheckins,
      longestStreak,
      avgCompletionRate30d,
      activeDays: activeDaysSet.size,
    },
    habits: habitStats,
    mood: {
      avg30d: avg30,
      trend: moodTrend,
      moodByHabitsCompleted,
    },
    patterns: dedupedPatterns,
  };

  // ---- Conditional deep dives ----
  const lc = question.toLowerCase().trim();

  // Habit mention → habitDetails
  const mentionedHabits = habits.filter((h) =>
    h.name && h.name.length > 2 && lc.includes(h.name.toLowerCase()),
  );
  if (mentionedHabits.length > 0) {
    baseContext.habitDetails = mentionedHabits.map((habit) => {
      const habitSched: HabitWithScheduling = {
        id: habit.id,
        frequency: habit.frequency,
        customDays: habit.customDays,
        targetCount: habit.targetCount,
        startDate: habit.startDate,
      };
      const ck = checkinMaps.get(habit.id) ?? new Map();
      // Day-of-week rates (30d)
      const dowSched = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
      const dowDone = [0, 0, 0, 0, 0, 0, 0];
      for (const day of eachDayOfInterval({ start: from30, end: today })) {
        if (!isHabitScheduled(habitSched, day)) continue;
        const jsDow = day.getDay();
        const monIdx = jsDow === 0 ? 6 : jsDow - 1;
        dowSched[monIdx]++;
        const cnt = ck.get(dateStr(day)) ?? 0;
        if (cnt >= habit.targetCount) dowDone[monIdx]++;
      }
      const dayOfWeekRates: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        dayOfWeekRates[DAY_NAMES[i]] = dowSched[i] > 0 ? Math.round((dowDone[i] / dowSched[i]) * 100) : 0;
      }
      // Recent checkins (last 14 days, oldest first)
      const recent: Array<{ date: string; count: number; completed: boolean }> = [];
      for (let i = 13; i >= 0; i--) {
        const d = subDays(today, i);
        const ds = dateStr(d);
        const cnt = ck.get(ds);
        if (cnt !== undefined) {
          recent.push({
            date: ds,
            count: cnt,
            completed: cnt >= habit.targetCount,
          });
        }
      }
      // Gaps (all-time) — consecutive scheduled-but-not-completed streaks ≥ 3 days
      const allForHabit = allCheckinsByHabit.get(habit.id) ?? [];
      const completedSet = new Set(
        allForHabit.filter((c) => c.count >= habit.targetCount).map((c) => c.date),
      );
      const gaps: Array<{ start: string; end: string; length: number }> = [];
      const start = parseISO(format(habit.startDate, "yyyy-MM-dd"));
      const iter = new Date(start);
      let gapStart: Date | null = null;
      let gapLen = 0;
      while (iter <= today) {
        if (isHabitScheduled(habitSched, iter)) {
          const ds = dateStr(iter);
          if (!completedSet.has(ds)) {
            if (gapStart === null) gapStart = new Date(iter);
            gapLen++;
          } else {
            if (gapStart !== null && gapLen >= 3) {
              gaps.push({
                start: dateStr(gapStart),
                end: dateStr(iter),
                length: gapLen,
              });
            }
            gapStart = null;
            gapLen = 0;
          }
        }
        iter.setDate(iter.getDate() + 1);
      }
      // Trailing gap (still ongoing)
      if (gapStart !== null && gapLen >= 3) {
        gaps.push({
          start: dateStr(gapStart),
          end: dateStr(today),
          length: gapLen,
        });
      }
      // Cap at last 5 gaps to keep token budget reasonable
      const last5Gaps = gaps.slice(-5);
      const completedDatesAsc = allForHabit
        .filter((c) => c.count >= habit.targetCount)
        .map((c) => c.date)
        .sort();
      const currentGapDays = computeCurrentGap(completedDatesAsc, today);
      const avgGapDays = computeAvgGap(completedDatesAsc);
      return {
        id: habit.id,
        name: habit.name,
        dayOfWeekRates,
        recentCheckins: recent,
        gaps: last5Gaps,
        currentGapDays,
        avgGapDays,
      };
    });
  }

  // Day-of-week keywords → dayOfWeekAnalysis
  const dayKeywords = DAY_NAMES.map((d) => d.toLowerCase()).concat(DAY_FULL_NAMES);
  dayKeywords.push("weekday", "weekend", "day of week", "monday", "tuesday");
  const wantsDayOfWeek = dayKeywords.some((k) => lc.includes(k));
  if (wantsDayOfWeek) {
    const dowSched = [0, 0, 0, 0, 0, 0, 0];
    const dowDone = [0, 0, 0, 0, 0, 0, 0];
    for (const habit of habits) {
      const habitSched: HabitWithScheduling = {
        id: habit.id,
        frequency: habit.frequency,
        customDays: habit.customDays,
        targetCount: habit.targetCount,
        startDate: habit.startDate,
      };
      const ck = checkinMaps.get(habit.id) ?? new Map();
      for (const day of eachDayOfInterval({ start: from30, end: today })) {
        if (!isHabitScheduled(habitSched, day)) continue;
        const jsDow = day.getDay();
        const monIdx = jsDow === 0 ? 6 : jsDow - 1;
        dowSched[monIdx]++;
        const cnt = ck.get(dateStr(day)) ?? 0;
        if (cnt >= habit.targetCount) dowDone[monIdx]++;
      }
    }
    const rates: Record<string, number> = {};
    let bestDay: string | null = null;
    let worstDay: string | null = null;
    let bestRate = -1;
    let worstRate = 101;
    for (let i = 0; i < 7; i++) {
      const r = dowSched[i] > 0 ? Math.round((dowDone[i] / dowSched[i]) * 100) : 0;
      rates[DAY_NAMES[i]] = r;
      if (dowSched[i] > 0) {
        if (r > bestRate) {
          bestRate = r;
          bestDay = DAY_NAMES[i];
        }
        if (r < worstRate) {
          worstRate = r;
          worstDay = DAY_NAMES[i];
        }
      }
    }
    baseContext.dayOfWeekAnalysis = { rates, bestDay, worstDay };
  }

  // Mood keywords → moodDeepDive
  const wantsMood = /\b(mood|feel|feeling|tired|happy|sad|energ|stress|calm|anxious|depress|emotion|energy|fatigue)\b/.test(lc);
  if (wantsMood) {
    const mood90 = moodEntries;
    const avg90 =
      mood90.length > 0
        ? Math.round((mood90.reduce((s, m) => s + m.score, 0) / mood90.length) * 10) / 10
        : null;
    const sorted30 = [...mood30].sort((a, b) => b.score - a.score);
    const bestDay30d = sorted30[0] ? { date: sorted30[0].date, score: sorted30[0].score } : null;
    const worstDay30d = sorted30[sorted30.length - 1]
      ? {
          date: sorted30[sorted30.length - 1].date,
          score: sorted30[sorted30.length - 1].score,
        }
      : null;
    const tagCounts = new Map<string, number>();
    for (const m of mood30) {
      if (!m.tags) continue;
      for (const t of m.tags.split(",").filter(Boolean)) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
    const topTags30d = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);
    baseContext.moodDeepDive = {
      avg30d: avg30,
      avg90d: avg90,
      bestDay30d,
      worstDay30d,
      topTags30d,
      byCompletionBuckets: moodByHabitsCompleted,
    };
  }

  // "why" → correlations
  const wantsCorrelations = /\bwhy\b/.test(lc);
  if (wantsCorrelations) {
    const correlations: Array<{ description: string }> = [];
    if (typeof high === "number" && typeof low === "number") {
      const diff = Math.round((high - low) * 10) / 10;
      if (diff > 0) {
        correlations.push({
          description: `Your mood is ${diff} points higher on days you complete 3+ habits vs days you complete 0.`,
        });
      } else if (diff < 0) {
        correlations.push({
          description: `Your mood is ${Math.abs(diff)} points LOWER on days you complete 3+ habits vs days you complete 0 (counterintuitive — worth examining).`,
        });
      }
    }
    for (const p of dedupedPatterns) {
      if (p.type === "weekend_dip") {
        correlations.push({
          description: `${p.habitName} completion drops from ${p.weekdayRate}% on weekdays to ${p.weekendRate}% on weekends — schedule friction is the likely cause.`,
        });
      } else if (p.type === "unusual_gap") {
        correlations.push({
          description: `${p.habitName} has been missed for ${p.currentGap} days vs an average gap of ${p.avgGap} days — biggest gap in your history.`,
        });
      } else if (p.type === "streak_forming") {
        correlations.push({
          description: `${p.habitName} is on a ${p.currentStreak}-day streak with >90% completion — momentum is building.`,
        });
      }
    }
    baseContext.correlations = correlations;
  }

  // "should I / recommend / suggest" → opportunities
  const wantsOpportunities = /\b(should i|recommend|suggest|improve|advice|tip|how can i|what should|what can i|help me)\b/.test(lc);
  if (wantsOpportunities) {
    const opportunities: Array<{ habitName: string; suggestion: string }> = [];
    // Pick top 3 opportunities from patterns + low-completion habits
    for (const p of dedupedPatterns) {
      if (p.type === "weekend_dip") {
        opportunities.push({
          habitName: p.habitName,
          suggestion: `Move ${p.habitName} to a morning slot on weekends, or lower the weekend target.`,
        });
      } else if (p.type === "unusual_gap") {
        opportunities.push({
          habitName: p.habitName,
          suggestion: `Restart ${p.habitName} with a minimal version (1 rep) to break the ${p.currentGap}-day gap.`,
        });
      }
    }
    // Habits below 50% completion → suggest pairing with stronger ones
    const weakHabits = habitStats
      .filter((h) => h.completionRate30d < 50 && h.completionRate30d > 0)
      .sort((a, b) => a.completionRate30d - b.completionRate30d)
      .slice(0, 2);
    for (const h of weakHabits) {
      opportunities.push({
        habitName: h.name,
        suggestion: `${h.name} is at ${h.completionRate30d}% (30d) — pair it with a stronger habit (e.g. after morning coffee) instead of stacking at night.`,
      });
    }
    baseContext.opportunities = opportunities.slice(0, 4);
  }

  return baseContext as unknown as Record<string, unknown>;
}

/* ============================================================================
   Helpers — pure functions (no DB)
============================================================================ */

/**
 * Completion rate (%) for a habit over a date range (inclusive), counting
 * only scheduled days on/after the habit's start date.
 */
function computeRate(
  habit: HabitWithScheduling,
  checkins: Map<string, number>,
  from: Date,
  to: Date,
): number {
  return computeRateForRange(habit, checkins, from, to);
}

function computeRateForRange(
  habit: HabitWithScheduling,
  checkins: Map<string, number>,
  from: Date,
  to: Date,
): number {
  let sched = 0;
  let done = 0;
  const iter = new Date(startOfDay(from));
  const end = startOfDay(to);
  while (iter <= end) {
    if (isHabitScheduled(habit, iter)) {
      sched++;
      const cnt = checkins.get(dateStr(iter)) ?? 0;
      if (cnt >= habit.targetCount) done++;
    }
    iter.setDate(iter.getDate() + 1);
  }
  return sched > 0 ? Math.round((done / sched) * 100) : 0;
}

/**
 * Current gap: days since the last completion, counting up to `today`.
 * Returns 0 if no completions exist or last completion is today.
 */
function computeCurrentGap(completedDatesAsc: string[], today: Date): number {
  if (completedDatesAsc.length === 0) return 0;
  const last = completedDatesAsc[completedDatesAsc.length - 1];
  const lastDate = parseISO(last);
  return Math.max(0, differenceInCalendarDays(today, lastDate));
}

/**
 * Avg gap: average calendar-day distance between consecutive completions.
 * Returns null if fewer than 2 completions.
 */
function computeAvgGap(completedDatesAsc: string[]): number | null {
  if (completedDatesAsc.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < completedDatesAsc.length; i++) {
    gaps.push(differenceInCalendarDays(parseISO(completedDatesAsc[i]), parseISO(completedDatesAsc[i - 1])));
  }
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return Math.round(avg * 10) / 10;
}
