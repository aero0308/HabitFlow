import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { toDateString } from "@/lib/streak";
import { todayInTimezone, getBrowserTimezone } from "@/lib/timezone";
import { z } from "zod";
import type { Habit } from "@prisma/client";

const moodSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  score: z.number().int().min(1).max(10),
  note: z.string().max(200).optional().default(""),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
});

function serializeMood(m: {
  id: string;
  userId: string;
  date: string;
  score: number;
  note: string;
  tags: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: m.id,
    date: m.date,
    score: m.score,
    note: m.note,
    tags: m.tags ? m.tags.split(",").filter(Boolean) : [],
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

/** POST /api/moods — upsert mood entry for a date */
export async function POST_mood(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = moodSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const { date, score, note, tags } = parsed.data;

    // Use the user's *effective* timezone (saved tz, falling back to the
    // browser tz from the `x-browser-timezone` header). Without this, a user
    // in Asia/Tokyo logging a mood at 23:30 JST would be told it's "tomorrow"
    // because toDateString(new Date()) uses the server's local tz (often UTC).
    const todayStr = todayInTimezone(user.timezone, getBrowserTimezone(req));
    if (date > todayStr) {
      return apiError("Cannot log mood for a future date", 422, "FUTURE_DATE");
    }

    const entry = await db.moodEntry.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: {
        userId: user.id,
        date,
        score,
        note: note || "",
        tags: tags.join(","),
      },
      update: {
        score,
        note: note || "",
        tags: tags.join(","),
      },
    });

    return apiOk({ mood: serializeMood(entry) }, 201);
  })();
}

/** GET /api/moods — list entries in range (default last 30 days) */
export async function GET_moods(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 29);
    const fromStr = from || toDateString(defaultFrom);
    const toStr = to || toDateString(today);

    const entries = await db.moodEntry.findMany({
      where: {
        userId: user.id,
        date: { gte: fromStr, lte: toStr },
      },
      orderBy: { date: "asc" },
    });

    return apiOk({ moods: entries.map(serializeMood) });
  })();
}

/** GET /api/moods/today — returns today's entry or null */
export async function GET_mood_today(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    // Same timezone fix as POST_mood — "today" is the user's today, not the
    // server's today. Otherwise users in negative-UTC offsets can see "no
    // entry yet" right after logging one in their local evening.
    const todayStr = todayInTimezone(user.timezone, getBrowserTimezone(req));
    const entry = await db.moodEntry.findUnique({
      where: { userId_date: { userId: user.id, date: todayStr } },
    });
    return apiOk({ mood: entry ? serializeMood(entry) : null });
  })();
}

/** DELETE /api/moods/[id] — delete an entry */
export async function DELETE_mood(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const entry = await db.moodEntry.findUnique({ where: { id } });
    if (!entry || entry.userId !== user.id) {
      return apiError("Mood entry not found", 404, "NOT_FOUND");
    }
    await db.moodEntry.delete({ where: { id } });
    return apiOk({ ok: true });
  })();
}

