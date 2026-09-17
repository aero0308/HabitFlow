export interface ShowcaseScreen {
  id: string;
  title: string;
  caption: string;
  image: string;
}

export const showcaseScreens: ShowcaseScreen[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    caption: "Your daily overview — habits, streaks, and progress at a glance.",
    image: "/screenshots/dashboard.webp?v=1",
  },
  {
    id: "habits",
    title: "Habits",
    caption: "Create, track, and manage your habits with custom schedules and targets.",
    image: "/screenshots/habits.webp?v=1",
  },
  {
    id: "mood",
    title: "Mood",
    caption: "Log how you feel, discover patterns, and correlate mood with habits.",
    image: "/screenshots/mood.webp?v=1",
  },
  {
    id: "analytics",
    title: "Analytics",
    caption: "Deep insights into your consistency with weekly charts and completion rates.",
    image: "/screenshots/analytics.webp?v=1",
  },
  {
    id: "insights",
    title: "Insights",
    caption: "AI-powered patterns and recommendations based on your data.",
    image: "/screenshots/insights.webp?v=1",
  },
  {
    id: "achievements",
    title: "Achievements",
    caption: "Earn badges and milestones as you build consistency.",
    image: "/screenshots/achievements.webp?v=1",
  },
];
