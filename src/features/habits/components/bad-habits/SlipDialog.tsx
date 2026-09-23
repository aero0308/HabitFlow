"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLogSlip } from "@/features/habits/hooks/useBadHabits";
import type { BadHabit } from "@/types/bad-habits";
import { toast } from "sonner";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface SlipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badHabit: BadHabit;
  /** Optional override: pre-set the slip date (defaults to today). */
  defaultDate?: string;
}

/**
 * Two-step non-judgmental slip logger.
 *
 * Step 1: heading "Log a slip" + supportive copy + date picker.
 * Step 2: trigger dropdown (from the bad habit's saved triggers + "Other") +
 * optional note "What was going on?".
 *
 * After saving: NO confetti. Toast: "Logged. Tomorrow is a fresh start. 💙".
 * If the user has slipped 3+ times in 7 days, the useLogSlip hook fires a soft
 * info toast suggesting a different approach.
 */
export function SlipDialog({ open, onOpenChange, badHabit, defaultDate }: SlipDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState<string>(defaultDate || todayStr());
  const [trigger, setTrigger] = useState<string>("");
  const [triggerOther, setTriggerOther] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const logMut = useLogSlip();

  function reset() {
    setStep(1);
    setDate(defaultDate || todayStr());
    setTrigger("");
    setTriggerOther("");
    setNote("");
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function save() {
    const finalTrigger =
      trigger === "__other" && triggerOther.trim()
        ? triggerOther.trim()
        : trigger && trigger !== "__other"
          ? trigger
          : null;

    logMut.mutate(
      {
        id: badHabit.id,
        input: {
          date,
          trigger: finalTrigger,
          note: note.trim() || null,
        },
      },
      {
        onSuccess: () => {
          close();
        },
        onError: () => {
          // toast handled by hook
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Log a slip" : "What was going on?"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Slipping is part of the process. Let's learn from it."
              : "Optional — capture the moment so you can spot patterns later."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slip-date">When did it happen?</Label>
              <Input
                id="slip-date"
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                You can backdate if you forgot to log a slip earlier.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slip-trigger">What triggered it?</Label>
              {badHabit.triggers.length > 0 ? (
                <Select value={trigger} onValueChange={setTrigger}>
                  <SelectTrigger id="slip-trigger">
                    <SelectValue placeholder="Pick a trigger (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {badHabit.triggers.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                    <SelectItem value="__other">+ Other…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="slip-trigger"
                  placeholder="e.g. stress, boredom, social event"
                  value={trigger === "__other" ? triggerOther : trigger}
                  onChange={(e) => {
                    setTrigger(e.target.value);
                    setTriggerOther(e.target.value);
                  }}
                />
              )}
              {trigger === "__other" && (
                <Input
                  className="mt-2"
                  placeholder="Describe the trigger…"
                  value={triggerOther}
                  onChange={(e) => setTriggerOther(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slip-note">Notes (optional)</Label>
              <Textarea
                id="slip-note"
                placeholder="What was going on? How were you feeling?"
                value={note}
                maxLength={500}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={close} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!date}
                className="w-full sm:w-auto"
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} className="w-full sm:w-auto">
                Back
              </Button>
              <Button
                onClick={save}
                disabled={logMut.isPending}
                className="w-full sm:w-auto"
              >
                {logMut.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
