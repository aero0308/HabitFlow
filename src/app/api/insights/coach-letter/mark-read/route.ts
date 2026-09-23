import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";
import { getWeekStart } from "@/lib/ai/buildCoachContext";

/**
 * POST /api/insights/coach-letter/mark-read
 *
 * Marks the user's WeeklyCoachLetter for the current (or specified) week as
 * read by setting `readAt = now()`. Idempotent — calling twice is fine.
 *
 * Body (optional): `{ "week": "YYYY-MM-DD" }`. If omitted, uses current week.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    // Resolve target week (body or current)
    let weekParam: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.week === "string") weekParam = body.week;
    } catch {
      // Body may be empty — that's fine
    }
    const weekStart = weekParam
      ? getWeekStart(new Date(weekParam))
      : getWeekStart();
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const updated = await db.weeklyCoachLetter.updateMany({
      where: { userId: user.id, weekStart: weekStartStr },
      data: { readAt: new Date() },
    });

    if (updated.count === 0) {
      return apiError(
        "No letter for this week yet.",
        404,
        "NOT_FOUND",
      );
    }

    return apiOk({ marked: true, weekStart: weekStartStr });
  } catch (e) {
    return apiError(
      e instanceof Error ? e.message : "Failed to mark letter as read",
    );
  }
}
