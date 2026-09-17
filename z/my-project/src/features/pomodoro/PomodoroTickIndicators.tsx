"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PomodoroTickIndicatorsProps {
  /** How many focus sessions completed in the current cycle (0..total) */
  completed: number;
  /** Total sessions before a long break (default 4) */
  total: number;
  /** Whether the current session is a focus session (dots show progress) */
  isActiveFocus: boolean;
}

/**
 * Four (or `total`) small dots showing session progress within a Pomodoro cycle.
 * Filled dots = completed focus sessions; dim dots = upcoming.
 */
export function PomodoroTickIndicators({
  completed,
  total,
  isActiveFocus,
}: PomodoroTickIndicatorsProps) {
  const dots = Array.from({ length: total }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-1.5">
      {dots.map((i) => {
        const isDone = i < completed;
        const isCurrent = isActiveFocus && i === completed;
        return (
          <motion.span
            key={i}
            initial={false}
            animate={{
              scale: isCurrent ? 1.3 : 1,
              backgroundColor: isDone
                ? "rgb(139 92 246)"
                : isCurrent
                  ? "rgb(167 139 250)"
                  : "hsl(var(--muted-foreground) / 0.2)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={cn(
              "block w-1.5 h-1.5 rounded-full",
              !isDone && !isCurrent && "bg-muted-foreground/20",
            )}
          />
        );
      })}
    </div>
  );
}
