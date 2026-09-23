/**
 * Bad-habit API handlers (shared between route files).
 *
 * Pattern mirrors `habit-handlers.ts`:
 *  - Each handler uses `withErrorHandler` to normalize errors (UNAUTHORIZED -> 401, etc).
 *  - Returns `apiOk(...)` / `apiError(...)` consistently.
 *  - Clean streaks are COMPUTED (not stored). Milestones ARE stored.
 *
 * Tone: supportive, NEVER shaming. Slips are "learning opportunities".
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { z } from "zod";
import {
  computeCleanStreak,
  computeLongestStreak,
  computeMoneySaved,
  computeTimeSaved,
  computeNextMilestone,
  computeUnlockedMilestones,
  type BadHabitLike,
} from "@/lib/bad-habits/compute";
import {
  computeTriggerFrequency,
  computeDayOfWeekPattern,
  computeCleanDaysPct,
  computeMoodCorrelation,
} from "@/lib/bad-habits/insights";

const VALID_CURRENCIES = new Set(["USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD"]);

const badHabitCreateSchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().min(1).max(20),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  quitDate: z.string().min(1), // YYYY-MM-DD
  reason: z.string().max(500).optional(),
  triggers: z.array(z.string().max(40)).max(20).default([]),
  costPerDay: z.number().min(0).max(100000).optional(),
  currency: z.string().min(3).max(3).optional().default("USD"),
  minutesPerDay: z.number().int().min(0).max(1440).optional(),
  replacementHabitId: z.string().optional().nullable(),
});

const badHabitUpdateSchema = badHabitCreateSchema.partial();

export interface SerializedBadHabit {
  id: string;
  name: string;
  icon: string;
  color: string;
  quitDate: string; // YYYY-MM-DD
  reason: string;
  triggers: string[];
  costPerDay: number | null;
  currency: string;
  minutesPerDay: number | null;
  replacementHabitId: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  cleanStreak: number;
  longestStreak: number;
  moneySaved: { amount: number; formatted: string } | null;
  timeSaved: { hours: number; formatted: string } | null;
  nextMilestone: {
    type: "days" | "money" | "time";
    value: number;
    label: string;
    daysRemaining: number;
    progressPct: number;
  };
}

function toBadHabitLike(h: {
  quitDate: Date;
  costPerDay: number | null;
  currency: string;
  minutesPerDay: number | null;
}): BadHabitLike {
  return {
    id: "",
    name: "",
    icon: "",
    color: "",
    quitDate: h.quitDate,
    costPerDay: h.costPerDay,
    currency: h.currency,
    minutesPerDay: h.minutesPerDay,
  };
}

/**
 * Serialize a bad-habit row (with slips loaded) into the API shape, including
 * computed stats (cleanStreak, longestStreak, moneySaved, nextMilestone).
 */
export function serializeBadHabit(
  h: {
    id: string;
    name: string;
    icon: string;
    color: string;
    quitDate: Date;
    reason: string | null;
    triggers: string;
    costPerDay: number | null;
    currency: string;
    minutesPerDay: number | null;
    replacementHabitId: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    slips: Array<{ id: string; date: string; trigger: string | null; note: string | null }>;
  },
  today: Date = new Date(),
): SerializedBadHabit {
  const like = toBadHabitLike(h);
  const cleanStreak = computeCleanStreak(like, h.slips, today);
  const longestStreak = computeLongestStreak(like, h.slips, today);
  const moneySaved = computeMoneySaved(like, h.slips, today);
  const timeSaved = computeTimeSaved(like, h.slips, today);
  const nextMilestone = computeNextMilestone(like, h.slips, today);

  return {
    id: h.id,
    name: h.name,
    icon: h.icon,
    color: h.color,
    quitDate: h.quitDate.toISOString().slice(0, 10),
    reason: h.reason ?? "",
    triggers: h.triggers ? h.triggers.split(",").filter(Boolean) : [],
    costPerDay: h.costPerDay,
    currency: h.currency || "USD",
    minutesPerDay: h.minutesPerDay,
    replacementHabitId: h.replacementHabitId,
    isArchived: h.isArchived,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
    cleanStreak,
    longestStreak,
    moneySaved,
    timeSaved,
    nextMilestone,
  };
}

