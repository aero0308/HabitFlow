"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { useAchievements } from "@/hooks/use-analytics";
import { useMoods } from "@/hooks/use-moods";
import type { Achievement } from "@/types";

/**
 * ShareCard data shape — the sports-stat-card layout needs individual
 * stat fields (not an array) so each row can hard-code its icon + label.
 */
export interface ShareCardBadge {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
}

export interface ShareCardData {
  displayName: string;
  tagline: string;
  avatarUrl: string;
  username: string;
  // Individual stats for the 6 stat rows
  currentStreak: number;
  checkins: number;
  avgMood: number;
  hasMood: boolean;
  perfectDays: number;
  activeHabits: number;
  bestStreak: number;
  daysTracked: number;
  // Badges (kept for potential other uses; not rendered on the new card)
  badges: ShareCardBadge[];
  loading: boolean;
}

function sortBadgesByRarity(list: Achievement[]): Achievement[] {
  return [...list].sort((a, b) => {
    if (b.target !== a.target) return b.target - a.target;
    return a.id.localeCompare(b.id);
  });
}

export function useShareCardData(): ShareCardData {
  const { user } = useAuth();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: !!user,
  });
  const { data: achievementsData, isLoading: achievementsLoading } = useAchievements();

  const moodRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { from: fmt(from), to: fmt(to) };
  }, []);
  const { data: moodsData, isLoading: moodsLoading } = useMoods(moodRange.from, moodRange.to);

  const loading = achievementsLoading || moodsLoading || !achievementsData;

  const displayName =
    [settings?.firstName, settings?.lastName].filter(Boolean).join(" ") ||
    settings?.name ||
    user?.name ||
    "HabitBuilder";

  const tagline = settings?.tagline || "";
  const avatarUrl = settings?.avatarUrl || user?.avatarUrl || "";
  const username = settings?.username || user?.id || "";

  const stats = useMemo(() => {
    const s = achievementsData?.stats;
    const moods = moodsData ?? [];
    const avgMood =
      moods.length > 0
        ? moods.reduce((sum, m) => sum + (m.score || 0), 0) / moods.length
        : 0;
    const hasMood = moods.length > 0;

    return {
      currentStreak: s?.maxCurrentStreak ?? 0,
      checkins: s?.totalCheckins ?? 0,
      avgMood,
      hasMood,
      perfectDays: s?.perfectDays ?? 0,
      activeHabits: s?.totalHabits ?? 0,
      bestStreak: s?.maxLongestStreak ?? 0,
      daysTracked: s?.totalActiveDays ?? 0,
    };
  }, [achievementsData, moodsData]);

  const badges = useMemo<ShareCardBadge[]>(() => {
    if (!achievementsData) return [];
    const earned = achievementsData.achievements.filter((a) => a.earned);
    return sortBadgesByRarity(earned).slice(0, 6).map((a) => ({
      id: a.id,
      title: a.title,
      icon: a.icon,
      color: a.color,
      description: a.description,
    }));
  }, [achievementsData]);

  return {
    displayName,
    tagline,
    avatarUrl,
    username,
    ...stats,
    badges,
    loading,
  };
}
