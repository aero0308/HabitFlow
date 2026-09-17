"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, Tooltip,
} from "recharts";
import { fadeInUp, staggerContainer } from "../animations";

interface HeroProps {
  onGetStarted: () => void;
  onViewDemo: () => void;
}

const chartData = [
  { day: "Mon", value: 80 },
  { day: "Tue", value: 60 },
  { day: "Wed", value: 100 },
  { day: "Thu", value: 75 },
  { day: "Fri", value: 100 },
  { day: "Sat", value: 90 },
  { day: "Sun", value: 85 },
];

const mockHabits = [
  { icon: "💧", name: "Drink water", count: "8/8", color: "#0ea5e9", done: true },
  { icon: "📚", name: "Read a book", count: "1/1", color: "#8b5cf6", done: true },
  { icon: "🧘", name: "Meditate", count: "0/1", color: "#10b981", done: false },
];

function DashboardMockup() {
  return (
    <Card className="p-5 shadow-2xl border-border/60 bg-card">
      {/* Browser dots */}
      <div className="flex items-center gap-1.5 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        <div className="ml-3 text-[10px] text-muted-foreground font-medium">habitflow.app/dashboard</div>
      </div>

      {/* Greeting */}
      <div className="mb-4">
        <div className="text-base font-bold text-foreground">Good morning, Alex</div>
        <div className="text-xs text-muted-foreground">You're on a 12-day streak. Keep it up! 🔥</div>
      </div>

      {/* Progress ring + chart */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
              <circle
                cx="40" cy="40" r="34" fill="none" stroke="#10b981" strokeWidth="6"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - 0.86)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-foreground">86%</span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">today</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/30">
          <div className="text-[10px] font-medium text-muted-foreground mb-2">This week</div>
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#heroGrad)" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "currentColor" }} axisLine={false} tickLine={false} className="text-muted-foreground" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Habit rows */}
      <div className="space-y-2">
        {mockHabits.map((h) => (
          <div
            key={h.name}
            className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-card"
            style={h.done ? { borderColor: h.color + "50", backgroundColor: h.color + "08" } : {}}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
              style={{ backgroundColor: h.color + "20" }}
            >
              {h.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{h.name}</div>
              <div className="text-[10px] text-muted-foreground">{h.count}</div>
            </div>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: h.done ? h.color : "transparent", border: h.done ? "none" : `1.5px solid var(--muted-foreground)` }}
            >
              {h.done ? "✓" : ""}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Hero({ onGetStarted, onViewDemo }: HeroProps) {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Background blobs */}
      <motion.div
        className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-400/20 dark:bg-indigo-600/10 blur-3xl pointer-events-none"
        variants={{ animate: { x: [0, 40, -20, 0], y: [0, -30, 20, 0], transition: { duration: 20, repeat: Infinity, ease: "easeInOut" } } }}
        animate="animate"
      />
      <motion.div
        className="absolute top-20 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-400/20 dark:bg-violet-600/10 blur-3xl pointer-events-none"
        variants={{ animate: { x: [0, -30, 25, 0], y: [0, 25, -20, 0], transition: { duration: 25, repeat: Infinity, ease: "easeInOut" } } }}
        animate="animate"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: copy */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-left"
          >
            <motion.div variants={fadeInUp} className="flex justify-center lg:justify-start mb-5">
              <Badge
                variant="outline"
                className="gap-1.5 py-1.5 px-3 border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-300"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Now with weekly email digests</span>
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
            >
              <span className="text-foreground">Build better habits,</span>
              <br />
              <span
                className="flowing-text"
                data-text="one day at a time"
              >
                one day at a time
              </span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0"
            >
              Track daily habits, visualize streaks, and stay consistent with data-driven
              insights. Free forever.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6"
            >
              <Button
                size="lg"
                onClick={onGetStarted}
                className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 group"
              >
                Start Tracking Free
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onViewDemo}
                className="group"
              >
                <Play className="w-4 h-4 mr-1 fill-current" />
                View Live Demo
              </Button>
            </motion.div>

            <motion.p
              variants={fadeInUp}
              className="text-sm text-muted-foreground"
            >
              No credit card required · Free forever · 2-min setup
            </motion.p>

            <motion.div variants={fadeInUp} className="flex items-center gap-2 mt-3 justify-center lg:justify-start">
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-2.5 border-violet-500/30 bg-violet-500/5 text-violet-600 dark:text-violet-300"
              >
                <span className="text-sm">🧠</span>
                <span className="text-xs font-medium">Now with mood tracking & habit correlation</span>
              </Badge>
            </motion.div>
          </motion.div>

          {/* Right: dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
            style={{ perspective: 1000 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-violet-600/10 rounded-3xl blur-2xl" />
            <div className="relative transform lg:rotate-1 lg:hover:rotate-0 transition-transform duration-500">
              <DashboardMockup />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
