"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * ChatWelcome — empty state shown when there are no messages.
 *
 * Layout:
 *  - Sparkles icon inside a gradient circle
 *  - Mode-specific title + subtitle
 *  - Suggested question chips (staggered fade-in) — fetched from
 *    /api/insights/chat/suggested-questions?mode=<mode>
 *
 * Clicking a chip sends the question to the parent's onPick handler.
 */

interface ChatWelcomeProps {
  onPick: (question: string) => void;
  disabled?: boolean;
  mode?: "data" | "general";
}

const WELCOME_COPY: Record<"data" | "general", { title: string; subtitle: string }> = {
  data: {
    title: "Chat with your data",
    subtitle:
      "Ask questions about your habits, streaks, and mood. Answers come straight from your own check-ins.",
  },
  general: {
    title: "Ask anything",
    subtitle:
      "Get advice on habits, productivity, or anything else. I can see your habit list — but won't recite it unless you ask.",
  },
};

export function ChatWelcome({ onPick, disabled, mode = "data" }: ChatWelcomeProps) {
  const reduceMotion = useReducedMotion();
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const copy = WELCOME_COPY[mode];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/insights/chat/suggested-questions?mode=${mode}`,
        );
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { questions?: string[] };
        if (!cancelled && Array.isArray(json.questions)) {
          setQuestions(json.questions.slice(0, 4));
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const fadeUp = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="flex flex-col items-center text-center py-8 sm:py-10 px-4">
      {/* Icon */}
      <motion.div
        initial={fadeUp.initial}
        animate={fadeUp.animate}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="
          w-14 h-14 rounded-full
          bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 dark:from-violet-500/30 dark:to-fuchsia-500/20
          flex items-center justify-center mb-4
          border border-violet-500/20
        "
      >
        <Sparkles className="w-7 h-7 text-violet-600 dark:text-violet-300" />
      </motion.div>

      {/* Heading */}
      <motion.h3
        initial={fadeUp.initial}
        animate={fadeUp.animate}
        transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.05, ease: "easeOut" }}
        className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-1.5"
      >
        {copy.title}
      </motion.h3>

      <motion.p
        initial={fadeUp.initial}
        animate={fadeUp.animate}
        transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.1, ease: "easeOut" }}
        className="text-sm text-slate-600 dark:text-white/45 max-w-md leading-relaxed mb-6"
      >
        {copy.subtitle}
      </motion.p>

      {/* Suggested chips */}
      <div className="flex flex-col gap-2 w-full max-w-md">
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-9 rounded-full bg-slate-100 dark:bg-white/5 animate-pulse"
                style={{ width: `${75 + (i % 2) * 12}%`, alignSelf: i % 2 ? "flex-end" : "flex-start" }}
              />
            ))}
          </>
        ) : questions.length > 0 ? (
          questions.map((q, i) => (
            <motion.button
              key={`${q}-${i}`}
              type="button"
              onClick={() => !disabled && onPick(q)}
              disabled={disabled}
              initial={fadeUp.initial}
              animate={fadeUp.animate}
              transition={{
                duration: 0.3,
                delay: reduceMotion ? 0 : 0.15 + i * 0.06,
                ease: "easeOut",
              }}
              className="
                text-left text-sm text-slate-800 dark:text-white/75
                px-4 py-2 rounded-full
                border border-slate-200 bg-slate-100
                hover:bg-slate-200 hover:border-violet-500/30 hover:text-slate-900
                dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-white/[0.07] dark:hover:text-white
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {q}
            </motion.button>
          ))
        ) : null}
      </div>
    </div>
  );
}
