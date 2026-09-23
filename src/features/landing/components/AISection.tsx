"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Database,
  Key,
  Mail,
  MessageSquare,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { AIChatMockup } from "./mockups/AIChatMockup";

/* ============================================================================
   AISection — landing-page section showcasing the AI Assistant feature.
   ----------------------------------------------------------------------------
   Layout: two columns
     • LEFT (~40%): badge, headline, subheadline, bullets w/ icons, CTA
     • RIGHT (~60%): AIChatMockup with ambient glow

   Position: between <Features /> and <BreakHabitsSection /> on the landing page.

   Visual language matches UnifiedShowcase:
     • Ambient gradient bg (amber top-left, violet bottom-right)
     • Dark glass cards with backdrop-blur
     • Framer Motion: headline fades + slides up, bullets stagger, CTA scales
     • Light + dark mode
     • Respects prefers-reduced-motion

   Animation:
     • Headline + subheadline fade + slide up on scroll into view (once)
     • Bullets stagger in (0.06s delay each)
     • CTA: subtle scale on hover
     • Mockup: floating panel (handled inside AIChatMockup)
     • Ambient glow: subtle pulse (opacity 0.3 → 0.5, 8s loop)
============================================================================ */

interface Bullet {
  icon: typeof Database;
  text: string;
}

const BULLETS: Bullet[] = [
  { icon: MessageSquare, text: "Ask anything — general questions like ChatGPT" },
  { icon: Database, text: "Chat with your data — grounded in your real habits and mood" },
  { icon: Mail, text: "Weekly coach letter — a personal letter every Sunday" },
  { icon: Sparkles, text: "Smart suggestions — AI proposes habits from your goals" },
  { icon: Key, text: "Bring your own key — free with Gemini or Groq" },
];

interface AISectionProps {
  /** Called when the user clicks the primary CTA. The landing page wires
      this to navigate to /insights inside the app (or the auth screen if
      the user isn't logged in yet). */
  onTry?: () => void;
}

export function AISection({ onTry }: AISectionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="ai-assistant"
      aria-labelledby="ai-section-heading"
      className="
        relative py-20 md:py-28 overflow-hidden
        bg-gradient-to-br from-amber-50 via-white to-violet-50
        dark:bg-none dark:bg-[#0a0510]
      "
    >
      {/* --- Ambient gradient background --- */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
      >
        {/* Amber top-left */}
        <motion.div
          animate={shouldReduceMotion ? undefined : { opacity: [0.3, 0.5, 0.3] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="
            absolute top-[-20%] left-[-10%] w-[600px] h-[600px]
            bg-gradient-to-br from-amber-500/20 to-transparent
            blur-3xl rounded-full
          "
        />
        {/* Violet bottom-right */}
        <motion.div
          animate={shouldReduceMotion ? undefined : { opacity: [0.3, 0.5, 0.3] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="
            absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px]
            bg-gradient-to-tl from-violet-500/20 to-transparent
            blur-3xl rounded-full
          "
        />
      </motion.div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 md:gap-12 lg:gap-16 lg:grid-cols-[2fr_3fr]">
          {/* ===========================================================
              LEFT COLUMN (~40%) — marketing copy
              =========================================================== */}
          <div className="lg:max-w-xl">
            {/* Badge */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="
                inline-flex items-center gap-1.5 rounded-full
                border border-violet-500/30 bg-violet-500/10
                px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300
                mb-5
              "
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New · AI Assistant</span>
            </motion.div>

            {/* Headline */}
            <motion.h2
              id="ai-section-heading"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4 leading-[1.1]"
            >
              Your habits, understood.
              <br />
              Your questions, answered.
            </motion.h2>

            {/* Subheadline */}
            <motion.p
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.08, ease: "easeOut" }}
              className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-7 max-w-md"
            >
              Chat with your data or ask anything. Get personalized weekly
              letters from your AI coach. All powered by your own API key —
              Gemini, Groq, OpenAI, and more.
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
                    <Icon className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
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
                onClick={onTry}
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
                Try the AI assistant
                <ArrowRight className="w-4 h-4" />
              </motion.button>
              <p className="text-xs text-muted-foreground mt-2.5">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Free with Google Gemini · No credit card
                </span>
              </p>
            </motion.div>
          </div>

          {/* ===========================================================
              RIGHT COLUMN (~60%) — chat mockup
              =========================================================== */}
          <div className="flex justify-center lg:justify-end">
            <AIChatMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
