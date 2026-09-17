"use client";

import { useEffect, useRef } from "react";
import { usePomodoroStore } from "./pomodoroStore";
import { useMusicStore } from "./musicStore";

const LOFI_TRACKS = [
  "/audio/midnight-reverie.mp3",
  "/audio/soft-focus.mp3",
  "/audio/deep-work.mp3",
];

/**
 * FocusMusicManager — autonomous background-music controller.
 *
 * Watches the Pomodoro store; when `musicWhileFocusing` is enabled AND
 * the user is in a running focus session, picks a random lofi track and
 * loops it at the user's chosen volume. Pauses as soon as the focus
 * session ends, the mode switches away from focus, or the setting is
 * turned off.
 *
 * Renders a hidden <audio> element. The audio element is owned by this
 * component (separate from the MusicPlayer's interactive audio element)
 * so background music can't interfere with the user's manual playlist
 * selection.
 *
 * Picks ONE random track per focus session (kept in sessionTrackUrl ref)
 * and reuses it for the duration of that session, so pause/resume doesn't
 * re-roll the track. A new session (tracked via lastSessionStartRef)
 * triggers a fresh random pick.
 */
export function FocusMusicManager() {
  const mode = usePomodoroStore((s) => s.mode);
  const status = usePomodoroStore((s) => s.status);
  const endTime = usePomodoroStore((s) => s.endTime);
  const musicWhileFocusing = usePomodoroStore((s) => s.settings.musicWhileFocusing);
  const volume = useMusicStore((s) => s.volume);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionTrackUrl = useRef<string | null>(null);
  const lastSessionStartRef = useRef<number | null>(null);

  // Apply volume whenever it changes (and we have an audio element)
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    // Conditions for playing focus music:
    // - User enabled "Music while focusing"
    // - Pomodoro mode is focus
    // - Status is running
    const shouldPlay =
      !!musicWhileFocusing && mode === "focus" && status === "running";

    if (shouldPlay) {
      // Detect a new session start: lastSessionStart is null OR differs from current endTime
      const sessionKey = endTime ?? 0;
      if (lastSessionStartRef.current !== sessionKey) {
        // New session — pick a fresh random track
        sessionTrackUrl.current =
          LOFI_TRACKS[Math.floor(Math.random() * LOFI_TRACKS.length)];
        lastSessionStartRef.current = sessionKey;
      }
      const url = sessionTrackUrl.current;
      if (!url) return;
      if (a.getAttribute("src") !== url) {
        a.setAttribute("src", url);
        a.loop = true;
        a.load();
      }
      a.volume = Math.max(0, Math.min(1, volume));
      // Browsers may block play() if not from a user gesture —
      // for autoplay during a running timer this typically works because
      // the user clicked "Start" earlier in the session. Catch the rejection.
      const p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Autoplay blocked — silently ignore; music will resume on next interaction.
        });
      }
    } else {
      // Pause but keep the src so resume continues the same track
      // UNLESS the session actually ended (mode != focus or status != running)
      // — in that case clear lastSessionStartRef so the next focus session
      // picks a fresh random track.
      if (mode !== "focus" || status !== "running") {
        lastSessionStartRef.current = null;
      }
      if (!a.paused) a.pause();
    }
  }, [musicWhileFocusing, mode, status, endTime, volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a && !a.paused) a.pause();
    };
  }, []);

  return <audio ref={audioRef} className="sr-only" preload="auto" />;
}
