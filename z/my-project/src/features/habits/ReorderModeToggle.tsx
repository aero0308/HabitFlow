"use client";

import { GripVertical, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReorderModeToggleProps {
  /** Whether reorder mode is currently active */
  active: boolean;
  /** Called when user taps "Reorder" to enter reorder mode */
  onActivate: () => void;
  /** Called when user taps "Save" to persist the new order */
  onSave: () => void;
  /** Called when user taps "Cancel" to revert and exit */
  onCancel: () => void;
  /** Whether the save mutation is in-flight */
  saving?: boolean;
}

/**
 * Mobile-only reorder mode toggle.
 *
 * - When inactive: renders a single outline "Reorder" button with a
 *   GripVertical icon.
 * - When active: renders a "Save" (primary violet) + "Cancel" (outline)
 *   button pair in the same position.
 *
 * Hidden on desktop (md+) — desktop always uses drag-to-reorder inline.
 */
export function ReorderModeToggle({
  active,
  onActivate,
  onSave,
  onCancel,
  saving = false,
}: ReorderModeToggleProps) {
  if (active) {
    return (
      <div className="flex items-center gap-2 md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          <X className="w-4 h-4 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          Save
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onActivate}
      className="md:hidden"
    >
      <GripVertical className="w-4 h-4 mr-1" />
      Reorder
    </Button>
  );
}
