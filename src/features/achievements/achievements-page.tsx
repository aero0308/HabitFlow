"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Target, Flame, Sparkles, Trophy, Lock, TrendingUp, Share2 } from "lucide-react";
import { useAchievements } from "@/hooks/use-analytics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/types";
import { ShareCardModal } from "@/features/share/components/ShareCardModal";

/* ============================================================================
   AchievementsPage — improved achievements showcase
   ----------------------------------------------------------------------------
   Layout (top to bottom):
     1. Header — title + subtitle
     2. Overall progress — "X of Y unlocked" + animated progress bar + %
     3. Stats summary card — 4 stat tiles (Habits, Check-ins, Longest streak, Perfect days)
     4. Next-up callout — the closest-to-unlock badge with a CTA-style card
     5. Unlocked achievements — grid of all earned badges
     6. Locked achievements — grid of not-yet-earned badges (muted)
     7. Empty state — if no achievements exist

   Improvements over the previous version:
     • Split into "Unlocked" + "Locked" sections so users see their wins first
     • "Next up" callout highlights the badge closest to unlocking (highest progress %)
     • Progress bars animate filling on mount (using Framer Motion)
     • Better mobile layout (2-col → 2-col stat tiles on mobile)
     • Reduced motion respected throughout
============================================================================ */

export function AchievementsPage() {
  const { data, isLoading } = useAchievements();
  const shouldReduceMotion = useReducedMotion();
  const [shareModalOpen, setShareModalOpen] = useState(false);

  if (isLoading || !data) {
    return <AchievementsLoadingSkeleton />;
  }

  const { achievements, earnedCount, totalCount, stats } = data;
  const overallPct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  // Split into unlocked + locked
  const unlocked = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  // Find the "next up" — locked badge with highest progress %
  const nextUp = locked.length > 0
    ? locked.reduce((best, cur) => {
        const curPct = cur.target > 0 ? cur.progress / cur.target : 0;
        const bestPct = best.target > 0 ? best.progress / best.target : 0;
        return curPct > bestPct ? cur : best;
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Celebrate your milestones and keep building those streaks.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShareModalOpen(true)}
            className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white border-0"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share my progress
          </Button>
        </div>

        <ShareCardModal open={shareModalOpen} onOpenChange={setShareModalOpen} />

        {/* Overall progress with animated bar */}
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
          <Progress
            value={overallPct}
            className="h-2 transition-[width] duration-700 ease-out"
            // The shadcn Progress uses state to animate width via CSS —
            // Framer Motion not needed here because shadcn already animates.
          />
        </div>
      </div>

      {/* Stats summary card */}
      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
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

      {/* Next-up callout — only shown if there's a locked achievement with progress > 0 */}
      {nextUp && nextUp.progress > 0 && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card className="p-5 border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 dark:from-violet-500/10 dark:to-fuchsia-500/10">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{
                  backgroundColor: nextUp.color + "22",
                  boxShadow: `0 0 0 2px ${nextUp.color}40`,
                }}
              >
                <span>{nextUp.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300 mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Next up
                </div>
                <h3 className="font-semibold text-base leading-tight">{nextUp.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {nextUp.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Progress
                    value={Math.min(100, Math.round((nextUp.progress / nextUp.target) * 100))}
                    className="h-1.5 flex-1"
                  />
                  <span className="text-[11px] text-muted-foreground tabular-nums font-medium flex-shrink-0">
                    {nextUp.progress} / {nextUp.target}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Achievements — empty state, OR split into Unlocked + Locked */}
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
        <>
          {/* Unlocked section */}
          {unlocked.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={Trophy}
                title="Unlocked"
                count={unlocked.length}
                accent="text-amber-500"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
                {unlocked.map((a, idx) => (
                  <AchievementCard
                    key={a.id}
                    achievement={a}
                    index={idx}
                    shouldReduceMotion={shouldReduceMotion}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Locked section */}
          {locked.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={Lock}
                title="In progress"
                count={locked.length}
                accent="text-slate-400 dark:text-white/40"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
                {locked.map((a, idx) => (
                  <AchievementCard
                    key={a.id}
                    achievement={a}
                    index={idx}
                    shouldReduceMotion={shouldReduceMotion}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================================
   SectionHeader — small heading with icon + count badge
============================================================================ */
function SectionHeader({
  icon: Icon,
  title,
  count,
  accent,
}: {
  icon: typeof Trophy;
  title: string;
  count: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("w-4 h-4", accent)} />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <span
        className={cn(
          "text-[11px] font-medium px-1.5 py-0.5 rounded-full",
          "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/50",
        )}
      >
        {count}
      </span>
    </div>
  );
}

/* ============================================================================
   StatTile — single stat in the summary card
============================================================================ */
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
    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 sm:p-3 flex items-center gap-2.5">
      <div className={cn("w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0", bg)}>
        <Icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", color)} />
      </div>
      <div className="min-w-0">
        <div className="text-base sm:text-lg font-bold tabular-nums leading-none">
          {value.toLocaleString()}
        </div>
        <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   AchievementCard — single badge card
============================================================================ */
function AchievementCard({
  achievement: a,
  index,
  shouldReduceMotion,
}: {
  achievement: Achievement;
  index: number;
  shouldReduceMotion: boolean | null;
}) {
  const pct =
    a.target > 0 ? Math.min(100, Math.round((a.progress / a.target) * 100)) : 0;

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: shouldReduceMotion ? 0 : index * 0.04,
        duration: 0.3,
        ease: "easeOut",
      }}
      className="h-full"
    >
      <Card
        className={cn(
          "p-3 sm:p-4 gap-2 sm:gap-3 h-full transition-shadow",
          a.earned ? "shadow-md hover:shadow-lg" : "opacity-70",
        )}
      >
        {/* Badge */}
        <div className="flex justify-center pt-0.5 pb-0.5">
          <motion.div
            className="relative"
            initial={{ scale: 1 }}
            animate={
              a.earned && !shouldReduceMotion
                ? { scale: [1, 1.04, 1] }
                : { scale: 1 }
            }
            transition={
              a.earned && !shouldReduceMotion
                ? {
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.04 + 0.4,
                  }
                : { duration: 0 }
            }
          >
            <div
              className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-3xl sm:text-4xl",
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
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-background flex items-center justify-center shadow-sm ring-1 ring-border">
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
              </div>
            )}
          </motion.div>
        </div>

        {/* Title + description */}
        <div className="text-center">
          <div className="font-semibold text-xs sm:text-sm leading-tight">{a.title}</div>
          <div className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-snug min-h-[2.25rem] sm:min-h-[2.5rem]">
            {a.description}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1 sm:space-y-1.5">
          <Progress value={pct} className="h-1 sm:h-1.5" />
          <div className="text-[10px] sm:text-[11px] text-center tabular-nums">
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

/* ============================================================================
   Loading skeleton
============================================================================ */
function AchievementsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
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