/**
 * Sync milestones for a bad habit: insert any milestone the user has earned
 * that isn't already in the table. (Milestones are an audit trail — once
 * unlocked, they stay unlocked even if the user slips later.)
 */
export async function syncMilestones(badHabitId: string, today: Date = new Date()): Promise<void> {
  const habit = await db.badHabit.findUnique({
    where: { id: badHabitId },
    include: { slips: { select: { id: true, date: true, trigger: true, note: true } } },
  });
  if (!habit) return;

  const like = toBadHabitLike(habit);
  const unlocked = computeUnlockedMilestones(like, habit.slips, today);
  if (unlocked.length === 0) return;

  // Get currently-unlocked milestones for this habit
  const existing = await db.badHabitMilestone.findMany({
    where: { badHabitId },
    select: { type: true, value: true },
  });
  const existingKey = new Set(existing.map((m) => `${m.type}:${m.value}`));

  const toCreate = unlocked
    .filter((m) => !existingKey.has(`${m.type}:${m.value}`))
    .map((m) => ({
      badHabitId,
      type: m.type,
      value: m.value,
      label: m.label,
    }));

  if (toCreate.length > 0) {
    await db.badHabitMilestone.createMany({ data: toCreate });
  }
}

// ============================================================
// GET /api/bad-habits  (list) + POST /api/bad-habits  (create)
// ============================================================

export async function GET_badHabits(req: NextRequest) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    const habits = await db.badHabit.findMany({
      where: {
        userId: user.id,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        slips: {
          select: { id: true, date: true, trigger: true, note: true },
          orderBy: { date: "asc" },
        },
      },
    });

    const today = new Date();
    return apiOk({ badHabits: habits.map((h) => serializeBadHabit(h, today)) });
  })();
}

export async function POST_badHabit(req: NextRequest) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = badHabitCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const d = parsed.data;

    if (d.currency && !VALID_CURRENCIES.has(d.currency.toUpperCase())) {
      return apiError(`Unsupported currency: ${d.currency}`, 422, "VALIDATION");
    }

    // Verify replacementHabitId belongs to the user (if provided)
    if (d.replacementHabitId) {
      const h = await db.habit.findUnique({ where: { id: d.replacementHabitId } });
      if (!h || h.userId !== user.id) {
        return apiError("Replacement habit not found", 422, "VALIDATION");
      }
    }

    const quitDate = new Date(d.quitDate + "T00:00:00");
    const today = new Date();

    const created = await db.badHabit.create({
      data: {
        userId: user.id,
        name: d.name.trim(),
        icon: d.icon,
        color: d.color,
        quitDate,
        reason: d.reason?.trim() || null,
        triggers: Array.isArray(d.triggers) ? d.triggers.join(",") : "",
        costPerDay: d.costPerDay ?? null,
        currency: (d.currency || "USD").toUpperCase(),
        minutesPerDay: d.minutesPerDay ?? null,
        replacementHabitId: d.replacementHabitId || null,
        isArchived: false,
      },
      include: {
        slips: { select: { id: true, date: true, trigger: true, note: true } },
      },
    });

    // Backdated quitDate may already qualify for milestones. Sync.
    await syncMilestones(created.id, today);

    const fresh = await db.badHabit.findUnique({
      where: { id: created.id },
      include: {
        slips: { select: { id: true, date: true, trigger: true, note: true }, orderBy: { date: "asc" } },
        milestones: { orderBy: { unlockedAt: "asc" } },
      },
    });

    return apiOk({ badHabit: serializeBadHabit(fresh!, today) }, 201);
  })();
}

// ============================================================
// GET/PATCH/DELETE /api/bad-habits/[id]
// ============================================================

