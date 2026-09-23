import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, isDevEmailMode, getAppUrl } from "@/lib/email/send";
import { computeWeeklyStatsForCron } from "@/lib/email/stats";
import WeeklySummaryEmail from "@/features/emails/WeeklySummaryEmail";
import { createElement } from "react";

/**
 * Vercel Cron: weekly summary email batch.
 *
 * - Scheduled every Monday 09:00 (see vercel.json).
 * - Protected by CRON_SECRET — the request must include `?secret=<CRON_SECRET>`
 *   OR `Authorization: Bearer <CRON_SECRET>`.
 * - Iterates every user with `emailRemindersEnabled = true`, computes their
 *   weekly stats, skips if (a) no habits or (b) we already emailed them
 *   within the last 6 days. Otherwise renders the WeeklySummaryEmail React
 *   template and sends it via Resend (or logs to console in dev).
 *
 * Returns:
 *   { ok, mode, sent, skipped, failed, durationMs, logs? }
 *
 * `logs` is only included in dev mode so you can preview the per-user
 * decisions without exposing them in prod.
 */

function checkSecret(req: Request): { ok: boolean; error?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: true }; // no secret configured = open in dev
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (querySecret === secret || bearer === secret) return { ok: true };
  return { ok: false, error: "Unauthorized" };
}

/** Six days in ms — used to dedupe weekly sends if the cron fires twice. */
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const startedAt = Date.now();
  const secretCheck = checkSecret(req);
  if (!secretCheck.ok) {
    return NextResponse.json({ detail: secretCheck.error }, { status: 401 });
  }

  const dev = isDevEmailMode();
  const appUrl = getAppUrl();
  const logs: string[] = [];

  // Find every user opted into weekly email reminders.
  const users = await db.user.findMany({
    where: { emailRemindersEnabled: true },
    select: {
      id: true,
      email: true,
      name: true,
      lastWeeklyEmailAt: true,
      emailUnsubscribeToken: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of users) {
    try {
      // Skip if we already emailed them within the last 6 days (dedupe).
      if (u.lastWeeklyEmailAt) {
        const ageMs = Date.now() - u.lastWeeklyEmailAt.getTime();
        if (ageMs < SIX_DAYS_MS) {
          skipped++;
          logs.push(`[skip-recent] ${u.email} — last sent ${Math.round(ageMs / (60 * 60 * 1000))}h ago`);
          continue;
        }
      }

      const stats = await computeWeeklyStatsForCron(u.id);
      if (!stats) {
        skipped++;
        logs.push(`[skip-empty] ${u.email} — no active habits`);
        continue;
      }

      // Ensure the user has an unsubscribe token (so the footer link works).
      let unsubscribeToken = u.emailUnsubscribeToken;
      if (!unsubscribeToken) {
        unsubscribeToken = crypto.randomUUID();
        await db.user.update({
          where: { id: u.id },
          data: { emailUnsubscribeToken: unsubscribeToken },
        });
      }

      // Render the React Email template — use createElement so this file can
      // stay a plain .ts route (no JSX) per Next.js conventions.
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

      const subject = `Your HabitFlow weekly summary — ${stats.overallPct}% complete`;
      const result = await sendEmail({
        to: stats.email,
        subject,
        react: reactEl,
      });

      if (!result.ok) {
        failed++;
        logs.push(`[fail] ${u.email} — ${result.error || "unknown error"}`);
        continue;
      }

      // Persist lastWeeklyEmailAt so we dedupe within the next 6 days.
      await db.user.update({
        where: { id: u.id },
        data: { lastWeeklyEmailAt: new Date() },
      });
      sent++;
      logs.push(`[${result.mode === "dev-console" ? "logged" : "sent"}] ${u.email} — ${stats.overallPct}% (id=${result.messageId || "—"})`);
    } catch (e) {
      failed++;
      logs.push(`[error] ${u.email} — ${(e as Error).message}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  return NextResponse.json({
    ok: true,
    mode: dev ? "dev-console" : "production",
    totalUsers: users.length,
    sent,
    skipped,
    failed,
    durationMs,
    ...(dev ? { logs } : {}),
  });
}
