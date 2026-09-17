"use client";

import { create } from "zustand";

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  isBuiltIn?: boolean;
}

export type RepeatMode = "off" | "all" | "one";

const BUILT_IN_TRACKS: Track[] = [
  { id: "builtin-1", title: "Midnight Reverie", artist: "DesiFreeMusic", url: "/audio/midnight-reverie.mp3", duration: 228, isBuiltIn: true },
  { id: "builtin-2", title: "Soft Focus", artist: "DesiFreeMusic", url: "/audio/soft-focus.mp3", duration: 252, isBuiltIn: true },
  { id: "builtin-3", title: "Deep Work", artist: "Alex Morgan", url: "/audio/deep-work.mp3", duration: 330, isBuiltIn: true },
];

export const BUILT_IN_TRACK_IDS: Set<string> = new Set(BUILT_IN_TRACKS.map((t) => t.id));

export function isDefaultTrack(track: Track | undefined | null): boolean {
  return !!track && BUILT_IN_TRACK_IDS.has(track.id);
}

interface MusicState {
  activeUserId: string | null;
  playlist: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  durations: Record<string, number>;
  playlistOpen: boolean;
  uploadProgress: { name: string; chunk: number; total: number } | null;

  setActiveUser: (userId: string | null) => Promise<void>;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  uploadTrack: (file: File) => Promise<Track>;
  removeTrack: (id: string) => Promise<void>;
  selectTrack: (index: number) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setPlaying: (p: boolean) => void;
  setTrackDuration: (id: string, d: number) => void;
  setPlaylistOpen: (v: boolean) => void;
}

function prefsKey(userId: string): string { return `habitflow-music-prefs-${userId}`; }
function loadPrefs(userId: string): { volume?: number; shuffle?: boolean; repeat?: RepeatMode } {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(prefsKey(userId)) || "{}"); } catch { return {}; }
}
function savePrefs(userId: string, prefs: { volume: number; shuffle: boolean; repeat: RepeatMode }) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(prefsKey(userId), JSON.stringify(prefs)); } catch {}
}

