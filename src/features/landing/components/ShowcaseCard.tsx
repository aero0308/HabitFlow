"use client";

import type { ShowcaseScreen } from "../data/showcaseScreens";
import { showcaseScreens } from "../data/showcaseScreens";

interface ShowcaseCardProps {
  screen: ShowcaseScreen;
  index: number;
  total: number;
  priority?: boolean;
}

/**
 * A single showcase card — browser-window frame with screenshot + caption.
 * On mobile: caption is just the screen name (no description).
 * On desktop: caption shows name + description + counter.
 */
export function ShowcaseCard({ screen, index, total, priority }: ShowcaseCardProps) {
  return (
    <article aria-label={screen.title} className="w-full">
      <figure className="group relative w-full rounded-2xl border border-white/[0.07] card-glass overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-3 sm:px-4 h-9 sm:h-10 border-b border-white/[0.07]">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white/15" />
          <div className="ml-2 sm:ml-3 flex-1 h-5 sm:h-6 rounded-md bg-white/5 flex items-center px-2.5 sm:px-3">
            <span className="text-[10px] sm:text-[11px] font-medium text-white/40 tracking-wide truncate">
              habitflow.app/{screen.id}
            </span>
          </div>
        </div>

        {/* Screenshot */}
        <div className="relative w-full bg-slate-950 overflow-hidden">
          <img
            src={screen.image}
            alt={`${screen.title} screen preview`}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="block w-full h-auto select-none"
            draggable={false}
          />
        </div>

        {/* Caption — mobile: name only, desktop: name + description + counter */}
        <figcaption className="flex items-center justify-between gap-3 px-3 sm:px-5 py-2.5 sm:py-4 border-t border-white/[0.07]">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-white">
              {screen.title}
            </h3>
            {/* Description hidden on mobile — name only is enough */}
            <p className="hidden sm:block text-sm text-white/50 mt-1 leading-relaxed">
              {screen.caption}
            </p>
          </div>
          <span className="flex-shrink-0 text-[10px] sm:text-xs font-mono tabular-nums text-white/30">
            {String(index + 1).padStart(2, "0")} / {String(total ?? showcaseScreens.length).padStart(2, "0")}
          </span>
        </figcaption>
      </figure>
    </article>
  );
}
