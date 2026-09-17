import type {
  User,
  Habit,
  Checkin,
  DashboardData,
  CalendarResponse,
  CompletionResponse,
  StreakInfo,
  HabitDetail,
  WeeklySummary,
  WeeklyReview,
  YearlyHeatmap,
  YearComparison,
  InsightsResponse,
  AchievementsResponse,
  HistoryItem,
  HabitFreeze,
  OffMode,
  HabitSearchResult,
} from "@/types";
import type { MoodEntry, MoodInsights } from "@/types/mood";

// Lightweight fetch wrapper. Uses credentials: "include" so httpOnly
// auth cookies are sent with every request.
const BASE = "/api";

export class ApiRequestError extends Error {
  code?: string;
  status: number;
  constructor(detail: string, status: number, code?: string) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Browser-Timezone": typeof Intl !== "undefined" ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "") : "",
      ...(options.headers || {}),
    },
    credentials: "include",
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new ApiRequestError(detail, res.status, data?.code);
  }
  return data as T;
}

export const api = {
  // ---- auth ----
  register: (body: { email: string; password: string; name: string }) =>
    request<{ user: User; access: string; refresh: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string; remember?: boolean }) =>
    request<{ user: User; access: string; refresh: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),

  // ---- habits ----
  listHabits: (includeArchived = false, category?: string) => {
    const params = new URLSearchParams();
    if (includeArchived) params.set("include_archived", "true");
    if (category) params.set("category", category);
    const q = params.toString();
    return request<{ habits: Habit[] }>(`/habits${q ? `?${q}` : ""}`);
  },
  listCategories: () => request<{ categories: string[] }>("/habits/categories"),
  createHabit: (body: Partial<HabitCreateInput>) =>
    request<{ habit: Habit }>("/habits", { method: "POST", body: JSON.stringify(body) }),
  batchCreateHabits: (habits: Partial<HabitCreateInput>[]) =>
    request<{ habits: Habit[] }>("/habits/batch", {
      method: "POST",
      body: JSON.stringify({ habits }),
    }),
  getHabit: (id: string) => request<{ habit: Habit }>(`/habits/${id}`),
  updateHabit: (id: string, body: Partial<HabitCreateInput>) =>
    request<{ habit: Habit }>(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteHabit: (id: string) => request<{ ok: true }>(`/habits/${id}`, { method: "DELETE" }),
  archiveHabit: (id: string, archived: boolean) =>
    request<{ habit: Habit }>(`/habits/${id}/archive`, {
      method: "POST",
      body: JSON.stringify({ archived }),
    }),
  reorderHabits: (orderedIds: string[]) =>
    request<{ ok: true }>("/habits/reorder", {
      method: "POST",
      body: JSON.stringify({ ordered_ids: orderedIds }),
    }),
  batchCreateHabits: (habits: HabitCreateInput[]) =>
    request<{ habits: Habit[] }>("/habits/batch", {
      method: "POST",
      body: JSON.stringify({ habits }),
    }),

  // ---- freezes ----
  freezeDay: (habitId: string, date: string) =>
    request<{ freeze: HabitFreeze; alreadyFrozen: boolean }>(`/habits/${habitId}/freeze`, {
      method: "POST",
      body: JSON.stringify({ date }),
    }),
  unfreezeDay: (habitId: string, date: string) =>
    request<{ ok: true }>(`/habits/${habitId}/freeze/${date}`, { method: "DELETE" }),
  listFreezes: (habitId: string) =>
    request<{ freezes: HabitFreeze[] }>(`/habits/${habitId}/freeze`),

  // ---- checkins ----
  checkin: (habitId: string, body: { date: string; count?: number; note?: string }) =>
    request<{ checkin: Checkin; streak: Habit["streak"] }>(`/habits/${habitId}/checkins`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteCheckin: (habitId: string, date: string) =>
    request<{ ok: true }>(`/habits/${habitId}/checkins/${date}`, { method: "DELETE" }),
  listCheckins: (habitId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const q = params.toString();
    return request<{ checkins: Checkin[] }>(`/habits/${habitId}/checkins${q ? `?${q}` : ""}`);
  },

  // ---- analytics ----
  dashboard: () => request<DashboardData>("/analytics/dashboard"),
  calendar: (month?: string, habitId?: string) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (habitId) params.set("habit_id", habitId);
    const q = params.toString();
    return request<CalendarResponse>(`/analytics/calendar${q ? `?${q}` : ""}`);
  },
  completion: (days = 90) => request<CompletionResponse>(`/analytics/completion?days=${days}`),
  streaks: () => request<{ streaks: StreakInfo[] }>("/analytics/streaks"),
  habitDetail: (id: string) => request<HabitDetail>(`/analytics/habit/${id}`),
  weeklySummary: () => request<WeeklySummary>("/analytics/weekly-summary"),
  weeklyReview: () => request<WeeklyReview>("/analytics/weekly-review"),
  yearlyHeatmap: (year?: string, habitId?: string) => {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (habitId) params.set("habit_id", habitId);
    const q = params.toString();
    return request<YearlyHeatmap>(`/analytics/yearly-heatmap${q ? `?${q}` : ""}`);
  },
  yearComparison: () => request<YearComparison>("/analytics/year-comparison"),
  insights: () => request<InsightsResponse>("/analytics/insights"),
  achievements: () => request<AchievementsResponse>("/analytics/achievements"),
  history: (limit = 50, habitId?: string) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (habitId) params.set("habit_id", habitId);
    return request<{ items: HistoryItem[]; total: number }>(`/analytics/history?${params.toString()}`);
  },

  // ---- moods ----
  listMoods: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const q = params.toString();
    return request<{ moods: MoodEntry[] }>(`/moods${q ? `?${q}` : ""}`);
  },
  getMoodToday: () => request<{ mood: MoodEntry | null }>("/moods/today"),
  getMoodInsights: () => request<MoodInsights>("/moods/insights"),
  saveMood: (body: { date: string; score: number; note?: string; tags?: string[] }) =>
    request<{ mood: MoodEntry }>("/moods", { method: "POST", body: JSON.stringify(body) }),
  deleteMood: (id: string) => request<{ ok: true }>(`/moods/${id}`, { method: "DELETE" }),

  // ---- settings ----
  getSettings: () => request<User>("/settings"),
  updateSettings: (body: Partial<Pick<User, "name" | "firstName" | "lastName" | "timezone" | "emailRemindersEnabled" | "browserRemindersEnabled" | "reminderTime" | "avatarUrl" | "daypartMorningStart" | "daypartAfternoonStart" | "daypartEveningStart">>) =>
    request<User>("/settings", { method: "PATCH", body: JSON.stringify(body) }),

  // ---- user danger zone ----
  deleteAccount: () => request<{ ok: true }>("/user/account", { method: "DELETE" }),
  deleteAllData: () => request<{ ok: true }>("/user/data", { method: "DELETE" }),
  resetHabitData: () => request<{ ok: true }>("/user/reset-habit-data", { method: "POST" }),

  // ---- dayparts ----
  getDayparts: () => request<{ morningStart: string; afternoonStart: string; eveningStart: string }>("/user/dayparts"),
  updateDayparts: (body: Partial<{ morningStart: string; afternoonStart: string; eveningStart: string }>) =>
    request<{ morningStart: string; afternoonStart: string; eveningStart: string }>("/user/dayparts", { method: "PATCH", body: JSON.stringify(body) }),

  // ---- off modes ----
  listOffModes: () => request<{ offModes: OffMode[] }>("/off-modes"),
  createOffMode: (body: { startDate: string; endDate: string; reason?: string }) =>
    request<{ offMode: OffMode }>("/off-modes", { method: "POST", body: JSON.stringify(body) }),
  deleteOffMode: (id: string) => request<{ ok: true }>(`/off-modes/${id}`, { method: "DELETE" }),

  // ---- habit search ----
  searchHabits: (q: string) => request<{ habits: HabitSearchResult[] }>(`/habits/search?q=${encodeURIComponent(q)}`),

  // ---- test reminder (dev: logs to console, prod: sends via Resend) ----
  sendTestReminder: () =>
    request<{ ok: true; mode: string; preview?: string; summary?: { email: string; overallPct: number; totalCompleted: number; totalScheduled: number } }>("/cron/test-reminder", {
      method: "POST",
    }),
};

export interface HabitCreateInput {
  name: string;
  description?: string;
  color: string;
  icon: string;
  frequency: "daily" | "weekly" | "custom";
  customDays: number[];
  targetCount: number;
  startDate: string;
  category?: string;
  timeOfDay?: "ANY_TIME" | "MORNING" | "AFTERNOON" | "EVENING";
}
