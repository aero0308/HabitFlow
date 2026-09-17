import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { recalculateStreak, toDateString, isHabitScheduled } from "@/lib/streak";
import { todayInTimezone, getBrowserTimezone } from "@/lib/timezone";
import { z } from "zod";

const freezeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

async function getOwnedHabit(userId: string, habitId: string) {
  const habit = await db.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.userId !== userId) return null;
  return habit;
}

/** Create a freeze for a given date (so a missed scheduled day doesn't break the streak). */
export async function POST_freeze(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id: habitId } = await params;
    const habit = await getOwnedHabit(user.id, habitId);
    if (!habit) return apiError("Habit not found", 404, "NOT_FOUND");

    const body = await req.json().catch(() => ({}));
    const parsed = freezeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const { date } = parsed.data;

    // Date must be in the past or today, and after the habit start date
    const startStr = toDateString(new Date(habit.startDate));
    if (date < startStr) return apiError("Date is before habit start date", 422, "INVALID_DATE");
    const todayStr = todayInTimezone(user.timezone, getBrowserTimezone(req));
    if (date > todayStr) return apiError("Cannot freeze a future date", 422, "FUTURE_DATE");

    // Should be a scheduled day
    const dateObj = new Date(date + "T00:00:00");
    if (!isHabitScheduled(habit, dateObj)) {
      return apiError("That date isn't a scheduled day for this habit", 422, "NOT_SCHEDULED");
    }

    // Idempotent: if freeze already exists, just return it
    const existing = await db.habitFreeze.findUnique({
      where: { habitId_date: { habitId, date } },
    });
    if (existing) {
      await recalculateStreak(habitId);
      return apiOk({ freeze: { id: existing.id, habitId, date, createdAt: existing.createdAt.toISOString() }, alreadyFrozen: true });
    }

    const freeze = await db.habitFreeze.create({ data: { habitId, date } });
    await recalculateStreak(habitId);
    return apiOk({ freeze: { id: freeze.id, habitId, date, createdAt: freeze.createdAt.toISOString() }, alreadyFrozen: false });
  })();
}

/** Remove a freeze for a given date. */
export async function DELETE_freeze(
  _req: Request,
  { params }: { params: Promise<{ id: string; date: string }> },
) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id: habitId, date } = await params;
    const habit = await getOwnedHabit(user.id, habitId);
    if (!habit) return apiError("Habit not found", 404, "NOT_FOUND");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError("date must be YYYY-MM-DD", 422, "VALIDATION");
    }

    const existing = await db.habitFreeze.findUnique({
      where: { habitId_date: { habitId, date } },
    });
    if (!existing) return apiError("Freeze not found", 404, "NOT_FOUND");

    await db.habitFreeze.delete({ where: { habitId_date: { habitId, date } } });
    await recalculateStreak(habitId);
    return apiOk({ ok: true });
  })();
}

/** List all freezes for a habit. */
export async function GET_freezes(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id: habitId } = await params;
    const habit = await getOwnedHabit(user.id, habitId);
    if (!habit) return apiError("Habit not found", 404, "NOT_FOUND");

    const freezes = await db.habitFreeze.findMany({
      where: { habitId },
      orderBy: { date: "desc" },
    });
    return apiOk({
      freezes: freezes.map((f) => ({
        id: f.id,
        habitId: f.habitId,
        date: f.date,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  })();
}
