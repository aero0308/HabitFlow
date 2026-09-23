"use client";

import { useState, useEffect } from "react";
import { Sun, Cloud, Moon, Save, Loader2 } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Dayparts {
  morningStart: string;
  afternoonStart: string;
  eveningStart: string;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToPercent(min: number): number {
  return (min / (24 * 60)) * 100;
}

function fmt12h(t: string): string {
  const mins = timeToMinutes(t);
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
    icon: Sun,
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-500",
    barColor: "bg-sky-500",
  },
  {
    key: "afternoon" as const,
    label: "Afternoon",
    startKey: "afternoonStart" as const,
    endKey: "eveningStart" as const,
    icon: Cloud,
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-500",
    barColor: "bg-orange-500",
  },
  {
    key: "evening" as const,
    label: "Evening",
    startKey: "eveningStart" as const,
    endKey: "morningStart" as const, // wraps to next day's morning
    icon: Moon,
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-500",
    barColor: "bg-purple-600",
  },
];

export function TimeOfDaySettings() {
  const [dayparts, setDayparts] = useState<Dayparts>({
    morningStart: "00:00",
    afternoonStart: "11:00",
    eveningStart: "18:00",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.getDayparts().then((d) => {
      setDayparts(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function update(field: keyof Dayparts, value: string) {
    setDayparts((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateDayparts(dayparts);
      toast.success("Time of day settings saved");
      setDirty(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const morningMin = timeToMinutes(dayparts.morningStart);
  const afternoonMin = timeToMinutes(dayparts.afternoonStart);
  const eveningMin = timeToMinutes(dayparts.eveningStart);

  const morningWidth = Math.max(0, afternoonMin - morningMin);
  const afternoonWidth = Math.max(0, eveningMin - afternoonMin);
  const eveningWidth = Math.max(0, 24 * 60 - eveningMin + morningMin);

  const totalWidth = morningWidth + afternoonWidth + eveningWidth;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Time of Day</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Define when morning, afternoon, and evening begin.</p>
        </div>
        <Button size="sm" onClick={save} disabled={!dirty || saving || loading}>
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
          Save
        </Button>
      </div>

      {loading ? (
        <div className="h-20 bg-muted/30 rounded-lg animate-pulse" />
      ) : (
        <>
          {/* Timeline bar */}
          <div className="mb-1">
            <div className="flex h-10 rounded-lg overflow-hidden">
              <div className="bg-sky-500 flex items-center justify-center text-white" style={{ width: `${(morningWidth / totalWidth) * 100}%` }}>
                <Sun className="w-4 h-4" />
              </div>
              <div className="bg-orange-500 flex items-center justify-center text-white" style={{ width: `${(afternoonWidth / totalWidth) * 100}%` }}>
                <Cloud className="w-4 h-4" />
              </div>
              <div className="bg-purple-600 flex items-center justify-center text-white" style={{ width: `${(eveningWidth / totalWidth) * 100}%` }}>
                <Moon className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Hour labels */}
          <div className="flex justify-between text-[10px] text-muted-foreground mb-4">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>12 AM</span>
          </div>

          {/* Editable rows */}
          <div className="space-y-4">
            {SEGMENTS.map((seg, idx) => {
              const Icon = seg.icon;
              const isLast = idx === SEGMENTS.length - 1;
              return (
                <div key={seg.key} className={cn(!isLast && "border-b border-border pb-4")}>
                  {/* Mobile: heading on top, times below */}
                  {/* Desktop: compact horizontal row */}
                  
                  {/* Mobile layout */}
                  <div className="sm:hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", seg.iconBg)}>
                        <Icon className={cn("w-4 h-4", seg.iconColor)} />
                      </div>
                      <div className="text-sm font-medium">{seg.label}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Start</Label>
                        <Input
                          type="time"
                          value={dayparts[seg.startKey]}
                          onChange={(e) => update(seg.startKey, e.target.value)}
                          className="w-full h-10"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">End</Label>
                        <Input
                          type="time"
                          value={dayparts[seg.endKey]}
                          disabled
                          readOnly
                          className="w-full h-10 bg-muted/50 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Desktop compact layout */}
                  <div className="hidden sm:flex sm:items-center sm:gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", seg.iconBg)}>
                      <Icon className={cn("w-4 h-4", seg.iconColor)} />
                    </div>
                    <div className="flex-1 text-sm font-medium min-w-0">
                      {seg.label}
                      <span className="text-xs text-muted-foreground ml-2">
                        {fmt12h(dayparts[seg.startKey])} – {fmt12h(dayparts[seg.endKey])}{seg.key === "evening" && " (next day)"}
                      </span>
                    </div>
                    <Input
                      type="time"
                      value={dayparts[seg.startKey]}
                      onChange={(e) => update(seg.startKey, e.target.value)}
                      className="w-28 h-9"
                    />
                    <span className="text-xs text-muted-foreground w-28 text-right tabular-nums">
                      → {fmt12h(dayparts[seg.endKey])}{seg.key === "evening" && " †"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 hidden sm:block">
            † Evening end wraps to the next day&apos;s morning start.
          </p>
        </>
      )}
    </Card>
  );
}
