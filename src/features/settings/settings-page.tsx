"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SettingsTabs, type SettingsTab } from "@/features/settings/components/SettingsTabs";
import { ProfileTab } from "@/features/settings/components/ProfileTab";
import { GeneralTab } from "@/features/settings/components/GeneralTab";
import { AccountTab } from "@/features/settings/components/AccountTab";

/**
 * SettingsPage — top-level page that renders a 3-tab switcher (Profile /
 * General / Account) plus the active tab's contents with a Framer Motion
 * crossfade on tab change.
 *
 * The active tab is persisted to localStorage (`settings.activeTab`) so the
 * user returns to the same tab on reload. Falls back to "profile" if no
 * stored value or if the stored value is invalid.
 *
 * Respects `prefers-reduced-motion` — the crossfade degrades to an
 * opacity-only fade with no y-offset.
 */

const STORAGE_KEY = "settings.activeTab";
const VALID_TABS: SettingsTab[] = ["profile", "general", "account"];

function loadTab(): SettingsTab {
  if (typeof window === "undefined") return "profile";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && VALID_TABS.includes(v as SettingsTab)) return v as SettingsTab;
  } catch {
    // localStorage might be disabled (e.g. private mode) — fall through.
  }
  return "profile";
}

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>(loadTab);
  const reduceMotion = useReducedMotion();

  // Persist the active tab whenever it changes.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, tab);
    } catch {
      // ignore write failures (private mode / quota)
    }
  }, [tab]);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and preferences.</p>
      </div>

      {/* Tab switcher */}
      <SettingsTabs value={tab} onChange={setTab} />

      {/* Active tab content with crossfade */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {tab === "profile" && <ProfileTab />}
          {tab === "general" && <GeneralTab />}
          {tab === "account" && <AccountTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
