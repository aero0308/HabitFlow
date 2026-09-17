"use client";

import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, Trash2, Play } from "lucide-react";
import { useRef } from "react";
import { useMusicStore } from "./musicStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface PlaylistModalProps {
  open: boolean;
  onClose: () => void;
}

export function PlaylistModal({ open, onClose }: PlaylistModalProps) {
  const playlist = useMusicStore((s) => s.playlist);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const durations = useMusicStore((s) => s.durations);
  const selectTrack = useMusicStore((s) => s.selectTrack);
  const removeTrack = useMusicStore((s) => s.removeTrack);
  const addTrack = useMusicStore((s) => s.addTrack);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    addTrack({ id: `upload-${Date.now()}`, title: file.name.replace(/\.[^.]+$/, ""), artist: "Local File", url, duration: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Track added");
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          className="absolute inset-0 z-30 rounded-xl bg-card border border-border shadow-lg flex flex-col"
        >
          {/* Header — no music icon, just "Playlist" text. Slightly bigger Add button. */}
          <div className="flex items-center justify-between px-4 h-11 border-b border-border flex-shrink-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold text-foreground">Playlist</h3>
              <span className="text-[10px] text-muted-foreground">({playlist.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs font-medium text-violet-500 dark:text-violet-400 hover:text-violet-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10"
              >
                <UploadCloud className="w-3.5 h-3.5" /> Add
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close playlist"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Track list */}
          <div className="flex-1 overflow-y-auto p-2">
            {playlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <UploadCloud className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No tracks yet</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-violet-500 dark:text-violet-400 hover:text-violet-400"
                >
                  Click to upload music
                </button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {playlist.map((t, i) => {
                  const isCurrent = i === currentTrackIndex;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors",
                        isCurrent ? "bg-violet-500/10" : "hover:bg-muted/50"
                      )}
                      onClick={() => { selectTrack(i); onClose(); }}
                    >
                      {/* Play/Now playing indicator */}
                      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0">
                        {isCurrent && isPlaying ? (
                          <div className="flex items-end gap-[1px] h-3">
                            <div className="w-[2px] bg-violet-500 rounded-full animate-pulse" style={{ height: "60%" }} />
                            <div className="w-[2px] bg-violet-500 rounded-full animate-pulse" style={{ height: "100%" }} />
                            <div className="w-[2px] bg-violet-500 rounded-full animate-pulse" style={{ height: "40%" }} />
                          </div>
                        ) : isCurrent ? (
                          <Play className="w-3 h-3 text-violet-500" fill="currentColor" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground tabular-nums">{i + 1}</span>
                        )}
                      </div>

                      {/* Title */}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs truncate", isCurrent ? "text-violet-500 font-medium" : "text-foreground")}>
                          {t.title}
                        </p>
                        <p className="text-[9px] text-muted-foreground truncate">{t.artist}</p>
                      </div>

                      {/* Duration — prefer the real (loaded) duration */}
                      <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                        {formatTime(durations[t.id] ?? t.duration)}
                      </span>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeTrack(t.id); }}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-red-400 transition-all flex-shrink-0"
                        aria-label={`Delete ${t.title}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
