"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, Plus, History, ChevronDown } from "lucide-react";
import { useChatStream } from "@/features/insights/hooks/useChatStream";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatWelcome } from "./ChatWelcome";
import { ConversationDrawer } from "./ConversationDrawer";

/**
 * ChatPanel — the main chat panel (one instance per chat mode).
 *
 * Layout:
 *  Header: Sparkles icon + mode-specific title + [new chat] [history] [collapse]
 *  Body (when expanded):
 *    - Message list (scrollable, max-h-96 with custom scrollbar)
 *    - When no messages: ChatWelcome (mode-specific copy + suggestions)
 *  Footer: ChatInput (sticky bottom)
 *
 * State:
 *  - Collapsed state persisted in localStorage (default expanded).
 *  - ConversationDrawer opened from the history button.
 *  - On mount: if a saved conversation id is in localStorage, restore it
 *    via loadConversation(id). NOTE: the saved-id key is mode-scoped so
 *    the two modes don't cross-load each other's conversations.
 *
 * The `mode` prop drives:
 *  - Which system prompt + context the backend builds (passed in the POST body)
 *  - Which conversation list the drawer loads (filtered server-side by mode)
 *  - Which suggested questions the welcome screen shows
 *  - The header subtitle shown when a conversation is loaded
 */

const COLLAPSE_KEY = "hf_chat_collapsed";
const CONV_KEY_PREFIX = "hf_chat_open_conv_id";

const MODE_TITLE: Record<"data" | "general", string> = {
  data: "Chat with your data",
  general: "Ask anything",
};

const MODE_SUBTITLE_LOADED: Record<"data" | "general", string> = {
  data: "Grounded in your data",
  general: "General assistant · Knows your habits",
};

interface ChatPanelProps {
  mode?: "data" | "general";
}

export function ChatPanel({ mode = "data" }: ChatPanelProps) {
  const reduceMotion = useReducedMotion();
  const {
    messages,
    conversationId,
    isStreaming,
    error,
    sendMessage,
    abort,
    loadConversation,
    newConversation,
  } = useChatStream(mode);

  const convKey = `${CONV_KEY_PREFIX}:${mode}`;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);

  // Persist collapsed state.
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  // Restore last open conversation on mount (mode-scoped key so the two
  // modes don't bleed into each other).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const savedId = localStorage.getItem(convKey);
        if (savedId) {
          await loadConversation(savedId);
          if (cancelled) return;
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convKey]);

  // Track scroll position — only auto-scroll if user is at/near bottom.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 80;
  }, []);

  // Auto-scroll on new messages / streaming deltas.
  useEffect(() => {
    if (collapsed) return;
    const el = scrollRef.current;
    if (!el || !isAtBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, collapsed, reduceMotion]);

  // On expand, jump to bottom.
  useEffect(() => {
    if (!collapsed) {
      isAtBottomRef.current = true;
      const el = scrollRef.current;
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
        });
      }
    }
  }, [collapsed]);

  const handleSend = useCallback(
    (text: string) => {
      isAtBottomRef.current = true; // new message → force scroll to bottom
      void sendMessage(text);
    },
    [sendMessage],
  );

  const handleNewChat = useCallback(() => {
    newConversation();
    setDrawerOpen(false);
  }, [newConversation]);

  const handlePickFromWelcome = useCallback(
    (q: string) => {
      void sendMessage(q);
    },
    [sendMessage],
  );

  const handlePickFromDrawer = useCallback(
    (id: string) => {
      void loadConversation(id);
    },
    [loadConversation],
  );

  const hasMessages = messages.length > 0;

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="rounded-none sm:rounded-2xl overflow-hidden border border-slate-200/60 dark:border-white/5 bg-white dark:bg-[#0a0a0f]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-3 sm:px-6 sm:py-4 border-b border-slate-200/80 dark:border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 dark:from-violet-500/30 dark:to-fuchsia-500/20 flex items-center justify-center border border-violet-500/15 dark:border-violet-500/20 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-tight">
                {MODE_TITLE[mode]}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-white/40 truncate">
                {MODE_SUBTITLE_LOADED[mode]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={handleNewChat}
              aria-label="New chat"
              title="New chat"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Chat history"
              title="Chat history"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand chat" : "Collapse chat"}
              title={collapsed ? "Expand" : "Collapse"}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
              />
            </button>
          </div>
        </div>

        {/* Body — collapsible */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="flex flex-col">
                {/* Messages */}
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="
                    max-h-[55vh] sm:max-h-[60vh] min-h-[260px] sm:min-h-[280px]
                    overflow-y-auto no-scrollbar
                    p-3 sm:px-6 sm:py-4
                    space-y-3
                    flex-1
                  "
                >
                  {hasMessages ? (
                    <>
                      {messages.map((m) => (
                        <ChatMessage key={m.id} message={m} />
                      ))}
                      {error && (
                        <div className="text-xs text-rose-300/70 text-center pt-2">
                          {error}
                        </div>
                      )}
                    </>
                  ) : (
                    <ChatWelcome
                      mode={mode}
                      onPick={handlePickFromWelcome}
                      disabled={isStreaming}
                    />
                  )}
                </div>

                {/* Input — sticky bottom */}
                <div className="sticky bottom-0 bg-white dark:bg-[#0a0a0f]">
                  <ChatInput
                    onSend={handleSend}
                    onAbort={abort}
                    isStreaming={isStreaming}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConversationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPick={handlePickFromDrawer}
        onNew={handleNewChat}
        activeConversationId={conversationId}
        mode={mode}
      />
    </motion.div>
  );
}
