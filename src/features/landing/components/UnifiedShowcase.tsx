"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { ShowcaseTabs, type ShowcaseTab } from "./ShowcaseTabs";
import { HabitsPreviewCard } from "./HabitsPreviewCard";
import { MoodPreviewCard } from "./MoodPreviewCard";

/* ============================================================================
   UnifiedShowcase — tabbed showcase with "Habits" and "Mood" tabs.
   ----------------------------------------------------------------------------
   Replaces the old MoodShowcase. Clicking a tab swaps BOTH the marketing copy
   on the LEFT (headline, subheadline, bullets, CTA) AND the visual mockup on
   the RIGHT (HabitsPreviewCard or MoodPreviewCard).

   Visual language matches the Product Tour / Fora-style section:
     • Ambient gradient background (amber top-left, violet bottom-right)
     • Dark glassmorphic cards with backdrop-blur
     • Fora-style pill tabs with Framer Motion layoutId sliding
     • Smooth crossfade transitions (opacity + y/scale)

   Default tab: "mood" (preserves the original "See how your habits shape
   your mood" messaging).

   Layout:
     • Desktop (lg+): two columns — text left (~40%), tab switcher + mockup
       right (~60%). Tab switcher right-aligned.
     • Tablet (md): two columns, tighter spacing. Tab switcher centered.
     • Mobile (< md): single column — text, then full-width tab switcher,
       then stacked mockup cards.

   Light/Dark mode:
     • Light: soft cream gradient bg (from-orange-50 via-white to-violet-50),
       white cards, slate text.
     • Dark: bg-[#0a0510] with ambient glows, dark cards, white text.

   Accessibility:
     • prefers-reduced-motion respected via useReducedMotion() hook.
     • AnimatePresence mode="wait" for clean exit/enter.
     • min-h on both columns prevents layout shift during tab switch.
============================================================================ */

interface TabContent {
  badge: string;
  badgeEmoji: string;
  headline: string;
  subheadline: string;
  bullets: string[];
  cta: string;
}

const TAB_CONTENT: Record<ShowcaseTab, TabContent> = {
  habits: {
    badge: "New · Unified Tracking",
    badgeEmoji: "🧠",
    headline: "Build habits that actually stick",
    subheadline:
      "Track daily habits with custom schedules, targets, and streaks. See exactly where you're consistent — and where you slip.",
    bullets: [
      "Custom schedules — daily, weekly, or specific days",
      "Streak tracking with off-mode support",
      "Time-of-day habits (Morning / Afternoon / Evening)",
    ],
    cta: "Try it free",
  },
  mood: {
    badge: "New · Unified Tracking",
    badgeEmoji: "🧠",
    headline: "See how your habits shape your mood",
    subheadline:
      "Log how you feel each day and let HabitFlow connect the dots. Discover which habits actually lift you up — and which ones quietly drag you down.",
    bullets: [
      "One-tap mood logging with emojis and tags",
      "See how your habits actually move your mood",
      "Daily, weekly, and day-of-week patterns at a glance",
    ],
    cta: "Try it free",
  },
};

