"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Sparkles, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Trash2, ExternalLink, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ============================================================================
   AISettings — AI Coach settings section for the Settings page.
   ----------------------------------------------------------------------------
   BYOK (Bring Your Own Key) — user provides their own Groq or NVIDIA NIM
   API key. The key is encrypted (AES-256-GCM) before being saved to the DB.

   Features:
     - Provider select (Groq / NVIDIA NIM)
     - NVIDIA model sub-picker (multiple chat models per NVIDIA key)
     - API key input (password with show/hide toggle)
     - "Test connection" button → sends a tiny test prompt
     - "Save" button → encrypts and saves (provider + chosen model + key)
     - If key already saved → shows masked key + "Remove" button
============================================================================ */

type Provider = "groq" | "nvidia";

const PROVIDER_INFO: Record<Provider, { label: string; keyUrl: string; description: string; keyPrefix: string; placeholder: string }> = {
  groq: {
    label: "Groq (GPT-OSS 120B)",
    keyUrl: "https://console.groq.com/keys",
    description: "Fastest inference, 131K context, JSON mode",
    keyPrefix: "gsk_",
    placeholder: "gsk_...",
  },
  nvidia: {
    label: "NVIDIA NIM",
    keyUrl: "https://build.nvidia.com/models",
    description: "Large model catalog, up to 40 RPM, no per-token billing",
    keyPrefix: "nvapi-",
    placeholder: "nvapi-...",
  },
};

/**
 * NVIDIA NIM exposes multiple chat-optimised models per API key. We surface
 * the FREE ones here (with their rate / size hints) so the user can pick
 * the best fit for their use case. The chosen model id is persisted in
 * `User.aiModel` and forwarded to every provider call.
 *
 * IMPORTANT: keep this list in sync with the server-side `NVIDIA_MODELS`
 * in `src/lib/ai/providers.ts`. The server is the source of truth for
 * validation, but the UI needs its own copy for the dropdown.
 */
const NVIDIA_MODEL_OPTIONS: Array<{
  id: string;
  label: string;
  tier: "free" | "paid";
  description: string;
}> = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    label: "Nemotron 3 Super",
    tier: "free",
    description: "120B params · best quality · 40 RPM cap",
  },
  {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    label: "Nemotron 3.5 Lightning",
    tier: "free",
    description: "30B MoE · lowest latency · great for chat",
  },
];

const DEFAULT_NVIDIA_MODEL_ID = NVIDIA_MODEL_OPTIONS[0].id;