async function fetchUserUploads(): Promise<Track[]> {
  try {
    const res = await fetch("/api/music/uploads", { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.uploads || []).map((u: { id: string; title: string; url: string; duration: number | null }) => ({
      id: u.id, title: u.title, artist: "Your upload", url: u.url, duration: u.duration ?? 0,
    }));
  } catch { return []; }
}

async function reconcileUploads(get: () => MusicState, set: (partial: Partial<MusicState> | ((s: MusicState) => Partial<MusicState>)) => void): Promise<Track | null> {
  const fresh = await fetchUserUploads();
  const existingIds = new Set(get().playlist.map((t) => t.id));
  const newOnes = fresh.filter((t) => !existingIds.has(t.id));
  if (newOnes.length === 0) return null;
  set((s) => {
    const builtIns = s.playlist.filter((t) => t.isBuiltIn);
    const existingUploads = s.playlist.filter((t) => !t.isBuiltIn);
    return { playlist: [...builtIns, ...existingUploads, ...newOnes], currentTrackIndex: s.playlist.length, currentTime: 0, isPlaying: true };
  });
  return newOnes[newOnes.length - 1];
}

export const useMusicStore = create<MusicState>((set, get) => ({
  activeUserId: null,
  playlist: BUILT_IN_TRACKS,
  currentTrackIndex: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.78,
  shuffle: false,
  repeat: "off",
  durations: {},
  playlistOpen: false,
  uploadProgress: null,

  setActiveUser: async (userId) => {
    if (!userId) {
      const prev = get().activeUserId;
      if (prev) savePrefs(prev, { volume: get().volume, shuffle: get().shuffle, repeat: get().repeat });
      set({ activeUserId: null, playlist: BUILT_IN_TRACKS, currentTrackIndex: 0, currentTime: 0, isPlaying: false, durations: {} });
      return;
    }
    const prefs = loadPrefs(userId);
    const uploads = await fetchUserUploads();
    set({
      activeUserId: userId,
      playlist: [...BUILT_IN_TRACKS, ...uploads],
      currentTrackIndex: 0, currentTime: 0, isPlaying: false, durations: {},
      volume: prefs.volume ?? 0.78, shuffle: prefs.shuffle ?? false, repeat: prefs.repeat ?? "off",
    });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { playlist, currentTrackIndex, shuffle, activeUserId } = get();
    if (playlist.length === 0) return;
    if (activeUserId) savePrefs(activeUserId, { volume: get().volume, shuffle: get().shuffle, repeat: get().repeat });
    if (shuffle) {
      let idx = currentTrackIndex;
      while (idx === currentTrackIndex && playlist.length > 1) idx = Math.floor(Math.random() * playlist.length);
      set({ currentTrackIndex: idx, currentTime: 0, isPlaying: true });
    } else {
      set({ currentTrackIndex: (currentTrackIndex + 1) % playlist.length, currentTime: 0, isPlaying: true });
    }
  },

  prev: () => {
    const { playlist, currentTrackIndex, activeUserId } = get();
    if (playlist.length === 0) return;
    if (activeUserId) savePrefs(activeUserId, { volume: get().volume, shuffle: get().shuffle, repeat: get().repeat });
    set({ currentTrackIndex: (currentTrackIndex - 1 + playlist.length) % playlist.length, currentTime: 0, isPlaying: true });
  },

  seek: (time) => set({ currentTime: time }),
  setVolume: (v) => {
    set({ volume: Math.max(0, Math.min(1, v)) });
    const uid = get().activeUserId;
    if (uid) savePrefs(uid, { volume: get().volume, shuffle: get().shuffle, repeat: get().repeat });
  },
  toggleShuffle: () => {
    set((s) => ({ shuffle: !s.shuffle }));
    const uid = get().activeUserId;
    if (uid) savePrefs(uid, { volume: get().volume, shuffle: get().shuffle, repeat: get().repeat });
  },
  cycleRepeat: () => {
    set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" }));
    const uid = get().activeUserId;
    if (uid) savePrefs(uid, { volume: get().volume, shuffle: get().shuffle, repeat: get().repeat });
  },

  uploadTrack: async (file) => {
    const CHUNK_SIZE = 1024 * 1024;
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const mime = file.type || "audio/mpeg";
    let finalUpload: { id: string; title: string; url: string; duration: number | null } | null = null;
    set({ uploadProgress: { name: file.name, chunk: 0, total: totalChunks } });
    try {
      for (let i = 0; i < totalChunks; i++) {
        set({ uploadProgress: { name: file.name, chunk: i + 1, total: totalChunks } });
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const params = new URLSearchParams({ uploadId, chunkIndex: String(i), totalChunks: String(totalChunks), fileName: file.name, mime, totalSize: String(file.size) });
        let ok = false;
        let errMsg: string | null = null;
        for (let attempt = 0; attempt < 3 && !ok; attempt++) {
          try {
            const res = await fetch(`/api/music/upload-chunk?${params}`, { method: "POST", body: chunk, credentials: "include", headers: { "Content-Type": "application/octet-stream" } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              if (res.status === 422) throw new Error(data.detail || "Upload rejected");
              errMsg = `chunk ${i + 1}/${totalChunks} failed (${res.status})`;
              continue;
            }
            ok = true;
            if (data.upload) finalUpload = data.upload;
          } catch (e) {
            errMsg = (e as Error).message || `chunk ${i + 1}/${totalChunks} failed`;
            if ((e as Error).message?.includes("too large") || (e as Error).message?.includes("Only audio")) throw e;
          }
        }
        if (!ok) {
          const reconciled = await reconcileUploads(get, set);
          if (reconciled) return reconciled;
          throw new Error(errMsg ? `Upload failed: ${errMsg}` : "Upload failed — try a smaller file.");
        }
      }
      if (!finalUpload) {
        const reconciled = await reconcileUploads(get, set);
        if (reconciled) return reconciled;
        throw new Error("Upload completed but no track was returned.");
      }
      const t: Track = { id: finalUpload.id, title: finalUpload.title, artist: "Your upload", url: finalUpload.url, duration: finalUpload.duration ?? 0 };
      set((s) => ({ playlist: [...s.playlist, t], currentTrackIndex: s.playlist.length, currentTime: 0, isPlaying: true }));
      return t;
    } finally {
      set({ uploadProgress: null });
    }
  },

  removeTrack: async (id) => {
    if (BUILT_IN_TRACK_IDS.has(id)) return;
    const { playlist, currentTrackIndex } = get();
    const idx = playlist.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const newPlaylist = playlist.filter((t) => t.id !== id);
    let newIdx = currentTrackIndex;
    if (idx < currentTrackIndex) newIdx = currentTrackIndex - 1;
    else if (idx === currentTrackIndex) newIdx = Math.min(idx, newPlaylist.length - 1);
    set({ playlist: newPlaylist, currentTrackIndex: Math.max(0, newIdx), currentTime: 0 });
    try { await fetch(`/api/music/uploads/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" }); } catch {}
  },

  selectTrack: (index) => set({ currentTrackIndex: index, currentTime: 0, isPlaying: true }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setPlaying: (p) => set({ isPlaying: p }),
  setTrackDuration: (id, d) => set((s) => {
    if (!isFinite(d) || d <= 0) return {};
    if (s.durations[id] && Math.abs(s.durations[id] - d) < 1) return {};
    return { durations: { ...s.durations, [id]: d } };
  }),
  setPlaylistOpen: (v) => set({ playlistOpen: v }),
}));
