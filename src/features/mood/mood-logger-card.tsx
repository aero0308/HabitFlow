"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Smile, TrendingUp, TrendingDown, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMoodToday, useSaveMood, useMoods } from "@/hooks/use-moods";
import {
  MOOD_EMOJIS,
  MOOD_LABELS,
  moodColor,
  moodLabel,
} from "@/types/mood";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRESET_TAGS = [
  { label: "Tired", emoji: "😴" },
  { label: "Work", emoji: "💼" },
  { label: "Exercise", emoji: "🏃" },
  { label: "Family", emoji: "👨‍👩‍👧" },
  { label: "Weather", emoji: "🌧" },
  { label: "Food", emoji: "🍔" },
  { label: "Sleep", emoji: "🛏" },
  { label: "Social", emoji: "🎉" },
];

interface MoodLoggerCardProps {
  onEdit: () => void;
  className?: string;
  onViewInsights?: () => void;
}

export function MoodLoggerCard({ onEdit, className, onViewInsights }: MoodLoggerCardProps) {
  const { data: today, isLoading } = useMoodToday();
  const saveMood = useSaveMood();

  // Fetch last 7 days of moods for the insight hint
  const sevenDaysAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const todayDate = todayStr();
  const { data: recentMoods } = useMoods(sevenDaysAgo, todayDate);

  // Compute 7-day average (excluding today)
  const sevenDayAvg = useMemo(() => {
    if (!recentMoods || recentMoods.length < 3) return null;
    const previous = recentMoods.filter((m) => m.date !== todayDate);
    if (previous.length < 2) return null;
    const sum = previous.reduce((s, m) => s + m.score, 0);
    return Math.round((sum / previous.length) * 10) / 10;
  }, [recentMoods, todayDate]);

  const delta = useMemo(() => {
    if (!sevenDayAvg || !today) return null;
    return Math.round((today.score - sevenDayAvg) * 10) / 10;
  }, [sevenDayAvg, today]);

  const showInsight = sevenDayAvg !== null && delta !== null && Math.abs(delta) >= 0.1;

  function quickLog(score: number) {
    saveMood.mutate({ date: todayStr(), score });
  }

  function toggleTag(tag: string) {
    if (!today) return;
    const currentTags = today.tags ?? [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    saveMood.mutate({
      date: todayStr(),
      score: today.score,
      note: today.note,
      tags: newTags,
    });
  }

  function addCustomTag(tag: string) {
    if (!today || !tag.trim()) return;
    const currentTags = today.tags ?? [];
    if (currentTags.includes(tag.trim())) return;
    saveMood.mutate({
      date: todayStr(),
      score: today.score,
      note: today.note,
      tags: [...currentTags, tag.trim()],
    });
  }

  return (
    <Card
      className={cn(
        "p-4 relative overflow-hidden border-violet-500/20",
        "bg-gradient-to-br from-violet-500/5 via-indigo-500/5 to-transparent",
        className,
      )}
    >
      <div
        className="absolute -top-8 -right-8 w-28 h-28 bg-violet-500/10 rounded-full blur-2xl pointer-events-none"
        aria-hidden
      />

      {isLoading ? (
        <MoodLoggerSkeleton />
      ) : !today ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative"
        >
          <div className="flex items-center gap-1.5 mb-2.5">
            <Smile className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold">How are you feeling?</h3>
          </div>
          <div className="flex gap-1 justify-center">
            {MOOD_EMOJIS.map((emoji, i) => (
              <motion.button
                key={emoji}
                type="button"
                onClick={() => quickLog(i + 1)}
                disabled={saveMood.isPending}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                title={`${MOOD_LABELS[i]} · ${i + 1}/10`}
                aria-label={`Log mood: ${MOOD_LABELS[i]}`}
                className={cn(
                  "w-7 h-7 rounded-md text-sm flex items-center justify-center",
                  "bg-background/60 border border-border/60 hover:border-violet-400",
                  "hover:bg-violet-500/10 hover:ring-1 hover:ring-violet-400/40",
                  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {emoji}
              </motion.button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2.5">
            Tap an emoji to log today&apos;s mood.
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Smile className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold">Today&apos;s mood</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3 h-3" /> Edit
            </Button>
          </div>

          {/* Mood score row */}
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "text-2xl leading-none w-10 h-10 rounded-lg flex items-center justify-center border",
                moodColor(today.score).bg,
                moodColor(today.score).border,
              )}
            >
              {MOOD_EMOJIS[today.score - 1]}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-sm font-semibold",
                  moodColor(today.score).text,
                )}
              >
                {today.score}/10 · {moodLabel(today.score)}
              </span>
              {today.note ? (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  &ldquo;{today.note}&rdquo;
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No note</p>
              )}
            </div>
          </div>

          {/* Tags row */}
          <MoodTagChips
            selectedTags={today.tags ?? []}
            onToggle={toggleTag}
            onAddCustom={addCustomTag}
            disabled={saveMood.isPending}
          />

          {/* Divider */}
          {showInsight && <div className="border-t border-border my-3" />}

          {/* Insight row */}
          {showInsight && (
            <MoodInsightHint
              delta={delta!}
              sevenDayAvg={sevenDayAvg!}
              onViewInsights={onViewInsights}
            />
          )}
        </motion.div>
      )}
    </Card>
  );
}

// ============================================================
// MoodTagChips
// ============================================================

interface MoodTagChipsProps {
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onAddCustom: (tag: string) => void;
  disabled?: boolean;
}

function MoodTagChips({ selectedTags, onToggle, onAddCustom, disabled }: MoodTagChipsProps) {
  const [customTag, setCustomTag] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Merge preset tags with any custom tags already on the entry
  const allTags = useMemo(() => {
    const presetLabels = PRESET_TAGS.map((t) => t.label.toLowerCase());
    const customs = selectedTags.filter((t) => !presetLabels.includes(t.toLowerCase()));
    return [...PRESET_TAGS, ...customs.map((c) => ({ label: c, emoji: "🏷" }))];
  }, [selectedTags]);

  function handleAddCustom() {
    const tag = customTag.trim();
    if (!tag) return;
    onAddCustom(tag);
    setCustomTag("");
    setPopoverOpen(false);
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground mb-2">What&apos;s affecting your mood?</p>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence>
          {allTags.map((tag, i) => {
            const isSelected = selectedTags.some(
              (t) => t.toLowerCase() === tag.label.toLowerCase(),
            );
            return (
              <motion.button
                key={tag.label}
                type="button"
                onClick={() => onToggle(tag.label)}
                disabled={disabled}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  "hover:bg-muted",
                  isSelected
                    ? "bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-300"
                    : "bg-muted/50 border-border text-muted-foreground",
                )}
              >
                <span className="mr-1">{tag.emoji}</span>
                {tag.label}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Add custom tag */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: allTags.length * 0.03, duration: 0.2 }}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border",
                "bg-muted/50 border-border text-muted-foreground hover:bg-muted transition-colors",
                "inline-flex items-center gap-1",
              )}
            >
              <Plus className="w-3 h-3" /> Add
            </motion.button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="flex gap-1.5">
              <Input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                placeholder="Custom tag..."
                className="h-8 text-xs"
                autoFocus
              />
              <Button size="sm" className="h-8 px-2" onClick={handleAddCustom}>
                Add
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ============================================================
// MoodInsightHint
// ============================================================

interface MoodInsightHintProps {
  delta: number;
  sevenDayAvg: number;
  onViewInsights?: () => void;
}

function MoodInsightHint({ delta, sevenDayAvg, onViewInsights }: MoodInsightHintProps) {
  const isBelow = delta < 0;
  const absDelta = Math.abs(delta);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        {isBelow ? (
          <TrendingDown className="w-4 h-4 text-violet-400 flex-shrink-0" />
        ) : (
          <TrendingUp className="w-4 h-4 text-violet-400 flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground truncate">
          Your mood is {absDelta} points {isBelow ? "below" : "above"} your 7-day average ({sevenDayAvg})
        </span>
      </div>
      {onViewInsights && (
        <button
          onClick={onViewInsights}
          className="text-xs text-violet-400 hover:underline flex-shrink-0 whitespace-nowrap"
        >
          View insights →
        </button>
      )}
    </div>
  );
}

// ============================================================
// Skeleton
// ============================================================

function MoodLoggerSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-1 justify-center">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="w-7 h-7 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-3 w-40 mt-1" />
    </div>
  );
}
