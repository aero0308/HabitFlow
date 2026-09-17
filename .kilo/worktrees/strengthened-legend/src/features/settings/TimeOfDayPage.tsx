"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, Loader2, Moon, Save, Sun } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Dayparts = {
  morningStart: string;
  afternoonStart: string;
  eveningStart: string;
};

const DEFAULT_DAYPARTS: Dayparts = {
  morningStart: "06:00",
  afternoonStart: "12:00",
  eveningStart: "18:00",
};

/** Convert "HH:MM" to minutes since midnight. */
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function fmt12h(t: string): string {
  const mins = toMinutes(t);
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

const SEGMENTS = [
  {
    key: "morning" as const,
    label: "Morning",
    startKey: "morningStart" as const,
    endKey: "afternoonStart" as const,
    color: "bg-sky-500",
    icon: Sun,
    emoji: "🌅",
    iconCircle: "bg-sky-500",
  },
  {
    key: "afternoon" as const,
    label: "Afternoon",
    startKey: "afternoonStart" as const,
    endKey: "eveningStart" as const,
    color: "bg-orange-500",
    icon: Cloud,
    emoji: "☀️",
    iconCircle: "bg-orange-500",
  },
  {
    key: "evening" as const,
    label: "Evening",
    startKey: "eveningStart" as const,
    endKey: "morningStart" as const, // wraps to next day's morning
    color: "bg-purple-600",
    icon: Moon,
    emoji: "🌙",
    iconCircle: "bg-purple-600",
  },
];

const HOUR_LABELS = ["12 AM", "6 AM", "12 PM", "6 PM", "12 AM"];

export function TimeOfDayPage() {
  const qc = useQueryClient();
  // Local overrides applied on top of the server value. When `data` arrives we
  // recompute `draft` from server values + any unsaved local overrides.
  const [overrides, setOverrides] = useState<Partial<Dayparts>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["dayparts"],
    queryFn: () => api.getDayparts(),
  });

  const server: Dayparts = data
    ? {
        morningStart: data.morningStart,
        afternoonStart: data.afternoonStart,
        eveningStart: data.eveningStart,
      }
    : DEFAULT_DAYPARTS;

  // If the server value for a key changes (after a save roundtrip), drop the
  // override for that key so we re-sync with the canonical state.
  const draft: Dayparts = useMemo(
    () => ({
      morningStart: overrides.morningStart ?? server.morningStart,
      afternoonStart: overrides.afternoonStart ?? server.afternoonStart,
      eveningStart: overrides.eveningStart ?? server.eveningStart,
    }),
    [overrides, server],
  );

  function updateField(key: keyof Dayparts, value: string) {
    setOverrides((o) => ({ ...o, [key]: value }));
  }

  const updateMut = useMutation({
    mutationFn: (body: Partial<Dayparts>) => api.updateDayparts(body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["dayparts"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      // Drop the local overrides for keys we just persisted — server is now
      // canonical for those fields, so re-sync from the next fetch.
      setOverrides((o) => {
        const next = { ...o };
        for (const k of Object.keys(vars) as (keyof Dayparts)[]) {
          delete next[k];
        }
        return next;
      });
      toast.success("Time of day settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Calculate segment widths as % of 24h.
  // Morning: morningStart → afternoonStart
  // Afternoon: afternoonStart → eveningStart
  // Evening: eveningStart → morningStart (next day)
  const widths = useMemo(() => {
    const m = toMinutes(draft.morningStart);
    const a = toMinutes(draft.afternoonStart);
    const e = toMinutes(draft.eveningStart);
    const total = 24 * 60;
    const morning = ((a - m + total) % total) / total;
    const afternoon = ((e - a + total) % total) / total;
    const evening = ((m - e + total) % total) / total;
    return { morning, afternoon, evening };
  }, [draft]);

  const isDirty = useMemo(() => {
    if (!data) return false;
    return (
      data.morningStart !== draft.morningStart ||
      data.afternoonStart !== draft.afternoonStart ||
      data.eveningStart !== draft.eveningStart
    );
  }, [data, draft]);

  function handleSave() {
    const m = toMinutes(draft.morningStart);
    const a = toMinutes(draft.afternoonStart);
    const e = toMinutes(draft.eveningStart);
    if (m === a || a === e || e === m) {
      toast.error("Times must be different");
      return;
    }
    updateMut.mutate(draft);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Time of Day</h1>
        <p className="text-sm text-muted-foreground">
          Define when morning, afternoon, and evening begin. Habits are grouped
          by these windows throughout the app.
        </p>
      </div>

      {/* Timeline preview */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Your day at a glance</h2>
          {isDirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="flex h-12 w-full rounded-lg overflow-hidden border border-border">
              {SEGMENTS.map((seg) => {
                const width = widths[seg.key] * 100;
                if (width <= 0) return null;
                const Icon = seg.icon;
                return (
                  <div
                    key={seg.key}
                    className={`${seg.color} flex items-center justify-center text-white relative min-w-0`}
                    style={{ width: `${width}%` }}
                    title={`${seg.label}: ${fmt12h(
                      draft[seg.startKey],
                    )} → ${fmt12h(draft[seg.endKey])}`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-5 mt-2 text-[10px] sm:text-[11px] text-muted-foreground tabular-nums">
              {HOUR_LABELS.map((label, i) => (
                <div key={i} className="text-left">
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Editable rows */}
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold mb-4">Edit boundaries</h2>
        <div className="space-y-2">
          {SEGMENTS.map((seg, idx) => {
            const Icon = seg.icon;
            const isLast = idx === SEGMENTS.length - 1;
            return (
              <div
                key={seg.key}
                className={`py-4 ${!isLast ? "border-b border-border" : ""}`}
              >
                {/* Heading row: icon + segment name */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-9 h-9 rounded-full ${seg.iconCircle} flex items-center justify-center text-white shrink-0`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{seg.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {seg.emoji} {fmt12h(draft[seg.startKey])} –{" "}
                      {fmt12h(draft[seg.endKey])}
                      {seg.key === "evening" && " (next day)"}
                    </div>
                  </div>
                </div>

                {/* Both time inputs below the heading — side-by-side */}
                <div className="grid grid-cols-2 gap-3 sm:pl-12">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${seg.key}-start`} className="text-xs">
                      Start
                    </Label>
                    <Input
                      id={`${seg.key}-start`}
                      type="time"
                      value={draft[seg.startKey]}
                      onChange={(e) =>
                        updateField(seg.startKey, e.target.value)
                      }
                      className="w-full h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${seg.key}-end`} className="text-xs">
                      End
                    </Label>
                    <Input
                      id={`${seg.key}-end`}
                      type="time"
                      value={draft[seg.endKey]}
                      readOnly
                      disabled
                      className="w-full h-10 bg-muted/50 cursor-not-allowed"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 sm:pl-12">
                  Ends when {SEGMENTS[(idx + 1) % SEGMENTS.length].label} begins
                  {seg.key === "evening" && " (next day)"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <Button
            onClick={handleSave}
            disabled={updateMut.isPending || !isDirty}
            className="w-full sm:w-auto"
          >
            {updateMut.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save changes
          </Button>
        </div>
      </Card>
    </div>
  );
}
