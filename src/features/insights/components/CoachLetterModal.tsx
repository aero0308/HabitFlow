"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  X,
  Target,
  AlertTriangle,
  FlaskConical,
  Mail,
  Check,
  Loader2,
  Copy,
  Share2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";

/* ============================================================================
   CoachLetterModal — full-screen overlay showing the weekly coach letter.
   ----------------------------------------------------------------------------
   Two modes:

   Normal mode (authenticated user, opened from CoachLetterCard):
     - Renders inside a shadcn Dialog with backdrop blur.
     - Footer actions: [Copy] [Share] [Mark as read].
     - Closes on X, ESC, or click outside.

   readOnly mode (public share page `/coach-letter/[token]`):
     - Renders as a plain styled card (no Dialog overlay, no close button).
     - No auth-dependent actions.

   Structure (both modes, in order):
     1. Week date header — "Week of {formatted weekStart}"
     2. Subject heading (text-3xl tracking-tight)
     3. Divider line
     4. Greeting (font-medium, text-lg)
     5. Intro paragraph
     6. "What's working" (Target icon, violet)
     7. "Where you slipped" (AlertTriangle icon, amber)
     8. "One experiment for next week" (FlaskConical icon, emerald)
        — experiment rendered inside a violet callout box.
     9. Closing paragraph
    10. Sign-off — "— Your HabitFlow Coach"
    11. (Normal mode only) Footer with Copy / Share / Mark-as-read

   Sections stagger in with a 0.06s delay. prefers-reduced-motion disables
   the y-translate + delays.
============================================================================ */

/** Strict, fully-populated letter sections (used by the card after Zod parse). */
export interface CoachLetterSections {
  subject: string;
  greeting: string;
  intro: string;
  whatsWorking: string;
  whereYouSlipped: string;
  experiment: string;
  closing: string;
}

/** Loose, partial sections shape — used by the public share page. */
export interface CoachLetterSectionInput {
  greeting?: string;
  intro?: string;
  whatsWorking?: string;
  whereYouSlipped?: string;
  experiment?: string;
  closing?: string;
}

interface CoachLetterModalProps {
  // Normal mode (from card):
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  model?: string;
  generatedAt?: string;
  readAt?: string | null;
  bodyMarkdown?: string;
  // Both modes:
  subject?: string;
  sections?: CoachLetterSectionInput;
  weekStart?: string;
  firstName?: string;
  // readOnly mode:
  readOnly?: boolean;
}

interface SectionDef {
  key:
    | "whatsWorking"
    | "whereYouSlipped"
    | "experiment";
  title: string;
  icon: ComponentType<LucideProps>;
  iconColor: string;
  callout: boolean;
}

const SECTION_DEFS: SectionDef[] = [
  {
    key: "whatsWorking",
    title: "What's working",
    icon: Target,
    iconColor: "text-violet-400",
    callout: false,
  },
  {
    key: "whereYouSlipped",
    title: "Where you slipped",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    callout: false,
  },
  {
    key: "experiment",
    title: "One experiment for next week",
    icon: FlaskConical,
    iconColor: "text-emerald-400",
    callout: true,
  },
];

