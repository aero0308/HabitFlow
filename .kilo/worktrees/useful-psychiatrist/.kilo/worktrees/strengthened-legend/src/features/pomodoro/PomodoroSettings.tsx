"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Minus, Plus, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  usePomodoroStore,
  type PomodoroSettings as SettingsType,
} from "./pomodoroStore";

interface PomodoroSettingsProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "duration" | "notifications";

type DurationField = "focusMin" | "shortMin" | "longMin" | "longEvery";

interface DurationRowConfig {
  field: DurationField;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const DURATION_ROWS: DurationRowConfig[] = [
  { field: "focusMin", label: "Focus Session", unit: "min", min: 1, max: 180, step: 1 },
  { field: "shortMin", label: "Short break", unit: "min", min: 1, max: 30, step: 1 },
  { field: "longMin", label: "Long break", unit: "min", min: 1, max: 60, step: 1 },
  { field: "longEvery", label: "Long break after", unit: "Sess.", min: 2, max: 10, step: 1 },
];

// Fixed height for the tab content area so Duration and Notifications tabs
// don't cause the panel to resize when switching.
const FIXED_CONTENT_HEIGHT = 220;

export function PomodoroSettings({ open, onClose }: PomodoroSettingsProps) {
  const [tab, setTab] = useState<Tab>("duration");
  const [editingField, setEditingField] = useState<DurationField | null>(null);
  const settings = usePomodoroStore((s) => s.settings);
  const updateSettings = usePomodoroStore((s) => s.updateSettings);

  if (!open) return null;

  function getValue(field: DurationField): number {
    return settings[field];
  }

  function setValue(field: DurationField, value: number) {
    const config = DURATION_ROWS.find((r) => r.field === field)!;
    const clamped = Math.max(config.min, Math.min(config.max, value));
    updateSettings({ [field]: clamped } as Partial<SettingsType>);
  }

  return (
    <motion.div
      initial={false}
      className="absolute inset-0 z-30 rounded-xl bg-card border border-border shadow-lg flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-border flex-shrink-0">
        {editingField ? (
          <button
            type="button"
            onClick={() => setEditingField(null)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <span className="w-4" />
        )}
        <h3 className="text-sm font-semibold text-foreground">
          {editingField ? "" : "Settings"}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          aria-label="Close settings"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {editingField ? (
          <StepperView
            key={editingField}
            config={DURATION_ROWS.find((r) => r.field === editingField)!}
            value={getValue(editingField)}
            onChange={(v) => setValue(editingField, v)}
          />
        ) : (
          <motion.div
            key={tab}
            initial={false}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col"
          >
            {/* Tabs */}
            <div className="flex gap-1 px-3 pt-2 pb-1.5 flex-shrink-0">
              {(["duration", "notifications"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "relative flex-1 text-[11px] font-medium py-1 rounded-full transition-colors capitalize",
                    tab === t
                      ? "text-white"
                      : "text-muted-foreground hover:text-foreground bg-muted/40",
                  )}
                >
                  {tab === t && (
                    <motion.div
                      layoutId="pomodoro-settings-tab"
                      className="absolute inset-0 rounded-full bg-violet-500"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{t}</span>
                </button>
              ))}
            </div>

            {/* Tab content — fixed height so panel doesn't resize between tabs */}
            <div
              className="flex-1 overflow-y-auto px-2 pb-2"
              style={{ minHeight: FIXED_CONTENT_HEIGHT }}
            >
              {tab === "duration" ? (
                <div className="space-y-0">
                  {DURATION_ROWS.map((row) => (
                    <button
                      key={row.field}
                      type="button"
                      onClick={() => setEditingField(row.field)}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors"
                    >
                      <span className="text-[11px] text-muted-foreground">{row.label}</span>
                      <span className="flex items-center gap-1 tabular-nums">
                        <span className="text-xs text-foreground font-medium">
                          {String(getValue(row.field)).padStart(2, "0")}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{row.unit}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-0">
                  <ToggleRow
                    label="Sound on complete"
                    checked={settings.soundEnabled}
                    onChange={(v) => updateSettings({ soundEnabled: v })}
                  />
                  <ToggleRow
                    label="Browser notification"
                    checked={settings.notificationEnabled}
                    onChange={(v) => updateSettings({ notificationEnabled: v })}
                  />
                  <ToggleRow
                    label="Vibration"
                    checked={settings.vibrationEnabled}
                    onChange={(v) => updateSettings({ vibrationEnabled: v })}
                  />
                  <ToggleRow
                    label="Music while focusing"
                    checked={settings.musicWhileFocusing}
                    onChange={(v) => updateSettings({ musicWhileFocusing: v })}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StepperView({
  config,
  value,
  onChange,
}: {
  config: DurationRowConfig;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col items-center justify-center gap-3 py-4"
    >
      {/* Stepper row: [−] value [+] */}
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => onChange(value - config.step)}
          disabled={value <= config.min}
          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted/40 disabled:opacity-30 transition-colors"
          aria-label="Decrease"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-3xl font-mono tabular-nums font-bold text-foreground leading-none">
            {value}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
            {config.unit}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onChange(value + config.step)}
          disabled={value >= config.max}
          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted/40 disabled:opacity-30 transition-colors"
          aria-label="Increase"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Range text */}
      <p className="text-[10px] text-muted-foreground">
        Range: {config.min}–{config.max} {config.unit}
      </p>

      {/* Title below range */}
      <h4 className="text-sm font-semibold text-foreground mt-1">
        {config.label}
      </h4>
    </motion.div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
