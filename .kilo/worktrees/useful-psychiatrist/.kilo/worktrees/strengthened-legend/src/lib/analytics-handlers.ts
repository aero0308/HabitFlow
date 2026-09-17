import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import {
  toDateString,
  isHabitScheduled,
  calculateStreaks,
  parseCustomDays,
} from "@/lib/streak";
import { todayInTimezone, getBrowserTimezone } from "@/lib/timezone";
import type { Habit } from "@prisma/client";

export async function GET_dashboard(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const todayStr = todayInTimezone(user.timezone, getBrowserTimezone(req));
    const today = new Date(todayStr + "T12:00:00");

    const habits = await db.habit.findMany({
      where: { userId: user.id, isArchived: false },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { streak: true },
    });

    const habitIds = habits.map((h) => h.id);
    const [checkinsToday, freezesToday] = await Promise.all([
      habitIds.length
        ? db.checkin.findMany({ where: { habitId: { in: habitIds }, date: todayStr } })
        : Promise.resolve([]),
      habitIds.length
        ? db.habitFreeze.findMany({ where: { habitId: { in: habitIds }, date: todayStr } })
        : Promise.resolve([]),
    ]);

    const checkinMap = new Map<string, { count: number; note: string }>();
    for (const c of checkinsToday) {
      checkinMap.set(c.habitId, { count: c.count, note: c.note });
    }
    const frozenTodaySet = new Set(freezesToday.map((f) => f.habitId));

    // Today's scheduled habits + completion
    const todaysHabits = habits
      .filter((h) => isHabitScheduled(h, today))
      .map((h) => {
        const ci = checkinMap.get(h.id);
        const count = ci?.count ?? 0;
        const completed = count >= h.targetCount;
        return {
          id: h.id,
          name: h.name,
          description: h.description,
          color: h.color,
          icon: h.icon,
          frequency: h.frequency,
          customDays: parseCustomDays(h.customDays),
          targetCount: h.targetCount,
          count,
          completed,
          frozen: frozenTodaySet.has(h.id),
          note: ci?.note ?? "",
          category: h.category || "",
          timeOfDay: (h.timeOfDay as string) || "ANY_TIME",
          streak: h.streak
            ? {
                current: h.streak.currentStreak,
                longest: h.streak.longestStreak,
              }
            : { current: 0, longest: 0 },
        };
      });

    const scheduledToday = todaysHabits.length;
    const completedToday = todaysHabits.filter((h) => h.completed).length;
    const totalProgress = todaysHabits.reduce((sum, h) => sum + Math.min(h.count, h.targetCount), 0);
    const totalTarget = todaysHabits.reduce((sum, h) => sum + h.targetCount, 0);
    const completionPct =
      scheduledToday === 0 ? 0 : Math.round((completedToday / scheduledToday) * 100);

    // Quick streak leaderboard (current streaks)
    const streaks = habits
      .map((h) => ({
        habitId: h.id,
        name: h.name,
        color: h.color,
        icon: h.icon,
        currentStreak: h.streak?.currentStreak ?? 0,
        longestStreak: h.streak?.longestStreak ?? 0,
        totalCompletions: h.streak?.totalCompletions ?? 0,
      }))
      .sort((a, b) => b.currentStreak - a.currentStreak);

    return apiOk({
      date: todayStr,
      scheduledToday,
      completedToday,
      completionPct,
      totalProgress,
      totalTarget,
      todaysHabits,
      streaks,
      totalHabits: habits.length,
    });
  })();
}

export async function GET_calendar(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month"); // YYYY-MM
    const habitId = url.searchParams.get("habit_id");

    // Determine month range
    let year: number, month: number;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      year = y;
      month = m - 1;
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth();
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const fromStr = toDateString(firstDay);
    const toStr = toDateString(lastDay);

    const habitsWhere: { userId: string; isArchived?: boolean; id?: string } = {
      userId: user.id,
      isArchived: false,
    };
    if (habitId) habitsWhere.id = habitId;

    const habits = await db.habit.findMany({ where: habitsWhere, orderBy: { position: "asc" } });
    const habitIds = habits.map((h) => h.id);

    const checkins = habitIds.length
      ? await db.checkin.findMany({
          where: { habitId: { in: habitIds }, date: { gte: fromStr, lte: toStr } },
        })
      : [];

    // Group by date
    type DayData = {
      date: string;
      completed: number;
      scheduled: number;
      ratio: number;
      habits: { habitId: string; name: string; color: string; icon: string; count: number; targetCount: number; completed: boolean }[];
    };
    const byDate = new Map<string, DayData>();

    // Initialize all days in month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const ds = toDateString(date);
      const scheduledHabits = habits.filter((h) => isHabitScheduled(h, date));
      byDate.set(ds, {
        date: ds,
        completed: 0,
        scheduled: scheduledHabits.length,
        ratio: 0,
        habits: scheduledHabits.map((h) => ({
          habitId: h.id,
          name: h.name,
          color: h.color,
          icon: h.icon,
          count: 0,
          targetCount: h.targetCount,
          completed: false,
        })),
      });
    }

    // Fill in checkins
    for (const c of checkins) {
      const day = byDate.get(c.date);
      if (!day) continue;
      const habitMeta = habits.find((h) => h.id === c.habitId);
      if (!habitMeta) continue;
      const entry = day.habits.find((h) => h.habitId === c.habitId);
      if (entry) {
        entry.count = c.count;
        entry.completed = c.count >= habitMeta.targetCount;
        if (entry.completed) day.completed += 1;
      }
    }

    // Compute ratios
    for (const day of byDate.values()) {
      day.ratio = day.scheduled === 0 ? 0 : day.completed / day.scheduled;
    }

    return apiOk({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      days: Array.from(byDate.values()),
    });
  })();
}

