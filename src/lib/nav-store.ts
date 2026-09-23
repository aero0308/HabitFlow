"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Page =
  | { name: "dashboard" }
  | { name: "habits" }
  | { name: "habit"; id: string }
  | { name: "bad-habit"; id: string }
  | { name: "analytics" }
  | { name: "insights" }
  | { name: "mood" }
  | { name: "achievements" }
  | { name: "history" }
  | { name: "settings" }
  | { name: "off-mode" }
  | { name: "time-of-day" };

interface NavState {
  page: Page;
  go: (page: Page) => void;
}

export const useNav = create<NavState>()(
  persist(
    (set) => ({
      page: { name: "dashboard" },
      go: (page) => {
        set({ page });
        // Scroll to top whenever the user navigates to a new section.
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "instant" });
        }
      },
    }),
    { name: "ht-nav" },
  ),
);
