import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CoachLetterModal } from "@/features/insights/components/CoachLetterModal";

/**
 * Public share page for a Weekly Coach Letter.
 * No auth required — token-gated.
 * Route: /coach-letter/[token]
 */

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const letter = await db.weeklyCoachLetter.findUnique({
    where: { shareToken: token },
    include: {
      user: {
        select: { firstName: true, name: true },
      },
    },
  });

  if (!letter) {
    return {
      title: "Coach Letter — HabitFlow",
      description: "This letter is no longer shared.",
    };
  }

  const firstName = letter.user.firstName || letter.user.name?.split(" ")[0] || "Someone";

  // Parse sections for OG preview
  let intro = "";
  try {
    const sections = JSON.parse(letter.sections);
    intro = sections.intro || "";
  } catch {
    // use bodyMarkdown
  }

  const description = intro
    ? intro.slice(0, 160)
    : `A weekly coach letter from HabitFlow — personalized insights for ${firstName}.`;

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://habit-flow-nine-eta.vercel.app";

  return {
    title: `${letter.subject} — HabitFlow`,
    description,
    openGraph: {
      title: letter.subject,
      description,
      type: "article",
      siteName: "HabitFlow",
      url: `${appUrl}/coach-letter/${token}`,
      images: [
        {
          url: `${appUrl}/og-image.png`,
          width: 1344,
          height: 768,
          alt: "HabitFlow Coach Letter",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: letter.subject,
      description,
      images: [`${appUrl}/og-image.png`],
    },
  };
}

export default async function CoachLetterSharePage({ params }: PageProps) {
  const { token } = await params;

  const letter = await db.weeklyCoachLetter.findUnique({
    where: { shareToken: token },
    include: {
      user: {
        select: { firstName: true, name: true },
      },
    },
  });

  if (!letter) {
    notFound();
  }

  const firstName = letter.user.firstName || letter.user.name?.split(" ")[0] || "Someone";

  // Parse sections
  let sections: {
    greeting?: string;
    intro?: string;
    whatsWorking?: string;
    whereYouSlipped?: string;
    experiment?: string;
    closing?: string;
  } = {};
  try {
    sections = JSON.parse(letter.sections);
  } catch {
    // fallback: empty sections
  }

  const weekDate = letter.weekStart;

  return (
    <div className="min-h-screen bg-[#0a0510] flex items-center justify-center p-4">
      {/* Ambient gradient background */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-orange-500/20 to-transparent blur-3xl opacity-40 rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-gradient-to-tl from-violet-500/20 to-transparent blur-3xl opacity-40 rounded-full" />
      </div>

      <div className="w-full max-w-2xl">
        {/* "Shared by" badge */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-medium text-violet-300">
            Shared by {firstName}
          </span>
        </div>

        {/* Render the letter in readOnly mode */}
        <CoachLetterModal
          readOnly
          subject={letter.subject}
          sections={sections}
          weekStart={weekDate}
          firstName={firstName}
        />

        {/* CTA at the bottom */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-medium text-sm transition-all shadow-lg shadow-violet-500/20"
          >
            Start building better habits
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
