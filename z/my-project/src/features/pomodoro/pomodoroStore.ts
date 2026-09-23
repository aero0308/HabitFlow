"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PomodoroMode = "focus" | "short" | "long";
export type PomodoroStatus = "idle" | "running" | "paused";

export interface PomodoroSettings {
  focusMin: number;
  shortMin: number;
  longMin: number;
  longEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  vibrationEnabled: boolean;
  musicWhileFocusing: boolean;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  notificationEnabled: false,
  vibrationEnabled: false,
  musicWhileFocusing: false,
};

function durationForMode(mode: PomodoroMode, s: PomodoroSettings): number {
  if (mode === "focus") return s.focusMin * 60;
  if (mode === "short") return s.shortMin * 60;
  return s.longMin * 60;
}

export const POMODORO_LABELS: Record<PomodoroMode, string> = {
  focus: "Focus",
  short: "Short Break",
  long: "Long Break",
};

interface PomodoroState {
  mode: PomodoroMode;
  status: PomodoroStatus;
  secondsRemaining: number;
  sessionCount: number;
  cyclePosition: number;
  settings: PomodoroSettings;
  endTime: number | null;
  /** Guard to prevent double-completeSession calls from multiple tick hooks */
  completionPending: boolean;

  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skip: () => void;
  tick: () => void;
  setMode: (mode: PomodoroMode) => void;
  updateSettings: (partial: Partial<PomodoroSettings>) => void;
  completeSession: () => void;
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      mode: "focus",
      status: "idle",
      secondsRemaining: DEFAULT_SETTINGS.focusMin * 60,
      sessionCount: 0,
      cyclePosition: 0,
      settings: DEFAULT_SETTINGS,
      endTime: null,
      completionPending: false,

      start: () => {
        const { secondsRemaining } = get();
        set({
          status: "running",
          endTime: Date.now() + secondsRemaining * 1000,
          completionPending: false,
        });
      },

      pause: () => {
        set({ status: "paused", endTime: null });
      },

      resume: () => {
        const { secondsRemaining } = get();
        set({
          status: "running",
          endTime: Date.now() + secondsRemaining * 1000,
          completionPending: false,
        });
      },

      reset: () => {
        const { settings } = get();
        set({
          mode: "focus",
          secondsRemaining: durationForMode("focus", settings),
          status: "idle",
          endTime: null,
          sessionCount: 0,
          cyclePosition: 0,
          completionPending: false,
        });
      },

      skip: () => {
        const state = get();
        let newSessionCount = state.sessionCount;
        let newCyclePos = state.cyclePosition;

        if (state.mode === "focus") {
          newSessionCount++;
          newCyclePos++;
        }

        const nextMode = state.mode === "focus"
          ? (newCyclePos >= state.settings.longEvery ? "long" : "short")
          : "focus";

        if (state.mode === "long") {
          newCyclePos = 0;
        }
        if (nextMode === "focus" && newCyclePos >= state.settings.longEvery) {
          newCyclePos = 0;
        }

        set({
          mode: nextMode,
          sessionCount: newSessionCount,
          cyclePosition: newCyclePos,
          secondsRemaining: durationForMode(nextMode, state.settings),
          status: "idle",
          endTime: null,
          completionPending: false,
        });
      },

      tick: () => {
        const { status, endTime, completionPending } = get();
        if (status !== "running" || !endTime) return;
        const now = Date.now();
        const remainingMs = endTime - now;
        const next = Math.max(0, Math.ceil(remainingMs / 1000));
        if (next === 0) {
          // Set completion pending flag — prevents double-completeSession calls
          set({ secondsRemaining: 0, status: "idle", endTime: null, completionPending: true });
        } else {
          set({ secondsRemaining: next });
        }
      },

      setMode: (mode) => {
        const { settings } = get();
        set({
          mode,
          secondsRemaining: durationForMode(mode, settings),
          status: "idle",
          endTime: null,
          completionPending: false,
        });
      },

      updateSettings: (partial) => {
        const state = get();
        const newSettings = { ...state.settings, ...partial };
        const newDuration = durationForMode(state.mode, newSettings);

        if (state.status === "running") {
          set({
            settings: newSettings,
            secondsRemaining: newDuration,
            endTime: Date.now() + newDuration * 1000,
          });
        } else {
          set({
            settings: newSettings,
            secondsRemaining: newDuration,
          });
        }
      },

      completeSession: () => {
        const state = get();
        // Guard: if completionPending is false, either completeSession was
        // already called (by another tick hook) or the timer hasn't reached 0.
        // Only proceed if completionPending is true.
        if (!state.completionPending) return;

        let newSessionCount = state.sessionCount;
        let newCyclePos = state.cyclePosition;

        if (state.mode === "focus") {
          newSessionCount++;
          newCyclePos++;
        }

        const nextMode = state.mode === "focus"
          ? (newCyclePos >= state.settings.longEvery ? "long" : "short")
          : "focus";

        if (state.mode === "long") {
          newCyclePos = 0;
        }
        if (nextMode === "focus" && newCyclePos >= state.settings.longEvery) {
          newCyclePos = 0;
        }

        const autoStart =
          (nextMode === "focus" && state.settings.autoStartFocus) ||
          (nextMode !== "focus" && state.settings.autoStartBreaks);

        const nextDuration = durationForMode(nextMode, state.settings);
        set({
          mode: nextMode,
          sessionCount: newSessionCount,
          cyclePosition: newCyclePos,
          secondsRemaining: nextDuration,
          status: autoStart ? "running" : "idle",
          endTime: autoStart ? Date.now() + nextDuration * 1000 : null,
          completionPending: false,
        });
      },
    }),
    {
      name: "habitflow-pomodoro-v6",
      // Persist ALL timer state so it survives reloads
      partialize: (state) => ({
        mode: state.mode,
        status: state.status,
        secondsRemaining: state.secondsRemaining,
        sessionCount: state.sessionCount,
        cyclePosition: state.cyclePosition,
        settings: state.settings,
        endTime: state.endTime,
      }),
      // On rehydration, if the timer was running, recompute endTime from
      // the persisted secondsRemaining so the countdown continues correctly.
      // If the timer was idle/paused, just use the persisted secondsRemaining.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.status === "running") {
          // The timer was running when the page was closed/reloaded.
          // Recompute endTime from the persisted secondsRemaining.
          // If endTime is in the past (user was away longer than remaining),
          // clamp to 0 and set status to idle.
          if (state.endTime && state.endTime > Date.now()) {
            // endTime is still valid — keep it
            state.secondsRemaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
          } else {
            // endTime is in the past or null — timer expired while away
            state.secondsRemaining = 0;
            state.status = "idle";
            state.endTime = null;
          }
        } else {
          // Idle or paused — just use persisted secondsRemaining, clear endTime
          state.endTime = null;
        }
      },
    },
  ),
);

export function getModeDuration(mode: PomodoroMode, settings: PomodoroSettings): number {
  return durationForMode(mode, settings);
}
