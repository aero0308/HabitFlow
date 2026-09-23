"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [justLoggedOut, setJustLoggedOut] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.me(),
    enabled: !justLoggedOut,
    retry: false,
  });

  const login = useCallback(
    async (email: string, password: string, remember?: boolean) => {
      const { user } = await api.login({ email, password, remember });
      setJustLoggedOut(false);
      queryClient.setQueryData(["auth", "me"], { user });
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const { user } = await api.register({ email, password, name });
      // Set the onboarding flags BEFORE updating the auth state below.
      // The state update triggers AuthGate to re-render → AppShell mounts
      // → OnboardingTour's useEffect reads localStorage on mount. If we
      // set the flags AFTER setQueryData/invalidateQueries, React might
      // process the state update (and mount AppShell) BEFORE the flags
      // are written — and OnboardingTour's "open if pending" check would
      // then read stale (empty) localStorage and skip opening the tour.
      //
      // Setting the flags first guarantees they're in localStorage by the
      // time any downstream component mounts.
      //
      // Flow:
      //   1. Tour opens FIRST (habitflow-tour-pending-v1=1) to introduce
      //      the app's key features.
      //   2. Once the tour is dismissed, markTourCompleted() dispatches
      //      TOUR_CHANGED_EVENT. AppShell's listener sees that
      //      starter-pack-pending is still set AND tour-pending is now
      //      cleared → opens the StarterPacksPicker so the user can
      //      seed a few habits in one click.
      if (typeof window !== "undefined") {
        localStorage.removeItem("habitflow-tour-completed-v1");
        localStorage.removeItem("habitflow-tour-pending-v1");
        localStorage.removeItem("habitflow-starterpack-pending-v1");
        localStorage.setItem("habitflow-tour-pending-v1", "true");
        localStorage.setItem("habitflow-starterpack-pending-v1", "true");
      }
      setJustLoggedOut(false);
      queryClient.setQueryData(["auth", "me"], { user });
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore network errors on logout
    }
    setJustLoggedOut(true);
    queryClient.setQueryData(["auth", "me"], null);
    queryClient.clear();
  }, [queryClient]);

  const user = data?.user ?? null;

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
