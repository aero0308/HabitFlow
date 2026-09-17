"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Archive, ArchiveRestore, Trash2, Pencil, Flame, Target, Tag, Sparkles, Package } from "lucide-react";
import { ReorderModeToggle } from "@/features/habits/ReorderModeToggle";
import { StarterPacksPicker } from "@/features/habits/StarterPacksPicker";
import { format, parseISO } from "date-fns";
import { useHabits, useCategories, useCreateHabit, useUpdateHabit, useDeleteHabit, useArchiveHabit, useReorderHabits } from "@/hooks/use-habits";
import { TemplatePicker } from "@/features/habits/template-picker";
import { TimeOfDaySelector } from "@/features/habits/TimeOfDaySelector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { useNav } from "@/lib/nav-store";
import { toast } from "sonner";

const COLORS = ["#10b981", "#0ea5e9", "#8b5cf6", "#ec4899", "#f59e0b", "#ef4444", "#14b8a6", "#6366f1", "#f97316", "#84cc16"];
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
  timeOfDay: "ANY_TIME" | "MORNING" | "AFTERNOON" | "EVENING";
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    color: COLORS[0],
    icon: ICONS[0],
    frequency: "daily",
    customDays: [],
    targetCount: 1,
    startDate: format(new Date(), "yyyy-MM-dd"),
    category: "",
    timeOfDay: "ANY_TIME",
  };
}