export async function GET_completion(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days") || 90), 7), 365);

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - days + 1);
    const fromStr = toDateString(from);

    const habits = await db.habit.findMany({
      where: { userId: user.id, isArchived: false },
      orderBy: { position: "asc" },
    });
    const habitIds = habits.map((h) => h.id);

    const checkins = habitIds.length
      ? await db.checkin.findMany({
          where: { habitId: { in: habitIds }, date: { gte: fromStr } },
        })
      : [];

    // Build per-day completion counts (aggregated across all habits)
    const byDate = new Map<string, { completed: number; scheduled: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      byDate.set(toDateString(d), { completed: 0, scheduled: 0 });
    }

    // Count scheduled per day
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const ds = toDateString(d);
      const scheduled = habits.filter((h) => isHabitScheduled(h, d)).length;
      byDate.get(ds)!.scheduled = scheduled;
    }

    // Fill completions
    for (const c of checkins) {
      const day = byDate.get(c.date);
      if (!day) continue;
      const habit = habits.find((h) => h.id === c.habitId);
      if (!habit) continue;
      if (c.count >= habit.targetCount) day.completed += 1;
    }

    // Weekly buckets (last 12 weeks)
    const weekly: { weekStart: string; completed: number; scheduled: number; pct: number }[] = [];
    const weekCount = Math.min(12, Math.ceil(days / 7));
    for (let w = weekCount - 1; w >= 0; w--) {
      const ws = new Date(today);
      ws.setDate(ws.getDate() - w * 7 - 6); // start of week (7 days back)
      ws.setHours(0, 0, 0, 0);
      let completed = 0;
      let scheduled = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(ws);
        day.setDate(day.getDate() + d);
        const ds = toDateString(day);
        const entry = byDate.get(ds);
        if (entry) {
          completed += entry.completed;
          scheduled += entry.scheduled;
        }
      }
      weekly.push({
        weekStart: toDateString(ws),
        completed,
        scheduled,
        pct: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
      });
    }

    // Per-habit completion rate over the window
    const perHabit = habits.map((h) => {
      let scheduled = 0;
      let completed = 0;
      const iter = new Date(from);
      while (iter <= today) {
        if (isHabitScheduled(h, iter)) {
          scheduled += 1;
        }
        iter.setDate(iter.getDate() + 1);
      }
      const habitCheckins = checkins.filter((c) => c.habitId === h.id);
      for (const c of habitCheckins) {
        if (c.date >= fromStr && c.count >= h.targetCount) completed += 1;
      }
      return {
        habitId: h.id,
        name: h.name,
        color: h.color,
        icon: h.icon,
        scheduled,
        completed,
        rate: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
      };
    });

    // Day-of-week heatmap (Mon..Sun) over the window
    const dayOfWeek = Array.from({ length: 7 }, (_, i) => ({
      day: i, // 0=Mon..6=Sun
      completed: 0,
      scheduled: 0,
      pct: 0,
    }));
    for (const [ds, entry] of byDate.entries()) {
      const d = new Date(ds + "T00:00:00");
      const jsDay = d.getDay();
      const monFirst = jsDay === 0 ? 6 : jsDay - 1;
      dayOfWeek[monFirst].completed += entry.completed;
      dayOfWeek[monFirst].scheduled += entry.scheduled;
    }
    for (const d of dayOfWeek) {
      d.pct = d.scheduled === 0 ? 0 : Math.round((d.completed / d.scheduled) * 100);
    }

    return apiOk({
      days,
      weekly,
      perHabit,
      dayOfWeek,
    });
  })();
}

export async function GET_streaks() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const today = new Date();

    const habits = await db.habit.findMany({
      where: { userId: user.id, isArchived: false },
      orderBy: { position: "asc" },
      include: { streak: true },
    });

    const out = await Promise.all(
      habits.map(async (h: Habit & { streak: { currentStreak: number; longestStreak: number; totalCompletions: number; lastCompletedDate: string | null } | null }) => {
        // Recompute live to be safe (cheap for reasonable history)
        const [checkins, freezes] = await Promise.all([
          db.checkin.findMany({ where: { habitId: h.id } }),
          db.habitFreeze.findMany({ where: { habitId: h.id } }),
        ]);
        const byDate: Record<string, number> = {};
        for (const c of checkins) byDate[c.date] = c.count;
        const frozenSet = new Set(freezes.map((f) => f.date));
        const live = calculateStreaks(h, byDate, today, frozenSet);
        return {
          habitId: h.id,
          name: h.name,
          color: h.color,
          icon: h.icon,
          frequency: h.frequency,
          targetCount: h.targetCount,
          currentStreak: live.currentStreak,
          longestStreak: live.longestStreak,
          totalCompletions: live.totalCompletions,
          completionRate: Math.round(live.completionRate * 100),
        };
      }),
    );

    return apiOk({ streaks: out });
  })();
}

export async function GET_health() {
  return withErrorHandler(async () => {
    return apiOk({ status: "ok", time: new Date().toISOString() });
  })();
}

