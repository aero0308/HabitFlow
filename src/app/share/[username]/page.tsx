import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getShareCardData } from "@/lib/share-card";
import { ShareCard } from "@/features/share/components/ShareCard";

/**
 * Public share page — `/share/[username]`.
 *
 * No auth required. Renders the user's ShareCard (server-side) plus a CTA
 * to "Start your own tracker →". If the user doesn't exist OR has
 * `isShareCardPublic=false`, we 404 via `notFound()`.
 *
 * OG metadata is generated dynamically from the user's stats so social
 * previews show "{name} has a {N}-day streak on HabitFlow 🔥" etc.
 */

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const data = await getShareCardData(username);
  if (!data) {
    return {
      title: "Share card — HabitFlow",
      description: "This share card is private or no longer available.",
    };
  }

  const streakStat = data.stats.find((s) => s.label === "Current streak");
  const checkinStat = data.stats.find((s) => s.label === "Total check-ins");
  const description = `See ${data.displayName}'s habit journey on HabitFlow — ${streakStat?.value ?? "0d"} streak, ${checkinStat?.value ?? "0"} check-ins, and counting.`;

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://habitflow.app";
  const ogImage = `${appUrl}/og-image.png`;

  return {
    title: `${data.displayName} — HabitFlow`,
    description,
    openGraph: {
      title: `${data.displayName} on HabitFlow`,
      description,
      type: "profile",
      siteName: "HabitFlow",
      url: data.shareUrl,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${data.displayName}'s HabitFlow share card`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${data.displayName} on HabitFlow`,
      description,
      images: [ogImage],
    },
  };
}

export default async function ShareCardPublicPage({ params }: PageProps) {
  const { username } = await params;
  const data = await getShareCardData(username);

  if (!data) {
    notFound();
  }

  // The DTO satisfies the minimal ShareCardData prop interface.
  const cardData = {
    displayName: data.displayName,
    tagline: data.tagline,
    avatarUrl: data.avatarUrl,
    username: data.username,
    stats: data.stats,
    badges: data.badges,
  };

  // Look up the owner's full user record so we can show a "Shared by" badge
  // with their profile pic when the page is loaded.
  const owner = await db.user.findFirst({
    where: { username, NOT: { username: "" } },
    select: { id: true, firstName: true, lastName: true, name: true, avatarUrl: true },
  });
  const sharedByName =
    owner && (owner.firstName || owner.name)
      ? owner.firstName || owner.name
      : data.displayName;
  const sharedByAvatar = owner?.avatarUrl || data.avatarUrl;

  return (
    <div className="min-h-screen bg-[#0a0510] text-white flex flex-col items-center justify-center px-4 py-10">
      {/* Ambient gradient background — matches the card */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-500/20 blur-3xl opacity-50" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[700px] h-[700px] rounded-full bg-amber-500/15 blur-3xl opacity-40" />
      </div>

      {/* "Shared by" badge */}
      <div className="flex items-center justify-center gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/80">
          {sharedByAvatar ? (
            <img
              src={sharedByAvatar}
              alt={sharedByName}
              className="w-4 h-4 rounded-full object-cover"
            />
          ) : (
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white">
              {sharedByName.charAt(0).toUpperCase()}
            </span>
          )}
          Shared by {sharedByName}
        </span>
      </div>

      {/*
        The card is rendered at 1080×1350 (full resolution for crisp display
        on retina screens). It's wrapped in an aspect-ratio-locked container
        that scales down to fit the viewport — `transform: scale()` does the
        shrinking while the parent's `aspectRatio` keeps the layout correct.
      */}
      <div
        style={{
          width: "min(540px, calc(100vw - 32px))",
          aspectRatio: "1080 / 1350",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 1080,
            height: 1350,
            transform: "scale(calc(min(540px, calc(100vw - 32px)) / 1080))",
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
            borderRadius: 40,
            overflow: "hidden",
            boxShadow:
              "0 24px 80px -32px rgba(139,92,246,0.55), 0 0 0 1px rgba(167,139,250,0.25)",
          }}
        >
          <ShareCard data={cardData} variant="portrait" />
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-8">
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-medium text-sm transition-all shadow-lg shadow-violet-500/30"
        >
          Start your own tracker
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <p className="text-white/40 text-xs mt-3">
          Free, private by default. Build habits, break bad ones.
        </p>
      </div>
    </div>
  );
}
