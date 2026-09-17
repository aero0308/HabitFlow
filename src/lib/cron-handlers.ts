import { db } from "@/lib/db";
import { toDateString, isHabitScheduled } from "@/lib/streak";
import type { Habit } from "@prisma/client";

/**
 * Weekly reminder cron endpoint.
 *
 * Runs every Sunday 08:00 UTC (scheduled via external cron, e.g. Render Cron / Vercel Cron / system cron).
 * For each user with `emailRemindersEnabled = true`, builds a weekly summary email.
 *
 * In development (NODE_ENV !== "production" or no RESEND_API_KEY), emails are logged to the server console
 * instead of being sent (per the original spec: "For dev: log emails to console instead of sending").
 *
 * Security: protected by an optional CRON_SECRET env var. If set, the request must include
 * `?secret=<CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.
 */

interface UserWeeklySummary {
  userId: string;
  email: string;
  name: string;
  weekStart: string;
  weekEnd: string;
  totalScheduled: number;
  totalCompleted: number;
  overallPct: number;
  deltaVsLastWeek: number;
  habitHighlights: { name: string; icon: string; rate: number; currentStreak: number }[];
  maxCurrentStreak: number;
  newBadgesHint: boolean;
}

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

async function buildUserSummary(user: { id: string; email: string; name: string; timezone: string }): Promise<UserWeeklySummary | null> {
  const today = new Date();
  // Find Monday of current week (Mon-first)
  const jsDay = today.getDay();
  const monFirst = jsDay === 0 ? 6 : jsDay - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - monFirst);
  thisMonday.setHours(0, 0, 0, 0);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisMonday.getDate() + 6);

  const habits = await db.habit.findMany({
    where: { userId: user.id, isArchived: false },
    include: { streak: true },
  });
  if (habits.length === 0) return null;

  const habitIds = habits.map((h) => h.id);
  const fromStr = toDateString(lastMonday);
  const toStr = toDateString(thisSunday);
  const checkins = await db.checkin.findMany({
    where: { habitId: { in: habitIds }, date: { gte: fromStr, lte: toStr } },
  });

  // This week (Mon-Sun, up to today)
  let thisScheduled = 0;
  let thisCompleted = 0;
  const habitHighlights: UserWeeklySummary["habitHighlights"] = [];
  for (const h of habits) {
    let hScheduled = 0;
    let hCompleted = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(thisMonday);
      day.setDate(thisMonday.getDate() + d);
      if (day > today) break;
      if (isHabitScheduled(h, day)) {
        hScheduled += 1;
        const ci = checkins.find((c) => c.habitId === h.id && c.date === toDateString(day));
        if (ci && ci.count >= h.targetCount) hCompleted += 1;
      }
    }
    thisScheduled += hScheduled;
    thisCompleted += hCompleted;
    habitHighlights.push({
      name: h.name,
      icon: h.icon,
      rate: hScheduled === 0 ? 0 : Math.round((hCompleted / hScheduled) * 100),
      currentStreak: h.streak?.currentStreak ?? 0,
    });
  }

  // Last week (full Mon-Sun)
  let lastScheduled = 0;
  let lastCompleted = 0;
  for (const h of habits) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(lastMonday);
      day.setDate(lastMonday.getDate() + d);
      if (isHabitScheduled(h, day)) {
        lastScheduled += 1;
        const ci = checkins.find((c) => c.habitId === h.id && c.date === toDateString(day));
        if (ci && ci.count >= h.targetCount) lastCompleted += 1;
      }
    }
  }

  const thisPct = thisScheduled === 0 ? 0 : Math.round((thisCompleted / thisScheduled) * 100);
  const lastPct = lastScheduled === 0 ? 0 : Math.round((lastCompleted / lastScheduled) * 100);
  const maxCurrentStreak = Math.max(0, ...habits.map((h) => h.streak?.currentStreak ?? 0));

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    weekStart: toDateString(thisMonday),
    weekEnd: toDateString(thisSunday),
    totalScheduled: thisScheduled,
    totalCompleted: thisCompleted,
    overallPct: thisPct,
    deltaVsLastWeek: thisPct - lastPct,
    habitHighlights,
    maxCurrentStreak,
    newBadgesHint: maxCurrentStreak >= 7,
  };
}

function renderEmailText(s: UserWeeklySummary): string {
  const deltaText = s.deltaVsLastWeek > 0 ? `(+${s.deltaVsLastWeek} vs last week)` : s.deltaVsLastWeek < 0 ? `(${s.deltaVsLastWeek} vs last week)` : "(same as last week)";
  const habitLines = s.habitHighlights
    .map((h) => `  ${h.icon} ${h.name}: ${h.rate}%${h.currentStreak > 0 ? ` — ${h.currentStreak} day streak 🔥` : ""}`)
    .join("\n");
  const encouragement =
    s.overallPct >= 80
      ? "You're on fire! Keep up the amazing consistency."
      : s.overallPct >= 50
        ? "Great progress this week. Every check-in counts."
        : "A new week is a fresh start. Pick one habit to focus on tomorrow.";

  return `Hi ${s.name},

Here's your HabitFlow weekly summary for ${s.weekStart} to ${s.weekEnd}:

📊 Completion: ${s.overallPct}% (${s.totalCompleted}/${s.totalScheduled}) ${deltaText}
🔥 Best current streak: ${s.maxCurrentStreak} days

Habits this week:
${habitLines}

${encouragement}

Keep building those habits!
— HabitFlow

---
You're receiving this because weekly email reminders are enabled in your settings.
To unsubscribe, log in and disable "Weekly email reminders" in Settings.`;
}

