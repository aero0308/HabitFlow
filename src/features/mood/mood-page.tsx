"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Smile,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  LineChart as LineChartIcon,
  BarChart3,
  Pencil,
  Trash2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Activity,
} from "lucide-react";
import {
  format,
  subDays,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isSameMonth,
} from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  useMoods,
  useMoodInsights,
  useDeleteMood,
} from "@/hooks/use-moods";
import {
  MOOD_EMOJIS,
  MOOD_LABELS,
  moodColor,
  moodLabel,
  type MoodEntry,
  type MoodInsights,
} from "@/types/mood";
import { MoodLoggerCard } from "./mood-logger-card";
import { MoodModal } from "./mood-modal";
import { cn } from "@/lib/utils";

const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Heatmap color class for a mood score. */
function moodHeatmapClass(score: number | undefined): string {
  if (score === undefined) return "bg-muted/30 dark:bg-muted/20";
  if (score <= 3) return "bg-red-400/80 dark:bg-red-700/70";
  if (score <= 6) return "bg-amber-400/80 dark:bg-amber-600/70";
  return "bg-emerald-400/80 dark:bg-emerald-600/70";
}

function trendMeta(trend: MoodInsights["moodTrend"]) {
  switch (trend) {
    case "improving":
      return {
        icon: TrendingUp,
        label: "Improving",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
      };
    case "declining":
      return {
        icon: TrendingDown,
        label: "Declining",
        color: "text-red-500 dark:text-red-400",
        bg: "bg-red-500/10",
      };
    default:
      return {
        icon: Minus,
        label: "Stable",
        color: "text-muted-foreground",
        bg: "bg-muted",
      };
  }
}

export function MoodPage() {
  const today = new Date();
  const from = format(subDays(today, 29), "yyyy-MM-dd");
  const to = format(today, "yyyy-MM-dd");

  const { data: moods, isLoading: moodsLoading } = useMoods(from, to);
  const { data: insights, isLoading: insightsLoading } = useMoodInsights();
  const deleteMood = useDeleteMood();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const moodsByDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    (moods ?? []).forEach((m) => map.set(m.date, m));
    return map;
  }, [moods]);

  // ---- Chart data: 30-day trend ----
  const trendData = Array.from({ length: 30 }).map((_, i) => {
    const d = subDays(today, 29 - i);
    const ds = format(d, "yyyy-MM-dd");
    const entry = moodsByDate.get(ds);
    return {
      date: ds,
      label: format(d, "MMM d"),
      shortLabel: format(d, "d"),
      score: entry ? entry.score : null,
    };
  });

  // ---- Chart data: avg mood per day-of-week (last 30d) ----
  const dowData = useMemo(() => {
    const buckets: { sum: number; count: number }[] = WEEKDAYS_FULL.map(() => ({
      sum: 0,
      count: 0,
    }));
    (moods ?? []).forEach((m) => {
      const d = parseISO(m.date);
      // Mon-first index
      const idx = (getDay(d) + 6) % 7;
      buckets[idx].sum += m.score;
      buckets[idx].count += 1;
    });
    return WEEKDAYS_SHORT.map((label, i) => ({
      day: label,
      avg: buckets[i].count > 0 ? Number((buckets[i].sum / buckets[i].count).toFixed(1)) : null,
    }));
  }, [moods]);

  const hasData = (moods ?? []).length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Smile className="w-7 h-7 text-violet-500" />
            Mood
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track how you feel and discover what moves the needle.
          </p>
        </div>
      </motion.div>

      {/* a+b. Mood logger (left) + Calendar (right) — side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MoodLoggerCard onEdit={() => setModalOpen(true)} onViewInsights={() => {
          const insightsEl = document.getElementById("mood-insights-section");
          if (insightsEl) insightsEl.scrollIntoView({ behavior: "smooth" });
        }} />
        <MoodCalendar
          month={today}
          moodsByDate={moodsByDate}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          isLoading={moodsLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* c. Line chart: 30-day trend */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <LineChartIcon className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold">Last 30 days</h2>
          </div>
          {moodsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : hasData ? (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 8, right: 4, left: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="moodLineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickFormatter={(l) => l.split(" ")[1]}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[1, 10]}
                    ticks={[1, 5, 10]}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                    className="text-muted-foreground"
                    width={40}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                      padding: "6px 10px",
                    }}
                    formatter={(v) => [`${v}/10`, "Mood"] as [string, string]}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: "#8b5cf6", strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: "#7c3aed", stroke: "var(--background)", strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="Log a few moods to see your trend." />
          )}
        </Card>

        {/* d. Bar chart: avg by day of week */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold">Avg by day of week</h2>
          </div>
          {moodsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : hasData ? (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dowData}
                  margin={{ top: 8, right: 4, left: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 5, 10]}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                    className="text-muted-foreground"
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                      padding: "6px 10px",
                    }}
                    formatter={(v) => [v ? `${v}/10` : "—", "Avg mood"]}
                  />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {dowData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.avg === null
                            ? "var(--muted)"
                            : entry.avg <= 3
                              ? "#ef4444"
                              : entry.avg <= 6
                                ? "#f59e0b"
                                : "#8b5cf6"
                        }
                        fillOpacity={entry.avg === null ? 0.4 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="No data yet." />
          )}
        </Card>
      </div>

      {/* e. Insights panel */}
      <div id="mood-insights-section">
      <MoodInsightsPanel
        insights={insights}
        isLoading={insightsLoading}
        hasData={hasData}
      />
      </div>

      {/* f. Recent entries list */}
      <RecentEntries
        moods={moods ?? []}
        isLoading={moodsLoading}
        onEdit={(entry) => setModalOpen(true)}
        onDelete={(id) => deleteMood.mutate(id)}
      />

      <MoodModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-48 w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <Sparkles className="w-5 h-5 text-violet-500/50" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

