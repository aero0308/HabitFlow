"use client";

import { motion, useReducedMotion } from "framer-motion";

/* ============================================================================
   BadHabitMockup — STATIC landing-page mockup for the "Break Bad Habits" feature.
   ----------------------------------------------------------------------------
   A floating stack of 3 cards inside an ambient glow container:
     1. Clean streak hero (icon + name + big gradient number + progress bar)
     2. Savings card (money + per-day + days clean)
     3. Trigger insight card (most common trigger + suggested alternative)

   No real data — just styled React. Used by BreakHabitsSection on the landing
   page to show what the in-app Break tab looks like.

   Layout:
     • All 3 cards stacked vertically with slight offset / overlap on desktop
     • Mobile: stack without overlap, gap-3
     • Each card floats at a slightly different speed for parallax effect

   Animation:
     • Each card fades + slides up on scroll (stagger 0.1s)
     • Subtle floating (y: [0, ±3, 0], 7-9s loops, offset)
     • Progress bar fills on scroll-into-view
     • Disabled by prefers-reduced-motion
============================================================================ */

interface MockCard {
  id: string;
  variant: "streak" | "savings" | "insight";
}

const CARDS: MockCard[] = [
  { id: "streak", variant: "streak" },
  { id: "savings", variant: "savings" },
  { id: "insight", variant: "insight" },
];

const FLOAT_TRANSITIONS = [
  { duration: 7, delay: 0 },
  { duration: 8, delay: 0.5 },
  { duration: 9, delay: 1.0 },
];

export function BadHabitMockup() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative max-w-md mx-auto w-full">
      {/* --- Ambient glow behind the stack --- */}
      <div
        aria-hidden
        className="
          absolute -inset-6 -z-10 rounded-full
          bg-emerald-500/20 blur-3xl
          dark:bg-emerald-500/25
        "
      />

      <div className="space-y-3 sm:space-y-4">
        {CARDS.map((card, i) => (
          <motion.div
            key={card.id}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.45,
              delay: shouldReduceMotion ? 0 : i * 0.1,
              ease: "easeOut",
            }}
            className={i > 0 ? "sm:-mt-2" : ""}
          >
            <motion.div
              animate={
                shouldReduceMotion
                  ? undefined
                  : { y: [0, i % 2 === 0 ? -3 : 3, 0] }
              }
              transition={{
                duration: FLOAT_TRANSITIONS[i].duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: FLOAT_TRANSITIONS[i].delay,
              }}
              className="
                relative rounded-2xl overflow-hidden
                border border-slate-200/70 dark:border-white/10
                bg-white/95 dark:bg-[#0a0a0f]/95
                backdrop-blur-xl
                shadow-2xl shadow-emerald-500/10
              "
            >
              {card.variant === "streak" && <StreakCardContent shouldReduceMotion={shouldReduceMotion} />}
              {card.variant === "savings" && <SavingsCardContent />}
              {card.variant === "insight" && <InsightCardContent />}
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   Card 1 — Clean streak hero
============================================================================ */
function StreakCardContent({ shouldReduceMotion }: { shouldReduceMotion: boolean | null }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center text-lg">
            <span aria-hidden>🚭</span>
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Smoking
          </span>
        </div>
        <span
          className="
            text-[10px] font-medium uppercase tracking-wide
            px-2 py-0.5 rounded-full
            bg-emerald-500/10 text-emerald-700 dark:text-emerald-300
            border border-emerald-500/20
          "
        >
          Clean
        </span>
      </div>

      <div className="text-center py-2">
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.3 }}
          className="text-5xl font-bold leading-none bg-gradient-to-r from-violet-500 via-emerald-500 to-teal-400 bg-clip-text text-transparent"
        >
          12
        </motion.div>
        <div className="text-xs text-slate-500 dark:text-white/50 mt-1 font-medium">
          days clean
        </div>
      </div>

      {/* --- Progress bar --- */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/50 mb-1.5">
          <span className="flex items-center gap-1">
            <span aria-hidden>🎯</span>
            <span>30 days next milestone</span>
          </span>
          <span className="font-medium text-slate-700 dark:text-white/70">12/30</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200/70 dark:bg-white/5 overflow-hidden">
          <motion.div
            initial={shouldReduceMotion ? { width: "40%" } : { width: 0 }}
            whileInView={{ width: "40%" }}
            viewport={{ once: true }}
            transition={{
              duration: shouldReduceMotion ? 0 : 1.2,
              delay: shouldReduceMotion ? 0 : 0.4,
              ease: "easeOut",
            }}
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Card 2 — Savings
============================================================================ */
function SavingsCardContent() {
  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-base">
          <span aria-hidden>💰</span>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-white/60 uppercase tracking-wide">
          Saved this month
        </span>
      </div>

      <div className="text-4xl font-bold text-slate-900 dark:text-white leading-none">
        $66
      </div>

      <div className="text-[11px] text-slate-500 dark:text-white/50 mt-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>＋</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">$5.50/day</span>
        </span>
        <span className="text-slate-300 dark:text-white/20">·</span>
        <span>12 days clean</span>
      </div>
    </div>
  );
}

/* ============================================================================
   Card 3 — Trigger insight
============================================================================ */
function InsightCardContent() {
  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-base">
          <span aria-hidden>📊</span>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-white/60 uppercase tracking-wide">
          Trigger insight
        </span>
      </div>

      <p className="text-sm text-slate-700 dark:text-white/85 leading-relaxed">
        Your most common trigger:{" "}
        <strong className="font-semibold text-amber-600 dark:text-amber-300">
          Stress
        </strong>{" "}
        (4 of 6 slips). Try a 2-min walk when stress hits.
      </p>
    </div>
  );
}
