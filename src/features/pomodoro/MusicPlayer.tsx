"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, Volume1, VolumeX, Music as MusicIcon } from "lucide-react";
import { useMusicStore } from "./musicStore";
import { SpectrumBars } from "./SpectrumBars";
import { MusicPlayerControls } from "./MusicPlayerControls";
import { cn } from "@/lib/utils";

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function MusicPlayer({ onExit, audioRef }: { onExit: () => void; audioRef: React.RefObject<HTMLAudioElement | null> }) {
  const playlist = useMusicStore((s) => s.playlist);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const currentTime = useMusicStore((s) => s.currentTime);
  const duration = useMusicStore((s) => s.duration);
  const volume = useMusicStore((s) => s.volume);
  const durations = useMusicStore((s) => s.durations);
  const setCurrentTime = useMusicStore((s) => s.setCurrentTime);
  const setDuration = useMusicStore((s) => s.setDuration);
  const setPlaying = useMusicStore((s) => s.setPlaying);
  const setTrackDuration = useMusicStore((s) => s.setTrackDuration);
  const next = useMusicStore((s) => s.next);
  const seek = useMusicStore((s) => s.seek);
  const setVolume = useMusicStore((s) => s.setVolume);
  const repeat = useMusicStore((s) => s.repeat);
  const playlistOpen = useMusicStore((s) => s.playlistOpen);
  const setPlaylistOpen = useMusicStore((s) => s.setPlaylistOpen);

  const [volumeOpen, setVolumeOpen] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekPct, setSeekPct] = useState<number | null>(null);
  const [volDrag, setVolDrag] = useState(false);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const volSliderRef = useRef<HTMLDivElement | null>(null);
  // Wrapper around the volume button + popup — used to detect click-outside
  const volumeWrapRef = useRef<HTMLDivElement | null>(null);

  const track = playlist[currentTrackIndex];
  const displayTime = seeking && seekPct !== null ? (seekPct / 100) * duration : currentTime;
  const progressPct = duration > 0 ? (displayTime / duration) * 100 : 0;
  // Use the real (loaded) duration from the durations map so the total time
  // matches what the PlaylistOverlay shows (it reads from the same map).
  const trackDuration = durations[track?.id] || duration || track?.duration || 0;

  // Single source of truth: sync the <audio> element to the store state.
  // Handles: track change (next/prev/select) → set src + auto-play;
  // play/pause toggle → play/pause the element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.getAttribute("src") !== track.url) {
      audio.setAttribute("src", track.url);
      audio.load();
    }
    if (isPlaying) {
      if (audio.paused) {
        audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    } else {
      if (!audio.paused) audio.pause();
    }
  }, [track, isPlaying, audioRef, setPlaying]);

  // Update currentTime while playing
  useEffect(() => {
    if (!isPlaying || seeking) return;
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (audio) setCurrentTime(audio.currentTime);
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying, seeking, audioRef, setCurrentTime]);

  // Set volume
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume, audioRef]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      if (track) setTrackDuration(track.id, audio.duration);
    };
    const onTimeUpdate = () => { if (!seeking) setCurrentTime(audio.currentTime); };
    const onEnded = () => {
      if (repeat === "one") { audio.currentTime = 0; audio.play().catch(() => {}); } else { next(); }
    };
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioRef, setDuration, setCurrentTime, next, repeat, seeking, track, setTrackDuration]);

  // ===== Close volume dropdown when clicking outside =====
  useEffect(() => {
    if (!volumeOpen) return;
    function onDown(e: MouseEvent) {
      const wrap = volumeWrapRef.current;
      if (wrap && !wrap.contains(e.target as Node)) {
        setVolumeOpen(false);
      }
    }
    // Use pointerdown + mousedown to catch both touch & mouse
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [volumeOpen]);

  // ===== Seek bar drag handlers =====
  function handleSeekStart(e: React.MouseEvent) {
    setSeeking(true);
    // Update immediately on click
    const audio = audioRef.current;
    if (!audio || !duration || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setSeekPct(pct);
  }

  // Mouse move/up for dragging — uses refs, no dependency issues
  useEffect(() => {
    if (!seeking) return;

    function onMove(e: MouseEvent) {
      const audio = audioRef.current;
      if (!audio || !duration || !progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      setSeekPct(pct);
    }

    function onUp() {
      const audio = audioRef.current;
      if (audio && duration && seekPct !== null) {
        const newTime = (seekPct / 100) * duration;
        audio.currentTime = newTime;
        seek(newTime);
        setCurrentTime(newTime);
      }
      setSeeking(false);
      setSeekPct(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [seeking, seekPct, duration, audioRef, seek, setCurrentTime]);

  // ===== Vertical volume slider =====
  function handleVolStart(e: React.MouseEvent) {
    e.stopPropagation();
    setVolDrag(true);
    if (!volSliderRef.current) return;
    const rect = volSliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setVolume(pct);
  }

  useEffect(() => {
    if (!volDrag) return;

    function onMove(e: MouseEvent) {
      if (!volSliderRef.current) return;
      const rect = volSliderRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      setVolume(pct);
    }

    function onUp() { setVolDrag(false); }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [volDrag, setVolume]);

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex flex-col gap-1.5 relative">
      {/* Track title row — X button on right */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground truncate max-w-[160px]">
          {track?.title ?? "No track loaded"}
        </span>
        <button
          type="button"
          onClick={onExit}
          className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label="Back to timer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Visualizer */}
      <SpectrumBars isPlaying={isPlaying} />

      {/* Progress bar — fixed seek */}
      <div
        ref={progressRef}
        className="group relative h-1 bg-muted rounded-full cursor-pointer mt-0.5 select-none"
        onMouseDown={handleSeekStart}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
          style={{
            width: `${progressPct}%`,
            background: "linear-gradient(to right, #8b5cf6, #c4b5fd)",
            transition: seeking ? "none" : "width 0.15s linear",
          }}
        />
        <div
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-primary pointer-events-none"
          style={{
            left: `${progressPct}%`,
            transform: "translate(-50%, -50%)",
            opacity: seeking ? 1 : 0,
            transition: "opacity 0.15s",
            boxShadow: "0 0 8px rgba(139,92,246,0.8)",
          }}
        />
        <div
          className="absolute top-1/2 w-2 h-2 rounded-full bg-primary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
          style={{
            left: `${progressPct}%`,
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 6px rgba(139,92,246,0.5)",
          }}
        />
      </div>

      {/* Time row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground tabular-nums">{formatTime(displayTime)}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{formatTime(trackDuration)}</span>
      </div>

      {/* Controls */}
      <MusicPlayerControls audioRef={audioRef} />

      {/* Bottom row — volume + playlist */}
      <div className="flex items-center justify-between mt-0.5">
        {/* Volume — vertical slider popup, closes on click-outside */}
        <div ref={volumeWrapRef} className="relative">
          <button
            type="button"
            onClick={() => setVolumeOpen(!volumeOpen)}
            className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Volume"
          >
            <VolumeIcon className="w-3.5 h-3.5" />
          </button>
          <AnimatePresence>
            {volumeOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
              >
                <div className="flex flex-col items-center gap-1.5 bg-popover/95 backdrop-blur-sm border border-border rounded-xl p-2.5 shadow-2xl">
                  {/* Vertical slider — pill shape.
                      Track = muted (inactive grey).
                      Fill = primary (active), anchored at BOTTOM so it grows UP
                      as volume increases. */}
                  <div
                    ref={volSliderRef}
                    className="relative w-1.5 h-20 rounded-full bg-muted cursor-pointer"
                    onMouseDown={handleVolStart}
                  >
                    {/* Active fill — anchored at bottom, grows upward with volume */}
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-full bg-primary"
                      style={{ height: `${volume * 100}%` }}
                    />
                    {/* Thumb — white circle */}
                    <div
                      className="absolute left-1/2 w-3 h-3 rounded-full bg-primary-foreground border border-border shadow-md pointer-events-none"
                      style={{
                        bottom: `${volume * 100}%`,
                        transform: "translate(-50%, 50%)",
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Playlist button — opens the global PlaylistOverlay (rendered at app-shell level) */}
        <button
          type="button"
          onClick={() => setPlaylistOpen(!playlistOpen)}
          aria-pressed={playlistOpen}
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] border transition-colors",
            playlistOpen
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          aria-label="Open playlist"
        >
          <MusicIcon className="w-2.5 h-2.5" />
          <span className="truncate">{playlist.length} tracks</span>
        </button>
      </div>
    </div>
  );
}
