"use client";

import { motion } from "framer-motion";
import { ListChecks, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

export type ShowcaseTab = "habits" | "mood";

interface ShowcaseTabsProps {
  active: ShowcaseTab;
  onChange: (tab: ShowcaseTab) => void;
  /** Layout variant: "inline" (desktop/tablet, right-aligned) or "full" (mobile, two equal tabs). */
  variant?: "inline" | "full";
}

const TABS: { id: ShowcaseTab; label: string; icon: typeof ListChecks }[] = [
  { id: "habits", label: "Habits", icon: ListChecks },
  { id: "mood", label: "Mood", icon: Smile },
];

/**
 * Fora-style pill tab switcher for the Unified Showcase section.
 *
 * Container: inline-flex rounded-full, bg-white/5 (dark) / bg-slate-100 (light),
 * backdrop-blur-md, border border-white/10 (dark) / border-slate-200 (light), p-1, gap-1.
 *
 * Active pill uses Framer Motion `layoutId` so it smoothly slides between tabs.
 *
 * Light mode: bg-violet-100 text-violet-700 ring-1 ring-violet-300
 * Dark mode: bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/40
 */
export function ShowcaseTabs({
  active,
  onChange,
  variant = "inline",
}: ShowcaseTabsProps) {
  return (
    <div
      className={
        variant === "full"
          ? "flex w-full"
          : "flex justify-center sm:justify-end"
      }
    >
      <div
        className="
          inline-flex items-center gap-1 p-1 rounded-full
          border border-white/10 bg-white/5 backdrop-blur-md
          dark:border-white/10 dark:bg-white/5
          border-slate-200 bg-slate-100/80
        "
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? "true" : undefined}
              aria-label={tab.label}
              className={cn(
                "relative inline-flex items-center gap-2 rounded-full px-4 py-2",
                "text-sm font-medium transition-colors duration-200",
                "whitespace-nowrap",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
                variant === "full" && "flex-1 justify-center",
                isActive
                  ? "text-violet-700 dark:text-violet-300"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/5 dark:text-white/50 dark:hover:text-white/80 dark:hover:bg-white/5",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="unified-showcase-active-pill"
                  className="
                    absolute inset-0 rounded-full
                    bg-violet-100 ring-1 ring-violet-300
                    dark:bg-violet-500/15 dark:ring-violet-500/40
                  "
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className="relative w-4 h-4 flex-shrink-0" />
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
