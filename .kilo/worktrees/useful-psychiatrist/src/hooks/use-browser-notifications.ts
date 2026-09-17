"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useDashboard } from "@/hooks/use-checkins";

// Versioned so we can bust stale dates when behavior changes.
const LAST_NOTIFIED_KEY = "habitflow-last-notified-date-v2";

const ICON_URL = "https://z-cdn.chatglm.cn/z-ai/static/logo.svg";
const NOTIF_TAG = "habitflow-reminder";

/**
 * Browser reminders hook.
 *
 * Behaviour:
 *  - Fires once per day, *after* the user's configured `reminderTime` has
 *    been reached (>= check, not exact-minute match — so a missed 09:00 fire
 *    still triggers at 09:01, 09:05, on tab refocus, etc.).
 *  - On fire: shows BOTH a Sonner toast AND a native browser Notification,
 *    so the user is guaranteed visible feedback even if the OS notification
 *    permission is missing or blocked.
 *  - Re-checks on mount and whenever the tab becomes visible again.
 *  - Polls every 30s (so we never miss the reminder time by more than 30s).
 *  - Dedupes per calendar day via localStorage.
 *
 * Window debug helpers (intentionally global so the test page can poke us):
 *   window.__habitflowRunCheck()          — manually run checkAndNotify
 *   window.__habitflowReminderStatus()    — returns {reminderTime, todayKey, lastNotified, dash}
 *   window.__habitflowFireReminder()      — force-fire the notification now
 *   window.__habitflowResetReminder()     — clear localStorage dedupe key
 */

interface ReminderStatus {
  enabled: boolean;
  reminderTime: string;
  lastNotified: string | null;
  todayKey: string | null;
  hasDash: boolean;
  incomplete: number;
}

function todayKeyLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseHHMM(s: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return null;
  return { h, m };
}

function getNotificationTitle(incompleteCount: number, firstName?: string): string {
  const name = firstName?.trim() ? ` ${firstName.trim()}` : "";
  if (incompleteCount === 1) return `Hey${name}, one habit is waiting`;
  if (incompleteCount > 1) return `${name ? name + ", " : ""}${incompleteCount} habits waiting for you`;
  return `Habits all done! 🎉`;
}

function getNotificationBody(incompleteCount: number, names: string[]): string {
  if (incompleteCount === 0) return "Great job today — every box is checked. Rest well. 💪";
  if (incompleteCount === 1) return `Tap to check it off — you've got this!`;
  const preview = names.slice(0, 3).join(", ");
  const more = incompleteCount > 3 ? ` +${incompleteCount - 3} more` : "";
  return `${preview}${more}`;
}

