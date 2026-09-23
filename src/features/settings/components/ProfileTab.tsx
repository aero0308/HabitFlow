"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User as UserIcon,
  Loader2,
  Mail,
  Camera,
  Save,
  Download,
  Database as DatabaseIcon,
  Upload,
  Share2,
  Sparkles,
  Globe,
  ExternalLink,
  Copy,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { YourStatsSection } from "@/features/settings/components/YourStatsSection";
import { AchievementsPreview } from "@/features/settings/components/AchievementsPreview";
import { ShareCardModal } from "@/features/share/components/ShareCardModal";

/**
 * ProfileTab — the "Profile" tab on the Settings page.
 *
 * Sections in order:
 *   1. Profile info — avatar (with upload badge), First + Last Name fields
 *      side-by-side, read-only Email, and optional Timezone display.
 *   2. Your stats — 4 compact stat cards.
 *   3. Achievements — summary + badge grid preview.
 *   4. Your data — CSV export & import.
 *
 * All state and handlers are local to this tab (settings query + update
 * mutation). The avatar upload resizes the image to a max 256×256 JPEG data
 * URL before persisting.
 */
export function ProfileTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [firstNameDraft, setFirstNameDraft] = useState("");
  const [lastNameDraft, setLastNameDraft] = useState("");
  const [taglineDraft, setTaglineDraft] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const shareCardSectionRef = useRef<HTMLDivElement | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: !!user,
  });

  // Sync name + tagline drafts when settings load
  useEffect(() => {
    if (settings) {
      setFirstNameDraft(settings.firstName || "");
      setLastNameDraft(settings.lastName || "");
      setTaglineDraft(settings.tagline || "");
    } else if (user) {
      const parts = (user.name || "").split(" ");
      setFirstNameDraft(parts[0] || "");
      setLastNameDraft(parts.slice(1).join(" ") || "");
      setTaglineDraft(user.tagline || "");
    }
  }, [settings, user]);

  const savedFirst = settings?.firstName ?? user?.firstName ?? "";
  const savedLast = settings?.lastName ?? user?.lastName ?? "";
  const savedTagline = settings?.tagline ?? user?.tagline ?? "";
  const nameDirty = firstNameDraft !== savedFirst || lastNameDraft !== savedLast;
  const taglineDirty = taglineDraft !== savedTagline;

  const updateMut = useMutation({
    mutationFn: (
      body: Partial<{
        name: string;
        firstName: string;
        lastName: string;
        avatarUrl: string;
        tagline: string;
        isShareCardPublic: boolean;
      }>,
    ) => api.updateSettings(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function initials(name: string) {
    return name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeImage(file, 256);
      updateMut.mutate({ avatarUrl: dataUrl });
      toast.success("Profile picture updated");
    } catch {
      toast.error("Could not process image");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  function resizeImage(file: File, maxSize: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("No canvas context"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/export?format=csv", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `habitflow-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export ready", {
        description: "Your check-in data has been downloaded.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/export/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      const s = data.summary;
      toast.success("Import complete", {
        description: `${s.habitsCreated} new habits, ${s.habitsMatched} matched, ${s.checkinsCreated} check-ins imported.`,
      });
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. Profile info */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold">Profile</h3>
        </div>

        {/* Avatar + Name fields */}
        <div className="flex flex-col items-center gap-4 mb-6 sm:flex-row sm:items-start">
          <div className="relative flex-shrink-0">
            {settings?.avatarUrl || user?.avatarUrl ? (
              <img
                src={settings?.avatarUrl || user?.avatarUrl}
                alt={user?.name ?? "Profile"}
                className="w-20 h-20 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white text-2xl font-semibold">
                {user ? initials(user.name) : "?"}
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar || updateMut.isPending}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center shadow-sm hover:bg-muted transition-colors"
              aria-label="Upload profile photo"
            >
              {uploadingAvatar ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarUpload(f);
              }}
            />
          </div>

          <div className="text-center sm:hidden">
            <p className="text-sm font-medium text-foreground">
              {[firstNameDraft, lastNameDraft].filter(Boolean).join(" ") ||
                user?.name ||
                "Your name"}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <div className="w-full grid grid-cols-2 gap-3 sm:flex-1">
            <div className="space-y-1.5">
              <Label htmlFor="s-first" className="text-xs">
                First Name
              </Label>
              <Input
                id="s-first"
                placeholder="John"
                value={firstNameDraft}
                onChange={(e) => setFirstNameDraft(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-last" className="text-xs">
                Last Name
              </Label>
              <Input
                id="s-last"
                placeholder="Doe"
                value={lastNameDraft}
                onChange={(e) => setLastNameDraft(e.target.value)}
              />
            </div>
          </div>
        </div>

        {nameDirty && (
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              onClick={() => {
                const fullName = [firstNameDraft, lastNameDraft]
                  .filter(Boolean)
                  .join(" ");
                updateMut.mutate({
                  firstName: firstNameDraft,
                  lastName: lastNameDraft,
                  name: fullName,
                });
              }}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save changes
            </Button>
          </div>
        )}

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label htmlFor="s-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="s-email"
              value={settings?.email ?? user?.email ?? ""}
              disabled
              className="pl-9 bg-muted/50"
            />
          </div>
          <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
        </div>

        {/* Timezone (if present) */}
        {(settings?.timezone || user?.timezone) && (
          <div className="space-y-2 mt-4">
            <Label htmlFor="s-tz">Timezone</Label>
            <Input
              id="s-tz"
              value={settings?.timezone ?? user?.timezone ?? ""}
              disabled
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              Used to schedule daily reminders and streak cut-offs.
            </p>
          </div>
        )}
      </Card>

      {/* 1b. Share card — generate + tagline + public toggle */}
      <div ref={shareCardSectionRef} className="scroll-mt-20">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="w-5 h-5 text-violet-500" />
          <h3 className="font-semibold">Share card</h3>
        </div>

        <div className="space-y-5">
          {/* Generate button */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="pr-4">
              <div className="text-sm font-medium">Your share card</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                A screenshot-worthy stat card with your streak, check-ins, and badges. Download as PNG, copy to clipboard, or share on social.
              </p>
            </div>
            <Button
              onClick={() => setShareModalOpen(true)}
              className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white border-0"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate share card
            </Button>
          </div>

          <div className="h-px bg-border" />

          {/* Tagline */}
          <div className="space-y-2">
            <Label htmlFor="s-tagline">Tagline</Label>
            <Input
              id="s-tagline"
              placeholder="e.g. Building better habits, one day at a time."
              value={taglineDraft}
              maxLength={120}
              onChange={(e) => setTaglineDraft(e.target.value)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <p>Shown on your share card under your name. Max 120 characters.</p>
              <span className="tabular-nums">{taglineDraft.length}/120</span>
            </div>
            {taglineDirty && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateMut.mutate({ tagline: taglineDraft })}
                  disabled={updateMut.isPending}
                >
                  {updateMut.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save tagline
                </Button>
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Public toggle */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="pr-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="w-4 h-4 text-violet-500" />
                Make my share card public
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {settings?.isShareCardPublic ? (
                  <>
                    Your card is live at{" "}
                    <code className="px-1 py-0.5 rounded bg-muted text-[11px]">
                      /share/{settings.username || "username"}
                    </code>
                    . Anyone with the link can view it.
                  </>
                ) : (
                  <>Generate a public link at <code className="px-1 py-0.5 rounded bg-muted text-[11px]">/share/&lt;username&gt;</code> so others can view your card. Off by default — your data stays private.</>
                )}
              </p>
            </div>
            <Switch
              checked={settings?.isShareCardPublic ?? false}
              onCheckedChange={(checked) => {
                updateMut.mutate({ isShareCardPublic: checked });
                if (checked) {
                  toast.success("Share card is now public", {
                    description: "We generated a username for your public link.",
                  });
                }
              }}
              disabled={updateMut.isPending}
              aria-label="Toggle public share card"
            />
          </div>

          {/* Public link preview */}
          {settings?.isShareCardPublic && settings.username && (
            <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
              <Globe className="w-4 h-4 text-violet-500 flex-shrink-0" />
              <code className="text-xs flex-1 truncate">
                {typeof window !== "undefined" ? window.location.origin : "https://habitflow.app"}/share/{settings.username}
              </code>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => {
                    if (typeof window === "undefined") return;
                    const url = `${window.location.origin}/share/${settings.username}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link copied", { description: url });
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                {typeof window !== "undefined" && (
                  <a
                    href={`${window.location.origin}/share/${settings.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
                    aria-label="Open public share page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* The modal — controlled by shareModalOpen state */}
        <ShareCardModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          onEnablePublicSharing={() => {
            // Scroll the share-card section into view after the modal closes.
            setTimeout(() => {
              shareCardSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
          }}
        />
      </Card>
      </div>

      {/* 2. Your stats */}
      <YourStatsSection />

      {/* 3. Achievements */}
      <AchievementsPreview />

      {/* 4. Your data — CSV export/import */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <DatabaseIcon className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold">Your data</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="pr-4">
              <div className="text-sm font-medium">Export check-ins as CSV</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Download all your habit check-ins as a spreadsheet. Great for backups or analysis.
              </p>
            </div>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export CSV
            </Button>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="pr-4">
              <div className="text-sm font-medium">Import from CSV</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Restore from a previous export. Habits are matched by name; check-ins are merged (existing ones are updated).
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Import CSV
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
