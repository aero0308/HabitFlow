"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Lock, Trophy, Clock, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BadHabitMilestone } from "@/types/bad-habits";

interface MilestoneTimelineProps {
  /**
   * All milestone definitions (in canonical order) for the user's currency.
   * Each entry: { type, value, label }.
   */
  milestones: Array<{ type: "days" | "money" | "time"; value: number; label: string }>;
  /** Already-unlocked milestone records from the DB. */
  unlocked: BadHabitMilestone[];
  /**
   * The "next" milestone the user is currently progressing toward.
   * (Type+value identifying which entry is highlighted with a pulse.)
   */
  nextMilestone?: { type: "days" | "money" | "time"; value: number } | null;
}

const ICON_FOR: Record<"days" | "money" | "time", typeof Lock> = {
  days: Trophy,
  money: Coins,
  time: Clock,
};

export function MilestoneTimeline({
  milestones,
  unlocked,
  nextMilestone,
}: MilestoneTimelineProps) {
  const reduce = useReducedMotion();
  const unlockedKey = new Set(
    unlocked.map((m) => `${m.type}:${m.value}`),
  );
  const nextKey = nextMilestone
    ? `${nextMilestone.type}:${nextMilestone.value}`
    : null;
  const unlockedByType = (type: "days" | "money" | "time") =>
    unlocked
      .filter((u) => u.type === type)
      .sort((a, b) => b.value - a.value)[0];

  return (
    <div
      className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-1 px-1 custom-scroll"
      role="list"
      aria-label="Milestone timeline"
    >
      {milestones.map((m, i) => {
        const Icon = ICON_FOR[m.type];
        const isUnlocked = unlockedKey.has(`${m.type}:${m.value}`);
        const isNext = nextKey === `${m.type}:${m.value}`;
        const unlockedRecord = isUnlocked
          ? unlocked.find((u) => u.type === m.type && u.value === m.value)
          : null;

        return (
          <motion.div
            key={`${m.type}-${m.value}`}
            role="listitem"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.6), duration: 0.3 }}
            className={cn(
              "flex-shrink-0 w-32 sm:w-36 rounded-xl p-3 border text-center",
              isUnlocked
                ? "bg-violet-500/15 ring-1 ring-violet-500/40 text-violet-700 dark:text-violet-200 border-violet-500/30"
                : "bg-muted/30 text-muted-foreground border-border",
            )}
          >
            <div
              className={cn(
                "mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-2",
                isUnlocked ? "bg-violet-500/20" : "bg-muted/60",
              )}
            >
              {isUnlocked ? (
                <Icon className="w-5 h-5 text-violet-600 dark:text-violet-300" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="text-xs font-medium leading-tight">{m.label}</div>
            {unlockedRecord && (
              <div className="text-[10px] text-muted-foreground mt-1">
                {new Date(unlockedRecord.unlockedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            )}
            {!isUnlocked && isNext && !reduce && (
              <motion.div
                className="text-[10px] mt-1 text-violet-600 dark:text-violet-300 font-medium"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                In progress
              </motion.div>
            )}
            {!isUnlocked && !isNext && (
              <div className="text-[10px] mt-1 text-muted-foreground">
                {m.type === "days" ? `${m.value}d` : m.type === "money" ? `${m.value}` : `${m.value}h`}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
