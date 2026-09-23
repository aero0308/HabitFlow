"use client";

import { cn } from "@/lib/utils";

/**
 * A 3px flowing gradient underline.
 * Colors slide continuously left-to-right.
 * Respects prefers-reduced-motion (freezes if enabled).
 * Dark mode: brighter violet/indigo/cyan. Light mode: deeper saturation.
 *
 * Usage: wrap the heading and underline in a `width: fit-content` container,
 * or place the underline as a block-level element after the heading
 * inside the same container — it will stretch to the container's width.
 */
export function FlowingUnderline({ className }: { className?: string }) {
  return (
    <div
      className={cn("flowing-underline w-full", className)}
      style={{ display: "block", width: "100%" }}
      aria-hidden="true"
    />
  );
}
