"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { toast } from "sonner";
import type { DashboardData } from "@/types";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard(),
  });
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, date, count, note }: { habitId: string; date: string; count?: number; note?: string }) =>
      api.checkin(habitId, { date, count, note }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["dashboard"] });
      const prev = qc.getQueryData<DashboardData>(["dashboard"]);
      if (prev) {
        const updated: DashboardData = {
          ...prev,
          todaysHabits: prev.todaysHabits.map((h) =>
            h.id === vars.habitId
              ? {
                  ...h,
                  count: vars.count ?? h.targetCount,
                  completed: (vars.count ?? h.targetCount) >= h.targetCount,
                }
              : h,
          ),
        };
        updated.completedToday = updated.todaysHabits.filter((h) => h.completed).length;
        updated.totalProgress = updated.todaysHabits.reduce(
          (s, h) => s + Math.min(h.count, h.targetCount),
          0,
        );
        updated.totalTarget = updated.todaysHabits.reduce((s, h) => s + h.targetCount, 0);
        updated.completionPct =
          updated.scheduledToday === 0 ? 0 : Math.round((updated.completedToday / updated.scheduledToday) * 100);
        qc.setQueryData(["dashboard"], updated);
      }
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboard"], ctx.prev);
      toast.error("Check-in failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["habit-detail"] });
    },
  });
}

export function useUncheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) =>
      api.deleteCheckin(habitId, date),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["dashboard"] });
      const prev = qc.getQueryData<DashboardData>(["dashboard"]);
      if (prev && vars.date === todayStr()) {
        const updated: DashboardData = {
          ...prev,
          todaysHabits: prev.todaysHabits.map((h) =>
            h.id === vars.habitId ? { ...h, count: 0, completed: false, note: "" } : h,
          ),
        };
        updated.completedToday = updated.todaysHabits.filter((h) => h.completed).length;
        updated.totalProgress = updated.todaysHabits.reduce(
          (s, h) => s + Math.min(h.count, h.targetCount),
          0,
        );
        updated.completionPct =
          updated.scheduledToday === 0 ? 0 : Math.round((updated.completedToday / updated.scheduledToday) * 100);
        qc.setQueryData(["dashboard"], updated);
      }
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboard"], ctx.prev);
      toast.error("Undo failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["habit-detail"] });
    },
  });
}

export function useCheckins(habitId: string | null, from?: string, to?: string) {
  return useQuery({
    queryKey: ["checkins", habitId, from, to],
    queryFn: () => api.listCheckins(habitId!, from, to),
    enabled: !!habitId,
    select: (d) => d.checkins,
  });
}