/** Month-grid calendar heatmap coloured by mood score. */
function MoodCalendar({
  month,
  moodsByDate,
  selectedDay,
  onSelectDay,
  isLoading,
}: {
  month: Date;
  moodsByDate: Map<string, MoodEntry>;
  selectedDay: string | null;
  onSelectDay: (d: string | null) => void;
  isLoading: boolean;
}) {
  const grid = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    const padFront = (getDay(days[0]) + 6) % 7;
    const padded: (Date | null)[] = [
      ...Array(padFront).fill(null),
      ...days,
    ];
    return padded;
  }, [month]);

  const selectedEntry = selectedDay ? moodsByDate.get(selectedDay) : null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-violet-500" />
          <h2 className="text-sm font-semibold">{format(month, "MMMM yyyy")}</h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>Low</span>
          <div className="w-3 h-3 rounded bg-red-400/80 dark:bg-red-700/70" />
          <div className="w-3 h-3 rounded bg-amber-400/80 dark:bg-amber-600/70" />
          <div className="w-3 h-3 rounded bg-emerald-400/80 dark:bg-emerald-600/70" />
          <span>High</span>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div>
          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {WEEKDAYS_SHORT.map((d) => (
              <div
                key={d}
                className="text-center text-[9px] font-semibold text-muted-foreground py-0.5 uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((date, i) => {
              if (!date) return <div key={i} />;
              const ds = format(date, "yyyy-MM-dd");
              const entry = moodsByDate.get(ds);
              const selected = selectedDay === ds;
              return (
                <button
                  key={ds}
                  onClick={() => onSelectDay(selected ? null : ds)}
                  className={cn(
                    "h-7 rounded text-[10px] flex items-center justify-center transition-all relative",
                    "hover:scale-105 hover:ring-1 hover:ring-violet-400",
                    moodHeatmapClass(entry?.score),
                    isToday(date) && "ring-1 ring-violet-500",
                    selected && "ring-2 ring-violet-600",
                    !isSameMonth(date, month) && "opacity-40",
                  )}
                  title={
                    entry
                      ? `${format(date, "EEE MMM d")}: ${entry.score}/10 ${moodLabel(entry.score)}`
                      : `${format(date, "EEE MMM d")}: no entry`
                  }
                  aria-label={
                    entry
                      ? `${format(date, "MMMM d")}, mood ${entry.score} out of 10`
                      : `${format(date, "MMMM d")}, no mood entry`
                  }
                >
                  <span
                    className={cn(
                      "font-medium",
                      entry
                        ? entry.score > 4
                          ? "text-white dark:text-white"
                          : "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {date.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
              className="mt-4 pt-4 border-t border-border/60"
            >
              {selectedEntry ? (
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-xl border",
                      moodColor(selectedEntry.score).bg,
                      moodColor(selectedEntry.score).border,
                    )}
                  >
                    {MOOD_EMOJIS[selectedEntry.score - 1]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {format(parseISO(selectedEntry.date), "EEEE, MMM d")}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium px-1.5 py-0.5 rounded-md",
                          moodColor(selectedEntry.score).bg,
                          moodColor(selectedEntry.score).text,
                        )}
                      >
                        {selectedEntry.score}/10 · {moodLabel(selectedEntry.score)}
                      </span>
                    </div>
                    {selectedEntry.note && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        &ldquo;{selectedEntry.note}&rdquo;
                      </p>
                    )}
                    {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {selectedEntry.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/15"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {format(parseISO(selectedDay), "EEEE, MMM d")} — no mood entry.
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Insights panel with framer-motion staggered entrance. */
function MoodInsightsPanel({
  insights,
  isLoading,
  hasData,
}: {
  insights: MoodInsights | undefined;
  isLoading: boolean;
  hasData: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!insights || !insights.hasData || !hasData) {
    return (
      <Card className="p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
          <Activity className="w-6 h-6 text-violet-500" />
        </div>
        <p className="font-medium mb-1">No insights yet</p>
        <p className="text-sm text-muted-foreground">
          Log a few moods and HabitFlow will surface patterns here.
        </p>
      </Card>
    );
  }

  const trend = trendMeta(insights.moodTrend);
  const TrendIcon = trend.icon;
  const avgColor = moodColor(insights.averageScore);

  // Build habit-correlation chart data from averageScoreByHabitsCompleted
  const corrData = [0, 1, 2, 3].map((n) => {
    const key = n === 3 ? "3+" : String(n);
    const v = insights.averageScoreByHabitsCompleted?.[key];
    return {
      bucket: key,
      avg: v !== undefined && v !== null ? Number(v.toFixed(1)) : null,
    };
  });
  const hasCorr = corrData.some((d) => d.avg !== null);
  const boostDelta = (() => {
    const a = insights.averageScoreByHabitsCompleted?.["0"];
    const b = insights.averageScoreByHabitsCompleted?.["3+"];
    if (a === undefined || b === undefined) return null;
    return Number((b - a).toFixed(1));
  })();

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
      }}
      initial="hidden"
      animate="visible"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {/* Avg score */}
      <InsightCard title="Average mood" icon={Smile}>
        <div className="flex items-end gap-2">
          <span
            className={cn(
              "text-4xl font-bold tabular-nums leading-none",
              avgColor.text,
            )}
          >
            {insights.averageScore.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground mb-1">/ 10</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {moodLabel(Math.round(insights.averageScore))} ·{" "}
          {insights.totalEntries} entries
        </p>
      </InsightCard>

      {/* Trend */}
      <InsightCard title="Trend" icon={TrendIcon}>
        <div className="flex items-center gap-2">
          <span className={cn("text-2xl font-semibold", trend.color)}>
            {trend.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Comparing recent entries to earlier ones.
        </p>
      </InsightCard>

      {/* Best / worst day */}
      <InsightCard title="Best & worst" icon={Sparkles}>
        <div className="space-y-1.5">
          {insights.bestDay && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <ArrowUp className="w-3 h-3 text-emerald-500" /> Best
              </span>
              <span className="font-medium">
                {format(parseISO(insights.bestDay.date), "MMM d")} ·{" "}
                <span className="text-emerald-600 dark:text-emerald-400">
                  {insights.bestDay.score}/10
                </span>
              </span>
            </div>
          )}
          {insights.worstDay && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <ArrowDown className="w-3 h-3 text-red-500" /> Worst
              </span>
              <span className="font-medium">
                {format(parseISO(insights.worstDay.date), "MMM d")} ·{" "}
                <span className="text-red-500 dark:text-red-400">
                  {insights.worstDay.score}/10
                </span>
              </span>
            </div>
          )}
          {!insights.bestDay && !insights.worstDay && (
            <p className="text-xs text-muted-foreground">Not enough data.</p>
          )}
        </div>
      </InsightCard>

      {/* Mood vs habits correlation */}
      <InsightCard
        title="Mood vs. habits"
        icon={BarChart3}
        className="sm:col-span-2 lg:col-span-3"
      >
        {hasCorr ? (
          <div className="grid gap-4 md:grid-cols-2 items-center">
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={corrData}
                  margin={{ top: 8, right: 4, left: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 5, 10]}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                    className="text-muted-foreground"
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                      padding: "6px 10px",
                    }}
                    formatter={(v) => [v !== null ? `${v}/10` : "—", "Avg mood"]}
                    labelFormatter={(l) => `${l} habits completed`}
                  />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {corrData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.avg === null
                            ? "var(--muted)"
                            : entry.avg <= 3
                              ? "#ef4444"
                              : entry.avg <= 6
                                ? "#f59e0b"
                                : "#8b5cf6"
                        }
                        fillOpacity={entry.avg === null ? 0.4 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">Insight</p>
                <p className="text-sm font-medium">
                  {boostDelta !== null && boostDelta > 0 ? (
                    <>
                      Completing 3+ habits correlates with a{" "}
                      <span className="text-violet-600 dark:text-violet-300">
                        +{boostDelta.toFixed(1)} point
                      </span>{" "}
                      mood boost.
                    </>
                  ) : boostDelta !== null && boostDelta < 0 ? (
                    <>
                      Completing 3+ habits correlates with a{" "}
                      <span className="text-red-500">
                        {boostDelta.toFixed(1)} point
                      </span>{" "}
                      mood change.
                    </>
                  ) : (
                    <>No clear correlation between habit completion and mood yet.</>
                  )}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Average mood on days with 0, 1, 2, or 3+ habits completed.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Not enough data to correlate habits with mood yet.
          </p>
        )}
      </InsightCard>

      {/* Habit impact list */}
      {insights.habitImpact.length > 0 && (
        <InsightCard
          title="Habit impact"
          icon={Activity}
          className="sm:col-span-2 lg:col-span-3"
        >
          <div className="space-y-2">
            {insights.habitImpact.map((h) => {
              const positive = h.delta >= 0;
              return (
                <div
                  key={h.habitId}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-background/40"
                >
                  <span className="text-base w-6 text-center flex-shrink-0">
                    {h.habitIcon || "•"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{h.habitName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      When done: {h.avgMoodWhenDone.toFixed(1)}/10 · When skipped:{" "}
                      {h.avgMoodWhenSkipped.toFixed(1)}/10
                    </div>
                  </div>
                  <div
                    className={cn(
                      "text-xs font-semibold px-2 py-1 rounded-md tabular-nums",
                      positive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-500 dark:text-red-400",
                    )}
                  >
                    {positive ? "+" : ""}
                    {h.delta.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </InsightCard>
      )}

      {/* Top tags */}
      {insights.topTags.length > 0 && (
        <InsightCard
          title="Top tags"
          icon={Sparkles}
          className="sm:col-span-2 lg:col-span-3"
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {insights.topTags.map((t) => {
              const tagColor = moodColor(t.avgScore);
              return (
                <div
                  key={t.tag}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-background/40"
                >
                  <span className="text-sm font-medium">#{t.tag}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      ×{t.count}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums",
                        tagColor.bg,
                        tagColor.text,
                      )}
                    >
                      {t.avgScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </InsightCard>
      )}
    </motion.div>
  );
}

function InsightCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: typeof Smile;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
        },
      }}
      className={className}
    >
      <Card className="p-4 h-full">
        <div className="flex items-center gap-1.5 mb-3">
          <Icon className="w-3.5 h-3.5 text-violet-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

/** Scrollable list of recent mood entries with edit/delete. */
function RecentEntries({
  moods,
  isLoading,
  onEdit,
  onDelete,
}: {
  moods: MoodEntry[];
  isLoading: boolean;
  onEdit: (entry: MoodEntry) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = useMemo(
    () => [...moods].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [moods],
  );

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Smile className="w-4 h-4 text-violet-500" /> Recent entries
        </h2>
        {sorted.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {sorted.length}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No mood entries yet. Tap an emoji above to get started.
        </div>
      ) : (
        <ScrollArea className="h-72 pr-3">
          <div className="space-y-2">
            {sorted.map((entry) => {
              const color = moodColor(entry.score);
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-border/60 bg-background/40 hover:border-violet-400/40 transition-colors"
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center text-lg border flex-shrink-0",
                      color.bg,
                      color.border,
                    )}
                  >
                    {MOOD_EMOJIS[entry.score - 1]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {format(parseISO(entry.date), "EEE, MMM d")}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums",
                          color.bg,
                          color.text,
                        )}
                      >
                        {entry.score}/10 · {moodLabel(entry.score)}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {entry.note}
                      </p>
                    )}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {entry.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/15"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => onEdit(entry)}
                      aria-label="Edit entry"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-500"
                      onClick={() => onDelete(entry.id)}
                      aria-label="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
