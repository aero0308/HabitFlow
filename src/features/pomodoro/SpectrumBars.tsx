"use client";

import { useEffect, useRef, useMemo } from "react";

const BAR_COUNT = 32;

/**
 * Modern spectrum visualizer with mirror-style bars.
 * Uses pseudo-random animation that simulates audio frequency patterns.
 * (Web Audio API's createMediaElementSource interferes with autoplay
 * policies — using high-quality pseudo-random animation instead.)
 *
 * Design: center-taller mirror pattern, rounded tops, violet gradient
 * with subtle glow, fast 60fps updates via direct DOM manipulation.
 */
export function SpectrumBars({ isPlaying }: { isPlaying: boolean; audioRef?: React.RefObject<HTMLAudioElement | null> }) {
  const bars = useMemo(() => Array.from({ length: BAR_COUNT }, (_, i) => i), []);
  const rafRef = useRef<number | null>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Set calm idle heights
      bars.forEach((_, i) => {
        const bar = barRefs.current[i];
        if (bar) bar.style.height = `${12 + (i % 4) * 3}%`;
      });
      return;
    }

    const animate = () => {
      phaseRef.current += 0.08;

      bars.forEach((_, i) => {
        const half = BAR_COUNT / 2;
        const mirrorI = i < half ? i : BAR_COUNT - 1 - i;
        // Base height: center bars taller (like real EQ)
        const distFromCenter = Math.abs(i - half);
        const baseHeight = Math.max(20, 90 - distFromCenter * 5);

        // Simulate frequency response with layered sine waves + noise
        const wave1 = Math.sin(phaseRef.current + i * 0.3) * 0.3 + 0.5;
        const wave2 = Math.sin(phaseRef.current * 1.7 + i * 0.15) * 0.25;
        const noise = Math.random() * 0.15;
        const intensity = Math.max(0.15, Math.min(1, wave1 + wave2 + noise));

        const heightPct = baseHeight * intensity;
        const bar = barRefs.current[i];
        if (bar) bar.style.height = `${Math.max(6, heightPct)}%`;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, bars]);

  return (
    <div className="flex items-end justify-center gap-[1.5px] h-9 bg-muted/40 rounded-md px-1 py-0.5 overflow-hidden">
      {bars.map((i) => {
        const center = BAR_COUNT / 2;
        const distFromCenter = Math.abs(i - center);
        const opacity = Math.max(0.4, 1 - distFromCenter * 0.03);

        return (
          <div
            key={i}
            ref={(el) => { barRefs.current[i] = el; }}
            className="w-[2px] rounded-t-full rounded-b-[1px]"
            style={{
              height: "12%",
              background: "linear-gradient(to top, #7c3aed 0%, #8b5cf6 40%, #c4b5fd 100%)",
              opacity,
              transition: "height 0.05s linear, box-shadow 0.3s",
            }}
          />
        );
      })}
    </div>
  );
}
