"use client";

import { useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RotateCw, Calendar, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/* ============================================================================
   FlipProgressCard — a 3D flip card showing today's progress on the front
   and yesterday's summary on the back. Click to flip.
   ----------------------------------------------------------------------------
   Architecture notes:
     • The outer div provides `perspective: 1000px` so the child can rotate
       in 3D.
     • The inner motion.div uses Framer Motion's `animate={{ rotateY }}` prop
       (NOT inline `style.transform`) — this is critical because Framer
       Motion owns the `transform` CSS property when `whileHover`/`whileTap`
       are also used. Setting `style.transform` inline would be overridden
       by Framer Motion's computed transform.
     • The FRONT face is `position: relative` (always) — it defines the
       card's height so the container doesn't collapse.
     • The BACK face is `position: absolute; inset: 0` — overlays the front,
       pre-rotated 180° so it's hidden until the parent flips.
     • Both faces use `backface-visibility: hidden` so only the visible
       face renders.
     • prefers-reduced-motion: skip the 3D rotation entirely, use a simple
       opacity crossfade instead.
============================================================================ */

export interface YesterdayData {
  date: string;
  scheduled: number;
  completed: number;
  completionPct: number;
  isPerfectDay: boolean;
  bestStreak: {
    name: string;
    icon: string;
    currentStreak: number;
  } | null;
}

interface FlipProgressCardProps {
  todayPct: number;
  todayCompleted: number;
  todayScheduled: number;
  todayTotalProgress: number;
  todayTotalTarget: number;
  yesterday: YesterdayData | null;
  progressRing: React.ReactNode;
  isLoading?: boolean;
  skeleton?: React.ReactNode;
}

export function FlipProgressCard({
  todayCompleted,
  todayScheduled,
  todayTotalProgress,
  todayTotalTarget,
  yesterday,
  progressRing,
  isLoading,
  skeleton,
}: FlipProgressCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const toggleFlip = useCallback(() => {
    setIsFlipped((f) => !f);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleFlip();
      }
    },
    [toggleFlip],
  );

  if (isLoading) {
    return (
      <Card className="p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[260px]">
        {skeleton ?? <div className="h-36 w-36 rounded-full bg-muted/30 animate-pulse" />}
      </Card>
    );
  }

  // Reduced-motion path: no 3D rotation, just an opacity crossfade between
  // the front (today) and back (yesterday) content inside a single Card.
  if (shouldReduceMotion) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={toggleFlip}
          className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/60 transition-colors"
          aria-label={isFlipped ? "Show today" : "Show yesterday"}
          title={isFlipped ? "Show today" : "Show yesterday"}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        <Card className="p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[260px]">
          {isFlipped ? (
            <YesterdayFace yesterday={yesterday} />
          ) : (
            <>
              {progressRing}
              <div className="mt-4 text-center relative">
                <div className="text-sm font-medium">
                  {todayCompleted} / {todayScheduled} habits done
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {todayTotalProgress} / {todayTotalTarget} total progress
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  // Standard path: 3D flip card.
  // The outer div sets perspective. The inner motion.div owns the rotateY
  // animation via Framer Motion's `animate` prop (NOT inline style — inline
  // transform would be overridden by Framer Motion's whileHover/whileTap).
  return (
    <div className="relative" style={{ perspective: "1000px" }}>
      {/* Flip affordance — top-right corner, stops click propagation so
          clicking the icon doesn't ALSO trigger the card's onClick flip
          (which would double-flip and appear to do nothing). */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleFlip();
        }}
        className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/60 transition-colors group"
        aria-label={isFlipped ? "Flip back to today" : "Click to see yesterday"}
        title={isFlipped ? "Flip back to today" : "Click to see yesterday"}
      >
        <RotateCw className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
      </button>

      <motion.div
        role="button"
        tabIndex={0}
        onClick={toggleFlip}
        onKeyDown={handleKeyDown}
        aria-label="Flip card to see yesterday's summary"
        className="
          relative cursor-pointer rounded-2xl
          focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
        "
        // CRITICAL: use Framer Motion's animate prop for rotateY.
        // Do NOT use inline style.transform — Framer Motion owns the
        // transform property and would override inline styles when
        // whileHover/whileTap are also present.
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.98 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* ============ FRONT FACE (today) ============
            position: relative so it defines the card's height.
            backface-visibility: hidden so it disappears when the card
            flips to 180deg. */}
        <Card
          className="
            p-6 flex flex-col items-center justify-center relative overflow-hidden
            min-h-[260px]
          "
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          {progressRing}
          <div className="mt-4 text-center relative">
            <div className="text-sm font-medium">
              {todayCompleted} / {todayScheduled} habits done
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {todayTotalProgress} / {todayTotalTarget} total progress
            </div>
          </div>
        </Card>

        {/* ============ BACK FACE (yesterday) ============
            position: absolute; inset: 0 so it overlays the front face
            exactly. Pre-rotated 180deg so it's hidden initially (combined
            with backface-visibility: hidden). When the parent flips to
            180deg, this face's effective rotation is 360deg = 0deg = visible.
            backface-visibility: hidden so it disappears when the card
            flips back to 0deg. */}
        <Card
          className="
            absolute inset-0 p-6 flex flex-col items-center justify-center
            overflow-hidden min-h-[260px]
          "
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <YesterdayFace yesterday={yesterday} />
        </Card>
      </motion.div>
    </div>
  );
}

/* ============================================================================
   YesterdayFace — the back of the card (yesterday's summary)
============================================================================ */
function YesterdayFace({ yesterday }: { yesterday: YesterdayData | null }) {
  if (!yesterday || yesterday.scheduled === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8">
        <div className="text-3xl font-medium text-slate-400 dark:text-white/40">No data yet</div>
        <div className="text-xs text-slate-400 dark:text-white/30 mt-1">Check back tomorrow</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-2">
      {/* Top label */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-white/60 uppercase tracking-wide mb-3">
        <Calendar className="w-3.5 h-3.5" />
        Yesterday
      </div>

      {/* Perfect day badge (if 100%) */}
      {yesterday.isPerfectDay && (
        <div className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-300">
          ★ Perfect Day
        </div>
      )}

      {/* Big % number */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.05 }}
        className={cn(
          "text-6xl font-bold tracking-tight tabular-nums leading-none",
          yesterday.completionPct >= 50
            ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent"
            : "text-slate-400 dark:text-white/40",
        )}
      >
        {yesterday.completionPct}%
      </motion.div>

      {/* Small progress bar */}
      <div className="w-32 mt-3">
        <Progress value={yesterday.completionPct} className="h-1.5" />
      </div>

      {/* Completed / scheduled count */}
      <div className="text-sm text-slate-500 dark:text-white/60 mt-3">
        {yesterday.completed} / {yesterday.scheduled} habits done
      </div>

      {/* Best streak row */}
      {yesterday.bestStreak && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/50 mt-2">
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          <span>
            Best streak: {yesterday.bestStreak.name} · {yesterday.bestStreak.currentStreak}d
          </span>
        </div>
      )}
    </div>
  );
}
