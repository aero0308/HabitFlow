"use client";

import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, Trash2, Play, Pause, Lock, ListMusic, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useMusicStore, isDefaultTrack, type Track } from "./musicStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatTime(s: number): string {
  if (!s || !isFinite(s) || s <= 0) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function trackDuration(track: Track, durations: Record<string, number>): number {
  const fromMap = durations[track.id];
  if (fromMap && isFinite(fromMap) && fromMap > 0) return fromMap;
  if (isFinite(track.duration) && track.duration > 0) return track.duration;
  return 0;
}

/**
 * Large playlist overlay covering the main content area.
 *
 * - Rendered at the app-shell level (not inside the Pomodoro card) so it
 *   can grow to the full main content area without being clipped.
 * - Fixed positioning: top-14 (clears the 14px header), bottom-0,
 *   left-0 right-0 (mobile) / lg:left-60 (desktop sidebar is 240px = w-60).
 * - Backdrop dims + click-to-close.
 * - Panel: header (Playlist + Add track + X), now-playing card, scrollable
 *   track list with per-track delete (built-in tracks can't be deleted).
 * - Upload progress shown as a spinner + progress bar above the list.
 * - Body scroll locked while open.
 * - `initial={false}` on motion.divs so open/close is instant (no jitter).
 */
export function PlaylistOverlay() {
  const open = useMusicStore((s) => s.playlistOpen);
  const setOpen = useMusicStore((s) => s.setPlaylistOpen);
  const playlist = useMusicStore((s) => s.playlist);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const durations = useMusicStore((s) => s.durations);
  const uploadProgress = useMusicStore((s) => s.uploadProgress);
  const selectTrack = useMusicStore((s) => s.selectTrack);
  const removeTrack = useMusicStore((s) => s.removeTrack);
  const uploadTrack = useMusicStore((s) => s.uploadTrack);
  const setPlaying = useMusicStore((s) => s.setPlaying);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ===== Lock body scroll while open =====
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Close when clicking outside the panel AND outside the music modal
  // (the sidebar pomodoro card, marked with [data-music-modal]). This lets
  // the user interact with the music player controls while the playlist is
  // open, but closes the playlist when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const panel = panelRef.current;
      const musicModal = document.querySelector("[data-music-modal]");
      if (panel?.contains(e.target as Node)) return;
      if (musicModal?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, setOpen]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const file of files) {
      try {
        const t = await uploadTrack(file);
        toast.success("Track added", { description: t.title });
      } catch (err) {
        toast.error("Upload failed", {
          description: (err as Error).message || file.name,
        });
      }
    }
  }

  const currentTrack = playlist[currentTrackIndex];
  const uploading = uploadProgress !== null;
  const progressPct =
    uploading && uploadProgress!.total > 0
      ? Math.round((uploadProgress!.chunk / uploadProgress!.total) * 100)
      : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="playlist-overlay-root"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed top-14 bottom-0 right-0 left-0 lg:left-60 z-50 flex"
        >
          {/* Backdrop — click to close */}
          <motion.button
            type="button"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close playlist"
            tabIndex={-1}
          />

          {/* Panel — slides up from bottom on mobile, anchored right on desktop */}
          <motion.div
            ref={panelRef}
            initial={false}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="relative ml-auto w-full sm:max-w-md h-full bg-popover border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Playlist</h3>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {playlist.length} {playlist.length === 1 ? "track" : "tracks"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs font-medium text-violet-500 dark:text-violet-400 hover:text-violet-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Add track
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close playlist"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Now-playing card */}
            {currentTrack && (
              <div className="px-4 py-3 border-b border-border bg-muted/40 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPlaying(!isPlaying)}
                    className="w-9 h-9 rounded-full bg-violet-500 hover:bg-violet-500/90 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 transition-colors flex-shrink-0"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" fill="currentColor" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Now playing
                    </p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {currentTrack.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {currentTrack.artist}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                    {formatTime(trackDuration(currentTrack, durations))}
                  </span>
                </div>
              </div>
            )}

            {/* Upload progress (when active) */}
            {uploading && (
              <div className="px-4 py-2.5 border-b border-border bg-violet-500/5 flex-shrink-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                  <span className="text-xs text-foreground font-medium truncate flex-1">
                    Uploading {uploadProgress!.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {uploadProgress!.chunk}/{uploadProgress!.total} · {progressPct}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-[width] duration-150"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Track list */}
            <div className="flex-1 overflow-y-auto custom-scroll min-h-0">
              {playlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                  <UploadCloud className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">No tracks yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add your favorite lofi tracks to focus to.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 text-xs font-medium text-violet-500 dark:text-violet-400 hover:text-violet-400"
                  >
                    Click to upload music
                  </button>
                </div>
              ) : (
                <div className="py-1">
                  {playlist.map((t, i) => {
                    const isCurrent = i === currentTrackIndex;
                    const isBuiltin = isDefaultTrack(t);
                    const dur = trackDuration(t, durations);
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "group flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-colors",
                          isCurrent
                            ? "bg-violet-500/10"
                            : "hover:bg-muted/60",
                        )}
                        onClick={() => selectTrack(i)}
                      >
                        {/* Play/now-playing indicator */}
                        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0">
                          {isCurrent && isPlaying ? (
                            <div className="flex items-end gap-[1.5px] h-3.5">
                              <div
                                className="w-[2px] bg-violet-500 rounded-full"
                                style={{ height: "60%", animation: "pulse 1.2s ease-in-out infinite" }}
                              />
                              <div
                                className="w-[2px] bg-violet-500 rounded-full"
                                style={{ height: "100%", animation: "pulse 1.2s ease-in-out infinite 0.2s" }}
                              />
                              <div
                                className="w-[2px] bg-violet-500 rounded-full"
                                style={{ height: "40%", animation: "pulse 1.2s ease-in-out infinite 0.4s" }}
                              />
                            </div>
                          ) : isCurrent ? (
                            <Play className="w-3 h-3 text-violet-500" fill="currentColor" />
                          ) : (
                            <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-center">
                              {i + 1}
                            </span>
                          )}
                        </div>

                        {/* Title + artist */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-xs truncate",
                              isCurrent
                                ? "text-violet-500 dark:text-violet-400 font-medium"
                                : "text-foreground",
                            )}
                          >
                            {t.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {t.artist}
                          </p>
                        </div>

                        {/* Built-in lock badge OR delete button */}
                        {isBuiltin ? (
                          <span
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/60 flex-shrink-0"
                            title="Built-in track — cannot be deleted"
                          >
                            <Lock className="w-3 h-3" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTrack(t.id);
                              toast("Track removed", { description: t.title });
                            }}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-muted-foreground/60 hover:text-red-500 transition-all flex-shrink-0"
                            aria-label={`Delete ${t.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Duration */}
                        <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0 w-12 text-right">
                          {formatTime(dur)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer hint */}
            {playlist.length > 0 && (
              <div className="px-4 py-2 border-t border-border bg-muted/30 flex-shrink-0">
                <p className="text-[10px] text-muted-foreground text-center">
                  Click a track to play · Built-in tracks can&apos;t be removed
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
