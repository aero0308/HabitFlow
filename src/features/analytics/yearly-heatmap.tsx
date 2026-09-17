"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, parseISO, getDay, isToday } from "date-fns";
import { CheckCircle2, Flame, Sparkles, Target, CalendarDays, Filter } from "lucide-react";
import { useYearlyHeatmap } from "@/hooks/use-analytics";
import { useHabits } from "@/hooks/use-habits";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { YearlyHeatmapDay } from "@/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Background intensity class for a given day in the heatmap. */
function dayIntensity(day: YearlyHeatmapDay): string {
  if (day.scheduled === 0) return "bg-muted/30";
  if (day.ratio === 0) return "bg-muted/60 dark:bg-muted/40";
  if (day.ratio < 0.34) return "bg-emerald-200 dark:bg-emerald-900";
  if (day.ratio < 0.67) return "bg-emerald-400 dark:bg-emerald-700";
  if (day.ratio < 1) return "bg-emerald-500 dark:bg-emerald-600";
  return "bg-emerald-600 dark:bg-emerald-500";
}

function dayTooltip(day: YearlyHeatmapDay): string {
  const pretty = format(parseISO(day.date), "EEE, MMM d, yyyy");
  if (day.scheduled === 0) return `${pretty}: No habits scheduled`;
  return `${pretty}: ${day.completed}/${day.scheduled} completed`;
}

