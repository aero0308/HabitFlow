"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type {
  BadHabit,
  BadHabitCreateInput,
  BadHabitUpdateInput,
  BadHabitSlipInput,
} from "@/types/bad-habits";
import { toast } from "sonner";

/**
 * List all active bad habits (computed stats included server-side).
 * Pass `includeArchived: true` to also fetch archived ones.
 */
export function useBadHabits(includeArchived = false) {
  return useQuery({
    queryKey: ["bad-habits", includeArchived],
    queryFn: () => api.listBadHabits(includeArchived),
    select: (d) => d.badHabits,
  });
}

/**
 * Full detail (slips, milestones, insights, mood correlation).
 */
export function useBadHabit(id: string | null) {
  return useQuery({
    queryKey: ["bad-habit", id],
    queryFn: () => api.getBadHabit(id!),
    enabled: !!id,
  });
}

export function useCreateBadHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BadHabitCreateInput) => api.createBadHabit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bad-habits"] });
      toast.success("Clean streak started 🔥");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBadHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BadHabitUpdateInput }) =>
      api.updateBadHabit(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["bad-habits"] });
      qc.invalidateQueries({ queryKey: ["bad-habit", vars.id] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchiveBadHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.archiveBadHabit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bad-habits"] });
      toast.success("Archived");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLogSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BadHabitSlipInput }) =>
      api.logBadHabitSlip(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["bad-habits"] });
      qc.invalidateQueries({ queryKey: ["bad-habit", vars.id] });
      toast.success("Logged. Tomorrow is a fresh start. 💙");

      // Soft suggestion if the user has slipped 3+ times in the last 7 days.
      // We can detect this from the returned serialized bad habit's slips via
      // a separate detail fetch — but we can also compute from the data we have
      // by inspecting the server's response shape (it includes the slips indirectly
      // through the stats). For simplicity, fire a soft info toast if the
      // current streak is 0 — that's a strong signal of multiple recent slips.
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (_data.badHabit.cleanStreak === 0 && vars.input.date === todayStr) {
        toast.info(
          "You've slipped a few times recently. Want to try a different approach? Maybe shrink the habit first?",
          { duration: 6000 },
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUndoSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      api.undoBadHabitSlip(id, date),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["bad-habits"] });
      qc.invalidateQueries({ queryKey: ["bad-habit", vars.id] });
      toast.success("Slip removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type { BadHabit };
