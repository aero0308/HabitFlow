"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface GoalInputStepProps {
  goal: string;
  onGoalChange: (v: string) => void;
  onGenerate: () => void;
  onSkip: () => void;
  loading: boolean;
  /** Optional banner shown above the textarea (e.g. no-API-key error). */
  banner?: React.ReactNode;
}

const MAX_GOAL = 200;

/**
 * GoalInputStep — the first state of the HabitSuggestDialog.
 *
 * Renders a large textarea with a live char counter, a row of example goal
 * chips (fetched from /api/habits/suggest/examples on mount), a "Generate"
 * button, and a "Skip and create manually" link.
 */
export function GoalInputStep({
  goal,
  onGoalChange,
  onGenerate,
  onSkip,
  loading,
  banner,
}: GoalInputStepProps) {
  const [examples, setExamples] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/habits/suggest/examples", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { examples?: string[] } | null) => {
        if (cancelled) return;
        if (d && Array.isArray(d.examples)) setExamples(d.examples);
      })
      .catch(() => {
        /* non-fatal — chips just won't show */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter submits, plain Enter inserts newline (so mobile users
      // can type multi-line goals without submitting by accident).
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canGenerate && !loading) onGenerate();
      }
    },
    [goal, loading, onGenerate],
  );

  const canGenerate = goal.trim().length >= 3;

  return (
    <div className="space-y-4">
      {banner}

      <div className="space-y-2">
        <label htmlFor="hf-goal" className="text-sm font-medium">
          What do you want to work toward?
        </label>
        <Textarea
          id="hf-goal"
          autoFocus
          placeholder="e.g. I want to be healthier, sleep better, and read more books."
          value={goal}
          onChange={(e) => onGoalChange(e.target.value.slice(0, MAX_GOAL))}
          onKeyDown={handleKeyDown}
          rows={4}
          className="resize-none text-base"
          disabled={loading}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Press ⌘/Ctrl + Enter to generate</span>
          <span className={cn(goal.length > MAX_GOAL - 20 && "text-amber-600")}>
            {goal.length} / {MAX_GOAL}
          </span>
        </div>
      </div>

      {examples.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Need inspiration?</p>
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex, i) => (
              <button
                key={ex}
                type="button"
                onClick={() => onGoalChange(ex)}
                disabled={loading}
                className="text-xs px-2.5 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={onSkip}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto"
        >
          Skip and create manually
        </button>
        <Button
          onClick={onGenerate}
          disabled={!canGenerate || loading}
          className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white border-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Thinking…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-1" /> Generate suggestions
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
