"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ArrowUp, Square } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * ChatInput — auto-resizing textarea + send/stop button.
 *
 * Behavior:
 *  - Auto-resizes from 1 to 4 rows depending on content.
 *  - Enter sends; Shift+Enter inserts a newline.
 *  - Send button is disabled when input is empty or when streaming.
 *  - While streaming, the send button becomes a Stop button (abort).
 *  - Respects prefers-reduced-motion (fade-in only, no translate).
 */

interface ChatInputProps {
  onSend: (text: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const MIN_ROWS = 1;
const MAX_ROWS = 4;

export function ChatInput({
  onSend,
  onAbort,
  isStreaming,
  disabled = false,
  placeholder = "Ask anything about your habits...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const reduceMotion = useReducedMotion();

  // Auto-resize the textarea based on content (1..4 rows).
  const autoresize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    // Compute rows from scrollHeight / line-height. We rely on the
    // line-height CSS (1.5rem = 24px) to convert scrollHeight → rows.
    const lineHeight = 24;
    const rows = Math.min(
      MAX_ROWS,
      Math.max(MIN_ROWS, Math.ceil(ta.scrollHeight / lineHeight)),
    );
    const targetHeight = rows * lineHeight;
    ta.style.height = `${targetHeight}px`;
    ta.style.overflowY = ta.scrollHeight > targetHeight + 4 ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    autoresize();
  }, [value, autoresize]);

  const send = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue("");
    // Reset height after send
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) {
        ta.style.height = `${MIN_ROWS * 24}px`;
        ta.style.overflowY = "hidden";
      }
    });
  }, [value, disabled, isStreaming, onSend]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  const buttonDisabled = disabled || (isStreaming ? false : !value.trim());

  return (
    <div
      className="
        flex items-end gap-2 p-3
        border-t border-slate-200 dark:border-white/5
        bg-white dark:bg-[#0a0a0f]
        safe-area-pb
      "
    >
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="
          flex-1 flex items-end gap-2
          rounded-2xl border border-slate-200 dark:border-white/10
          bg-slate-100 dark:bg-white/5
          focus-within:border-violet-500/40
          focus-within:bg-slate-50 focus-within:border-violet-400 dark:focus-within:bg-white/[0.07]
          transition-colors
          px-3 py-2
        "
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={placeholder}
          aria-label="Chat input"
          className="
            flex-1
            bg-transparent
            text-sm text-slate-900 placeholder:text-slate-500 dark:text-white dark:placeholder:text-white/35
            border-0 outline-none
            resize-none
            leading-6
            max-h-[96px]
            disabled:opacity-50
          "
          style={{ height: `${MIN_ROWS * 24}px` }}
        />
      </motion.div>

      {/* Send / Stop button */}
      {isStreaming ? (
        <button
          type="button"
          onClick={onAbort}
          aria-label="Stop generating"
          title="Stop"
          className="
            w-10 h-10 rounded-full flex items-center justify-center
            bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white
            hover:bg-slate-300 dark:hover:bg-white/15 transition-colors
            flex-shrink-0
          "
        >
          <Square className="w-4 h-4 fill-current" />
        </button>
      ) : (
        <button
          type="button"
          onClick={send}
          disabled={buttonDisabled}
          aria-label="Send message"
          title="Send"
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            "bg-gradient-to-br from-violet-500 to-violet-600",
            "text-white shadow-lg shadow-violet-500/20",
            "hover:from-violet-400 hover:to-violet-500 transition-colors",
            "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none",
            "flex-shrink-0",
          )}
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
