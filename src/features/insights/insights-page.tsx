"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Flame,
  Target,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Share2,
} from "lucide-react";
import { useInsights } from "@/hooks/use-analytics";
import { useNav } from "@/lib/nav-store";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Insight, InsightsResponse } from "@/types";
import { CoachLetterCard } from "./components/CoachLetterCard";
import { AIAssistantSection } from "./components/AIAssistantSection";
import { ShareCardModal } from "@/features/share/components/ShareCardModal";

/**
 * Maps an insight's `accent` string to a set of tailwind class tokens for the
 * icon tile background, icon tile border, card left-border accent, and
 * supporting text color. Falls back to `slate` for unknown accents.
 */
type AccentColor = "emerald" | "amber" | "rose" | "slate";

interface AccentClasses {
  bg: string;
  border: string;
  leftBorder: string;
  text: string;
}

const ACCENT_MAP: Record<AccentColor, AccentClasses> = {
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    leftBorder: "border-l-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    leftBorder: "border-l-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    leftBorder: "border-l-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
  slate: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    leftBorder: "border-l-slate-500",
    text: "text-slate-600 dark:text-slate-400",
  },
};

function accentClasses(accent: string): AccentClasses {
  const key = accent as AccentColor;
  return ACCENT_MAP[key] ?? ACCENT_MAP.slate;
}

/**
 * Small leading icon for the insight-type badge. Picks a downward or upward
 * trend icon based on the type slug; renders nothing for neutral types.
 * Defined as a stable component so the React Compiler keeps it static.
 */
function InsightTrendIcon({ type }: { type: string }) {
  if (/down|worst|miss|low|drop|decline|risk|warn|negative|weak/i.test(type)) {
    return <TrendingDown className="w-3 h-3" />;
  }
  if (
    /up|best|top|improve|gain|growth|increase|streak|win|strong|positive|momentum/i.test(
      type,
    )
  ) {
    return <TrendingUp className="w-3 h-3" />;
  }
  return null;
}

export function InsightsPage() {
  const { data, isLoading } = useInsights();
  const { go } = useNav();
  const [shareModalOpen, setShareModalOpen] = useState(false);

  if (isLoading || !data) {
    return <InsightsLoadingSkeleton />;
  }

  const { hasData, insights, stats } = data;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      <Header onShare={() => setShareModalOpen(true)} />
      <ShareCardModal open={shareModalOpen} onOpenChange={setShareModalOpen} />

      <AIAssistantSection />

      <CoachLetterCard />

      {!hasData ? (
        <EmptyState onCreateHabits={() => go({ name: "habits" })} />
      ) : (
        <>
          <StatsRow stats={stats} />

          {insights.length === 0 ? (
            <InsightsUnavailable />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {insights.map((insight, idx) => (
                  <InsightCard
                    key={`${insight.type}-${idx}`}
                    insight={insight}
                    index={idx}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function Header({ onShare }: { onShare: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personalized patterns and recommendations from your data
          </p>
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={onShare}
        aria-label="Share my progress"
        title="Share my progress"
        className="rounded-full text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-200"
      >
        <Share2 className="w-5 h-5" />
      </Button>
    </div>
  );
}

function StatsRow({
  stats,
}: {
  stats: InsightsResponse["stats"];
}) {
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={Target}
          label="Total habits"
          value={stats.totalHabits}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <StatTile
          icon={CheckCircle2}
          label="Check-ins"
          value={stats.totalCheckins}
          color="text-teal-600 dark:text-teal-400"
          bg="bg-teal-500/10"
        />
        <StatTile
          icon={Flame}
          label="Longest streak"
          value={`${stats.maxLongestStreak}d`}
          color="text-orange-500"
          bg="bg-orange-500/10"
        />
        <StatTile
          icon={Sparkles}
          label="Active streak days"
          value={stats.totalCurrentStreakDays}
          color="text-amber-500"
          bg="bg-amber-500/10"
        />
      </div>
    </Card>
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
  value: number | string;
  color: string;
  bg: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
          bg,
        )}
      >
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold tabular-nums leading-none">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreateHabits }: { onCreateHabits: () => void }) {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
        <Lightbulb className="w-6 h-6 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No insights yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
        Create a few habits and check in for a few days. We&apos;ll surface
        personalized patterns and recommendations right here.
      </p>
      <Button onClick={onCreateHabits} className="gap-1.5">
        Go to Habits
        <ArrowRight className="w-4 h-4" />
      </Button>
    </Card>
  );
}

function InsightsUnavailable() {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
        <Lightbulb className="w-6 h-6 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Nothing to surface yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        We need a little more check-in history to spot meaningful patterns.
        Check back in a few days.
      </p>
    </Card>
  );
}

function InsightCard({
  insight,
  index,
}: {
  insight: Insight;
  index: number;
}) {
  const accent = accentClasses(insight.accent);
  const typeLabel = insight.type.replace(/[_-]/g, " ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
      className="h-full"
    >
      <Card
        className={cn(
          "p-5 gap-3 h-full border-l-4 transition-shadow hover:shadow-md",
          accent.leftBorder,
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 border",
              accent.bg,
              accent.border,
            )}
            aria-hidden
          >
            <span>{insight.icon}</span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-semibold text-base leading-tight">
              {insight.title}
            </h3>
            <Badge
              variant="outline"
              className={cn(
                "mt-1.5 gap-1 text-[10px] uppercase tracking-wide",
                accent.text,
              )}
            >
              <InsightTrendIcon type={insight.type} />
              {typeLabel}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {insight.description}
        </p>
      </Card>
    </motion.div>
  );
}

function InsightsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <Card className="p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 gap-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
              <div className="space-y-2 flex-1 pt-0.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </Card>
        ))}
      </div>
    </div>
  );
}
