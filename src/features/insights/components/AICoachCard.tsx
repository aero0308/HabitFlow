"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GlowingBorder } from "./GlowingBorder";
import { useNav } from "@/lib/nav-store";
import ReactMarkdown from "react-markdown";

/* ============================================================================
   AICoachCard — premium AI Coach card for the Insights page top.
   ----------------------------------------------------------------------------
   Three states:
     1. No API key → polished empty state with "Add AI key →" CTA
     2. Loading/generating → skeleton shimmer with "Analyzing your week..."
     3. Narrative ready → markdown render with meta row + regenerate button
============================================================================ */

interface WeeklyInsightResponse {
  narrative: string | null;
  model?: string;
  generatedAt?: string;
  readAt?: string | null;
  cached?: boolean;
  reason?: string;
  detail?: string;
}

export function AICoachCard() {
  const [data, setData] = useState<WeeklyInsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { go } = useNav();

  const fetchInsight = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/weekly");
      const json = await res.json();
      if (json.detail && !json.narrative) {
        setError(json.detail);
      }
      setData(json);
    } catch {
      setError("Failed to load insight");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/weekly/regenerate", {
        method: "POST",
      });
      const json = await res.json();
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

  const noApiKey = data?.reason === "no_api_key";
  const hasNarrative = !!data?.narrative;
  const weekNum = getWeekNumber();

  return (
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
            <Sparkles className="w-3 h-3" />
            <span>AI Coach · Week {weekNum}</span>
          </div>
          {hasNarrative && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              title="Regenerate insight"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
            >
              {regenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Body — three states */}
        {loading ? (
          <LoadingState />
        ) : noApiKey ? (
          <EmptyState onAddKey={() => go({ name: "settings" })} />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRegenerate} />
        ) : hasNarrative ? (
          <NarrativeState
            narrative={data!.narrative!}
            model={data!.model}
            generatedAt={data!.generatedAt}
            isNew={!data?.readAt || (Date.now() - new Date(data.generatedAt || "").getTime() < 60000)}
          />
        ) : null}
      </GlowingBorder>
    </motion.div>
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
        <Sparkles className="w-8 h-8 text-violet-400" />
      </motion.div>
      <h3 className="text-lg font-semibold text-white mb-2">
        Unlock personalized insights
      </h3>
      <p className="text-sm text-white/50 mb-5 max-w-md leading-relaxed">
        Bring your own AI key to get a weekly narrative that connects your
        habits, mood, and patterns.
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
        <span className="text-sm text-white/50">Analyzing your week...</span>
      </div>
      {[80, 95, 70].map((w, i) => (
        <div
          key={i}
          className="h-4 rounded-md bg-white/5 overflow-hidden relative"
          style={{ width: `${w}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   State 3: Narrative ready
============================================================================ */

function NarrativeState({
  narrative,
  model,
  generatedAt,
  isNew,
}: {
  narrative: string;
  model?: string;
  generatedAt?: string;
  isNew?: boolean;
}) {
  const paragraphs = narrative.split("\n\n").filter(Boolean);

  return (
    <div>
      <div className="space-y-4 max-w-3xl">
        {paragraphs.map((para, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="text-[15px] md:text-base leading-relaxed text-white/85"
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p>{children}</p>,
                strong: ({ children }) => (
                  <strong className="text-white font-semibold">{children}</strong>
                ),
              }}
            >
              {para}
            </ReactMarkdown>
          </motion.div>
        ))}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/5">
        {isNew && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-400">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            NEW
          </span>
        )}
        <span className="text-[10px] text-white/40">
          {model && `${model} · `}
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
      <p className="text-sm text-white/60 mb-4">{error}</p>
      <Button
        onClick={onRetry}
        variant="outline"
        size="sm"
        className="border-white/10 text-white/80 hover:bg-white/5"
      >
        Try again
      </Button>
    </div>
  );
}

/* ============================================================================
   Helpers
============================================================================ */

function getWeekNumber(): number {
  const date = new Date();
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
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
