"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { GlowingBorder } from "./GlowingBorder";
import { ChatTabs } from "./ChatTabs";
import { ChatPanel } from "./ChatPanel";

/**
 * AIAssistantSection — the wrapper that holds the heading + ChatTabs +
 * the active ChatPanel. Renders the two chat modes ("Chat with your data"
 * and "Ask anything") under a single "AI Assistant" heading.
 *
 * The active mode is stored in localStorage (`insights.chatMode`) so the
 * user's last choice persists across reloads.
 *
 * Layout:
 *  - Outer: GlowingBorder (existing rotating-conic-gradient ring).
 *  - Inner: dark surface card (`bg-[#0a0a0f]/90 backdrop-blur-xl rounded-2xl p-6`).
 *  - Header: Sparkles (violet) + "AI Assistant" + subtitle.
 *  - ChatTabs below the header.
 *  - Active ChatPanel below the tabs. The `key={chatMode}` on ChatPanel
 *    forces a fresh mount on tab switch so the two chats' UI state
 *    (selected conversation, scroll position, draft input) stay isolated.
 */

const STORAGE_KEY = "insights.chatMode";

function loadInitialMode(): "data" | "general" {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "general" || v === "data") return v;
  } catch {
    // ignore — SSR or disabled storage
  }
  return "data";
}

export function AIAssistantSection() {
  const [chatMode, setChatMode] = useState<"data" | "general">(loadInitialMode);

  const handleChange = (mode: "data" | "general") => {
    setChatMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  return (
    <GlowingBorder className="p-0">
      <div className="rounded-2xl bg-white dark:bg-[#0a0a0f]/95 backdrop-blur-xl p-3 sm:p-6 border border-slate-200/60 dark:border-white/5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3 sm:mb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 dark:from-violet-500/30 dark:to-fuchsia-500/20 flex items-center justify-center border border-violet-500/15 dark:border-violet-500/20 flex-shrink-0">
            <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-violet-600 dark:text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white leading-tight">
              AI Assistant
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mt-0.5">
              Two ways to get help — ask about your data, or ask anything.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <ChatTabs value={chatMode} onChange={handleChange} />

        {/* Active ChatPanel — `key={chatMode}` forces a fresh mount per mode.
            On mobile the chat carries full page width (negative margin trick
            to bleed past the parent's p-3). */}
        <div className="mt-3 sm:mt-4 -mx-3 sm:mx-0">
          <ChatPanel key={chatMode} mode={chatMode} />
        </div>
      </div>
    </GlowingBorder>
  );
}