/** GET /api/moods/insights — correlation data */
export async function GET_mood_insights() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);
    const fromStr = toDateString(thirtyDaysAgo);
    const toStr = toDateString(today);

    // Fetch mood entries + habits + checkins in parallel
    const [moodEntries, habits, checkins] = await Promise.all([
      db.moodEntry.findMany({
        where: { userId: user.id, date: { gte: fromStr, lte: toStr } },
        orderBy: { date: "asc" },
      }),
      db.habit.findMany({
        where: { userId: user.id, isArchived: false },
      }),
      db.checkin.findMany({
        where: {
          habitId: { in: (await db.habit.findMany({ where: { userId: user.id }, select: { id: true } })).map((h) => h.id) },
          date: { gte: fromStr, lte: toStr },
        },
      }),
    ]);

    if (moodEntries.length === 0) {
      return apiOk({
        hasData: false,
        averageScore: 0,
        averageScoreByHabitsCompleted: { "0": 0, "1": 0, "2": 0, "3+": 0 },
        bestDay: null,
        worstDay: null,
        moodTrend: "stable",
        habitImpact: [],
        topTags: [],
      });
    }

    // Build checkin map: date -> count of completed habits
    const completedByDate = new Map<string, number>();
    for (const c of checkins) {
      const habit = habits.find((h) => h.id === c.habitId);
      if (!habit) continue;
      if (c.count >= habit.targetCount) {
        completedByDate.set(c.date, (completedByDate.get(c.date) ?? 0) + 1);
      }
    }

    // Average score
    const totalScore = moodEntries.reduce((s, m) => s + m.score, 0);
    const averageScore = Math.round((totalScore / moodEntries.length) * 10) / 10;

    // Average score by habits completed buckets
    const buckets: Record<string, number[]> = { "0": [], "1": [], "2": [], "3+": [] };
    for (const m of moodEntries) {
      const completed = completedByDate.get(m.date) ?? 0;
      const bucket = completed >= 3 ? "3+" : String(completed);
      buckets[bucket].push(m.score);
    }
    const averageScoreByHabitsCompleted: Record<string, number> = {};
    for (const key of ["0", "1", "2", "3+"]) {
      const arr = buckets[key];
      averageScoreByHabitsCompleted[key] = arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0;
    }

    // Best / worst day
    let bestDay = moodEntries[0];
    let worstDay = moodEntries[0];
    for (const m of moodEntries) {
      if (m.score > bestDay.score) bestDay = m;
      if (m.score < worstDay.score) worstDay = m;
    }

    // Mood trend: compare last 7 days avg vs previous 7 days avg
    const last7 = moodEntries.slice(-7);
    const prev7 = moodEntries.slice(-14, -7);
    const last7Avg = last7.length > 0 ? last7.reduce((s, m) => s + m.score, 0) / last7.length : 0;
    const prev7Avg = prev7.length > 0 ? prev7.reduce((s, m) => s + m.score, 0) / prev7.length : 0;
    const trendDelta = last7Avg - prev7Avg;
    const moodTrend = trendDelta > 0.5 ? "improving" : trendDelta < -0.5 ? "declining" : "stable";

    // Habit impact: for each habit, avg mood when done vs skipped
    const habitImpact = habits.map((h: Habit) => {
      let doneMoods: number[] = [];
      let skippedMoods: number[] = [];
      for (const m of moodEntries) {
        const ci = checkins.find((c) => c.habitId === h.id && c.date === m.date);
        if (ci && ci.count >= h.targetCount) {
          doneMoods.push(m.score);
        } else {
          // Check if the habit was scheduled that day
          skippedMoods.push(m.score);
        }
      }
      const avgDone = doneMoods.length > 0 ? Math.round((doneMoods.reduce((s, v) => s + v, 0) / doneMoods.length) * 10) / 10 : 0;
      const avgSkipped = skippedMoods.length > 0 ? Math.round((skippedMoods.reduce((s, v) => s + v, 0) / skippedMoods.length) * 10) / 10 : 0;
      return {
        habitId: h.id,
        habitName: h.name,
        habitIcon: h.icon,
        avgMoodWhenDone: avgDone,
        avgMoodWhenSkipped: avgSkipped,
        delta: Math.round((avgDone - avgSkipped) * 10) / 10,
      };
    }).filter((h) => h.avgMoodWhenDone > 0 || h.avgMoodWhenSkipped > 0);

    // Top tags
    const tagMap = new Map<string, { count: number; totalScore: number }>();
    for (const m of moodEntries) {
      if (!m.tags) continue;
      const tags = m.tags.split(",").filter(Boolean);
      for (const t of tags) {
        const entry = tagMap.get(t) ?? { count: 0, totalScore: 0 };
        entry.count += 1;
        entry.totalScore += m.score;
        tagMap.set(t, entry);
      }
    }
    const topTags = Array.from(tagMap.entries())
      .map(([tag, v]) => ({
        tag,
        count: v.count,
        avgScore: Math.round((v.totalScore / v.count) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return apiOk({
      hasData: true,
      averageScore,
      averageScoreByHabitsCompleted,
      bestDay: { date: bestDay.date, score: bestDay.score },
      worstDay: { date: worstDay.date, score: worstDay.score },
      moodTrend,
      habitImpact,
      topTags,
      totalEntries: moodEntries.length,
    });
  })();
}
