"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User as UserIcon, Bell, LogOut, Loader2, Mail, Camera, Sun, Moon, Laptop, Save, Calendar } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Database as DatabaseIcon, Upload, HelpCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { resetTour } from "@/components/shared/onboarding-tour";
import { useNav } from "@/lib/nav-store";
import { DangerZone } from "@/features/settings/DangerZone";
import { TimeOfDaySettings } from "@/features/settings/TimeOfDaySettings";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function SettingsPage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const { go } = useNav();
  const { theme, setTheme } = useTheme();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [firstNameDraft, setFirstNameDraft] = useState("");
  const [lastNameDraft, setLastNameDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "account">("general");
  const [mobileFabEnabled, setMobileFabEnabled] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("habitflow-pomodoro-fab-enabled");
    if (stored !== null) setMobileFabEnabled(stored === "true");
  }, []);

  function handleMobileFabToggle(enabled: boolean) {
    setMobileFabEnabled(enabled);
    localStorage.setItem("habitflow-pomodoro-fab-enabled", String(enabled));
    window.dispatchEvent(new Event("pomodoro-fab-toggle"));
  }

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
      // Resize to max 256x256 and compress to keep the data URL small
      const dataUrl = await resizeImage(file, 256);
      updateMut.mutate({ avatarUrl: dataUrl });
      toast.success("Profile picture updated");
    } catch (e) {
      toast.error("Could not process image");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  function handleRemoveAvatar() {
    updateMut.mutate({ avatarUrl: "" });
    toast("Profile picture removed");
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
      toast.success("Export ready", { description: "Your check-in data has been downloaded." });
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
      // Invalidate queries so the UI refreshes
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: !!user,
  });

  // Sync name drafts when settings load
  useEffect(() => {
    if (settings) {
      setFirstNameDraft(settings.firstName || "");
      setLastNameDraft(settings.lastName || "");
    } else if (user) {
      const parts = (user.name || "").split(" ");
      setFirstNameDraft(parts[0] || "");
      setLastNameDraft(parts.slice(1).join(" ") || "");
    }
  }, [settings, user]);

  // Check if name fields have been edited
  const savedFirst = settings?.firstName ?? user?.firstName ?? "";
  const savedLast = settings?.lastName ?? user?.lastName ?? "";
  const nameDirty = firstNameDraft !== savedFirst || lastNameDraft !== savedLast;

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: settings
      ? { name: settings.name }
      : { name: user?.name ?? "" },
  });

  const updateMut = useMutation({
    mutationFn: (body: Partial<{ name: string; timezone: string; emailRemindersEnabled: boolean }>) =>
      api.updateSettings(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [reminders, setReminders] = useState<boolean | undefined>(undefined);
  const remindersValue = reminders ?? settings?.emailRemindersEnabled ?? user?.emailRemindersEnabled ?? true;

  const [browserReminders, setBrowserReminders] = useState<boolean | undefined>(undefined);
  const browserRemindersValue = browserReminders ?? settings?.browserRemindersEnabled ?? user?.browserRemindersEnabled ?? false;
  const [reminderTimeDraft, setReminderTimeDraft] = useState<string | undefined>(undefined);
  const reminderTimeValue = reminderTimeDraft ?? settings?.reminderTime ?? user?.reminderTime ?? "09:00";
  const [sendingTest, setSendingTest] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");

  function onReminderToggle(v: boolean) {
    setReminders(v);
    updateMut.mutate({ emailRemindersEnabled: v });
  }

  function onBrowserReminderToggle(v: boolean) {
    setBrowserReminders(v);
    if (v && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((perm) => setNotifPermission(perm));
    }
    updateMut.mutate({ browserRemindersEnabled: v });
  }

  async function handleTestEmail() {
    setSendingTest(true);
    try {
      // POST to the dedicated test endpoint (uses the user's own email as recipient).
      // Response: { ok, dev, sample, messageId, email }
      // Three toasts based on result: dev (logged to console), sample (sample data sent), prod (real send).
      const res = await fetch("/api/emails/test-weekly-summary", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to send test email");
      }
      if (data.dev) {
        toast.success("Test email logged to console", {
          description: `In production this would be sent to ${data.email}.`,
        });
      } else if (data.sample) {
        toast.success("Sample email sent", {
          description: `Check your inbox at ${data.email}. (Sample data was used.)`,
        });
      } else {
        toast.success("Test email sent!", {
          description: `Check your inbox at ${data.email}.`,
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSendingTest(false);
    }
  }

  function handleRequestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then((perm) => {
      setNotifPermission(perm);
      if (perm === "granted") {
        toast.success("Notifications enabled");
      } else if (perm === "denied") {
        toast.error("Notifications blocked", {
          description: "You can re-enable them later in your browser settings.",
        });
      }
    });
  }

  function handleTestNotification() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Browser notifications not supported");
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        setNotifPermission(perm);
        if (perm === "granted") {
          sendTestNotif();
        } else {
          toast.error("Notification permission denied");
        }
      });
    } else if (Notification.permission === "granted") {
      sendTestNotif();
    } else {
      toast.error("Notifications are blocked. Enable them in your browser settings.");
    }
  }

  function sendTestNotif() {
    try {
      new Notification("HabitFlow reminder 🔔", {
        body: "This is how your daily habit reminder will look. Stay consistent!",
        icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
        tag: "habitflow-test",
      });
      toast.success("Test notification sent");
    } catch {
      toast.error("Could not show notification");
    }
  }

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission("unsupported");
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and preferences.</p>
      </div>

      {/* Horizontal tab switcher */}
      <div className="flex gap-6 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={cn(
            "pb-3 text-sm font-medium transition-colors relative -mb-px border-b-2",
            activeTab === "general"
              ? "border-violet-500 text-violet-600 dark:text-violet-400"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={cn(
            "pb-3 text-sm font-medium transition-colors relative -mb-px border-b-2",
            activeTab === "account"
              ? "border-violet-500 text-violet-600 dark:text-violet-400"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Account
        </button>
      </div>

      {/* Tab content — only one visible at a time */}
      {activeTab === "general" ? (
        <div className="space-y-4">
          {/* Profile */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserIcon className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold">Profile</h3>
            </div>

            {/* Avatar + Name fields — centered on mobile, horizontal on desktop */}
            <div className="flex flex-col items-center gap-4 mb-6 sm:flex-row sm:items-start">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {settings?.avatarUrl || user?.avatarUrl ? (
                  <img
                    src={settings?.avatarUrl || user?.avatarUrl}
                    alt={user?.name ?? "Profile"}
                    className="w-20 h-20 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-2xl font-semibold">
                    {user ? initials(user.name) : "?"}
                  </div>
                )}
                {/* Camera badge */}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar || updateMut.isPending}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center shadow-sm hover:bg-muted transition-colors"
                  aria-label="Upload profile photo"
                >
                  {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
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

              {/* Name display below avatar (mobile only) */}
              <div className="text-center sm:hidden">
                <p className="text-sm font-medium text-foreground">
                  {[firstNameDraft, lastNameDraft].filter(Boolean).join(" ") || user?.name || "Your name"}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>

              {/* Name fields — full width below avatar on mobile */}
              <div className="w-full grid grid-cols-2 gap-3 sm:flex-1">
                <div className="space-y-1.5">
                  <Label htmlFor="s-first" className="text-xs">First Name</Label>
                  <Input
                    id="s-first"
                    placeholder="John"
                    value={firstNameDraft}
                    onChange={(e) => setFirstNameDraft(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-last" className="text-xs">Last Name</Label>
                  <Input
                    id="s-last"
                    placeholder="Doe"
                    value={lastNameDraft}
                    onChange={(e) => setLastNameDraft(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Save button for name changes */}
            {nameDirty && (
              <div className="flex justify-end mb-4">
                <Button
                  size="sm"
                  onClick={() => {
                    const fullName = [firstNameDraft, lastNameDraft].filter(Boolean).join(" ");
                    updateMut.mutate({
                      firstName: firstNameDraft,
                      lastName: lastNameDraft,
                      name: fullName,
                    });
                  }}
                  disabled={updateMut.isPending}
                >
                  {updateMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save changes
                </Button>
              </div>
            )}

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="s-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="s-email" value={settings?.email ?? user?.email ?? ""} disabled className="pl-9 bg-muted/50" />
              </div>
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>
          </Card>

          {/* Appearance / Theme */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sun className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold">Appearance</h3>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Theme</div>
                <p className="text-xs text-muted-foreground mt-0.5">Choose how HabitFlow looks to you.</p>
              </div>
              <Select value={theme ?? "system"} onValueChange={(v) => setTheme(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Laptop className="w-4 h-4" />
                      <span>System</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      <span>Light</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      <span>Dark</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Notifications */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold">Notifications</h3>
            </div>

            {/* Email reminders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="text-sm font-medium">Weekly email reminders</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get a Sunday summary of your week&apos;s progress and streaks.
                  </p>
                </div>
                <Switch checked={remindersValue} onCheckedChange={onReminderToggle} disabled={updateMut.isPending} />
              </div>
              {remindersValue && (
                <div className="space-y-3 pl-4 border-l-2 border-emerald-500/30">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Sending to:</span>
                      <span className="text-foreground font-medium truncate">{user?.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Next email:</span>
                      <span className="text-foreground font-medium">Monday 09:00 UTC</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleTestEmail} disabled={sendingTest}>
                    {sendingTest ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1.5" />}
                    Send test email
                  </Button>
                </div>
              )}
            </div>

            <div className="h-px bg-border my-4" />

            {/* Browser notifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    Browser notifications
                    {notifPermission === "denied" && (
                      <span className="text-[10px] text-destructive font-medium px-1.5 py-0.5 bg-destructive/10 rounded">Blocked</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get a daily in-browser reminder at your chosen time when habits are due.
                  </p>
                </div>
                <Switch
                  checked={browserRemindersValue}
                  onCheckedChange={onBrowserReminderToggle}
                  disabled={updateMut.isPending || notifPermission === "denied"}
                />
              </div>
              {browserRemindersValue && notifPermission === "granted" && (
                <div className="flex items-center justify-between flex-wrap gap-3 pl-4 border-l-2 border-emerald-500/30">
                  <div className="flex items-center gap-2 text-xs">
                    <Bell className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">Remind me at</span>
                    <Input
                      id="reminder-time"
                      type="time"
                      value={reminderTimeValue}
                      onChange={(e) => {
                        setReminderTimeDraft(e.target.value);
                        updateMut.mutate({ reminderTime: e.target.value });
                      }}
                      className="w-32"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleTestNotification}>
                    <Bell className="w-3.5 h-3.5 mr-1.5" />
                    Test notification
                  </Button>
                </div>
              )}
              {browserRemindersValue && notifPermission === "default" && (
                <div className="flex items-center justify-between flex-wrap gap-3 pl-4 border-l-2 border-amber-500/30">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Click “Enable notifications” to grant browser permission.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleRequestNotificationPermission}>
                    <Bell className="w-3.5 h-3.5 mr-1.5" />
                    Enable notifications
                  </Button>
                </div>
              )}
              {browserRemindersValue && notifPermission === "denied" && (
                <p className="text-xs text-destructive pl-4 border-l-2 border-destructive/30">
                  Browser notifications are blocked. Enable them in your browser settings to use this feature.
                </p>
              )}
            </div>
          </Card>

          {/* Time of Day */}
          <TimeOfDaySettings />

          {/* Help & tour */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold">Help</h3>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="pr-4">
                <div className="text-sm font-medium">Take the tour again</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Replay the onboarding tour to rediscover features like Quick start, keyboard shortcuts, and weekly review.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  // resetTour() now sets the tour-pending flag AND dispatches
                  // an event the OnboardingTour listens for, so the tour
                  // opens instantly — no page reload needed. We still
                  // navigate to the dashboard first so the tour's content
                  // (which references dashboard features) makes sense.
                  resetTour();
                  go({ name: "dashboard" });
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" /> Restart tour
              </Button>
            </div>

            <div className="h-px bg-border my-4" />

            {/* Mobile Focus Timer FAB toggle */}
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <div className="text-sm font-medium">Show mobile Focus Timer button</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Display a floating Focus Timer button on mobile devices. Disable if you prefer a cleaner mobile interface.
                </p>
              </div>
              <Switch
                checked={mobileFabEnabled}
                onCheckedChange={handleMobileFabToggle}
              />
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Data export / import */}
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
                  {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
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
                  {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Import CSV
                </Button>
              </div>
            </div>
          </Card>

          {/* Session */}
          <Card className="p-6 border-destructive/30">
            <div className="flex items-center gap-2 mb-4">
              <LogOut className="w-5 h-5 text-destructive" />
              <h3 className="font-semibold">Session</h3>
            </div>
            <Button variant="outline" onClick={() => setLogoutOpen(true)} className="text-destructive hover:text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Log out
            </Button>
          </Card>

          {/* Caution Zone */}
          <DangerZone />
        </div>
      )}

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>You will need to sign in again to continue tracking.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => logout()}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
