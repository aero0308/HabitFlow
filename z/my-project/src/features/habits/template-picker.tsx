"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCreateHabit } from "@/hooks/use-habits";
import {
  HABIT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateToInput,
  type HabitTemplate,
} from "@/lib/habit-templates";

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreateCustom: () => void;
}

function frequencyLabel(t: HabitTemplate): string {
  if (t.targetCount > 1) return `${t.targetCount}/day`;
  if (t.frequency === "daily") return "Daily";
  if (t.frequency === "weekly") return "Weekly";
  if (t.frequency === "custom") {
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (t.customDays.length === 0) return "Custom";
    return t.customDays.map((d) => DAYS[d]).join(", ");
  }
  return t.frequency;
}

export function TemplatePicker({ open, onOpenChange, onCreateCustom }: TemplatePickerProps) {
  const [category, setCategory] = useState<string>("All");
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const createMut = useCreateHabit();

  const filtered = useMemo(() => {
    if (category === "All") return HABIT_TEMPLATES;
    return HABIT_TEMPLATES.filter((t) => t.category === category);
  }, [category]);

  function addTemplate(t: HabitTemplate) {
    if (creatingId || createMut.isPending) return;
    setCreatingId(t.id);
    createMut.mutate(templateToInput(t), {
      onSuccess: () => {
        toast.success(`Habit added: ${t.name}`);
        setCreatingId(null);
        onOpenChange(false);
      },
      onError: () => {
        setCreatingId(null);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-6 pb-3 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Quick start
          </DialogTitle>
          <DialogDescription>
            Pick from popular habits or create your own.
          </DialogDescription>
        </DialogHeader>

        {/* Category filter — horizontal scroll on mobile so all categories stay on one line */}
        <div className="px-4 sm:px-6 pb-3">
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="w-full flex-nowrap overflow-x-auto h-auto p-1 gap-1 justify-start sm:justify-start">
              {TEMPLATE_CATEGORIES.map((c) => (
                <TabsTrigger
                  key={c}
                  value={c}
                  className="text-xs h-7 px-2.5 whitespace-nowrap data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300"
                >
                  {c}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Template grid */}
        <div className="px-4 sm:px-6 pb-2 min-h-0">
          <div className="max-h-[60vh] overflow-y-auto custom-scroll pr-1 -mr-1">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={category}
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.025 } },
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pb-2"
              >
                {filtered.map((t) => {
                  const isLoading = creatingId === t.id;
                  const disabled = !!creatingId || createMut.isPending;
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        show: { opacity: 1, y: 0 },
                      }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      onClick={() => addTemplate(t)}
                      disabled={disabled}
                      className={cn(
                        "text-left rounded-xl border bg-card p-2.5 sm:p-3 transition-all flex items-center gap-2.5 sm:gap-3",
                        "hover:shadow-md hover:border-emerald-500/40 hover:-translate-y-0.5",
                        "focus:outline-none focus:ring-2 focus:ring-emerald-500/40",
                        "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none",
                        isLoading && "ring-2 ring-emerald-500/40",
                      )}
                    >
                      <div
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: t.color + "22" }}
                        aria-hidden
                      >
                        <span className="text-xl sm:text-2xl leading-none">{t.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm leading-tight truncate">
                            {t.name}
                          </div>
                          {isLoading && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {t.description}
                        </p>
                        <div className="mt-1.5">
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 font-normal uppercase tracking-wide"
                          >
                            {t.category}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground tabular-nums mt-1">
                            {frequencyLabel(t)}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No templates in this category.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-4 sm:px-6 pb-6 pt-3 border-t flex flex-col sm:flex-row sm:justify-between gap-2">
          <p className="text-xs text-muted-foreground sm:self-center">
            {filtered.length} preset{filtered.length === 1 ? "" : "s"} available
          </p>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onCreateCustom();
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Create custom
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
