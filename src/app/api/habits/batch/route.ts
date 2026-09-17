import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError } from "@/lib/api";
import { recalculateStreak } from "@/lib/streak";
import {
  habitCreateSchema,
  serializeHabit,
} from "@/lib/habit-handlers";
import { z } from "zod";

const batchSchema = z.object({
  habits: habitCreateSchema.array().min(1).max(20),
});

/**
 * POST /api/habits/batch
 * Create multiple habits in one transaction. Each habit gets a sequential
 * position (continuing from the user's current max position) and a fresh
 * streak record. Per-item validation matches the single-create endpoint:
 * custom-frequency habits must declare at least one custom day.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message || "Invalid input",
        422,
        "VALIDATION",
      );
    }

    // Per-item custom-days validation. We surface the index of the offending
    // item so the client can highlight which habit failed.
    for (let i = 0; i < parsed.data.habits.length; i++) {
      const h = parsed.data.habits[i];
      if (h.frequency === "custom" && h.customDays.length === 0) {
        return apiError(
          `Habit #${i + 1}: custom frequency requires at least one custom day`,
          422,
          "VALIDATION",
        );
      }
    }

    // Compute the starting position so the new habits append after the
    // user's existing habits.
    const maxPos = await db.habit.aggregate({
      where: { userId: user.id },
      _max: { position: true },
    });
    let nextPos = (maxPos._max.position ?? -1) + 1;

    // Insert all habits in one transaction. Each row carries its own
    // position, computed sequentially above.
    const created = await db.$transaction(
      parsed.data.habits.map((h) => {
        const startDate = h.startDate
          ? new Date(h.startDate + "T00:00:00")
          : new Date();
        const pos = nextPos++;
        return db.habit.create({
          data: {
            userId: user.id,
            name: h.name,
            description: h.description || "",
            color: h.color,
            icon: h.icon,
            frequency: h.frequency,
            customDays: h.customDays.join(","),
            targetCount: h.targetCount,
            startDate,
            position: pos,
            isArchived: false,
            category: h.category || "",
            timeOfDay: h.timeOfDay || "ANY_TIME",
          },
          include: { streak: true },
        });
      }),
    );

    // Recalculate streaks per habit (creates the Streak row + initial values).
    // Done outside the create transaction so a single streak failure doesn't
    // roll back the entire batch — the habits exist, streaks can be rebuilt.
    await Promise.all(created.map((h) => recalculateStreak(h.id).catch(() => null)));

    // Re-fetch with the streak relation populated (recalculateStreak wrote it
    // outside the original query above).
    const refreshed = await db.habit.findMany({
      where: { id: { in: created.map((h) => h.id) } },
      include: { streak: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    return apiOk({ habits: refreshed.map(serializeHabit) }, 201);
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.message === "UNAUTHORIZED" || e.status === 401) {
      return apiError("Not authenticated", 401, "UNAUTHORIZED");
    }
    if (e.status) {
      return apiError(e.message || "Error", e.status);
    }
    console.error("[batch habits error]", e);
    return apiError(e.message || "Internal server error", 500);
  }
}
