"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PomodoroMode = "focus" | "short" | "long";

export const POMODORO_PRESETS: Record<PomodoroMode, number> = {
  focus: 50 * 60, // 50 minutes
  short: 5 * 60, // 5 minutes
  long: 10 * 60, // 10 minutes
};

export const POMODORO_LABELS: Record<PomodoroMode, string> = {
  focus: "Focus",
  short: "Short",
  long: "Long",
};

interface PomodoroState {
  mode: PomodoroMode;
  /** Seconds remaining in the current session */
  remaining: number;
  /** Whether the timer is actively counting down */
  isRunning: boolean;
  /** Optional habit ID to auto-check-in on completion */
  linkedHabitId: string | null;
  /** Timestamp (ms) of the last tick — used to compute elapsed time across re-renders */
  lastTick: number | null;

  setMode: (mode: PomodoroMode) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  setLinkedHabit: (habitId: string | null) => void;
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      mode: "focus",
      remaining: POMODORO_PRESETS.focus,
      isRunning: false,
      linkedHabitId: null,
      lastTick: null,

      setMode: (mode) =>
        set({
          mode,
          remaining: POMODORO_PRESETS[mode],
          isRunning: false,
          lastTick: null,
        }),

      start: () => set({ isRunning: true, lastTick: Date.now() }),

      pause: () => set({ isRunning: false, lastTick: null }),

      reset: () =>
        set({
          remaining: POMODORO_PRESETS[get().mode],
          isRunning: false,
          lastTick: null,
        }),

      tick: () => {
        const { isRunning, remaining, lastTick } = get();
        if (!isRunning || remaining <= 0) return;
        const now = Date.now();
        const elapsed = lastTick ? Math.floor((now - lastTick) / 1000) : 1;
        const next = Math.max(0, remaining - elapsed);
        set({ remaining: next, lastTick: next > 0 ? now : null });
        if (next === 0) {
          set({ isRunning: false });
        }
      },

      setLinkedHabit: (habitId) => set({ linkedHabitId: habitId }),
    }),
    {
      name: "habitflow-pomodoro",
      // Only persist mode + linkedHabitId, not the running timer state
      partialize: (state) => ({
        mode: state.mode,
        linkedHabitId: state.linkedHabitId,
      }),
    },
  ),
);
