"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHabits } from "@/hooks/use-habits";
import { useCreateBadHabit, useUpdateBadHabit } from "@/features/habits/hooks/useBadHabits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

interface IconOption {
  key: string;
  emoji: string;
}

const ICONS: IconOption[] = [
  { key: "🚬", emoji: "🚬" }, // smoking
  { key: "📱", emoji: "📱" }, // smartphone (doomscrolling)
  { key: "🍺", emoji: "🍺" }, // beer
  { key: "🍕", emoji: "🍕" }, // pizza (junk food)
  { key: "🎮", emoji: "🎮" }, // gamepad (gaming)
  { key: "☕", emoji: "☕" }, // coffee
  { key: "💳", emoji: "💳" }, // credit card (spending)
  { key: "📺", emoji: "📺" }, // tv
  { key: "🛒", emoji: "🛒" }, // shopping
  { key: "💊", emoji: "💊" }, // pills
  { key: "🥤", emoji: "🥤" }, // soda
  { key: "🍫", emoji: "🍫" }, // chocolate/sweets
];

const TRIGGER_PRESETS = [
  "Stress",
  "Boredom",
  "After meals",
  "Social events",
  "Late nights",
  "Work breaks",
  "Alone time",
  "Anxiety",
];

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CreateBadHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When editing, pass the existing values to pre-fill the form. */
  initial?: {
    id: string;
    name: string;
    icon: string;
    color: string;
    quitDate: string;
    reason: string;
    triggers: string[];
    costPerDay: number | null;
    currency: string;
    minutesPerDay: number | null;
    replacementHabitId: string | null;
  };
}

const STEPS = ["What are you quitting?", "Your why", "Motivators"] as const;

/**
 * 3-step modal for creating/editing a bad habit. The form state is owned by
 * an inner `FormBody` component that remounts (via React `key`) whenever the
 * dialog opens — this means each open starts with a fresh useState
 * initialiser that reads from `initial`, with NO useEffect-driven reset
 * (which would otherwise trip the set-state-in-effect lint rule).
 */
