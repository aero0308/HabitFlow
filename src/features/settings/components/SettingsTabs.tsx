"use client";

import { motion, useReducedMotion } from "framer-motion";
import { User, SlidersHorizontal, Shield } from "lucide-react";

/**
 * SettingsTabs — pill-style three-tab switcher for the Settings page.
 *
 * Tabs:
 *   - "profile"  : Profile info, stats, achievements, data export/import
 *   - "general"  : Appearance, time-of-day, notifications, AI coach, help
 *   - "account"  : Session logout + Danger Zone
 *
 * Design (mirrors ChatTabs in the insights feature): a rounded-pill
 * container with a Framer Motion `layoutId` indicator that slides smoothly
 * between tabs on switch. Active tab gets the violet pill style; inactive
 * tabs are slate/muted and lift on hover.
 *
 * Respects `prefers-reduced-motion` — falls back to opacity-only transitions
 * when the user has reduced motion enabled.
 */

export type SettingsTab = "profile" | "general" | "account";

export interface SettingsTabsProps {
  value: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: typeof User;
}

const TABS: TabDef[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "account", label: "Account", icon: Shield },
];

export function SettingsTabs({ value, onChange }: SettingsTabsProps) {
  const reduceMotion = useReducedMotion();
  const LAYOUT_ID = "settings-tab-indicator";

  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className="
        flex w-full
        rounded-full p-1
        bg-slate-100/80 dark:bg-white/5
        border border-slate-200/80 dark:border-white/10
        gap-1
      "
    >
      {TABS.map((tab) => {
        const isActive = tab.id === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`
              relative flex-1
              flex items-center justify-center gap-2
              rounded-full
              px-3 py-2
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
            <span className="relative z-10 text-xs sm:text-sm font-medium truncate">
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
