"use client";

import { useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronRight,
  Flame,
  Mail,
  Music,
  Play,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { fadeInUp, staggerContainer, viewportOnce } from "../animations";

/* ------------------------------------------------------------------ *
 * Filter taxonomy
 * ------------------------------------------------------------------ */

type CategoryKey = "habit" | "focus" | "insights";
type FilterKey = "all" | CategoryKey;

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All Features" },
  { id: "habit", label: "Habit Tracking" },
  { id: "focus", label: "Focus & Audio" },
  { id: "insights", label: "Insights & Sync" },
];

/* ------------------------------------------------------------------ *
 * Visual data for the mini UI widgets inside each card
 * ------------------------------------------------------------------ */

// 24-dot GitHub-style heatmap matrix. Order matches the source HTML so the
// colour intensity distribution reads the same way visually.
const HEATMAP_DOTS = [
  "bg-indigo-950/60", "bg-indigo-600/40", "bg-indigo-500", "bg-indigo-400",
  "bg-indigo-600/30", "bg-indigo-500", "bg-indigo-600", "bg-indigo-400",
  "bg-indigo-400", "bg-indigo-500", "bg-indigo-300", "bg-indigo-500",
  "bg-indigo-950/60", "bg-indigo-600/50", "bg-indigo-400", "bg-indigo-500",
  "bg-indigo-500", "bg-indigo-400", "bg-indigo-300", "bg-indigo-400",
  "bg-indigo-600/40", "bg-indigo-500", "bg-indigo-400", "bg-indigo-300",
];

// Mon–Sun with Mon/Wed/Fri highlighted to match the schedule copy.
const SCHEDULE_DAYS: { d: string; active: boolean }[] = [
  { d: "M", active: true },
  { d: "T", active: false },
  { d: "W", active: true },
  { d: "T", active: false },
  { d: "F", active: true },
  { d: "S", active: false },
  { d: "S", active: false },
];

// Weekly spark-bar heights + colours. Thursday is the highlight bar.
const BAR_DAYS: {
  d: string;
  height: string;
  barClass: string;
  labelClass?: string;
}[] = [
  { d: "M", height: "h-[40%]", barClass: "bg-emerald-500/20 group-hover:bg-emerald-500/30" },
  { d: "T", height: "h-[65%]", barClass: "bg-emerald-500/30 group-hover:bg-emerald-500/40" },
  { d: "W", height: "h-[80%]", barClass: "bg-emerald-500/40 group-hover:bg-emerald-500/50" },
  {
    d: "T",
    height: "h-[95%]",
    barClass: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
    labelClass: "text-emerald-300 font-semibold",
  },
  { d: "F", height: "h-[70%]", barClass: "bg-emerald-500/40 group-hover:bg-emerald-500/50" },
  { d: "S", height: "h-[50%]", barClass: "bg-emerald-500/25 group-hover:bg-emerald-500/35" },
  { d: "S", height: "h-[60%]", barClass: "bg-emerald-500/30 group-hover:bg-emerald-500/40" },
];

// Equalizer bar delays for the focus BGM card.
const WAVE_BARS = ["0.1s", "0.3s", "0.2s", "0.4s"];

/* ------------------------------------------------------------------ *
 * Card bodies — each card has a unique visual element, so each card is
 * its own small function component. They share the same outer article
 * shell (defined in CARDS below) for consistent styling & animation.
 * ------------------------------------------------------------------ */

