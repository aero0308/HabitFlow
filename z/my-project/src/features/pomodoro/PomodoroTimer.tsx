"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Eye, RotateCcw, Pause, Play, Settings as SettingsIcon, Music } from "lucide-react";
import { toast } from "sonner";
import { useConfetti } from "@/lib/confetti";
import {
  usePomodoroStore,
  getModeDuration,
  POMODORO_LABELS,
  type PomodoroMode,
} from "./pomodoroStore";
import { usePomodoroTick } from "./usePomodoroTick";
import { PomodoroSettings } from "./PomodoroSettings";
import { MusicPlayer } from "./MusicPlayer";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const MODE_ICONS: Record<PomodoroMode, typeof Eye> = {
  focus: Eye,
  short: Coffee,
  long: Coffee,
};

const MODE_GRADIENTS: Record<PomodoroMode, { from: string; to: string }> = {
  focus: { from: "#8b5cf6", to: "#a78bfa" },
  short: { from: "#14b8a6", to: "#2dd4bf" },
  long: { from: "#a855f7", to: "#ec4899" },
};

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    [[2093, "triangle", 0.4, 2.5, 0.005], [2637, "triangle", 0.4, 2.5, 0.025], [1319, "sine", 0.3, 3, 0.01], [1568, "sine", 0.3, 3, 0.06]].forEach(([f, type, vol, dur, atk]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = type as OscillatorType; o.frequency.value = f as number;
      const st = t + (atk as number);
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vol as number, st + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, st + (dur as number));
      o.start(st); o.stop(st + (dur as number));
    });
    setTimeout(() => ctx.close(), 4000);
  } catch {}
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function PomodoroTimer() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [musicView, setMusicView] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { fire: fireConfetti } = useConfetti();

  const mode = usePomodoroStore((s) => s.mode);
  const status = usePomodoroStore((s) => s.status);
  const secondsRemaining = usePomodoroStore((s) => s.secondsRemaining);
  const cyclePosition = usePomodoroStore((s) => s.cyclePosition);
  const settings = usePomodoroStore((s) => s.settings);
  const start = usePomodoroStore((s) => s.start);
  const pause = usePomodoroStore((s) => s.pause);
  const resume = usePomodoroStore((s) => s.resume);
  const reset = usePomodoroStore((s) => s.reset);
  const completeSession = usePomodoroStore((s) => s.completeSession);

  const totalSeconds = getModeDuration(mode, settings);
  const progress = totalSeconds > 0 ? 1 - secondsRemaining / totalSeconds : 0;
  const isRunning = status === "running";

  const size = 140;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const gradient = MODE_GRADIENTS[mode];
  const gradientId = useMemo(() => `pomodoro-grad-${mode}`, [mode]);
  const glowGradientId = useMemo(() => `pomodoro-glow-${mode}`, [mode]);
  const ModeIcon = MODE_ICONS[mode];

  const label = status === "running" ? "Pause" : status === "paused" ? "Resume" : "Start";
  const ActionIcon = status === "running" ? Pause : Play;

  function handlePrimary() {
    if (status === "running") pause();
    else if (status === "paused") resume();
    else start();
  }

  const handleComplete = useCallback(() => {
    const wasFocus = mode === "focus";
    const num = wasFocus ? cyclePosition + 1 : cyclePosition;
    if (wasFocus) {
      toast.success(`${num}${getOrdinalSuffix(num)} focus session complete 🔥`, { description: "Time for a break." });
      fireConfetti({ count: 80 });
    } else {
      toast.success(`${num}${getOrdinalSuffix(num)} break complete ☕`, { description: "Ready to focus again?" });
    }
    if (settings.soundEnabled) playChime();
    if (settings.vibrationEnabled && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
    if (settings.notificationEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
      if (wasFocus) new Notification(`${num}${getOrdinalSuffix(num)} Focus Session Complete 🔥`, { body: `Great work! You've completed ${num} focus session${num === 1 ? "" : "s"}. Time for a break.` });
      else new Notification(`${num}${getOrdinalSuffix(num)} Break Complete ☕`, { body: "Break's over! Ready to focus again?" });
    }
    completeSession();
  }, [mode, cyclePosition, settings, fireConfetti, completeSession]);

  usePomodoroTick(handleComplete);
  const dots = Array.from({ length: settings.longEvery }, (_, i) => i);

  return (
    <div className="relative mt-auto">
      {/* Audio element — positioned off-screen but not display:none (some browsers block playback from hidden elements) */}
      <audio ref={audioRef} className="sr-only" preload="auto" />

      <div className="p-3 rounded-xl border border-border bg-muted/30" data-music-modal>
        {/* No heading — music button is in top-left of ring area */}
        <AnimatePresence mode="wait">
          {!musicView && (
            <motion.div
              key="timer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
            {/* Ring + center content + music button positioned in top-left space */}
            <div className="relative flex items-center justify-center my-2">
              <svg width={size} height={size} className="-rotate-90">
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={gradient.from} />
                    <stop offset="100%" stopColor={gradient.to} />
                  </linearGradient>
                  <linearGradient id={glowGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={gradient.from} stopOpacity="1" />
                    <stop offset="70%" stopColor={gradient.to} stopOpacity="0.9" />
                    <stop offset="100%" stopColor={gradient.to} stopOpacity="0.3" />
                  </linearGradient>
                  <filter id={`glow-tip-${mode}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/15" />
                <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#${glowGradientId})`} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} animate={{ strokeDashoffset: dashOffset }} transition={{ duration: 0.3, ease: "linear" }} filter={`url(#glow-tip-${mode})`} />
              </svg>

              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <ModeIcon className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />
                <span className="text-3xl font-bold tabular-nums text-foreground leading-none" style={{ fontFamily: '"Gothic 725", "Gothic725 Bold BT", "Century Gothic", "Avant Garde", "Inter", sans-serif' }}>
                  {formatTime(secondsRemaining)}
                </span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {dots.map((i) => {
                    const activeCount = mode === "focus" ? cyclePosition + 1 : cyclePosition;
                    const isActive = i < activeCount;
                    return (
                      <motion.span key={i} className="block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? "#a855f7" : "hsl(var(--muted-foreground) / 0.25)", boxShadow: isActive ? "0 0 4px rgba(168,85,247,0.6)" : "none" }}
                        animate={isRunning && isActive ? { scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] } : { scale: 1, opacity: 1 }}
                        transition={isRunning && isActive ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }} />
                    );
                  })}
                </div>
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-medium mt-1">{POMODORO_LABELS[mode]}</span>
              </div>

              {/* Music button — positioned in the top-left empty space of the ring */}
              <button
                type="button"
                onClick={() => setMusicView(true)}
                className="absolute top-0 left-0 w-7 h-7 rounded-full border border-border bg-muted hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open music player"
              >
                <Music className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Controls row — fixed h-8 height for the row */}
            <div className="flex items-center gap-2 mt-2 h-8">
              <button type="button" onClick={reset} className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center flex-shrink-0 transition-colors" aria-label="Reset timer">
                <RotateCcw className="w-4 h-4" />
              </button>
              <motion.button type="button" onClick={handlePrimary} whileTap={{ scale: 0.97 }} className="flex-1 h-7 mx-1.5 rounded-full flex items-center justify-center gap-1.5 text-xs font-medium bg-muted-foreground/20 hover:bg-muted-foreground/30 text-foreground transition-colors">
                <ActionIcon className="w-3.5 h-3.5" />{label}
              </motion.button>
              <button type="button" onClick={() => setSettingsOpen(true)} className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center flex-shrink-0 transition-colors" aria-label="Timer settings">
                <SettingsIcon className="w-4 h-4" />
              </button>
            </div>
            </motion.div>
          )}

          {/* Music player view — no heading row, music button is replaced by X in MusicPlayer */}
          {musicView && (
            <motion.div
              key="music"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <MusicPlayer onExit={() => setMusicView(false)} audioRef={audioRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PomodoroSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
