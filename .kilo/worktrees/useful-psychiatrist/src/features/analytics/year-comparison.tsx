"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  CalendarRange,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Flame,
  Sparkles,
  Target,
} from "lucide-react";
import { useYearComparison } from "@/hooks/use-analytics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MonthlyPoint {
  label: string;
  thisYear: number;
  lastYear: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    value?: number | string | ReadonlyArray<number | string>;
    name?: string | number;
    color?: string;
  }>;
  label?: string | number;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const thisYearRaw = payload.find((p) => p.dataKey === "thisYear")?.value;
  const lastYearRaw = payload.find((p) => p.dataKey === "lastYear")?.value;
  const thisYear = typeof thisYearRaw === "number" ? thisYearRaw : 0;
  const lastYear = typeof lastYearRaw === "number" ? lastYearRaw : 0;
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2 shadow-md text-xs min-w-[150px]">
      <div className="font-medium mb-1.5">{label}</div>
      <div className="flex items-center gap-3 tabular-nums">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">This year</span>
          <span className="ml-1 font-semibold">{thisYear}%</span>
        </span>
        <span className="text-muted-foreground/60">/</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-muted-foreground">Last year</span>
          <span className="ml-1 font-semibold">{lastYear}%</span>
        </span>
      </div>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded tabular-nums bg-muted/40">
        0
      </span>
    );
  }
  const positive = delta > 0;
  const cls = positive
    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
    : "text-rose-500 dark:text-rose-400 bg-rose-500/10";
  const Icon = positive ? TrendingUp : TrendingDown;
  const sign = positive ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums",
        cls,
      )}
    >
      <Icon className="w-3 h-3" />
      {sign}
      {delta}
    </span>
  );
}

export function YearComparison() {
  const { data, isLoading } = useYearComparison();

  const mergedMonthly = useMemo<MonthlyPoint[]>(() => {
    if (!data) return [];
    const thisMap = new Map<number, number>();
    for (const m of data.thisYearStats.monthly) {
      const parts = m.month.split("-");
      const monthNum = parseInt(parts[1] ?? "0", 10);
      if (monthNum >= 1 && monthNum <= 12) thisMap.set(monthNum, m.rate);
    }
    const lastMap = new Map<number, number>();
    for (const m of data.lastYearStats.monthly) {
      const parts = m.month.split("-");
      const monthNum = parseInt(parts[1] ?? "0", 10);
      if (monthNum >= 1 && monthNum <= 12) lastMap.set(monthNum, m.rate);
    }
    const allMonths = Array.from(
      new Set<number>([...thisMap.keys(), ...lastMap.keys()]),
    ).sort((a, b) => a - b);
    return allMonths.map((monthNum) => ({
      label: format(
        parseISO(`2000-${String(monthNum).padStart(2, "0")}-01`),
        "MMM",
      ),
      thisYear: thisMap.get(monthNum) ?? 0,
      lastYear: lastMap.get(monthNum) ?? 0,
    }));
  }, [data]);

  if (isLoading || !data) {
    return <YearComparisonSkeleton />;
  }

  const { thisYear, lastYear, deltas } = data;
  const thisYearStats = data.thisYearStats;
  const lastYearStats = data.lastYearStats;

  // Treat lastYear as "no data" if every monthly entry is zero.
  const lastYearHasData = lastYearStats.monthly.some(
    (m) => m.scheduled > 0 || m.completed > 0,
  );

  const tiles: {
    label: string;
    icon: typeof Target;
    iconColor: string;
    iconBg: string;
    thisValue: string;
    lastValue: string;
    delta: number;
  }[] = [
    {
      label: "Completion rate",
      icon: Target,
      iconColor: "text-teal-600 dark:text-teal-400",
      iconBg: "bg-teal-500/10",
      thisValue: `${thisYearStats.overallRate}%`,
      lastValue: `${lastYearStats.overallRate}%`,
      delta: deltas.overallRate,
    },
    {
      label: "Check-ins",
      icon: CheckCircle2,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10",
      thisValue: String(thisYearStats.totalCompleted),
      lastValue: String(lastYearStats.totalCompleted),
      delta: deltas.totalCompleted,
    },
    {
      label: "Active days",
      icon: Flame,
      iconColor: "text-orange-500 dark:text-orange-400",
      iconBg: "bg-orange-500/10",
      thisValue: String(thisYearStats.activeDays),
      lastValue: String(lastYearStats.activeDays),
      delta: deltas.activeDays,
    },
    {
      label: "Perfect days",
      icon: Sparkles,
      iconColor: "text-amber-500 dark:text-amber-400",
      iconBg: "bg-amber-500/10",
      thisValue: String(thisYearStats.perfectDays),
      lastValue: String(lastYearStats.perfectDays),
      delta: deltas.perfectDays,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <CalendarRange className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight">Year-over-year</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {thisYear} vs {lastYear} · Jan 1 – today
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-lg border border-border/60 bg-card/40 p-2.5 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
                    t.iconBg,
                  )}
                >
                  <t.icon className={cn("w-3.5 h-3.5", t.iconColor)} />
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                  {t.label}
                </div>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <div className="text-xl font-bold tabular-nums leading-none">
                  {t.thisValue}
                </div>
                <DeltaBadge delta={t.delta} />
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums leading-tight">
                {t.lastValue} · {lastYear} last year
              </div>
            </div>
          ))}
        </div>

        {/* Chart or friendly note */}
        <div className="mt-5 pt-4 border-t border-border/60">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Monthly completion rate
          </div>
          {!lastYearHasData ? (
            <div className="h-[240px] flex flex-col items-center justify-center text-center gap-1.5 text-sm text-muted-foreground">
              <CalendarRange className="w-6 h-6 text-muted-foreground/60" />
              <div className="font-medium">No data for {lastYear} yet</div>
              <div className="text-xs text-muted-foreground/80">
                Keep tracking — your {thisYear} activity will appear here.
              </div>
            </div>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mergedMonthly}
                  margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)" strokeOpacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: "var(--muted-foreground)",
                    }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{
                      fontSize: 11,
                      fill: "var(--muted-foreground)",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    unit="%"
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    iconType="circle"
                  />
                  <Bar
                    dataKey="thisYear"
                    fill="#10b981"
                    name={String(thisYear)}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                  <Bar
                    dataKey="lastYear"
                    fill="#94a3b8"
                    name={String(lastYear)}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function YearComparisonSkeleton() {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-5 h-[240px] w-full rounded-md" />
    </Card>
  );
}
