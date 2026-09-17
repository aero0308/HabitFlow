"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShowcaseCard } from "./ShowcaseCard";
import { showcaseScreens } from "../data/showcaseScreens";
import { cn } from "@/lib/utils";

/**
 * Product showcase — "A tour of the app".
 *
 * Dark glassmorphism section with SCREEN-NAME tabs (Dashboard, Habits, Mood,
 * Analytics, Insights, Achievements). Clicking a tab shows ONLY that screen.
 * No "All" tab — one screen at a time, large + immersive.
 *
 * The screenshot sits in a browser-window frame with a caption below.
 * Left/right arrows let the user cycle through screens.
 */
export function ScrollShowcase() {
  const [active, setActive] = useState(0);
  const screen = showcaseScreens[active];

  function next() {
    setActive((a) => (a + 1) % showcaseScreens.length);
  }
  function prev() {
    setActive((a) => (a - 1 + showcaseScreens.length) % showcaseScreens.length);
  }

  // Preload ALL screenshots on mount so switching tabs is instant
  useEffect(() => {
    showcaseScreens.forEach((s) => {
      const img = new Image();
      img.src = s.image;
    });
  }, []);

  return (
    <section
      aria-labelledby="showcase-heading"
      className="relative py-16 sm:py-20 md:py-28 bg-[#080B11] text-white overflow-hidden"
    >
      {/* Ambient background */}
      <div aria-hidden className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-80" />
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[40%] -right-[10%] w-[500px] h-[500px] bg-cyan-600/10 blur-[130px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 md:mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] sm:text-xs font-semibold tracking-wider text-indigo-300 uppercase mb-4 sm:mb-5 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
            <span>Product Tour</span>
          </div>
          <h2
            id="showcase-heading"
            className="text-2xl sm:text-3xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-3 sm:mb-4"
          >
            A tour of the app
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-zinc-400 leading-relaxed">
            Six screens, built for daily use. Click a tab to explore each one.
          </p>
        </motion.div>

        {/* Screen-name tabs — scrollable on mobile */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8 md:mb-12 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {showcaseScreens.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap flex-shrink-0",
                active === i
                  ? "bg-zinc-100 text-zinc-900 shadow-sm"
                  : "bg-zinc-900/80 text-zinc-400 border border-white/5 hover:border-white/20 hover:text-white",
              )}
            >
              {s.title}
            </button>
          ))}
        </motion.div>

        {/* Active screenshot — flex row with fixed arrows */}
        <div className="relative mx-auto max-w-4xl flex items-center gap-1.5 sm:gap-2 md:gap-4">
          {/* Prev arrow */}
          <button
            type="button"
            onClick={prev}
            className="flex-shrink-0 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all backdrop-blur-md"
            aria-label="Previous screen"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          {/* Screenshot area */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={screen.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <ShowcaseCard
                  screen={screen}
                  index={active}
                  total={showcaseScreens.length}
                  priority={true}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Next arrow */}
          <button
            type="button"
            onClick={next}
            className="flex-shrink-0 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all backdrop-blur-md"
            aria-label="Next screen"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mt-6 sm:mt-8">
          {showcaseScreens.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                active === i ? "w-6 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40",
              )}
              aria-label={`Go to ${s.title}`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 sm:mt-10 flex items-center justify-center gap-2 text-[10px] sm:text-xs text-zinc-500">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live screenshots from the app — no mockups</span>
        </div>
      </div>
    </section>
  );
}
