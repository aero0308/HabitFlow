"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { HABIT_ICONS, ICON_NAMES } from "@/lib/ai/habitIcons";
import type { HabitSuggestion } from "@/lib/ai/generateSuggestions";

const COLORS = [
  "#10b981", "#0ea5e9", "#8b5cf6", "#ec4899", "#f59e0b",
  "#ef4444", "#14b8a6", "#6366f1", "#f97316", "#84cc16",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface SuggestionCardProps {
  suggestion: HabitSuggestion;
  index: number;
  selected: boolean;
  onToggleSelected: () => void;
  onPatch: (patch: Partial<HabitSuggestion>) => void;
}

/**
 * SuggestionCard — a single AI-suggested habit with checkbox + inline edit.
 *
 * Default render:
 *   [checkbox] [icon-box]  Name                       [pencil]
 *                       Daily · Morning · 8/day
 *                       "Reason for this habit..."
 *
 * Edit mode: replaces the name/reason area with input + selects + icon picker.
 *
 * Animation: fade + slide-up on mount (staggered by index via delay).
 * Respects prefers-reduced-motion (opacity-only).
 */
export function SuggestionCard({
  suggestion,
  index,
  selected,
  onToggleSelected,
  onPatch,
}: SuggestionCardProps) {
  const prefersReduced = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HabitSuggestion>(suggestion);

  // Re-sync the draft when the suggestion prop changes (e.g. after regenerate)
  useEffect(() => {
    setDraft(suggestion);
  }, [suggestion]);

  const freqLabel = useMemo(() => {
    if (draft.frequency === "custom" && draft.days && draft.days.length > 0) {
      return draft.days
        .slice()
        .sort((a, b) => a - b)
        .map((d) => DAY_LABELS[d] ?? `Day ${d}`)
        .join(", ");
    }
    return draft.frequency === "daily" ? "Every day" : "Custom";
  }, [draft.frequency, draft.days]);

  const todLabel = useMemo(() => {
    switch (draft.timeOfDay) {
      case "MORNING":
        return "🌅 Morning";
      case "AFTERNOON":
        return "☀️ Afternoon";
      case "EVENING":
        return "🌙 Evening";
      default:
        return "Any time";
    }
  }, [draft.timeOfDay]);

  const targetLabel = draft.targetCount > 1
    ? `${draft.targetCount}${draft.unit ? ` ${draft.unit}` : "/day"}`
    : null;

  function toggleCustomDay(day: number) {
    const cur = draft.days ?? [];
    const next = cur.includes(day)
      ? cur.filter((d) => d !== day)
      : [...cur, day].sort((a, b) => a - b);
    setDraft({ ...draft, days: next });
  }

  function saveEdit() {
    // Auto-repair: if frequency === "custom" but days is empty, switch to daily
    let toSave = { ...draft };
    if (toSave.frequency === "custom" && (!toSave.days || toSave.days.length === 0)) {
      toSave = { ...toSave, frequency: "daily", days: null };
    } else if (toSave.frequency === "daily") {
      toSave = { ...toSave, days: null };
    }
    setDraft(toSave);
    onPatch(toSave);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(suggestion);
    setEditing(false);
  }

  const fadeUp = prefersReduced
    ? {
        initial: { opacity: 0 } as const,
        animate: { opacity: 1 } as const,
        transition: { duration: 0.25 } as const,
      }
    : {
        initial: { opacity: 0, y: 8 } as const,
        animate: { opacity: 1, y: 0 } as const,
        transition: { duration: 0.25, delay: 0.12 * index } as const,
      };

  return (
    <motion.div
      {...fadeUp}
      className={cn(
        "rounded-xl border bg-card p-3 sm:p-4 transition-colors",
        selected ? "border-violet-500/40 ring-1 ring-violet-500/20" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox (left, top-aligned) */}
        <div className="pt-0.5">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => {
              if (v !== "indeterminate") onToggleSelected();
            }}
            aria-label={`Select ${suggestion.name}`}
            className="data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
          />
        </div>

        {/* Icon box */}
        <div
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: (draft.color || "#10b981") + "20" }}
          aria-hidden
        >
          {HABIT_ICONS[draft.icon] ?? draft.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {editing ? (
            <EditView
              draft={draft}
              setDraft={setDraft}
              toggleCustomDay={toggleCustomDay}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm sm:text-base leading-snug">
                  {draft.name}
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -mr-1 -mt-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setEditing(true)}
                  aria-label="Edit suggestion"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                  {freqLabel}
                </Badge>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                  {todLabel}
                </Badge>
                {targetLabel && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                    {targetLabel}
                  </Badge>
                )}
              </div>
              {draft.reason && (
                <p className="text-xs text-muted-foreground italic leading-relaxed pt-0.5">
                  {draft.reason}
                </p>
              )}
            </>
          )}
        </div>

        {/* Edit actions (right column when editing) */}
        {editing && (
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10"
              onClick={saveEdit}
              aria-label="Save edits"
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:bg-muted"
              onClick={cancelEdit}
              aria-label="Cancel edits"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ============================================================================
   Edit view — name input + icon picker + frequency select + timeOfDay select +
   target input. Rendered in place when `editing === true`.
============================================================================ */

interface EditViewProps {
  draft: HabitSuggestion;
  setDraft: (next: HabitSuggestion) => void;
  toggleCustomDay: (day: number) => void;
}

function EditView({ draft, setDraft, toggleCustomDay }: EditViewProps) {
  const [iconOpen, setIconOpen] = useState(false);

  return (
    <div className="space-y-2.5">
      <Input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 60) })}
        placeholder="Habit name"
        className="h-9 text-sm"
        maxLength={60}
      />

      <div className="grid grid-cols-2 gap-2">
        {/* Icon picker (popover) */}
        <Popover open={iconOpen} onOpenChange={setIconOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 justify-start gap-2"
              type="button"
            >
              <span className="text-base leading-none">
                {HABIT_ICONS[draft.icon] ?? draft.icon}
              </span>
              <span className="text-xs text-muted-foreground">Icon</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-6 gap-1">
              {ICON_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setDraft({ ...draft, icon: name });
                    setIconOpen(false);
                  }}
                  className={cn(
                    "aspect-square rounded-md flex items-center justify-center text-lg transition-colors",
                    draft.icon === name
                      ? "bg-violet-500/20 ring-2 ring-violet-500"
                      : "hover:bg-muted",
                  )}
                  aria-label={name}
                >
                  {HABIT_ICONS[name]}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Color picker */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDraft({ ...draft, color: c })}
              className={cn(
                "w-5 h-5 rounded-md transition-all",
                draft.color === c && "ring-2 ring-offset-1 ring-offset-background ring-foreground",
              )}
              style={{ backgroundColor: c }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Frequency */}
        <Select
          value={draft.frequency}
          onValueChange={(v) =>
            setDraft({
              ...draft,
              frequency: v as "daily" | "custom",
              days: v === "daily" ? null : draft.days ?? [0, 1, 2, 3, 4],
            })
          }
        >
          <SelectTrigger size="sm" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="custom">Custom days</SelectItem>
          </SelectContent>
        </Select>

        {/* Time of day */}
        <Select
          value={draft.timeOfDay}
          onValueChange={(v) =>
            setDraft({ ...draft, timeOfDay: v as HabitSuggestion["timeOfDay"] })
          }
        >
          <SelectTrigger size="sm" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY_TIME">Any time</SelectItem>
            <SelectItem value="MORNING">🌅 Morning</SelectItem>
            <SelectItem value="AFTERNOON">☀️ Afternoon</SelectItem>
            <SelectItem value="EVENING">🌙 Evening</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Custom days (only when frequency === "custom") */}
      {draft.frequency === "custom" && (
        <div className="flex gap-1">
          {DAY_LABELS.map((d, i) => {
            const on = draft.days?.includes(i) ?? false;
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleCustomDay(i)}
                className={cn(
                  "flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors",
                  on
                    ? "bg-violet-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Input
            value={draft.unit ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, unit: e.target.value ? e.target.value : null })
            }
            placeholder="unit (e.g. glasses, pages)"
            className="h-9 text-xs"
            maxLength={20}
          />
        </div>
        <Input
          type="number"
          min={1}
          max={100}
          value={draft.targetCount}
          onChange={(e) =>
            setDraft({
              ...draft,
              targetCount: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
            })
          }
          className="h-9 text-xs"
          aria-label="Target per day"
        />
      </div>
    </div>
  );
}
