import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ai/buildCoachContext";
import { generateCoachLetter } from "@/lib/ai/generateCoachLetter";

/**
 * Vercel Cron: weekly coach letter batch.
 *
 * Scheduled Monday 06:00 UTC (see vercel.json). For every user with
 * `aiWeeklyInsightsEnabled = true` AND a stored AI key:
 *   1. Compute last Monday (start of the week just ended).
 *   2. Skip if a WeeklyCoachLetter already exists for that week (idempotent).
 *   3. Call generateCoachLetter in try/catch (isolated per user).
 *   4. Log results — one failure doesn't block the others.
 *
 * Auth: CRON_SECRET — query param `?secret=` OR `Authorization: Bearer`.
 * Pattern mirrors /api/cron/send-weekly-summary/route.ts.
 */

function checkSecret(req: Request): { ok: boolean; error?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: true }; // no secret configured = open in dev
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (querySecret === secret || bearer === secret) return { ok: true };
  return { ok: false, error: "Unauthorized" };
}

export async function POST(req: Request) {
  return runCron(req);
}

// Allow GET too so it can be triggered from a browser for testing in dev
export async function GET(req: Request) {
  return runCron(req);
}

async function runCron(req: Request) {
  const startedAt = Date.now();
  const secretCheck = checkSecret(req);
  if (!secretCheck.ok) {
    return NextResponse.json(
      { detail: secretCheck.error },
      { status: 401 },
    );
  }

  // The week that "just ended" — its Monday is one week before the current
  // week's Monday. (Cron fires Monday 06:00 UTC, so the analyzed week is
  // Sun-just-ended through Mon-just-started's previous Monday.)
  const lastWeekStart = getWeekStart(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const weekStartStr = lastWeekStart.toISOString().slice(0, 10);

  // Find every user opted into weekly AI insights AND with a stored key
  const users = await db.user.findMany({
    where: {
      aiWeeklyInsightsEnabled: true,
      aiProvider: { not: null },
      aiApiKeyEncrypted: { not: null },
    },
    select: { id: true, email: true, firstName: true },
  });

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const logs: string[] = [];

  for (const u of users) {
    try {
      // 2. Idempotent skip
      const existing = await db.weeklyCoachLetter.findUnique({
        where: {
          userId_weekStart: { userId: u.id, weekStart: weekStartStr },
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        logs.push(`[skip-existing] ${u.email}`);
        continue;
      }

      // 3. Generate (isolated per user)
      await generateCoachLetter(u.id, lastWeekStart);
      generated++;
      logs.push(`[generated] ${u.email}`);
    } catch (e) {
      failed++;
      logs.push(
        `[failed] ${u.email} — ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  return NextResponse.json({
    ok: true,
    weekStart: weekStartStr,
    totalUsers: users.length,
    generated,
    skipped,
    failed,
    durationMs,
    ...(process.env.CRON_SECRET ? {} : { logs }),
  });
}
