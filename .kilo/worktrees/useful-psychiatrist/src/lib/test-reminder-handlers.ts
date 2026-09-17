import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { withErrorHandler, apiError } from "@/lib/api";
import { toDateString, isHabitScheduled } from "@/lib/streak";
import type { Habit } from "@prisma/client";

// Reused from cron-handlers.ts — kept here for the test endpoint so it works
// for the authenticated user immediately (dev: logs to console, prod: sends via Resend).

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
}

async function buildUserSummary(user: { id: string; email: string; name: string; timezone: string }): Promise<UserWeeklySummary | null> {
  const today = new Date();
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
This is a test email preview. You're receiving it because you clicked "Send test email" in Settings.`;
}

/**
 * Send a test weekly reminder email to the authenticated user.
 * In dev mode (no RESEND_API_KEY), logs to console + returns the text preview.
 * In production, sends via Resend and returns success/failure.
 */
export async function POST_test_reminder() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const isProduction = process.env.NODE_ENV === "production";
    const hasResendKey = !!process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || "habits@yourdomain.com";

    const summary = await buildUserSummary(user);
    if (!summary) {
      return apiError("You have no active habits to summarize. Create a habit first.", 422, "NO_HABITS");
    }

    if (!isProduction || !hasResendKey) {
      // Dev mode: log to console + return preview
      console.log("\n" + "=".repeat(60));
      console.log(`📧 TEST WEEKLY REMINDER (dev console)`);
      console.log(`To: ${summary.email}`);
      console.log(`From: ${fromEmail}`);
      console.log(`Subject: Your HabitFlow weekly summary — ${summary.overallPct}% complete`);
      console.log("-".repeat(60));
      console.log(renderEmailText(summary));
      console.log("=".repeat(60) + "\n");

      return Response.json({
        ok: true,
        mode: "dev-console",
        preview: renderEmailText(summary),
        summary: {
          email: summary.email,
          overallPct: summary.overallPct,
          totalCompleted: summary.totalCompleted,
          totalScheduled: summary.totalScheduled,
        },
      });
    }

    // Production: send via Resend
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: summary.email,
          subject: `Your HabitFlow weekly summary — ${summary.overallPct}% complete (test)`,
          text: renderEmailText(summary),
        }),
      });
      if (!resendRes.ok) {
        const errText = await resendRes.text();
        return apiError(`Email send failed: ${resendRes.status} ${errText.slice(0, 100)}`, 502, "EMAIL_FAILED");
      }
      return Response.json({
        ok: true,
        mode: "production",
        summary: {
          email: summary.email,
          overallPct: summary.overallPct,
          totalCompleted: summary.totalCompleted,
          totalScheduled: summary.totalScheduled,
        },
      });
    } catch (e) {
      return apiError(`Email send failed: ${(e as Error).message}`, 502, "EMAIL_FAILED");
    }
  })();
}
