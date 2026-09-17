"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer as TimerIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PomodoroTimer } from "./PomodoroTimer";
import { usePomodoroStore } from "./pomodoroStore";
import { usePomodoroTick } from "./usePomodoroTick";

export function MobilePomodoroFab() {
  const [open, setOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [fabEnabled, setFabEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const s = localStorage.getItem("habitflow-pomodoro-fab-enabled");
    return s === null ? true : s === "true";
  });

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
  // No onComplete callback; the hidden mount's PomodoroTimer handles completion.
  usePomodoroTick();

  if (!fabEnabled) return null;

  // Only show hidden mount when sheet is fully closed (not during exit animation).
  // This prevents two PomodoroTimer instances being mounted simultaneously.
  const showHiddenMount = !open && !exiting;

  function handleOpen() {
    setExiting(false);
    setOpen(true);
  }

  function handleClose() {
    setExiting(true);
    setOpen(false);
  }

  return (
    <>
      <FabButton onClick={handleOpen} />

      <AnimatePresence
        onExitComplete={() => setExiting(false)}
      >
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl p-4 pb-8 max-h-[85vh] overflow-y-auto"
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

              <PomodoroTimer />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hidden timer mount — keeps PomodoroTimer alive when sheet is closed.
          Only rendered when sheet is fully closed (not during exit animation)
          to prevent two PomodoroTimer instances being mounted simultaneously. */}
      {showHiddenMount && (
        <div className="lg:hidden fixed -left-[9999px] -top-[9999px] w-0 h-0 overflow-hidden opacity-0 pointer-events-none">
          <PomodoroTimer />
        </div>
      )}
    </>
  );
}

function FabButton({ onClick }: { onClick: () => void }) {
  const status = usePomodoroStore((s) => s.status);
  const isRunning = status === "running";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="lg:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center"
      aria-label="Open Focus Timer"
      animate={
        isRunning
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
        isRunning
          ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
    >
      <TimerIcon className="w-5 h-5" />
    </motion.button>
  );
}
