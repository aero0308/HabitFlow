"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  LayoutDashboard, ListChecks, BarChart3, Settings, CheckCircle2,
  Moon, Sun, Award, History, Lightbulb, Smile, TreePalm,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useNav, type Page } from "@/lib/nav-store";
import { useAuth } from "@/features/auth/auth-context";
import {
  OnboardingTour,
  TOUR_CHANGED_EVENT,
  isTourOpen,
  isStarterPackPending,
  clearStarterPackPending,
} from "@/components/shared/onboarding-tour";
import { useBrowserReminders } from "@/hooks/use-browser-notifications";
import { LogoDots } from "@/components/shared/logo-dots";
import { SearchBar } from "@/components/shared/SearchBar";
import { PomodoroTimer } from "@/features/pomodoro/PomodoroTimer";
import { MobilePomodoroFab } from "@/features/pomodoro/MobilePomodoroFab";
import { PlaylistOverlay } from "@/features/pomodoro/PlaylistOverlay";
import { FocusMusicManager } from "@/features/pomodoro/FocusMusicManager";
import { AuthMusicSync } from "@/features/pomodoro/AuthMusicSync";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { StarterPacksPicker } from "@/features/habits/StarterPacksPicker";

interface NavItem {
  key: Page["name"];
  label: string;
  icon: typeof LayoutDashboard;
  mobile?: boolean; // show in mobile bottom nav
}

// Full nav for sidebar (desktop)
const NAV_FULL: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { key: "habits", label: "Habits", icon: ListChecks, mobile: true },
  { key: "mood", label: "Mood", icon: Smile, mobile: true },
  { key: "analytics", label: "Analytics", icon: BarChart3, mobile: true },
  { key: "insights", label: "Insights", icon: Lightbulb },
  { key: "off-mode", label: "Off Mode", icon: TreePalm },
  { key: "settings", label: "Settings", icon: Settings, mobile: true },
];

// Mobile bottom nav (only items with mobile: true)
const NAV_MOBILE = NAV_FULL.filter((n) => n.mobile);

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="h-9 w-9"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
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

