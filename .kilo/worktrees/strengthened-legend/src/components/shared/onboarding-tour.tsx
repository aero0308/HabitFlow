"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronRight, ChevronLeft, CheckCircle2, Keyboard, CalendarDays, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOUR_STORAGE_KEY = "habitflow-tour-completed-v1";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  highlight?: string; // optional CSS selector to highlight
  accent: string;
}

const STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to HabitFlow! 👋",
    description:
      "Track your habits, build streaks, and visualize your progress. Let's take a quick tour of the key features — it takes less than a minute.",
    icon: Sparkles,
    accent: "emerald",
  },
  {
    id: "dashboard",
    title: "Your daily dashboard",
    description:
      "Every day you'll see today's habits here with a progress ring showing your completion %. Check off habits with one tap, or use keyboard shortcuts (press ? anytime to see them).",
    icon: CheckCircle2,
    accent: "emerald",
  },
  {
    id: "quick-start",
    title: "Quick start with templates",
    description:
      "Head to the Habits page and click 'Quick start' to add from 19 curated habit templates (Health, Learning, Productivity, Mindfulness, Creative) — or create a custom one.",
    icon: ListChecks,
    accent: "emerald",
  },
  {
    id: "streaks",
    title: "Build streaks 🔥",
    description:
      "Complete habits on scheduled days to build streaks. Going on vacation? Use the snowflake 'freeze' button to protect your streak when you can't complete a habit.",
    icon: CheckCircle2,
    accent: "orange",
  },
  {
    id: "weekly-review",
    title: "Weekly review & reflection",
    description:
      "Click 'Weekly review' on the dashboard to see your week-at-a-glance — best/worst habits, per-habit rates, your notes, and reflection prompts to journal your progress.",
    icon: CalendarDays,
    accent: "emerald",
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts ⌨️",
    description:
      "Press 1-9 on the dashboard to instantly toggle the Nth habit. Press ? to see all shortcuts. Press Escape to close any dialog.",
    icon: Keyboard,
    accent: "emerald",
  },
  {
    id: "achievements",
    title: "Unlock achievements 🏆",
    description:
      "Complete habits and build streaks to unlock 12 achievement badges. Check the Achievements page (via the user menu) to see your progress.",
    icon: Sparkles,
    accent: "amber",
  },
  {
    id: "ready",
    title: "You're all set! 🎉",
    description:
      "That's it! Start by adding a habit (try Quick start), check it off today, and watch your streaks grow. Have fun building better habits!",
    icon: CheckCircle2,
    accent: "emerald",
  },
];

const accentMap: Record<string, { bg: string; text: string; ring: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", ring: "ring-emerald-500/30" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-500", ring: "ring-orange-500/30" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-500", ring: "ring-amber-500/30" },
};

export function isTourCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
}

export function markTourCompleted() {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOUR_STORAGE_KEY, "true");
}

export function resetTour() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOUR_STORAGE_KEY);
}

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Auto-open on first visit (after a short delay so the app loads first)
    const t = setTimeout(() => {
      if (!isTourCompleted()) {
        setOpen(true);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    markTourCompleted();
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      close();
    }
  }, [step, close]);

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const skip = useCallback(() => {
    close();
  }, [close]);

  if (!open) return null;

  const current = STEPS[step];
  const accent = accentMap[current.accent] ?? accentMap.emerald;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={close}
        >
          <motion.div
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with icon */}
            <div className={cn("p-6 flex flex-col items-center text-center relative", accent.bg)}>
              <button
                onClick={skip}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-background/50 transition-colors"
                aria-label="Skip tour"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ring-2", accent.bg, accent.ring, "bg-background/80")}>
                <current.icon className={cn("w-8 h-8", accent.text)} />
              </div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Step {step + 1} of {STEPS.length}
              </div>
              <h2 className="text-xl font-bold text-foreground">{current.title}</h2>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-sm text-muted-foreground leading-relaxed text-center">
                {current.description}
              </p>

              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5 mt-5 mb-5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === step ? "w-6 bg-emerald-500" : i < step ? "w-1.5 bg-emerald-400" : "w-1.5 bg-muted",
                    )}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-between gap-2">
                {!isFirst ? (
                  <Button variant="ghost" size="sm" onClick={prev}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={skip}>
                    Skip tour
                  </Button>
                )}
                <Button onClick={next} className="bg-emerald-600 hover:bg-emerald-700">
                  {isLast ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Get started
                    </>
                  ) : (
                    <>
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
