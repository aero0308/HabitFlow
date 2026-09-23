"use client";

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { HabitSuggestion } from "@/lib/ai/generateSuggestions";

/* ============================================================================
   useSuggestions — drives the HabitSuggestDialog state machine.
   ----------------------------------------------------------------------------
   Three visible states:
     1. goal input    — `phase === "input"`, `suggestions === null`
     2. loading       — `phase === "loading"`, suggestions null + loading=true
     3. results       — `phase === "results"`, suggestions array present

   Actions:
     - generate(goal): POST /api/habits/suggest, populate suggestions
     - accept(selected): POST /api/habits/suggest/accept, invalidate habits
     - reset(): clear all state back to the input phase
     - cancel(): abort any in-flight generate request
============================================================================ */

type Phase = "input" | "loading" | "results";

interface UseSuggestionsState {
  phase: Phase;
  goal: string;
  suggestions: HabitSuggestion[] | null;
  selectedIndices: Set<number>;
  model: string | null;
  error: { message: string; code?: string } | null;
  accepting: boolean;
}

interface GenerateResponse {
  suggestions: HabitSuggestion[];
  model: string;
  tokensUsed?: number;
}

interface AcceptResponse {
  created: number;
}

interface ApiErrorShape {
  detail: string;
  code?: string;
}

export function useSuggestions() {
  const qc = useQueryClient();
  const [state, setState] = useState<UseSuggestionsState>({
    phase: "input",
    goal: "",
    suggestions: null,
    selectedIndices: new Set(),
    model: null,
    error: null,
    accepting: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (goal: string) => {
    // Cancel any in-flight request first
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({
      ...s,
      phase: "loading",
      goal,
      error: null,
      suggestions: null,
      model: null,
    }));

    try {
      const res = await fetch("/api/habits/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
        signal: controller.signal,
        credentials: "include",
      });

      const data = (await res.json().catch(() => null)) as
        | GenerateResponse
        | ApiErrorShape
        | null;

      if (!res.ok || !data || !("suggestions" in data)) {
        const err = data as ApiErrorShape | null;
        setState((s) => ({
          ...s,
          phase: "input",
          error: {
            message: err?.detail ?? "Couldn't generate suggestions. Try again.",
            code: err?.code,
          },
        }));
        return;
      }

      setState((s) => ({
        ...s,
        phase: "results",
        suggestions: data.suggestions,
        selectedIndices: new Set(data.suggestions.map((_, i) => i)),
        model: data.model,
        error: null,
      }));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // User-cancelled — go back to input but keep their goal text
        setState((s) => ({
          ...s,
          phase: "input",
          error: null,
        }));
        return;
      }
      setState((s) => ({
        ...s,
        phase: "input",
        error: { message: "Network error — please try again." },
      }));
    }
  }, []);

  const accept = useCallback(
    async (selected: HabitSuggestion[]) => {
      if (selected.length === 0) return;
      const goal = state.goal;
      setState((s) => ({ ...s, accepting: true }));
      try {
        const res = await fetch("/api/habits/suggest/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestions: selected, goal }),
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as
          | AcceptResponse
          | ApiErrorShape
          | null;
        if (!res.ok || !data || !("created" in data)) {
          const err = data as ApiErrorShape | null;
          toast.error(err?.detail ?? "Couldn't add habits. Try again.");
          setState((s) => ({ ...s, accepting: false }));
          return;
        }
        // Invalidate all habit/dashboard/analytics queries so the new habits show up
        qc.invalidateQueries({ queryKey: ["habits"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["analytics"] });
        toast.success(`Added ${data.created} habit${data.created === 1 ? "" : "s"}`);
        setState((s) => ({
          ...s,
          accepting: false,
          phase: "input",
          goal: "",
          suggestions: null,
          model: null,
          error: null,
        }));
      } catch {
        toast.error("Network error — please try again.");
        setState((s) => ({ ...s, accepting: false }));
      }
    },
    [qc, state.goal],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({
      phase: "input",
      goal: "",
      suggestions: null,
      selectedIndices: new Set(),
      model: null,
      error: null,
      accepting: false,
    });
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({
      ...s,
      phase: "input",
      error: null,
    }));
  }, []);

  /** Update the goal text (input phase only — doesn't trigger a request). */
  const setGoal = useCallback((v: string) => {
    setState((s) => ({ ...s, goal: v }));
  }, []);

  /** Patch a single suggestion by index (used for inline editing in the dialog). */
  const patchSuggestion = useCallback(
    (index: number, patch: Partial<HabitSuggestion>) => {
      setState((s) => {
        if (!s.suggestions) return s;
        const next = s.suggestions.slice();
        const cur = next[index];
        if (!cur) return s;
        next[index] = { ...cur, ...patch };
        return { ...s, suggestions: next };
      });
    },
    [],
  );

  /** Toggle whether the suggestion at `index` is selected for acceptance. */
  const toggleSelected = useCallback((index: number) => {
    setState((s) => {
      const next = new Set(s.selectedIndices);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...s, selectedIndices: next };
    });
  }, []);

  /** Clear all selected indices (used before regenerating). */
  const clearSelected = useCallback(() => {
    setState((s) => ({ ...s, selectedIndices: new Set() }));
  }, []);

  return {
    ...state,
    generate,
    accept,
    reset,
    cancel,
    setGoal,
    patchSuggestion,
    toggleSelected,
    clearSelected,
  };
}
