"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Flame, MoreHorizontal, Pencil, Archive, Trash2, Droplet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { BadHabit } from "@/types/bad-habits";

interface BadHabitCardProps {
  badHabit: BadHabit;
  onClick: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onLogSlip: () => void;
  index?: number;
}

/**
 * A row card showing a single bad habit's clean streak, money saved, next
 * milestone progress, and a kebab menu with Edit/Archive/Delete + "I slipped".
 *
 * - Click anywhere → navigate to detail.
 * - Hover → subtle bg tint (hover:bg-muted/50).
 * - Uses emerald for "good" progress, amber for the slip action.
 */
export function BadHabitCard({
  badHabit,
  onClick,
  onEdit,
  onArchive,
  onDelete,
  onLogSlip,
  index = 0,
}: BadHabitCardProps) {
  const reduce = useReducedMotion();
  const moneySaved = badHabit.moneySaved;
  const timeSaved = badHabit.timeSaved;
  const next = badHabit.nextMilestone;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.25 }}
    >
      <Card
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="p-3 sm:p-4 cursor-pointer hover:bg-muted/40 transition-colors group border-border"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 transition-transform group-hover:scale-105"
            style={{ backgroundColor: badHabit.color + "20" }}
            aria-hidden
          >
            {badHabit.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm sm:text-base truncate">
              {badHabit.name}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Flame className="w-3 h-3" />
                {badHabit.cleanStreak} {badHabit.cleanStreak === 1 ? "day" : "days"} clean
              </span>
              {moneySaved && (
                <span className="text-muted-foreground">
                  💰 {moneySaved.formatted} saved
                </span>
              )}
              {timeSaved && (
                <span className="text-muted-foreground">
                  ⏱ {timeSaved.formatted} reclaimed
                </span>
              )}
              {next && next.daysRemaining > 0 && (
                <span className="text-muted-foreground">
                  🎯 {next.label}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  aria-label="More actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogSlip();
                  }}
                >
                  <Droplet className="w-3.5 h-3.5 mr-2 text-amber-500" /> I slipped
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive();
                  }}
                >
                  <Archive className="w-3.5 h-3.5 mr-2" /> Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-rose-600 dark:text-rose-300 focus:text-rose-700 dark:focus:text-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {next && next.daysRemaining > 0 && (
          <div className="mt-3 pl-0">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>{next.label}</span>
              <span className="tabular-nums">{next.daysRemaining} {next.daysRemaining === 1 ? "day" : "days"} to go</span>
            </div>
            <Progress value={next.progressPct} className="h-1.5" />
          </div>
        )}
      </Card>
    </motion.div>
  );
}
