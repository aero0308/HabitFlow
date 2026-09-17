import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { withErrorHandler, apiError } from "@/lib/api";

/** DELETE /api/user/account — permanently delete user + cascade all data */
export async function DELETE_account() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    await db.user.delete({ where: { id: user.id } });
    return Response.json({ ok: true });
  })();
}

/** DELETE /api/user/data — delete all habits/checkins/streaks/moods, keep account */
export async function DELETE_data() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    await db.habit.deleteMany({ where: { userId: user.id } });
    await db.moodEntry.deleteMany({ where: { userId: user.id } });
    await db.offMode.deleteMany({ where: { userId: user.id } });
    await db.session.deleteMany({ where: { userId: user.id, refreshToken: { not: "" } } });
    return Response.json({ ok: true });
  })();
}

/** POST /api/user/reset-habit-data — delete all checkins + reset streaks, keep habits */
export async function POST_reset_habit_data() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const habits = await db.habit.findMany({ where: { userId: user.id }, select: { id: true } });
    const habitIds = habits.map((h) => h.id);

    if (habitIds.length > 0) {
      await db.checkin.deleteMany({ where: { habitId: { in: habitIds } } });
      await db.habitFreeze.deleteMany({ where: { habitId: { in: habitIds } } });
      await db.streak.deleteMany({ where: { habitId: { in: habitIds } } });
      // Recreate empty streak records
      for (const id of habitIds) {
        await db.streak.create({
          data: { habitId: id, currentStreak: 0, longestStreak: 0, totalCompletions: 0, lastCompletedDate: null },
        }).catch(() => {});
      }
    }
    return Response.json({ ok: true });
  })();
}

/** GET/PATCH /api/user/dayparts — get/set daypart start times */
export async function GET_dayparts() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    return Response.json({
      morningStart: user.daypartMorningStart,
      afternoonStart: user.daypartAfternoonStart,
      eveningStart: user.daypartEveningStart,
    });
  })();
}

export async function PATCH_dayparts(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { morningStart, afternoonStart, eveningStart } = body as Record<string, string>;
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    const data: Record<string, string> = {};
    if (morningStart && timeRe.test(morningStart)) data.daypartMorningStart = morningStart;
    if (afternoonStart && timeRe.test(afternoonStart)) data.daypartAfternoonStart = afternoonStart;
    if (eveningStart && timeRe.test(eveningStart)) data.daypartEveningStart = eveningStart;
    if (Object.keys(data).length === 0) return apiError("No valid times provided", 422, "VALIDATION");
    const updated = await db.user.update({ where: { id: user.id }, data });
    return Response.json({
      morningStart: updated.daypartMorningStart,
      afternoonStart: updated.daypartAfternoonStart,
      eveningStart: updated.daypartEveningStart,
    });
  })();
}
