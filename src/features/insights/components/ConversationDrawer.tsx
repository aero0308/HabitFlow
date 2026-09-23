"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Trash2, X, MessageSquare } from "lucide-react";

/**
 * ConversationDrawer — slides in from the right listing past chats.
 *
 * Layout (width 320px, full height):
 *  - Top bar: "New chat" button (closes drawer + clears active conv) + X
 *  - Scrollable list of conversations: title, preview, relative time,
 *    delete button on the right
 *  - Empty state: "No conversations yet"
 *
 * Slide animation: x: 400 → 0 on enter, x: 0 → 400 on exit (Framer Motion).
 * Respects prefers-reduced-motion: uses opacity-only transitions.
 *
 * Fetches /api/insights/chat/conversations on open.
 */

interface ConversationDrawerProps {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  onNew: () => void;
  activeConversationId?: string | null;
  mode?: "data" | "general";
}

interface ConversationListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: {
    role: string;
    content: string;
    createdAt: string;
  } | null;
}

export function ConversationDrawer({
  open,
  onClose,
  onPick,
  onNew,
  activeConversationId,
  mode = "data",
}: ConversationDrawerProps) {
  const reduceMotion = useReducedMotion();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/insights/chat/conversations?mode=${mode}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        conversations?: ConversationListItem[];
      };
      setConversations(json.conversations ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (open) {
      void fetchConversations();
    }
  }, [open, fetchConversations]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await fetch(`/api/insights/chat/conversations/${id}`, {
          method: "DELETE",
        });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          onNew();
        }
      } finally {
        setDeletingId(null);
      }
    },
    [activeConversationId, onNew],
  );

  const slideX = 400;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            aria-hidden
          />

          {/* Drawer */}
          <motion.aside
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: slideX }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: slideX }}
            transition={{ duration: reduceMotion ? 0.15 : 0.3, ease: "easeOut" }}
            className="
              fixed top-0 right-0 z-50 h-[100dvh]
              w-[320px] max-w-[88vw]
              bg-white dark:bg-[#0a0a0f] border-l border-slate-200/80 dark:border-white/10
              flex flex-col
              shadow-2xl
              safe-area-pt
            "
            role="dialog"
            aria-label="Chat history"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-200 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  onNew();
                  onClose();
                }}
                className="
                  inline-flex items-center gap-1.5
                  text-sm font-medium text-white
                  px-3 py-1.5 rounded-lg
                  bg-gradient-to-br from-violet-500 to-violet-600
                  hover:from-violet-400 hover:to-violet-500
                  transition-colors
                  shadow-md shadow-violet-500/20
                "
              >
                <Plus className="w-4 h-4" />
                New chat
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close history"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-lg bg-slate-100 dark:bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                  <MessageSquare className="w-10 h-10 text-slate-400 dark:text-white/20 mb-3" />
                  <p className="text-sm text-slate-500 dark:text-white/45">No conversations yet</p>
                  <p className="text-xs text-slate-400 dark:text-white/30 mt-1">
                    Start a new chat to begin
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {conversations.map((c) => {
                    const isActive = c.id === activeConversationId;
                    return (
                      <li key={c.id}>
                        <div
                          className={`
                            group flex items-start gap-2
                            rounded-lg p-2
                            border
                            transition-colors cursor-pointer
                            ${
                              isActive
                                ? "border-violet-500/30 bg-violet-500/5"
                                : "border-transparent hover:bg-slate-100 hover:border-slate-200 dark:hover:bg-white/5 dark:hover:border-white/10"
                            }
                          `}
                          onClick={() => {
                            onPick(c.id);
                            onClose();
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onPick(c.id);
                              onClose();
                            }
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {c.title}
                            </div>
                            {c.lastMessage && (
                              <div className="text-xs text-slate-500 dark:text-white/40 mt-0.5 truncate">
                                <span className="text-slate-400 dark:text-white/30 capitalize">
                                  {c.lastMessage.role}:
                                </span>{" "}
                                {c.lastMessage.content}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 dark:text-white/25 mt-1">
                              {formatRelativeTime(c.updatedAt)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(c.id);
                            }}
                            disabled={deletingId === c.id}
                            aria-label="Delete conversation"
                            title="Delete conversation"
                            className="
                              w-7 h-7 flex items-center justify-center rounded-md
                              text-slate-400 dark:text-white/30 hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/5
                              transition-colors
                              opacity-0 group-hover:opacity-100
                              disabled:opacity-50
                            "
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
