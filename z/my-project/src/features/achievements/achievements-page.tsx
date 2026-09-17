"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Target, Flame, Sparkles, Trophy } from "lucide-react";
import { useAchievements } from "@/hooks/use-analytics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/types";

export function AchievementsPage() {
  const { data, isLoading } = useAchievements();

  if (isLoading || !data) {
    return <AchievementsLoadingSkeleton />;
  }

  const { achievements, earnedCount, totalCount, stats } = data;
  const overallPct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
          <p className="text-sm text-muted-foreground">
            Celebrate your milestones and keep building those streaks.
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                {earnedCount}
              </span>
              <span className="text-muted-foreground"> of {totalCount} unlocked</span>
            </span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {overallPct}%
            </span>
          </div>
          <Progress value={overallPct} className="h-2" />
        </div>
      </div>

      {/* Stats summary card */}
      <Card className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            icon={Target}
            label="Habits tracked"
            value={stats.totalHabits}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-500/10"
          />
          <StatTile
            icon={CheckCircle2}
            label="Total check-ins"
            value={stats.totalCheckins}
            color="text-teal-600 dark:text-teal-400"
            bg="bg-teal-500/10"
          />
          <StatTile
            icon={Flame}
            label="Longest streak"
            value={stats.maxLongestStreak}
            color="text-orange-500"
            bg="bg-orange-500/10"
          />
          <StatTile
            icon={Sparkles}
            label="Perfect days"
            value={stats.perfectDays}
            color="text-amber-500"
            bg="bg-amber-500/10"
          />
        </div>
      </Card>

      {/* Achievements grid (or empty state) */}
      {achievements.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <Trophy className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No achievements yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Start checking in your habits to unlock achievements and badges.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
          {achievements.map((a, idx) => (
            <AchievementCard key={a.id} achievement={a} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: typeof Target;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", bg)}>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold tabular-nums leading-none">
          {value.toLocaleString()}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function AchievementCard({
  achievement: a,
  index,
}: {
  achievement: Achievement;
  index: number;
}) {
  const pct =
    a.target > 0 ? Math.min(100, Math.round((a.progress / a.target) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
      className="h-full"
    >
      <Card
        className={cn(
          "p-4 gap-3 h-full transition-shadow",
          a.earned ? "shadow-md" : "opacity-60",
        )}
      >
        {/* Badge */}
        <div className="flex justify-center pt-1 pb-0.5">
          <motion.div
            className="relative"
            initial={{ scale: 1 }}
            animate={a.earned ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={
              a.earned
                ? {
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.05 + 0.4,
                  }
                : { duration: 0 }
            }
          >
            <div
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center text-4xl",
                !a.earned && "grayscale",
              )}
              style={{
                backgroundColor: a.earned ? a.color + "22" : "var(--muted)",
                boxShadow: a.earned
                  ? `0 0 0 2px ${a.color}, 0 8px 22px -8px ${a.color}99`
                  : "inset 0 0 0 1px var(--border)",
              }}
            >
              <span className={a.earned ? "" : "opacity-70"}>{a.icon}</span>
            </div>
            {a.earned && (
              <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-background flex items-center justify-center shadow-sm ring-1 ring-border">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
            )}
          </motion.div>
        </div>

        {/* Title + description */}
        <div className="text-center">
          <div className="font-semibold text-sm leading-tight">{a.title}</div>
          <div className="text-xs text-muted-foreground mt-1 leading-snug min-h-[2.5rem]">
            {a.description}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <Progress value={pct} className="h-1.5" />
          <div className="text-[11px] text-center tabular-nums">
            {a.earned ? (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Unlocked!
              </span>
            ) : (
              <span className="text-muted-foreground">
                {a.progress} / {a.target}
              </span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function AchievementsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>
      <Card className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-52 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