export function CreateBadHabitDialog({
  open,
  onOpenChange,
  initial,
}: CreateBadHabitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <FormBody
          key={open ? "open" : "closed"}
          initial={initial}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  initial,
  onClose,
}: {
  initial?: CreateBadHabitDialogProps["initial"];
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const isEditing = !!initial;
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Step 1
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? ICONS[0].key);
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);

  // Step 2
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [triggers, setTriggers] = useState<string[]>(initial?.triggers ?? []);
  const [customTrigger, setCustomTrigger] = useState("");
  const [quitDate, setQuitDate] = useState(initial?.quitDate ?? todayStr());

  // Step 3
  const [costPerDay, setCostPerDay] = useState<string>(
    initial?.costPerDay != null ? String(initial.costPerDay) : "",
  );
  const [currency, setCurrency] = useState<string>(initial?.currency ?? "USD");
  const [minutesPerDay, setMinutesPerDay] = useState<string>(
    initial?.minutesPerDay != null ? String(initial.minutesPerDay) : "",
  );
  const [replacementHabitId, setReplacementHabitId] = useState<string>(
    initial?.replacementHabitId ?? "none",
  );

  const { data: habits } = useHabits(false);
  const createMut = useCreateBadHabit();
  const updateMut = useUpdateBadHabit();

  function toggleTrigger(t: string) {
    setTriggers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function addCustomTrigger() {
    const t = customTrigger.trim();
    if (!t) return;
    if (!triggers.includes(t)) {
      setTriggers((prev) => [...prev, t]);
    }
    setCustomTrigger("");
  }

  function nextStep() {
    if (step === 0) {
      if (!name.trim()) {
        toast.error("Give your habit a name first");
        return;
      }
      if (!icon || !color) {
        toast.error("Pick an icon and color");
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!quitDate) {
        toast.error("Pick a quit date");
        return;
      }
      setStep(2);
    }
  }

  function back() {
    if (step === 0) return;
    setStep((s) => (s - 1) as 0 | 1 | 2);
  }

  function submit() {
    if (!name.trim() || !icon || !color || !quitDate) {
      toast.error("Please complete the form");
      return;
    }
    const payload = {
      name: name.trim(),
      icon,
      color,
      quitDate,
      reason: reason.trim() || undefined,
      triggers,
      costPerDay: costPerDay ? Number(costPerDay) : undefined,
      currency,
      minutesPerDay: minutesPerDay ? Number(minutesPerDay) : undefined,
      replacementHabitId: replacementHabitId === "none" ? null : replacementHabitId,
    };

    if (isEditing && initial) {
      updateMut.mutate(
        { id: initial.id, input: payload },
        { onSuccess: () => onClose() },
      );
      return;
    }

    createMut.mutate(payload, {
      onSuccess: () => onClose(),
    });
  }

  const canNext = step === 0 ? !!name.trim() : step === 1 ? !!quitDate : true;
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Edit bad habit" : "Break a bad habit"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Update the details below."
            : "Track a habit you want to quit. We'll count your clean streak — no shaming, just support."}
        </DialogDescription>
      </DialogHeader>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-4">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className="flex-1">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  i <= step ? "bg-emerald-500" : "bg-muted",
                )}
              />
              <div
                className={cn(
                  "text-[10px] mt-1 truncate",
                  i === step
                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="bh-name">Name</Label>
            <Input
              id="bh-name"
              placeholder="e.g. Smoking, Doomscrolling, Junk food"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-1.5">
              {ICONS.map((ic) => (
                <button
                  key={ic.key}
                  type="button"
                  onClick={() => setIcon(ic.key)}
                  className={cn(
                    "aspect-square rounded-md text-xl flex items-center justify-center transition-all",
                    icon === ic.key
                      ? "bg-emerald-500/20 ring-2 ring-emerald-500"
                      : "hover:bg-muted",
                  )}
                  aria-label={`Icon ${ic.key}`}
                  aria-pressed={icon === ic.key}
                >
                  {ic.emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "aspect-square rounded-md transition-all",
                    color === c && "ring-2 ring-offset-2 ring-offset-background ring-foreground",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="bh-reason">Why are you quitting?</Label>
            <Textarea
              id="bh-reason"
              placeholder="For my health, for my kids, to save money..."
              value={reason}
              maxLength={500}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Optional — but a strong &quot;why&quot; makes a big difference.</p>
          </div>
          <div className="space-y-2">
            <Label>Triggers (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {TRIGGER_PRESETS.map((t) => {
                const on = triggers.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTrigger(t)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                      on
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                        : "bg-background border-border text-muted-foreground hover:bg-muted",
                    )}
                    aria-pressed={on}
                  >
                    {on && <Check className="w-3 h-3 inline mr-1" />}{t}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="+ custom trigger"
                value={customTrigger}
                maxLength={40}
                onChange={(e) => setCustomTrigger(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTrigger();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomTrigger}
                disabled={!customTrigger.trim()}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bh-quit">Quit date</Label>
            <Input
              id="bh-quit"
              type="date"
              value={quitDate}
              max={todayStr()}
              onChange={(e) => setQuitDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Default to today. You can backdate if you started quitting earlier.
            </p>
          </div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bh-cost">Cost per day</Label>
              <Input
                id="bh-cost"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 8"
                value={costPerDay}
                onChange={(e) => setCostPerDay(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">How much do you spend on this per day?</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bh-currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="bh-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bh-min">Time per day (minutes)</Label>
            <Input
              id="bh-min"
              type="number"
              min={0}
              max={1440}
              placeholder="e.g. 45"
              value={minutesPerDay}
              onChange={(e) => setMinutesPerDay(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">How much time do you spend on this daily?</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bh-replacement">Replacement habit (optional)</Label>
            <Select value={replacementHabitId} onValueChange={setReplacementHabitId}>
              <SelectTrigger id="bh-replacement">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(habits ?? []).map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.icon} {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">When the urge hits, do this instead.</p>
          </div>
        </motion.div>
      )}

      <DialogFooter className="pt-2 gap-2">
        {step > 0 && (
          <Button variant="ghost" onClick={back} className="mr-auto">
            Back
          </Button>
        )}
        {step < 2 ? (
          <Button onClick={nextStep} disabled={!canNext}>
            Next
          </Button>
        ) : (
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Saving…" : isEditing ? "Save changes" : "Start clean streak"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
