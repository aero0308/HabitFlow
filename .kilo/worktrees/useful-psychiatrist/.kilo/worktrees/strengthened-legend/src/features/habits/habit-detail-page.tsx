"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ChevronLeft,
  Flame,
  Trophy,
  CheckCircle2,
  Target,
  Pencil,
  CalendarDays,
  BarChart3,
  StickyNote,
  CircleDashed,
  Snowflake,
} from "lucide-react";
import { format, parseISO, getDay } from "date-fns";
import { useHabitDetail } from "@/hooks/use-analytics";
import { useFreezeDay, useUnfreezeDay, useFreezes } from "@/hooks/use-habits";
import { useNav } from "@/lib/nav-store";
import { HabitEditDialog } from "@/features/habits/HabitEditDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_LABELS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const tooltipStyle = {
  borderRadius: 8,
  fontSize: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

function freqLabel(frequency: string, customDays: number[]): string {
  if (frequency === "daily") return "Every day";
  if (frequency === "weekly") return "Weekly";
  return `Custom · ${customDays.map((d) => WEEKDAYS[d]).join(", ") || "—"}`;
}

/** Build GitHub-style week columns from the flat 90-day calendar array. */
function buildWeeks(
  calendar: { date: string; scheduled: boolean; count: number; targetCount: number; completed: boolean }[],
) {
  if (calendar.length === 0) return { weeks: [] as (typeof calendar[number] | null)[][], monthMarkers: [] as { col: number; label: string }[] };

  const first = calendar[0];
  const firstMonFirst = (getDay(parseISO(first.date)) + 6) % 7;

  // Flat list with leading null padding so the first column starts on Monday.
  const padded: (typeof calendar[number] | null)[] = [
    ...Array(firstMonFirst).fill(null),
    ...calendar,
  ];

  // Group into 7-cell columns (each column = 1 week, Mon..Sun top→bottom).
  const weeks: (typeof calendar[number] | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // Month markers: for each week column, find the first non-null entry and
  // show its month abbreviation if it differs from the previous column's month.
  const monthMarkers: { col: number; label: string }[] = [];
  let lastMonth = "";
  for (let col = 0; col < weeks.length; col++) {
    const firstEntry = weeks[col].find((c) => c !== null);
    if (!firstEntry) continue;
    const month = format(parseISO(firstEntry.date), "MMM");
    if (month !== lastMonth) {
      monthMarkers.push({ col, label: month });
      lastMonth = month;
    }
  }

  return { weeks, monthMarkers };
}

function cellColor(
  cell: { scheduled: boolean; completed: boolean } | null,
): string {
  if (!cell) return "bg-transparent";
  if (!cell.scheduled) return "bg-muted/40 dark:bg-muted/30";
  if (cell.completed) return "bg-emerald-600 dark:bg-emerald-500";
  return "bg-emerald-200 dark:bg-emerald-900";
}

export function HabitDetailPage() {
  const { page, go } = useNav();
  const habitId = page.name === "habit" ? page.id : null;
  const { data, isLoading, isError } = useHabitDetail(habitId);
  const freezesQuery = useFreezes(habitId);
  const freezeMut = useFreezeDay();
  const unfreezeMut = useUnfreezeDay();
  const frozenDates = useMemo(
    () => new Set((freezesQuery.data ?? []).map((f) => f.date)),
    [freezesQuery.data],
  );

  const [editOpen, setEditOpen] = useState(false);

  if (page.name !== "habit") return null;

  if (isLoading) {
    return <HabitDetailSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <BackBar onBack={() => go({ name: "habits" })} />
        <Card className="p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
            <CircleDashed className="w-6 h-6 text-rose-500" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Habit not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This habit may have been deleted, or you don&apos;t have access to it.
          </p>
          <Button onClick={() => go({ name: "habits" })}>Back to habits</Button>
        </Card>
      </div>
    );
  }

  const { habit, streak, calendar, weekly, dayOfWeek, recentCheckins } = data;
  const { weeks, monthMarkers } = buildWeeks(calendar);

  const today = todayStr();
  const todayEntry = calendar.find((c) => c.date === today);
  const todayScheduled = todayEntry?.scheduled ?? false;
  const todayCompleted = todayEntry?.completed ?? false;
  const todayFrozen = frozenDates.has(today);
  const canFreezeToday = todayScheduled && !todayCompleted && !todayFrozen;
  const canUnfreezeToday = todayFrozen;

  const weeklyData = weekly.map((w) => ({
    ...w,
    label: format(parseISO(w.weekStart), "MMM d"),
  }));

  // Normalize day-of-week into a 7-cell array (Mon-first).
  const byIdx = new Map<number, { day: number; completed: number; scheduled: number; pct: number }>();
  for (const d of dayOfWeek) byIdx.set(d.day, d);
  const dowArr = Array.from({ length: 7 }, (_, i) =>
    byIdx.get(i) ?? { day: i, completed: 0, scheduled: 0, pct: 0 },
  );

  const bestDayIdx = (() => {
    let best = -1;
    let bestPct = -1;
    for (const d of dowArr) {
      if (d.scheduled === 0) continue;
      if (d.pct > bestPct) {
        bestPct = d.pct;
        best = d.day;
      }
    }
    return best;
  })();

  return (
    <div className="space-y-6">
      <BackBar onBack={() => go({ name: "habits" })} />

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: habit.color + "20" }}
        >
          {habit.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight break-words">{habit.name}</h1>
          {habit.description && (
            <p className="text-sm text-muted-foreground mt-1">{habit.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className="text-[11px] py-0.5 px-2 font-normal">
              {freqLabel(habit.frequency, habit.customDays)}
            </Badge>
            <Badge variant="secondary" className="text-[11px] py-0.5 px-2 gap-1">
              <Target className="w-3 h-3" />
              {habit.targetCount}/day
            </Badge>
            <Badge variant="secondary" className="text-[11px] py-0.5 px-2 gap-1">
              {habit.timeOfDay === "MORNING" ? "🌅" : habit.timeOfDay === "AFTERNOON" ? "☀️" : habit.timeOfDay === "EVENING" ? "🌙" : "🌤️"}
              {" "}
              {habit.timeOfDay === "MORNING" ? "Morning" : habit.timeOfDay === "AFTERNOON" ? "Afternoon" : habit.timeOfDay === "EVENING" ? "Evening" : "Any Time"}
            </Badge>
            <Badge variant="secondary" className="text-[11px] py-0.5 px-2">
              Since {format(parseISO(habit.startDate), "MMM d, yyyy")}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="w-4 h-4 mr-1" /> Edit
        </Button>
      </div>

      {/* Streak summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Flame}
          label="Current streak"
          value={`${streak.currentStreak}`}
          unit="days"
          color="text-orange-500"
          bg="bg-orange-500/10"
        />
        <StatCard
          icon={Trophy}
          label="Longest streak"
          value={`${streak.longestStreak}`}
          unit="days"
          color="text-amber-500"
          bg="bg-amber-500/10"
        />
        <StatCard
          icon={CheckCircle2}
          label="Total completions"
          value={`${streak.totalCompletions}`}
          unit="check-ins"
          color="text-emerald-600"
          bg="bg-emerald-500/10"
        />
        <StatCard
          icon={Target}
          label="Completion rate"
          value={`${streak.completionRate}`}
          unit="%"
          color="text-teal-600"
          bg="bg-teal-500/10"
        />
      </div>

      {/* 90-day GitHub-style heatmap */}
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Activity (last 90 days)</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Each square is a day. Green = completed, light = scheduled but missed.
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-start">
          {/* Heatmap */}
          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <div className="inline-flex flex-col gap-1 min-w-max">
              {/* Month labels row */}
              <div className="flex gap-[3px] mb-1 pl-7">
                {weeks.map((_, col) => {
                  const marker = monthMarkers.find((m) => m.col === col);
                  return (
                    <div
                      key={col}
                      className="w-[14px] text-[10px] text-muted-foreground font-medium"
                      style={{ minWidth: 14 }}
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
                        "text-[10px] leading-[14px] text-muted-foreground text-right pr-1",
                        i % 2 === 1 && "opacity-0",
                      )}
                      style={{ height: 14 }}
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
                            className="w-[14px] h-[14px] rounded-[2px] bg-transparent"
                          />
                        );
                      }
                      const isFrozen = frozenDates.has(cell.date);
                      const dateFmt = format(parseISO(cell.date), "EEEE, MMM d, yyyy");
                      const statusText = isFrozen
                        ? "Frozen — streak protected"
                        : !cell.scheduled
                          ? "Not scheduled"
                          : cell.completed
                            ? `Completed (${cell.count}/${cell.targetCount})`
                            : `Missed (${cell.count}/${cell.targetCount})`;
                      return (
                        <div
                          key={row}
                          title={`${dateFmt} — ${statusText}`}
                          className={cn(
                            "w-[14px] h-[14px] rounded-[2px] transition-transform hover:scale-110",
                            isFrozen
                              ? "bg-sky-400 dark:bg-sky-700 ring-2 ring-sky-400 dark:ring-sky-500"
                              : cn("hover:ring-1 hover:ring-emerald-400", cellColor(cell)),
                          )}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats summary panel */}
          <div className="flex flex-col gap-3 min-w-[180px]">
            <div className="rounded-lg border border-border/60 p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">90-day summary</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Completed</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {data.calendar.filter((d) => d.completed).length}
                    <span className="text-muted-foreground font-normal"> / {data.calendar.filter((d) => d.scheduled).length}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Completion rate</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {data.calendar.filter((d) => d.scheduled).length === 0
                      ? 0
                      : Math.round((data.calendar.filter((d) => d.completed).length / data.calendar.filter((d) => d.scheduled).length) * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Frozen days</span>
                  <span className="text-sm font-semibold tabular-nums text-sky-500">
                    {frozenDates.size}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current streak</span>
                  <span className="text-sm font-semibold tabular-nums text-orange-500">
                    {data.streak.currentStreak}d
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Longest streak</span>
                  <span className="text-sm font-semibold tabular-nums text-amber-500">
                    {data.streak.longestStreak}d
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className="w-3 h-3 rounded-[2px] bg-muted/40 dark:bg-muted/30" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-200 dark:bg-emerald-900" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-600 dark:bg-emerald-500" />
              <span>More</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Streak freeze */}
      {(canFreezeToday || canUnfreezeToday) && (
        <Card className="p-4 border-sky-200 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/20">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center flex-shrink-0">
              <Snowflake className="w-4 h-4 text-sky-500 dark:text-sky-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Streak freeze</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Freezing a day protects your streak when you can&apos;t complete a habit (like when sick or traveling).
              </div>
            </div>
            {canFreezeToday && (
              <Button
                variant="outline"
                size="sm"
                className="border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/30"
                disabled={freezeMut.isPending}
                onClick={() => {
                  if (!habitId) return;
                  freezeMut.mutate(
                    { habitId, date: today },
                    { onSuccess: () => void freezesQuery.refetch() },
                  );
                }}
              >
                <Snowflake className="w-4 h-4 mr-1" />
                Freeze today
              </Button>
            )}
            {canUnfreezeToday && (
              <Button
                variant="outline"
                size="sm"
                className="border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/30"
                disabled={unfreezeMut.isPending}
                onClick={() => {
                  if (!habitId) return;
                  unfreezeMut.mutate(
                    { habitId, date: today },
                    { onSuccess: () => void freezesQuery.refetch() },
                  );
                }}
              >
                Unfreeze
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Weekly chart + day-of-week breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="font-semibold leading-tight">Weekly completion</div>
              <div className="text-xs text-muted-foreground mt-0.5">Last 12 weeks · % of scheduled days</div>
            </div>
          </div>
          <div className="h-[260px] mt-4 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
                  width={32}
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
                <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {weeklyData.map((_, i) => (
                    <Cell key={i} fill={habit.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="font-semibold leading-tight">Day-of-week breakdown</div>
              <div className="text-xs text-muted-foreground mt-0.5">Completion rate per weekday (all-time)</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2">
            {dowArr.map((d, i) => {
              const ratio = d.scheduled === 0 ? 0 : d.completed / d.scheduled;
              const isBest = d.day === bestDayIdx;
              return (
                <div
                  key={i}
                  className={cn(
                    "relative overflow-hidden rounded-lg p-1.5 sm:p-2 flex flex-col items-center justify-center text-center aspect-[3/4] sm:aspect-[3/4] transition-all border",
                    isBest ? "border-amber-400 ring-2 ring-amber-400 ring-offset-1 ring-offset-background" : "border-border/60",
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
                    {isBest && <Trophy className="w-3 h-3 text-amber-300" />}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            <span className="text-foreground font-medium">{WEEKDAY_LABELS_LONG[bestDayIdx] ?? "—"}</span> is your strongest day.
          </p>
        </Card>
      </div>

      {/* Recent check-ins */}
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Recent check-ins</div>
            <div className="text-xs text-muted-foreground mt-0.5">Last {recentCheckins.length} entries</div>
          </div>
        </div>

        {recentCheckins.length === 0 ? (
          <div className="mt-4 py-8 text-center text-sm text-muted-foreground">
            No check-ins yet. Mark this habit done to start your streak!
          </div>
        ) : (
          <div className="mt-4 max-h-64 overflow-y-auto custom-scroll pr-2">
            <div className="space-y-1.5 pr-2">
              {recentCheckins
                .slice()
                .reverse()
                .map((c) => {
                  const target = habit.targetCount;
                  const completed = c.count >= target;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted/50 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-medium leading-none text-muted-foreground uppercase">
                          {format(parseISO(c.date), "MMM")}
                        </span>
                        <span className="text-sm font-bold leading-none mt-0.5">
                          {format(parseISO(c.date), "d")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          {format(parseISO(c.date), "EEEE, MMM d, yyyy")}
                        </div>
                        {c.note && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                            <StickyNote className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{c.note}</span>
                          </div>
                        )}
                      </div>
                      <Badge
                        variant={completed ? "default" : "secondary"}
                        className={cn(
                          "text-[11px] py-0.5 px-2 tabular-nums",
                          completed && "bg-emerald-600 hover:bg-emerald-700 text-white",
                        )}
                      >
                        {c.count}/{target}
                      </Badge>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Card>

      {/* Inline edit dialog — opens without navigating away */}
      <HabitEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        habit={{
          id: habit.id,
          name: habit.name,
          description: habit.description,
          color: habit.color,
          icon: habit.icon,
          frequency: habit.frequency,
          customDays: habit.customDays,
          targetCount: habit.targetCount,
          startDate: habit.startDate,
          category: habit.category,
          timeOfDay: habit.timeOfDay,
        }}
      />
    </div>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground -ml-2">
      <ChevronLeft className="w-4 h-4" /> Back to habits
    </Button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
  bg,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  unit: string;
  color: string;
  bg: string;
}) {
  return (
    <Card className="p-4 flex flex-col items-center justify-center gap-2 text-center">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", bg)}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-1 leading-none">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          <span className="text-[11px] text-muted-foreground">{unit}</span>
        </div>
        <div className="text-xs text-muted-foreground leading-none mt-1">{label}</div>
      </div>
    </Card>
  );
}

function HabitDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-36" />
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-72" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Card className="p-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 w-full mt-4" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-[260px] w-full mt-4" />
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <Skeleton className="h-9 w-48" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    </div>
  );
}
