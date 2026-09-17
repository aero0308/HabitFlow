"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { MoodEntry, MoodInsights } from "@/types/mood";
import { toast } from "sonner";

export function useMoods(from?: string, to?: string) {
  return useQuery({
    queryKey: ["moods", from, to],
    queryFn: () => api.listMoods(from, to),
    select: (d) => d.moods,
  });
}

export function useMoodToday() {
  return useQuery({
    queryKey: ["moods", "today"],
    queryFn: () => api.getMoodToday(),
    select: (d) => d.mood,
  });
}

export function useMoodInsights() {
  return useQuery({
    queryKey: ["moods", "insights"],
    queryFn: () => api.getMoodInsights(),
  });
}

export function useSaveMood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; score: number; note?: string; tags?: string[] }) =>
      api.saveMood(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moods"] });
      toast.success("Mood logged ✓");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteMood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMood(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moods"] });
      toast("Mood entry deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
