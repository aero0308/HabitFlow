"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, parseISO, isToday, isYesterday, subDays } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  History as HistoryIcon,
  StickyNote,
  Filter,
  Search,
  CheckCircle2,
  ListChecks,
  Percent,
  Activity,
  CalendarDays,
  X,
} from "lucide-react";
import { useHistory } from "@/hooks/use-analytics";
import { useHabits } from "@/hooks/use-habits";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { HistoryItem } from "@/types";

export function HistoryPage() {
  const [selectedHabitId, setSelectedHabitId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useHistory(100, selectedHabitId);
  const { data: habits } = useHabits();

  const allItems: HistoryItem[] = data?.items ?? [];

  // Filter items by search query (habit name OR note text, case-insensitive).
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (it) =>
        it.habitName.toLowerCase().includes(q) ||
        (it.note ?? "").toLowerCase().includes(q),
    );
  }, [allItems, search]);

  // Stats summary — habit-count-based (completed items / total items).
  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.completed).length;
    const uniqueHabits = new Set(items.map((i) => i.habitId)).size;
    const uniqueDates = new Set(items.map((i) => i.date)).size;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, uniqueHabits, uniqueDates, completionRate };
  }, [items]);

  // Group items by date (most recent first), stable order within a day.
  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    const groups: { date: string; rows: HistoryItem[] }[] = [];
    for (const it of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.date === it.date) {
        last.rows.push(it);
      } else {
        groups.push({ date: it.date, rows: [it] });
      }
    }
    return groups;
  }, [items]);

  // Mini activity strip — last 30 days completion intensity.
  // Computed from allItems (habit-filtered) so the overview is unaffected by search.
  const activityStrip = useMemo(() => {
    const today = new Date();
    const map = new Map<string, { completed: number; total: number }>();
    for (const it of allItems) {
      const cur = map.get(it.date) ?? { completed: 0, total: 0 };
      cur.total += 1;
      if (it.completed) cur.completed += 1;
      map.set(it.date, cur);
    }
    const days: { date: string; ratio: number; hasActivity: boolean; completed: number; total: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const ds = format(d, "yyyy-MM-dd");
      const stat = map.get(ds);
      const ratio = stat && stat.total > 0 ? stat.completed / stat.total : 0;
      days.push({
        date: ds,
        ratio,
        hasActivity: !!stat,
        completed: stat?.completed ?? 0,
        total: stat?.total ?? 0,
      });
    }
    return days;
  }, [allItems]);

  let runningIdx = 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          Your recent check-ins across all habits
        </p>
      </motion.div>

      {/* Stats summary row */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            icon={ListChecks}
            label="Total check-ins"
            value={stats.total}
            color="text-emerald-500"
            bg="bg-emerald-500/10"
            delay={0}
          />
          <StatTile
            icon={Percent}
            label="Completion rate"
            value={`${stats.completionRate}%`}
            color="text-teal-500"
            bg="bg-teal-500/10"
            delay={0.05}
          />
          <StatTile
            icon={Activity}
            label="Active habits"
            value={stats.uniqueHabits}
            color="text-orange-500"
            bg="bg-orange-500/10"
            delay={0.1}
          />
          <StatTile
            icon={CalendarDays}
            label="Days tracked"
            value={stats.uniqueDates}
            color="text-amber-500"
            bg="bg-amber-500/10"
            delay={0.15}
          />
        </div>
      )}

      {/* Mini activity strip (last 30 days) */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-500" />
            Last 30 days
          </h2>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-muted/60" />
            <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
            <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
            <div className="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
            <span>More</span>
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-3 w-full" />
        ) : (
          <div className="flex flex-wrap gap-1">
            {activityStrip.map((d) => (
              <div
                key={d.date}
                title={`${format(parseISO(d.date), "MMM d")}: ${d.completed}/${d.total} completed`}
                className={cn(
                  "w-3 h-3 rounded-sm transition-transform hover:scale-125 cursor-default",
                  intensityClass(d.ratio, d.hasActivity),
                )}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Search + habit filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search check-ins..."
            className="pl-9 pr-9"
            aria-label="Search check-ins"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select
          value={selectedHabitId ?? "all"}
          onValueChange={(v) => setSelectedHabitId(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[210px]" size="sm">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <SelectValue placeholder="All habits" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All habits</SelectItem>
            {habits?.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden>{h.icon}</span>
                  <span>{h.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      <Card className="p-4 sm:p-6">
        {isLoading ? (
          <HistoryLoadingSkeleton />
        ) : items.length === 0 ? (
          <EmptyState filtered={!!selectedHabitId || !!search.trim()} />
        ) : (
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto custom-scroll pr-2">
            {grouped.map((group) => {
              const dateLabel = formatGroupHeader(group.date);
              const dayCompleted = group.rows.filter((r) => r.completed).length;
              return (
                <div key={group.date} className="mb-3">
                  <div className="sticky top-0 z-10 py-2 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {dateLabel}
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-normal h-5 tabular-nums">
                      {dayCompleted}/{group.rows.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {group.rows.map((item) => {
                      const idx = runningIdx++;
                      return (
                        <HistoryRow key={item.id} item={item} index={idx} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function HistoryRow({
  item,
  index,
}: {
  item: HistoryItem;
  index: number;
}) {
  const timeFmt = format(parseISO(item.createdAt), "h:mm a");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.03, 0.6),
        duration: 0.25,
        ease: "easeOut",
      }}
      className={cn(
        "relative ml-2 pl-4 pr-3 py-3 rounded-lg border bg-card hover:shadow-md hover:border-foreground/20 transition-all",
        item.completed
          ? "border-emerald-500/30 bg-emerald-500/[0.03]"
          : "border-border",
      )}
    >
      {/* Colored marker (habit color) */}
      <div
        className="absolute -left-1.5 top-4 w-3 h-3 rounded-full ring-4 ring-background"
        style={{ backgroundColor: item.habitColor }}
      />
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: item.habitColor + "20" }}
        >
          {item.habitIcon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{item.habitName}</span>
            {item.completed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : null}
            <span className="text-xs text-muted-foreground tabular-nums">
              {timeFmt}
            </span>
          </div>
          {item.note ? (
            <div className="mt-2 flex items-start gap-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800/40 rounded-md px-2.5 py-1.5">
              <StickyNote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
              <span className="italic leading-relaxed">{item.note}</span>
            </div>
          ) : null}
        </div>
        <Badge
          className={cn(
            "tabular-nums flex-shrink-0 border-transparent font-semibold h-6",
            item.completed
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
          )}
        >
          {item.count}/{item.targetCount}
        </Badge>
      </div>
    </motion.div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
  bg,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
  bg: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Card className="p-3 hover:shadow-md transition-shadow h-full">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", bg)}>
            <Icon className={cn("w-4 h-4", color)} />
          </div>
          <div className="text-xl font-bold tabular-nums leading-none truncate">
            {value}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-2">{label}</div>
      </Card>
    </motion.div>
  );
}

function intensityClass(ratio: number, hasActivity: boolean): string {
  if (!hasActivity) return "bg-muted/30";
  if (ratio === 0) return "bg-muted/60 dark:bg-muted/40";
  if (ratio < 0.34) return "bg-emerald-200 dark:bg-emerald-900";
  if (ratio < 0.67) return "bg-emerald-400 dark:bg-emerald-700";
  if (ratio < 1) return "bg-emerald-500 dark:bg-emerald-600";
  return "bg-emerald-600 dark:bg-emerald-500";
}

function formatGroupHeader(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, MMM d, yyyy");
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
        <HistoryIcon className="w-6 h-6 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold mb-1">
        {filtered ? "No matching check-ins" : "No check-ins yet"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        {filtered
          ? "Try a different search term, choose another habit, or clear filters to see everything."
          : "Start checking in your habits from the dashboard and they'll appear here in your timeline."}
      </p>
    </div>
  );
}

function HistoryLoadingSkeleton() {
  return (
    <div className="max-h-[calc(100vh-220px)] overflow-y-auto custom-scroll pr-2 space-y-2">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
  );
}
