"use client";

import { cn } from "@/lib/utils";

const DOT_COUNT = 12;
const DOT_GAP = 3;

/**
 * Animated dots indicator under the HabitFlow logo.
 * Dots 1 to DOT_COUNT-1: white (dark mode) / slate (light mode).
 * Last dot: green (#22c55e) — symbolizes "habit completed."
 * Wave animation lights up each dot left-to-right, ~1.5s loop.
 * Respects prefers-reduced-motion (shows static dots).
 *
 * The dots stretch to match the width of the "HabitFlow" text
 * (from 'E' to 'w') by using flex-1 dots with a fixed gap.
 */
export function LogoDots({ className, animate = true }: { className?: string; animate?: boolean }) {
  return (
    <div
      className={cn("logo-dots", animate && "animate", className)}
      aria-hidden="true"
      style={{ width: "fit-content", gap: `${DOT_GAP}px` }}
    >
      {Array.from({ length: DOT_COUNT }).map((_, i) => (
        <span
          key={i}
          className={cn("dot", i === DOT_COUNT - 1 ? "dot-green" : "dot-white")}
          style={{ animationDelay: `${(i * 0.08)}s` }}
        />
      ))}
    </div>
  );
}
