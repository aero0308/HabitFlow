"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useInstallStarterPack } from "@/hooks/use-habits";
import { templateToInput, type HabitTemplate } from "@/lib/habit-templates";
import { STARTER_PACKS, type StarterPack } from "@/lib/habit-starter-packs";

interface StarterPacksPickerProps {
  open: boolean;
  onClose: () => void;
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

export function StarterPacksPicker({ open, onClose }: StarterPacksPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const installMut = useInstallStarterPack();

  // Closing the dialog resets the inner view back to the pack grid. We do this
  // in the close handler (rather than a useEffect on `open`) so we don't
  // trigger a cascading setState-in-effect render.
  function handleClose() {
    setSelectedId(null);
    onClose();
  }

  const selectedPack: StarterPack | null = selectedId
    ? (STARTER_PACKS.find((p) => p.id === selectedId) ?? null)
    : null;

  function installPack(pack: StarterPack) {
    if (installMut.isPending) return;
    const inputs = pack.habits.map(templateToInput);
    installMut.mutate(inputs, {
      onSuccess: () => {
        setSelectedId(null);
        onClose();
      },
      onError: (e: Error) => {
        toast.error(e.message || "Could not install pack");
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-2 sm:pb-3 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4 text-violet-500" />
            {selectedPack ? selectedPack.name : "Starter packs"}
          </DialogTitle>
          <DialogDescription>
            {selectedPack
              ? selectedPack.description
              : "Install a bundle of 5 daily habits in one click. You can edit or remove any habit afterwards."}
          </DialogDescription>
        </DialogHeader>

        {selectedPack ? (
          // ---- Pack detail view: list the habits + install button ----
          <div className="px-3 sm:px-6 pb-4 sm:pb-6 min-h-0 flex-1 flex flex-col">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="self-start inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All packs
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto custom-scroll">
              <motion.div
                // initial={false} means no enter/exit animation — we want
                // the detail view to appear instantly when a pack is clicked,
                // no jitter from the parent AnimatePresence exit animation.
                initial={false}
                className="space-y-2 pb-2"
              >
                {selectedPack.habits.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-2.5 sm:gap-3 rounded-xl border bg-card p-2.5 sm:p-3 sm:p-4"
                  >
                    <div
                      className="w-8 h-8 sm:w-9 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg sm:text-xl flex-shrink-0"
                      style={{ backgroundColor: h.color + "20" }}
                      aria-hidden
                    >
                      {h.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{h.name}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {h.description}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1.5 h-4 font-normal tabular-nums flex-shrink-0"
                    >
                      {frequencyLabel(h)}
                    </Badge>
                  </div>
                ))}
              </motion.div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {selectedPack.habits.length} habits will be added to your account.
              </p>
              <Button
                onClick={() => installPack(selectedPack)}
                disabled={installMut.isPending}
                className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-500 hover:to-violet-700 text-white"
              >
                {installMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Installing…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Install pack
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // ---- Pack grid view ----
          <div className="px-3 sm:px-6 pt-2 pb-4 sm:pb-6 min-h-0 flex-1 overflow-y-auto custom-scroll">
            <motion.div
              // initial={false} disables the entrance animation entirely.
              // This makes open/close instant and avoids the jitter/flash that
              // AnimatePresence exit animations can cause when the dialog is
              // being dismissed.
              initial={false}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pb-2"
            >
              {STARTER_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedId(pack.id)}
                  className={cn(
                    "text-left rounded-xl border bg-card p-2.5 sm:p-4 transition-all flex items-start gap-2 sm:gap-3 overflow-hidden",
                    "hover:shadow-md hover:border-violet-500/40 hover:-translate-y-0.5",
                    "focus:outline-none focus:ring-2 focus:ring-violet-500/40",
                  )}
                >
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0"
                    style={{ backgroundColor: pack.color + "22" }}
                    aria-hidden
                  >
                    {pack.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-sm leading-tight truncate">
                        {pack.name}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 h-4 font-normal uppercase tracking-wide flex-shrink-0"
                      >
                        {pack.habits.length} habits
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1 sm:line-clamp-2 mt-1">
                      {pack.description}
                    </p>
                  </div>
                </button>
              ))}
            </motion.div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

