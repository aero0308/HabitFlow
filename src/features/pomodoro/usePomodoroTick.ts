"use client";

import { useEffect, useRef } from "react";
import { usePomodoroStore } from "./pomodoroStore";

export function usePomodoroTick(onComplete?: () => void) {
  const status = usePomodoroStore((s) => s.status);
  const completionPending = usePomodoroStore((s) => s.completionPending);
  const tick = usePomodoroStore((s) => s.tick);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickSecondRef = useRef(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; });

  // beforeunload warning
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (usePomodoroStore.getState().status === "running") {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // rAF + setInterval for ticking — only depends on `status`, NOT secondsRemaining.
  // This prevents the rAF from being cancelled/restarted every second, which
  // causes the ring to stutter/freeze on mobile.
  // The loop reads the latest state from the store via getState().
  useEffect(() => {
    if (status !== "running") {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }

    // Initialize from current store state (not from closure)
    lastTickSecondRef.current = usePomodoroStore.getState().secondsRemaining;

    const loop = () => {
      const state = usePomodoroStore.getState();
      if (!state.endTime) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const now = Date.now();
      const remainingMs = state.endTime - now;
      const currentSecond = Math.max(0, Math.ceil(remainingMs / 1000));
      if (currentSecond !== lastTickSecondRef.current) {
        lastTickSecondRef.current = currentSecond;
        tick();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    intervalRef.current = setInterval(() => {
      const state = usePomodoroStore.getState();
      if (state.status !== "running" || !state.endTime) return;
      const now = Date.now();
      const remainingMs = state.endTime - now;
      const currentSecond = Math.max(0, Math.ceil(remainingMs / 1000));
      if (currentSecond !== lastTickSecondRef.current) {
        lastTickSecondRef.current = currentSecond;
        tick();
      }
    }, 500);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, tick]);

  // Detect completion using the store's completionPending flag.
  useEffect(() => {
    if (completionPending) {
      onCompleteRef.current?.();
    }
  }, [completionPending]);
}