function renderEmailHtml(s: UserWeeklySummary): string {
  const deltaColor = s.deltaVsLastWeek > 0 ? "#10b981" : s.deltaVsLastWeek < 0 ? "#ef4444" : "#6b7280";
  const deltaText = s.deltaVsLastWeek > 0 ? `+${s.deltaVsLastWeek}` : `${s.deltaVsLastWeek}`;
  const habitRows = s.habitHighlights
    .map(
      (h) => `
        <tr>
          <td style="padding:8px 12px;font-size:14px">${h.icon} ${h.name}</td>
          <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:600">${h.rate}%</td>
          <td style="padding:8px 12px;font-size:14px;text-align:right;color:#f97316">${h.currentStreak > 0 ? `${h.currentStreak}d 🔥` : "—"}</td>
        </tr>`,
    )
    .join("");
  const encouragement =
    s.overallPct >= 80
      ? "You're on fire! Keep up the amazing consistency."
      : s.overallPct >= 50
        ? "Great progress this week. Every check-in counts."
        : "A new week is a fresh start. Pick one habit to focus on tomorrow.";

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
  <div style="background:linear-gradient(135deg,#10b981,#0d9488);padding:24px;border-radius:12px 12px 0 0;color:white">
    <h1 style="margin:0;font-size:22px;font-weight:700">HabitFlow weekly summary</h1>
    <p style="margin:4px 0 0;font-size:14px;opacity:0.9">${s.weekStart} → ${s.weekEnd}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <div style="font-size:32px;font-weight:700;color:#10b981">${s.overallPct}%</div>
        <div style="font-size:12px;color:#6b7280">completion this week</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:600;color:${deltaColor}">${deltaText}</div>
        <div style="font-size:12px;color:#6b7280">vs last week</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead>
        <tr style="border-bottom:1px solid #e5e7eb">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">Habit</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">Rate</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">Streak</th>
        </tr>
      </thead>
      <tbody>${habitRows}</tbody>
    </table>
    <p style="font-size:14px;color:#374151;margin:16px 0">${encouragement}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:12px;color:#9ca3af">You're receiving this because weekly email reminders are enabled. Disable in Settings to unsubscribe.</p>
  </div>
</body>
</html>`;
}

export async function GET_weekly_reminder(req: Request) {
  const secretCheck = checkSecret(req);
  if (!secretCheck.ok) {
    return Response.json({ detail: secretCheck.error }, { status: 401 });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const hasResendKey = !!process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "habits@yourdomain.com";

  // Fetch all users with reminders enabled
  const users = await db.user.findMany({
    where: { emailRemindersEnabled: true },
    select: { id: true, email: true, name: true, timezone: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const logs: string[] = [];

  for (const user of users) {
    try {
      const summary = await buildUserSummary(user);
      if (!summary) {
        skipped++;
        logs.push(`[skip] ${user.email} — no active habits`);
        continue;
      }

      if (!isProduction || !hasResendKey) {
        // Dev mode: log to console
        console.log("\n" + "=".repeat(60));
        console.log(`📧 WEEKLY REMINDER EMAIL (dev console)`);
        console.log(`To: ${summary.email}`);
        console.log(`From: ${fromEmail}`);
        console.log(`Subject: Your HabitFlow weekly summary — ${summary.overallPct}% complete`);
        console.log("-".repeat(60));
        console.log(renderEmailText(summary));
        console.log("=".repeat(60) + "\n");
        logs.push(`[logged] ${user.email} — ${summary.overallPct}%`);
        sent++;
        continue;
      }

      // Production: send via Resend
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: summary.email,
            subject: `Your HabitFlow weekly summary — ${summary.overallPct}% complete`,
            text: renderEmailText(summary),
            html: renderEmailHtml(summary),
          }),
        });
        if (!resendRes.ok) {
          const errText = await resendRes.text();
          failed++;
          logs.push(`[fail] ${user.email} — Resend ${resendRes.status}: ${errText.slice(0, 100)}`);
        } else {
          sent++;
          logs.push(`[sent] ${user.email} — ${summary.overallPct}%`);
        }
      } catch (e) {
        failed++;
        logs.push(`[fail] ${user.email} — ${(e as Error).message}`);
      }
    } catch (e) {
      failed++;
      logs.push(`[error] ${user.email} — ${(e as Error).message}`);
    }
  }

  // Always return a summary; in dev, include the logs for visibility
  return Response.json({
    ok: true,
    mode: isProduction && hasResendKey ? "production" : "dev-console",
    totalUsers: users.length,
    sent,
    skipped,
    failed,
    ...(isProduction && hasResendKey ? {} : { logs }),
  });
}