export function AISettings() {
  const [provider, setProvider] = useState<Provider>("groq");
  const [nvidiaModelId, setNvidiaModelId] = useState<string>(DEFAULT_NVIDIA_MODEL_ID);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; model?: string; error?: string } | null>(null);
  const [existing, setExisting] = useState<{
    provider: Provider | null;
    maskedKey: string | null;
    model?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/settings");
      const json = await res.json();
      if (json.provider) {
        setExisting({
          provider: json.provider,
          maskedKey: json.maskedKey,
          model: json.model ?? null,
        });
        setProvider(json.provider);
        if (json.provider === "nvidia" && json.model) {
          setNvidiaModelId(json.model);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // The model id we'll send on save / test. For groq we don't send anything
  // (the server uses its default). For nvidia we send the picked model id.
  const activeModelId = provider === "nvidia" ? nvidiaModelId : undefined;

  // Human-readable label for the currently-selected NVIDIA model
  const selectedNvidiaModel = useMemo(
    () => NVIDIA_MODEL_OPTIONS.find((m) => m.id === nvidiaModelId) ?? NVIDIA_MODEL_OPTIONS[0],
    [nvidiaModelId],
  );

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter your API key");
      return;
    }
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model: activeModelId }),
      });
      const json = await res.json();
      if (json.detail) {
        toast.error(json.detail);
      } else {
        toast.success("AI key saved");
        setExisting({
          provider,
          maskedKey: json.maskedKey,
          model: activeModelId ?? null,
        });
        setApiKey("");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body: Record<string, string> = { provider };
      if (apiKey.trim()) body.apiKey = apiKey;
      if (activeModelId) body.model = activeModelId;
      const res = await fetch("/api/ai/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.detail) {
        setTestResult({ ok: false, error: json.detail });
        toast.error(json.detail);
      } else {
        setTestResult({ ok: true, model: json.model });
        toast.success(`Connected · ${json.model}`);
      }
    } catch {
      setTestResult({ ok: false, error: "Connection failed" });
      toast.error("Connection failed");
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    try {
      await fetch("/api/ai/settings", { method: "DELETE" });
      toast.success("AI key removed");
      setExisting(null);
      setTestResult(null);
      setNvidiaModelId(DEFAULT_NVIDIA_MODEL_ID);
    } catch {
      toast.error("Failed to remove");
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <h3 className="font-semibold">AI Coach</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      </Card>
    );
  }

  // Build the "currently using" subtitle from provider + (for NVIDIA) model
  const existingSubtitle = existing?.provider
    ? existing.provider === "nvidia"
      ? `${PROVIDER_INFO.nvidia.label} · ${existing.model ?? DEFAULT_NVIDIA_MODEL_ID}`
      : PROVIDER_INFO[existing.provider].label
    : "";

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-violet-500" />
        <h3 className="font-semibold">AI Coach</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        Connect your own AI key to unlock personalized weekly insights. Your key
        is encrypted and only used for your requests.
      </p>

      {/* Existing key info */}
      {existing?.maskedKey && (
        <div className="flex items-center justify-between gap-3 mb-5 p-3 rounded-lg border border-violet-500/20 bg-violet-500/5">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <span className="text-foreground truncate">
              Currently using: <span className="font-mono font-medium">{existing.maskedKey}</span>
              <span className="text-muted-foreground"> · {existingSubtitle}</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-destructive hover:text-destructive flex-shrink-0"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Remove
          </Button>
        </div>
      )}

      {/* Provider select */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Groq recommendation banner — only shown when the user hasn't
              picked Groq yet, so they know it's the fastest / most reliable
              option (and avoids NVIDIA NIM's 40 RPM cap + reasoning-model
              quirks like the "thinking process" preamble). */}
          {provider !== "groq" && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed">
              <span className="text-amber-500 flex-shrink-0 mt-0.5">⭐</span>
              <span className="text-amber-900 dark:text-amber-200">
                <span className="font-medium">Groq API key recommended</span> —
                fastest, most reliable.{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100"
                >
                  Get a free Groq key →
                </a>
              </span>
            </div>
          )}
        </div>

        {/* NVIDIA model picker — shown only when NVIDIA NIM is selected */}
        {provider === "nvidia" && (
          <div>
            <Label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              NVIDIA Model
            </Label>
            <Select value={nvidiaModelId} onValueChange={setNvidiaModelId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NVIDIA_MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <span>{m.label}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1 py-0 font-medium uppercase tracking-wide",
                          m.tier === "free"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                        )}
                      >
                        {m.tier}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {selectedNvidiaModel.description}
            </p>
          </div>
        )}

        {/* API key input */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">API Key</Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={PROVIDER_INFO[provider].placeholder}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            size="sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
          <Button
            onClick={handleTest}
            disabled={testing || (!apiKey.trim() && !existing?.maskedKey)}
            variant="outline"
            size="sm"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Testing...
              </>
            ) : (
              "Test connection"
            )}
          </Button>
        </div>

        {/* Test result */}
        {testResult && (
          <div
            className={cn(
              "flex items-center gap-2 text-sm",
              testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
            )}
          >
            {testResult.ok ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Connected · {testResult.model}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>{testResult.error}</span>
              </>
            )}
          </div>
        )}

        {/* Info box */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">{PROVIDER_INFO[provider].description}.</span>{" "}
            Get a free API key from{" "}
            <a
              href={PROVIDER_INFO[provider].keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-0.5"
            >
              {PROVIDER_INFO[provider].label.split(" ")[0]}
              <ExternalLink className="w-3 h-3" />
            </a>
            . Usage bills go directly to your provider.
          </p>
        </div>
      </div>
    </Card>
  );
}
