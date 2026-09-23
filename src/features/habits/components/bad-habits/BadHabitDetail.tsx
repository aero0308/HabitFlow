"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  Coins,
  Clock,
  Trophy,
  ChevronRight,
  CalendarDays,
  AlertCircle,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBadHabit, useUndoSlip, useArchiveBadHabit } from "@/features/habits/hooks/useBadHabits";
import { useBadHabitInsights } from "@/features/habits/hooks/useBadHabitInsights";
import { useNav } from "@/lib/nav-store";
import { DAY_MILESTONES, MONEY_MILESTONES_USD, TIME_MILESTONES_HOURS, milestoneDef } from "@/lib/bad-habits/milestones";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { CleanStreakHero } from "./CleanStreakHero";
import { MilestoneTimeline } from "./MilestoneTimeline";
import { SlipDialog } from "./SlipDialog";
import { CreateBadHabitDialog } from "./CreateBadHabitDialog";

interface BadHabitDetailPageProps {
  id: string;
}

/**
 * Full detail view for a single bad habit.
 *
 * ROW 1: hero (icon, name, big clean-streak number gradient, subtext, buttons)
 * ROW 2: 3 stat cards (money / time / longest)
 * ROW 3: next milestone progress card
 * ROW 4: insights (trigger freq, day-of-week pattern, mood correlation) — only if ≥7 days of data
 * ROW 5: recent slips (last 5) with see-all link
 * ROW 6: milestones timeline (horizontal scroll)
 */
