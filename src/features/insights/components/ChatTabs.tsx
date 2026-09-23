"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Database, MessageCircle } from "lucide-react";

/**
 * ChatTabs — pill-style two-tab switcher between the two chat modes:
 *  - "data"    : "Chat with your data"  (RAG-grounded analyst)
 *  - "general" : "Ask anything"        (ChatGPT-style general assistant)
 *
 * Design (mirrors the daypart-tab look in TimeOfDaySettings, but pill-shaped
 * with a Framer Motion layoutId indicator that slides smoothly between the
 * two tabs on switch).
 *
 * Layout:
 *  - Container: `inline-flex rounded-full p-1 bg-white/5 border border-white/10`
 *    (plus dark: prefix to keep the surface in dark mode).
 *  - Two pill tabs side-by-side, each `flex-1`.
 *  - Each tab: Lucide icon on the left, then a stacked label + subtitle.
 *  - Active tab gets a motion.div with `layoutId="chat-tab-indicator"` as its
 *    background — Framer animates the indicator sliding between tabs.
 *  - Active style: `bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/40`
 *    in dark mode (per spec), with `text-violet-700` / `ring-violet-500/30`
 *    equivalents for light mode.
 *  - Inactive: `bg-white/5 text-muted-foreground hover:bg-white/10`.
 *
 * Respects prefers-reduced-motion: opacity-only fallback for the indicator.
 */

export interface ChatTabsProps {
  value: "data" | "general";
  onChange: (mode: "data" | "general") => void;
}

interface TabDef {
  mode: "data" | "general";
  label: string;
  subtitle: string;
  icon: typeof Database;
}

const TABS: TabDef[] = [
  {
    mode: "data",
    label: "Chat with your data",
    subtitle: "Grounded in your habit and mood data",
    icon: Database,
  },
  {
    mode: "general",
    label: "Ask anything",
    subtitle: "General questions, like ChatGPT",
    icon: MessageCircle,
  },
];

export function ChatTabs({ value, onChange }: ChatTabsProps) {
  const reduceMotion = useReducedMotion();
  const LAYOUT_ID = "chat-tab-indicator";

  return (
    <div
      role="tablist"
      aria-label="Chat mode"
      className="
        flex w-full sm:w-auto
        rounded-full p-1
        bg-slate-100/80 dark:bg-white/5
        border border-slate-200/80 dark:border-white/10
        gap-1
      "
    >
      {TABS.map((tab) => {
        const isActive = tab.mode === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.mode)}
            className={`
              relative flex-1
              flex items-center justify-center gap-2 sm:gap-2.5
              rounded-full
              px-2 sm:px-3 py-2
              text-left
              transition-colors
              ${
                isActive
                  ? "text-violet-700 dark:text-violet-300"
                  : "text-slate-500 dark:text-muted-foreground hover:bg-slate-200/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-foreground"
              }
            `}
          >
            {/* Sliding pill indicator (only rendered inside the active tab) */}
            {isActive && (
              <motion.div
                layoutId={LAYOUT_ID}
                initial={reduceMotion ? { opacity: 0 } : false}
                animate={reduceMotion ? { opacity: 1 } : undefined}
                transition={
                  reduceMotion
                    ? { duration: 0.15 }
                    : { type: "spring", stiffness: 400, damping: 32 }
                }
                className="
                  absolute inset-0 rounded-full
                  bg-violet-500/15
                  ring-1 ring-violet-500/30 dark:ring-violet-500/40
                "
              />
            )}
            {/* Content (relative so it sits above the indicator) */}
            <Icon
              className="
                relative z-10 shrink-0
                w-4 h-4
                text-violet-600 dark:text-violet-300
              "
            />
            <span className="relative z-10 flex flex-col leading-tight min-w-0">
              <span className="text-xs sm:text-sm font-medium truncate">{tab.label}</span>
              <span className="hidden sm:block text-[10.5px] text-slate-400 dark:text-muted-foreground">
                {tab.subtitle}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
