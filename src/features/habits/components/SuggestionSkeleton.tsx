"use client";

/**
 * SuggestionSkeleton — 3 shimmer skeleton cards shown while the AI thinks.
 * Mirrors the layout of SuggestionCard (icon-box on the left, name + meta
 * pills + reason line) so the swap-in is visually seamless.
 */
export function SuggestionSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
        >
          {/* Checkbox placeholder */}
          <div className="mt-1 w-4 h-4 rounded-sm bg-muted/60 animate-pulse" />
          {/* Icon box */}
          <div className="w-10 h-10 rounded-lg bg-muted/60 animate-pulse" />
          {/* Text column */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-2/3 rounded bg-muted/60 animate-pulse" />
            <div className="flex gap-1.5">
              <div className="h-4 w-14 rounded bg-muted/40 animate-pulse" />
              <div className="h-4 w-14 rounded bg-muted/40 animate-pulse" />
              <div className="h-4 w-10 rounded bg-muted/40 animate-pulse" />
            </div>
            <div className="h-3 w-full rounded bg-muted/30 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-muted/30 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
