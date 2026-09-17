"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { format, differenceInCalendarDays, parseISO, isAfter } from "date-fns";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { OffMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

function fmtRange(start: string, end: string): string {
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    if (s.toDateString() === e.toDateString()) {
      return format(s, "MMM d, yyyy");
    }
    if (s.getFullYear() === e.getFullYear()) {
      return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    }
    return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
  } catch {
    return `${start} → ${end}`;
  }
}

function daysRemaining(endDate: string): number {
  try {
    const e = parseISO(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isAfter(today, e)) return 0;
    return differenceInCalendarDays(e, today) + 1;
  } catch {
    return 0;
  }
}

function OffModeCard({
  offMode,
  onDelete,
  deleting,
}: {
  offMode: OffMode;
  onDelete: () => void;
  deleting: boolean;
}) {
  const totalDays = (() => {
    try {
      return differenceInCalendarDays(parseISO(offMode.endDate), parseISO(offMode.startDate)) + 1;
    } catch {
      return 0;
    }
  })();
  const remaining = daysRemaining(offMode.endDate);

  return (
    <Card className="p-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {fmtRange(offMode.startDate, offMode.endDate)}
          </div>
          {offMode.reason && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {offMode.reason}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            {totalDays} day{totalDays === 1 ? "" : "s"} ·{" "}
            {remaining > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                {remaining} day{remaining === 1 ? "" : "s"} remaining
              </span>
            ) : (
              <span className="text-muted-foreground">Ended</span>
            )}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={deleting}
        aria-label="Delete off mode"
        className="text-muted-foreground hover:text-destructive shrink-0"
      >
        {deleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </Button>
    </Card>
  );
}

export function OffModePage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OffMode | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["off-modes"],
    queryFn: () => api.listOffModes(),
  });

  const offModes = data?.offModes ?? [];

  const createMut = useMutation({
    mutationFn: () =>
      api.createOffMode({
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["off-modes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Off mode added", {
        description: fmtRange(startDate, endDate),
      });
      setCreateOpen(false);
      setStartDate("");
      setEndDate("");
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteOffMode(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["off-modes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Off mode removed");
      if (deleteTarget?.id === id) setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCreate() {
    if (!startDate || !endDate) {
      toast.error("Please choose both a start and end date");
      return;
    }
    if (startDate > endDate) {
      toast.error("End date must be on or after the start date");
      return;
    }
    createMut.mutate();
  }

  function openCreate() {
    // Default to today + 3 days
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 3);
    setStartDate(format(today, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
    setReason("");
    setCreateOpen(true);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Off Mode</h1>
          <p className="text-sm text-muted-foreground">
            Take breaks without losing your streaks. Schedule off days for
            vacations, sick days, or whenever you need to pause.
          </p>
        </div>
        {offModes.length > 0 && (
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" /> Add New Off Mode
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : offModes.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-6xl mb-4" aria-hidden>
            🌴
          </div>
          <h2 className="text-lg font-semibold mb-1">No Off Days Set</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Take a break without losing your streaks. Add an off mode for
            vacations, sick days, or whenever you need to pause.
          </p>
          <Button variant="outline" onClick={openCreate} className="mx-auto">
            <Plus className="w-4 h-4 mr-2" /> Add New Off Mode
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {offModes
            .slice()
            .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
            .map((m) => (
              <OffModeCard
                key={m.id}
                offMode={m}
                deleting={deleteMut.isPending && deleteTarget?.id === m.id}
                onDelete={() => setDeleteTarget(m)}
              />
            ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => setCreateOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Off Mode</DialogTitle>
            <DialogDescription>
              Streaks will be preserved during this date range.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="off-start">Start date</Label>
                <Input
                  id="off-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="off-end">End date</Label>
                <Input
                  id="off-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="off-reason">Reason (optional)</Label>
              <Input
                id="off-reason"
                type="text"
                maxLength={200}
                placeholder="e.g. Vacation, sick leave…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-right">
                {reason.length}/200
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMut.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete off mode?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will remove the off mode for ${fmtRange(
                    deleteTarget.startDate,
                    deleteTarget.endDate,
                  )}. Streak protection for these dates will be lost.`
                : "This will remove the off mode."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteMut.mutate(deleteTarget.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
