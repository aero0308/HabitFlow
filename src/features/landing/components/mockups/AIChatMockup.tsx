"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

/* ============================================================================
   AIChatMockup — STATIC landing-page mockup of the in-app AI Assistant.
   ----------------------------------------------------------------------------
   Two stacked "conversation" cards inside a glassmorphic panel:
     1. Data-mode example ("Why am I tired on Tuesdays?" → cites real numbers)
     2. General-mode example ("What habits improve productivity?" → advice)

   No real API calls — just styled React. Used by AISection on the landing
   page to show what the in-app chat looks like.

   Layout:
     • Outer container: max-w-md, rounded-2xl, dark glass bg + backdrop blur
     • Header: Sparkles (violet) + "Ask HabitFlow AI" + small tab pills
     • Two conversation blocks stacked with gap-3
     • Footer: "Powered by your own AI key" badge + provider pills row

   Animation:
     • Panel floats gently (y: [0, -6, 0], 6s loop)
     • Each message bubbles in on scroll (stagger 0.08s)
     • Disabled by prefers-reduced-motion
============================================================================ */

interface Message {
  role: "you" | "ai";
  text: React.ReactNode;
}

interface Conversation {
  mode: "data" | "general";
  messages: Message[];
}

const CONVERSATIONS: Conversation[] = [
  {
    mode: "data",
    messages: [
      {
        role: "you",
        text: "Why am I tired on Tuesdays?",
      },
      {
        role: "ai",
        text: (
          <>
            Looking at the last 8 Tuesdays, you averaged{" "}
            <strong className="font-semibold text-violet-600 dark:text-violet-300">
              5.8/10 mood
            </strong>{" "}
            vs 7.4/10 on other days. Two things correlate: (1) You skip
            &ldquo;Morning Run&rdquo; on Tuesdays 75% of the time, and (2) your
            Monday sleep log shows you log &ldquo;Journal&rdquo; later (avg
            11:42 PM).
          </>
        ),
      },
    ],
  },
  {
    mode: "general",
    messages: [
      {
        role: "you",
        text: "What habits improve productivity?",
      },
      {
        role: "ai",
        text: (
          <>
            Three habits with the highest impact:{" "}
            <strong className="font-semibold text-violet-600 dark:text-violet-300">
              Morning planning
            </strong>{" "}
            (5 min),{" "}
            <strong className="font-semibold text-violet-600 dark:text-violet-300">
              Pomodoro focus blocks
            </strong>{" "}
            (25 min), and{" "}
            <strong className="font-semibold text-violet-600 dark:text-violet-300">
              Inbox zero before noon
            </strong>
            . Start with planning — it takes 5 minutes and anchors the whole
            day.
          </>
        ),
      },
    ],
  },
];

const PROVIDER_PILLS = ["Gemini", "Groq", "OpenAI", "Claude", "NVIDIA"];

export function AIChatMockup() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative"
    >
      {/* --- Ambient glow behind the panel (pulsing) --- */}
      <div
        aria-hidden
        className="
          absolute -inset-4 sm:-inset-6 -z-10 rounded-full
          bg-violet-500/20 blur-3xl
          dark:bg-violet-500/30
        "
      />

      {/* --- Floating panel --- */}
      <motion.div
        animate={shouldReduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="
          relative max-w-md mx-auto rounded-2xl overflow-hidden
          border border-slate-200/70 dark:border-white/15
          bg-white/95 dark:bg-[#0a0a0f]/95
          backdrop-blur-xl
          shadow-2xl shadow-violet-500/10
        "
      >
        {/* --- Header --- */}
        <div
          className="
            flex items-center justify-between gap-2 px-4 py-3
            border-b border-slate-200/70 dark:border-white/5
            bg-slate-50/60 dark:bg-white/[0.02]
          "
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-violet-500/15 border border-violet-500/20">
              <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Ask HabitFlow AI
            </span>
          </div>
          {/* Tab pills */}
          <div className="flex items-center gap-1 text-[10px] font-medium">
            <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30">
              data
            </span>
            <span className="text-slate-400 dark:text-white/40">|</span>
            <span className="px-2 py-0.5 rounded-full text-slate-500 dark:text-white/50">
              general
            </span>
          </div>
        </div>

        {/* --- Conversation blocks --- */}
        <div className="p-4 space-y-4">
          {CONVERSATIONS.map((conv, convIdx) => (
            <motion.div
              key={conv.mode}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.4,
                delay: shouldReduceMotion ? 0 : 0.1 + convIdx * 0.15,
                ease: "easeOut",
              }}
              className="space-y-2"
            >
              {conv.messages.map((msg, msgIdx) => (
                <motion.div
                  key={msgIdx}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.35,
                    delay: shouldReduceMotion ? 0 : 0.15 + convIdx * 0.3 + msgIdx * 0.08,
                    ease: "easeOut",
                  }}
                  className={msg.role === "you" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      msg.role === "you"
                        ? `
                          max-w-[85%] rounded-2xl rounded-tr-sm
                          px-3.5 py-2 text-[13px] leading-relaxed
                          bg-slate-100 dark:bg-white/[0.06]
                          text-slate-700 dark:text-white/85
                          border border-slate-200 dark:border-white/5
                        `
                        : `
                          max-w-[90%] rounded-2xl rounded-tl-sm
                          px-3.5 py-2.5 text-[13px] leading-relaxed
                          bg-violet-500/[0.06] dark:bg-violet-500/[0.08]
                          text-slate-700 dark:text-white/85
                          border border-violet-500/15 dark:border-violet-500/20
                        `
                    }
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ))}

          {/* --- Typing indicator (purely decorative) --- */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.8, duration: 0.4 }}
            className="flex items-center gap-1.5 text-slate-400 dark:text-white/40"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-violet-400"
                  animate={shouldReduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
            <span className="text-[11px]">AI is typing…</span>
          </motion.div>
        </div>

        {/* --- Footer --- */}
        <div
          className="
            px-4 py-3 border-t border-slate-200/70 dark:border-white/5
            bg-slate-50/60 dark:bg-white/[0.02]
            flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3
          "
        >
          <span
            className="
              inline-flex items-center gap-1 text-[10px] font-medium
              px-2 py-0.5 rounded-full
              bg-emerald-500/10 text-emerald-700 dark:text-emerald-300
              border border-emerald-500/20
              self-start sm:self-auto
              whitespace-nowrap
            "
          >
            <span aria-hidden>🔐</span>
            Powered by your own AI key
          </span>
          <div
            className="
              flex flex-wrap items-center gap-x-1 gap-y-0.5
              text-[10px] text-slate-500 dark:text-white/50
              sm:justify-end
            "
          >
            {PROVIDER_PILLS.map((p, i) => (
              <span key={p} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300 dark:text-white/20">·</span>}
                <span className="font-medium">{p}</span>
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
