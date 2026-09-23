"use client";

import { motion, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/features/insights/hooks/useChatStream";

/**
 * ChatMessage — renders a single chat message.
 *
 *  - User messages: right-aligned, violet bg, no markdown rendering
 *    (we render the raw text, but with whitespace-pre-wrap so newlines
 *    show).
 *  - Assistant messages: left-aligned, dark bg, react-markdown rendered,
 *    streaming cursor (▍) while `streaming === true`, meta row below with
 *    model + tokensUsed.
 *
 *  Fade-in animation on mount; respects prefers-reduced-motion.
 */

interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const reduceMotion = useReducedMotion();
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={isUser ? "flex justify-end" : "flex justify-start"}
    >
      <div
        className={
          isUser
            ? "max-w-[85%] sm:max-w-[75%]"
            : "w-full max-w-[95%] sm:max-w-[85%]"
        }
      >
        {isUser ? (
          <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-violet-500 to-violet-600 text-white text-sm leading-relaxed px-4 py-2.5 whitespace-pre-wrap break-words shadow-md shadow-violet-500/20">
            {message.content}
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-md bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/5 text-sm leading-relaxed text-slate-700 dark:text-white/85 px-4 py-2.5">
            {message.error ? (
              <div className="text-rose-300/90 text-sm flex items-start gap-2">
                <span aria-hidden>⚠</span>
                <span>{message.error}</span>
              </div>
            ) : message.content ? (
              <>
                <MarkdownBlock text={message.content} />
                {message.streaming && (
                  <span
                    aria-hidden
                    className="inline-block w-[0.55em] h-[1.1em] -mb-[0.15em] ml-0.5 bg-violet-400 animate-pulse align-middle"
                  />
                )}
              </>
            ) : message.streaming ? (
              // Waiting for first delta — show a small dot pulse
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-white/40 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: "240ms" }} />
              </div>
            ) : null}

            {/* Meta row — only for finished assistant messages */}
            {!message.streaming && (message.model || message.tokensUsed) && (
              <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-white/5 text-[10px] text-slate-400 dark:text-white/35">
                {message.model && <span>{message.model}</span>}
                {message.model && message.tokensUsed ? <span> · </span> : null}
                {typeof message.tokensUsed === "number" && (
                  <span>{message.tokensUsed} tokens</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ============================================================================
   MarkdownBlock — react-markdown wrapper for assistant messages.
============================================================================ */

function MarkdownBlock({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="whitespace-pre-wrap mb-2 last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="text-slate-900 dark:text-white font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-slate-800 dark:text-white/90">{children}</em>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 underline underline-offset-2"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-5 mb-2 space-y-1">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-5 mb-2 space-y-1">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children }) => (
          <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-[0.85em] font-mono text-slate-800 dark:text-white/90">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="overflow-x-auto bg-black/40 rounded-md p-3 my-2 text-xs">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-violet-500/60 pl-3 my-2 text-slate-600 dark:text-white/70 italic">
            {children}
          </blockquote>
        ),
        h1: ({ children }) => (
          <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h3>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
