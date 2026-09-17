"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pricingTiers } from "../data/pricing";
import {
  fadeInUp,
  staggerContainer,
  viewportOnce,
} from "../animations";

interface PricingProps {
  onGetStarted: () => void;
}

const ACCENT_STYLES = {
  emerald: {
    iconWrap:
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.18)]",
    badge:
      "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    price: "text-emerald-600 dark:text-emerald-300",
    check: "text-emerald-400",
    ctaGradient:
      "from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600",
    glow: "from-emerald-600/15 via-teal-600/10 to-transparent",
    ring: "ring-1 ring-emerald-500/30",
    bullet: "bg-emerald-400",
  },
  violet: {
    iconWrap:
      "bg-violet-500/10 border-violet-500/20 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.18)]",
    badge:
      "bg-violet-500/15 border-violet-500/30 text-violet-300",
    price: "text-violet-600 dark:text-violet-300",
    check: "text-violet-400",
    ctaGradient:
      "from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600",
    glow: "from-violet-600/15 via-fuchsia-600/10 to-transparent",
    ring: "ring-1 ring-violet-500/30",
    bullet: "bg-violet-400",
  },
} as const;

export function Pricing({ onGetStarted }: PricingProps) {
  return (
    <section
      id="pricing"
      className="relative bg-gradient-to-br from-orange-50 via-white to-violet-50 text-slate-900 dark:bg-none dark:bg-[#080B11] dark:text-zinc-100 overflow-hidden py-20 md:py-28"
    >
      {/* Ambient background — fixed dark, lives behind content */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden opacity-50 dark:opacity-100"
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-80" />
        <div className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-emerald-600/10 dark:from-emerald-600/15 via-teal-600/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] bg-violet-600/10 blur-[130px] rounded-full" />
        <div className="absolute top-[60%] -right-[10%] w-[600px] h-[600px] bg-rose-600/10 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-10 md:mb-14"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold tracking-wider text-emerald-600 dark:bg-white/[0.04] dark:border-white/10 dark:text-emerald-300 uppercase mb-4 shadow-inner backdrop-blur-md"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>💎 HONEST PRICING</span>
          </motion.div>

          <motion.h2
            variants={fadeInUp}
            className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-4 leading-[1.1]"
          >
            Free forever. Pro when you need it.
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg text-slate-600 dark:text-zinc-400 font-normal leading-relaxed"
          >
            Start with everything you need at no cost. Unlock AI coaching,
            team features, and advanced insights when you&rsquo;re ready.
          </motion.p>
        </motion.div>

        {/* Pricing cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-3xl mx-auto"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {pricingTiers.map((tier) => {
            const styles =
              ACCENT_STYLES[tier.accent] ?? ACCENT_STYLES.emerald;
            return (
              <motion.article
                key={tier.name}
                variants={fadeInUp}
                className={`card-glass relative rounded-2xl p-5 sm:p-6 flex flex-col gap-4 border border-slate-200 dark:border-white/[0.07] transition-all duration-300 hover:-translate-y-1 ${styles.ring} ${
                  tier.disabled ? "opacity-95 overflow-hidden" : ""
                }`}
              >
                {/* Subtle accent glow at the top of the card */}
                <div
                  aria-hidden
                  className={`absolute -top-px left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r ${styles.glow} blur-sm pointer-events-none`}
                />

                {/* "Coming Soon" price-tag sticker overlay for the disabled
                    (Pro) plan. Designed to look like a clothing-store price
                    tag stuck onto the card — slight rotation, string + hole
                    at the top, gradient body, drop shadow, and a notched
                    corner to evoke a real price tag's string slot. */}
                {tier.disabled && (
                  <div
                    aria-hidden
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 pointer-events-none select-none"
                  >
                    <div className="relative -rotate-[6deg]">
                      {/* String hole at the top — evokes a price tag */}
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white dark:bg-[#080B11] ring-1 ring-white/40" />
                      {/* Tiny "string" connecting the hole to the tag */}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-px h-1 bg-white/40" />

                      {/* Tag body */}
                      <div className="relative bg-gradient-to-br from-violet-500 via-fuchsia-500 to-violet-600 text-white pl-4 pr-3.5 py-1.5 rounded-md shadow-xl shadow-violet-500/40 border border-white/25 text-center min-w-[118px]">
                        {/* Notched left edge — the price-tag arrow cutout */}
                        <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rounded-full bg-white dark:bg-[#080B11] ring-1 ring-white/20" />

                        <div className="text-[8px] font-medium uppercase tracking-[0.2em] text-white/80 leading-tight">
                          Pro Plan
                        </div>
                        <div className="text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 leading-tight mt-0.5">
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                          Coming Soon
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Plan header — icon + name (badge now rendered as the
                    sticker overlay above for the disabled plan) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center border ${styles.iconWrap}`}
                    >
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {tier.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
                        {tier.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1.5 pb-0.5">
                  <span className={`text-4xl font-extrabold ${styles.price}`}>
                    {tier.price}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-zinc-500 font-medium">
                    / {tier.period}
                  </span>
                </div>

                {/* Divider */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />

                {/* Features list */}
                <ul className="space-y-2 flex-1">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-zinc-300"
                    >
                      <span
                        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center bg-slate-100 border border-slate-200 dark:bg-white/[0.04] dark:border-white/10 p-0.5`}
                      >
                        <Check className={`w-2.5 h-2.5 ${styles.check}`} strokeWidth={3} />
                      </span>
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="pt-1">
                  {tier.disabled ? (
                    <Button
                      disabled
                      variant="outline"
                      size="sm"
                      className="w-full h-9 bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-400 dark:bg-white/[0.04] dark:border-white/15 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-zinc-400 cursor-not-allowed"
                      title="Coming soon"
                    >
                      {tier.cta}
                    </Button>
                  ) : (
                    <Button
                      onClick={onGetStarted}
                      size="sm"
                      className={`w-full h-9 bg-gradient-to-r ${styles.ctaGradient} text-white border-0 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40`}
                    >
                      {tier.cta}
                    </Button>
                  )}
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
