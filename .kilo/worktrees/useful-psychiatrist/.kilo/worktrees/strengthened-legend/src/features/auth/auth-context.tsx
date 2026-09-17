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