export async function GET_badHabit(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.badHabit.findUnique({
      where: { id },
      include: {
        slips: { select: { id: true, date: true, trigger: true, note: true }, orderBy: { date: "desc" } },
        milestones: { orderBy: { unlockedAt: "asc" } },
      },
    });
    if (!habit || habit.userId !== user.id) {
      return apiError("Bad habit not found", 404, "NOT_FOUND");
    }

    const today = new Date();
    const serialized = serializeBadHabit(habit, today);
    const like = toBadHabitLike(habit);
    const triggerFrequency = computeTriggerFrequency(habit.slips);
    const dayOfWeekPattern = computeDayOfWeekPattern(habit.slips);
    const cleanDaysPct = computeCleanDaysPct(like, habit.slips, today);

    // Mood correlation: fetch mood entries since the quit date
    const moodEntries = await db.moodEntry.findMany({
      where: {
        userId: user.id,
        date: { gte: habit.quitDate.toISOString().slice(0, 10) },
      },
      select: { date: true, score: true },
      orderBy: { date: "asc" },
    });
    const moodCorrelation = computeMoodCorrelation(like, habit.slips, moodEntries);

    // Recent slips (last 5)
    const recentSlips = habit.slips.slice(0, 5).map((s) => ({
      id: s.id,
      date: s.date,
      trigger: s.trigger,
      note: s.note,
    }));

    return apiOk({
      badHabit: serialized,
      insights: {
        triggerFrequency,
        dayOfWeekPattern,
        cleanDaysPct,
        moodCorrelation,
      },
      slips: recentSlips,
      milestones: habit.milestones,
    });
  })();
}

export async function PATCH_badHabit(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.badHabit.findUnique({ where: { id } });
    if (!habit || habit.userId !== user.id) {
      return apiError("Bad habit not found", 404, "NOT_FOUND");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = badHabitUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const d = parsed.data;

    if (d.currency && !VALID_CURRENCIES.has(d.currency.toUpperCase())) {
      return apiError(`Unsupported currency: ${d.currency}`, 422, "VALIDATION");
    }

    if (d.replacementHabitId) {
      const h = await db.habit.findUnique({ where: { id: d.replacementHabitId } });
      if (!h || h.userId !== user.id) {
        return apiError("Replacement habit not found", 422, "VALIDATION");
      }
    }

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name.trim();
    if (d.icon !== undefined) data.icon = d.icon;
    if (d.color !== undefined) data.color = d.color;
    if (d.reason !== undefined) data.reason = d.reason?.trim() || null;
    if (d.triggers !== undefined) data.triggers = Array.isArray(d.triggers) ? d.triggers.join(",") : "";
    if (d.costPerDay !== undefined) data.costPerDay = d.costPerDay;
    if (d.currency !== undefined) data.currency = d.currency.toUpperCase();
    if (d.minutesPerDay !== undefined) data.minutesPerDay = d.minutesPerDay;
    if (d.replacementHabitId !== undefined) data.replacementHabitId = d.replacementHabitId || null;

    const quitChanged = d.quitDate !== undefined;
    if (quitChanged) {
      data.quitDate = new Date(d.quitDate + "T00:00:00");
    }

    await db.badHabit.update({ where: { id }, data });

    // If quitDate changed (or money/time inputs changed), recompute milestones.
    if (quitChanged || d.costPerDay !== undefined || d.minutesPerDay !== undefined) {
      await syncMilestones(id, new Date());
    }

    const fresh = await db.badHabit.findUnique({
      where: { id },
      include: {
        slips: { select: { id: true, date: true, trigger: true, note: true }, orderBy: { date: "asc" } },
        milestones: { orderBy: { unlockedAt: "asc" } },
      },
    });
    return apiOk({ badHabit: serializeBadHabit(fresh!, new Date()) });
  })();
}

