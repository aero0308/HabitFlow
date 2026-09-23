"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type HabitCreateInput } from "@/api/client";
import type { Habit } from "@/types";
import { toast } from "sonner";

export function useHabits(includeArchived = false, category?: string) {
  return useQuery({
    queryKey: ["habits", includeArchived, category],
    queryFn: () => api.listHabits(includeArchived, category),
    select: (d) => d.habits,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["habits", "categories"],
    queryFn: () => api.listCategories(),
    select: (d) => d.categories,
  });
}

export function useHabit(id: string | null) {
  return useQuery({
    queryKey: ["habits", id],
    queryFn: () => api.getHabit(id!),
    enabled: !!id,
    select: (d) => d.habit,
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HabitCreateInput) => api.createHabit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Habit created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useInstallStarterPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (habits: Partial<HabitCreateInput>[]) => api.batchCreateHabits(habits),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      const n = data.habits?.length ?? 0;
      toast.success(`Installed ${n} habit${n === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<HabitCreateInput> }) =>
      api.updateHabit(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habits", vars.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["habit-detail", vars.id] });
      toast.success("Habit updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteHabit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Habit deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchiveHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.archiveHabit(id, archived),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Habit updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderHabits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderHabits(orderedIds),
    onMutate: async (orderedIds: string[]) => {
      await qc.cancelQueries({ queryKey: ["habits", false] });
      const prev = qc.getQueryData<{ habits: Habit[] }>(["habits", false]);
      if (prev) {
        const map = new Map(prev.habits.map((h) => [h.id, h]));
        const reordered = orderedIds
          .map((id, idx) => {
            const h = map.get(id);
            return h ? { ...h, position: idx } : null;
          })
          .filter((x): x is Habit => x !== null);
        qc.setQueryData(["habits", false], { habits: reordered });
      }
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["habits", false], ctx.prev);
      toast.error("Could not reorder");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useFreezeDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) =>
      api.freezeDay(habitId, date),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["habit-detail", vars.habitId] });
      toast.success("Day frozen", { description: "Your streak is protected." });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnfreezeDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) =>
      api.unfreezeDay(habitId, date),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["habit-detail", vars.habitId] });
      toast("Freeze removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useFreezes(habitId: string | null) {
  return useQuery({
    queryKey: ["freezes", habitId],
    queryFn: () => api.listFreezes(habitId!),
    enabled: !!habitId,
    select: (d) => d.freezes,
  });
}