export function AppShell({ children }: { children: ReactNode }) {
  const { page, go } = useNav();
  const { user, logout } = useAuth();

  // Schedule browser notifications if the user enabled them
  useBrowserReminders(user?.browserRemindersEnabled ?? false, user?.reminderTime ?? "09:00");

  // --- New-account onboarding: tour -> starter pack ----------------------
  // When a freshly-registered user lands in the app for the first time,
  // the OnboardingTour opens FIRST (driven by the `habitflow-tour-pending-v1`
  // flag that auth-context.tsx register() sets). Once the user dismisses
  // the tour, markTourCompleted() dispatches TOUR_CHANGED_EVENT — this
  // component listens for that event and, when it fires, checks whether
  // `habitflow-starterpack-pending-v1` is still set. If so, opens the
  // StarterPacksPicker so the user can seed a few habits in one click.
  //
  // The "wait for tour to close" check uses `isTourOpen()` (a flag set
  // when the tour actually opens, cleared when it closes) rather than
  // `isTourPending()` (which is consumed the moment the tour opens).
  // This is critical because React runs child effects BEFORE parent
  // effects — so by the time this AppShell's on-mount check runs,
  // OnboardingTour's useEffect has already consumed the pending flag
  // and the tour is about to render. Using `isTourOpen()` lets us
  // correctly wait for the tour to actually close before opening the
  // starter pack.
  //
  // We also run the same check on mount to handle the edge case where
  // the user refreshed the page AFTER the tour closed (tour-open is
  // cleared by OnboardingTour's own mount-time clearTourOpen call) but
  // BEFORE the starter pack opened — in that case the tour won't re-open
  // (its pending flag is gone) but the starter pack is still pending,
  // so we open it directly.
  const [starterPackOpen, setStarterPackOpen] = useState(false);
  // Ref mirror of starterPackOpen so the event listener (which is set up
  // once on mount) can read the latest value without re-subscribing.
  const starterPackOpenRef = useRef(false);
  useEffect(() => {
    starterPackOpenRef.current = starterPackOpen;
  }, [starterPackOpen]);

  useEffect(() => {
    // Open the starter pack IF (a) starter-pack-pending is set AND (b) the
    // tour is NOT pending (i.e. either the tour already ran, or the user
    // already dismissed it). If the tour is still pending, the
    // OnboardingTour will open it, and when the tour closes the
    // TOUR_CHANGED_EVENT will re-trigger this check.
    const openStarterPackIfReady = () => {
      if (starterPackOpenRef.current) return; // already open
      if (!isStarterPackPending()) return;
      if (isTourOpen()) return; // wait for tour to close first
      setStarterPackOpen(true);
    };
    // Run once on mount (covers the refresh-after-tour edge case).
    openStarterPackIfReady();
    // Re-run whenever the tour state changes (covers the normal
    // tour-closes-then-starter-pack-opens flow).
    window.addEventListener(TOUR_CHANGED_EVENT, openStarterPackIfReady);
    return () => window.removeEventListener(TOUR_CHANGED_EVENT, openStarterPackIfReady);
  }, []);

  function handleStarterPackClose() {
    setStarterPackOpen(false);
    // Always clear the starter-pack-pending flag when the AppShell-mounted
    // instance closes — this instance is ONLY opened by the new-account
    // onboarding flow (the Habits page has its own separate instance with
    // its own onClose handler that doesn't touch the global flag).
    clearStarterPackPending();
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OnboardingTour />
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => go({ name: "dashboard" })}
            className="flex flex-col items-start gap-0.5 group"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm group-hover:shadow-md transition-shadow">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">HabitFlow</span>
            </div>
            <div className="ml-10">
              <LogoDots />
            </div>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <div className="hidden sm:block">
              <SearchBar />
            </div>
            {/* Mobile-only Insights button — placed beside the theme toggle
                so users can reach Insights without opening the avatar dropdown.
                Hidden on sm+ because the sidebar has a full Insights nav item. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => go({ name: "insights" })}
              aria-label="Insights"
              className="sm:hidden h-9 w-9"
            >
              <Lightbulb className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors">
                  <Avatar className="w-8 h-8">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-semibold">
                        {user ? initials(user.firstName || user.name) : "?"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium max-w-32 truncate">{user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name : ""}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name : ""}</span>
                    <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => go({ name: "insights" })}>
                  <Lightbulb className="w-4 h-4 mr-2" /> Insights
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go({ name: "achievements" })}>
                  <Award className="w-4 h-4 mr-2" /> Achievements
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go({ name: "history" })}>
                  <History className="w-4 h-4 mr-2" /> History
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go({ name: "settings" })}>
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive">
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex w-60 flex-col border-r bg-background p-3 sticky top-14 h-[calc(100vh-3.5rem)]">
          <nav className="flex flex-col gap-1">
            <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Main
            </div>
            {NAV_FULL.slice(0, 3).map((item) => (
              <NavButton key={item.key} item={item} active={page.name === item.key} go={go} />
            ))}
            <div className="px-3 py-2 mt-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Insights
            </div>
            {NAV_FULL.slice(3, 5).map((item) => (
              <NavButton key={item.key} item={item} active={page.name === item.key} go={go} />
            ))}
            <div className="px-3 py-2 mt-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Account
            </div>
            {NAV_FULL.slice(5).map((item) => (
              <NavButton key={item.key} item={item} active={page.name === item.key} go={go} />
            ))}
          </nav>
          <PomodoroTimer />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-8">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8">{children}</div>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb">
        <div className="grid grid-cols-5 h-16">
          {NAV_MOBILE.map((item) => {
            const active = page.name === item.key;
            return (
              <button
                key={item.key}
                onClick={() => go({ name: item.key } as Page)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[10px] transition-colors relative",
                  active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-500 rounded-full" />}
                <item.icon className="w-5 h-5" />
                <span className="font-medium leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <footer className="hidden lg:block mt-auto border-t py-3 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center text-xs text-muted-foreground">
          <span>HabitFlow · Build better habits, one day at a time.</span>
        </div>
      </footer>

      {/* Mobile floating Pomodoro timer */}
      <MobilePomodoroFab />

      {/* Cross-cutting music/auth integrations — invisible but mounted globally */}
      <PlaylistOverlay />
      <FocusMusicManager />
      <AuthMusicSync />

      {/* New-account onboarding: starter pack modal that auto-opens on the
          first AppShell mount after registration. This is a SEPARATE instance
          from the StarterPacksPicker on the Habits page — they share no
          state, so opening one doesn't affect the other. */}
      <StarterPacksPicker
        open={starterPackOpen}
        onClose={handleStarterPackClose}
      />
    </div>
  );
}

function NavButton({
  item,
  active,
  go,
}: {
  item: NavItem;
  active: boolean;
  go: (page: Page) => void;
}) {
  return (
    <button
      onClick={() => go({ name: item.key } as Page)}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative group",
        active
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-r-full" />}
      <item.icon className="w-4 h-4" />
      {item.label}
    </button>
  );
}
