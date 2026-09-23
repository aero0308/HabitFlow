"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Coins,
  Flame,
  Heart,
} from "lucide-react";
import { BadHabitMockup } from "./mockups/BadHabitMockup";

/* ============================================================================
   BreakHabitsSection — landing-page section showcasing the Break Bad Habits
   feature.
   ----------------------------------------------------------------------------
   Layout: REVERSED — visual LEFT, text RIGHT (to alternate visual rhythm
   with AISection above it).

     • LEFT (~60%): BadHabitMockup with ambient glow
     • RIGHT (~40%): badge, headline, subheadline, bullets w/ icons, CTA

   Position: between <AISection /> and <UnifiedShowcase /> on the landing page.

   Visual language matches AISection + UnifiedShowcase:
     • Ambient gradient bg (emerald top-right, amber bottom-left)
     • Dark glass cards with backdrop-blur
     • Framer Motion: same pattern (once: true, stagger 0.06s)
     • Light + dark mode
     • Respects prefers-reduced-motion

   Design tone: supportive, never shaming. All copy emphasizes "clean streaks"
   and "learning", never "failure" or "weakness".
============================================================================ */

interface Bullet {
  icon: typeof Flame;
  text: string;
}

const BULLETS: Bullet[] = [
  { icon: Flame, text: "Clean streak tracking with milestone celebrations" },
  { icon: Coins, text: "See money and time saved in real numbers" },
  { icon: BarChart3, text: "Trigger insights — learn what makes you slip" },
  { icon: Heart, text: "Supportive, never shaming — slips are lessons" },
];

interface BreakHabitsSectionProps {
  /** Called when the user clicks the primary CTA. The landing page wires
      this to navigate to /habits inside the app (or the auth screen if
      the user isn't logged in yet). */
  onStart?: () => void;
}

export function BreakHabitsSection({ onStart }: BreakHabitsSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="break-bad-habits"
      aria-labelledby="break-habits-heading"
      className="
        relative py-20 md:py-28 overflow-hidden
        bg-gradient-to-br from-emerald-50 via-white to-amber-50
        dark:bg-none dark:bg-[#0a0510]
      "
    >
      {/* --- Ambient gradient background (reversed colors) --- */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
      >
        {/* Emerald top-right */}
        <motion.div
          animate={shouldReduceMotion ? undefined : { opacity: [0.3, 0.5, 0.3] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="
            absolute top-[-20%] right-[-10%] w-[600px] h-[600px]
            bg-gradient-to-br from-emerald-500/20 to-transparent
            blur-3xl rounded-full
          "
        />
        {/* Amber bottom-left */}
        <motion.div
          animate={shouldReduceMotion ? undefined : { opacity: [0.3, 0.5, 0.3] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="
            absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px]
            bg-gradient-to-tr from-amber-500/20 to-transparent
            blur-3xl rounded-full
          "
        />
      </motion.div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 md:gap-12 lg:gap-16 lg:grid-cols-[3fr_2fr]">
          {/* ===========================================================
              LEFT COLUMN (~60%) — bad habit mockup (visual rhythm:
              alternate from the right-aligned AIChatMockup above)
              =========================================================== */}
          <div className="order-2 lg:order-1 flex justify-center lg:justify-start">
            <BadHabitMockup />
          </div>

          {/* ===========================================================
              RIGHT COLUMN (~40%) — marketing copy
              =========================================================== */}
          <div className="order-1 lg:order-2 lg:max-w-xl">
            {/* Badge */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="
                inline-flex items-center gap-1.5 rounded-full
                border border-amber-500/30 bg-amber-500/10
                px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300
                mb-5
              "
            >
              <span aria-hidden>🚫</span>
              <span>New · Break Bad Habits</span>
            </motion.div>

            {/* Headline */}
            <motion.h2
              id="break-habits-heading"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4 leading-[1.1]"
            >
              Break the habits
              <br />
              holding you back
            </motion.h2>

            {/* Subheadline */}
            <motion.p
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.08, ease: "easeOut" }}
              className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-7 max-w-md"
            >
              Track what you want to quit with clean streaks, money saved, and
              trigger insights. No shame — just progress.
            </motion.p>

            {/* Bullets */}
            <motion.ul
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: shouldReduceMotion ? 0 : 0.16 }}
              className="space-y-3 mb-8"
            >
              {BULLETS.map((bullet, i) => {
                const Icon = bullet.icon;
                return (
                  <motion.li
                    key={i}
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{
                      duration: 0.35,
                      delay: shouldReduceMotion ? 0 : 0.2 + i * 0.06,
                      ease: "easeOut",
                    }}
                    className="flex items-start gap-2.5"
                  >
                    <Icon className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-foreground/90">
                      {bullet.text}
                    </span>
                  </motion.li>
                );
              })}
            </motion.ul>

            {/* CTA */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.4,
                delay: shouldReduceMotion ? 0 : 0.5,
                ease: "easeOut",
              }}
            >
              <motion.button
                type="button"
                onClick={onStart}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className="
                  inline-flex items-center gap-1.5 rounded-lg
                  bg-violet-600 hover:bg-violet-700 text-white
                  font-medium text-sm px-5 py-2.5 transition-colors
                  shadow-lg shadow-violet-500/20
                  cursor-pointer
                "
              >
                Start breaking habits
                <ArrowRight className="w-4 h-4" />
              </motion.button>
              <p className="text-xs text-muted-foreground mt-2.5">
                Free forever · Track as many bad habits as you want
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
