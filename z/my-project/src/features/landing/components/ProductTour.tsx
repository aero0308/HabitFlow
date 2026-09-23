"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { ArrowLeft, ArrowRight, ImageIcon } from "lucide-react";
import { showcaseScreens, type ShowcaseScreen } from "../data/showcaseScreens";
import { cn } from "@/lib/utils";

const AUTO_ADVANCE_INTERVAL_MS = 6000; // 6 seconds between auto-advances
const RESUME_AFTER_INACTIVITY_MS = 15000; // 15 seconds of inactivity before resume

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================================================================
   ProductTour — the "A tour of the app" section.
   ----------------------------------------------------------------------------
   Visual reference: fora.community's product tour — a dark glassmorphic
   device frame floating over a soft ambient gradient background, with
   centered pill tabs at the top and a single-line caption + circular nav
   arrows at the bottom.

   Features:
     • Ambient gradient background (warm amber top-left, soft violet
       bottom-right) — the device frame appears to "float" in warm light.
     • Centered pill tabs with Framer Motion `layoutId` for the active pill
       smoothly sliding between tabs.
     • Device frame with bezel + violet glow drop-shadow.
     • Crossfade screenshot transition (opacity + scale) via AnimatePresence.
     • Caption + circular prev/next nav buttons below the frame.
     • Auto-advance every 6s, paused on hover or manual click; resumes after
       15s of inactivity.
     • Left/Right arrow keys cycle tabs when the section is in viewport.
     • Mobile: swipe left/right on the frame to change tabs.
     • Respects prefers-reduced-motion (animations become instant).
     • Works in light + dark mode (dark frame + glows always visible;
       section background tinted differently per theme).
============================================================================ */

export function ProductTour() {
  const [active, setActive] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const lastInteractionAtRef = useRef(Date.now());
  const sectionRef = useRef<HTMLElement>(null);
  const inViewportRef = useRef(false);

  const total = showcaseScreens.length;
  const screen = showcaseScreens[active];
  const isFirst = active === 0;
  const isLast = active === total - 1;

  const next = useCallback(() => {
    setActive((a) => (a + 1) % total);
    lastInteractionAtRef.current = Date.now();
  }, [total]);

  const prev = useCallback(() => {
    setActive((a) => (a - 1 + total) % total);
    lastInteractionAtRef.current = Date.now();
  }, [total]);

  const goTo = useCallback((i: number) => {
    setActive(i);
    lastInteractionAtRef.current = Date.now();
  }, []);

  /* --- Auto-advance -------------------------------------------------------
     A 6s interval advances the active tab. It's paused while the user is
     hovering OR for 15s after the last manual interaction (click / arrow /
     swipe). After 15s of no interaction AND not hovering, auto-advance
     resumes. */
  useEffect(() => {
    const interval = setInterval(() => {
      if (isHovering) return;
      if (Date.now() - lastInteractionAtRef.current < RESUME_AFTER_INACTIVITY_MS) return;
      setActive((a) => (a + 1) % total);
    }, AUTO_ADVANCE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isHovering, total]);

  /* --- Keyboard nav (only when section is in viewport) -------------------- */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewportRef.current = entry.isIntersecting;
      },
      { threshold: 0.3 },
    );
    observer.observe(section);

    const handleKey = (e: KeyboardEvent) => {
      if (!inViewportRef.current) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", handleKey);
    };
  }, [prev, next]);

  /* --- Swipe (framer-motion drag on the frame) --------------------------- */
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const SWIPE_THRESHOLD = 50;
      if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -300) {
        next();
      } else if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 300) {
        prev();
      }
    },
    [next, prev],
  );

  return (
    <section
      ref={sectionRef}
      id="tour"
      aria-labelledby="product-tour-heading"
      className="
        relative py-20 md:py-28 overflow-hidden
        bg-gradient-to-br from-orange-50 via-white to-violet-50 text-slate-900
        dark:bg-none dark:bg-[#0a0510] dark:text-white
      "
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* --- Ambient gradient background ------------------------------------
        Two layered radial gradients (absolute, blur-3xl, opacity-40, -z-10):
        • Top-left: warm amber/orange glow
        • Bottom-right: soft violet glow
        Result: the device frame appears to "float" in warm light. */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Top-left warm amber glow */}
        <div
          className="
            absolute top-[-20%] left-[-10%] w-[600px] h-[600px]
            bg-gradient-to-br from-orange-500/20 to-transparent
            blur-3xl opacity-30 dark:opacity-40 rounded-full
          "
        />
        {/* Bottom-right soft violet glow */}
        <div
          className="
            absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px]
            bg-gradient-to-tl from-violet-500/20 to-transparent
            blur-3xl opacity-30 dark:opacity-40 rounded-full
          "
        />
        {/* Center subtle violet wash for depth */}
        <div
          className="
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-[500px] h-[500px]
            bg-gradient-to-br from-violet-600/10 to-transparent
            blur-3xl opacity-20 dark:opacity-30 rounded-full
          "
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* --- Header ------------------------------------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-2xl mx-auto mb-10 md:mb-14"
        >
          <div
            className="
              inline-flex items-center gap-2 px-3 py-1 rounded-full
              bg-slate-100 border border-slate-200 text-xs font-semibold
              tracking-wider text-slate-600 uppercase backdrop-blur-md
              dark:bg-white/5 dark:border-white/10 dark:text-white/70
            "
          >
            <ImageIcon className="w-3 h-3" />
            <span>Product Tour</span>
          </div>
          <h2
            id="product-tour-heading"
            className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-4"
          >
            A tour of the app
          </h2>
          <p className="text-sm text-slate-500 dark:text-white/50 mt-2">
            Six screens, built for daily use.
          </p>
        </motion.div>

        {/* --- Tabs --------------------------------------------------------- */}
        <TourTabs screens={showcaseScreens} active={active} onChange={goTo} />

        {/* --- Device Frame -------------------------------------------------- */}
        <TourFrame
          screen={screen}
          onDragEnd={handleDragEnd}
        />

        {/* --- Caption + Navigation ---------------------------------------- */}
        <TourCaption
          screen={screen}
          active={active}
          total={total}
          onPrev={prev}
          onNext={next}
          isFirst={isFirst}
          isLast={isLast}
        />
      </div>
    </section>
  );
}