export function useBrowserReminders(
  browserRemindersEnabled: boolean,
  reminderTime: string,
) {
  const { data: dash } = useDashboard();
  const lastNotifiedRef = useRef<string>("");

  // Keep the last-notified key in sync with localStorage once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    lastNotifiedRef.current = localStorage.getItem(LAST_NOTIFIED_KEY) || "";
  }, []);

  /**
   * Core check — fires both a Sonner toast and a native Notification.
   * Returns the number of incomplete habits (so callers can debug/inspect).
   *
   * `useCallback` so the polling effect's identity stays stable across renders
   * that don't actually change the deps — which prevents the interval from
   * being torn down and rebuilt on every parent re-render.
   */
  const checkAndNotify = useCallback(
    (opts?: { force?: boolean }): number => {
      if (typeof window === "undefined") return 0;
      if (!browserRemindersEnabled) return 0;
      if (!dash) return 0;

      const force = opts?.force === true;
      const now = new Date();
      const tk = todayKeyLocal();
      if (!force && lastNotifiedRef.current === tk) return 0;

      // Time gate — only fire *after* the user's reminderTime (inclusive).
      // Skip the gate entirely in "force" mode for the debug button.
      if (!force) {
        const parts = parseHHMM(reminderTime);
        if (parts) {
          const nowMins = now.getHours() * 60 + now.getMinutes();
          const targetMins = parts.h * 60 + parts.m;
          if (nowMins < targetMins) return 0;
        }
      }

      const incomplete = dash.todaysHabits.filter((h) => !h.completed);
      if (incomplete.length === 0 && !force) return 0;

      // Mark as notified BEFORE firing so a fast loop can't double-fire.
      lastNotifiedRef.current = tk;
      try {
        localStorage.setItem(LAST_NOTIFIED_KEY, tk);
      } catch {
        // localStorage may be unavailable (private mode) — keep the in-memory guard.
      }

      const firstName = (dash as { firstName?: string } | undefined)?.firstName;
      const title = getNotificationTitle(incomplete.length, firstName);
      const body = getNotificationBody(
        incomplete.length,
        incomplete.map((h) => `${h.icon} ${h.name}`),
      );

      // 1) Sonner toast — always fires. This is the user-visible guarantee
      //    that the reminder ran even if native notifications are blocked.
      try {
        if (incomplete.length === 0) {
          toast.success(title, { description: body });
        } else {
          toast.success(title, {
            description: body,
            duration: 8000,
          });
        }
      } catch {
        // ignore toast errors — they must never block the native notif
      }

      // 2) Native browser Notification — best-effort.
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification(title, {
            body,
            icon: ICON_URL,
            tag: NOTIF_TAG,
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch {
          // Notifications may be blocked; fail silently (toast already covered us)
        }
      }

      return incomplete.length;
    },
    [browserRemindersEnabled, reminderTime, dash],
  );

  // Main polling effect — also runs immediately on mount + on visibilitychange.
  useEffect(() => {
    if (!browserRemindersEnabled) return;
    if (typeof window === "undefined") return;

    // Request permission if not yet decided.
    if ("Notification" in window && Notification.permission === "default") {
      // Some browsers require this to be user-gesture-initiated, but the
      // spec allows calling it outside a handler — it'll just be deferred.
      try {
        Notification.requestPermission();
      } catch {
        // ignore
      }
    }

    const run = () => checkAndNotify();
    // Fire once immediately on mount in case we crossed reminderTime while
    // the tab was closed.
    run();

    // 30s polling interval.
    const intervalId = setInterval(run, 30_000);

    // Re-check when the tab becomes visible (user refocuses).
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [browserRemindersEnabled, checkAndNotify]);

  // Expose debug helpers on window for the settings/test-reminder page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      __habitflowRunCheck?: () => number;
      __habitflowReminderStatus?: () => ReminderStatus;
      __habitflowFireReminder?: () => void;
      __habitflowResetReminder?: () => void;
    };
    w.__habitflowRunCheck = () => checkAndNotify();
    w.__habitflowFireReminder = () => checkAndNotify({ force: true });
    w.__habitflowResetReminder = () => {
      try {
        localStorage.removeItem(LAST_NOTIFIED_KEY);
      } catch {
        // ignore
      }
      lastNotifiedRef.current = "";
    };
    w.__habitflowReminderStatus = () => {
      const tk = todayKeyLocal();
      const incomplete = dash?.todaysHabits.filter((h) => !h.completed) ?? [];
      return {
        enabled: browserRemindersEnabled,
        reminderTime,
        lastNotified: lastNotifiedRef.current || null,
        todayKey: tk,
        hasDash: !!dash,
        incomplete: incomplete.length,
      };
    };
    return () => {
      // Remove debug helpers when the hook unmounts.
      delete w.__habitflowRunCheck;
      delete w.__habitflowReminderStatus;
      delete w.__habitflowFireReminder;
      delete w.__habitflowResetReminder;
    };
  }, [browserRemindersEnabled, reminderTime, checkAndNotify, dash]);
}

/** Request notification permission and return the result. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return await Notification.requestPermission();
}

/** Check if notifications are supported and permitted. */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Send a test notification immediately (for the settings page "Test notification" button). */
export function sendTestNotification(title: string, body: string) {
  // Always show the toast first — guarantees visible feedback.
  try {
    toast.success(title, { description: body });
  } catch {
    // ignore
  }
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    new Notification(title, {
      body,
      icon: ICON_URL,
      tag: "habitflow-test",
    });
    return true;
  } catch {
    return false;
  }
}
