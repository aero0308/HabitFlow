"use client";

import { motion } from "framer-motion";
import { Check, Plus, Minus, Flame, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================================
   HabitsPreviewCard — the "Habits" tab mockup for the Unified Showcase.
   ----------------------------------------------------------------------------
   Two stacked cards matching the MoodPreviewCard's dimensions (so tab
   switching produces ZERO layout shift):

     Card 1: "Today's habits" — 3 compact habit rows with icons, streaks,
             and either a green checkmark (done) or a +/- counter (target
             habit). Thin progress bar at the bottom (80% = 4/5 done).

     Card 2: "This week" — 7 day cells (Mon–Sun) showing completion with
             a streak summary. Matches the MoodPreviewCard's "Mood vs.
             Habits" chart card height.
============================================================================ */

interface Habit {
  emoji: string;
  name: string;
  meta: string;
  status: "done" | "counter";
  count?: number;
  target?: number;
  /** Tailwind color name, e.g. "blue", "orange", "violet" — used for the
   * icon box background tint. */
  color: "blue" | "orange" | "violet" | "emerald";
}

const SAMPLE_HABITS: Habit[] = [
  {
    emoji: "🏃",
    name: "Morning Run",
    meta: "🔥 6d streak",
    status: "done",
    color: "orange",
  },
  {
    emoji: "💧",
    name: "Drink Water",
    meta: "🔥 12d · 8/8 glasses",
    status: "counter",
    count: 8,
    target: 8,
    color: "blue",
  },
  {
    emoji: "🧘",
    name: "Meditate",
    meta: "🔥 3d streak",
    status: "counter",
    count: 0,
    target: 1,
    color: "violet",
  },
];

const COLOR_STYLES: Record<Habit["color"], { bg: string; text: string }> = {
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
    text: "text-blue-600 dark:text-blue-400",
  },
  orange: {
    bg: "bg-orange-500/10 dark:bg-orange-500/15",
    text: "text-orange-600 dark:text-orange-400",
  },
  violet: {
    bg: "bg-violet-500/10 dark:bg-violet-500/15",
    text: "text-violet-600 dark:text-violet-400",
  },
  emerald: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
  },
};

const WEEK_DAYS = [
  { day: "M", done: true },
  { day: "T", done: true },
  { day: "W", done: true },
  { day: "T", done: false },
  { day: "F", done: true },
  { day: "S", done: true },
  { day: "S", done: false },
];

export function HabitsPreviewCard() {
  return (
    <div className="relative space-y-4">
      {/* Ambient violet glow behind the cards */}
      <div
        aria-hidden
        className="
          absolute -inset-4 -z-10
          bg-gradient-to-br from-violet-500/15 to-orange-500/10
          blur-3xl rounded-3xl opacity-60
        "
      />

      {/* Card 1: Today's habits */}
      <div
        className="
          relative rounded-2xl p-5
          border border-slate-200 bg-white
          dark:border-white/10 dark:bg-[#0a0a0f]/80
          backdrop-blur-md
          shadow-2xl shadow-violet-500/10
          group overflow-hidden
        "
      >
        {/* Subtle gradient sheen on hover */}
        <div
          aria-hidden
          className="
            absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent
            opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
          "
        />

        {/* Header: "Today's habits" + "4/5 done" badge */}
        <div className="flex items-center justify-between mb-4 relative">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Flame className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                Today&apos;s habits
              </div>
              <div className="text-[10px] text-muted-foreground">
                Tue, Mar 12
              </div>
            </div>
          </div>
          <div
            className="
              inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold
              bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20
            "
          >
            <span>4/5</span>
            <span className="text-emerald-500/60">·</span>
            <span>done</span>
          </div>
        </div>

        {/* Habit rows */}
        <div className="space-y-2.5 relative">
          {SAMPLE_HABITS.map((habit) => (
            <HabitRow key={habit.name} habit={habit} />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4 relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground">Daily progress</span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              80%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: "80%" }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Card 2: This week summary (matches MoodPreviewCard's chart card height) */}
      <div
        className="
          relative rounded-2xl p-5
          border border-slate-200 bg-white
          dark:border-white/10 dark:bg-[#0a0a0f]/80
          backdrop-blur-md
          shadow-2xl shadow-indigo-500/10
          group overflow-hidden
        "
      >
        <div
          aria-hidden
          className="
            absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent
            opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
          "
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 relative">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                This week
              </div>
              <div className="text-[10px] text-muted-foreground">
                Mon – Sun
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-foreground tabular-nums">
              5/7
            </div>
            <div className="text-[10px] text-muted-foreground">perfect days</div>
          </div>
        </div>

        {/* 7 day cells */}
        <div className="flex items-end justify-between gap-1.5 relative">
          {WEEK_DAYS.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-full aspect-square rounded-lg flex items-center justify-center text-xs font-medium",
                  d.done
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-muted text-muted-foreground border border-border/40",
                )}
              >
                {d.done ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                  <span className="text-[10px]">{d.day}</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{d.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   HabitRow — a single habit row with icon, name, meta, and status indicator.
============================================================================ */

function HabitRow({ habit }: { habit: Habit }) {
  const colors = COLOR_STYLES[habit.color];

  return (
    <div
      className="
        flex items-center gap-3 p-2.5 rounded-xl
        border border-border/40 bg-background/40
        hover:bg-background/60 transition-colors
      "
    >
      {/* Icon */}
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0",
          colors.bg,
        )}
      >
        {habit.emoji}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {habit.name}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {habit.meta}
        </div>
      </div>

      {/* Status: checkmark (done) or counter (target habit) */}
      <div className="flex-shrink-0">
        {habit.status === "done" ? (
          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-4 h-4 text-white" strokeWidth={3} />
          </div>
        ) : (
          <Counter count={habit.count ?? 0} target={habit.target ?? 1} />
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   Counter — visual-only +/- counter for target habits (e.g., water glasses).
   The buttons are not interactive in this mockup — they're purely decorative.
============================================================================ */

function Counter({ count, target }: { count: number; target: number }) {
  const isComplete = count >= target;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-1.5 py-1",
        isComplete
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-border/60 bg-muted/40",
      )}
    >
      {/* - button (decorative) */}
      <span
        className="
          w-5 h-5 rounded flex items-center justify-center
          text-muted-foreground/60
        "
        aria-hidden
      >
        <Minus className="w-3 h-3" />
      </span>
      {/* Count / target */}
      <span
        className={cn(
          "text-xs font-semibold tabular-nums min-w-[32px] text-center",
          isComplete
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-foreground",
        )}
      >
        {count}/{target}
      </span>
      {/* + button (decorative) */}
      <span
        className="
          w-5 h-5 rounded flex items-center justify-center
          text-muted-foreground/60
        "
        aria-hidden
      >
        <Plus className="w-3 h-3" />
      </span>
    </div>
  );
}