/* ============================================================================
   TourTabs — centered pill tab row with Framer Motion layoutId for the
   active pill smoothly sliding between tabs.
============================================================================ */

interface TourTabsProps {
  screens: ShowcaseScreen[];
  active: number;
  onChange: (i: number) => void;
}

function TourTabs({ screens, active, onChange }: TourTabsProps) {
  return (
    <div className="flex justify-center">
      {/* On mobile: horizontal scroll, hide scrollbar, snap-x */}
      <div
        className="
          inline-flex items-center gap-1 p-1.5 rounded-full
          bg-slate-100 border border-slate-200 backdrop-blur-md
          dark:bg-white/5 dark:border-white/10
          overflow-x-auto no-scrollbar snap-x
          max-w-full
        "
      >
        {screens.map((s, i) => {
          const isActive = active === i;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(i)}
              aria-current={isActive ? "true" : undefined}
              aria-label={s.title}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-2",
                "text-xs sm:text-sm font-medium transition-colors duration-200",
                "whitespace-nowrap flex-shrink-0 snap-start",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
                isActive
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-white/50 dark:hover:text-white/80 dark:hover:bg-white/5",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="tour-active-pill"
                  className="absolute inset-0 rounded-full bg-violet-100 ring-1 ring-violet-300 dark:bg-white/10 dark:ring-white/20"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 300, damping: 30 }
                  }
                />
              )}
              <Icon className="relative w-3.5 h-3.5 flex-shrink-0" />
              <span className="relative">{s.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   TourFrame — device frame with bezel + violet glow shadow + crossfade
   screenshot transition.
============================================================================ */

interface TourFrameProps {
  screen: ShowcaseScreen;
  onDragEnd: (_: unknown, info: PanInfo) => void;
}

function TourFrame({ screen, onDragEnd }: TourFrameProps) {
  return (
    <div className="max-w-6xl mx-auto mt-10">
      {/* Outer frame — bezel + violet glow drop-shadow */}
      <div
        className="
          relative rounded-2xl md:rounded-3xl
          border border-slate-200 bg-white p-2
          dark:border-white/10 dark:bg-[#0a0a0f]
          shadow-[0_20px_80px_-20px_rgba(139,92,246,0.4)]
          overflow-hidden
        "
      >
        {/* --- Optional "shine" sweep on tab change ------------------------ */}
        <AnimatePresence>
          <motion.div
            key={`shine-${screen.id}`}
            aria-hidden
            initial={{ x: "-150%", opacity: 0 }}
            animate={{ x: "150%", opacity: [0, 0.5, 0] }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 1.1, ease: "easeInOut" }
            }
            className="
              absolute inset-y-0 z-20 w-1/3 pointer-events-none
              bg-gradient-to-r from-transparent via-white/10 to-transparent
              skew-x-12
            "
          />
        </AnimatePresence>

        {/* --- Screenshot (crossfade between tabs) ------------------------- */}
        <div
          className="
            relative rounded-xl md:rounded-2xl overflow-hidden
            border border-slate-200 bg-[#0a0a0f]
            dark:border-white/5
          "
          style={{ aspectRatio: "3 / 2" }}
        >
          <AnimatePresence mode="sync">
            <motion.div
              key={screen.id}
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.02 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
              drag={prefersReducedMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={onDragEnd}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
            >
              <Image
                src={screen.image}
                alt={`${screen.title} screen preview`}
                fill
                priority={false}
                sizes="(max-width: 768px) 100vw, 1152px"
                className="object-contain object-top select-none"
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   TourCaption — row with circular prev button (left), centered caption
   text (middle, crossfades per tab), circular next button (right).
============================================================================ */

interface TourCaptionProps {
  screen: ShowcaseScreen;
  active: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function TourCaption({
  screen,
  onPrev,
  onNext,
  isFirst,
  isLast,
}: TourCaptionProps) {
  return (
    <div
      className="
        flex items-center justify-between gap-4
        max-w-4xl mx-auto mt-6
      "
    >
      {/* LEFT: circular prev button */}
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst}
        aria-label="Previous screen"
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          "border border-slate-200 bg-slate-100 backdrop-blur-md",
          "dark:border-white/10 dark:bg-white/5",
          "text-slate-600 dark:text-white/70 transition-all duration-200",
          "hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300",
          "dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-white/20",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
          isFirst && "opacity-30 cursor-not-allowed hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-white/70",
        )}
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      {/* CENTER: caption text (crossfades per tab) */}
      <div className="flex-1 min-w-0 flex justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={screen.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
            className="
              text-center text-sm md:text-base text-slate-600 dark:text-white/60
              leading-relaxed px-2
            "
          >
            {screen.caption}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* RIGHT: circular next button */}
      <button
        type="button"
        onClick={onNext}
        disabled={isLast}
        aria-label="Next screen"
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          "border border-slate-200 bg-slate-100 backdrop-blur-md",
          "dark:border-white/10 dark:bg-white/5",
          "text-slate-600 dark:text-white/70 transition-all duration-200",
          "hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300",
          "dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-white/20",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
          isLast && "opacity-30 cursor-not-allowed hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-white/70",
        )}
      >
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
