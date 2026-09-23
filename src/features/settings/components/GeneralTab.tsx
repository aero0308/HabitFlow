"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Loader2,
  Mail,
  Sun,
  Moon,
  Laptop,
  HelpCircle,
  Sparkles,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { resetTour } from "@/components/shared/onboarding-tour";
import { useNav } from "@/lib/nav-store";
import { TimeOfDaySettings } from "@/features/settings/TimeOfDaySettings";
import { AISettings } from "@/features/settings/AISettings";

/**
 * GeneralTab — the "General" tab on the Settings page.
 *
 * Sections in order:
 *   1. Appearance (theme: System / Light / Dark)
 *   2. Time of Day (rendered via <TimeOfDaySettings />)
 *   3. Notifications (weekly email reminders + send test email + browser notifications)
 *   4. AI Coach (rendered via <AISettings />)
 *   5. Help & Tour (restart tour + mobile Focus Timer FAB toggle)
 *
 * State is local to this tab.
 */
export function GeneralTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { go } = useNav();
  const { theme, setTheme } = useTheme();

  const [mobileFabEnabled, setMobileFabEnabled] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("habitflow-pomodoro-fab-enabled");
    if (stored !== null) setMobileFabEnabled(stored === "true");
  }, []);

  function handleMobileFabToggle(enabled: boolean) {
    setMobileFabEnabled(enabled);
    localStorage.setItem("habitflow-pomodoro-fab-enabled", String(enabled));
    window.dispatchEvent(new Event("pomodoro-fab-toggle"));
  }

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: !!user,
  });

  const updateMut = useMutation({
    mutationFn: (
      body: Partial<{
        emailRemindersEnabled: boolean;
        browserRemindersEnabled: boolean;
        reminderTime: string;
      }>,
    ) => api.updateSettings(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Notifications: email + browser ---
  const [reminders, setReminders] = useState<boolean | undefined>(undefined);
  const remindersValue =
    reminders ?? settings?.emailRemindersEnabled ?? user?.emailRemindersEnabled ?? true;

  const [browserReminders, setBrowserReminders] = useState<boolean | undefined>(undefined);
  const browserRemindersValue =
    browserReminders ??
    settings?.browserRemindersEnabled ??
    user?.browserRemindersEnabled ??
    false;

  const [reminderTimeDraft, setReminderTimeDraft] = useState<string | undefined>(undefined);
  const reminderTimeValue =
    reminderTimeDraft ?? settings?.reminderTime ?? user?.reminderTime ?? "09:00";

  const [sendingTest, setSendingTest] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  function onReminderToggle(v: boolean) {
    setReminders(v);
    updateMut.mutate({ emailRemindersEnabled: v });
  }

  function onBrowserReminderToggle(v: boolean) {
    setBrowserReminders(v);
    if (
      v &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().then((perm) => setNotifPermission(perm));
    }
    updateMut.mutate({ browserRemindersEnabled: v });
  }

  async function handleTestEmail() {
    setSendingTest(true);
    try {
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

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission("unsupported");
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* 1. Appearance */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sun className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold">Appearance</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Theme</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose how HabitFlow looks to you.
            </p>
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

      {/* 2. Time of Day */}
      <TimeOfDaySettings />

      {/* 3. Notifications */}
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
            <Switch
              checked={remindersValue}
              onCheckedChange={onReminderToggle}
              disabled={updateMut.isPending}
            />
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestEmail}
                disabled={sendingTest}
              >
                {sendingTest ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                )}
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
                  <span className="text-[10px] text-destructive font-medium px-1.5 py-0.5 bg-destructive/10 rounded">
                    Blocked
                  </span>
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestNotificationPermission}
              >
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

      {/* 4. AI Coach */}
      <AISettings />

      {/* 5. Help & Tour */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold">Help</h3>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="pr-4">
            <div className="text-sm font-medium">Take the tour again</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Replay the onboarding tour to rediscover features like Quick start, keyboard
              shortcuts, and weekly review.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
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
  );
}
