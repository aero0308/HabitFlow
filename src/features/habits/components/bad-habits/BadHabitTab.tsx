"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBadHabits, useArchiveBadHabit } from "@/features/habits/hooks/useBadHabits";
import { useNav } from "@/lib/nav-store";
import { BadHabitCard } from "./BadHabitCard";
import { BadHabitEmptyState } from "./BadHabitEmptyState";
import { CreateBadHabitDialog } from "./CreateBadHabitDialog";
import { SlipDialog } from "./SlipDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * The full "Break habits" tab content — header with "+ New bad habit" button,
 * list of BadHabitCard rows (loading skeletons while fetching), empty state if
 * none, slip dialog when the user clicks "I slipped".
 */
export function BadHabitTab() {
  const { data: badHabits, isLoading } = useBadHabits(false);
  const archiveMut = useArchiveBadHabit();
  const { go } = useNav();

  const [createOpen, setCreateOpen] = useState(false);
  const [slipTarget, setSlipTarget] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const list = badHabits ?? [];

  function handleArchive(id: string) {
    archiveMut.mutate(id, {
      onSuccess: () => {
        toast.success("Bad habit archived");
      },
    });
  }

  function handleDelete(id: string) {
    // We reuse the archive path as soft-delete.
    archiveMut.mutate(id, {
      onSuccess: () => {
        toast.success("Bad habit deleted");
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Bad habits</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Track habits you want to quit. Success = not doing the thing.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
        >
          <Plus className="w-4 h-4 mr-1" /> New bad habit
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <BadHabitEmptyState onStart={() => setCreateOpen(true)} />
      ) : (
        <div className="space-y-2">
          {list.map((bh, i) => (
            <BadHabitCard
              key={bh.id}
              badHabit={bh}
              index={i}
              onClick={() => go({ name: "bad-habit", id: bh.id })}
              onEdit={() => {
                toast.info("Edit coming soon — for now, please delete and recreate.");
              }}
              onArchive={() => handleArchive(bh.id)}
              onDelete={() => setDeleteId(bh.id)}
              onLogSlip={() => setSlipTarget(bh.id)}
            />
          ))}
        </div>
      )}

      <CreateBadHabitDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Slip dialog */}
      {slipTarget && (
        (() => {
          const bh = list.find((x) => x.id === slipTarget);
          if (!bh) return null;
          return (
            <SlipDialog
              open={!!slipTarget}
              onOpenChange={(o) => !o && setSlipTarget(null)}
              badHabit={bh}
            />
          );
        })()
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bad habit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the bad habit and its slips. Your milestones will
              still be kept in your history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) handleDelete(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
