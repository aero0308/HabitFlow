"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
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

export function Pricing({ onGetStarted }: PricingProps) {
  return (
    <section id="pricing" className="py-20 md:py-28">
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
            Simple, honest pricing
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            Free forever. No hidden fees.
          </motion.p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {pricingTiers.map((tier) => (
            <motion.div key={tier.name} variants={fadeInUp}>
              <Card
                className={`relative p-8 rounded-2xl h-full gap-5 transition-all ${
                  tier.highlighted
                    ? "border-indigo-500/50 shadow-lg ring-2 ring-indigo-500/20"
                    : "border-border/50"
                } ${tier.disabled ? "opacity-75" : ""}`}
              >
                {tier.badge && tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-none px-3 py-1">
                      {tier.badge}
                    </Badge>
                  </div>
                )}

                <div className="space-y-1">
                  <h3 className="font-semibold text-xl text-foreground">
                    {tier.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {tier.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tier.period}
                  </span>
                </div>

                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-foreground"
                    >
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2">
                  {tier.disabled ? (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full"
                      title="Coming soon"
                    >
                      {tier.cta}
                    </Button>
                  ) : (
                    <Button
                      onClick={onGetStarted}
                      className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-md shadow-indigo-500/20"
                    >
                      {tier.cta}
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="text-center text-xs text-muted-foreground mt-8"
        >
          All plans include unlimited habits. No credit card required to start.
        </motion.p>
      </div>
    </section>
  );
}
