"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Smile, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSaveMood } from "@/hooks/use-moods";
import {
  MOOD_EMOJIS,
  MOOD_LABELS,
  MOOD_TAGS,
  moodColor,
  moodLabel,
} from "@/types/mood";
import { cn } from "@/lib/utils";

const NOTE_LIMIT = 200;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

interface MoodModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialScore?: number;
  initialNote?: string;
  initialTags?: string[];
}

/**
 * Full mood-entry form dialog. Lets the user pick a score (emoji), write a note,
 * and toggle preset tags. Calls `useSaveMood()` on submit and closes on success.
 */
export function MoodModal({
  open,
  onOpenChange,
  initialScore,
  initialNote,
  initialTags,
}: MoodModalProps) {
  const [score, setScore] = useState<number | undefined>(initialScore);
  const [note, setNote] = useState<string>(initialNote ?? "");
  const [tags, setTags] = useState<string[]>(initialTags ?? []);
  const saveMood = useSaveMood();

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleSave() {
    if (!score) return;
    saveMood.mutate(
      {
        date: todayStr(),
        score,
        note: note.trim() ? note.trim() : undefined,
        tags: tags.length > 0 ? tags : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  const remaining = NOTE_LIMIT - note.length;
  const color = score ? moodColor(score) : null;
  const label = score ? moodLabel(score) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smile className="w-5 h-5 text-violet-500" />
            How are you feeling?
          </DialogTitle>
          <DialogDescription>
            Log your mood for today. You can update it any time.
          </DialogDescription>
        </DialogHeader>

        {/* Score picker */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Mood score {score ? `· ${score}/10 ${label}` : ""}
          </Label>
          <div className="grid grid-cols-5 gap-1.5">
            {MOOD_EMOJIS.map((emoji, i) => {
              const value = i + 1;
              const selected = score === value;
              return (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => setScore(value)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  title={`${MOOD_LABELS[i]} · ${value}/10`}
                  aria-label={`Mood: ${MOOD_LABELS[i]}`}
                  aria-pressed={selected}
                  className={cn(
                    "aspect-square rounded-lg text-xl flex items-center justify-center transition-colors",
                    "border bg-background/60",
                    selected
                      ? "ring-2 ring-violet-500 scale-110 bg-violet-500/10 border-violet-500/40"
                      : "border-border/60 hover:border-violet-400 hover:bg-violet-500/5",
                  )}
                >
                  {emoji}
                </motion.button>
              );
            })}
          </div>
          {color && (
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "inline-block w-2 h-2 rounded-full",
                  color.bg.replace("/10", "/60"),
                )}
              />
              <span className={color.text}>{label}</span>
            </div>
          )}
        </div>

        {/* Note */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="mood-note" className="text-xs text-muted-foreground">
              Note <span className="italic">(optional)</span>
            </Label>
            <span
              className={cn(
                "text-[10px] tabular-nums",
                remaining < 20 ? "text-amber-500" : "text-muted-foreground",
              )}
            >
              {Math.max(remaining, 0)} left
            </span>
          </div>
          <textarea
            id="mood-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_LIMIT))}
            placeholder="What's on your mind?"
            rows={2}
            maxLength={NOTE_LIMIT}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:border-ring focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto break-all"
            style={{ height: "60px", maxHeight: "60px", minHeight: "60px", resize: "none" }}
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Tag className="w-3 h-3" /> Tags
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {MOOD_TAGS.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selected}
                  className={cn(
                    "text-xs px-2 py-1 rounded-md border transition-colors",
                    selected
                      ? "bg-violet-500/20 text-violet-600 dark:text-violet-300 border-violet-500/40"
                      : "bg-background/60 text-muted-foreground border-border/60 hover:border-violet-400 hover:text-foreground",
                  )}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!score || saveMood.isPending}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {saveMood.isPending ? "Saving…" : "Save mood"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
