import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListChecks,
  Smile,
  BarChart3,
  Lightbulb,
  Trophy,
} from "lucide-react";

export interface ShowcaseScreen {
  id: string;
  title: string;
  caption: string;
  image: string;
  /** Lucide icon rendered inside the pill tab. */
  icon: LucideIcon;
  /** Natural pixel width of the screenshot — used by next/image to reserve
   * space and avoid layout shift. */
  width: number;
  /** Natural pixel height of the screenshot. */
  height: number;
}

/**
 * The 6 screens showcased in the Product Tour section.
 *
 * Captions are short single-line descriptions shown below the device frame
 * (matches the Fora-style layout — a single line of text that changes per
 * active tab).
 *
 * Images point at the PNG screenshots in /public/screenshots/ — these are
 * the actual app screenshots (no mockups). If you regenerate the
 * screenshots, change the filename (e.g. dashboard-v2.png) to bust the
 * browser cache — next/image doesn't allow query strings on local images
 * unless `images.localPatterns` is configured in next.config.
 */
export const showcaseScreens: ShowcaseScreen[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    caption: "Your day at a glance — habits, streaks, and mood in one view.",
    image: "/screenshots/dashboard-v2.png",
    icon: LayoutDashboard,
    width: 1910,
    height: 1200,
  },
  {
    id: "habits",
    title: "Habits",
    caption: "Every habit, its schedule, and its streak in one list.",
    image: "/screenshots/habits.png",
    icon: ListChecks,
    width: 1910,
    height: 1196,
  },
  {
    id: "mood",
    title: "Mood",
    caption: "Track how you feel and see what moves the needle.",
    image: "/screenshots/mood.png",
    icon: Smile,
    width: 1910,
    height: 1232,
  },
  {
    id: "analytics",
    title: "Analytics",
    caption: "Trends and patterns across the last 365 days.",
    image: "/screenshots/analytics.png",
    icon: BarChart3,
    width: 1910,
    height: 1281,
  },
  {
    id: "insights",
    title: "Insights",
    caption: "Personalized patterns and recommendations from your data.",
    image: "/screenshots/insights.png",
    icon: Lightbulb,
    width: 1910,
    height: 1098,
  },
  {
    id: "achievements",
    title: "Achievements",
    caption: "Celebrate the milestones as your streaks grow.",
    image: "/screenshots/achievements.png",
    icon: Trophy,
    width: 1910,
    height: 1475,
  },
];
