"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BadHabit } from "@/types/bad-habits";

interface CleanStreaksCardProps {
  badHabits: BadHabit[];
  onView: () => void;
}

/**
 * Dashboard widget showing each active bad habit's current clean streak.
 * Tone: celebratory, NEVER shaming.
 *
 * Click → navigates to the Habits page with the Break tab active.
 */
export function CleanStreaksCard({ badHabits, onView }: CleanStreaksCardProps) {
  const reduce = useReducedMotion();
  if (badHabits.length === 0) return null;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-4 sm:p-5 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <span className="text-base" aria-hidden>🚫</span>
            Bad habits
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onView}
            className="text-xs h-7 px-2 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
          >
            View <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <ul className="space-y-1.5">
          {badHabits.slice(0, 4).map((bh) => (
            <li
              key={bh.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: bh.color + "20" }}
                  aria-hidden
                >
                  {bh.icon}
                </div>
                <span className="font-medium truncate">{bh.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">
                <span className="tabular-nums">{bh.cleanStreak} {bh.cleanStreak === 1 ? "day" : "days"} clean</span>
                <Flame className="w-3.5 h-3.5" />
              </div>
            </li>
          ))}
          {badHabits.length > 4 && (
            <li className="text-xs text-muted-foreground pt-1">+ {badHabits.length - 4} more</li>
          )}
        </ul>
      </Card>
    </motion.div>
  );
}