export function UnifiedShowcase({ onGetStarted }: { onGetStarted: () => void }) {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("mood");
  const shouldReduceMotion = useReducedMotion();
  const content = TAB_CONTENT[activeTab];

  /* --- Optional: sync active tab with URL hash (#habits or #mood) -------
     Reads the URL hash on mount so users can deep-link to a specific tab.
     Uses setState in effect because window.location.hash is client-only —
     reading it during SSR would cause a hydration mismatch. The setState
     only runs once on mount (gated by the hash check), so this is the
     standard "read from URL on mount" pattern. */
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash === "habits" || hash === "mood") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(hash);
    }
  }, []);

  useEffect(() => {
    // replaceState (not pushState) so we don't pollute browser history.
    if (typeof window !== "undefined") {
      const newHash = `#${activeTab}`;
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, "", newHash);
      }
    }
  }, [activeTab]);

  return (
    <section
      id="mood-tracking"
      aria-labelledby="unified-showcase-heading"
      className="
        relative py-20 md:py-28 overflow-hidden
        bg-gradient-to-br from-orange-50 via-white to-violet-50
        dark:bg-none dark:bg-[#0a0510]
      "
    >
      {/* --- Ambient gradient background (matches Product Tour) ------------
        Two layered radial gradients (absolute, blur-3xl, opacity-40, -z-10):
        • Top-left: warm amber glow
        • Bottom-right: soft violet glow */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="
            absolute top-[-20%] left-[-10%] w-[600px] h-[600px]
            bg-gradient-to-br from-orange-500/20 to-transparent
            blur-3xl opacity-40 rounded-full
          "
        />
        <div
          className="
            absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px]
            bg-gradient-to-tl from-violet-500/20 to-transparent
            blur-3xl opacity-40 rounded-full
          "
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 md:gap-12 lg:gap-16 lg:grid-cols-[2fr_3fr]">
          {/* ========================================================
              LEFT COLUMN (~40%): marketing copy — crossfades per tab
              ======================================================== */}
          <div className="lg:max-w-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={
                  shouldReduceMotion ? false : { opacity: 0, y: 8 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.25, ease: "easeOut" }
                }
                className="
                  min-h-[540px] sm:min-h-[540px]
                  flex flex-col
                "
              >
                {/* Badge */}
                <div
                  className="
                    inline-flex items-center gap-1.5 rounded-full
                    border border-violet-500/30 bg-violet-500/10
                    px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-300
                    mb-5
                  "
                >
                  <span aria-hidden>{content.badgeEmoji}</span>
                  <span>{content.badge}</span>
                </div>

                {/* Headline */}
                <h2
                  id="unified-showcase-heading"
                  className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4 leading-[1.1]"
                >
                  {content.headline}
                </h2>

                {/* Subheadline */}
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-7">
                  {content.subheadline}
                </p>

                {/* Bullets */}
                <ul className="space-y-3 mb-8">
                  {content.bullets.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm sm:text-base text-foreground/90">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA — both tabs use "Try it free" and navigate to the
                    sign-up page via the onGetStarted callback (which calls
                    onShowAuth("register")). mt-auto pushes it to the bottom
                    of the min-h container so the shorter (Habits) tab
                    doesn't leave awkward empty space below the button. */}
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="
                    mt-auto inline-flex items-center gap-1.5 rounded-lg
                    bg-violet-600 hover:bg-violet-700 text-white
                    font-medium text-sm px-5 py-2.5 transition-colors
                    shadow-lg shadow-violet-500/20
                    w-fit cursor-pointer
                  "
                >
                  {content.cta}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ========================================================
              RIGHT COLUMN (~60%): tab switcher + mockup
              ======================================================== */}
          <div className="flex flex-col">
            {/* --- Tab switcher ---
                Mobile (< md): full-width tabs (variant="full"), shown between
                  text and mockup.
                Desktop (md+): inline tabs (variant="inline"), centered on
                  tablet, right-aligned on desktop. */}
            <div className="md:hidden mb-6 order-2">
              <ShowcaseTabs
                active={activeTab}
                onChange={setActiveTab}
                variant="full"
              />
            </div>
            <div className="hidden md:flex justify-center lg:justify-end mb-6 order-1">
              <ShowcaseTabs
                active={activeTab}
                onChange={setActiveTab}
                variant="inline"
              />
            </div>

            {/* --- Mockup (crossfades per tab) ---
                min-h prevents layout shift during the AnimatePresence
                mode="wait" gap (old content exits before new content
                enters). */}
            <div className="order-3 min-h-[420px] sm:min-h-[440px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={
                    shouldReduceMotion
                      ? false
                      : { opacity: 0, scale: 0.98 }
                  }
                  animate={{ opacity: 1, scale: 1 }}
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 1.02 }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.3, ease: "easeOut" }
                  }
                >
                  {activeTab === "habits" ? (
                    <HabitsPreviewCard />
                  ) : (
                    <MoodPreviewCard />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
