"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Timer as TimerIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PomodoroTimer } from "./PomodoroTimer";
import { usePomodoroStore } from "./pomodoroStore";
import { usePomodoroTick } from "./usePomodoroTick";

/**
 * MobilePomodoroFab — floating button on mobile that opens a bottom sheet
 * containing the PomodoroTimer.
 *
 * CRITICAL ARCHITECTURE NOTE:
 *   The sheet is ALWAYS MOUNTED — we only animate its `y` transform to slide
 *   it in/out of view. This is intentional: the PomodoroTimer owns an
 *   <audio> element, and if we ever unmount it (e.g. during a sheet-close
 *   animation), the audio element dies mid-song and can't auto-resume
 *   because browsers block autoplay without a user gesture.
 *
 *   By keeping the sheet (and its PomodoroTimer) always mounted, the audio
 *   element persists across open/close, so music keeps playing in the
 *   background after the user closes the sheet on mobile. This was a real
 *   bug — the previous implementation used AnimatePresence to mount/unmount
 *   the sheet's PomodoroTimer, leaving a ~300ms gap during the exit
 *   animation where no audio element existed.
 *
 * State:
 *   - `open` controls whether the sheet is visible (y: 0) or hidden (y: 100%)
 *   - `fabEnabled` controls whether the FAB itself is shown at all (toggled
 *     from the Settings → Help & Tour section). When disabled, we render
 *     nothing.
 *
 * The hidden background-tick (usePomodoroTick) keeps the countdown going
 * even when the sheet is closed — this is independent of the audio element.
 */
export function MobilePomodoroFab() {
  const [open, setOpen] = useState(false);
  const [fabEnabled, setFabEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const s = localStorage.getItem("habitflow-pomodoro-fab-enabled");
    return s === null ? true : s === "true";
  });
  const shouldReduceMotion = useReducedMotion();

  function toggleFab(enabled: boolean) {
    setFabEnabled(enabled);
    localStorage.setItem("habitflow-pomodoro-fab-enabled", String(enabled));
    window.dispatchEvent(new Event("pomodoro-fab-toggle"));
  }

  useEffect(() => {
    function handleToggle() {
      const s = localStorage.getItem("habitflow-pomodoro-fab-enabled");
      setFabEnabled(s === null ? true : s === "true");
    }
    function handleStorage(e: StorageEvent) {
      if (e.key === "habitflow-pomodoro-fab-enabled" && e.newValue !== null) {
        setFabEnabled(e.newValue === "true");
      }
    }
    window.addEventListener("storage", handleStorage);
    window.addEventListener("pomodoro-fab-toggle", handleToggle);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pomodoro-fab-toggle", handleToggle);
    };
  }, []);

  // Background tick — keeps countdown going even when sheet is closed.
  // No onComplete callback; the always-mounted PomodoroTimer handles completion.
  usePomodoroTick();

  if (!fabEnabled) return null;

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <FabButton onClick={handleOpen} />

      {/* Backdrop — animated opacity, but doesn't unmount during close
          animation. We use pointer-events-none when closed so taps pass
          through to the page underneath. */}
      <div
        onClick={handleClose}
        className={`
          lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm
          transition-opacity duration-300
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        aria-hidden={!open}
      />

      {/* Bottom sheet — ALWAYS MOUNTED. We slide it in/out via transform:translateY.
          This keeps the PomodoroTimer (and its <audio> element) alive across
          open/close so background music never stops. */}
      <motion.div
        initial={false}
        animate={{ y: open ? 0 : "100%" }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 400, damping: 35 }
        }
        className="
          lg:hidden fixed bottom-0 left-0 right-0 z-50
          bg-background border-t border-border rounded-t-2xl
          p-4 pb-[max(1rem,env(safe-area-inset-bottom))]
          max-h-[85vh] overflow-y-auto
          will-change-transform
        "
        style={{ visibility: open || shouldReduceMotion ? "visible" : undefined }}
      >
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Focus Timer</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { toggleFab(false); handleClose(); }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Hide
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleClose}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* PomodoroTimer is mounted ONCE here. Its <audio> element persists
            across sheet open/close, so music keeps playing in the background. */}
        <PomodoroTimer />
      </motion.div>
    </>
  );
}

function FabButton({ onClick }: { onClick: () => void }) {
  const status = usePomodoroStore((s) => s.status);
  const isRunning = status === "running";
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="lg:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center"
      aria-label="Open Focus Timer"
      animate={
        isRunning && !shouldReduceMotion
          ? {
              scale: [1, 1.15, 1],
              boxShadow: [
                "0 4px 12px rgba(139,92,246,0.3)",
                "0 4px 24px rgba(139,92,246,0.6)",
                "0 4px 12px rgba(139,92,246,0.3)",
              ],
            }
          : { scale: 1, boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }
      }
      transition={
        isRunning && !shouldReduceMotion
          ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
    >
      <TimerIcon className="w-5 h-5" />
    </motion.button>
  );
}
