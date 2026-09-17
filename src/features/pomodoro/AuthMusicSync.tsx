"use client";

import { useEffect } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { useMusicStore } from "./musicStore";

/**
 * AuthMusicSync — invisible bridge between auth state and the music store.
 *
 * - When a user logs in: calls `setActiveUser(user.id)` so the music
 *   store loads that user's uploaded tracks + per-user prefs (volume,
 *   shuffle, repeat).
 * - When a user logs out: calls `setActiveUser(null)` to clear all
 *   user-specific state AND pauses every <audio> element on the page
 *   (both the MusicPlayer's audio and the FocusMusicManager's background
 *   audio) so music doesn't keep playing after logout.
 *
 * Renders nothing.
 */
export function AuthMusicSync() {
  const { user } = useAuth();
  const setActiveUser = useMusicStore((s) => s.setActiveUser);

  useEffect(() => {
    // Push the new user id (or null on logout) into the store.
    useMusicStore.getState().setActiveUser(user?.id ?? null);

    // On logout, pause every <audio> on the page so music stops.
    if (!user?.id) {
      document.querySelectorAll("audio").forEach((a: HTMLAudioElement) => {
        try {
          a.pause();
          a.currentTime = 0;
        } catch {
          // Ignore — some browsers throw on access
        }
      });
    }
  }, [user?.id, setActiveUser]);

  return null;
}
