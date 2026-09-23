import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";
import { generateSuggestedQuestions } from "@/lib/ai/suggestedQuestions";

/**
 * GET /api/insights/chat/suggested-questions?mode=data|general
 *
 * Returns 3-5 suggested questions the user can click to start a chat.
 *
 *  - mode=data (default): data-driven suggestions picked from detected
 *    patterns + per-habit stats (see src/lib/ai/suggestedQuestions.ts).
 *    If the user has no habits, returns generic getting-started questions.
 *  - mode=general: a static list of general productivity / habit-advice
 *    prompts suitable for the "Ask Anything" assistant.
 *
 * Response: { questions: string[] }
 */

const GENERAL_QUESTIONS = [
  "What habits should I follow to improve productivity?",
  "How do I build a morning routine?",
  "Suggest habits for better sleep",
  "How do I stop procrastinating?",
  "Ideas to reduce screen time",
];

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();

    // Resolve mode — accept "data" or "general"; default to "data".
    const modeParam = req.nextUrl.searchParams.get("mode");
    const mode =
      modeParam === "general" || modeParam === "data" ? modeParam : "data";

    if (mode === "general") {
      return apiOk({ questions: GENERAL_QUESTIONS });
    }

    // mode === "data"
    // If the user has no habits at all, return generic questions to keep
    // the UI useful rather than empty.
    const habitsCount = await db.habit.count({
      where: { userId: user.id, isArchived: false },
    });

    if (habitsCount === 0) {
      return apiOk({
        questions: [
          "How do I get started with habits?",
          "What should I track first?",
          "How does HabitFlow work?",
        ],
      });
    }

    // Generate data-driven suggestions, then ensure the four canonical
    // data-mode prompts are always offered (the spec lists 4 specific
    // questions). We dedupe against the generated set so we don't show
    // near-duplicates.
    const generated = await generateSuggestedQuestions(user.id);
    const canonical = [
      "Why am I tired on Tuesdays?",
      "What's my strongest habit right now?",
      "Am I improving this month?",
      "Which habit has the biggest impact on my mood?",
    ];
    const lower = new Set(generated.map((q) => q.toLowerCase()));
    const merged = [...generated];
    for (const q of canonical) {
      if (merged.length >= 5) break;
      if (!lower.has(q.toLowerCase())) {
        merged.push(q);
      }
    }
    return apiOk({ questions: merged.slice(0, 5) });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return apiError("Not authenticated", 401, "UNAUTHORIZED");
    }
    return apiError(e instanceof Error ? e.message : "Failed to load suggestions");
  }
}
