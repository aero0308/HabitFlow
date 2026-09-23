"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Link2Off, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface BadHabitEmptyStateProps {
  onStart: () => void;
}

/**
 * Empty-state for the Break tab when the user has no bad habits tracked yet.
 * Tone: inviting, supportive — no shaming.
 */
export function BadHabitEmptyState({ onStart }: BadHabitEmptyStateProps) {
  const reduce = useReducedMotion();
  return (
    <Card className="p-6 sm:p-10 text-center border-dashed">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-4"
      >
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br from-rose-500/15 to-amber-500/10 ring-1 ring-rose-500/30"
          aria-hidden
        >
          <Link2Off className="w-8 h-8 text-rose-500 dark:text-rose-400" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-semibold">No bad habits tracked yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Break a habit and start your clean streak today. We&apos;ll count your
            money saved, time reclaimed, and milestones along the way — no shaming,
            just support.
          </p>
        </div>
        <Button
          onClick={onStart}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
        >
          <Plus className="w-4 h-4 mr-1" /> Start breaking a habit
        </Button>
      </motion.div>
    </Card>
  );
}
