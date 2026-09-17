"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type DialogKind = "delete-account" | "delete-data" | "reset-habit" | null;

interface RowProps {
  title: string;
  description: string;
  buttonLabel: string;
  onOpen: () => void;
}

function DangerRow({ title, description, buttonLabel, onOpen }: RowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4 border-b border-border last:border-b-0">
      <div className="pr-4 min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Button
        variant="outline"
        onClick={onOpen}
        className="border-red-400/30 text-red-400 hover:bg-red-500/5 hover:text-red-400 w-full sm:w-auto sm:shrink-0"
      >
        {buttonLabel}
      </Button>
    </div>
  );
}

export function DangerZone() {
  const qc = useQueryClient();
  const { logout } = useAuth();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [confirmText, setConfirmText] = useState("");

  function closeDialog() {
    setDialog(null);
    setConfirmText("");
  }

  const invalidateAll = async () => {
    // Wipe everything so no stale data lingers after destructive actions.
    await qc.invalidateQueries();
  };

  const deleteAccountMut = useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: async () => {
      toast.success("Account deleted", {
        description: "Sorry to see you go. Signing you out…",
      });
      await invalidateAll();
      // Auth context will handle the redirect.
      await logout();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDataMut = useMutation({
    mutationFn: () => api.deleteAllData(),
    onSuccess: async () => {
      toast.success("All data deleted", {
        description: "You're back to ground zero.",
      });
      await invalidateAll();
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetHabitMut = useMutation({
    mutationFn: () => api.resetHabitData(),
    onSuccess: async () => {
      toast.success("Habit progress reset", {
        description: "Streaks, completion rates, and notes were cleared.",
      });
      await invalidateAll();
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending =
    deleteAccountMut.isPending ||
    deleteDataMut.isPending ||
    resetHabitMut.isPending;

  const confirmMatched = confirmText.trim() === "DELETE";

  function handleDeleteAccount() {
    if (!confirmMatched) return;
    deleteAccountMut.mutate();
  }

  function handleDeleteData() {
    if (!confirmMatched) return;
    deleteDataMut.mutate();
  }

  function handleResetHabit() {
    resetHabitMut.mutate();
  }

  return (
    <div className="border-t border-border pt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400/80 mb-4">
        Caution Zone
      </h2>

      <DangerRow
        title="Delete Account"
        description="All of your habit data has been reset."
        buttonLabel="Delete Account"
        onOpen={() => setDialog("delete-account")}
      />
      <DangerRow
        title="Delete All Data"
        description="Delete all habit, all progress and go back to ground zero"
        buttonLabel="Delete Data"
        onOpen={() => setDialog("delete-data")}
      />
      <DangerRow
        title="Reset Habit Data"
        description="Remove all progress from your habit lists. No streaks, no completion rate, no notes."
        buttonLabel="Reset Habit Data"
        onOpen={() => setDialog("reset-habit")}
      />

      {/* Delete Account dialog — requires typing DELETE */}
      <AlertDialog
        open={dialog === "delete-account"}
        onOpenChange={(o) => (o ? setDialog("delete-account") : closeDialog())}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account and all associated habit
              data. This action cannot be undone. Type{" "}
              <span className="font-mono font-semibold text-red-400">
                DELETE
              </span>{" "}
              to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-account" className="sr-only">
              Type DELETE to confirm
            </Label>
            <Input
              id="confirm-account"
              autoFocus
              autoComplete="off"
              placeholder="Type DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isPending}
              className="border-red-400/30 focus-visible:ring-red-400/40"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={!confirmMatched || isPending}
              className="bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-400/40"
            >
              {deleteAccountMut.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Data dialog — requires typing DELETE */}
      <AlertDialog
        open={dialog === "delete-data"}
        onOpenChange={(o) => (o ? setDialog("delete-data") : closeDialog())}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This wipes every habit, check-in, streak, and note from your
              account. You&apos;ll start from ground zero. Your account itself
              stays. Type{" "}
              <span className="font-mono font-semibold text-red-400">
                DELETE
              </span>{" "}
              to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-data" className="sr-only">
              Type DELETE to confirm
            </Label>
            <Input
              id="confirm-data"
              autoFocus
              autoComplete="off"
              placeholder="Type DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isPending}
              className="border-red-400/30 focus-visible:ring-red-400/40"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteData}
              disabled={!confirmMatched || isPending}
              className="bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-400/40"
            >
              {deleteDataMut.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Habit Data dialog — simple yes/no */}
      <AlertDialog
        open={dialog === "reset-habit"}
        onOpenChange={(o) => (o ? setDialog("reset-habit") : closeDialog())}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset habit progress?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears all streaks, completion rates, and notes from your
              habit lists. Your habits themselves remain. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetHabit}
              disabled={isPending}
              className="bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-400/40"
            >
              {resetHabitMut.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Reset habit data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
