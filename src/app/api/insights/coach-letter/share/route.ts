import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";
import crypto from "crypto";

/**
 * POST /api/insights/coach-letter/share
 * Generates a shareToken for the current week's letter.
 * Returns { shareUrl } — the user can copy and share this link.
 *
 * DELETE /api/insights/coach-letter/share
 * Clears the shareToken (unshares the letter).
 */

function generateToken(): string {
  return crypto.randomBytes(9).toString("base64url").slice(0, 12);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const weekParam = req.nextUrl.searchParams.get("week");

    // Compute weekStart (Monday of the current week)
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Monday
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    // Use param if provided
    const targetWeek = weekParam || weekStartStr;

    // Find the letter for this week
    const letter = await db.weeklyCoachLetter.findUnique({
      where: {
        userId_weekStart: { userId: user.id, weekStart: targetWeek },
      },
    });

    if (!letter) {
      return apiError("No letter found for this week. Generate one first.", 404, "NOT_FOUND");
    }

    // Generate or reuse token
    let token = letter.shareToken;
    if (!token) {
      token = generateToken();
      await db.weeklyCoachLetter.update({
        where: { id: letter.id },
        data: { shareToken: token },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
    const shareUrl = `${appUrl}/coach-letter/${token}`;

    return apiOk({ shareUrl, token });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to create share link", 500, "SHARE_ERROR");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const weekParam = req.nextUrl.searchParams.get("week");

    // Compute weekStart
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const targetWeek = weekParam || weekStartStr;

    // Clear the shareToken
    await db.weeklyCoachLetter.updateMany({
      where: { userId: user.id, weekStart: targetWeek },
      data: { shareToken: null },
    });

    return apiOk({ ok: true });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to remove share link", 500, "SHARE_ERROR");
  }
}
