"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Flame, X, Clock } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { api } from "@/api/client";
import { useNav } from "@/lib/nav-store";
import type { HabitSearchResult, TimeOfDay } from "@/types";
import { cn } from "@/lib/utils";

const RECENT_KEY = "habitflow-recent-searches";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 200;
const EXPANDED_WIDTH = 320;

const TIME_OF_DAY_BADGE: Record<
  TimeOfDay,
  { label: string; emoji: string; className: string }
> = {
  ANY_TIME: {
    label: "Any",
    emoji: "🌤️",
    className: "bg-muted text-muted-foreground",
  },
  MORNING: {
    label: "AM",
    emoji: "🌅",
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  AFTERNOON: {
    label: "PM",
    emoji: "☀️",
    className: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
  EVENING: {
    label: "Eve",
    emoji: "🌙",
    className: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  },
};

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  if (typeof window === "undefined") return;
  const cur = loadRecent();
  const next = [q, ...cur.filter((x) => x !== q)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

export function SearchBar() {
  const { go } = useNav();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<HabitSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [closedWidth, setClosedWidth] = useState<number>(192);

  // Track responsive base width (mobile 192 / desktop 256)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setClosedWidth(mq.matches ? 256 : 192);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Cmd/Ctrl+K keyboard shortcut focuses input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Refresh recent searches whenever dropdown opens
  useEffect(() => {
    if (open) setRecents(loadRecent());
  }, [open]);

  // Debounced search via API
  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await api.searchHabits(q);
        setResults(res.habits);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [value]);

  const handleSelect = useCallback(
    (id: string) => {
      const q = value.trim();
      if (q) {
        saveRecent(q);
        setRecents(loadRecent());
      }
      setOpen(false);
      setValue("");
      setResults([]);
      inputRef.current?.blur();
      go({ name: "habit", id });
    },
    [go, value],
  );

  const handlePickRecent = useCallback((r: string) => {
    setValue(r);
    inputRef.current?.focus();
  }, []);

  const clearInput = useCallback(() => {
    setValue("");
    inputRef.current?.focus();
  }, []);

  const trimmed = value.trim();
  const showRecents = !trimmed && recents.length > 0;
  const showEmpty = !loading && trimmed.length > 0 && results.length === 0;
  const showHint = !trimmed && recents.length === 0;

  return (
    <CommandPrimitive
      ref={containerRef}
      className="relative"
      loop
      shouldFilter={false}
    >
      <motion.div
        className="relative flex items-center"
        animate={{ width: open ? EXPANDED_WIDTH : closedWidth }}
        initial={false}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <Search className="pointer-events-none absolute left-2.5 z-10 h-3.5 w-3.5 text-muted-foreground" />
        <CommandPrimitive.Input
          ref={inputRef}
          value={value}
          onValueChange={setValue}
          onFocus={() => setOpen(true)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search habits..."
          aria-label="Search habits"
          className="h-9 w-full rounded-md border border-transparent bg-muted/50 pl-8 pr-8 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-violet-500/40 focus:bg-background focus-visible:ring-2 focus-visible:ring-violet-500/20"
        />
        {open && trimmed ? (
          <button
            type="button"
            onClick={clearInput}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        ) : !open ? (
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
            <span>Ctrl+</span>
            <span>K</span>
          </kbd>
        ) : null}
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-full z-50 mt-1 max-w-[320px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
          >
            <CommandPrimitive.List className="max-h-[320px] overflow-y-auto p-1">
              {loading && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Searching…
                </div>
              )}

              {!loading && showEmpty && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No habits found
                </div>
              )}

              {!loading && showHint && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Type to search your habits…
                </div>
              )}

              {!loading && results.length > 0 && (
                <CommandPrimitive.Group
                  heading="Habits"
                  className="overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {results.map((h) => {
                    const meta = TIME_OF_DAY_BADGE[h.timeOfDay];
                    return (
                      <CommandPrimitive.Item
                        key={h.id}
                        value={`${h.name} ${h.id} ${h.category ?? ""}`}
                        onSelect={() => handleSelect(h.id)}
                        className="flex cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground select-none"
                      >
                        <span
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-sm"
                          style={{ backgroundColor: h.color + "20" }}
                          aria-hidden
                        >
                          {h.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{h.name}</span>
                        <span
                          className={cn(
                            "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                            meta.className,
                          )}
                        >
                          <span>{meta.emoji}</span>
                          <span className="hidden sm:inline">{meta.label}</span>
                        </span>
                        {h.currentStreak > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] tabular-nums text-orange-600 dark:text-orange-400">
                            <Flame className="h-3 w-3" />
                            {h.currentStreak}
                          </span>
                        )}
                      </CommandPrimitive.Item>
                    );
                  })}
                </CommandPrimitive.Group>
              )}

              {!loading && showRecents && (
                <CommandPrimitive.Group
                  heading="Recent searches"
                  className="overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {recents.map((r) => (
                    <CommandPrimitive.Item
                      key={r}
                      value={`recent-${r}`}
                      onSelect={() => handlePickRecent(r)}
                      className="flex cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground select-none"
                    >
                      <Clock className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{r}</span>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}
            </CommandPrimitive.List>
          </motion.div>
        )}
      </AnimatePresence>
    </CommandPrimitive>
  );
}