export async function GET_habit_detail(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.habit.findUnique({
      where: { id },
      include: { streak: true },
    });
    if (!habit || habit.userId !== user.id) return apiError("Habit not found", 404, "NOT_FOUND");

    // Last 90 days of checkins
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 89);
    const fromStr = toDateString(from);

    const checkins = await db.checkin.findMany({
      where: { habitId: id, date: { gte: fromStr } },
      orderBy: { date: "asc" },
    });

    // Calendar (last 90 days)
    const calendar: { date: string; scheduled: boolean; count: number; targetCount: number; completed: boolean }[] = [];
    const iter = new Date(from);
    while (iter <= today) {
      const ds = toDateString(iter);
      const ci = checkins.find((c) => c.date === ds);
      const scheduled = isHabitScheduled(habit, iter);
      calendar.push({
        date: ds,
        scheduled,
        count: ci?.count ?? 0,
        targetCount: habit.targetCount,
        completed: scheduled && (ci?.count ?? 0) >= habit.targetCount,
      });
      iter.setDate(iter.getDate() + 1);
    }

    // Weekly buckets (last 12 weeks) for this habit
    const weekly: { weekStart: string; completed: number; scheduled: number; pct: number }[] = [];
    for (let w = 11; w >= 0; w--) {
      const ws = new Date(today);
      ws.setDate(ws.getDate() - w * 7 - 6);
      ws.setHours(0, 0, 0, 0);
      let completed = 0;
      let scheduled = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(ws);
        day.setDate(day.getDate() + d);
        if (day > today) break;
        const ds = toDateString(day);
        if (isHabitScheduled(habit, day)) {
          scheduled += 1;
          const ci = checkins.find((c) => c.date === ds);
          if (ci && ci.count >= habit.targetCount) completed += 1;
        }
      }
      weekly.push({
        weekStart: toDateString(ws),
        completed,
        scheduled,
        pct: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
      });
    }

    // Day-of-week breakdown
    const dayOfWeek = Array.from({ length: 7 }, (_, i) => ({
      day: i,
      completed: 0,
      scheduled: 0,
      pct: 0,
    }));
    const startIter = new Date(habit.startDate);
    const allCheckins = await db.checkin.findMany({ where: { habitId: id } });
    const allIt = new Date(startIter);
    while (allIt <= today) {
      if (isHabitScheduled(habit, allIt)) {
        const ds = toDateString(allIt);
        const jsDay = allIt.getDay();
        const monFirst = jsDay === 0 ? 6 : jsDay - 1;
        dayOfWeek[monFirst].scheduled += 1;
        const ci = allCheckins.find((c) => c.date === ds);
        if (ci && ci.count >= habit.targetCount) dayOfWeek[monFirst].completed += 1;
      }
      allIt.setDate(allIt.getDate() + 1);
    }
    for (const d of dayOfWeek) {
      d.pct = d.scheduled === 0 ? 0 : Math.round((d.completed / d.scheduled) * 100);
    }

    const checkinsByDate: Record<string, number> = {};
    for (const c of allCheckins) checkinsByDate[c.date] = c.count;
    const allFreezes = await db.habitFreeze.findMany({ where: { habitId: id } });
    const frozenSet = new Set(allFreezes.map((f) => f.date));
    const liveStreak = calculateStreaks(habit, checkinsByDate, today, frozenSet);

    return apiOk({
      habit: {
        id: habit.id,
        name: habit.name,
        description: habit.description,
        color: habit.color,
        icon: habit.icon,
        frequency: habit.frequency,
        customDays: parseCustomDays(habit.customDays),
        targetCount: habit.targetCount,
        startDate: habit.startDate.toISOString().slice(0, 10),
        position: habit.position,
        isArchived: habit.isArchived,
        category: habit.category || "",
        timeOfDay: (habit.timeOfDay as string) || "ANY_TIME",
      },
      streak: {
        currentStreak: liveStreak.currentStreak,
        longestStreak: liveStreak.longestStreak,
        totalCompletions: liveStreak.totalCompletions,
        completionRate: Math.round(liveStreak.completionRate * 100),
      },
      calendar,
      weekly,
      dayOfWeek,
      recentCheckins: checkins.slice(-30).map((c) => ({
        id: c.id,
        date: c.date,
        count: c.count,
        note: c.note,
      })),
    });
  })();
}

/**
 * Weekly summary: this week's (Mon-Sun) completion stats + delta vs last week.
 */
export async function GET_weekly_summary() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const today = new Date();

    // Find Monday of current week (Mon-first)
    const jsDay = today.getDay();
    const monFirst = jsDay === 0 ? 6 : jsDay - 1;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - monFirst);
    thisMonday.setHours(0, 0, 0, 0);
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);

    const habits = await db.habit.findMany({
      where: { userId: user.id, isArchived: false },
    });
    const habitIds = habits.map((h) => h.id);

    const fromStr = toDateString(lastMonday);
    const toStr = toDateString(thisSunday);
    const checkins = habitIds.length
      ? await db.checkin.findMany({
          where: { habitId: { in: habitIds }, date: { gte: fromStr, lte: toStr } },
        })
      : [];

    // This week
    let thisScheduled = 0;
    let thisCompleted = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(thisMonday);
      day.setDate(thisMonday.getDate() + d);
      if (day > today) break;
      for (const h of habits) {
        if (isHabitScheduled(h, day)) {
          thisScheduled += 1;
          const ci = checkins.find((c) => c.habitId === h.id && c.date === toDateString(day));
          if (ci && ci.count >= h.targetCount) thisCompleted += 1;
        }
      }
    }
    // Last week
    let lastScheduled = 0;
    let lastCompleted = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(lastMonday);
      day.setDate(lastMonday.getDate() + d);
      for (const h of habits) {
        if (isHabitScheduled(h, day)) {
          lastScheduled += 1;
          const ci = checkins.find((c) => c.habitId === h.id && c.date === toDateString(day));
          if (ci && ci.count >= h.targetCount) lastCompleted += 1;
        }
      }
    }

    const thisPct = thisScheduled === 0 ? 0 : Math.round((thisCompleted / thisScheduled) * 100);
    const lastPct = lastScheduled === 0 ? 0 : Math.round((lastCompleted / lastScheduled) * 100);
    const delta = thisPct - lastPct;

    // Per-day breakdown for this week (for mini bar chart)
    const days: { date: string; label: string; scheduled: number; completed: number; pct: number; isToday: boolean }[] = [];
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let d = 0; d < 7; d++) {
      const day = new Date(thisMonday);
      day.setDate(thisMonday.getDate() + d);
      const ds = toDateString(day);
      let scheduled = 0;
      let completed = 0;
      for (const h of habits) {
        if (isHabitScheduled(h, day)) {
          scheduled += 1;
          const ci = checkins.find((c) => c.habitId === h.id && c.date === ds);
          if (ci && ci.count >= h.targetCount) completed += 1;
        }
      }
      days.push({
        date: ds,
        label: dayLabels[d],
        scheduled,
        completed,
        pct: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
        isToday: ds === toDateString(today),
      });
    }

    return apiOk({
      thisWeek: { scheduled: thisScheduled, completed: thisCompleted, pct: thisPct },
      lastWeek: { scheduled: lastScheduled, completed: lastCompleted, pct: lastPct },
      delta,
      days,
      weekStart: toDateString(thisMonday),
      weekEnd: toDateString(thisSunday),
    });
  })();
}

