"use client";

import { useMemo } from "react";
import { BarChart3, Target, CheckCircle2, Flame, Sparkles, ArrowRight } from "lucide-react";
import { useDashboard } from "@/hooks/use-checkins";
import { useAchievements } from "@/hooks/use-analytics";
import { useNav } from "@/lib/nav-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * YourStatsSection — Profile-tab section showing 4 compact stat cards:
 *   • Total habits       (from useDashboard.totalHabits)
 *   • Total check-ins    (sum of streak leaderboard totalCompletions)
 *   • Longest streak     (max of streak leaderboard longestStreak)
 *   • Perfect days       (from useAchievements.stats.perfectDays)
 *
 * Below the grid there's a "View analytics →" link that navigates to the
 * /insights route via `useNav().go({ name: "analytics" })` (the insights
 * page in this app is keyed under `analytics` in the nav store).
 *
 * Loading state: skeleton placeholders.
 */
export function YourStatsSection() {
  const { go } = useNav();
  const { data: dash, isLoading: dashLoading } = useDashboard();
  const { data: ach, isLoading: achLoading } = useAchievements();

  const isLoading = dashLoading || achLoading;

  const stats = useMemo(() => {
    const totalHabits = dash?.totalHabits ?? 0;
    const streaks = dash?.streaks ?? [];
    const totalCheckins = streaks.reduce((sum, s) => sum + (s.totalCompletions ?? 0), 0);
    const longestStreak = streaks.length
      ? Math.max(...streaks.map((s) => s.longestStreak ?? 0))
      : 0;
    const perfectDays = ach?.stats?.perfectDays ?? 0;
    return { totalHabits, totalCheckins, longestStreak, perfectDays };
  }, [dash, ach]);

  const cards = [
    {
      icon: Target,
      label: "Total habits",
      value: stats.totalHabits,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: CheckCircle2,
      label: "Total check-ins",
      value: stats.totalCheckins,
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600 dark:text-teal-400",
    },
    {
      icon: Flame,
      label: "Longest streak",
      value: stats.longestStreak,
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-500",
    },
    {
      icon: Sparkles,
      label: "Perfect days",
      value: stats.perfectDays,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
    },
  ];

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-violet-500" />
        <h3 className="text-base font-medium">Your stats</h3>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                className="
                  bg-white/5 dark:bg-white/5
                  border border-slate-200/60 dark:border-white/10
                  rounded-xl p-4
                  flex items-center gap-3
                "
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    c.iconBg,
                  )}
                >
                  <Icon className={cn("w-4 h-4", c.iconColor)} />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold tabular-nums leading-none">
                    {c.value.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5 truncate">
                    {c.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View analytics link */}
      <button
        type="button"
        onClick={() => go({ name: "analytics" })}
        className="
          mt-4 inline-flex items-center gap-1
          text-xs font-medium text-violet-600 dark:text-violet-300
          hover:text-violet-700 dark:hover:text-violet-200
          transition-colors
        "
      >
        View analytics
        <ArrowRight className="w-3 h-3" />
      </button>
    </Card>
  );
}
