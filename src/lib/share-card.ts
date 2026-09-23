import { db } from "@/lib/db";
import { isHabitScheduled, toDateString } from "@/lib/streak";
import {
  computeCleanStreak,
  computeMoneySaved,
  computeTimeSaved,
} from "@/lib/bad-habits/compute";

/**
 * Share Card — server-side data layer.
 *
 * Used by:
 *   - /api/share-card/[userId]/route.ts  (public GET)
 *   - /share/[username]/page.tsx          (server component)
 *
 * Returns 404 when the user has `isShareCardPublic=false` (or doesn't exist).
 * The shape returned matches what `useShareCardData` produces on the client,
 * so the ShareCard component renders identically in either context.
 */

export interface ShareCardBadgeDto {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  target: number;
}

export interface ShareCardDataDto {
  displayName: string;
  tagline: string;
  avatarUrl: string;
  username: string;
  // Individual stat fields (matching the client-side ShareCardData interface)
  currentStreak: number;
  checkins: number;
  avgMood: number;
  hasMood: boolean;
  perfectDays: number;
  activeHabits: number;
  bestStreak: number;
  daysTracked: number;
  badges: ShareCardBadgeDto[];
  isPublic: boolean;
  shareUrl: string;
}

/* ============================================================================
   Achievement spec — duplicated from analytics-handlers.ts GET_achievements
============================================================================ */

interface ShareStats {
  totalHabits: number;
  totalCheckins: number;
  maxCurrentStreak: number;
  maxLongestStreak: number;
  perfectDays: number;
  totalActiveDays: number;
  maxBadHabitCleanStreak: number;
  maxMoneySaved: number;
  maxTimeReclaimedHours: number;
}

interface AchievementSpec {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  target: number;
  pred: (s: ShareStats) => boolean;
}

const ACHIEVEMENT_SPECS: AchievementSpec[] = [
  { id: "first-step", title: "First Step", description: "Complete your first check-in", icon: "🎯", color: "#10b981", target: 1, pred: (s) => s.totalCheckins >= 1 },
  { id: "habit-builder", title: "Habit Builder", description: "Create 3 habits", icon: "🌱", color: "#84cc16", target: 3, pred: (s) => s.totalHabits >= 3 },
  { id: "collector", title: "Collector", description: "Create 5 habits", icon: "📚", color: "#8b5cf6", target: 5, pred: (s) => s.totalHabits >= 5 },
  { id: "streak-3", title: "On a Roll", description: "Reach a 3-day streak", icon: "🔥", color: "#f59e0b", target: 3, pred: (s) => s.maxLongestStreak >= 3 },
  { id: "streak-7", title: "Week Warrior", description: "Reach a 7-day streak", icon: "⚡", color: "#ec4899", target: 7, pred: (s) => s.maxLongestStreak >= 7 },
  { id: "streak-30", title: "Unstoppable", description: "Reach a 30-day streak", icon: "💎", color: "#0ea5e9", target: 30, pred: (s) => s.maxLongestStreak >= 30 },
  { id: "streak-100", title: "Centurion", description: "Reach a 100-day streak", icon: "👑", color: "#f97316", target: 100, pred: (s) => s.maxLongestStreak >= 100 },
  { id: "perfect-day", title: "Perfect Day", description: "Complete all habits in a single day", icon: "✨", color: "#14b8a6", target: 1, pred: (s) => s.perfectDays >= 1 },
  { id: "perfect-week", title: "Flawless Week", description: "Have 5 perfect days", icon: "🌟", color: "#6366f1", target: 5, pred: (s) => s.perfectDays >= 5 },
  { id: "consistent", title: "Consistent", description: "Complete 50 check-ins total", icon: "🏅", color: "#ef4444", target: 50, pred: (s) => s.totalCheckins >= 50 },
  { id: "dedicated", title: "Dedicated", description: "Complete 200 check-ins total", icon: "🎖️", color: "#a855f7", target: 200, pred: (s) => s.totalCheckins >= 200 },
  { id: "master", title: "Habit Master", description: "Complete 500 check-ins total", icon: "🏆", color: "#eab308", target: 500, pred: (s) => s.totalCheckins >= 500 },
  { id: "first-day-clean", title: "First Day Clean", description: "Stay clean for 1 day on a bad habit", icon: "🚭", color: "#10b981", target: 1, pred: (s) => s.maxBadHabitCleanStreak >= 1 },
  { id: "week-strong", title: "One Week Strong", description: "Reach a 7-day clean streak", icon: "💪", color: "#14b8a6", target: 7, pred: (s) => s.maxBadHabitCleanStreak >= 7 },
  { id: "month-of-freedom", title: "Month of Freedom", description: "Reach a 30-day clean streak", icon: "🌿", color: "#0ea5e9", target: 30, pred: (s) => s.maxBadHabitCleanStreak >= 30 },
  { id: "quarter-of-freedom", title: "Quarter of Freedom", description: "Reach a 90-day clean streak", icon: "🎯", color: "#8b5cf6", target: 90, pred: (s) => s.maxBadHabitCleanStreak >= 90 },
  { id: "half-year-free", title: "Half a Year Free", description: "Reach a 180-day clean streak", icon: "✨", color: "#ec4899", target: 180, pred: (s) => s.maxBadHabitCleanStreak >= 180 },
  { id: "full-year-free", title: "Full Year Free", description: "Reach a 365-day clean streak", icon: "👑", color: "#f59e0b", target: 365, pred: (s) => s.maxBadHabitCleanStreak >= 365 },
  { id: "money-milestone-100", title: "Saver", description: "Save $100 on a bad habit", icon: "💰", color: "#84cc16", target: 100, pred: (s) => s.maxMoneySaved >= 100 },
  { id: "time-milestone-50", title: "Time Reclaimer", description: "Reclaim 50 hours on a bad habit", icon: "⏳", color: "#06b6d4", target: 50, pred: (s) => s.maxTimeReclaimedHours >= 50 },
];

