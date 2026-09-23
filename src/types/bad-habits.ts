// Bad-habit shared types matching the backend API responses.

export interface BadHabitNextMilestone {
  type: "days" | "money" | "time";
  value: number;
  label: string;
  daysRemaining: number;
  progressPct: number;
}

export interface BadHabitMoneySaved {
  amount: number;
  formatted: string;
}

export interface BadHabitTimeSaved {
  hours: number;
  formatted: string;
}

export interface BadHabit {
  id: string;
  name: string;
  icon: string;
  color: string;
  quitDate: string; // YYYY-MM-DD
  reason: string;
  triggers: string[];
  costPerDay: number | null;
  currency: string;
  minutesPerDay: number | null;
  replacementHabitId: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  cleanStreak: number;
  longestStreak: number;
  moneySaved: BadHabitMoneySaved | null;
  timeSaved: BadHabitTimeSaved | null;
  nextMilestone: BadHabitNextMilestone;
}

export interface BadHabitMilestone {
  id: string;
  badHabitId: string;
  type: "days" | "money" | "time";
  value: number;
  label: string;
  unlockedAt: string;
}

export interface BadHabitSlip {
  id: string;
  date: string;
  trigger: string | null;
  note: string | null;
}

export interface BadHabitTriggerFrequency {
  trigger: string;
  count: number;
  pct: number;
}

export interface BadHabitDayOfWeekPattern {
  day: string;
  count: number;
}

export interface BadHabitMoodCorrelation {
  cleanAvg: number | null;
  slipAvg: number | null;
  delta: number | null;
  summary: string;
}

export interface BadHabitInsights {
  triggerFrequency: BadHabitTriggerFrequency[];
  dayOfWeekPattern: BadHabitDayOfWeekPattern[];
  cleanDaysPct: {
    cleanDays: number;
    totalDays: number;
    slipDays: number;
    pct: number;
  };
  moodCorrelation: BadHabitMoodCorrelation | null;
}

export interface BadHabitDetailResponse {
  badHabit: BadHabit;
  insights: BadHabitInsights;
  slips: BadHabitSlip[];
  milestones: BadHabitMilestone[];
}

export interface BadHabitCreateInput {
  name: string;
  icon: string;
  color: string;
  quitDate: string;
  reason?: string;
  triggers: string[];
  costPerDay?: number;
  currency?: string;
  minutesPerDay?: number;
  replacementHabitId?: string | null;
}

export type BadHabitUpdateInput = Partial<BadHabitCreateInput>;

export interface BadHabitSlipInput {
  date: string;
  trigger?: string | null;
  note?: string | null;
}
