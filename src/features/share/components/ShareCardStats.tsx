import { CheckCircle2, Smile, Sparkles, Target, Flame, Calendar } from "lucide-react";
import type { ShareCardData } from "@/features/share/hooks/useShareCardData";
import { ShareCardStatRow } from "./ShareCardStatRow";

/* ============================================================================
   ShareCardStats — the right column's stat dashboard.
   ----------------------------------------------------------------------------
   6 stat rows, each with value + label + icon.

   Rows:
     1. CHECK-INS     [CheckCircle, emerald]
     2. AVG MOOD      [Smile, violet]
     3. PERFECT DAYS  [Sparkles, amber]
     4. ACTIVE HABITS [Target, teal]
     5. BEST STREAK   [Flame, orange]
     6. DAYS TRACKED  [Calendar, slate-blue]
============================================================================ */

export function ShareCardStats({
  data,
  layout,
}: {
  data: ShareCardData;
  layout: "portrait" | "landscape";
}) {
  const avgMoodStr = data.hasMood ? `${data.avgMood.toFixed(1)}` : "—";

  const rows = [
    { value: data.checkins.toLocaleString(), label: "Check-ins", icon: CheckCircle2, iconColor: "#10b981" },
    { value: avgMoodStr, label: "Avg Mood", icon: Smile, iconColor: "#8b5cf6" },
    { value: String(data.perfectDays), label: "Perfect Days", icon: Sparkles, iconColor: "#f59e0b" },
    { value: String(data.activeHabits), label: "Active Habits", icon: Target, iconColor: "#14b8a6" },
    { value: `${data.bestStreak}d`, label: "Best Streak", icon: Flame, iconColor: "#fb923c" },
    { value: String(data.daysTracked), label: "Days Tracked", icon: Calendar, iconColor: "#6366f1" },
  ];

  return (
    <div>
      {rows.map((row, i) => (
        <ShareCardStatRow
          key={i}
          value={row.value}
          label={row.label}
          icon={row.icon}
          iconColor={row.iconColor}
          isLast={i === rows.length - 1}
          layout={layout}
        />
      ))}
    </div>
  );
}
