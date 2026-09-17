"use client";

import { motion } from "framer-motion";
import { ListChecks, Sunrise, Sun, Moon, Clock, type LucideIcon } from "lucide-react";
import type { TimeOfDay, TodayHabit } from "@/types";
import { cn } from "@/lib/utils";

type DaypartFilter = TimeOfDay | "ALL";

interface DaypartMeta {
  key: DaypartFilter;
  label: string;
  icon: LucideIcon;
}

const DAYPARTS: DaypartMeta[] = [
  { key: "ALL", label: "All", icon: ListChecks },
  { key: "MORNING", label: "Morning", icon: Sunrise },
  { key: "AFTERNOON", label: "Afternoon", icon: Sun },
  { key: "EVENING", label: "Evening", icon: Moon },
  { key: "ANY_TIME", label: "Any Time", icon: Clock },
];

export interface DashboardDaypartCardsProps {
  habits: TodayHabit[];
  activeDaypart: DaypartFilter;
  onDaypartChange: (d: DaypartFilter) => void;
}

export function DashboardDaypartCards({
  habits,
  activeDaypart,
  onDaypartChange,
}: DashboardDaypartCardsProps) {
  const tabs = DAYPARTS.map((dp) => {
    const filtered =
      dp.key === "ALL" ? habits : habits.filter((h) => h.timeOfDay === dp.key);
    const done = filtered.filter((h) => h.completed).length;
    const total = filtered.length;
    return { ...dp, done, total };
  });

  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1 gap-1">
        {tabs.map((t) => {
          const active = activeDaypart === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onDaypartChange(t.key)}
              aria-pressed={active}
              className={cn(
                "relative flex h-8 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 whitespace-nowrap",
                active
                  ? "text-violet-600 dark:text-violet-300"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {active && (
                <motion.div
                  layoutId="daypart-active-pill"
                  className="absolute inset-0 rounded-full bg-violet-500/15 ring-1 ring-violet-500/40"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 h-3.5 w-3.5 shrink-0" />
              <span className="relative z-10">{t.label}</span>
              <span className="relative z-10 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {t.done}/{t.total}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
