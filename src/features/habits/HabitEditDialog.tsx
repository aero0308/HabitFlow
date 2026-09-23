"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  useUpdateHabit,
  useCategories,
} from "@/hooks/use-habits";
import { TimeOfDaySelector } from "@/features/habits/TimeOfDaySelector";
import { HabitSuggestDialog } from "@/features/habits/components/HabitSuggestDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TimeOfDay } from "@/types";

const COLORS = [
  "#10b981", "#0ea5e9", "#8b5cf6", "#ec4899", "#f59e0b",
  "#ef4444", "#14b8a6", "#6366f1", "#f97316", "#84cc16",
];
const ICONS = ["✅", "💧", "🏃", "📚", "🧘", "💪", "🥗", "😴", "✍️", "🎯", "🎨", "🎸", "💻", "🚭", "🙏", "🌱"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface FormState {
  name: string;
  description: string;
  color: string;
  icon: string;
  frequency: "daily" | "weekly" | "custom";
  customDays: number[];
  targetCount: number;
  startDate: string;
  category: string;
  timeOfDay: TimeOfDay;
}

interface HabitEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: {
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    frequency: string;
    customDays: number[];
    targetCount: number;
    startDate: string;
    category: string;
    timeOfDay: TimeOfDay;
  };
  /** When true, renders an AI-suggestions banner at the top + a "Suggest"
   *  ghost button in the footer. Use this when the dialog is opened in
   *  create-mode (new habit) so the user can let AI suggest habits. */
  isNew?: boolean;
}

/**
 * Self-contained edit dialog for a single habit.
 *
 * Used by the habit detail page so the user can edit the habit in-place
 * without navigating away to the habits list. Also reused for create-mode
 * when `isNew` is true — in which case the AI suggestions banner appears
 * at the top of the dialog.
 */
export function HabitEditDialog({ open, onOpenChange, habit, isNew = false }: HabitEditDialogProps) {
  const { data: categories } = useCategories();
  const updateMut = useUpdateHabit();
  const [suggestOpen, setSuggestOpen] = useState(false);

  const [form, setForm] = useState<FormState>(() => ({
    name: habit.name,
    description: habit.description,
    color: habit.color,
    icon: habit.icon,
    frequency: (habit.frequency as FormState["frequency"]) || "daily",
    customDays: habit.customDays ?? [],
    targetCount: habit.targetCount,
    startDate: habit.startDate,
    category: habit.category ?? "",
    timeOfDay: habit.timeOfDay ?? "ANY_TIME",
  }));

  function submit() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (form.frequency === "custom" && form.customDays.length === 0) {
      toast.error("Select at least one day for custom frequency");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
      icon: form.icon,
      frequency: form.frequency,
      customDays: form.frequency === "custom" ? form.customDays : [],
      targetCount: form.targetCount,
      startDate: form.startDate,
      category: form.category.trim(),
      timeOfDay: form.timeOfDay,
    };
    updateMut.mutate(
      { id: habit.id, input: payload },
      {
        onSettled: () => {
          onOpenChange(false);
          toast.success("Habit updated");
        },
      },
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit habit</DialogTitle>
          <DialogDescription>Update your habit details.</DialogDescription>
        </DialogHeader>

        {/* AI suggestions banner — only when creating a NEW habit */}
        {isNew && (
          <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0" />
              <p className="text-sm text-foreground/90 truncate">
                Let AI suggest habits for your goal
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSuggestOpen(true)}
              className="border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 flex-shrink-0"
            >
              Try it <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}

        <div className="space-y-4 py-1 px-1">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              placeholder="e.g. Drink water"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={100}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Description (optional)</Label>
            <Textarea
              id="edit-desc"
              placeholder="Why this habit matters..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={500}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 sm:gap-1">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setForm({ ...form, icon: ic })}
                    className={cn(
                      "aspect-square rounded-md text-lg flex items-center justify-center transition-all",
                      form.icon === ic
                        ? "bg-emerald-500/20 ring-2 ring-emerald-500"
                        : "hover:bg-muted",
                    )}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      "aspect-square rounded-md transition-all",
                      form.color === c &&
                        "ring-2 ring-offset-2 ring-offset-background ring-foreground",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frequency</Label>
            <Tabs
              value={form.frequency}
              onValueChange={(v) =>
                setForm({ ...form, frequency: v as FormState["frequency"] })
              }
            >
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="daily" className="text-xs sm:text-sm">Daily</TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs sm:text-sm">Weekly</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs sm:text-sm">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
            {form.frequency === "custom" && (
              <div className="flex gap-1 mt-2">
                {WEEKDAY_LABELS.map((d, i) => {
                  const on = form.customDays.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          customDays: on
                            ? form.customDays.filter((x) => x !== i)
                            : [...form.customDays, i].sort(),
                        })
                      }
                      className={cn(
                        "flex-1 py-2 rounded-md text-xs font-medium transition-colors",
                        on
                          ? "bg-emerald-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/70",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
            {form.frequency === "weekly" && (
              <p className="text-xs text-muted-foreground mt-1">
                Repeats on the same weekday as the start date.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-target">Target per day</Label>
              <Input
                id="edit-target"
                type="number"
                min={1}
                max={100}
                value={form.targetCount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    targetCount: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">e.g. 8 glasses of water</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-start">Start date</Label>
              <Input
                id="edit-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-category">Category (optional)</Label>
            <Input
              id="edit-category"
              placeholder="Health, Work, Learning..."
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              maxLength={40}
              className="h-10"
            />
            {categories && categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {categories
                  .filter((c) => c && c !== form.category)
                  .slice(0, 8)
                  .map((c) => (
                    <Badge
                      key={c}
                      variant="outline"
                      asChild
                      className="text-[11px] py-0.5 px-2 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    >
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, category: c })}
                      >
                        {c}
                      </button>
                    </Badge>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Time of day</Label>
            <TimeOfDaySelector
              value={form.timeOfDay}
              onChange={(v) => setForm({ ...form, timeOfDay: v })}
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          {isNew && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuggestOpen(true)}
              className="text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 mr-auto"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Suggest
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={submit} disabled={updateMut.isPending} className="w-full sm:w-auto">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* AI habit-suggestions dialog — opened from the banner / Suggest button.
          Mounted as a sibling (NOT nested) so it renders above the edit dialog. */}
      <HabitSuggestDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        onSkipToManual={() => {
          // Close the suggest dialog; let the user continue in the parent dialog.
          setSuggestOpen(false);
        }}
      />
    </>
  );
}
