import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiError, withErrorHandler } from "@/lib/api";
import { sendEmail, isDevEmailMode, getAppUrl } from "@/lib/email/send";
import { computeWeeklyStats, sampleWeeklyStats, getBrowserTimezone } from "@/lib/email/stats";
import WeeklySummaryEmail from "@/features/emails/WeeklySummaryEmail";
import { createElement } from "react";

/**
 * POST /api/emails/test-weekly-summary
 *
 * Sends a test weekly summary email to the *currently authenticated* user.
 *
 * - Auth required (uses the user's own email as the recipient).
 * - Rate-limited to one send per 60s per user (in-memory Map — fine for
 *   single-instance deploys; cron path doesn't need this).
 * - If the user has no habits/checkins to summarize, falls back to sample
 *   data so the email template can still be previewed (`sample: true` in
 *   the response).
 *
 * Returns: { ok, dev, sample, messageId, email }
 */

const RATE_LIMIT_MS = 60 * 1000;
const lastSentByUser = new Map<string, number>();

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireUser();

  // ---- rate limit ----
  const now = Date.now();
  const last = lastSentByUser.get(user.id) ?? 0;
  const remainingMs = RATE_LIMIT_MS - (now - last);
  if (remainingMs > 0) {
    return apiError(
      `Please wait ${Math.ceil(remainingMs / 1000)}s before sending another test email.`,
      429,
      "RATE_LIMITED",
    );
  }

  // ---- compute stats (real or sample) ----
  const browserTz = getBrowserTimezone(req);
  let stats = await computeWeeklyStats(user, browserTz);
  let isSample = false;
  if (!stats) {
    stats = sampleWeeklyStats(user);
    isSample = true;
  }

  // ---- ensure unsubscribe token ----
  let unsubscribeToken: string;
  const freshUser = await db.user.findUnique({
    where: { id: user.id },
    select: { emailUnsubscribeToken: true },
  });
  if (freshUser?.emailUnsubscribeToken) {
    unsubscribeToken = freshUser.emailUnsubscribeToken;
  } else {
    unsubscribeToken = crypto.randomUUID();
    await db.user.update({
      where: { id: user.id },
      data: { emailUnsubscribeToken: unsubscribeToken },
    });
  }

  // ---- render + send ----
  const appUrl = getAppUrl();
  const subject = isSample
    ? `[SAMPLE] Your HabitFlow weekly summary — ${stats.overallPct}% complete`
    : `Your HabitFlow weekly summary — ${stats.overallPct}% complete`;

  const reactEl = createElement(WeeklySummaryEmail, {
    userName: stats.name,
    weekStart: stats.weekStart,
    weekEnd: stats.weekEnd,
    overallPct: stats.overallPct,
    totalCompleted: stats.totalCompleted,
    totalScheduled: stats.totalScheduled,
    deltaVsLastWeek: stats.deltaVsLastWeek,
    maxCurrentStreak: stats.maxCurrentStreak,
    habits: stats.habits,
    topWin: stats.topWin,
    needsAttention: stats.needsAttention,
    avgMood: stats.avgMood,
    appUrl,
    unsubscribeToken,
  });

  const result = await sendEmail({
    to: stats.email,
    subject,
    react: reactEl,
  });

  if (!result.ok) {
    return apiError(
      result.error || "Email send failed",
      502,
      "EMAIL_FAILED",
    );
  }

  lastSentByUser.set(user.id, Date.now());

  return NextResponse.json({
    ok: true,
    dev: result.mode === "dev-console",
    sample: isSample,
    messageId: result.messageId,
    email: stats.email,
  });
});
