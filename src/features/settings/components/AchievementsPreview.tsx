"use client";

import { Trophy, ArrowRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAchievements } from "@/hooks/use-analytics";
import { useNav } from "@/lib/nav-store";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/types";

/**
 * AchievementsPreview — Profile-tab section showing a compact preview of the
 * user's achievement progress. Mirrors the achievements page header in
 * miniature: a "X of Y unlocked" line + a slim progress bar + a grid of
 * 64px circular badges (all of them, locked ones muted/grayscale).
 *
 * Below: a "See all achievements →" link that navigates to /achievements via
 * `useNav().go({ name: "achievements" })`.
 *
 * Badge tooltips show the achievement name + description. Hover (and focus)
 * on a badge will surface the shadcn Tooltip. If JS is disabled the `title`
 * attribute provides a fallback.
 */
export function AchievementsPreview() {
  const { go } = useNav();
  const { data, isLoading } = useAchievements();

  if (isLoading || !data) {
    return (
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-violet-500" />
          <h3 className="text-base font-medium">Achievements</h3>
        </div>
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-2 w-full rounded-full mb-4" />
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-full" />
          ))}
        </div>
      </Card>
    );
  }

  const { achievements, earnedCount, totalCount } = data;
  const pct =
    totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-violet-500" />
        <h3 className="text-base font-medium">Achievements</h3>
      </div>

      {/* Summary line + progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
              {earnedCount}
            </span>
            <span className="text-muted-foreground"> of {totalCount} unlocked</span>
          </span>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {pct}%
          </span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      {/* Badge grid */}
      {achievements.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Start checking in your habits to unlock achievements and badges.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {achievements.map((a) => (
            <AchievementBadge key={a.id} achievement={a} />
          ))}
        </div>
      )}

      {/* See all link */}
      <button
        type="button"
        onClick={() => go({ name: "achievements" })}
        className="
          mt-4 inline-flex items-center gap-1
          text-xs font-medium text-violet-600 dark:text-violet-300
          hover:text-violet-700 dark:hover:text-violet-200
          transition-colors
        "
      >
        See all achievements
        <ArrowRight className="w-3 h-3" />
      </button>
    </Card>
  );
}

function AchievementBadge({ achievement: a }: { achievement: Achievement }) {
  const badgeStyle = a.earned
    ? {
        backgroundColor: a.color + "22",
        boxShadow: `0 0 0 2px ${a.color}, 0 8px 22px -8px ${a.color}99`,
      }
    : {
        backgroundColor: "var(--muted)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          title={`${a.title} — ${a.description}`}
          className="flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
        >
          <div
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center text-3xl select-none",
              !a.earned && "grayscale opacity-30",
              a.earned && "shadow-lg shadow-violet-500/20",
            )}
            style={badgeStyle}
          >
            <span>{a.icon}</span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px] text-center">
        <div className="font-medium">{a.title}</div>
        <div className="text-[11px] opacity-90 mt-0.5">{a.description}</div>
      </TooltipContent>
    </Tooltip>
  );
}
