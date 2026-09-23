"use client";

import { RotateCcw, Settings as SettingsIcon, Pause, Play } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePomodoroStore } from "./pomodoroStore";

interface PomodoroControlsProps {
  onOpenSettings: () => void;
}

/**
 * Three-element controls row: Reset | Start/Pause/Resume pill | Settings gear.
 */
export function PomodoroControls({ onOpenSettings }: PomodoroControlsProps) {
  const status = usePomodoroStore((s) => s.status);
  const start = usePomodoroStore((s) => s.start);
  const pause = usePomodoroStore((s) => s.pause);
  const resume = usePomodoroStore((s) => s.resume);
  const reset = usePomodoroStore((s) => s.reset);

  const label = status === "running" ? "Pause" : status === "paused" ? "Resume" : "Start";
  const Icon = status === "running" ? Pause : Play;

  function handlePrimary() {
    if (status === "running") {
      pause();
    } else if (status === "paused") {
      resume();
    } else {
      start();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Reset */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={reset}
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 flex-shrink-0"
        aria-label="Reset timer"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>

      {/* Primary action pill */}
      <motion.button
        type="button"
        onClick={handlePrimary}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "flex-1 h-10 rounded-full flex items-center justify-center gap-1.5 text-sm font-medium transition-colors",
          "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg shadow-violet-500/20",
        )}
      >
        <Icon className="w-4 h-4" />
        {label}
      </motion.button>

      {/* Settings */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onOpenSettings}
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 flex-shrink-0"
        aria-label="Timer settings"
      >
        <SettingsIcon className="w-4 h-4" />
      </Button>
    </div>
  );
}