export function BadHabitDetailPage({ id }: BadHabitDetailPageProps) {
  const reduce = useReducedMotion();
  const { data, isLoading } = useBadHabit(id);
  const { data: insights } = useBadHabitInsights(id);
  const undoSlipMut = useUndoSlip();
  const archiveMut = useArchiveBadHabit();
  const { go } = useNav();

  const [slipOpen, setSlipOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const badHabit = data?.badHabit;
  const slips = data?.slips ?? [];
  const milestones = data?.milestones ?? [];

  // Compute the "subtext" — "Started Sep 12, 2026" or "Since last slip: Sep 16"
  const subtext = useMemo(() => {
    if (!badHabit) return "";
    const quitDate = parseISO(badHabit.quitDate);
    if (slips.length === 0) {
      return `Started ${format(quitDate, "MMM d, yyyy")}`;
    }
    const sortedSlipDates = slips.map((s) => s.date).sort();
    const lastSlipDate = parseISO(sortedSlipDates[sortedSlipDates.length - 1]);
    return `Since last slip: ${format(lastSlipDate, "MMM d, yyyy")}`;
  }, [badHabit, slips]);

  // Compute all milestone definitions (in canonical order) for the user's currency
  const allMilestones = useMemo(() => {
    if (!badHabit) return [];
    return [
      ...DAY_MILESTONES.map((v) => milestoneDef("days", v, badHabit.currency)),
      ...MONEY_MILESTONES_USD.map((v) => milestoneDef("money", v, badHabit.currency)),
      ...TIME_MILESTONES_HOURS.map((v) => milestoneDef("time", v, badHabit.currency)),
    ];
  }, [badHabit]);

  // Total elapsed days since quitDate — used to gate the insights section (≥7 days)
  const totalElapsedDays = useMemo(() => {
    if (!badHabit) return 0;
    const quit = parseISO(badHabit.quitDate);
    const today = new Date();
    return Math.max(0, differenceInCalendarDays(today, quit) + 1);
  }, [badHabit]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (!badHabit) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => go({ name: "habits" })}>
          ← Back
        </Button>
        <Card className="p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Bad habit not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            It may have been archived or deleted.
          </p>
        </Card>
      </div>
    );
  }

  // Next milestone to highlight (the next days milestone not yet unlocked)
  const nextDaysMilestone = (() => {
    const unlockedDays = milestones.filter((m) => m.type === "days").map((m) => m.value);
    for (const d of DAY_MILESTONES) {
      if (!unlockedDays.includes(d)) {
        return { type: "days" as const, value: d };
      }
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => go({ name: "habits" })} className="-ml-2">
        ← Back to habits
      </Button>

      {/* ROW 1 — Hero */}
      <CleanStreakHero
        badHabit={badHabit}
        subtext={subtext}
        onSlip={() => setSlipOpen(true)}
        onEdit={() => setEditOpen(true)}
        onArchive={() => archiveMut.mutate(id, { onSuccess: () => go({ name: "habits" }) })}
        onDelete={() => setDeleteId(id)}
      />

      {/* ROW 2 — Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Coins className="w-5 h-5 text-emerald-500" />}
          label="Money saved"
          value={badHabit.moneySaved?.formatted ?? "—"}
          sub={badHabit.costPerDay != null ? `≈ ${badHabit.costPerDay} ${badHabit.currency} / day` : "Not set"}
          tint="bg-emerald-500/10"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-teal-500" />}
          label="Time reclaimed"
          value={badHabit.timeSaved?.formatted ?? "—"}
          sub={badHabit.minutesPerDay != null ? `≈ ${badHabit.minutesPerDay} min / day` : "Not set"}
          tint="bg-teal-500/10"
        />
        <StatCard
          icon={<Trophy className="w-5 h-5 text-amber-500" />}
          label="Longest clean streak"
          value={`${badHabit.longestStreak} ${badHabit.longestStreak === 1 ? "day" : "days"}`}
          sub={badHabit.longestStreak > badHabit.cleanStreak ? "Your record" : "Current streak is your best!"}
          tint="bg-amber-500/10"
        />
      </div>

      {/* ROW 3 — Next milestone progress card */}
      {badHabit.nextMilestone && badHabit.nextMilestone.daysRemaining > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-violet-500" />
                Next milestone
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {badHabit.nextMilestone.label}
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {badHabit.nextMilestone.daysRemaining} {badHabit.nextMilestone.daysRemaining === 1 ? "day" : "days"} to go
            </Badge>
          </div>
          <Progress value={badHabit.nextMilestone.progressPct} className="h-2" />
          <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
            <span>{badHabit.cleanStreak} clean so far</span>
            <span>{badHabit.nextMilestone.value} days target</span>
          </div>
        </Card>
      )}
      {badHabit.nextMilestone && badHabit.nextMilestone.daysRemaining === 0 && (
        <Card className="p-5 bg-violet-500/10 border-violet-500/30">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-violet-500" />
            <div>
              <p className="font-semibold text-violet-700 dark:text-violet-300">
                You&apos;ve hit the longest milestone we track! 🎉
              </p>
              <p className="text-xs text-muted-foreground">
                One year+ clean. Every additional clean day is a new record.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ROW 4 — Insights (only if ≥7 days of data) */}
      {totalElapsedDays >= 7 && insights && (
        <InsightsSection insights={insights} />
      )}

      {/* ROW 5 — Recent slips */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-amber-500" />
            Recent slips
          </h3>
          <span className="text-xs text-muted-foreground">
            Last {Math.min(5, slips.length)} of {slips.length}
          </span>
        </div>
        {slips.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              No slips logged yet 🎉
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Keep going. If you slip, that&apos;s part of the process — log it and learn.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {slips.slice(0, 5).map((s) => (
              <li key={s.id} className="py-2.5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex flex-col items-center justify-center text-[10px] text-amber-700 dark:text-amber-300 font-medium flex-shrink-0">
                  <span>{format(parseISO(s.date), "MMM")}</span>
                  <span className="text-base leading-none">
                    {format(parseISO(s.date), "d")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {format(parseISO(s.date), "EEEE, MMM d, yyyy")}
                  </div>
                  {s.trigger && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Trigger: {s.trigger}
                    </div>
                  )}
                  {s.note && (
                    <div className="text-xs text-muted-foreground italic mt-1">
                      &ldquo;{s.note}&rdquo;
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs flex-shrink-0"
                  onClick={() => {
                    undoSlipMut.mutate(
                      { id, date: s.date },
                      {
                        onSuccess: () => {
                          toast.success("Slip removed — streak restored");
                        },
                      },
                    );
                  }}
                  disabled={undoSlipMut.isPending}
                  aria-label="Undo this slip"
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Undo
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ROW 6 — Milestones timeline */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-violet-500" />
            Milestones
          </h3>
          <Badge variant="secondary" className="tabular-nums">
            {milestones.length} unlocked
          </Badge>
        </div>
        <MilestoneTimeline
          milestones={allMilestones}
          unlocked={milestones}
          nextMilestone={nextDaysMilestone}
        />
      </Card>

      {/* Slip dialog */}
      <SlipDialog
        open={slipOpen}
        onOpenChange={setSlipOpen}
        badHabit={badHabit}
      />

      {/* Edit dialog (reuses the create dialog with initial values) */}
      <CreateBadHabitDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{
          id: badHabit.id,
          name: badHabit.name,
          icon: badHabit.icon,
          color: badHabit.color,
          quitDate: badHabit.quitDate,
          reason: badHabit.reason,
          triggers: badHabit.triggers,
          costPerDay: badHabit.costPerDay,
          currency: badHabit.currency,
          minutesPerDay: badHabit.minutesPerDay,
          replacementHabitId: badHabit.replacementHabitId,
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bad habit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the bad habit and keep its slip + milestone history.
              You can find it under the archived view later. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  archiveMut.mutate(deleteId, {
                    onSuccess: () => go({ name: "habits" }),
                  });
                }
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ----- helper components local to this file -----

function StatCard({
  icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tint: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", tint)}>
            {icon}
          </div>
          <div className="text-xs text-muted-foreground font-medium">{label}</div>
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </Card>
    </motion.div>
  );
}

function InsightsSection({
  insights,
}: {
  insights: NonNullable<ReturnType<typeof useBadHabitInsights>["data"]>;
}) {
  const triggerMax = Math.max(1, ...insights.triggerFrequency.map((t) => t.count));
  const dayMax = Math.max(1, ...insights.dayOfWeekPattern.map((d) => d.count));

  return (
    <Card className="p-5 space-y-5">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-emerald-500" />
        Insights
      </h3>

      {insights.triggerFrequency.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Triggers (slip count)
          </div>
          <div className="space-y-1.5">
            {insights.triggerFrequency.slice(0, 5).map((t) => (
              <div key={t.trigger} className="flex items-center gap-2 text-xs">
                <div className="w-28 sm:w-40 truncate text-muted-foreground">{t.trigger}</div>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500/70"
                    style={{ width: `${(t.count / triggerMax) * 100}%` }}
                  />
                </div>
                <div className="w-10 text-right tabular-nums text-muted-foreground">{t.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Day-of-week pattern (slips)
        </div>
        <div className="flex items-end justify-between gap-1.5 h-20">
          {insights.dayOfWeekPattern.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col justify-end h-full relative group">
                <div className="absolute inset-x-0 bottom-0 rounded-md bg-muted/30 h-full" />
                <motion.div
                  className="relative rounded-md w-full bg-amber-500/70"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.count / dayMax) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{d.day}</span>
              <span className="text-[10px] font-medium tabular-nums">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">Clean days</div>
          <div className="text-lg font-semibold tabular-nums mt-1">
            {insights.cleanDaysPct.cleanDays}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              / {insights.cleanDaysPct.totalDays} ({insights.cleanDaysPct.pct}%)
            </span>
          </div>
        </div>
        {insights.moodCorrelation && insights.moodCorrelation.summary && (
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Mood correlation</div>
            <div className="text-xs mt-1 text-foreground/90 leading-snug">
              {insights.moodCorrelation.summary}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
