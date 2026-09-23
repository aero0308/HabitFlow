import {
  Flame, Calendar, BarChart3, Target, Mail, Timer,
  Music, Bell,
} from "lucide-react";

export interface Feature {
  icon: typeof Flame;
  emoji: string;
  title: string;
  description: string;
  soon?: boolean;
}

export const features: Feature[] = [
  {
    icon: Flame,
    emoji: "🔥",
    title: "Streak Tracking",
    description:
      "Smart streak calculation that respects your schedule, even for custom days like Mon/Wed/Fri.",
  },
  {
    icon: Calendar,
    emoji: "📅",
    title: "Calendar Heatmap",
    description:
      "Visualize your progress GitHub-style and spot patterns at a glance.",
  },
  {
    icon: BarChart3,
    emoji: "📊",
    title: "Analytics",
    description:
      "Weekly charts, completion rates, and best-day insights to understand your behavior.",
  },
  {
    icon: Timer,
    emoji: "⏱️",
    title: "Focus Timer",
    description:
      "Built-in Pomodoro timer with session tracking, break cycles, and ambient sound cues to keep you in the zone.",
  },
  {
    icon: Music,
    emoji: "🎵",
    title: "Focus BGM",
    description:
      "Built-in lofi background music that loops during your focus sessions — pick a track, hit start, stay in flow.",
  },
  {
    icon: Bell,
    emoji: "🔔",
    title: "Browser Notifications",
    description:
      "Daily in-browser reminders at your chosen time when habits are due — never miss a check-in again.",
  },
  {
    icon: Target,
    emoji: "🎯",
    title: "Custom Targets",
    description:
      "Track habits like '8 glasses of water' with daily target counts.",
  },
  {
    icon: Mail,
    emoji: "📧",
    title: "Weekly Email Reminders",
    description:
      "Automated weekly email summaries with your progress, streaks, and insights — delivered every Monday.",
    soon: true,
  },
];
