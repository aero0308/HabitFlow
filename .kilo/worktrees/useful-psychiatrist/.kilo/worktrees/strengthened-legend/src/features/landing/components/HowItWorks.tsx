"use client";

import { motion } from "framer-motion";
import { UserPlus, ListChecks, CheckCircle2 } from "lucide-react";
import {
  fadeInUp,
  staggerContainer,
  viewportOnce,
} from "../animations";

interface Step {
  number: number;
  title: string;
  description: string;
  icon: typeof UserPlus;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Create your account",
    description: "Sign up with email. No credit card, no commitment.",
    icon: UserPlus,
  },
  {
    number: 2,
    title: "Add your habits",
    description:
      "Pick from templates or create custom habits with your own schedule.",
    icon: ListChecks,
  },
  {
    number: 3,
    title: "Check in daily",
    description: "Tap to mark complete. Watch your streaks grow.",
    icon: CheckCircle2,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 bg-muted/30 border-y border-border/50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-12 md:mb-16"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4"
          >
            Get started in under 2 minutes
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            Three simple steps to start building better habits.
          </motion.p>
        </motion.div>

        <motion.div
          className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {/* Horizontal connector line on desktop */}
          <div
            className="hidden md:block absolute top-7 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent pointer-events-none"
            aria-hidden
          />

          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={fadeInUp}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative z-10 mb-5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/25 ring-4 ring-background">
                    {step.number}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-background border border-border/60 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-4 shadow-sm">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
