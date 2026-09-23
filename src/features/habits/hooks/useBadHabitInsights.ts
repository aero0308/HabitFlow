"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

/**
 * Fetch the focused insights payload for a single bad habit.
 * (triggerFrequency, dayOfWeekPattern, cleanDaysPct, moodCorrelation)
 */
export function useBadHabitInsights(id: string | null) {
  return useQuery({
    queryKey: ["bad-habit-insights", id],
    queryFn: () => api.getBadHabitInsights(id!),
    enabled: !!id,
    select: (d) => d.insights,
  });
}
