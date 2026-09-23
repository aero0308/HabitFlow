"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Flame, MoreHorizontal, Pencil, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { BadHabit } from "@/types/bad-habits";

interface CleanStreakHeroProps {
  badHabit: BadHabit;
  /** Subtext below the big streak number, e.g. "Started Sep 12, 2026" or "Since last slip: Sep 16" */
  subtext: string;
  onSlip: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/**
 * Animated counting-up number from 0 to `value` over `duration` seconds.
 *
 * The `setN` call only ever runs inside a requestAnimationFrame callback
 * (never synchronously in the effect body), so this passes the
 * set-state-in-effect lint rule. Reduced-motion users render the final
 * value directly (no animation at all).
 */
function CountUpNumber({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const reduce = useReducedMotion();
  // Render-time check: reduced-motion users never mount the animated component.
  if (reduce) return <>{value}</>;
  return <CountUpInner value={value} duration={duration} key={value} />;
}

function CountUpInner({ value, duration }: { value: number; duration: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = 0;
    const to = value;
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{n}</>;
}

export function CleanStreakHero({
  badHabit,
  subtext,
  onSlip,
  onEdit,
  onArchive,
  onDelete,
}: CleanStreakHeroProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col md:flex-row md:items-center md:justify-between gap-6"
    >
      <div className="flex items-center gap-4 sm:gap-6">
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl flex-shrink-0 ring-1 ring-border"
          style={{ backgroundColor: badHabit.color + "20" }}
          aria-hidden
        >
          {badHabit.icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
            {badHabit.name}
          </h1>
          <div
            className={cn(
              "text-5xl sm:text-6xl font-bold tabular-nums",
              "bg-gradient-to-r from-emerald-400 to-teal-400",
              "bg-clip-text text-transparent",
            )}
            aria-label={`${badHabit.cleanStreak} days clean`}
          >
            <CountUpNumber value={badHabit.cleanStreak} />
            <span className="ml-2 text-2xl sm:text-3xl font-medium">days clean</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-emerald-500" />
            {subtext}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onSlip}
          className="border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10"
        >
          I slipped
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="w-3.5 h-3.5 mr-2" /> Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-rose-600 dark:text-rose-300 focus:text-rose-700 dark:focus:text-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
