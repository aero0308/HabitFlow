"use client";

import { useState, useCallback } from "react";
import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import { QueryProvider } from "@/lib/query-provider";
import { AuthScreen } from "@/features/auth/auth-screen";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { HabitsPage } from "@/features/habits/habits-page";
import { HabitDetailPage } from "@/features/habits/habit-detail-page";
import { AnalyticsPage } from "@/features/analytics/analytics-page";
import { InsightsPage } from "@/features/insights/insights-page";
import { MoodPage } from "@/features/mood/mood-page";
import { AchievementsPage } from "@/features/achievements/achievements-page";
import { HistoryPage } from "@/features/history/history-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { OffModePage } from "@/features/settings/OffModePage";
import { TimeOfDayPage } from "@/features/settings/TimeOfDayPage";
import { LandingPage } from "@/features/landing/landing-page";
import { useNav } from "@/lib/nav-store";
import { Loader2 } from "lucide-react";

function PageRouter() {
  const { page } = useNav();
  switch (page.name) {
    case "dashboard":
      return <DashboardPage />;
    case "habits":
      return <HabitsPage />;
    case "habit":
      return <HabitDetailPage />;
    case "analytics":
      return <AnalyticsPage />;
    case "insights":
      return <InsightsPage />;
    case "mood":
      return <MoodPage />;
    case "achievements":
      return <AchievementsPage />;
    case "history":
      return <HistoryPage />;
    case "settings":
      return <SettingsPage />;
    case "off-mode":
      return <OffModePage />;
    case "time-of-day":
      return <TimeOfDayPage />;
    default:
      return <DashboardPage />;
  }
}

type UnauthView = "landing" | "login" | "register";

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const [unauthView, setUnauthView] = useState<UnauthView>("landing");

  const showAuth = useCallback((view: "login" | "register") => setUnauthView(view), []);
  const backToLanding = useCallback(() => setUnauthView("landing"), []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-muted-foreground">Loading HabitFlow…</p>
        </div>
      </div>
    );
  }

  // Authenticated → app (dashboard)
  if (isAuthenticated) {
    return (
      <AppShell>
        <PageRouter />
      </AppShell>
    );
  }

  // Unauthenticated → landing page (default) or auth screen
  if (unauthView === "landing") {
    return <LandingPage onShowAuth={showAuth} />;
  }

  return <AuthScreen initialMode={unauthView} onBack={backToLanding} />;
}

export default function Home() {
  return (
    <QueryProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryProvider>
  );
}
