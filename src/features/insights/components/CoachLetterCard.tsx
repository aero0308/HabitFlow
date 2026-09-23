"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Mail,
  RefreshCw,
  ArrowRight,
  Loader2,
  AlertCircle,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowingBorder } from "./GlowingBorder";
import { useNav } from "@/lib/nav-store";
import { CoachLetterModal, type CoachLetterSections } from "./CoachLetterModal";

/* ============================================================================
   CoachLetterCard — premium preview card on the Insights page.
   ----------------------------------------------------------------------------
   Three states:
     1. No API key → polished empty state with "Add AI key →" CTA
     2. Loading/generating → skeleton shimmer with "Writing your letter..."
     3. Letter ready → preview (subject + first 2 lines of intro) +
        "Read full letter →" button → opens CoachLetterModal
============================================================================ */

interface CoachLetterPayload {
  id: string;
  weekStart: string;
  subject: string;
  bodyMarkdown: string;
  sections: string; // JSON string
  model: string;
  tokensUsed: number | null;
  generatedAt: string;
  readAt: string | null;
  shareToken: string | null;
}

interface CoachLetterResponse {
  letter: CoachLetterPayload | null;
  cached?: boolean;
  reason?: string;
  detail?: string;
}

export function CoachLetterCard() {
  const [data, setData] = useState<CoachLetterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { go } = useNav();

  const fetchLetter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/coach-letter");
      const json: CoachLetterResponse = await res.json();
      if (json.detail && !json.letter) {
        setError(json.detail);
      }
      setData(json);
    } catch {
      setError("Failed to load letter");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLetter();
  }, [fetchLetter]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/coach-letter/regenerate", {
        method: "POST",
      });
      const json: CoachLetterResponse = await res.json();
      if (json.detail) {
        setError(json.detail);
      } else {
        setData(json);
      }
    } catch {
      setError("Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  }, []);

  const handleShare = useCallback(async () => {
    const week = data?.letter?.weekStart;
    if (!week) return;
    setSharing(true);
    try {
      const res = await fetch(
        `/api/insights/coach-letter/share?week=${encodeURIComponent(week)}`,
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
        // Clipboard may be blocked — still surface the URL via a toast
        toast(json.shareUrl, {
          description: "Copy this share link",
        });
      }
    } catch {
      toast.error("Couldn't create share link");
    } finally {
      setSharing(false);
    }
  }, [data?.letter?.weekStart]);

  const handleOpenLetter = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleCloseLetter = useCallback(() => {
    setModalOpen(false);
    // Re-fetch so readAt reflects "marked read" status
    fetchLetter();
  }, [fetchLetter]);

  const noApiKey = data?.reason === "no_api_key";
  const hasLetter = !!data?.letter;
  const weekNum = getWeekNumber();

  // Parse sections for modal render (only if letter exists)
  const parsedSections: CoachLetterSections | null = (() => {
    if (!data?.letter?.sections) return null;
    try {
      return JSON.parse(data.letter.sections) as CoachLetterSections;
    } catch {
      return null;
    }
  })();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8"
      >
        <GlowingBorder className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400">
              <Mail className="w-3 h-3" />
              <span>AI Coach · Week {weekNum}</span>
            </div>
            {hasLetter && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing}
                  title="Share letter"
                  aria-label="Share letter"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5 transition-colors disabled:opacity-30"
                >
                  {sharing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  title="Regenerate letter"
                  aria-label="Regenerate letter"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5 transition-colors disabled:opacity-30"
                >
                  {regenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Body — three states */}
          {loading ? (
            <LoadingState />
          ) : noApiKey ? (
            <EmptyState onAddKey={() => go({ name: "settings" })} />
          ) : error ? (
            <ErrorState error={error} onRetry={handleRegenerate} />
          ) : hasLetter && data.letter ? (
            <PreviewState
              letter={data.letter}
              onOpen={handleOpenLetter}
            />
          ) : null}
        </GlowingBorder>
      </motion.div>

      {/* Full-screen letter modal */}
      {hasLetter && data.letter && parsedSections && (
        <CoachLetterModal
          open={modalOpen}
          onOpenChange={(o) => {
            if (!o) handleCloseLetter();
            else setModalOpen(true);
          }}
          subject={data.letter.subject}
          sections={parsedSections}
          model={data.letter.model}
          generatedAt={data.letter.generatedAt}
          readAt={data.letter.readAt}
          weekStart={data.letter.weekStart}
          bodyMarkdown={data.letter.bodyMarkdown}
        />
      )}
    </>
  );
}

/* ============================================================================
   State 1: No API key
============================================================================ */

function EmptyState({ onAddKey }: { onAddKey: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4"
      >
        <Mail className="w-8 h-8 text-violet-400" />
      </motion.div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Your weekly coach letter
      </h3>
      <p className="text-sm text-slate-500 dark:text-white/50 mb-5 max-w-md leading-relaxed">
        A short, structured note from your AI coach every Monday. What worked,
        where you slipped, and one experiment for next week.
      </p>
      <Button
        onClick={onAddKey}
        className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white border-0"
      >
        Add AI key
        <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </div>
  );
}

/* ============================================================================
   State 2: Loading / generating
============================================================================ */

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
        <span className="text-sm text-slate-500 dark:text-white/50">Writing your letter...</span>
      </div>
      <div className="h-5 rounded-md bg-slate-100 dark:bg-white/5 overflow-hidden relative w-2/3">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent animate-pulse" />
      </div>
      <div className="h-3 rounded-md bg-slate-100 dark:bg-white/5 overflow-hidden relative w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent animate-pulse" />
      </div>
      <div className="h-3 rounded-md bg-slate-100 dark:bg-white/5 overflow-hidden relative w-11/12">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent animate-pulse" />
      </div>
      <div className="h-3 rounded-md bg-slate-100 dark:bg-white/5 overflow-hidden relative w-4/5">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent animate-pulse" />
      </div>
    </div>
  );
}

