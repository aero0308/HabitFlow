export interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaLink: string;
  highlighted: boolean;
  disabled: boolean;
  badge?: string;
  accent: "emerald" | "violet";
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to build better habits — free, forever.",
    features: [
      "Unlimited habits",
      "Streak tracking & analytics",
      "Calendar heatmap (yearly view)",
      "Mood tracking & habit correlations",
      "Pomodoro timer with built-in lofi music & custom uploads",
      "Custom habit schedules (daily/weekly/custom days)",
      "Time-of-day habits (Morning/Afternoon/Evening/Any)",
      "Off-Mode / vacation scheduling",
      "Achievement badges",
      "Habit templates & starter packs",
    ],
    cta: "Get Started Free",
    ctaLink: "register",
    highlighted: true,
    disabled: false,
    accent: "emerald",
  },
  {
    name: "Pro",
    price: "$5",
    period: "month",
    description: "Advanced features for power users and teams.",
    features: [
      "Everything in Free",
      "AI habit coach (weekly personalized insights)",
      "Weekly email digest",
      "Accountability partners (add friends, see streaks, send nudges)",
      "Cloud music library (unlimited uploads, synced across devices)",
      "Advanced analytics (year-over-year, best-day insights, PDF reports)",
      "Browser push notifications (per-habit reminders)",
      "Team habits & shared goals",
      "Priority email support",
    ],
    cta: "Join Waitlist",
    ctaLink: "#",
    highlighted: false,
    disabled: true,
    badge: "Coming Soon",
    accent: "violet",
  },
];
