"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Trophy, Frown, Flame, BarChart3, CalendarDays, Target, ListOrdered } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useCompletion, useStreaks } from "@/hooks/use-analytics";
import { YearlyHeatmap } from "@/features/analytics/yearly-heatmap";
import { YearComparison } from "@/features/analytics/year-comparison";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNav } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const tooltipStyle = {
  borderRadius: 8,
  fontSize: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

export function AnalyticsPage() {
  const { data: completion, isLoading: completionLoading } = useCompletion(90);
  const { data: streaks, isLoading: streaksLoading } = useStreaks();
  const { go } = useNav();

  const hasData = (completion?.perHabit.length ?? 0) > 0 || (streaks?.length ?? 0) > 0;
  const loading = completionLoading || streaksLoading;

  const dayOfWeek = useMemo(() => {
    if (!completion?.dayOfWeek) return [];
    // The API returns 0=Mon..6=Sun entries (possibly missing days with no schedule).
    // Normalize into a 7-cell array preserving Mon-first order.
    const byIdx = new Map<number, { day: number; completed: number; scheduled: number; pct: number }>();
    for (const d of completion.dayOfWeek) byIdx.set(d.day, d);
    return Array.from({ length: 7 }, (_, i) =>
      byIdx.get(i) ?? { day: i, completed: 0, scheduled: 0, pct: 0 },
    );
  }, [completion]);

  const bestDayIdx = useMemo(() => {
    if (dayOfWeek.length === 0) return -1;
    let best = -1;
    let bestPct = -1;
    for (const d of dayOfWeek) {
      if (d.scheduled === 0) continue;
      if (d.pct > bestPct) {
        bestPct = d.pct;
        best = d.day;
      }
    }
    return best;
  }, [dayOfWeek]);

  const worstDayIdx = useMemo(() => {
    if (dayOfWeek.length === 0) return -1;
    let worst = -1;
    let worstPct = 101;
    for (const d of dayOfWeek) {
      if (d.scheduled === 0) continue;
      if (d.pct < worstPct) {
        worstPct = d.pct;
        worst = d.day;
      }
    }
    return worst;
  }, [dayOfWeek]);

  const weeklyData = useMemo(() => {
    if (!completion?.weekly) return [];
    return completion.weekly.map((w) => ({
      ...w,
      label: format(parseISO(w.weekStart), "MMM d"),
    }));
  }, [completion]);

  const perHabitData = useMemo(() => {
    if (!completion?.perHabit) return [];
    // Truncate very long names so the chart doesn't overflow.
    return completion.perHabit.map((h) => ({
      ...h,
      name: h.name.length > 20 ? h.name.slice(0, 19) + "…" : h.name,
    }));
  }, [completion]);

  const sortedStreaks = useMemo(() => {
    if (!streaks) return [];
    return [...streaks].sort((a, b) => b.currentStreak - a.currentStreak);
  }, [streaks]);

  const perHabitChartHeight = Math.max(260, perHabitData.length * 38 + 40);

  if (loading && !completion) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (!loading && !hasData) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No analytics yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a few habits and check in for a couple of days to start seeing insights here.
          </p>
          <Button onClick={() => go({ name: "habits" })}>Create a habit</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      <YearlyHeatmap />

      <YearComparison />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 1. Weekly completion (last 12 weeks) */}
        <Card className="p-6">
          <CardHeading
            icon={CalendarDays}
            title="Weekly completion"
            description="Last 12 weeks · % of scheduled habits completed"
          />
          {completionLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <div className="h-[260px] mt-4 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    interval={"preserveStartEnd"}
                    angle={-40}
                    textAnchor="end"
                    height={60}
                    minTickGap={4}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                    formatter={(_value, _name, item) => {
                      const d = item?.payload as { completed: number; scheduled: number; pct: number } | undefined;
                      return [`${d?.completed ?? 0}/${d?.scheduled ?? 0} (${d?.pct ?? 0}%)`, "Completed"];
                    }}
                    labelFormatter={(label) => `Week of ${label}`}
                  />
                  <Bar dataKey="pct" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* 2. Per-habit completion rate */}
        <Card className="p-6">
          <CardHeading
            icon={Target}
            title="Per-habit completion rate"
            description="Last 30 days · % of scheduled days completed"
          />
          {completionLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : perHabitData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
              No habits to display.
            </div>
          ) : (
            <div className="mt-4" style={{ height: perHabitChartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={perHabitData}
                  layout="vertical"
                  margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                    formatter={(_value, _name, item) => {
                      const d = item?.payload as { completed: number; scheduled: number; rate: number } | undefined;
                      return [`${d?.completed ?? 0}/${d?.scheduled ?? 0} (${d?.rate ?? 0}%)`, "Completed"];
                    }}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {perHabitData.map((entry) => (
                      <Cell key={entry.habitId} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="rate"
                      position="right"
                      formatter={(v: number) => `${v}%`}
                      style={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* 3. Best/worst day of week */}
        <Card className="p-6">
          <CardHeading
            icon={Trophy}
            title="Best & worst day of week"
            description="Completion rate per weekday across the window"
          />
          {completionLoading ? (
            <Skeleton className="h-[180px] w-full mt-4" />
          ) : (
            <div className="mt-5 grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2">
              {dayOfWeek.map((d, i) => {
                const ratio = d.scheduled === 0 ? 0 : d.completed / d.scheduled;
                const isBest = d.day === bestDayIdx;
                const isWorst = d.day === worstDayIdx && bestDayIdx !== worstDayIdx;
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative overflow-hidden rounded-lg p-1.5 sm:p-2 flex flex-col items-center justify-center text-center aspect-[3/4] transition-all border",
                      (isBest || isWorst) ? "ring-2 ring-offset-1 ring-offset-background" : "",
                      isBest ? "border-amber-400 ring-amber-400" : isWorst ? "border-rose-400 ring-rose-400" : "border-border/60",
                    )}
                  >
                    {/* Fluid fill bar from bottom — height = completion ratio */}
                    {d.scheduled > 0 && ratio > 0 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 dark:bg-emerald-600/80 transition-all duration-500 ease-out"
                        style={{ height: `${ratio * 100}%` }}
                      />
                    )}
                    <div className="relative z-10 text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-foreground">
                      {WEEKDAYS[d.day]}
                    </div>
                    <div className="relative z-10 text-xs sm:text-base font-bold mt-1 text-foreground">
                      {d.scheduled === 0 ? "—" : `${d.pct}%`}
                    </div>
                    <div className="relative z-10 text-[8px] sm:text-[9px] mt-0.5 text-muted-foreground">
                      {d.scheduled === 0 ? "n/a" : `${d.completed}/${d.scheduled}`}
                    </div>
                    <div className="relative z-10 h-3 mt-1 flex items-center justify-center">
                      {isBest && <Trophy className="w-3 h-3 text-amber-500" />}
                      {isWorst && <Frown className="w-3 h-3 text-rose-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {bestDayIdx >= 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                Best: <span className="font-medium text-foreground">{WEEKDAYS[bestDayIdx]}</span>
              </span>
              {worstDayIdx >= 0 && worstDayIdx !== bestDayIdx && (
                <span className="inline-flex items-center gap-1">
                  <Frown className="w-3.5 h-3.5 text-rose-500" />
                  Toughest: <span className="font-medium text-foreground">{WEEKDAYS[worstDayIdx]}</span>
                </span>
              )}
            </div>
          )}
        </Card>

        {/* 4. Streak leaderboard */}
        <Card className="p-6">
          <CardHeading
            icon={ListOrdered}
            title="Streak leaderboard"
            description="Current streaks across all habits"
          />
          {streaksLoading ? (
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : sortedStreaks.length === 0 ? (
            <div className="mt-4 h-32 flex items-center justify-center text-sm text-muted-foreground">
              No habits tracked yet.
            </div>
          ) : (
            <div className="mt-4 space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {sortedStreaks.map((s, idx) => (
                <div
                  key={s.habitId}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                >
                  <div className="w-6 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                    {idx + 1}
                  </div>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: s.color + "20" }}
                  >
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress
                        value={s.completionRate}
                        className="h-1.5"
                      />
                      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                        {s.completionRate}%
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      <span className="tabular-nums">{s.currentStreak}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      best {s.longestStreak}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
      <p className="text-sm text-muted-foreground">
        Trends and patterns from the last 90 days.
      </p>
    </div>
  );
}

function CardHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Trophy;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="min-w-0">
        <div className="font-semibold leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Header />
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <Skeleton className="h-[260px] w-full mt-4" />
          </Card>
        ))}
      </div>
    </div>
  );
}
