"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useCalendar(month?: string, habitId?: string) {
  return useQuery({
    queryKey: ["calendar", month, habitId],
    queryFn: () => api.calendar(month, habitId),
  });
}

export function useCompletion(days = 90) {
  return useQuery({
    queryKey: ["analytics", "completion", days],
    queryFn: () => api.completion(days),
  });
}

export function useStreaks() {
  return useQuery({
    queryKey: ["analytics", "streaks"],
    queryFn: () => api.streaks(),
    select: (d) => d.streaks,
  });
}

export function useHabitDetail(id: string | null) {
  return useQuery({
    queryKey: ["habit-detail", id],
    queryFn: () => api.habitDetail(id!),
    enabled: !!id,
  });
}

export function useWeeklySummary() {
  return useQuery({
    queryKey: ["analytics", "weekly-summary"],
    queryFn: () => api.weeklySummary(),
  });
}

export function useWeeklyReview() {
  return useQuery({
    queryKey: ["analytics", "weekly-review"],
    queryFn: () => api.weeklyReview(),
  });
}

export function useYearlyHeatmap(year?: string, habitId?: string) {
  return useQuery({
    queryKey: ["analytics", "yearly-heatmap", year, habitId],
    queryFn: () => api.yearlyHeatmap(year, habitId),
  });
}

export function useYearComparison() {
  return useQuery({
    queryKey: ["analytics", "year-comparison"],
    queryFn: () => api.yearComparison(),
  });
}

export function useInsights() {
  return useQuery({
    queryKey: ["analytics", "insights"],
    queryFn: () => api.insights(),
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: ["analytics", "achievements"],
    queryFn: () => api.achievements(),
  });
}

export function useHistory(limit = 50, habitId?: string) {
  return useQuery({
    queryKey: ["analytics", "history", limit, habitId],
    queryFn: () => api.history(limit, habitId),
  });
}
