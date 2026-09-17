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
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to build better habits.",
    features: [
      "Unlimited habits",
      "Streak tracking & analytics",
      "Calendar heatmap",
      "Weekly email digest",
      "Dark mode",
      "CSV export & import",
    ],
    cta: "Get Started",
    ctaLink: "register",
    highlighted: true,
    disabled: false,
    badge: "Most Popular",
  },
  {
    name: "Pro",
    price: "$5",
    period: "month (coming soon)",
    description: "Advanced features for power users and teams.",
    features: [
      "Everything in Free",
      "Team habits & shared goals",
      "Advanced exports (PDF)",
      "Priority support",
      "Custom reminders",
      "Habit sharing",
    ],
    cta: "Join Waitlist",
    ctaLink: "#",
    highlighted: false,
    disabled: true,
  },
];
