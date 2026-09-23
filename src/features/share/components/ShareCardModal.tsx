"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Download,
  Image as ImageIcon,
  Link2,
  Loader2,
  ShieldOff,
  ExternalLink,
  X,
} from "lucide-react";
import { toPng } from "html-to-image";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useShareCardData } from "@/features/share/hooks/useShareCardData";
import { ShareCard } from "./ShareCard";

export interface ShareCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVariant?: "portrait" | "landscape";
  onEnablePublicSharing?: () => void;
}

const PORTRAIT_W = 1080;
const PORTRAIT_H = 1350;
const LANDSCAPE_W = 1200;
const LANDSCAPE_H = 675;

export function ShareCardModal({
  open,
  onOpenChange,
  defaultVariant = "portrait",
  onEnablePublicSharing,
}: ShareCardModalProps) {
  const data = useShareCardData();
  const [variant, setVariant] = useState<"portrait" | "landscape">(defaultVariant);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<null | "download" | "copy-image" | "copy-link">(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (open) setVariant(defaultVariant);
  }, [open, defaultVariant]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const username = data.username || "";
    return `${window.location.origin}/share/${username}`;
  }, [data.username]);

  async function handleDownloadPng() {
    if (!cardRef.current || busy) return;
    setBusy("download");
    try {
      // Ensure fonts are loaded before snapshot
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      const username = data.username || "user";
      a.download = `habitflow-${username}-${date}.png`;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("PNG downloaded", { description: a.download });
    } catch (e) {
      toast.error("Could not export PNG", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handleCopyImage() {
    if (!cardRef.current || busy) return;
    setBusy("copy-image");
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const ClipboardCtor =
        (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (!ClipboardCtor || !navigator.clipboard || !navigator.clipboard.write) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `habitflow-card-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast("Image copied as download", {
          description: "Your browser can't copy images to clipboard — downloaded instead.",
        });
        return;
      }
      await navigator.clipboard.write([new ClipboardCtor({ "image/png": blob })]);
      toast.success("Image copied", { description: "Paste it anywhere — try Ctrl/Cmd+V." });
    } catch (e) {
      toast.error("Could not copy image", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handleCopyLink() {
    if (busy) return;
    setBusy("copy-link");
    try {
      if (!shareUrl) {
        toast.error("No share link yet");
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied", { description: shareUrl });
    } catch (e) {
      toast.error("Could not copy link", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          fixed inset-0 translate-x-0 translate-y-0
          sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          rounded-none sm:rounded-2xl
          max-w-none sm:max-w-[640px] w-full sm:w-auto
          h-[100dvh] sm:h-auto sm:max-h-[92vh]
          max-h-[100dvh] sm:max-h-[92vh]
          overflow-hidden
          p-0 sm:p-5 gap-0
          flex flex-col
          safe-area-pt
          bg-white dark:bg-[#0a0a0f]
          border-0 sm:border sm:border-slate-200 dark:sm:border-white/10
          shadow-none sm:shadow-xl
        "
        overlayClassName="bg-slate-900/70 backdrop-blur-sm dark:bg-black/70"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Share card</DialogTitle>
        <DialogDescription className="sr-only">
          Preview your HabitFlow share card and download or copy it.
        </DialogDescription>

        {/* Mobile sticky top bar */}
        <div className="sm:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-12 border-b border-slate-200 dark:border-white/5 bg-white/95 dark:bg-[#0a0a0f]/95 backdrop-blur">
          <span className="text-sm font-semibold">Your share card</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop header */}
        <div className="hidden sm:flex items-center justify-between gap-3 pr-8 px-1">
          <div>
            <h2 className="text-lg font-semibold leading-tight">Your share card</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Screenshot-worthy stats, ready for social.
            </p>
          </div>
          <AspectToggle
            value={variant}
            onChange={setVariant}
            shouldReduceMotion={!!shouldReduceMotion}
          />
        </div>

        {/* Mobile aspect toggle */}
        <div className="sm:hidden px-4 py-3">
          <AspectToggle
            value={variant}
            onChange={setVariant}
            shouldReduceMotion={!!shouldReduceMotion}
          />
        </div>

        {/* Card preview — scaled to fit */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2 sm:mx-0 sm:px-1">
          {data.loading ? (
            <PreviewSkeleton variant={variant} />
          ) : (
            <CardPreview variant={variant} cardRef={cardRef}>
              <ShareCard data={data} variant={variant} />
            </CardPreview>
          )}
        </div>

        {/* Action grid — 3 buttons only (no LinkedIn, no Share to X) */}
        <div className="px-4 sm:px-1 py-3 sm:pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              onClick={handleDownloadPng}
              disabled={data.loading || busy !== null}
              className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white border-0"
            >
              {busy === "download" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download PNG
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyImage}
              disabled={data.loading || busy !== null}
            >
              {busy === "copy-image" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4 mr-2" />
              )}
              Copy image
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              disabled={data.loading || busy !== null}
            >
              {busy === "copy-link" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Copy link
            </Button>
          </div>

          {/* Privacy notice */}
          <div className="mt-3 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-white/[0.03] p-3 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldOff className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
            <div>
              <p className="text-foreground/80 font-medium">Your share card is private by default.</p>
              <p className="mt-0.5 hidden sm:block">
                Downloading a PNG works without sharing publicly. To get a public link at{" "}
                <code className="px-1 py-0.5 rounded bg-muted text-[10px]">/share/&lt;username&gt;</code>, enable public sharing.
              </p>
              {onEnablePublicSharing && (
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onEnablePublicSharing();
                  }}
                  className="inline-flex items-center gap-1 mt-1.5 text-violet-600 dark:text-violet-300 hover:underline font-medium"
                >
                  Enable public sharing
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
   AspectToggle — pill-style Portrait / Landscape switcher
============================================================================ */
function AspectToggle({
  value,
  onChange,
  shouldReduceMotion,
}: {
  value: "portrait" | "landscape";
  onChange: (v: "portrait" | "landscape") => void;
  shouldReduceMotion: boolean;
}) {
  return (
    <div className="inline-flex rounded-full p-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 gap-1 w-full sm:w-auto">
      {(["portrait", "landscape"] as const).map((v) => {
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={
              "relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-1 sm:flex-none " +
              (active
                ? "text-violet-700 dark:text-violet-200"
                : "text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/80")
            }
            aria-pressed={active}
          >
            {active && (
              <motion.div
                layoutId={shouldReduceMotion ? undefined : "share-card-aspect"}
                className="absolute inset-0 rounded-full bg-violet-500/15 ring-1 ring-violet-500/30 dark:ring-violet-500/40"
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              {v === "portrait" ? (
                <>
                  <span className="inline-block w-2.5 h-3.5 rounded-[2px] bg-current" />
                  Portrait
                </>
              ) : (
                <>
                  <span className="inline-block w-3.5 h-2.5 rounded-[2px] bg-current" />
                  Landscape
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
   CardPreview — scales the full-res card down to fit the modal.
   Uses CSS transform: scale() so the card itself isn't reflowed.
   On mobile, the target width is smaller (calculated from viewport).
============================================================================ */
function CardPreview({
  variant,
  cardRef,
  children,
}: {
  variant: "portrait" | "landscape";
  cardRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const isPortrait = variant === "portrait";
  const w = isPortrait ? PORTRAIT_W : LANDSCAPE_W;
  const h = isPortrait ? PORTRAIT_H : LANDSCAPE_H;

  // Responsive target width: smaller on mobile (use CSS to detect via
  // a simple calc — 92vw capped at 480px for desktop).
  // We render at a fixed target and let the container scroll if needed.
  const targetWidth = typeof window !== "undefined" && window.innerWidth < 640
    ? Math.min(window.innerWidth - 32, 400)
    : 480;
  const scale = targetWidth / w;
  const scaledHeight = Math.round(h * scale);

  return (
    <div
      style={{
        width: targetWidth,
        height: scaledHeight,
        maxWidth: "100%",
        position: "relative",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: w,
          height: h,
          position: "absolute",
          top: 0,
          left: 0,
          overflow: "hidden",
          boxShadow: "0 24px 60px -28px rgba(0,0,0,0.55)",
        }}
      >
        <div ref={cardRef} style={{ width: w, height: h }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PreviewSkeleton — shown while useShareCardData loads
============================================================================ */
function PreviewSkeleton({ variant }: { variant: "portrait" | "landscape" }) {
  const isPortrait = variant === "portrait";
  const w = isPortrait ? PORTRAIT_W : LANDSCAPE_W;
  const h = isPortrait ? PORTRAIT_H : LANDSCAPE_H;
  const targetWidth = typeof window !== "undefined" && window.innerWidth < 640
    ? Math.min(window.innerWidth - 32, 400)
    : 480;
  const scaledHeight = Math.round((h * targetWidth) / w);
  return (
    <div
      style={{ width: targetWidth, height: scaledHeight, maxWidth: "100%", margin: "0 auto" }}
      className="bg-slate-200 dark:bg-white/5 animate-pulse"
    />
  );
}