/**
 * Achievements: compute badges based on user's habit data.
 */
export async function GET_achievements() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const habits = await db.habit.findMany({
      where: { userId: user.id },
      include: { streak: true, checkins: true },
    });

    const totalHabits = habits.filter((h) => !h.isArchived).length;
    const allCheckins = habits.flatMap((h) => h.checkins);
    const totalCheckins = allCheckins.length;
    const maxCurrentStreak = Math.max(0, ...habits.map((h) => h.streak?.currentStreak ?? 0));
    const maxLongestStreak = Math.max(0, ...habits.map((h) => h.streak?.longestStreak ?? 0));
    const maxTotalCompletions = Math.max(0, ...habits.map((h) => h.streak?.totalCompletions ?? 0));

    // Perfect days: days where ALL scheduled habits were completed
    const dayMap = new Map<string, { scheduled: number; completed: number }>();
    const today = new Date();
    for (const h of habits) {
      if (h.isArchived) continue;
      const iter = new Date(h.startDate);
      while (iter <= today) {
        if (isHabitScheduled(h, iter)) {
          const ds = toDateString(iter);
          if (!dayMap.has(ds)) dayMap.set(ds, { scheduled: 0, completed: 0 });
          const entry = dayMap.get(ds)!;
          entry.scheduled += 1;
          const ci = h.checkins.find((c) => c.date === ds);
          if (ci && ci.count >= h.targetCount) entry.completed += 1;
        }
        iter.setDate(iter.getDate() + 1);
      }
    }
    const perfectDays = Array.from(dayMap.values()).filter((d) => d.scheduled > 0 && d.completed === d.scheduled).length;

    const achievements = [
      {
        id: "first-step",
        title: "First Step",
        description: "Complete your first check-in",
        icon: "🎯",
        earned: totalCheckins >= 1,
        progress: Math.min(totalCheckins, 1),
        target: 1,
        color: "#10b981",
      },
      {
        id: "habit-builder",
        title: "Habit Builder",
        description: "Create 3 habits",
        icon: "🌱",
        earned: totalHabits >= 3,
        progress: Math.min(totalHabits, 3),
        target: 3,
        color: "#84cc16",
      },
      {
        id: "collector",
        title: "Collector",
        description: "Create 5 habits",
        icon: "📚",
        earned: totalHabits >= 5,
        progress: Math.min(totalHabits, 5),
        target: 5,
        color: "#8b5cf6",
      },
      {
        id: "streak-3",
        title: "On a Roll",
        description: "Reach a 3-day streak",
        icon: "🔥",
        earned: maxLongestStreak >= 3,
        progress: Math.min(maxLongestStreak, 3),
        target: 3,
        color: "#f59e0b",
      },
      {
        id: "streak-7",
        title: "Week Warrior",
        description: "Reach a 7-day streak",
        icon: "⚡",
        earned: maxLongestStreak >= 7,
        progress: Math.min(maxLongestStreak, 7),
        target: 7,
        color: "#ec4899",
      },
      {
        id: "streak-30",
        title: "Unstoppable",
        description: "Reach a 30-day streak",
        icon: "💎",
        earned: maxLongestStreak >= 30,
        progress: Math.min(maxLongestStreak, 30),
        target: 30,
        color: "#0ea5e9",
      },
      {
        id: "streak-100",
        title: "Centurion",
        description: "Reach a 100-day streak",
        icon: "👑",
        earned: maxLongestStreak >= 100,
        progress: Math.min(maxLongestStreak, 100),
        target: 100,
        color: "#f97316",
      },
      {
        id: "perfect-day",
        title: "Perfect Day",
        description: "Complete all habits in a single day",
        icon: "✨",
        earned: perfectDays >= 1,
        progress: Math.min(perfectDays, 1),
        target: 1,
        color: "#14b8a6",
      },
      {
        id: "perfect-week",
        title: "Flawless Week",
        description: "Have 5 perfect days",
        icon: "🌟",
        earned: perfectDays >= 5,
        progress: Math.min(perfectDays, 5),
        target: 5,
        color: "#6366f1",
      },
      {
        id: "consistent",
        title: "Consistent",
        description: "Complete 50 check-ins total",
        icon: "🏅",
        earned: totalCheckins >= 50,
        progress: Math.min(totalCheckins, 50),
        target: 50,
        color: "#ef4444",
      },
      {
        id: "dedicated",
        title: "Dedicated",
        description: "Complete 200 check-ins total",
        icon: "🎖️",
        earned: totalCheckins >= 200,
        progress: Math.min(totalCheckins, 200),
        target: 200,
        color: "#a855f7",
      },
      {
        id: "master",
        title: "Habit Master",
        description: "Complete 500 check-ins total",
        icon: "🏆",
        earned: totalCheckins >= 500,
        progress: Math.min(totalCheckins, 500),
        target: 500,
        color: "#eab308",
      },
    ];

    const earnedCount = achievements.filter((a) => a.earned).length;
    return apiOk({
      achievements,
      earnedCount,
      totalCount: achievements.length,
      stats: {
        totalHabits,
        totalCheckins,
        maxCurrentStreak,
        maxLongestStreak,
        perfectDays,
        maxTotalCompletions,
      },
    });
  })();
}