function StreakCard() {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-[0_0_15px_rgba(249,114,22,0.15)] group-hover:scale-105 transition-transform duration-300">
            <Flame className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/15 to-amber-500/15 border border-orange-500/30 text-xs font-bold text-orange-300">
            <span aria-hidden>🔥</span>
            <span>28 Days Active</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-white mb-2.5 flex items-center gap-2">
          Streak Tracking <span aria-hidden>🔥</span>
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Smart streak calculation that respects your schedule, even for custom
          days like Mon/Wed/Fri.
        </p>
      </div>
      <div
        aria-label="Schedule preview"
        className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between"
      >
        <span className="text-xs font-mono text-zinc-500">Custom Schedule</span>
        <div className="flex gap-1 text-[11px] font-mono">
          {SCHEDULE_DAYS.map((day, i) => (
            <span
              key={`${day.d}-${i}`}
              className={
                day.active
                  ? "w-6 h-6 rounded bg-orange-500/20 border border-orange-500/40 text-orange-300 font-semibold flex items-center justify-center"
                  : "w-6 h-6 rounded bg-white/5 text-zinc-600 flex items-center justify-center"
              }
            >
              {day.d}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function HeatmapCard() {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)] group-hover:scale-105 transition-transform duration-300">
            <Calendar className="w-6 h-6" />
          </div>
          <span className="text-xs font-mono text-indigo-300/80 bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-800/40">
            GitHub Style
          </span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2.5 flex items-center gap-2">
          Calendar Heatmap <span aria-hidden>📅</span>
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Visualize your progress GitHub-style and spot patterns at a glance.
        </p>
      </div>
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono text-zinc-500">
            Activity Density
          </span>
          <span className="text-[10px] font-mono text-indigo-400 font-semibold">
            94% Completion
          </span>
        </div>
        <div className="grid grid-flow-col grid-rows-4 gap-1.5 justify-between py-1">
          {HEATMAP_DOTS.map((cls, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-sm ${cls}`}
              aria-hidden
            />
          ))}
        </div>
      </div>
    </>
  );
}

function AnalyticsCard() {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] group-hover:scale-105 transition-transform duration-300">
            <BarChart3 className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            +18.4%
          </span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2.5 flex items-center gap-2">
          Analytics <span aria-hidden>📊</span>
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Weekly charts, completion rates, and best-day insights to understand
          your behavior.
        </p>
      </div>
      <div
        aria-label="Weekly performance bar preview"
        className="mt-6 pt-4 border-t border-white/5 flex items-end justify-between gap-2 h-14"
      >
        {BAR_DAYS.map((day, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
          >
            <div className={`w-full rounded-t transition-all ${day.height} ${day.barClass}`} />
            <span className={`text-[10px] text-zinc-500 font-mono ${day.labelClass ?? ""}`}>
              {day.d}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function FocusTimerCard() {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] group-hover:scale-105 transition-transform duration-300">
            <Timer className="w-6 h-6" />
          </div>
          <span className="text-xs font-mono font-medium text-amber-400/90 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-full">
            25 / 5 min
          </span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2.5 flex items-center gap-2">
          Focus Timer <span aria-hidden>⏱️</span>
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Built-in Pomodoro timer with session tracking, break cycles, and
          ambient sound cues to keep you in the zone.
        </p>
      </div>
      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-full border-2 border-amber-500/30 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"
              style={{ animationDuration: "8s" }}
            />
            <div className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <span className="font-mono text-sm font-semibold text-white tracking-wider">
            18:42
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Cycle 3/4</span>
        </div>
      </div>
    </>
  );
}

function FocusBgmCard() {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] group-hover:scale-105 transition-transform duration-300">
            <Music className="w-6 h-6" />
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-300 bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            Lo-Fi Radio
          </span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2.5 flex items-center gap-2">
          Focus BGM <span aria-hidden>🎵</span>
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Built-in lofi background music that loops during your focus sessions
          — pick a track, hit start, stay in flow.
        </p>
      </div>
      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300">
            <Play className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="text-xs text-zinc-300 font-medium truncate max-w-[110px]">
            Midnight Rain
          </span>
        </div>
        <div
          aria-label="Audio wave"
          className="flex items-end gap-1 h-5"
        >
          {WAVE_BARS.map((delay, i) => (
            <div
              key={i}
              className="w-1 bg-cyan-400 rounded-full animate-soundwave"
              style={{ animationDelay: delay }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function NotificationsCard() {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)] group-hover:scale-105 transition-transform duration-300">
            <Bell className="w-6 h-6" />
          </div>
          <span className="text-xs font-mono text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
            Desktop Native
          </span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2.5 flex items-center gap-2">
          Browser Notifications <span aria-hidden>🔔</span>
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Daily in-browser reminders at your chosen time when habits are due —
          never miss a check-in again.
        </p>
      </div>
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm" aria-hidden>
              💧
            </span>
            <div className="truncate">
              <p className="text-xs font-medium text-white truncate">
                Drink Water Habit
              </p>
              <p className="text-[11px] text-zinc-400 truncate">
                Scheduled for 3:00 PM
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
            Now
          </span>
        </div>
      </div>
    </>
  );
}

function CustomTargetsCard() {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)] group-hover:scale-105 transition-transform duration-300">
            <Target className="w-6 h-6" />
          </div>
          <span className="text-xs font-mono text-violet-300 bg-violet-950/40 border border-violet-800/40 px-2.5 py-1 rounded-full">
            Unit Counters
          </span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2.5 flex items-center gap-2">
          Custom Targets <span aria-hidden>🎯</span>
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Track habits like &lsquo;8 glasses of water&rsquo; with daily target
          counts.
        </p>
      </div>
      <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-300 font-medium">
            Daily Target Progress
          </span>
          <span className="font-mono font-bold text-violet-400">
            6 / 8 glasses
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full w-3/4" />
        </div>
      </div>
    </>
  );
}

function EmailRemindersCard() {
  return (
    <>
      <div
        aria-hidden
        className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl z-0 pointer-events-none"
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)] group-hover:scale-105 transition-transform duration-300">
            <Mail className="w-6 h-6" />
          </div>
          <span className="shimmer-badge px-3 py-1 rounded-full text-xs font-bold text-amber-300 border border-amber-500/30 uppercase tracking-widest shadow-sm">
            SOON
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-2.5">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            Weekly Email Reminders <span aria-hidden>✉️</span>
          </h3>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
          Automated weekly email summaries with your progress, streaks, and
          insights — delivered every Monday.
        </p>
      </div>
      <div className="relative z-10 mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>
            Delivery cadence:{" "}
            <strong className="text-zinc-200">
              Mondays at 08:00 AM EST
            </strong>
          </span>
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-300/90 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
          <span>✨ Get on waitlist</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Card registry — id drives React key, category drives filter, and
 * colSpanClass handles the bento layout on lg screens. The shared
 * `card-glass` shell + motion variant is applied at render time.
 * ------------------------------------------------------------------ */

interface FeatureCardMeta {
  id: string;
  category: CategoryKey;
  colSpanClass: string;
  Component: ComponentType;
}

const CARDS: FeatureCardMeta[] = [
  { id: "streak", category: "habit", colSpanClass: "", Component: StreakCard },
  { id: "heatmap", category: "habit", colSpanClass: "", Component: HeatmapCard },
  { id: "analytics", category: "insights", colSpanClass: "", Component: AnalyticsCard },
  { id: "focus-timer", category: "focus", colSpanClass: "", Component: FocusTimerCard },
  { id: "bgm", category: "focus", colSpanClass: "", Component: FocusBgmCard },
  { id: "notifications", category: "habit", colSpanClass: "", Component: NotificationsCard },
  {
    id: "custom-targets",
    category: "habit",
    colSpanClass: "md:col-span-2 lg:col-span-1",
    Component: CustomTargetsCard,
  },
  {
    id: "email-reminders",
    category: "insights",
    colSpanClass: "md:col-span-2 lg:col-span-2 relative overflow-hidden",
    Component: EmailRemindersCard,
  },
];

/* ------------------------------------------------------------------ *
 * Section
 * ------------------------------------------------------------------ */

export function Features() {
  const [filter, setFilter] = useState<FilterKey>("all");

  const visibleCards =
    filter === "all"
      ? CARDS
      : CARDS.filter((c) => c.category === filter);

  return (
    <section
      id="features"
      className="relative bg-[#080B11] text-zinc-100 overflow-hidden pt-20 pb-24 lg:pt-28 lg:pb-32"
    >
      {/* Ambient background — fixed dark, lives behind content */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-80" />
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] bg-cyan-600/10 blur-[130px] rounded-full" />
        <div className="absolute top-[60%] -right-[10%] w-[600px] h-[600px] bg-rose-600/10 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-20"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold tracking-wider text-indigo-300 uppercase mb-6 shadow-inner backdrop-blur-md"
          >
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
            <span>⚡ POWERFUL CAPABILITIES</span>
          </motion.div>

          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-5"
          >
            Engineered to keep your{" "}
            <br className="hidden sm:inline" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              momentum unstoppable
            </span>
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed"
          >
            Everything you need to formulate enduring routines, dial in laser
            focus, and measure continuous self-evolution in one unified cockpit.
          </motion.p>

          {/* Category filter pills */}
          <motion.div
            variants={fadeInUp}
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
            role="tablist"
            aria-label="Filter features by category"
          >
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.id)}
                  className={
                    active
                      ? "px-4 py-2 rounded-full text-xs font-medium bg-zinc-100 text-zinc-900 shadow-sm transition"
                      : "px-4 py-2 rounded-full text-xs font-medium bg-zinc-900/80 text-zinc-400 border border-white/5 hover:border-white/20 hover:text-white transition"
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Bento feature grid */}
        <motion.div
          key={filter}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {visibleCards.map(({ id, colSpanClass, Component }) => (
            <motion.article
              key={id}
              variants={fadeInUp}
              className={`card-glass rounded-2xl p-6 md:p-7 flex flex-col justify-between border border-white/[0.07] transition-all duration-300 hover:-translate-y-1 group ${colSpanClass}`}
            >
              <Component />
            </motion.article>
          ))}
        </motion.div>

        {/* Bottom status footer */}
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-16 pt-10 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-zinc-400"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20" />
            <span>All systems functional & synced across web clients</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-500">Zero third-party trackers</span>
            <span className="text-zinc-700">•</span>
            <span className="text-xs text-zinc-500">
              100% Offline-First Architecture
            </span>
          </div>
        </motion.section>
      </div>
    </section>
  );
}
