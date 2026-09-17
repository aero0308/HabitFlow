"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, TrendingUp, TrendingDown, Sparkles, CalendarDays, StickyNote, Award, Target, Check, Save } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWeeklyReview } from "@/hooks/use-analytics";
import type { WeeklyReview } from "@/types";

interface WeeklyReviewDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface Highlight {
  habitId: string;
  name: string;
  icon: string;
  color: string;
  rate: number;
  completed: number;
  scheduled: number;
}

function ColoredProgress({ value, color, className }: { value: number; color: string; className?: string }) {
  return (
    <div className={cn("w-full h-2 rounded-full bg-muted overflow-hidden", className)}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  iconColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconColor: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-2 sm:p-3 flex flex-col gap-0.5 sm:gap-1">
      <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground">
        <span style={{ color: iconColor }}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="text-base sm:text-lg font-bold tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function HighlightCard({
  title,
  tone,
  highlight,
  emptyText,
}: {
  title: string;
  tone: "best" | "worst";
  highlight: Highlight | null;
  emptyText: string;
}) {
  const isBest = tone === "best";
  const accentText = isBest ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
  const accentBg = isBest ? "bg-emerald-500/10 dark:bg-emerald-500/15" : "bg-amber-500/10 dark:bg-amber-500/15";
  const accentBorder = isBest ? "border-emerald-500/30" : "border-amber-500/30";

  return (
    <Card className={cn("p-2.5 sm:p-3 flex flex-col gap-1.5 sm:gap-2", accentBorder, accentBg)}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          {isBest ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {title}
        </span>
        <span className={cn("text-[9px] sm:text-[10px] font-medium flex-shrink-0", accentText)}>
          {isBest ? "Top" : "Needs love"}
        </span>
      </div>
      {highlight ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-lg sm:text-xl flex-shrink-0"
              style={{ backgroundColor: highlight.color + "22" }}
              aria-hidden
            >
              {highlight.icon}
            </div>
            <div className={cn("text-base sm:text-xl font-bold tabular-nums flex-shrink-0", accentText)}>
              {Math.round(highlight.rate)}%
            </div>
          </div>
          {/* Full habit name on its own line — no truncation */}
          <div className="font-medium text-xs sm:text-sm leading-tight break-words">
            {highlight.name}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground tabular-nums">
            {highlight.completed}/{highlight.scheduled} done
          </div>
        </div>
      ) : (
        <div className="text-[11px] sm:text-xs text-muted-foreground italic py-1.5">{emptyText}</div>
      )}
    </Card>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function ReviewBody({ data }: { data: WeeklyReview }) {
  const completedPct = Math.round(data.overallPct ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-4xl font-bold tabular-nums leading-none">{completedPct}%</div>
            <div className="text-[11px] text-muted-foreground mt-1">overall this week</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>
              Mon {format(parseISO(data.weekStart), "MMM d")} – Today
            </span>
          </div>
        </div>
        <Progress
          value={completedPct}
          className="h-2.5 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-emerald-500 [&>[data-slot=progress-indicator]]:to-teal-500"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <StatTile
          label="Completed"
          value={`${data.totalCompleted}/${data.totalScheduled}`}
          sub="check-ins"
          icon={<Award className="w-3 h-3" />}
          iconColor="#10b981"
        />
        <StatTile
          label="Best streak"
          value={`${data.maxCurrentStreak}d`}
          sub="current best"
          icon={<Flame className="w-3 h-3" />}
          iconColor="#f97316"
        />
        <StatTile
          label="Streak days"
          value={`${data.totalCurrentStreakDays}`}
          sub="total active"
          icon={<Target className="w-3 h-3" />}
          iconColor="#14b8a6"
        />
      </div>

      {/* Best / Worst highlights */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <HighlightCard
          title="Best"
          tone="best"
          highlight={data.best}
          emptyText="No data yet"
        />
        <HighlightCard
          title="Worst"
          tone="worst"
          highlight={data.worst}
          emptyText="No data yet"
        />
      </div>

      {/* Per-habit breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Habit breakdown</h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {data.habitStats.length} habit{data.habitStats.length === 1 ? "" : "s"}
          </span>
        </div>
        {data.habitStats.length === 0 ? (
          <Card className="p-4 text-center text-xs text-muted-foreground">
            No habit data for this week.
          </Card>
        ) : (
          <div className="max-h-48 overflow-y-auto custom-scroll pr-1 -mr-1 space-y-1.5">
            {data.habitStats.map((h, idx) => (
              <motion.div
                key={h.habitId}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                className="rounded-lg border bg-card p-2.5 flex items-center gap-2.5"
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: h.color + "22" }}
                  aria-hidden
                >
                  {h.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-medium text-sm truncate">{h.name}</span>
                    {h.category && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal flex-shrink-0">
                        {h.category}
                      </Badge>
                    )}
                    {h.currentStreak > 0 && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-normal gap-0.5 flex-shrink-0">
                        <Flame className="w-2.5 h-2.5 text-orange-500" />
                        {h.currentStreak}d
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ColoredProgress value={h.rate} color={h.color} className="h-1.5" />
                    <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                      {h.completed}/{h.scheduled} · {Math.round(h.rate)}%
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Week notes */}
      {data.weekNotes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5 text-amber-500" />
            Your notes this week
          </h3>
          <div className="max-h-40 overflow-y-auto custom-scroll pr-1 -mr-1 space-y-1.5">
            {data.weekNotes.map((n, i) => (
              <div
                key={`${n.habitId}-${n.date}-${i}`}
                className="rounded-lg border bg-card p-2.5 flex gap-2"
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: "#f59e0b22" }}
                  aria-hidden
                >
                  {n.habitIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-medium truncate">{n.habitName}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(parseISO(n.date), "MMM d")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-snug line-clamp-3">
                    &ldquo;{n.note}&rdquo;
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflection prompts */}
      <ReflectionPrompts weekStart={data.weekStart} />
    </motion.div>
  );
}

function ReflectionPrompts({ weekStart }: { weekStart: string }) {
  return <ReflectionPromptsInner key={weekStart} weekStart={weekStart} />;
}

function ReflectionPromptsInner({ weekStart }: { weekStart: string }) {
  const storageKey = `weekly-reflection-${weekStart}`;

  // Lazy initial state — reads from localStorage once on mount.
  // The parent uses key={weekStart} so this remounts when the week changes,
  // avoiding the need for a setState-in-effect pattern.
  const [state, setState] = useState<{ well: string; challenge: string; focus: string; saved: boolean }>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { well?: string; challenge?: string; focus?: string };
        return {
          well: parsed.well ?? "",
          challenge: parsed.challenge ?? "",
          focus: parsed.focus ?? "",
          saved: true,
        };
      }
    } catch {
      // ignore parse errors
    }
    return { well: "", challenge: "", focus: "", saved: false };
  });

  function updateField(field: "well" | "challenge" | "focus", value: string) {
    setState((prev) => ({ ...prev, [field]: value, saved: false }));
  }

  function handleSave() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ well: state.well, challenge: state.challenge, focus: state.focus }));
      setState((prev) => ({ ...prev, saved: true }));
      toast.success("Reflection saved");
    } catch {
      toast.error("Could not save reflection");
    }
  }

  const prompts: { key: "well" | "challenge" | "focus"; label: string; value: string }[] = [
    { key: "well", label: "What went well?", value: state.well },
    { key: "challenge", label: "What was challenging?", value: state.challenge },
    { key: "focus", label: "What will you focus on next week?", value: state.focus },
  ];

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
        <h3 className="text-sm font-medium">Reflect</h3>
        {state.saved && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 ml-auto flex items-center gap-0.5">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {prompts.map((p) => (
          <div key={p.key} className="space-y-1">
            <label className="text-[11px] text-muted-foreground">{p.label}</label>
            <Textarea
              value={p.value}
              onChange={(e) => updateField(p.key, e.target.value)}
              placeholder="Type a few words…"
              rows={2}
              maxLength={500}
              className="text-sm resize-none"
            />
          </div>
        ))}
      </div>
      <Button
        onClick={handleSave}
        size="sm"
        className="w-full sm:w-auto"
      >
        <Save className="w-3.5 h-3.5 mr-1.5" />
        Save reflection
      </Button>
    </div>
  );
}

export function WeeklyReviewDialog({ open, onOpenChange }: WeeklyReviewDialogProps) {
  const { data, isLoading } = useWeeklyReview();

  // Keep the rendered body mounted across open/close so AnimatePresence feels smooth
  const body = useMemo(() => {
    if (isLoading || !data) return null;
    return <ReviewBody data={data} />;
  }, [data, isLoading]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 text-left">
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-500" />
            Weekly review
          </DialogTitle>
          <DialogDescription>Here&apos;s how your week is going</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 overflow-y-auto custom-scroll flex-1">
          <AnimatePresence mode="wait">
            {isLoading || !data ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ReviewSkeleton />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {body}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="px-6 pb-6 pt-3 border-t">
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
