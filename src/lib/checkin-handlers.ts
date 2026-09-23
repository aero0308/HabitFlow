import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { recalculateStreak, toDateString, parseDateString } from "@/lib/streak";
import { todayInTimezone, getBrowserTimezone } from "@/lib/timezone";
import { z } from "zod";

const checkinSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  count: z.number().int().min(0).max(1000).optional(),
  note: z.string().max(500).optional().default(""),
});

function serializeCheckin(c: {
  id: string;
  habitId: string;
  date: string;
  count: number;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    habitId: c.habitId,
    date: c.date,
    count: c.count,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

async function getOwnedHabit(userId: string, habitId: string) {
  const habit = await db.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.userId !== userId) return null;
  return habit;
}

export async function POST_checkin(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id: habitId } = await params;
    const habit = await getOwnedHabit(user.id, habitId);
    if (!habit) return apiError("Habit not found", 404, "NOT_FOUND");

    const body = await req.json().catch(() => ({}));
    const parsed = checkinSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const { date, count, note } = parsed.data;

    // Validate date is not before start_date
    const startStr = toDateString(new Date(habit.startDate));
    if (date < startStr) {
      return apiError("Date is before habit start date", 422, "INVALID_DATE");
    }
    // Disallow future dates — use the user's timezone for "today"
    const todayStr = todayInTimezone(user.timezone, getBrowserTimezone(req));
    if (date > todayStr) {
      return apiError("Cannot check in for a future date", 422, "FUTURE_DATE");
    }

    const effectiveCount = count ?? habit.targetCount;

    // Idempotent upsert
    const checkin = await db.checkin.upsert({
      where: { habitId_date: { habitId, date } },
      create: { habitId, date, count: effectiveCount, note },
      update: { count: effectiveCount, note },
    });

    await recalculateStreak(habitId);

    const streak = await db.streak.findUnique({ where: { habitId } });
    return apiOk({
      checkin: serializeCheckin(checkin),
      streak: streak
        ? {
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            totalCompletions: streak.totalCompletions,
            lastCompletedDate: streak.lastCompletedDate,
          }
        : null,
    });
  })();
}

export async function DELETE_checkin(
  _req: Request,
  { params }: { params: Promise<{ id: string; date: string }> },
) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id: habitId, date } = await params;
    const habit = await getOwnedHabit(user.id, habitId);
    if (!habit) return apiError("Habit not found", 404, "NOT_FOUND");

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError("date must be YYYY-MM-DD", 422, "VALIDATION");
    }

    const existing = await db.checkin.findUnique({
      where: { habitId_date: { habitId, date } },
    });
    if (!existing) return apiError("Check-in not found", 404, "NOT_FOUND");

    await db.checkin.delete({ where: { habitId_date: { habitId, date } } });
    await recalculateStreak(habitId);
    return apiOk({ ok: true });
  })();
}

export async function GET_checkins(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id: habitId } = await params;
    const habit = await getOwnedHabit(user.id, habitId);
    if (!habit) return apiError("Habit not found", 404, "NOT_FOUND");

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: { habitId: string; date?: { gte?: string; lte?: string } } = { habitId };
    if (from || to) {
      where.date = {};
      if (from) {
        parseDateString(from); // validate
        where.date.gte = from;
      }
      if (to) {
        parseDateString(to);
        where.date.lte = to;
      }
    }

    const checkins = await db.checkin.findMany({ where, orderBy: { date: "asc" } });
    return apiOk({ checkins: checkins.map(serializeCheckin) });
  })();
}