export function HabitsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const categoryFilter = showArchived ? undefined : selectedCategory === "all" ? undefined : selectedCategory;
  const { data: habits, isLoading } = useHabits(showArchived, categoryFilter);
  const { data: categories } = useCategories();
  const createMut = useCreateHabit();
  const updateMut = useUpdateHabit();
  const deleteMut = useDeleteHabit();
  const archiveMut = useArchiveHabit();
  const reorderMut = useReorderHabits();
  const { go } = useNav();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [starterPacksOpen, setStarterPacksOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Mobile reorder mode state
  const [reorderMode, setReorderMode] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // The list to render: in mobile reorder mode, use the local working copy
  // (mapped back to full habit objects); otherwise use server data as-is.
  const serverHabits = habits ?? [];
  const habitsMap = useMemo(
    () => new Map(serverHabits.map((h) => [h.id, h])),
    [serverHabits],
  );
  const displayList = useMemo(() => {
    if (reorderMode && localOrder.length > 0) {
      return localOrder
        .map((id) => habitsMap.get(id))
        .filter((h): h is NonNullable<typeof h> => h !== undefined);
    }
    return serverHabits;
  }, [reorderMode, localOrder, habitsMap, serverHabits]);

  const enterReorderMode = useCallback(() => {
    setLocalOrder(serverHabits.map((h) => h.id));
    setReorderMode(true);
  }, [serverHabits]);

  const exitReorderMode = useCallback(() => {
    setReorderMode(false);
    setLocalOrder([]);
  }, []);

  const saveReorder = useCallback(() => {
    reorderMut.mutate(localOrder, {
      onSuccess: () => {
        toast.success("Order saved");
        exitReorderMode();
      },
      onError: () => {
        toast.error("Could not save order");
      },
    });
  }, [localOrder, reorderMut, exitReorderMode]);

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(h: typeof habits extends (infer T)[] | undefined ? T : never) {
    if (!h) return;
    setForm({
      name: h.name,
      description: h.description,
      color: h.color,
      icon: h.icon,
      frequency: h.frequency,
      customDays: h.customDays,
      targetCount: h.targetCount,
      startDate: h.startDate,
      category: h.category,
      timeOfDay: h.timeOfDay ?? "ANY_TIME",
    });
    setEditingId(h.id);
    setDialogOpen(true);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = displayList;
    const oldIdx = list.findIndex((h) => h.id === active.id);
    const newIdx = list.findIndex((h) => h.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(list, oldIdx, newIdx);
    if (reorderMode) {
      // Mobile reorder mode: update local working copy only
      setLocalOrder(next.map((h) => h.id));
    } else {
      // Desktop: persist immediately
      reorderMut.mutate(next.map((h) => h.id));
    }
  }

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
    if (editingId) {
      updateMut.mutate({ id: editingId, input: payload }, { onSettled: () => setDialogOpen(false) });
    } else {
      createMut.mutate(payload, { onSettled: () => setDialogOpen(false) });
    }
  }

  const activeCount = (habits ?? []).filter((h) => !h.isArchived).length;
  const archivedCount = (habits ?? []).filter((h) => h.isArchived).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Habits</h1>
          <p className="text-sm text-muted-foreground hidden md:block">
            Drag to reorder, click to view details.
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ReorderModeToggle
            active={reorderMode}
            onActivate={enterReorderMode}
            onSave={saveReorder}
            onCancel={exitReorderMode}
            saving={reorderMut.isPending}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStarterPacksOpen(true)}
            className="bg-gradient-to-r from-violet-500/10 to-violet-500/5 border-violet-500/30 hover:border-violet-500/50 text-violet-700 dark:text-violet-300"
          >
            <Package className="w-4 h-4 mr-1" /> Packs
          </Button>
          <Button variant="outline" onClick={() => setTemplateOpen(true)} size="sm">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Quick
          </Button>
          <Button onClick={openCreate} size="sm" className="hidden sm:inline-flex">
            <Plus className="w-4 h-4 mr-1" /> New habit
          </Button>
        </div>
      </div>

      <StarterPacksPicker open={starterPacksOpen} onClose={() => setStarterPacksOpen(false)} />

      <TemplatePicker open={templateOpen} onOpenChange={setTemplateOpen} onCreateCustom={() => { setTemplateOpen(false); openCreate(); }} />

      <div className="flex items-center justify-between gap-2">
        <Tabs value={showArchived ? "archived" : "active"} onValueChange={(v) => setShowArchived(v === "archived")}>
          <TabsList>
            <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={openCreate} size="sm" className="sm:hidden h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>

      {!showArchived && (
        <div className="flex items-center gap-2 mb-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue placeholder="All categories">
                {selectedCategory === "all" ? "All categories" : selectedCategory}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-[11px] py-0.5 px-2 tabular-nums">
            {(habits ?? []).length} habit{(habits ?? []).length === 1 ? "" : "s"}
          </Badge>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (habits ?? []).length === 0 ? (
        <Card className="p-6 sm:p-8 text-center">
          {showArchived ? (
            <>
              <p className="text-muted-foreground mb-3">No archived habits.</p>
              <Button onClick={() => setShowArchived(false)} variant="outline">
                Back to active habits
              </Button>
            </>
          ) : (
            <>
              <div
                className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mb-4 bg-gradient-to-br from-violet-500/20 to-violet-500/5 ring-1 ring-violet-500/30"
                aria-hidden
              >
                <Package className="w-7 h-7 sm:w-8 sm:h-8 text-violet-500" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-1">Start with a pack</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                Install a bundle of 5 daily habits in one click — morning routine, fitness,
                deep work, and more. You can edit or remove any habit afterwards.
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  onClick={() => setStarterPacksOpen(true)}
                  className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-500 hover:to-violet-700 text-white"
                >
                  <Package className="w-4 h-4 mr-1" /> Browse starter packs
                </Button>
                <Button variant="outline" onClick={() => setTemplateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Quick start
                </Button>
              </div>
            </>
          )}
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={displayList.map((h) => h.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {displayList.map((h) => (
                <SortableHabitRow
                  key={h.id}
                  habit={h}
                  archived={showArchived}
                  reorderMode={reorderMode}
                  onEdit={() => openEdit(h)}
                  onArchive={() => archiveMut.mutate({ id: h.id, archived: !h.isArchived })}
                  onDelete={() => setDeleteId(h.id)}
                  onClick={() => go({ name: "habit", id: h.id })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit habit" : "Create habit"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update your habit details." : "Define a new habit to track."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1 px-1">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="e.g. Drink water" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea id="desc" placeholder="Why this habit matters..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={2} />
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
                      className={cn("aspect-square rounded-md text-lg flex items-center justify-center transition-all", form.icon === ic ? "bg-emerald-500/20 ring-2 ring-emerald-500" : "hover:bg-muted")}
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
                      className={cn("aspect-square rounded-md transition-all", form.color === c && "ring-2 ring-offset-2 ring-offset-background ring-foreground")}
                      style={{ backgroundColor: c }}
                      aria-label={`color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Tabs value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as "daily" | "weekly" | "custom" })}>
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
                            customDays: on ? form.customDays.filter((x) => x !== i) : [...form.customDays, i].sort(),
                          })
                        }
                        className={cn(
                          "flex-1 py-2 rounded-md text-xs font-medium transition-colors",
                          on ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              )}
              {form.frequency === "weekly" && (
                <p className="text-xs text-muted-foreground mt-1">Repeats on the same weekday as the start date.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target">Target per day</Label>
                <Input id="target" type="number" min={1} max={100} value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: Math.max(1, Number(e.target.value) || 1) })} className="h-10" />
                <p className="text-xs text-muted-foreground">e.g. 8 glasses of water</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start date</Label>
                <Input id="start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category (optional)</Label>
              <Input
                id="category"
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
              <TimeOfDaySelector value={form.timeOfDay} onChange={(v) => setForm({ ...form, timeOfDay: v })} />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending} className="w-full sm:w-auto">
              {editingId ? "Save changes" : "Create habit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this habit?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the habit and all its check-ins. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMut.mutate(deleteId);
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

function SortableHabitRow({
  habit,
  archived,
  reorderMode,
  onEdit,
  onArchive,
  onDelete,
  onClick,
}: {
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
    isArchived: boolean;
    category: string;
    timeOfDay: "ANY_TIME" | "MORNING" | "AFTERNOON" | "EVENING";
    streak: { currentStreak: number; longestStreak: number; totalCompletions: number } | null;
  };
  archived: boolean;
  reorderMode: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const freqLabel =
    habit.frequency === "daily"
      ? "Every day"
      : habit.frequency === "weekly"
        ? "Weekly"
        : `Custom · ${habit.customDays.map((d) => WEEKDAY_LABELS[d]).join(", ")}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border bg-card p-3 sm:p-4 transition-shadow group",
        isDragging && "shadow-xl ring-2 ring-violet-500/30 opacity-80",
        habit.isArchived && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Drag handle — always visible on desktop; on mobile only in reorder mode */}
        {!archived && (
          <button
            {...attributes}
            {...listeners}
            className={cn(
              "cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none p-0.5 flex-shrink-0",
              reorderMode ? "flex md:flex" : "hidden md:block",
            )}
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onClick}
          disabled={reorderMode}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-lg sm:text-xl flex-shrink-0 transition-transform group-hover:scale-105"
          style={{ backgroundColor: habit.color + "20" }}
          aria-label={habit.name}
        >
          {habit.icon}
        </button>
        <button
          onClick={onClick}
          disabled={reorderMode}
          className="flex-1 min-w-0 text-left"
        >
          <div className="font-medium text-sm truncate">{habit.name}</div>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-[9px] sm:text-[10px] py-0 px-1.5 h-4 font-normal">
              {freqLabel}
            </Badge>
            {habit.category && (
              <Badge variant="outline" className="text-[9px] sm:text-[10px] py-0 px-1.5 h-4 gap-0.5 font-normal max-w-[80px] sm:max-w-[120px]">
                <Tag className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{habit.category}</span>
              </Badge>
            )}
            {habit.timeOfDay && habit.timeOfDay !== "ANY_TIME" && (
              <Badge variant="outline" className="text-[9px] sm:text-[10px] py-0 px-1.5 h-4 gap-0.5 font-normal">
                {habit.timeOfDay === "MORNING" ? "🌅" : habit.timeOfDay === "AFTERNOON" ? "☀️" : "🌙"}
                <span className="hidden sm:inline">
                  {habit.timeOfDay === "MORNING" ? "Morning" : habit.timeOfDay === "AFTERNOON" ? "Afternoon" : "Evening"}
                </span>
              </Badge>
            )}
            {habit.targetCount > 1 && (
              <Badge variant="secondary" className="text-[9px] sm:text-[10px] py-0 px-1.5 h-4 gap-0.5">
                <Target className="w-2.5 h-2.5" />
                {habit.targetCount}/day
              </Badge>
            )}
            {habit.streak && habit.streak.currentStreak > 0 && (
              <Badge variant="secondary" className="text-[9px] sm:text-[10px] py-0 px-1.5 h-4 gap-0.5">
                <Flame className="w-2.5 h-2.5 text-orange-500" />
                {habit.streak.currentStreak}d
              </Badge>
            )}
            {habit.streak && habit.streak.longestStreak > 0 && (
              <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">Best: {habit.streak.longestStreak}d</span>
            )}
          </div>
        </button>
        {/* Action buttons — hidden on mobile in reorder mode */}
        <div className={cn("items-center gap-0.5 sm:gap-1 flex-shrink-0", reorderMode ? "hidden md:flex" : "flex")}>
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={onEdit} aria-label="Edit">
            <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={onArchive} aria-label={archived ? "Unarchive" : "Archive"}>
            {archived ? <ArchiveRestore className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive" onClick={onDelete} aria-label="Delete">
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
