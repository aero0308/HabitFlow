export interface MoodEntry {
  id: string;
  date: string;
  score: number;
  note: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MoodInsights {
  hasData: boolean;
  averageScore: number;
  averageScoreByHabitsCompleted: Record<string, number>;
  bestDay: { date: string; score: number } | null;
  worstDay: { date: string; score: number } | null;
  moodTrend: "improving" | "declining" | "stable";
  habitImpact: {
    habitId: string;
    habitName: string;
    habitIcon: string;
    avgMoodWhenDone: number;
    avgMoodWhenSkipped: number;
    delta: number;
  }[];
  topTags: { tag: string; count: number; avgScore: number }[];
  totalEntries: number;
}

export const MOOD_EMOJIS = ["😢", "😞", "😕", "😐", "🙂", "😊", "😄", "😁", "🤩", "😍"];
export const MOOD_LABELS = ["Awful", "Bad", "Poor", "Meh", "Okay", "Good", "Great", "Amazing", "Fantastic", "Perfect"];
export const MOOD_TAGS = ["tired", "motivated", "stressed", "calm", "anxious", "focused", "happy", "sad", "energized", "lazy"];

export function moodColor(score: number): { text: string; bg: string; border: string } {
  if (score <= 3) return { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" };
  if (score <= 6) return { text: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
  return { text: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" };
}

export function moodLabel(score: number): string {
  if (score <= 0) return "";
  return MOOD_LABELS[Math.min(score - 1, 9)];
}
