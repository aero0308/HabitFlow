"use client";

import { Shuffle, SkipBack, Play, Pause, SkipForward, Repeat } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMusicStore } from "./musicStore";

/**
 * Playback controls row: Shuffle | Prev | Play/Pause | Next | Repeat
 * Play/Pause calls audio.play() directly in the click handler (not useEffect)
 * to satisfy browser autoplay policies that require user gesture.
 */
export function MusicPlayerControls({ audioRef }: { audioRef: React.RefObject<HTMLAudioElement | null> }) {
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const shuffle = useMusicStore((s) => s.shuffle);
  const repeat = useMusicStore((s) => s.repeat);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const setPlaying = useMusicStore((s) => s.setPlaying);
  const next = useMusicStore((s) => s.next);
  const prev = useMusicStore((s) => s.prev);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const cycleRepeat = useMusicStore((s) => s.cycleRepeat);

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio) { togglePlay(); return; }

    if (audio.paused) {
      // Play — call audio.play() directly in the user gesture
      audio.play().then(() => {
        setPlaying(true);
      }).catch(() => {
        // Autoplay blocked — keep isPlaying false
        setPlaying(false);
      });
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {/* Shuffle */}
      <button
        type="button"
        onClick={toggleShuffle}
        className={cn("transition-colors p-1", shuffle ? "text-violet-500 dark:text-violet-400" : "text-muted-foreground hover:text-foreground")}
        aria-label="Shuffle"
      >
        <Shuffle className="w-3.5 h-3.5" />
      </button>

      {/* Previous */}
      <button
        type="button"
        onClick={prev}
        className="text-muted-foreground hover:text-foreground transition-colors p-1"
        aria-label="Previous track"
      >
        <SkipBack className="w-4 h-4" fill="currentColor" />
      </button>

      {/* Play/Pause — primary, calls audio directly */}
      <motion.button
        type="button"
        onClick={handlePlayPause}
        whileTap={{ scale: 0.92 }}
        className="w-9 h-9 rounded-full bg-violet-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 flex-shrink-0"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
      </motion.button>

      {/* Next */}
      <button
        type="button"
        onClick={next}
        className="text-muted-foreground hover:text-foreground transition-colors p-1"
        aria-label="Next track"
      >
        <SkipForward className="w-4 h-4" fill="currentColor" />
      </button>

      {/* Repeat — polished with indicator dot */}
      <button
        type="button"
        onClick={cycleRepeat}
        className={cn("transition-colors relative p-1", repeat !== "off" ? "text-violet-500 dark:text-violet-400" : "text-muted-foreground hover:text-foreground")}
        aria-label="Repeat"
      >
        <Repeat className="w-3.5 h-3.5" />
        {repeat === "one" && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-violet-400 ring-1 ring-background" />
        )}
        {repeat === "all" && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-violet-500 ring-1 ring-background" />
        )}
      </button>
    </div>
  );
}