/**
 * Habit history timeline: chronological list of all check-ins across all habits.
 */
export async function GET_history(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
    const habitId = url.searchParams.get("habit_id");

    const habits = await db.habit.findMany({
      where: { userId: user.id, ...(habitId ? { id: habitId } : {}) },
      orderBy: [{ position: "asc" }],
    });
    const habitIds = habits.map((h) => h.id);
    const habitMap = new Map(habits.map((h) => [h.id, h]));

    const checkins = habitIds.length
      ? await db.checkin.findMany({
          where: { habitId: { in: habitIds } },
          orderBy: { date: "desc" },
          take: limit,
        })
      : [];

    const items = checkins.map((c) => {
      const habit = habitMap.get(c.habitId)!;
      return {
        id: c.id,
        habitId: c.habitId,
        habitName: habit.name,
        habitIcon: habit.icon,
        habitColor: habit.color,
        date: c.date,
        count: c.count,
        targetCount: habit.targetCount,
        completed: c.count >= habit.targetCount,
        note: c.note,
        createdAt: c.createdAt.toISOString(),
      };
    });

    return apiOk({ items, total: items.length });
  })();
}

/**
 * Weekly review: a richer weekly summary with per-habit performance + reflection prompts.
 */
export async function GET_weekly_review() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const today = new Date();

    // Find Monday of current week (Mon-first)
    const jsDay = today.getDay();
    const monFirst = jsDay === 0 ? 6 : jsDay - 1;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - monFirst);
    thisMonday.setHours(0, 0, 0, 0);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const habits = await db.habit.findMany({
      where: { userId: user.id, isArchived: false },
      orderBy: [{ position: "asc" }],
      include: { streak: true },
    });
    const habitIds = habits.map((h) => h.id);

    const fromStr = toDateString(lastMonday);
    const toStr = toDateString(today);
    const checkins = habitIds.length
      ? await db.checkin.findMany({
          where: { habitId: { in: habitIds }, date: { gte: fromStr, lte: toStr } },
        })
      : [];

    // Per-habit performance this week
    const habitStats = habits.map((h) => {
      let scheduled = 0;
      let completed = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(thisMonday);
        day.setDate(thisMonday.getDate() + d);
        if (day > today) break;
        if (isHabitScheduled(h, day)) {
          scheduled += 1;
          const ci = checkins.find((c) => c.habitId === h.id && c.date === toDateString(day));
          if (ci && ci.count >= h.targetCount) completed += 1;
        }
      }
      return {
        habitId: h.id,
        name: h.name,
        icon: h.icon,
        color: h.color,
        category: h.category || "",
        scheduled,
        completed,
        rate: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
        currentStreak: h.streak?.currentStreak ?? 0,
      };
    });

    const totalScheduled = habitStats.reduce((s, h) => s + h.scheduled, 0);
    const totalCompleted = habitStats.reduce((s, h) => s + h.completed, 0);
    const overallPct = totalScheduled === 0 ? 0 : Math.round((totalCompleted / totalScheduled) * 100);

    // Best + worst habits (by rate, min 1 scheduled)
    const withData = habitStats.filter((h) => h.scheduled > 0);
    const best = [...withData].sort((a, b) => b.rate - a.rate)[0] ?? null;
    const worst = [...withData].sort((a, b) => a.rate - b.rate)[0] ?? null;

    // Notes from this week
    const weekNotes = checkins
      .filter((c) => c.note && c.note.trim() !== "")
      .map((c) => {
        const h = habits.find((x) => x.id === c.habitId);
        return {
          habitId: c.habitId,
          habitName: h?.name ?? "",
          habitIcon: h?.icon ?? "",
          date: c.date,
          note: c.note,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    // Streaks snapshot (from included streak relation)
    const totalCurrentStreakDays = habits.reduce((s, h) => s + (h.streak?.currentStreak ?? 0), 0);
    const maxCurrentStreak = Math.max(0, ...habits.map((h) => h.streak?.currentStreak ?? 0));

    return apiOk({
      weekStart: toDateString(thisMonday),
      today: toDateString(today),
      totalScheduled,
      totalCompleted,
      overallPct,
      habitStats,
      best,
      worst,
      weekNotes,
      totalCurrentStreakDays,
      maxCurrentStreak,
      totalHabits: habits.length,
    });
  })();
}

/**
 * Yearly contribution heatmap: per-day completion ratio for the last 365 days,
 * aggregated across all non-archived habits. Returns a flat array of day objects
 * plus summary stats. Designed for a GitHub-style 365-day heatmap.
 */
