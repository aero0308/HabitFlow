"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ShowcaseProgressProps {
  total: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Minimal progress indicator: a single thin progress bar with a counter,
 * flanked by prev/next buttons. Always dark-themed to match the section.
 */
export function ShowcaseProgress({ total, scrollRef }: ShowcaseProgressProps) {
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      rafRef.current = null;
      const max = el.scrollWidth - el.clientWidth;
      const p = max > 0 ? el.scrollLeft / max : 0;
      setProgress(Math.min(1, Math.max(0, p)));
      const card = Math.round(p * (total - 1));
      setActiveIndex(Math.min(total - 1, Math.max(0, card)));
    };

    const onScroll = () => {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(update);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollRef, total]);

  const scrollToIndex = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.min(total - 1, Math.max(0, idx));
    const child = el.children[clamped] as HTMLElement | undefined;
    if (child) {
      el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: "smooth" });
    }
  };

  const pct = `${Math.round(progress * 100)}%`;
  const current = String(activeIndex + 1).padStart(2, "0");
  const totalStr = String(total).padStart(2, "0");

  return (
    <div className="flex items-center gap-4 mt-8 max-w-md">
      {/* Prev button */}
      <button
        type="button"
        onClick={() => scrollToIndex(activeIndex - 1)}
        disabled={activeIndex === 0}
        aria-label="Previous screen"
        className="flex-shrink-0 w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white/70 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      <div className="flex-1 h-px bg-white/10 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-white transition-[width] duration-150 ease-out"
          style={{ width: pct }}
        />
      </div>

      {/* Next button */}
      <button
        type="button"
        onClick={() => scrollToIndex(activeIndex + 1)}
        disabled={activeIndex === total - 1}
        aria-label="Next screen"
        className="flex-shrink-0 w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white/70 hover:text-white transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Counter */}
      <span className="flex-shrink-0 text-xs font-mono tabular-nums text-white/40 w-16 text-right">
        <span className="text-white">{current}</span>
        <span className="text-white/30"> / {totalStr}</span>
      </span>
    </div>
  );
}
