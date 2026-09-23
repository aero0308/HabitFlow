"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fadeInUp,
  staggerContainer,
  viewportOnce,
} from "../animations";

interface FinalCTAProps {
  onGetStarted: () => void;
}

export function FinalCTA({ onGetStarted }: FinalCTAProps) {
  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-r from-indigo-500 to-violet-600">
      {/* Decorative radial dots pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      {/* Blurred decorative circles */}
      <motion.div
        className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none"
        animate={{
          x: [0, 30, -10, 0],
          y: [0, -20, 15, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-violet-300/20 blur-3xl pointer-events-none"
        animate={{
          x: [0, -25, 15, 0],
          y: [0, 20, -15, 0],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <motion.h2
            variants={fadeInUp}
            className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight"
          >
            Start building better habits today
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg text-white/80 mb-8 leading-relaxed"
          >
            Join thousands of people tracking their progress.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex justify-center mb-4">
            <Button
              size="lg"
              onClick={onGetStarted}
              className="bg-white text-indigo-600 hover:bg-white/90 shadow-xl shadow-indigo-900/20 group h-12 px-8 text-base font-semibold"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </motion.div>

          <motion.p
            variants={fadeInUp}
            className="text-sm text-white/60"
          >
            Free forever · No credit card
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