export function CoachLetterModal({
  open,
  onOpenChange,
  subject,
  sections,
  model,
  generatedAt,
  readAt,
  weekStart,
  firstName,
  bodyMarkdown,
  readOnly = false,
}: CoachLetterModalProps) {
  const reduceMotion = useReducedMotion();
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(!!readAt);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Reset "marked" state if the underlying letter changes
  useEffect(() => {
    setMarked(!!readAt);
  }, [readAt, weekStart]);

  const handleMarkRead = useCallback(async () => {
    if (marked || !weekStart) return;
    setMarking(true);
    try {
      const res = await fetch("/api/insights/coach-letter/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: weekStart }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        toast.error(j?.detail ?? "Couldn't mark as read");
        return;
      }
      setMarked(true);
      toast.success("Marked as read");
      // Close modal after marking read
      onOpenChange?.(false);
    } catch {
      toast.error("Couldn't mark as read");
    } finally {
      setMarking(false);
    }
  }, [marked, weekStart, onOpenChange]);

  const handleCopy = useCallback(async () => {
    const text = bodyMarkdown ?? buildFallbackMarkdown(subject, sections);
    if (!text) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Letter copied");
    } catch {
      toast.error("Couldn't copy to clipboard");
    } finally {
      setCopying(false);
    }
  }, [bodyMarkdown, subject, sections]);

  const handleShare = useCallback(async () => {
    if (!weekStart) return;
    setSharing(true);
    try {
      const res = await fetch(
        `/api/insights/coach-letter/share?week=${encodeURIComponent(weekStart)}`,
        { method: "POST" },
      );
      const json = (await res.json().catch(() => null)) as {
        shareUrl?: string;
        detail?: string;
      } | null;
      if (!res.ok || !json?.shareUrl) {
        toast.error(json?.detail ?? "Couldn't create share link");
        return;
      }
      try {
        await navigator.clipboard.writeText(json.shareUrl);
        toast.success("Link copied");
      } catch {
        // Clipboard may be blocked — still surface the URL
        toast(json.shareUrl, { description: "Copy this share link" });
      }
    } catch {
      toast.error("Couldn't create share link");
    } finally {
      setSharing(false);
    }
  }, [weekStart]);

  const content = (
    <LetterContent
      subject={subject}
      sections={sections}
      weekStart={weekStart}
      firstName={firstName}
      model={model}
      generatedAt={generatedAt}
      readOnly={readOnly}
      marked={marked}
      marking={marking}
      copying={copying}
      sharing={sharing}
      reduceMotion={reduceMotion}
      onMarkRead={handleMarkRead}
      onCopy={handleCopy}
      onShare={handleShare}
      onClose={readOnly ? undefined : () => onOpenChange?.(false)}
    />
  );

  if (readOnly) {
    return (
      <div className="max-w-2xl w-full rounded-2xl bg-white dark:bg-[#0a0a0f] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-xl overflow-y-auto max-h-[85vh] no-scrollbar">
        {content}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Mobile: full-screen sheet (same pattern as AboutModal)
        // Desktop: centered, max-w-2xl, scrollable
        className="
          fixed inset-0 translate-x-0 translate-y-0
          sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          rounded-none sm:rounded-2xl
          max-w-none sm:max-w-2xl w-full sm:w-[calc(100%-2rem)]
          h-[100dvh] sm:h-auto sm:max-h-[85vh]
          max-h-[100dvh] sm:max-h-[85vh]
          overflow-y-auto no-scrollbar
          bg-white dark:bg-[#0a0a0f]
          text-slate-900 dark:text-white
          border-0 sm:border sm:border-slate-200 dark:sm:border-white/10
          shadow-none sm:shadow-xl
          p-0 sm:p-6 gap-0
          flex flex-col
          safe-area-pt safe-area-pb
        "
        overlayClassName="bg-slate-900/70 backdrop-blur-md dark:bg-black/70"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Coach Letter</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
   LetterContent — the shared inner content rendered in both modes.
============================================================================ */

interface LetterContentProps {
  subject?: string;
  sections?: CoachLetterSectionInput;
  weekStart?: string;
  firstName?: string;
  model?: string;
  generatedAt?: string;
  readOnly: boolean;
  marked: boolean;
  marking: boolean;
  copying: boolean;
  sharing: boolean;
  reduceMotion: boolean | null;
  onMarkRead: () => void;
  onCopy: () => void;
  onShare: () => void;
  onClose?: () => void;
}

function LetterContent({
  subject,
  sections,
  weekStart,
  firstName,
  model,
  generatedAt,
  readOnly,
  marked,
  marking,
  copying,
  sharing,
  reduceMotion,
  onMarkRead,
  onCopy,
  onShare,
  onClose,
}: LetterContentProps) {
  const greeting = sections?.greeting ?? "";
  const intro = sections?.intro ?? "";
  const closing = sections?.closing ?? "";

  // Stagger delays — zeroed when reduceMotion is on
  const d = (i: number) => (reduceMotion ? 0 : 0.06 * i);
  const fadeUp = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };

  return (
    <>
      {/* Sticky mobile top bar (normal mode only) */}
      {!readOnly && (
        <div className="sm:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-12 bg-white/95 dark:bg-[#0a0a0f]/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-[#0a0a0f]/80 border-b border-slate-200 dark:border-white/5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-violet-600 dark:text-violet-300">
            <Mail className="w-3.5 h-3.5" />
            AI Coach Letter
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 -mr-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Desktop close button (top-right, normal mode only) */}
      {!readOnly && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="hidden sm:flex absolute top-4 right-4 w-9 h-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5 transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <motion.div
        initial={fadeUp.initial}
        animate={fadeUp.animate}
        transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
        className="flex-1 px-4 sm:px-6 pt-6 sm:pt-0 pb-4 min-h-0 sm:overflow-y-auto no-scrollbar"
      >
        {/* Week date header */}
        {weekStart && (
          <motion.div
            initial={fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.3, delay: d(0) }}
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300/80 mb-2"
          >
            Week of {formatWeekStart(weekStart)}
          </motion.div>
        )}

        {/* Subject */}
        <motion.h1
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.3, delay: d(1) }}
          className="text-2xl sm:text-3xl tracking-tight font-bold leading-tight text-slate-900 dark:text-white mb-3 sm:mb-4 pr-8"
        >
          {subject}
        </motion.h1>

        {/* Divider */}
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.3, delay: d(1) }}
          className="h-px bg-slate-200 dark:bg-white/10 mb-5 sm:mb-6"
        />

        {/* Greeting */}
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.3, delay: d(2) }}
          className="text-lg font-medium text-slate-800 dark:text-white/90 leading-relaxed mb-3"
        >
          <MarkdownBlock text={greeting} />
        </motion.div>

        {/* Intro */}
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.3, delay: d(3) }}
          className="text-base text-slate-700 dark:text-white/80 leading-relaxed mb-6 sm:mb-8"
        >
          <MarkdownBlock text={intro} />
        </motion.div>

        {/* Section blocks */}
        <div className="space-y-6 sm:space-y-8">
          {SECTION_DEFS.map((def, i) => {
            const Icon = def.icon;
            const body = sections?.[def.key] ?? "";
            return (
              <motion.section
                key={def.key}
                initial={fadeUp.initial}
                animate={fadeUp.animate}
                transition={{ duration: 0.3, delay: d(4 + i) }}
              >
                <h3 className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-white/60 mb-2">
                  <Icon className={`w-3.5 h-3.5 ${def.iconColor}`} />
                  {def.title}
                </h3>
                {def.callout ? (
                  <div className="bg-violet-50 dark:bg-violet-500/10 border-l-2 border-violet-500 pl-4 py-3 rounded-r-lg">
                    <div className="text-base text-slate-800 dark:text-white/90 leading-relaxed">
                      <MarkdownBlock text={body} />
                    </div>
                  </div>
                ) : (
                  <div className="text-base text-slate-700 dark:text-white/80 leading-relaxed">
                    <MarkdownBlock text={body} />
                  </div>
                )}
              </motion.section>
            );
          })}
        </div>

        {/* Closing */}
        {closing && (
          <motion.div
            initial={fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.3, delay: d(7) }}
            className="text-base text-slate-600 dark:text-white/75 leading-relaxed mt-6 sm:mt-8"
          >
            <MarkdownBlock text={closing} />
          </motion.div>
        )}

        {/* Sign-off */}
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.3, delay: d(8) }}
          className="mt-4 text-base text-slate-500 dark:text-white/70 italic"
        >
          — Your HabitFlow Coach{firstName ? `, ${firstName}` : ""}
        </motion.div>

        {/* Footer — normal mode only: [Copy] [Share] [Mark as read] */}
        {!readOnly && (
          <motion.div
            initial={fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.3, delay: d(9) }}
            className="flex flex-wrap items-center gap-2 mt-8 pt-5 border-t border-slate-200 dark:border-white/5"
          >
            <span className="text-[11px] text-slate-400 dark:text-white/40 mr-auto">
              {model && `${model} · `}
              {generatedAt && formatRelativeTime(generatedAt)}
            </span>

            <button
              type="button"
              onClick={onCopy}
              disabled={copying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white transition-colors disabled:opacity-50"
              aria-label="Copy letter"
            >
              {copying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy
            </button>

            <button
              type="button"
              onClick={onShare}
              disabled={sharing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white transition-colors disabled:opacity-50"
              aria-label="Share letter"
            >
              {sharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              Share
            </button>

            <button
              type="button"
              onClick={onMarkRead}
              disabled={marking || marked}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white transition-colors disabled:opacity-50"
              aria-label={marked ? "Marked as read" : "Mark as read"}
            >
              {marking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : marked ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {marked ? "Marked as read" : "Mark as read"}
            </button>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}

/* ============================================================================
   MarkdownBlock — wraps react-markdown for paragraph rendering with bold.
============================================================================ */

function MarkdownBlock({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-slate-700 dark:text-white/90">{children}</em>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 dark:text-violet-400 underline underline-offset-2"
          >
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/* ============================================================================
   Helpers
============================================================================ */

/** Formats an ISO week-start date ("2024-01-15") as "January 15, 2024". */
function formatWeekStart(iso: string): string {
  // Parse as local date to avoid TZ drift (weekStart has no time component)
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
  return `${diffDay}d ago`;
}

/** Builds a markdown rendering of the letter sections, used as a fallback
 *  when bodyMarkdown is not provided (e.g. cached letter missing the field). */
function buildFallbackMarkdown(
  subject: string | undefined,
  sections: CoachLetterSectionInput | undefined,
): string {
  const parts: string[] = [];
  if (subject) parts.push(`# ${subject}\n`);
  if (sections?.greeting) parts.push(sections.greeting);
  if (sections?.intro) parts.push(sections.intro);
  if (sections?.whatsWorking) {
    parts.push(`\n## What's working\n${sections.whatsWorking}`);
  }
  if (sections?.whereYouSlipped) {
    parts.push(`\n## Where you slipped\n${sections.whereYouSlipped}`);
  }
  if (sections?.experiment) {
    parts.push(`\n## One experiment for next week\n${sections.experiment}`);
  }
  if (sections?.closing) parts.push(`\n${sections.closing}`);
  parts.push("\n— Your HabitFlow Coach");
  return parts.join("\n\n");
}
