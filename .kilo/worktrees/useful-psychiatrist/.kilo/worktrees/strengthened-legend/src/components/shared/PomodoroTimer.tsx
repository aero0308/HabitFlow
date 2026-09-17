"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  usePomodoroStore,
  POMODORO_PRESETS,
  POMODORO_LABELS,
  type PomodoroMode,
} from "@/lib/pomodoroStore";

const MODES: PomodoroMode[] = ["focus", "short", "long"];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PomodoroTimer() {
  const {
    mode,
    remaining,
    isRunning,
    tick,
    start,
    pause,
    reset,
    setMode,
  } = usePomodoroStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  // Tick every second while running
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isRunning, tick]);

  // Detect completion
  useEffect(() => {
    if (remaining === 0 && !completedRef.current && isRunning === false) {
      // Only fire once per session
      const wasRunning = completedRef.current === false && remaining === 0;
      if (wasRunning) {
        completedRef.current = true;
        toast.success("Focus session complete 🔥", {
          description: "Great work! Take a break or start another session.",
        });
      }
    }
    if (remaining > 0) {
      completedRef.current = false;
    }
  }, [remaining, isRunning]);

  const totalSeconds = POMODORO_PRESETS[mode];
  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="mt-auto p-3 rounded-xl border border-border bg-muted/30">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Timer className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          Focus Timer
        </span>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 text-[10px] font-medium py-1 rounded-md transition-colors",
              mode === m
                ? "bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-1 ring-violet-500/30"
                : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            {POMODORO_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer display with circular progress */}
      <div className="relative flex items-center justify-center my-2">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-muted/30"
          />
          <motion.circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-mono tabular-nums font-bold text-foreground">
            {formatTime(remaining)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          size="icon"
          onClick={isRunning ? pause : start}
          className="h-8 w-8 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
          aria-label={isRunning ? "Pause" : "Start"}
        >
          {isRunning ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-0.5" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={reset}
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Reset"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