function buildEarnedBadges(stats: ShareStats, max = 6): ShareCardBadgeDto[] {
  return ACHIEVEMENT_SPECS.filter((spec) => spec.pred(stats))
    .map((spec) => ({
      id: spec.id,
      title: spec.title,
      description: spec.description,
      icon: spec.icon,
      color: spec.color,
      target: spec.target,
    }))
    .sort((a, b) => {
      if (b.target !== a.target) return b.target - a.target;
      return a.id.localeCompare(b.id);
    })
    .slice(0, max);
}

async function computeShareStats(userId: string): Promise<{
  stats: ShareStats;
  hasMood: boolean;
  avgMood: number;
}> {
  const habits = await db.habit.findMany({
    where: { userId },
    include: { streak: true },
  });
  const activeHabits = habits.filter((h) => !h.isArchived);
  const allCheckins = await db.checkin.findMany({
    where: { habit: { userId, isArchived: false } },
    select: { date: true, count: true, habitId: true },
  });

  const totalHabits = activeHabits.length;
  const totalCheckins = allCheckins.length;
  const maxCurrentStreak = Math.max(0, ...habits.map((h) => h.streak?.currentStreak ?? 0));
  const maxLongestStreak = Math.max(0, ...habits.map((h) => h.streak?.longestStreak ?? 0));
  const totalActiveDays = new Set(allCheckins.map((c) => c.date)).size;

  // Perfect days
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayMap = new Map<string, { scheduled: number; completed: number }>();
  for (const h of habits) {
    if (h.isArchived) continue;
    const iter = new Date(h.startDate);
    const iterOnly = new Date(iter.getFullYear(), iter.getMonth(), iter.getDate());
    while (iterOnly <= todayOnly) {
      if (isHabitScheduled(h, iterOnly)) {
        const ds = toDateString(iterOnly);
        if (!dayMap.has(ds)) dayMap.set(ds, { scheduled: 0, completed: 0 });
        const entry = dayMap.get(ds)!;
        entry.scheduled += 1;
        const ci = allCheckins.find((c) => c.habitId === h.id && c.date === ds);
        if (ci && ci.count >= h.targetCount) entry.completed += 1;
      }
      iterOnly.setDate(iterOnly.getDate() + 1);
    }
  }
  const perfectDays = Array.from(dayMap.values()).filter(
    (d) => d.scheduled > 0 && d.completed === d.scheduled,
  ).length;

  // Bad-habit milestones
  const badHabits = await db.badHabit.findMany({
    where: { userId, isArchived: false },
    include: {
      slips: { select: { id: true, date: true, trigger: true, note: true }, orderBy: { date: "asc" } },
    },
  });
  const now = new Date();
  const maxBadHabitCleanStreak = Math.max(0, ...badHabits.map((bh) => computeCleanStreak({
    id: bh.id, name: bh.name, icon: bh.icon, color: bh.color, quitDate: bh.quitDate,
    costPerDay: bh.costPerDay, currency: bh.currency, minutesPerDay: bh.minutesPerDay, isArchived: bh.isArchived,
  }, bh.slips, now)));
  const maxMoneySaved = Math.max(0, ...badHabits.map((bh) => {
    const m = computeMoneySaved({
      id: bh.id, name: bh.name, icon: bh.icon, color: bh.color, quitDate: bh.quitDate,
      costPerDay: bh.costPerDay, currency: bh.currency, minutesPerDay: bh.minutesPerDay, isArchived: bh.isArchived,
    }, bh.slips, now);
    return m ? m.amount : 0;
  }));
  const maxTimeReclaimedHours = Math.max(0, ...badHabits.map((bh) => {
    const t = computeTimeSaved({
      id: bh.id, name: bh.name, icon: bh.icon, color: bh.color, quitDate: bh.quitDate,
      costPerDay: bh.costPerDay, currency: bh.currency, minutesPerDay: bh.minutesPerDay, isArchived: bh.isArchived,
    }, bh.slips, now);
    return t ? t.hours : 0;
  }));

  // Mood (last 30 days)
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  const fromStr = toDateString(from);
  const toStr = toDateString(to);
  const moods = await db.moodEntry.findMany({
    where: { userId, date: { gte: fromStr, lte: toStr } },
    select: { score: true },
  });
  const hasMood = moods.length > 0;
  const avgMood = hasMood
    ? moods.reduce((s, m) => s + (m.score || 0), 0) / moods.length
    : 0;

  return {
    stats: {
      totalHabits,
      totalCheckins,
      maxCurrentStreak,
      maxLongestStreak,
      perfectDays,
      totalActiveDays,
      maxBadHabitCleanStreak,
      maxMoneySaved,
      maxTimeReclaimedHours,
    },
    hasMood,
    avgMood,
  };
}

export async function getShareCardData(identifier: string): Promise<ShareCardDataDto | null> {
  if (!identifier) return null;

  let user = await db.user.findUnique({ where: { id: identifier } });
  if (!user) {
    user = await db.user.findFirst({
      where: { username: identifier, NOT: { username: "" } },
    });
  }
  if (!user || !user.isShareCardPublic) return null;

  const { stats, hasMood, avgMood } = await computeShareStats(user.id);

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.name ||
    "HabitBuilder";

  const tagline = user.tagline || "";
  const avatarUrl = user.avatarUrl || "";
  const username = user.username || user.id;

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://habitflow.app";
  const shareUrl = `${appUrl}/share/${username}`;

  return {
    displayName,
    tagline,
    avatarUrl,
    username,
    currentStreak: stats.maxCurrentStreak,
    checkins: stats.totalCheckins,
    avgMood,
    hasMood,
    perfectDays: stats.perfectDays,
    activeHabits: stats.totalHabits,
    bestStreak: stats.maxLongestStreak,
    daysTracked: stats.totalActiveDays,
    badges: buildEarnedBadges(stats),
    isPublic: user.isShareCardPublic,
    shareUrl,
  };
}
