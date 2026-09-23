"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Coins, Clock, Trophy, Droplet, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useBadHabits } from "@/features/habits/hooks/useBadHabits";
import { useNav } from "@/lib/nav-store";
import type { BadHabit } from "@/types/bad-habits";

/**
 * Analytics-page section showing year-to-date stats across all the user's bad
 * habits. Only renders if the user has any non-archived bad habits.
 */
export function BadHabitsAnalyticsSection() {
  const { data: badHabits, isLoading } = useBadHabits(false);
  const reduce = useReducedMotion();
  const { go } = useNav();

  const stats = useMemo(() => {
    if (!badHabits || badHabits.length === 0) return null;
    let totalCleanDays = 0;
    let totalSlips = 0;
    let totalMoneySaved = 0;
    let moneySet = false;
    let totalTimeHours = 0;
    let timeSet = false;
    let bestCleanStreak = 0;
    for (const bh of badHabits) {
      // Total clean days this habit = current streak + (slip history — we approximate
      // using longestStreak as a proxy for "best clean stretch" and cleanStreak for current).
      // For year-to-date, sum the current streaks across all bad habits as the most
      // conservative measure of total clean days being celebrated.
      totalCleanDays += bh.cleanStreak;
      totalSlips += bh.longestStreak > 0 ? Math.max(0, bh.longestStreak - bh.cleanStreak) : 0;
      if (bh.moneySaved) {
        totalMoneySaved += bh.moneySaved.amount;
        moneySet = true;
      }
      if (bh.timeSaved) {
        totalTimeHours += bh.timeSaved.hours;
        timeSet = true;
      }
      if (bh.longestStreak > bestCleanStreak) bestCleanStreak = bh.longestStreak;
    }
    return {
      totalCleanDays,
      totalSlips,
      money: moneySet ? totalMoneySaved : null,
      time: timeSet ? totalTimeHours : null,
      bestCleanStreak,
    };
  }, [badHabits]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  if (!stats || !badHabits || badHabits.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <span className="text-base" aria-hidden>🚫</span>
            Bad habits — all time
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Across {badHabits.length} bad habit{badHabits.length === 1 ? "" : "s"} tracked
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.setItem("habits.tab", "break");
            }
            go({ name: "habits" });
          }}
          className="text-xs"
        >
          Manage <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          icon={<CalendarDays className="w-4 h-4 text-emerald-500" />}
          label="Total clean days"
          value={String(stats.totalCleanDays)}
          tint="bg-emerald-500/10"
        />
        <StatTile
          icon={<Coins className="w-4 h-4 text-teal-500" />}
          label="Money saved"
          value={stats.money != null ? formatMoney(stats.money, badHabits[0].currency) : "—"}
          tint="bg-teal-500/10"
        />
        <StatTile
          icon={<Trophy className="w-4 h-4 text-amber-500" />}
          label="Best clean streak"
          value={`${stats.bestCleanStreak}d`}
          tint="bg-amber-500/10"
        />
        <StatTile
          icon={<Droplet className="w-4 h-4 text-rose-500" />}
          label="Total slips"
          value={String(stats.totalSlips)}
          tint="bg-rose-500/10"
        />
      </div>
      {stats.time != null && (
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {stats.time.toFixed(0)} hours reclaimed total
        </div>
      )}
    </Card>
  );
}

function StatTile({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl bg-muted/30 p-3"
    >
      <div className={`w-7 h-7 rounded-md flex items-center justify-center mb-1.5 ${tint}`}>
        {icon}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </motion.div>
  );
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

export type { BadHabit };