export async function DELETE_badHabit(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.badHabit.findUnique({ where: { id } });
    if (!habit || habit.userId !== user.id) {
      return apiError("Bad habit not found", 404, "NOT_FOUND");
    }
    // Soft delete (archive)
    await db.badHabit.update({ where: { id }, data: { isArchived: true } });
    return apiOk({ ok: true });
  })();
}

// ============================================================
// POST /api/bad-habits/[id]/slip  (log a slip)
// ============================================================

const slipCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trigger: z.string().max(40).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export async function POST_slip(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.badHabit.findUnique({ where: { id } });
    if (!habit || habit.userId !== user.id) {
      return apiError("Bad habit not found", 404, "NOT_FOUND");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = slipCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const d = parsed.data;

    // Unique constraint will fail if a slip already exists for this date.
    const existing = await db.badHabitSlip.findUnique({
      where: { badHabitId_date: { badHabitId: id, date: d.date } },
    });
    if (existing) {
      return apiError("Already logged for this date", 400, "DUPLICATE_SLIP");
    }

    await db.badHabitSlip.create({
      data: {
        badHabitId: id,
        date: d.date,
        trigger: d.trigger?.trim() || null,
        note: d.note?.trim() || null,
      },
    });

    // Slipping never unlocks NEW milestones (it can only reset the current streak).
    // We do NOT sync milestones here.

    const fresh = await db.badHabit.findUnique({
      where: { id },
      include: {
        slips: { select: { id: true, date: true, trigger: true, note: true }, orderBy: { date: "asc" } },
      },
    });
    return apiOk({ badHabit: serializeBadHabit(fresh!, new Date()) });
  })();
}

// ============================================================
// DELETE /api/bad-habits/[id]/slip/[date]
// ============================================================

export async function DELETE_slip(_req: NextRequest, { params }: { params: Promise<{ id: string; date: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id, date } = await params;
    const habit = await db.badHabit.findUnique({ where: { id } });
    if (!habit || habit.userId !== user.id) {
      return apiError("Bad habit not found", 404, "NOT_FOUND");
    }

    const slip = await db.badHabitSlip.findUnique({
      where: { badHabitId_date: { badHabitId: id, date } },
    });
    if (!slip) {
      return apiError("Slip not found for this date", 404, "NOT_FOUND");
    }

    await db.badHabitSlip.delete({ where: { id: slip.id } });

    // Undoing a slip may unlock new milestones (since the clean streak is now longer).
    await syncMilestones(id, new Date());

    const fresh = await db.badHabit.findUnique({
      where: { id },
      include: {
        slips: { select: { id: true, date: true, trigger: true, note: true }, orderBy: { date: "asc" } },
        milestones: { orderBy: { unlockedAt: "asc" } },
      },
    });
    return apiOk({ badHabit: serializeBadHabit(fresh!, new Date()) });
  })();
}

// ============================================================
// GET /api/bad-habits/[id]/insights
// ============================================================

export async function GET_badHabitInsights(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.badHabit.findUnique({
      where: { id },
      include: {
        slips: { select: { id: true, date: true, trigger: true, note: true }, orderBy: { date: "asc" } },
      },
    });
    if (!habit || habit.userId !== user.id) {
      return apiError("Bad habit not found", 404, "NOT_FOUND");
    }

    const today = new Date();
    const like = toBadHabitLike(habit);
    const triggerFrequency = computeTriggerFrequency(habit.slips);
    const dayOfWeekPattern = computeDayOfWeekPattern(habit.slips);
    const cleanDaysPct = computeCleanDaysPct(like, habit.slips, today);
    const moodEntries = await db.moodEntry.findMany({
      where: {
        userId: user.id,
        date: { gte: habit.quitDate.toISOString().slice(0, 10) },
      },
      select: { date: true, score: true },
      orderBy: { date: "asc" },
    });
    const moodCorrelation = computeMoodCorrelation(like, habit.slips, moodEntries);

    return apiOk({
      insights: {
        triggerFrequency,
        dayOfWeekPattern,
        cleanDaysPct,
        moodCorrelation,
      },
    });
  })();
}
