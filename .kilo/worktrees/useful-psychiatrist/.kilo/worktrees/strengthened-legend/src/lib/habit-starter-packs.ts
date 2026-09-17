// Curated starter packs: bundles of 5 daily habits each, organized by life theme.
// Each pack reuses the HabitTemplate shape so we can install them via the same
// templateToInput() helper used by the single-habit Quick Start picker.
import type { HabitTemplate } from "./habit-templates";

export interface StarterPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  habits: HabitTemplate[];
}

// Helper to keep the pack definitions compact. Most pack habits are simple
// daily habits; we provide sensible defaults for the optional HabitTemplate
// fields so each entry only needs the meaningful bits.
function h(
  partial: Pick<HabitTemplate, "id" | "name" | "description" | "icon" | "color"> &
    Partial<HabitTemplate>,
): HabitTemplate {
  return {
    frequency: "daily",
    customDays: [],
    targetCount: 1,
    category: "Health",
    ...partial,
  };
}

export const STARTER_PACKS: StarterPack[] = [
  {
    id: "morning-routine",
    name: "Morning Routine",
    description: "Start your day with intention and energy.",
    icon: "🌅",
    color: "#f59e0b",
    category: "Lifestyle",
    habits: [
      h({ id: "mr-hydrate", name: "Drink a glass of water", description: "Rehydrate first thing in the morning", icon: "💧", color: "#0ea5e9", category: "Health", targetCount: 1 }),
      h({ id: "mr-stretch", name: "Morning stretch", description: "5 minutes to wake up your body", icon: "🤸", color: "#14b8a6", category: "Health", targetCount: 1 }),
      h({ id: "mr-plan", name: "Plan your day", description: "Set your top 3 priorities", icon: "🎯", color: "#10b981", category: "Productivity", targetCount: 1 }),
      h({ id: "mr-journal", name: "Morning journal", description: "Write down your intentions", icon: "✍️", color: "#ec4899", category: "Learning", targetCount: 1 }),
      h({ id: "mr-no-phone", name: "Phone-free first hour", description: "No screens until after breakfast", icon: "📵", color: "#ef4444", category: "Mindfulness", targetCount: 1 }),
    ],
  },
  {
    id: "fitness",
    name: "Fitness",
    description: "Build a consistent movement practice.",
    icon: "💪",
    color: "#ef4444",
    category: "Health",
    habits: [
      h({ id: "ft-walk", name: "Take a walk", description: "10,000 steps a day", icon: "🚶", color: "#84cc16", category: "Health", targetCount: 1 }),
      h({ id: "ft-exercise", name: "Exercise", description: "30 minutes of activity", icon: "🏃", color: "#f59e0b", category: "Health", targetCount: 1 }),
      h({ id: "ft-stretch", name: "Stretch", description: "5 minutes of mobility work", icon: "🤸", color: "#14b8a6", category: "Health", targetCount: 1 }),
      h({ id: "ft-water", name: "Drink water", description: "8 glasses throughout the day", icon: "💧", color: "#0ea5e9", category: "Health", targetCount: 8 }),
      h({ id: "ft-sleep-early", name: "Sleep before 11pm", description: "Recover properly for tomorrow", icon: "😴", color: "#6366f1", category: "Health", targetCount: 1 }),
    ],
  },
  {
    id: "study-learn",
    name: "Study & Learn",
    description: "Make learning a daily habit.",
    icon: "📚",
    color: "#8b5cf6",
    category: "Learning",
    habits: [
      h({ id: "sl-read", name: "Read a book", description: "At least 20 pages", icon: "📚", color: "#8b5cf6", category: "Learning", targetCount: 1 }),
      h({ id: "sl-language", name: "Practice language", description: "15 minutes a day", icon: "🌍", color: "#0ea5e9", category: "Learning", targetCount: 1 }),
      h({ id: "sl-code", name: "Practice coding", description: "Build or learn something new", icon: "💻", color: "#0d9488", category: "Learning", targetCount: 1, frequency: "custom", customDays: [0, 1, 2, 3, 4] }),
      h({ id: "sl-vocab", name: "Learn 5 new words", description: "Expand your vocabulary", icon: "📖", color: "#6366f1", category: "Learning", targetCount: 5 }),
      h({ id: "sl-skill", name: "Practice a skill", description: "20 minutes of deliberate practice", icon: "🧠", color: "#14b8a6", category: "Learning", targetCount: 1 }),
    ],
  },
  {
    id: "mindfulness",
    name: "Mindfulness",
    description: "Slow down and be present.",
    icon: "🧘",
    color: "#10b981",
    category: "Mindfulness",
    habits: [
      h({ id: "mf-meditate", name: "Meditate", description: "10 minutes of mindfulness", icon: "🧘", color: "#10b981", category: "Mindfulness", targetCount: 1 }),
      h({ id: "mf-gratitude", name: "Practice gratitude", description: "Write 3 things you're grateful for", icon: "🙏", color: "#f59e0b", category: "Mindfulness", targetCount: 1 }),
      h({ id: "mf-breathe", name: "Deep breathing", description: "2 minutes of box breathing", icon: "🌬️", color: "#0ea5e9", category: "Mindfulness", targetCount: 1 }),
      h({ id: "mf-outdoors", name: "Time outdoors", description: "20 minutes outside", icon: "🌳", color: "#84cc16", category: "Mindfulness", targetCount: 1 }),
      h({ id: "mf-no-phone", name: "Phone-free hour", description: "1 hour without screens", icon: "📵", color: "#ef4444", category: "Mindfulness", targetCount: 1 }),
    ],
  },
  {
    id: "deep-work",
    name: "Deep Work",
    description: "Protect your focus and ship meaningful work.",
    icon: "🎯",
    color: "#10b981",
    category: "Productivity",
    habits: [
      h({ id: "dw-plan", name: "Plan your day", description: "Set top 3 priorities", icon: "🎯", color: "#10b981", category: "Productivity", targetCount: 1 }),
      h({ id: "dw-deep", name: "Deep work session", description: "90 minutes of focused work", icon: "⚡", color: "#f59e0b", category: "Productivity", targetCount: 1 }),
      h({ id: "dw-pomodoro", name: "4 pomodoro sessions", description: "25 min focus + 5 min break", icon: "🍅", color: "#ef4444", category: "Productivity", targetCount: 4 }),
      h({ id: "dw-inbox", name: "Inbox zero", description: "Clear your email inbox", icon: "📧", color: "#6366f1", category: "Productivity", targetCount: 1, frequency: "custom", customDays: [0, 1, 2, 3, 4] }),
      h({ id: "dw-tidy", name: "Tidy workspace", description: "5 minutes at end of day", icon: "🧹", color: "#14b8a6", category: "Productivity", targetCount: 1 }),
    ],
  },
  {
    id: "sleep-better",
    name: "Sleep Better",
    description: "Wind down and rest deeply.",
    icon: "😴",
    color: "#6366f1",
    category: "Health",
    habits: [
      h({ id: "sb-sleep-early", name: "Sleep before 11pm", description: "Get enough rest", icon: "😴", color: "#6366f1", category: "Health", targetCount: 1 }),
      h({ id: "sb-no-screens", name: "No screens after 10pm", description: "Help your brain wind down", icon: "📵", color: "#ef4444", category: "Mindfulness", targetCount: 1 }),
      h({ id: "sb-read", name: "Read before bed", description: "10 pages of a book", icon: "📚", color: "#8b5cf6", category: "Learning", targetCount: 1 }),
      h({ id: "sb-journal", name: "Evening journal", description: "Reflect on the day", icon: "✍️", color: "#ec4899", category: "Learning", targetCount: 1 }),
      h({ id: "sb-gratitude", name: "Practice gratitude", description: "3 things you're grateful for", icon: "🙏", color: "#f59e0b", category: "Mindfulness", targetCount: 1 }),
    ],
  },
  {
    id: "digital-detox",
    name: "Digital Detox",
    description: "Break free from screen dependency.",
    icon: "📵",
    color: "#ef4444",
    category: "Mindfulness",
    habits: [
      h({ id: "dd-no-phone-morning", name: "Phone-free first hour", description: "Start your day screen-free", icon: "📵", color: "#ef4444", category: "Mindfulness", targetCount: 1 }),
      h({ id: "dd-no-screens-bed", name: "No screens after 10pm", description: "Wind down properly", icon: "📵", color: "#ef4444", category: "Mindfulness", targetCount: 1 }),
      h({ id: "dd-outdoors", name: "Time outdoors", description: "20 minutes outside, no phone", icon: "🌳", color: "#84cc16", category: "Mindfulness", targetCount: 1 }),
      h({ id: "dd-read", name: "Read a book", description: "Replace scrolling with reading", icon: "📚", color: "#8b5cf6", category: "Learning", targetCount: 1 }),
      h({ id: "dd-meditate", name: "Meditate", description: "10 minutes of mindfulness", icon: "🧘", color: "#10b981", category: "Mindfulness", targetCount: 1 }),
    ],
  },
  {
    id: "creative-practice",
    name: "Creative Practice",
    description: "Make space for creativity every day.",
    icon: "🎨",
    color: "#ec4899",
    category: "Creative",
    habits: [
      h({ id: "cp-create", name: "Creative work", description: "Draw, write, or make something", icon: "🎨", color: "#ec4899", category: "Creative", targetCount: 1 }),
      h({ id: "cp-music", name: "Practice instrument", description: "20 minutes of practice", icon: "🎸", color: "#8b5cf6", category: "Creative", targetCount: 1, frequency: "custom", customDays: [0, 1, 2, 3, 4] }),
      h({ id: "cp-journal", name: "Creative journal", description: "Free-write for 10 minutes", icon: "✍️", color: "#ec4899", category: "Creative", targetCount: 1 }),
      h({ id: "cp-read", name: "Read for inspiration", description: "10 pages of fiction or art", icon: "📚", color: "#8b5cf6", category: "Learning", targetCount: 1 }),
      h({ id: "cp-walk", name: "Inspiration walk", description: "Walk without a destination", icon: "🚶", color: "#84cc16", category: "Mindfulness", targetCount: 1 }),
    ],
  },
  {
    id: "financial-wellness",
    name: "Financial Wellness",
    description: "Build healthy money habits.",
    icon: "💰",
    color: "#10b981",
    category: "Productivity",
    habits: [
      h({ id: "fw-track", name: "Track spending", description: "Log every purchase", icon: "💰", color: "#10b981", category: "Productivity", targetCount: 1 }),
      h({ id: "fw-no-sugar", name: "Skip impulse buys", description: "24-hour rule for non-essentials", icon: "🚫", color: "#ef4444", category: "Mindfulness", targetCount: 1 }),
      h({ id: "fw-cook", name: "Cook at home", description: "Skip the takeout", icon: "🍳", color: "#f59e0b", category: "Health", targetCount: 1 }),
      h({ id: "fw-plan", name: "Plan your day", description: "Set priorities incl. finances", icon: "🎯", color: "#10b981", category: "Productivity", targetCount: 1 }),
      h({ id: "fw-review", name: "Weekly review", description: "Reflect on spending and goals", icon: "📋", color: "#ec4899", category: "Productivity", targetCount: 1, frequency: "weekly", customDays: [] }),
    ],
  },
  {
    id: "healthy-eating",
    name: "Healthy Eating",
    description: "Fuel your body with intention.",
    icon: "🥗",
    color: "#84cc16",
    category: "Health",
    habits: [
      h({ id: "he-water", name: "Drink water", description: "8 glasses a day", icon: "💧", color: "#0ea5e9", category: "Health", targetCount: 8 }),
      h({ id: "he-cook", name: "Cook at home", description: "Prepare one meal from scratch", icon: "🍳", color: "#f59e0b", category: "Health", targetCount: 1 }),
      h({ id: "he-no-sugar", name: "No added sugar", description: "Skip sugary snacks", icon: "🚫", color: "#ef4444", category: "Health", targetCount: 1 }),
      h({ id: "he-skincare", name: "Skincare routine", description: "Take care of your skin", icon: "🧴", color: "#ec4899", category: "Health", targetCount: 1 }),
      h({ id: "he-floss", name: "Floss", description: "Once a day, before bed", icon: "🦷", color: "#0ea5e9", category: "Health", targetCount: 1 }),
    ],
  },
  {
    id: "social-connection",
    name: "Social Connection",
    description: "Nurture the relationships that matter.",
    icon: "🤝",
    color: "#0ea5e9",
    category: "Mindfulness",
    habits: [
      h({ id: "sc-call", name: "Call family", description: "Check in with a loved one", icon: "📞", color: "#0ea5e9", category: "Mindfulness", targetCount: 1, frequency: "custom", customDays: [0, 1, 2, 3, 4] }),
      h({ id: "sc-gratitude", name: "Tell someone you appreciate them", description: "Reach out with kind words", icon: "🙏", color: "#f59e0b", category: "Mindfulness", targetCount: 1 }),
      h({ id: "sc-walk", name: "Walk with a friend", description: "Catch up while moving", icon: "🚶", color: "#84cc16", category: "Mindfulness", targetCount: 1 }),
      h({ id: "sc-no-phone", name: "Phone-free meal", description: "Be present at the table", icon: "📵", color: "#ef4444", category: "Mindfulness", targetCount: 1 }),
      h({ id: "sc-journal", name: "Reflect on relationships", description: "Journal about a person you value", icon: "✍️", color: "#ec4899", category: "Learning", targetCount: 1 }),
    ],
  },
  {
    id: "evening-wind-down",
    name: "Evening Wind-Down",
    description: "Close out your day with calm.",
    icon: "🌙",
    color: "#6366f1",
    category: "Lifestyle",
    habits: [
      h({ id: "ew-plan", name: "Plan tomorrow", description: "Set 3 priorities for the next day", icon: "🎯", color: "#10b981", category: "Productivity", targetCount: 1 }),
      h({ id: "ew-journal", name: "Evening journal", description: "Reflect on the day's wins", icon: "✍️", color: "#ec4899", category: "Learning", targetCount: 1 }),
      h({ id: "ew-gratitude", name: "Practice gratitude", description: "3 things you're grateful for", icon: "🙏", color: "#f59e0b", category: "Mindfulness", targetCount: 1 }),
      h({ id: "ew-no-screens", name: "No screens after 10pm", description: "Help your brain wind down", icon: "📵", color: "#ef4444", category: "Mindfulness", targetCount: 1 }),
      h({ id: "ew-read", name: "Read before bed", description: "10 pages of a book", icon: "📚", color: "#8b5cf6", category: "Learning", targetCount: 1 }),
    ],
  },
];