/* ============================================================================
   State 3: Letter ready — preview
============================================================================ */

function PreviewState({
  letter,
  onOpen,
}: {
  letter: CoachLetterPayload;
  onOpen: () => void;
}) {
  // Parse sections for the preview (intro snippet)
  let intro = "";
  try {
    const s = JSON.parse(letter.sections) as { intro?: string };
    intro = s.intro ?? "";
  } catch {
    intro = "";
  }
  // First 2 lines, truncated to ~180 chars
  const snippet = truncate(intro.replace(/\n+/g, " "), 180);

  const isNew = !letter.readAt;
  const generatedAt = letter.generatedAt;

  return (
    <div>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left group"
        aria-label="Read full letter"
      >
        <h3 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white mb-2 leading-snug group-hover:text-violet-200 transition-colors">
          {letter.subject}
        </h3>
        <p className="text-sm text-slate-700 dark:text-white/65 leading-relaxed mb-1 line-clamp-3">
          {snippet}
        </p>
        <div className="flex items-center gap-1 text-violet-400 text-sm font-medium group-hover:gap-2 transition-all">
          Read full letter
          <ArrowRight className="w-4 h-4" />
        </div>
      </button>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-200 dark:border-white/5">
        {isNew && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-400">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            NEW
          </span>
        )}
        <span className="text-[10px] text-slate-500 dark:text-white/40">
          {letter.model && `${letter.model} · `}
          {generatedAt && formatRelativeTime(generatedAt)}
        </span>
      </div>
    </div>
  );
}

/* ============================================================================
   Error state
============================================================================ */

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      <AlertCircle className="w-10 h-10 text-red-400/60 mb-3" />
      <p className="text-sm text-slate-600 dark:text-white/60 mb-4">{error}</p>
      <Button
        onClick={onRetry}
        variant="outline"
        size="sm"
        className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-white/5"
      >
        Try again
      </Button>
    </div>
  );
}

/* ============================================================================
   Helpers
============================================================================ */

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function getWeekNumber(): number {
  const date = new Date();
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 60 * 60 * 1000));
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

/* Re-export for type-only imports elsewhere */
export type { CoachLetterSections };
