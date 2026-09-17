"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  Tooltip,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  fadeInUp,
  staggerContainer,
  viewportOnce,
} from "../animations";

type TabValue = "dashboard" | "calendar" | "analytics";

const DASHBOARD_HABITS = [
  {
    icon: "💧",
    name: "Drink water",
    progress: 100,
    count: "8/8",
    color: "#0ea5e9",
    done: true,
  },
  {
    icon: "📚",
    name: "Read a book",
    progress: 60,
    count: "30/50 pages",
    color: "#8b5cf6",
    done: false,
  },
  {
    icon: "🧘",
    name: "Meditate",
    progress: 0,
    count: "0/1",
    color: "#10b981",
    done: false,
  },
];

const ANALYTICS_DATA = [
  { day: "Mon", value: 80 },
  { day: "Tue", value: 60 },
  { day: "Wed", value: 100 },
  { day: "Thu", value: 75 },
  { day: "Fri", value: 100 },
  { day: "Sat", value: 90 },
  { day: "Sun", value: 85 },
];

// Deterministic GitHub-style heatmap intensities (0..4).
// 0 = empty, 4 = most intense.
const HEATMAP_INTENSITIES: number[][] = [
  [0, 1, 2, 3, 4, 3, 2],
  [1, 2, 3, 4, 4, 2, 1],
  [0, 1, 3, 4, 2, 1, 0],
  [2, 3, 4, 4, 3, 2, 1],
  [1, 2, 3, 3, 4, 4, 2],
];

const HEATMAP_COLORS = [
  "bg-muted",
  "bg-emerald-200 dark:bg-emerald-900/40",
  "bg-emerald-400 dark:bg-emerald-700/60",
  "bg-emerald-500 dark:bg-emerald-600/80",
  "bg-emerald-600 dark:bg-emerald-500",
];

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-0 rounded-2xl overflow-hidden border-border/60 shadow-2xl gap-0">
      {/* Browser bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
        <div className="w-3 h-3 rounded-full bg-red-400/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
        <div className="w-3 h-3 rounded-full bg-green-400/80" />
        <div className="ml-3 text-[11px] text-muted-foreground font-medium truncate">
          habitflow.app
        </div>
      </div>
      {/* Content */}
      <div className="p-5 sm:p-6 bg-card">{children}</div>
    </Card>
  );
}

function DashboardTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-foreground">Good morning, Alex</div>
          <div className="text-[11px] text-muted-foreground">
            You&apos;re on a 12-day streak. Keep it up! 🔥
          </div>
        </div>
        {/* Progress ring */}
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              className="text-muted/30"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#10b981"
              strokeWidth="5"
              strokeDasharray={2 * Math.PI * 28}
              strokeDashoffset={2 * Math.PI * 28 * (1 - 0.86)}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-foreground">86%</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {DASHBOARD_HABITS.map((habit) => (
          <div
            key={habit.name}
            className="flex items-center gap-3 p-3 rounded-xl border bg-background"
            style={
              habit.done
                ? {
                    borderColor: habit.color + "50",
                    backgroundColor: habit.color + "08",
                  }
                : undefined
            }
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: habit.color + "20" }}
            >
              {habit.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground truncate">
                  {habit.name}
                </span>
                <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
                  {habit.count}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${habit.progress}%`,
                    backgroundColor: habit.color,
                  }}
                />
              </div>
            </div>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: habit.done ? habit.color : "transparent",
                border: habit.done
                  ? "none"
                  : "1.5px solid var(--muted-foreground)",
              }}
            >
              {habit.done && <Check className="w-3 h-3 text-white" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarTab() {
  return (
    <div className="space-y-3" style={{ minHeight: 280, maxHeight: 280 }}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-foreground">Last 5 weeks</div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Less</span>
          {HEATMAP_COLORS.map((c, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-sm ${c}`}
              aria-hidden
            />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="grid grid-rows-5 gap-1.5">
        {HEATMAP_INTENSITIES.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-1.5">
            {week.map((intensity, dayIdx) => (
              <div
                key={dayIdx}
                className={`h-7 rounded-sm ${HEATMAP_COLORS[intensity]}`}
                title={`Week ${weekIdx + 1}, Day ${dayIdx + 1}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-muted-foreground text-center mt-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-foreground">This week</div>
          <div className="text-[11px] text-muted-foreground">
            84% completion rate
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            +12%
          </div>
          <div className="text-[10px] text-muted-foreground">vs last week</div>
        </div>
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={ANALYTICS_DATA}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "currentColor" }}
              axisLine={false}
              tickLine={false}
              className="text-muted-foreground"
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {ANALYTICS_DATA.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.value >= 100 ? "#10b981" : "#34d399"}
                  fillOpacity={entry.value >= 100 ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LivePreview() {
  const [tab, setTab] = useState<TabValue>("dashboard");

  return (
    <section className="py-20 md:py-28 overflow-hidden">
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
            See it in action
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            A peek at what&apos;s inside.
          </motion.p>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="relative max-w-3xl mx-auto"
        >
          {/* Glow */}
          <div
            className="absolute -inset-x-8 -inset-y-4 bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-emerald-500/10 blur-3xl rounded-3xl pointer-events-none"
            aria-hidden
          />

          <div className="relative">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as TabValue)}
              className="w-full"
            >
              <div className="flex justify-center mb-6">
                <TabsList>
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger value="calendar">Calendar</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="dashboard" className="mt-0">
                <BrowserFrame>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="dashboard"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <DashboardTab />
                    </motion.div>
                  </AnimatePresence>
                </BrowserFrame>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <BrowserFrame>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="calendar"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CalendarTab />
                    </motion.div>
                  </AnimatePresence>
                </BrowserFrame>
              </TabsContent>

              <TabsContent value="analytics" className="mt-0">
                <BrowserFrame>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="analytics"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <AnalyticsTab />
                    </motion.div>
                  </AnimatePresence>
                </BrowserFrame>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
