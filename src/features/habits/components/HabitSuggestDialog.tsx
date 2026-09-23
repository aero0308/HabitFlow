"use client";

import { useMemo, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNav } from "@/lib/nav-store";
import { useSuggestions } from "@/features/habits/hooks/useSuggestions";
import { GoalInputStep } from "@/features/habits/components/GoalInputStep";
import { SuggestionSkeleton } from "@/features/habits/components/SuggestionSkeleton";
import { SuggestionCard } from "@/features/habits/components/SuggestionCard";
import { GlowingBorder } from "@/features/insights/components/GlowingBorder";
import { cn } from "@/lib/utils";

interface HabitSuggestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user picks "Skip and create manually". */
  onSkipToManual?: () => void;
}

/**
 * HabitSuggestDialog — the main entry point for the AI habit-suggestions flow.
 *
 * State machine driven by the `useSuggestions` hook:
 *   input → loading → results → (accept | regenerate | cancel)
 *
 * Errors:
 *   - 402 NO_API_KEY → violet banner with "Add AI key →" button (deep link to Settings)
 *   - 429 RATE_LIMITED → amber inline message
 *   - other → generic red banner with Try again button
 */
export function HabitSuggestDialog({
  open,
  onOpenChange,
  onSkipToManual,
}: HabitSuggestDialogProps) {
  const { go } = useNav();
  const {
    phase,
    goal,
    suggestions,
    selectedIndices,
    model,
    error,
    accepting,
    generate,
    accept,
    reset,
    cancel,
    setGoal,
    patchSuggestion,
    toggleSelected,
    clearSelected,
  } = useSuggestions();

  // Reset internal state when the dialog closes
  const handleOpenChange = useCallback(
    (openState: boolean) => {
      if (!openState) {
        cancel();
        // Defer reset so the close animation can play
        setTimeout(() => reset(), 200);
      }
      onOpenChange(openState);
    },
    [cancel, reset, onOpenChange],
  );

  const handleGenerate = useCallback(() => {
    generate(goal);
  }, [generate, goal]);

  const handleRegenerate = useCallback(() => {
    clearSelected();
    generate(goal);
  }, [generate, goal, clearSelected]);

  const handleAccept = useCallback(() => {
    if (!suggestions) return;
    const picked = suggestions.filter((_, i) => selectedIndices.has(i));
    if (picked.length === 0) return;
    accept(picked);
    onOpenChange(false);
  }, [suggestions, selectedIndices, accept, onOpenChange]);

  const handleSkip = useCallback(() => {
    onOpenChange(false);
    onSkipToManual?.();
  }, [onOpenChange, onSkipToManual]);

  // ---- Error banner rendering --------------------------------------------

  const noApiKey = error?.code === "NO_API_KEY";
  const isRateLimited =
    error?.code === "RATE_LIMITED" ||
    error?.code === "PROVIDER_RATE_LIMITED";
  const isInvalidKey = error?.code === "INVALID_KEY";

  const errorBanner = useMemo(() => {
    if (!error) return null;
    if (noApiKey || isInvalidKey) {
      return (
        <div
          className={cn(
            "rounded-lg p-3 flex items-start gap-2.5",
            isInvalidKey
              ? "bg-red-500/5 border border-red-500/20"
              : "bg-violet-500/5 border border-violet-500/20",
          )}
        >
          <AlertCircle
            className={cn(
              "w-4 h-4 mt-0.5 flex-shrink-0",
              isInvalidKey ? "text-red-500" : "text-violet-500",
            )}
          />
          <div className="flex-1 text-sm">
            <p className="text-foreground">{error.message}</p>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                go({ name: "settings" });
              }}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-300 hover:underline"
            >
              Open Settings <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    }
    if (isRateLimited) {
      return (
        <div className="rounded-lg p-3 flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
          <p className="text-sm text-foreground">{error.message}</p>
        </div>
      );
    }
    return (
      <div className="rounded-lg p-3 flex items-start gap-2.5 bg-red-500/5 border border-red-500/20">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
        <div className="flex-1 text-sm">
          <p className="text-foreground">{error.message}</p>
          <button
            type="button"
            onClick={handleGenerate}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-300 hover:underline"
          >
            <RefreshCw className="w-3 h-3" /> Try again
          </button>
        </div>
      </div>
    );
  }, [
    error,
    noApiKey,
    isInvalidKey,
    isRateLimited,
    handleGenerate,
    onOpenChange,
    go,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        // Mobile: full-screen bottom sheet (slides up from bottom, respects
        // safe-area for iPhone notch / home indicator).
        // Desktop: centered modal, max-w-2xl, max-h-88vh, scrollable inside.
        className="
          fixed inset-0 translate-x-0 translate-y-0
          sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          rounded-none sm:rounded-xl
          max-w-none sm:max-w-2xl w-full
          h-[100dvh] sm:h-auto
          max-h-[100dvh] sm:max-h-[88vh]
          overflow-hidden sm:overflow-hidden
          p-0 gap-0
          flex flex-col
          safe-area-pt
          border-0 sm:border
          shadow-none sm:shadow-xl
        "
        overlayClassName="bg-slate-900/70 backdrop-blur-md dark:bg-black/70"
        showCloseButton={false}
      >
        {/* Sticky mobile top bar — provides a close button that's easy to
            reach with one thumb. Hidden on sm+ (the dialog has its own
            built-in close button on desktop). */}
        <div className="sm:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-12 border-b border-slate-200/80 dark:border-white/5 bg-white/95 dark:bg-[#0a0a0f]/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-[#0a0a0f]/80">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-violet-600 dark:text-violet-300">
            <Sparkles className="w-3.5 h-3.5" />
            AI Suggestions
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 -mr-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        {/* Header (always visible) */}
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sm:pb-3 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            AI Habit Suggestions
          </DialogTitle>
          <DialogDescription>
            Tell us your goal — we&apos;ll suggest 3-5 specific, measurable habits.
          </DialogDescription>
        </DialogHeader>

        <GlowingBorder className="mx-3 sm:mx-6 mb-4 sm:mb-6" rounded="rounded-xl">
          <div className="bg-background p-3 sm:p-4">
            {phase === "input" && (
              <GoalInputStep
                goal={goal}
                onGoalChange={setGoal}
                onGenerate={handleGenerate}
                onSkip={handleSkip}
                loading={false}
                banner={errorBanner}
              />
            )}

            {phase === "loading" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                  <span>
                    Thinking about &ldquo;{goal || "your goal"}&rdquo;…
                  </span>
                </div>
                <SuggestionSkeleton />
              </div>
            )}

            {phase === "results" && suggestions && (
              <div className="space-y-2">
                {/* Meta header */}
                <div className="flex items-center justify-between mb-1 gap-2">
                  <p className="text-xs text-muted-foreground truncate">
                    {suggestions.length} suggestion
                    {suggestions.length === 1 ? "" : "s"}
                    {model ? ` · ${model}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={accepting}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </div>

                <div className="max-h-[55vh] sm:max-h-[52vh] overflow-y-auto pr-1 -mr-1 space-y-2">
                  {suggestions.map((s, i) => (
                    <SuggestionCard
                      key={i}
                      suggestion={s}
                      index={i}
                      selected={selectedIndices.has(i)}
                      onToggleSelected={() => toggleSelected(i)}
                      onPatch={(patch) => patchSuggestion(i, patch)}
                    />
                  ))}
                </div>

                {/* Sticky footer — respects safe-area on iPhone */}
                <div className="sticky bottom-0 -mx-3 sm:-mx-4 mt-2 px-3 sm:px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] border-t border-slate-200/80 dark:border-white/5 bg-background/95 backdrop-blur-sm flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {selectedIndices.size} selected
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={accepting}
                      className="h-8 px-2.5"
                    >
                      <RefreshCw className="w-3 h-3" /> <span className="hidden sm:inline">Regenerate</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAccept}
                      disabled={accepting || selectedIndices.size === 0}
                      className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white border-0 h-8 px-3"
                    >
                      {accepting ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 mr-1" />
                      )}
                      Add {selectedIndices.size} habit{selectedIndices.size === 1 ? "" : "s"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlowingBorder>
      </DialogContent>
    </Dialog>
  );
}