export async function GET_yearly_heatmap(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const year = url.searchParams.get("year");
    const habitId = url.searchParams.get("habit_id");

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Determine the 365-day window ending today (or a specific year)
    let end: Date;
    let start: Date;
    if (year && /^\d{4}$/.test(year)) {
      const y = Number(year);
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
      if (end > today) end = today;
    } else {
      end = today;
      start = new Date(today);
      start.setDate(start.getDate() - 364); // 365 days including today
      start.setHours(0, 0, 0, 0);
    }

    const startStr = toDateString(start);
    const endStr = toDateString(end);

    const habitsWhere: { userId: string; isArchived?: boolean; id?: string } = {
      userId: user.id,
      isArchived: false,
    };
    if (habitId) habitsWhere.id = habitId;

    const habits = await db.habit.findMany({ where: habitsWhere, orderBy: { position: "asc" } });
    const habitIds = habits.map((h) => h.id);

    const checkins = habitIds.length
      ? await db.checkin.findMany({
          where: { habitId: { in: habitIds }, date: { gte: startStr, lte: endStr } },
        })
      : [];

    // Build a map: date -> { completed, scheduled }
    const dayMap = new Map<string, { completed: number; scheduled: number }>();

    // Count scheduled per day by iterating each habit's schedule
    const iter = new Date(start);
    while (iter <= end) {
      const ds = toDateString(iter);
      let scheduled = 0;
      for (const h of habits) {
        if (isHabitScheduled(h, iter)) scheduled += 1;
      }
      dayMap.set(ds, { completed: 0, scheduled });
      iter.setDate(iter.getDate() + 1);
    }

    // Fill in completions from checkins
    for (const c of checkins) {
      const day = dayMap.get(c.date);
      if (!day) continue;
      const habit = habits.find((h) => h.id === c.habitId);
      if (!habit) continue;
      if (c.count >= habit.targetCount) day.completed += 1;
    }

    // Build the flat days array
    const days: { date: string; completed: number; scheduled: number; ratio: number }[] = [];
    let totalCompleted = 0;
    let totalScheduled = 0;
    let activeDays = 0; // days with at least 1 completion
    let perfectDays = 0; // days where all scheduled were completed
    const iter2 = new Date(start);
    while (iter2 <= end) {
      const ds = toDateString(iter2);
      const entry = dayMap.get(ds) ?? { completed: 0, scheduled: 0 };
      const ratio = entry.scheduled === 0 ? 0 : entry.completed / entry.scheduled;
      days.push({ date: ds, completed: entry.completed, scheduled: entry.scheduled, ratio });
      totalCompleted += entry.completed;
      totalScheduled += entry.scheduled;
      if (entry.completed > 0) activeDays += 1;
      if (entry.scheduled > 0 && entry.completed === entry.scheduled) perfectDays += 1;
      iter2.setDate(iter2.getDate() + 1);
    }

    // Monthly breakdown (12 months or partial)
    const monthlyMap = new Map<string, { completed: number; scheduled: number }>();
    for (const d of days) {
      const monthKey = d.date.slice(0, 7); // YYYY-MM
      const entry = monthlyMap.get(monthKey) ?? { completed: 0, scheduled: 0 };
      entry.completed += d.completed;
      entry.scheduled += d.scheduled;
      monthlyMap.set(monthKey, entry);
    }
    const monthly = Array.from(monthlyMap.entries())
      .map(([month, v]) => ({
        month,
        completed: v.completed,
        scheduled: v.scheduled,
        rate: v.scheduled === 0 ? 0 : Math.round((v.completed / v.scheduled) * 100),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const overallRate = totalScheduled === 0 ? 0 : Math.round((totalCompleted / totalScheduled) * 100);

    return apiOk({
      start: startStr,
      end: endStr,
      days,
      monthly,
      stats: {
        totalCompleted,
        totalScheduled,
        overallRate,
        activeDays,
        perfectDays,
        totalDays: days.length,
      },
    });
  })();
}

/**
 * Year-over-year comparison: compares the current year's stats vs the previous year
 * for the same date range (Jan 1 to today). Returns monthly breakdowns for both years
 * + summary deltas. Designed for a "this year vs last year" analytics view.
 */
export async function GET_year_comparison() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const thisYear = today.getFullYear();
    const lastYear = thisYear - 1;

    // This year: Jan 1 to today
    const thisYearStart = new Date(thisYear, 0, 1);
    const thisYearEnd = today;
    // Last year: Jan 1 to same month/day last year
    const lastYearStart = new Date(lastYear, 0, 1);
    const lastYearEnd = new Date(lastYear, today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const habits = await db.habit.findMany({
      where: { userId: user.id },
      orderBy: [{ position: "asc" }],
    });
    const habitIds = habits.map((h) => h.id);

    // Fetch all checkins for both years
    const allCheckins = habitIds.length
      ? await db.checkin.findMany({
          where: {
            habitId: { in: habitIds },
            date: { gte: toDateString(lastYearStart), lte: toDateString(thisYearEnd) },
          },
        })
      : [];

    function computeForRange(start: Date, end: Date) {
      const startStr = toDateString(start);
      const endStr = toDateString(end);
      const rangeCheckins = allCheckins.filter((c) => c.date >= startStr && c.date <= endStr);
      const checkinMap = new Map<string, Map<string, number>>(); // habitId -> date -> count
      for (const c of rangeCheckins) {
        if (!checkinMap.has(c.habitId)) checkinMap.set(c.habitId, new Map());
        checkinMap.get(c.habitId)!.set(c.date, c.count);
      }

      let totalCompleted = 0;
      let totalScheduled = 0;
      let activeDays = 0;
      let perfectDays = 0;
      const monthlyMap = new Map<string, { completed: number; scheduled: number }>();
      const daySet = new Set<string>();

      const iter = new Date(start);
      while (iter <= end) {
        const ds = toDateString(iter);
        let dayScheduled = 0;
        let dayCompleted = 0;
        for (const h of habits) {
          // Only count habits that existed by this date (startDate <= iter)
          if (new Date(h.startDate) > iter) continue;
          if (h.isArchived) continue;
          if (isHabitScheduled(h, iter)) {
            dayScheduled += 1;
            const ci = checkinMap.get(h.id)?.get(ds);
            if (ci && ci >= h.targetCount) dayCompleted += 1;
          }
        }
        if (dayScheduled > 0) {
          totalScheduled += dayScheduled;
          totalCompleted += dayCompleted;
          if (dayCompleted > 0) activeDays += 1;
          if (dayCompleted === dayScheduled) perfectDays += 1;
          daySet.add(ds);
          const monthKey = ds.slice(0, 7);
          const entry = monthlyMap.get(monthKey) ?? { completed: 0, scheduled: 0 };
          entry.completed += dayCompleted;
          entry.scheduled += dayScheduled;
          monthlyMap.set(monthKey, entry);
        }
        iter.setDate(iter.getDate() + 1);
      }

      const monthly = Array.from(monthlyMap.entries())
        .map(([month, v]) => ({
          month,
          completed: v.completed,
          scheduled: v.scheduled,
          rate: v.scheduled === 0 ? 0 : Math.round((v.completed / v.scheduled) * 100),
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        totalCompleted,
        totalScheduled,
        overallRate: totalScheduled === 0 ? 0 : Math.round((totalCompleted / totalScheduled) * 100),
        activeDays,
        perfectDays,
        totalDays: daySet.size,
        monthly,
      };
    }

    const thisYearStats = computeForRange(thisYearStart, thisYearEnd);
    const lastYearStats = computeForRange(lastYearStart, lastYearEnd);

    // Deltas (this year - last year)
    const deltas = {
      totalCompleted: thisYearStats.totalCompleted - lastYearStats.totalCompleted,
      overallRate: thisYearStats.overallRate - lastYearStats.overallRate,
      activeDays: thisYearStats.activeDays - lastYearStats.activeDays,
      perfectDays: thisYearStats.perfectDays - lastYearStats.perfectDays,
    };

    return apiOk({
      thisYear,
      lastYear,
      thisYearStats,
      lastYearStats,
      deltas,
    });
  })();
}

/**
 * Insights: personalized recommendations and patterns derived from the user's data.
 * Surfaces best/worst habits, most-missed day of week, consistency trends, and motivational stats.
 */
export async function GET_insights() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const today = new Date();

    const habits = await db.habit.findMany({
      where: { userId: user.id, isArchived: false },
      include: { streak: true },
      orderBy: [{ position: "asc" }],
    });
    const habitIds = habits.map((h) => h.id);

    if (habits.length === 0) {
      return apiOk({
        hasData: false,
        insights: [],
      });
    }

    // Fetch all checkins for these habits
    const allCheckins = habitIds.length
      ? await db.checkin.findMany({
          where: { habitId: { in: habitIds } },
        })
      : [];

    // Build checkin maps
    const checkinByHabitDate = new Map<string, Map<string, number>>();
    for (const c of allCheckins) {
      if (!checkinByHabitDate.has(c.habitId)) checkinByHabitDate.set(c.habitId, new Map());
      checkinByHabitDate.get(c.habitId)!.set(c.date, c.count);
    }

    const insights: {
      type: string;
      title: string;
      description: string;
      icon: string;
      accent: string;
      data?: Record<string, unknown>;
    }[] = [];

    // ---- Best & worst habits (by completion rate, min 3 scheduled days) ----
    const habitPerformance: { habitId: string; name: string; icon: string; color: string; rate: number; completed: number; scheduled: number; currentStreak: number }[] = [];
    for (const h of habits) {
      const checkinMap = checkinByHabitDate.get(h.id) ?? new Map<string, number>();
      let scheduled = 0;
      let completed = 0;
      const iter = new Date(h.startDate);
      while (iter <= today) {
        if (isHabitScheduled(h, iter)) {
          scheduled += 1;
          const ci = checkinMap.get(toDateString(iter));
          if (ci && ci >= h.targetCount) completed += 1;
        }
        iter.setDate(iter.getDate() + 1);
      }
      if (scheduled >= 3) {
        habitPerformance.push({
          habitId: h.id,
          name: h.name,
          icon: h.icon,
          color: h.color,
          rate: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
          completed,
          scheduled,
          currentStreak: h.streak?.currentStreak ?? 0,
        });
      }
    }

    const sorted = [...habitPerformance].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best && worst && best.habitId !== worst.habitId) {
      insights.push({
        type: "best-habit",
        title: `Your strongest habit`,
        description: `${best.icon} ${best.name} has a ${best.rate}% completion rate (${best.completed}/${best.scheduled} days). ${best.currentStreak > 0 ? `You're on a ${best.currentStreak}-day streak! 🔥` : `Keep it up!`}`,
        icon: "🏆",
        accent: "emerald",
        data: { habitId: best.habitId, rate: best.rate, currentStreak: best.currentStreak },
      });
      insights.push({
        type: "focus-habit",
        title: `Room to grow`,
        description: `${worst.icon} ${worst.name} is at ${worst.rate}% (${worst.completed}/${worst.scheduled}). Try doing it first thing in the morning to build consistency.`,
        icon: "🎯",
        accent: "amber",
        data: { habitId: worst.habitId, rate: worst.rate },
      });
    }

    // ---- Most-missed day of week ----
    const dayOfWeekStats = Array.from({ length: 7 }, (_, i) => ({
      day: i, // 0=Mon..6=Sun
      completed: 0,
      scheduled: 0,
    }));
    for (const h of habits) {
      const checkinMap = checkinByHabitDate.get(h.id) ?? new Map<string, number>();
      const iter = new Date(h.startDate);
      while (iter <= today) {
        if (isHabitScheduled(h, iter)) {
          const ds = toDateString(iter);
          const jsDay = iter.getDay();
          const monFirst = jsDay === 0 ? 6 : jsDay - 1;
          dayOfWeekStats[monFirst].scheduled += 1;
          const ci = checkinMap.get(ds);
          if (ci && ci >= h.targetCount) dayOfWeekStats[monFirst].completed += 1;
        }
        iter.setDate(iter.getDate() + 1);
      }
    }
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const daysWithData = dayOfWeekStats.filter((d) => d.scheduled >= 3);
    if (daysWithData.length > 0) {
      const worstDay = [...daysWithData].sort((a, b) => {
        const aRate = a.scheduled === 0 ? 1 : a.completed / a.scheduled;
        const bRate = b.scheduled === 0 ? 1 : b.completed / b.scheduled;
        return aRate - bRate;
      })[0];
      const bestDay = [...daysWithData].sort((a, b) => {
        const aRate = a.scheduled === 0 ? 0 : a.completed / a.scheduled;
        const bRate = b.scheduled === 0 ? 0 : b.completed / b.scheduled;
        return bRate - aRate;
      })[0];
      const worstRate = worstDay.scheduled === 0 ? 0 : Math.round((worstDay.completed / worstDay.scheduled) * 100);
      const bestRate = bestDay.scheduled === 0 ? 0 : Math.round((bestDay.completed / bestDay.scheduled) * 100);
      if (worstDay.day !== bestDay.day) {
        insights.push({
          type: "toughest-day",
          title: `Your toughest day`,
          description: `You complete ${worstRate}% of habits on ${dayNames[worstDay.day]}s — your lowest. Plan ahead the night before to stay on track.`,
          icon: "📅",
          accent: "rose",
          data: { day: worstDay.day, rate: worstRate },
        });
        insights.push({
          type: "best-day",
          title: `Your strongest day`,
          description: `${dayNames[bestDay.day]}s are your best — ${bestRate}% completion. You've got great momentum to start the week!`,
          icon: "✨",
          accent: "emerald",
          data: { day: bestDay.day, rate: bestRate },
        });
      }
    }

    // ---- Consistency trend (last 7 days vs previous 7) ----
    const last7Start = new Date(today);
    last7Start.setDate(today.getDate() - 6);
    const prev7Start = new Date(today);
    prev7Start.setDate(today.getDate() - 13);
    const prev7End = new Date(today);
    prev7End.setDate(today.getDate() - 7);

    function countRange(start: Date, end: Date) {
      let scheduled = 0;
      let completed = 0;
      const iter = new Date(start);
      while (iter <= end) {
        for (const h of habits) {
          if (isHabitScheduled(h, iter)) {
            scheduled += 1;
            const ci = checkinByHabitDate.get(h.id)?.get(toDateString(iter));
            if (ci && ci >= h.targetCount) completed += 1;
          }
        }
        iter.setDate(iter.getDate() + 1);
      }
      return { scheduled, completed, rate: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100) };
    }
    const last7 = countRange(last7Start, today);
    const prev7 = countRange(prev7Start, prev7End);
    const trendDelta = last7.rate - prev7.rate;
    if (Math.abs(trendDelta) >= 5 || last7.scheduled > 0) {
      const direction = trendDelta > 0 ? "up" : trendDelta < 0 ? "down" : "steady";
      const desc =
        direction === "up"
          ? `You're trending up — ${last7.rate}% this week vs ${prev7.rate}% last week (+${trendDelta}). Keep the momentum going!`
          : direction === "down"
            ? `Completion dropped to ${last7.rate}% this week (vs ${prev7.rate}% last week, ${trendDelta}). A fresh week starts tomorrow — pick one habit to prioritize.`
            : `You're holding steady at ${last7.rate}% this week. Consistency is the key to lasting habits.`;
      insights.push({
        type: "trend",
        title: "Weekly trend",
        description: desc,
        icon: direction === "up" ? "📈" : direction === "down" ? "📉" : "➡️",
        accent: direction === "up" ? "emerald" : direction === "down" ? "rose" : "slate",
        data: { last7Rate: last7.rate, prev7Rate: prev7.rate, delta: trendDelta },
      });
    }

    // ---- Milestone stats ----
    const totalCheckins = allCheckins.length;
    const maxLongestStreak = Math.max(0, ...habits.map((h) => h.streak?.longestStreak ?? 0));
    const totalCurrentStreakDays = habits.reduce((s, h) => s + (h.streak?.currentStreak ?? 0), 0);

    if (totalCheckins > 0) {
      insights.push({
        type: "milestone",
        title: "Your journey so far",
        description: `You've logged ${totalCheckins} check-ins across ${habits.length} habits. Your longest streak is ${maxLongestStreak} days, and you're currently on ${totalCurrentStreakDays} active streak days total.`,
        icon: "🌟",
        accent: "emerald",
        data: { totalCheckins, maxLongestStreak, totalCurrentStreakDays, habitCount: habits.length },
      });
    }

    // ---- Recommendation: try a new habit if you have few ----
    if (habits.length < 3) {
      insights.push({
        type: "suggestion",
        title: "Build your routine",
        description: `You're tracking ${habits.length} habit${habits.length === 1 ? "" : "s"}. Try adding 1-2 more to build a well-rounded routine — check "Quick start" on the Habits page for templates.`,
        icon: "💡",
        accent: "emerald",
      });
    }

    return apiOk({
      hasData: true,
      insights,
      stats: {
        totalHabits: habits.length,
        totalCheckins,
        maxLongestStreak,
        totalCurrentStreakDays,
        bestHabit: best ? { name: best.name, rate: best.rate } : null,
        worstHabit: worst ? { name: worst.name, rate: worst.rate } : null,
      },
    });
  })();
}
