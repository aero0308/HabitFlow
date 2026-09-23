"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, Target, CheckCircle2, Plus, Minus, ChevronLeft, ChevronRight,
  Calendar as CalendarIcon, TrendingUp, TrendingDown, Sparkles, Quote,
  Zap, Award, ArrowRight, StickyNote, Keyboard, Snowflake, CalendarDays, TreePalm,
} from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, parseISO, differenceInCalendarDays } from "date-fns";
import { useDashboard, useCheckin, useUncheck } from "@/hooks/use-checkins";
import { useCalendar, useWeeklySummary, useAchievements } from "@/hooks/use-analytics";
import { useFreezeDay, useUnfreezeDay } from "@/hooks/use-habits";
import { useBadHabits } from "@/features/habits/hooks/useBadHabits";
import { useOffModes } from "@/hooks/use-off-modes";
import { WeeklyReviewDialog } from "@/features/dashboard/weekly-review-dialog";
import { CleanStreaksCard } from "@/features/dashboard/CleanStreaksCard";
import { FlipProgressCard, type YesterdayData } from "@/features/dashboard/components/FlipProgressCard";
import { FlowingUnderline } from "@/components/shared/flowing-underline";
import { MoodLoggerCard } from "@/features/mood/mood-logger-card";
import { MoodModal } from "@/features/mood/mood-modal";
import { DashboardDaypartCards } from "@/features/dashboard/DashboardDaypartCards";
import type { TimeOfDay } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNav } from "@/lib/nav-store";
import { useAuth } from "@/features/auth/auth-context";
import { useConfetti } from "@/lib/confetti";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const QUOTES = [
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "Small habits don't add up. They compound.", author: "James Clear" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { text: "The chains of habit are too light to be felt until they are too heavy to be broken.", author: "Warren Buffett" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
];

function quoteOfTheDay() {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}

function greeting(name: string) {
  const h = new Date().getHours();
  if (h < 5) return `Burning the midnight oil, ${name}?`;
  if (h < 12) return `Good morning, ${name}`;
  if (h < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function ProgressRing({ pct, size = 148 }: { pct: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/20" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={pct}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-4xl font-bold text-foreground tabular-nums"
        >
          {pct}%
        </motion.span>
        <span className="text-xs text-muted-foreground mt-0.5">today</span>
      </div>
    </div>
  );
}

function intensityClass(ratio: number, scheduled: number) {
  if (scheduled === 0) return "bg-muted/30";
  if (ratio === 0) return "bg-muted/60 dark:bg-muted/40";
  if (ratio < 0.34) return "bg-emerald-200 dark:bg-emerald-900";
  if (ratio < 0.67) return "bg-emerald-400 dark:bg-emerald-700";
  if (ratio < 1) return "bg-emerald-500 dark:bg-emerald-600";
  return "bg-emerald-600 dark:bg-emerald-500";
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DashboardPage() {
  const { data: dash, isLoading } = useDashboard();
  const { data: weekly } = useWeeklySummary();
  const { data: ach } = useAchievements();
  const { data: offModes } = useOffModes();
  const { data: badHabits } = useBadHabits(false);
  const checkinMut = useCheckin();
  const uncheckMut = useUncheck();
  const freezeMut = useFreezeDay();
  const unfreezeMut = useUnfreezeDay();
  const { go } = useNav();
  const { user } = useAuth();
  const today = todayStr();
  const quote = useMemo(() => quoteOfTheDay(), []);

  // Check if user is currently in an off-mode period
  const activeOffMode = useMemo(() => {
    if (!offModes || offModes.length === 0) return null;
    return offModes.find((om) => today >= om.startDate && today <= om.endDate) ?? null;
  }, [offModes, today]);

  // Next upcoming off-mode (startDate strictly after today)
  const upcomingOffMode = useMemo(() => {
    if (!offModes || offModes.length === 0) return null;
    const upcoming = offModes
      .filter((om) => om.startDate > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return upcoming[0] ?? null;
  }, [offModes, today]);

  const { fire: fireConfetti } = useConfetti();

  const [calMonth, setCalMonth] = useState(() => new Date());
  const monthStr = format(calMonth, "yyyy-MM");
  const { data: cal } = useCalendar(monthStr);

  // Track previous completion to detect the moment all habits get done
  const prevAllDoneRef = useRef(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [activeDaypart, setActiveDaypart] = useState<TimeOfDay | "ALL">("ALL");
  const [noteDialog, setNoteDialog] = useState<{ habitId: string; habitName: string; note: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const calendarGrid = useMemo(() => {
    if (!cal) return null;
    const start = startOfMonth(calMonth);
    const end = endOfMonth(calMonth);
    const days = eachDayOfInterval({ start, end });
    const firstJsDay = getDay(days[0]);
    const padFront = (firstJsDay + 6) % 7;
    const padded: (Date | null)[] = [...Array(padFront).fill(null), ...days];
    const dayMap = new Map(cal.days.map((d) => [d.date, d]));
    return { padded, dayMap };
  }, [cal, calMonth]);

  const allDone = dash && dash.scheduledToday > 0 && dash.completedToday === dash.scheduledToday;
  const earnedBadges = ach?.earnedCount ?? 0;

  // Fire confetti when transitioning to all-done
  useEffect(() => {
    if (allDone && !prevAllDoneRef.current) {
      fireConfetti({ count: 160 });
      toast.success("All done! 🎉", { description: "Every habit completed today. Great work!" });
    }
    prevAllDoneRef.current = !!allDone;
  }, [allDone, fireConfetti]);

  // Helper to toggle a habit (used by keyboard shortcuts)
  const toggleHabit = useCallback((habitId: string) => {
    const h = dash?.todaysHabits.find((x) => x.id === habitId);
    if (!h) return;
    if (h.completed) {
      uncheckMut.mutate({ habitId, date: today });
    } else {
      checkinMut.mutate({ habitId, date: today, count: h.targetCount });
    }
  }, [dash, today, checkinMut, uncheckMut]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when typing in inputs/dialogs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (noteDialog || showShortcuts) return;

      // Number keys 1-9: toggle the Nth today's habit
      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const habits = dash?.todaysHabits;
        if (habits && idx < habits.length) {
          e.preventDefault();
          toggleHabit(habits[idx].id);
        }
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dash, toggleHabit, noteDialog, showShortcuts]);

  function openNoteDialog(habitId: string, habitName: string, currentNote: string) {
    setNoteDraft(currentNote || "");
    setNoteDialog({ habitId, habitName, note: currentNote });
  }

  function saveNote() {
    if (!noteDialog) return;
    const h = dash?.todaysHabits.find((x) => x.id === noteDialog.habitId);
    if (!h) return;
    // Save note by upserting the check-in with the current count
    checkinMut.mutate(
      { habitId: noteDialog.habitId, date: today, count: h.count > 0 ? h.count : h.targetCount, note: noteDraft },
      { onSettled: () => setNoteDialog(null) },
    );
    toast.success("Note saved");
  }

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <div style={{ width: "fit-content" }}>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
              {user ? greeting((user.firstName || user.name.split(" ")[0])) : "Welcome back"}
            </h1>
            <FlowingUnderline className="mt-1.5" />
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            {format(new Date(), "EEEE, MMMM d")}
            {allDone && <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-2">· All done for today! 🎉</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowWeeklyReview(true)} className="gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Weekly review</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowShortcuts(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (press ?)">
            <Keyboard className="w-4 h-4" />
          </Button>
          {earnedBadges > 0 && (
            <Button variant="outline" size="sm" onClick={() => go({ name: "achievements" })} className="gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span className="font-semibold">{earnedBadges}</span>
              <span className="text-muted-foreground hidden sm:inline">badges</span>
            </Button>
          )}
        </div>
      </motion.div>

      <WeeklyReviewDialog open={showWeeklyReview} onOpenChange={setShowWeeklyReview} />

      {/* Off Mode banner */}
      {activeOffMode && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4"
        >
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
            <TreePalm className="w-5 h-5 text-sky-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">
              You&apos;re in Off Mode until {activeOffMode.endDate}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeOffMode.reason
                ? activeOffMode.reason
                : "Habits are paused. Your streaks won&apos;t break during this period."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => go({ name: "off-mode" })} className="border-sky-500/30 text-sky-500 hover:bg-sky-500/10 flex-shrink-0">
            Manage
          </Button>
        </motion.div>
      )}

      {/* Top row: progress ring + weekly chart */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Progress ring card — now wraps in FlipProgressCard so it flips
            on click to reveal yesterday's summary. The existing ProgressRing
            is passed in as `progressRing` so the front face stays identical. */}
        <FlipProgressCard
          todayPct={dash?.completionPct ?? 0}
          todayCompleted={dash?.completedToday ?? 0}
          todayScheduled={dash?.scheduledToday ?? 0}
          todayTotalProgress={dash?.totalProgress ?? 0}
          todayTotalTarget={dash?.totalTarget ?? 0}
          yesterday={(dash as { yesterday?: YesterdayData } | null | undefined)?.yesterday ?? null}
          progressRing={<ProgressRing pct={dash?.completionPct ?? 0} />}
          isLoading={isLoading}
          skeleton={<Skeleton className="h-36 w-36 rounded-full" />}
        />

        {/* Weekly summary card */}
        <Card className="p-6 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                This week
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Mon – Sun</p>
            </div>
            {weekly && (
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{weekly.thisWeek.pct}%</div>
                <div className={cn(
                  "text-xs font-medium flex items-center gap-0.5 justify-end",
                  weekly.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : weekly.delta < 0 ? "text-rose-500" : "text-muted-foreground",
                )}>
                  {weekly.delta > 0 && <TrendingUp className="w-3 h-3" />}
                  {weekly.delta < 0 && <TrendingDown className="w-3 h-3" />}
                  {weekly.delta > 0 ? `+${weekly.delta}` : weekly.delta} vs last week
                </div>
              </div>
            )}
          </div>
          {weekly ? (
            <div className="flex items-end justify-between gap-2 h-24">
              {weekly.days.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex flex-col justify-end h-20 relative group">
                    <div className="absolute inset-x-0 bottom-0 rounded-md bg-muted/30 h-full" />
                    <motion.div
                      className="relative rounded-md w-full"
                      style={{
                        background: d.pct === 0 ? "transparent" : `linear-gradient(to top, #10b981, #0d9488)`,
                        minHeight: 4,
                      }}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(d.pct, d.scheduled > 0 ? 4 : 0)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none">
                      {d.completed}/{d.scheduled}
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium",
                    d.isToday ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}>
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </Card>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Flame}
          label="Active streaks"
          value={dash?.streaks.filter((s) => s.currentStreak > 0).length ?? 0}
          sub="on fire"
          color="text-orange-500"
          bg="bg-orange-500/10"
          delay={0}
        />
        <StatCard
          icon={Zap}
          label="Best current"
          value={Math.max(0, ...(dash?.streaks.map((s) => s.currentStreak) ?? [0]))}
          sub="days"
          color="text-emerald-500"
          bg="bg-emerald-500/10"
          delay={0.05}
        />
        <StatCard
          icon={Target}
          label="Total habits"
          value={dash?.totalHabits ?? 0}
          sub="tracked"
          color="text-teal-500"
          bg="bg-teal-500/10"
          delay={0.1}
        />
        <StatCard
          icon={Award}
          label="Longest ever"
          value={Math.max(0, ...(dash?.streaks.map((s) => s.longestStreak) ?? [0]))}
          sub="days record"
          color="text-purple-500"
          bg="bg-purple-500/10"
          delay={0.15}
        />
      </div>

      {/* Mood logger card */}
      <MoodLoggerCard onEdit={() => setShowMoodModal(true)} />

      {/* Clean streaks card (only visible if user has any non-archived bad habits) */}
      {badHabits && badHabits.length > 0 && (
        <CleanStreaksCard
          badHabits={badHabits}
          onView={() => {
            if (typeof window !== "undefined") {
              localStorage.setItem("habits.tab", "break");
            }
            go({ name: "habits" });
          }}
        />
      )}

      {/* Today's habits with daypart cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Today&apos;s habits
            {dash && dash.scheduledToday > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                {dash.completedToday}/{dash.scheduledToday}
              </Badge>
            )}
          </h2>
          <Button variant="outline" size="sm" onClick={() => go({ name: "habits" })}>
            <Plus className="w-4 h-4 mr-1" /> Manage
          </Button>
        </div>

        {/* Daypart filter cards */}
        {dash && dash.todaysHabits.length > 0 && (
          <DashboardDaypartCards
            habits={dash.todaysHabits}
            activeDaypart={activeDaypart}
            onDaypartChange={setActiveDaypart}
          />
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : dash && dash.todaysHabits.length > 0 ? (
          <div className="space-y-2">
            <AnimatePresence>
              {dash.todaysHabits
                .filter((h) => {
                  if (activeDaypart === "ALL") return true;
                  const hod = h.timeOfDay ?? "ANY_TIME";
                  if (activeDaypart === "ANY_TIME") return hod === "ANY_TIME";
                  return hod === activeDaypart;
                })
                .map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <HabitRow
                    habit={h}
                    index={i}
                    today={today}
                    onToggle={() => {
                      if (h.completed) {
                        uncheckMut.mutate({ habitId: h.id, date: today });
                        toast("Undo", { description: `${h.name} marked incomplete` });
                      } else {
                        checkinMut.mutate({ habitId: h.id, date: today, count: h.targetCount });
                        toast.success("Nice work!", { description: `${h.name} completed` });
                      }
                    }}
                    onInc={() => {
                      const next = Math.min(h.count + 1, h.targetCount);
                      checkinMut.mutate({ habitId: h.id, date: today, count: next });
                    }}
                    onDec={() => {
                      const next = Math.max(h.count - 1, 0);
                      if (next === 0) {
                        uncheckMut.mutate({ habitId: h.id, date: today });
                      } else {
                        checkinMut.mutate({ habitId: h.id, date: today, count: next });
                      }
                    }}
                    onClick={() => go({ name: "habit", id: h.id })}
                    onAddNote={() => openNoteDialog(h.id, h.name, h.note)}
                    onFreeze={() => freezeMut.mutate({ habitId: h.id, date: today })}
                    onUnfreeze={() => unfreezeMut.mutate({ habitId: h.id, date: today })}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="font-medium mb-1">No habits scheduled for today</p>
            <p className="text-sm text-muted-foreground mb-4">Enjoy the day off, or create a new habit to track.</p>
            <Button onClick={() => go({ name: "habits" })}>
              <Plus className="w-4 h-4 mr-1" /> Create a habit
            </Button>
          </Card>
        )}
      </div>

      {/* Off Mode summary card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeOffMode ? (
          <Card className="border-sky-200 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-sky-500/15 flex items-center justify-center flex-shrink-0">
                  <TreePalm className="w-6 h-6 text-sky-500 dark:text-sky-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                      {activeOffMode.reason?.trim() ? activeOffMode.reason.trim() : "Off Mode active"}
                    </span>
                    <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-300 bg-sky-500/10 text-[10px]">
                      Active
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(parseISO(activeOffMode.startDate), "MMM d")} → {format(parseISO(activeOffMode.endDate), "MMM d, yyyy")}
                    {" · "}
                    {(() => {
                      const dr = differenceInCalendarDays(parseISO(activeOffMode.endDate), parseISO(today));
                      if (dr === 0) return "ends today";
                      if (dr === 1) return "1 day remaining";
                      return `${dr} days remaining`;
                    })()}
                  </p>
                  <p className="text-[11px] text-sky-700 dark:text-sky-300/80 mt-1 flex items-center gap-1">
                    <Snowflake className="w-3 h-3" />
                    Your streaks are protected during this period.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => go({ name: "off-mode" })}
                className="border-sky-500/40 text-sky-600 dark:text-sky-300 hover:bg-sky-500/10 flex-shrink-0"
              >
                Manage
              </Button>
            </div>
          </Card>
        ) : upcomingOffMode ? (
          <Card className="border-sky-200 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/20 p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                <TreePalm className="w-5 h-5 text-sky-500 dark:text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  Upcoming: {upcomingOffMode.reason?.trim() ? upcomingOffMode.reason.trim() : "Off Mode"}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Starts {format(parseISO(upcomingOffMode.startDate), "MMM d, yyyy")}
                  {(() => {
                    const dtb = differenceInCalendarDays(parseISO(upcomingOffMode.startDate), parseISO(today));
                    if (dtb === 1) return " · tomorrow";
                    return ` · in ${dtb} days`;
                  })()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => go({ name: "off-mode" })}
                className="text-sky-600 dark:text-sky-300 hover:bg-sky-500/10 flex-shrink-0"
              >
                View
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="border-sky-200 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/20 p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                <TreePalm className="w-5 h-5 text-sky-500 dark:text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">Going on vacation or need a break?</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set up Off Mode to pause habits without breaking streaks.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => go({ name: "off-mode" })}
                className="border-sky-500/40 text-sky-600 dark:text-sky-300 hover:bg-sky-500/10 flex-shrink-0"
              >
                Set up
              </Button>
            </div>
          </Card>
        )}
      </motion.div>

      {/* Quote + Calendar row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Motivational quote */}
        <Card className="p-6 lg:col-span-1 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent border-emerald-500/20">
          <Quote className="w-8 h-8 text-emerald-500/40 mb-3" />
          <p className="text-sm font-medium leading-relaxed italic text-foreground">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground mt-3">— {quote.author}</p>
        </Card>

        {/* Calendar heatmap */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" /> Calendar
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium w-28 text-center">{format(calMonth, "MMMM yyyy")}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Highlighted hint */}
          <div className="mb-2 rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-1.5">
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
              Click any calendar day to see what you completed.
            </p>
          </div>

          <Card className="p-4">
            {calendarGrid ? (
              <div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1 uppercase tracking-wide">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarGrid.padded.map((date, i) => {
                    if (!date) return <div key={i} />;
                    const ds = format(date, "yyyy-MM-dd");
                    const dayData = calendarGrid.dayMap.get(ds);
                    const ratio = dayData?.ratio ?? 0;
                    const scheduled = dayData?.scheduled ?? 0;
                    return (
                      <Popover key={ds}>
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              "aspect-square rounded-md text-xs flex items-center justify-center transition-all hover:scale-110 hover:ring-2 hover:ring-emerald-400 hover:ring-offset-1 hover:ring-offset-background hover:z-10 relative",
                              intensityClass(ratio, scheduled),
                              isToday(date) && "ring-2 ring-emerald-500 ring-offset-1 ring-offset-background",
                            )}
                            aria-label={`${ds}: ${dayData?.completed ?? 0} of ${scheduled} done`}
                          >
                            <span className={cn("font-medium", ratio > 0.4 ? "text-white" : "text-foreground")}>
                              {date.getDate()}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" align="center">
                          <div className="text-sm font-semibold mb-1">{format(date, "EEEE, MMM d")}</div>
                          {scheduled === 0 ? (
                            <p className="text-xs text-muted-foreground">No habits scheduled.</p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-muted-foreground">
                                  {dayData?.completed ?? 0} of {scheduled} completed
                                </p>
                                <Badge variant="secondary" className="text-[10px]">
                                  {Math.round(ratio * 100)}%
                                </Badge>
                              </div>
                              <div className="space-y-1.5">
                                {dayData?.habits.map((h) => (
                                  <div key={h.habitId} className="flex items-center gap-2 text-xs">
                                    <span className="w-5 text-center">{h.icon}</span>
                                    <span className="flex-1 truncate">{h.name}</span>
                                    <span
                                      className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                        h.completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-muted text-muted-foreground",
                                      )}
                                    >
                                      {h.count}/{h.targetCount}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => go({ name: "history" })}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    View full history <ArrowRight className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span>Less</span>
                    <div className="w-3 h-3 rounded bg-muted/60" />
                    <div className="w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-900" />
                    <div className="w-3 h-3 rounded bg-emerald-400 dark:bg-emerald-700" />
                    <div className="w-3 h-3 rounded bg-emerald-600 dark:bg-emerald-500" />
                    <span>More</span>
                  </div>
                </div>
              </div>
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </Card>
        </div>
      </div>

      {/* Keyboard shortcuts dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-emerald-500" />
              Keyboard shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <ShortcutRow keys={["1", "…", "9"]} desc="Toggle the Nth today's habit" />
            <ShortcutRow keys={["?"]} desc="Open this help dialog" />
            <ShortcutRow keys={["Esc"]} desc="Close dialogs" />
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            Shortcuts only work on the dashboard when no input is focused.
          </div>
          <DialogFooter>
            <Button onClick={() => setShowShortcuts(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-amber-500" />
              Note for {noteDialog?.habitName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="note">Add a note about today&apos;s check-in</Label>
            <Textarea
              id="note"
              placeholder="How did it go? Anything to remember?"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{noteDraft.length}/500 characters</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
            <Button onClick={saveNote} disabled={checkinMut.isPending}>Save note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mood modal */}
      <MoodModal open={showMoodModal} onOpenChange={setShowMoodModal} />
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{desc}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className="px-2 py-1 text-xs font-semibold bg-muted border rounded-md min-w-6 text-center">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
  delay = 0,
}: {
  icon: typeof Flame;
  label: string;
  value: number;
  sub: string;
  color: string;
  bg: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="p-4 hover:shadow-md transition-shadow flex flex-col items-center justify-center gap-2 text-center">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", bg)}>
          <Icon className={cn("w-5 h-5", color)} />
        </div>
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="text-2xl font-bold tabular-nums">{value}</span>
            <span className="text-[10px] text-muted-foreground">{sub}</span>
          </div>
          <div className="text-xs text-muted-foreground leading-none mt-1 truncate">{label}</div>
        </div>
      </Card>
    </motion.div>
  );
}

function HabitRow({
  habit,
  index,
  onToggle,
  onInc,
  onDec,
  onClick,
  onAddNote,
  onFreeze,
  onUnfreeze,
}: {
  habit: {
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    targetCount: number;
    count: number;
    completed: boolean;
    frozen: boolean;
    note: string;
    streak: { current: number; longest: number };
  };
  index: number;
  today: string;
  onToggle: () => void;
  onInc: () => void;
  onDec: () => void;
  onClick: () => void;
  onAddNote: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
}) {
  const multi = habit.targetCount > 1;
  const progressPct = multi ? Math.round((habit.count / habit.targetCount) * 100) : habit.completed ? 100 : 0;
  return (
    <Card className={cn(
      "p-3 sm:p-4 transition-all hover:shadow-md group",
      habit.completed && "border-emerald-500/50 bg-emerald-500/5",
      habit.frozen && !habit.completed && "border-sky-500/50 bg-sky-500/5",
    )}>
      <div className="flex items-center gap-3">
        {/* Keyboard shortcut number badge (hidden on mobile) */}
        <div className="hidden sm:flex w-5 h-5 rounded bg-muted text-muted-foreground text-[10px] font-semibold items-center justify-center flex-shrink-0" title={`Press ${index + 1} to toggle`}>
          {index + 1}
        </div>
        <button
          onClick={onClick}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-105"
          style={{ backgroundColor: habit.color + "20" }}
          aria-label={habit.name}
        >
          {habit.icon}
        </button>

        {/* Name + meta */}
        <button onClick={onClick} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{habit.name}</span>
            {habit.completed && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            )}
            {habit.frozen && (
              <span className="text-[10px] text-sky-500 font-medium flex items-center gap-0.5 flex-shrink-0">
                <Snowflake className="w-3 h-3" /> Frozen
              </span>
            )}
            {habit.note && (
              <StickyNote className="w-3 h-3 text-amber-500 flex-shrink-0" aria-label="Has note" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {habit.streak.current > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 gap-0.5">
                <Flame className="w-2.5 h-2.5 text-orange-500" />
                {habit.streak.current}
              </Badge>
            )}
            {multi && (
              <div className="flex items-center gap-1.5 flex-1 max-w-32">
                <Progress value={progressPct} className="h-1.5" />
                <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                  {habit.count}/{habit.targetCount}
                </span>
              </div>
            )}
          </div>
        </button>

        {/* Action buttons — grouped on the right */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAddNote} aria-label={`Add note for ${habit.name}`} title="Add note">
            <StickyNote className={cn("w-4 h-4", habit.note ? "text-amber-500" : "text-muted-foreground")} />
          </Button>
          {/* Freeze/Unfreeze toggle — only show if not completed */}
          {!habit.completed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={habit.frozen ? onUnfreeze : onFreeze}
              aria-label={habit.frozen ? `Unfreeze today for ${habit.name}` : `Freeze today for ${habit.name}`}
              title={habit.frozen ? "Unfreeze this day" : "Freeze this day to protect your streak"}
            >
              <Snowflake className={cn("w-4 h-4 transition-colors", habit.frozen ? "text-sky-500" : "text-muted-foreground hover:text-sky-500")} />
            </Button>
          )}
          {multi ? (
            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-border/50">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onDec} disabled={habit.count === 0}>
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <div className="w-8 text-center text-sm font-semibold tabular-nums">{habit.count}</div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onInc} disabled={habit.completed}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant={habit.completed ? "default" : "outline"}
              size="sm"
              onClick={onToggle}
              className={cn("ml-1", habit.completed ? "bg-emerald-600 hover:bg-emerald-700" : "")}
            >
              {habit.completed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Done
                </>
              ) : (
                "Mark done"
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
