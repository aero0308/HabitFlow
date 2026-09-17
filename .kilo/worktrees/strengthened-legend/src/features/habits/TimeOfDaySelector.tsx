"use client";

import type { TimeOfDay } from "@/types";
import { cn } from "@/lib/utils";

interface TimeOfDayOption {
  value: TimeOfDay;
  label: string;
  emoji: string;
}

const OPTIONS: TimeOfDayOption[] = [
  { value: "ANY_TIME", label: "Any Time", emoji: "🌤️" },
  { value: "MORNING", label: "Morning", emoji: "🌅" },
  { value: "AFTERNOON", label: "Afternoon", emoji: "☀️" },
  { value: "EVENING", label: "Evening", emoji: "🌙" },
];

export interface TimeOfDaySelectorProps {
  value: TimeOfDay;
  onChange: (v: TimeOfDay) => void;
}

export function TimeOfDaySelector({ value, onChange }: TimeOfDaySelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Time of day"
      className="grid grid-cols-2 gap-2 sm:flex sm:h-9 sm:gap-1"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors sm:h-9 sm:flex-1",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30",
              active
                ? "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span className="text-sm leading-none" aria-hidden>
              {opt.emoji}
            </span>
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