/** Build GitHub-style week columns from the flat days array. */
function buildWeeks(days: YearlyHeatmapDay[]) {
  if (days.length === 0) {
    return {
      weeks: [] as (YearlyHeatmapDay | null)[][],
      monthMarkers: [] as { col: number; label: string }[],
    };
  }

  const first = days[0];
  // Mon-first offset: JS getDay returns 0=Sun..6=Sat; (+6) % 7 → 0=Mon..6=Sun.
  const firstMonFirst = (getDay(parseISO(first.date)) + 6) % 7;

  // Leading null padding so the first column starts on Monday.
  const padded: (YearlyHeatmapDay | null)[] = [
    ...Array(firstMonFirst).fill(null),
    ...days,
  ];

  // Group into 7-cell columns (each column = 1 week, Mon..Sun top→bottom).
  const weeks: (YearlyHeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // Month markers: only render a label when the month changes between columns.
  const monthMarkers: { col: number; label: string }[] = [];
  let lastMonth = "";
  for (let col = 0; col < weeks.length; col++) {
    const firstEntry = weeks[col].find((c): c is YearlyHeatmapDay => c !== null);
    if (!firstEntry) continue;
    const month = format(parseISO(firstEntry.date), "MMM");
    if (month !== lastMonth) {
      monthMarkers.push({ col, label: month });
      lastMonth = month;
    }
  }

  return { weeks, monthMarkers };
}

export function YearlyHeatmap() {
  const [selectedHabit, setSelectedHabit] = useState<string>("all");
  const habitId = selectedHabit === "all" ? undefined : selectedHabit;
  const { data, isLoading } = useYearlyHeatmap(undefined, habitId);
  const { data: habits } = useHabits(false);

  if (isLoading || !data) {
    return <YearlyHeatmapSkeleton />;
  }

  const { stats } = data;
  const filteredHabitName = habitId
    ? habits?.find((h) => h.id === habitId)?.name
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="p-4 sm:p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <HeatmapHeader stats={stats} habitName={filteredHabitName} />
          {(habits ?? []).length > 0 && (
            <Select value={selectedHabit} onValueChange={setSelectedHabit}>
              <SelectTrigger size="sm" className="w-[180px]">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All habits</SelectItem>
                {(habits ?? []).map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.icon} {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <StatsRow stats={stats} />
        <HeatmapGrid days={data.days} />
        <MonthlyBreakdown monthly={data.monthly} />
      </Card>
    </motion.div>
  );
}

function HeatmapHeader({
  stats,
  habitName,
}: {
  stats: {
    totalDays: number;
    totalCompleted: number;
    overallRate: number;
  };
  habitName?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
        <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="min-w-0">
        <div className="font-semibold leading-tight">
          Yearly activity{habitName ? <span className="text-muted-foreground font-normal"> · {habitName}</span> : null}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Last {stats.totalDays} days · {stats.totalCompleted} check-ins · {stats.overallRate}% completion rate
        </div>
      </div>
    </div>
  );
}

type Stats = {
  totalCompleted: number;
  activeDays: number;
  perfectDays: number;
  overallRate: number;
};

function StatsRow({ stats }: { stats: Stats }) {
  const tiles: {
    label: string;
    value: string;
    icon: typeof CheckCircle2;
    color: string;
    bg: string;
  }[] = [
    {
      label: "Completed",
      value: String(stats.totalCompleted),
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Active days",
      value: String(stats.activeDays),
      icon: Flame,
      color: "text-orange-500 dark:text-orange-400",
      bg: "bg-orange-500/10",
    },
    {
      label: "Perfect days",
      value: String(stats.perfectDays),
      icon: Sparkles,
      color: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Completion rate",
      value: `${stats.overallRate}%`,
      icon: Target,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-500/10",
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-lg border border-border/60 bg-card/40 p-2.5 flex items-center gap-2.5"
        >
          <div
            className={cn(
              "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
              t.bg,
            )}
          >
            <t.icon className={cn("w-4 h-4", t.color)} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
              {t.label}
            </div>
            <div className="text-base font-semibold tabular-nums leading-tight">
              {t.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatmapGrid({ days }: { days: YearlyHeatmapDay[] }) {
  const { weeks, monthMarkers } = useMemo(() => buildWeeks(days), [days]);

  return (
    <div className="mt-5">
      <div className="overflow-x-auto scrollbar-thin pb-2 -mx-1 px-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* Month labels row */}
          <div className="flex gap-[3px] mb-1 pl-7">
            {weeks.map((_, col) => {
              const marker = monthMarkers.find((m) => m.col === col);
              return (
                <div
                  key={col}
                  className="w-3 text-[10px] text-muted-foreground font-medium"
                  style={{ minWidth: 12 }}
                >
                  {marker ? marker.label : ""}
                </div>
              );
            })}
          </div>

          {/* Day-of-week label column + cells */}
          <div className="flex gap-1">
            <div className="flex flex-col gap-[3px] pr-1">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    "text-[10px] leading-3 text-muted-foreground text-right pr-1",
                    i % 2 === 1 && "opacity-0",
                  )}
                  style={{ height: 12, lineHeight: "12px" }}
                >
                  {d}
                </div>
              ))}
            </div>

            {weeks.map((week, col) => (
              <div key={col} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, row) => {
                  const cell = week[row] ?? null;
                  if (!cell) {
                    return (
                      <div
                        key={row}
                        className="w-3 h-3 rounded-[2px] bg-transparent"
                      />
                    );
                  }
                  const isTodayCell = isToday(parseISO(cell.date));
                  return (
                    <div
                      key={row}
                      title={dayTooltip(cell)}
                      className={cn(
                        "w-3 h-3 rounded-[2px] transition-colors hover:ring-1 hover:ring-emerald-400",
                        dayIntensity(cell),
                        isTodayCell && "ring-1 ring-emerald-500 ring-offset-1 ring-offset-background",
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="w-3 h-3 rounded-[2px] bg-muted/60 dark:bg-muted/40" />
        <div className="w-3 h-3 rounded-[2px] bg-emerald-200 dark:bg-emerald-900" />
        <div className="w-3 h-3 rounded-[2px] bg-emerald-400 dark:bg-emerald-700" />
        <div className="w-3 h-3 rounded-[2px] bg-emerald-500 dark:bg-emerald-600" />
        <div className="w-3 h-3 rounded-[2px] bg-emerald-600 dark:bg-emerald-500" />
        <span>More</span>
      </div>
    </div>
  );
}

function MonthlyBreakdown({
  monthly,
}: {
  monthly: { month: string; completed: number; scheduled: number; rate: number }[];
}) {
  if (monthly.length === 0) return null;

  const maxRate = 100; // rate is 0-100 per the type spec

  return (
    <div className="mt-5 pt-4 border-t border-border/60">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Monthly completion rate
      </div>
      <div className="flex items-end gap-1 h-20">
        {monthly.map((m) => {
          const heightPct = Math.max(4, (m.rate / maxRate) * 100);
          const label = format(parseISO(`${m.month}-01`), "MMM");
          return (
            <div
              key={m.month}
              title={`${m.month}: ${m.completed}/${m.scheduled} (${m.rate}%)`}
              className="flex-1 min-w-0 flex flex-col items-center gap-1 group cursor-default"
            >
              <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
                <div
                  className={cn(
                    "w-full max-w-[20px] rounded-t-[3px] transition-colors",
                    m.rate === 0
                      ? "bg-muted/60 dark:bg-muted/40"
                      : m.rate < 34
                        ? "bg-emerald-200 dark:bg-emerald-900"
                        : m.rate < 67
                          ? "bg-emerald-400 dark:bg-emerald-700"
                          : m.rate < 100
                            ? "bg-emerald-500 dark:bg-emerald-600"
                            : "bg-emerald-600 dark:bg-emerald-500",
                    "group-hover:ring-1 group-hover:ring-emerald-400",
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <div className="text-[9px] text-muted-foreground font-medium truncate w-full text-center">
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearlyHeatmapSkeleton() {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-5 h-[120px] w-full rounded-md" />
      <Skeleton className="mt-4 h-16 w-full rounded-md" />
    </Card>
  );
}
