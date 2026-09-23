"use client";

import { Sparkles, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";

/* ============================================================================
   MoodPreviewCard — the "Mood" tab mockup for the Unified Showcase.
   ----------------------------------------------------------------------------
   Extracted from the original MoodShowcase component (preserving the EXACT
   visual design). Two stacked cards:

     Card 1: "Today's mood" — 8/10 Great, emoji row with highlighted emoji,
             note preview, and tag chips.

     Card 2: "Mood vs. Habits" — bar chart showing avg mood by habit-completion
             bucket + an insight pill ("Completing 3+ habits = +3.2 mood").

   The cards use bg-card/95 backdrop-blur so they adapt to light/dark mode.
============================================================================ */

const MOOD_EMOJIS_PREVIEW = ["😢", "😞", "😕", "😐", "🙂", "😊", "😄", "😁", "🤩", "😍"];
const HIGHLIGHTED_INDEX = 7; // 😁

const CORR_DATA = [
  { bucket: "0", avg: 5.2 },
  { bucket: "1", avg: 6.1 },
  { bucket: "2", avg: 7.0 },
  { bucket: "3+", avg: 8.4 },
];

export function MoodPreviewCard() {
  return (
    <div className="relative space-y-4">
      {/* Ambient violet glow behind the cards */}
      <div
        aria-hidden
        className="
          absolute -inset-4 -z-10
          bg-gradient-to-br from-violet-500/15 to-indigo-500/10
          blur-3xl rounded-3xl opacity-60
        "
      />

      {/* Card 1: Today's mood */}
      <Card
        className="
          p-4 sm:p-5 rounded-2xl border-white/5 shadow-2xl shadow-violet-500/10
          bg-card/95 backdrop-blur relative overflow-hidden group
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
        <div className="flex items-center justify-between mb-3 relative">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                Today&apos;s mood
              </div>
              <div className="text-[10px] text-muted-foreground">
                Tue, Mar 12
              </div>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
            <span>8/10</span>
            <span className="text-emerald-500/60">·</span>
            <span>Great</span>
          </div>
        </div>

        {/* Emoji picker with highlighted emoji */}
        <div className="grid grid-cols-5 gap-1.5 mb-3 sm:flex sm:flex-wrap sm:justify-center relative">
          {MOOD_EMOJIS_PREVIEW.map((emoji, i) => {
            const highlighted = i === HIGHLIGHTED_INDEX;
            return (
              <div
                key={emoji}
                className={
                  highlighted
                    ? "w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-base flex items-center justify-center ring-2 ring-violet-500 scale-110 bg-violet-500/10 border border-violet-500/40"
                    : "w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-base flex items-center justify-center border border-border/60 bg-background/40 opacity-60"
                }
              >
                {emoji}
              </div>
            );
          })}
        </div>

        {/* Note preview */}
        <div className="rounded-lg bg-muted/40 border border-border/40 p-2.5 mb-2 relative">
          <p className="text-xs text-foreground/80 italic leading-relaxed">
            &ldquo;Knocked out my morning workout and felt energized all day.
            Reading before bed helped me wind down.&rdquo;
          </p>
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-1.5 relative">
          {["energized", "focused", "motivated"].map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/15"
            >
              #{tag}
            </span>
          ))}
        </div>
      </Card>

      {/* Card 2: Mood vs. Habits correlation */}
      <Card
        className="
          p-4 sm:p-5 rounded-2xl border-white/5 shadow-2xl shadow-indigo-500/10
          bg-card/95 backdrop-blur relative overflow-hidden group
        "
      >
        <div
          aria-hidden
          className="
            absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent
            opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
          "
        />
        <div className="flex items-center gap-2 mb-3 relative">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              Mood vs. Habits
            </div>
            <div className="text-[10px] text-muted-foreground">
              Last 30 days
            </div>
          </div>
        </div>

        <div className="flex items-end gap-2 sm:gap-4 relative">
          {/* Mini bar chart */}
          <div className="h-24 sm:h-28 flex-1 min-w-0 -ml-1 sm:-ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={CORR_DATA}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeOpacity={0.3}
                />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 9, fill: "currentColor" }}
                  axisLine={false}
                  tickLine={false}
                  className="text-muted-foreground"
                />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {CORR_DATA.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.avg <= 3
                          ? "#ef4444"
                          : entry.avg <= 6
                            ? "#f59e0b"
                            : "#8b5cf6"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Insight pill */}
          <div className="w-24 sm:w-32 flex-shrink-0 rounded-lg border border-violet-500/20 bg-violet-500/5 p-2 sm:p-2.5">
            <p className="text-[10px] sm:text-[11px] text-foreground/90 leading-snug">
              Completing 3+ habits ={" "}
              <span className="font-semibold text-violet-600 dark:text-violet-300">
                +3.2 mood
              </span>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
