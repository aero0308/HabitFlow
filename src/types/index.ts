// Shared TS types matching backend API responses.

export interface User {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  timezone: string;
  emailRemindersEnabled: boolean;
  browserRemindersEnabled: boolean;
  reminderTime: string;
  daypartMorningStart: string;
  daypartAfternoonStart: string;
  daypartEveningStart: string;
  tagline: string;
  isShareCardPublic: boolean;
  shareCardLastUpdated: string | null;
  username: string;
}

export type Frequency = "daily" | "weekly" | "custom";
export type TimeOfDay = "ANY_TIME" | "MORNING" | "AFTERNOON" | "EVENING";

export interface Habit {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  frequency: Frequency;
  customDays: number[]; // 0=Mon..6=Sun
  targetCount: number;
  startDate: string; // YYYY-MM-DD
  position: number;
  isArchived: boolean;
  category: string;
  timeOfDay: TimeOfDay;
  createdAt: string;
  updatedAt: string;
  streak: {
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
    lastCompletedDate: string | null;
  } | null;
}

export interface Checkin {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  count: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  date: string;
  scheduledToday: number;
  completedToday: number;
  completionPct: number;
  totalProgress: number;
  totalTarget: number;
  todaysHabits: TodayHabit[];
  streaks: StreakLeaderboardEntry[];
  totalHabits: number;
}

export interface TodayHabit {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  frequency: Frequency;
  customDays: number[];
  targetCount: number;
  count: number;
  completed: boolean;
  frozen: boolean;
  note: string;
  category: string;
  timeOfDay: TimeOfDay;
  streak: { current: number; longest: number };
}

export interface StreakLeaderboardEntry {
  habitId: string;
  name: string;
  color: string;
  icon: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
}

export interface CalendarDay {
  date: string;
  completed: number;
  scheduled: number;
  ratio: number;
  habits: {
    habitId: string;
    name: string;
    color: string;
    icon: string;
    count: number;
    targetCount: number;
    completed: boolean;
  }[];
}

export interface CalendarResponse {
  month: string;
  days: CalendarDay[];
}

export interface CompletionResponse {
  days: number;
  weekly: { weekStart: string; completed: number; scheduled: number; pct: number }[];
  perHabit: {
    habitId: string;
    name: string;
    color: string;
    icon: string;
    scheduled: number;
    completed: number;
    rate: number;
  }[];
  dayOfWeek: { day: number; completed: number; scheduled: number; pct: number }[];
}

export interface StreakInfo {
  habitId: string;
  name: string;
  color: string;
  icon: string;
  frequency: Frequency;
  targetCount: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate: number;
}

export interface HabitDetail {
  habit: {
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    frequency: Frequency;
    customDays: number[];
    targetCount: number;
    startDate: string;
    position: number;
    isArchived: boolean;
    category: string;
    timeOfDay: TimeOfDay;
  };
  streak: {
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
    completionRate: number;
  };
  calendar: {
    date: string;
    scheduled: boolean;
    count: number;
    targetCount: number;
    completed: boolean;
  }[];
  weekly: { weekStart: string; completed: number; scheduled: number; pct: number }[];
  dayOfWeek: { day: number; completed: number; scheduled: number; pct: number }[];
  recentCheckins: { id: string; date: string; count: number; note: string }[];
}

export interface ApiError {
  detail: string;
  code?: string;
}

export interface WeeklySummary {
  thisWeek: { scheduled: number; completed: number; pct: number };
  lastWeek: { scheduled: number; completed: number; pct: number };
  delta: number;
  days: { date: string; label: string; scheduled: number; completed: number; pct: number; isToday: boolean }[];
  weekStart: string;
  weekEnd: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  progress: number;
  target: number;
  color: string;
}

export interface AchievementsResponse {
  achievements: Achievement[];
  earnedCount: number;
  totalCount: number;
  stats: {
    totalHabits: number;
    totalCheckins: number;
    maxCurrentStreak: number;
    maxLongestStreak: number;
    perfectDays: number;
    maxTotalCompletions: number;
    totalActiveDays: number;
  };
}

export interface HistoryItem {
  id: string;
  habitId: string;
  habitName: string;
  habitIcon: string;
  habitColor: string;
  date: string;
  count: number;
  targetCount: number;
  completed: boolean;
  note: string;
  createdAt: string;
}

export interface HabitFreeze {
  id: string;
  habitId: string;
  date: string;
  createdAt: string;
}

export interface OffMode {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: string;
}

export interface HabitSearchResult {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  timeOfDay: TimeOfDay;
  currentStreak: number;
}

export interface WeeklyReview {
  weekStart: string;
  today: string;
  totalScheduled: number;
  totalCompleted: number;
  overallPct: number;
  habitStats: {
    habitId: string;
    name: string;
    icon: string;
    color: string;
    category: string;
    scheduled: number;
    completed: number;
    rate: number;
    currentStreak: number;
  }[];
  best: {
    habitId: string;
    name: string;
    icon: string;
    color: string;
    rate: number;
    completed: number;
    scheduled: number;
  } | null;
  worst: {
    habitId: string;
    name: string;
    icon: string;
    color: string;
    rate: number;
    completed: number;
    scheduled: number;
  } | null;
  weekNotes: {
    habitId: string;
    habitName: string;
    habitIcon: string;
    date: string;
    note: string;
  }[];
  totalCurrentStreakDays: number;
  maxCurrentStreak: number;
  totalHabits: number;
}

export interface YearlyHeatmapDay {
  date: string;
  completed: number;
  scheduled: number;
  ratio: number;
}

export interface YearlyHeatmap {
  start: string;
  end: string;
  days: YearlyHeatmapDay[];
  monthly: { month: string; completed: number; scheduled: number; rate: number }[];
  stats: {
    totalCompleted: number;
    totalScheduled: number;
    overallRate: number;
    activeDays: number;
    perfectDays: number;
    totalDays: number;
  };
}

export interface YearComparison {
  thisYear: number;
  lastYear: number;
  thisYearStats: {
    totalCompleted: number;
    totalScheduled: number;
    overallRate: number;
    activeDays: number;
    perfectDays: number;
    totalDays: number;
    monthly: { month: string; completed: number; scheduled: number; rate: number }[];
  };
  lastYearStats: {
    totalCompleted: number;
    totalScheduled: number;
    overallRate: number;
    activeDays: number;
    perfectDays: number;
    totalDays: number;
    monthly: { month: string; completed: number; scheduled: number; rate: number }[];
  };
  deltas: {
    totalCompleted: number;
    overallRate: number;
    activeDays: number;
    perfectDays: number;
  };
}

export interface Insight {
  type: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  data?: Record<string, unknown>;
}

export interface InsightsResponse {
  hasData: boolean;
  insights: Insight[];
  stats: {
    totalHabits: number;
    totalCheckins: number;
    maxLongestStreak: number;
    totalCurrentStreakDays: number;
    bestHabit: { name: string; rate: number } | null;
    worstHabit: { name: string; rate: number } | null;
  };
}
