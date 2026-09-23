"use client";

import { CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ============================================================================
   GlowingBorder — animated rotating gradient border (CSS-only, no JS).
   ----------------------------------------------------------------------------
   Creates a "futuristic glowing border" effect:
   - An absolute inset-0 div with a conic-gradient background
   - Animation: spin 6s linear infinite
   - Mask technique: use `mask` CSS so only the 1px border ring shows,
     not the whole gradient
   - A dark inner layer (bg-[#0a0a0f]) masks the interior
   - The actual content sits on top (z-10, relative)

   Respects prefers-reduced-motion: freezes the animation.
============================================================================ */

interface GlowingBorderProps {
  children: ReactNode;
  className?: string;
  /** Border radius — default "rounded-2xl" */
  rounded?: string;
}

export function GlowingBorder({
  children,
  className,
  rounded = "rounded-2xl",
}: GlowingBorderProps) {
  return (
    <div className={cn("relative", rounded, "overflow-hidden", className)}>
      {/* Light mode: solid border + shadow for depth.
          Dark mode: rotating gradient ring (the "glowing" effect). */}
      {/* Rotating gradient ring — only visible in dark mode */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          rounded,
          "glowing-border-ring",
          "hidden dark:block",
        )}
      />
      {/* Inner background — white in light with violet-tinted shadow,
          dark in dark mode */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-[1px]",
          rounded.replace("2xl", "xl"),
          "bg-white dark:bg-[#0a0a0f]",
          "border border-violet-200/60 dark:border-transparent",
          "shadow-[0_8px_30px_-12px_rgba(139,92,246,0.15)] dark:shadow-none",
        )}
      />
      {/* Outer glow — subtle in light, prominent in dark */}
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 bg-violet-500/[0.06] dark:bg-violet-500/20 blur-2xl rounded-full pointer-events-none"
      />
      {/* Content */}
      <div className="relative z-10">{children}</div>

      <style jsx>{`
        .glowing-border-ring {
          background: conic-gradient(
            from 0deg,
            #8b5cf6,
            #a855f7,
            #06b6d4,
            #8b5cf6
          );
          animation: spin 6s linear infinite;
          mask: linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask: linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          padding: 1px;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .glowing-border-ring {
            animation: none;
            background: linear-gradient(
              135deg,
              #8b5cf6,
              #a855f7,
              #06b6d4,
              #8b5cf6
            );
          }
        }
      `}</style>
    </div>
  );
}
