import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { recalculateStreak } from "@/lib/streak";
import { z } from "zod";

export const habitCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#10b981"),
  icon: z.string().min(1).max(20).default("✅"),
  frequency: z.enum(["daily", "weekly", "custom"]).default("daily"),
  customDays: z.array(z.number().int().min(0).max(6)).optional().default([]),
  targetCount: z.number().int().min(1).max(100).default(1),
  startDate: z.string().optional(),
  category: z.string().max(40).optional().default(""),
  timeOfDay: z.enum(["ANY_TIME", "MORNING", "AFTERNOON", "EVENING"]).optional().default("ANY_TIME"),
});

const habitUpdateSchema = habitCreateSchema.partial();

export function serializeHabit(h: {
  id: string;
  userId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  frequency: string;
  customDays: string;
  targetCount: number;
  startDate: Date;
  position: number;
  isArchived: boolean;
  category: string;
  timeOfDay: string;
  createdAt: Date;
  updatedAt: Date;
  streak?: { currentStreak: number; longestStreak: number; totalCompletions: number; lastCompletedDate: string | null } | null;
}) {
  return {
    id: h.id,
    name: h.name,
    description: h.description,
    color: h.color,
    icon: h.icon,
    frequency: h.frequency,
    customDays: h.customDays ? h.customDays.split(",").filter(Boolean).map(Number) : [],
    targetCount: h.targetCount,
    startDate: h.startDate.toISOString().slice(0, 10),
    position: h.position,
    isArchived: h.isArchived,
    category: h.category || "",
    timeOfDay: h.timeOfDay || "ANY_TIME",
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
    streak: h.streak
      ? {
          currentStreak: h.streak.currentStreak,
          longestStreak: h.streak.longestStreak,
          totalCompletions: h.streak.totalCompletions,
          lastCompletedDate: h.streak.lastCompletedDate,
        }
      : null,
  };
}

export async function GET_habits(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const includeArchived = url.searchParams.get("include_archived") === "true";
    const category = url.searchParams.get("category");

    const habits = await db.habit.findMany({
      where: {
        userId: user.id,
        ...(includeArchived ? {} : { isArchived: false }),
        ...(category ? { category } : {}),
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { streak: true },
    });
    return apiOk({ habits: habits.map(serializeHabit) });
  })();
}

/** List all distinct categories used by the user's habits. */
export async function GET_categories() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const habits = await db.habit.findMany({
      where: { userId: user.id },
      select: { category: true },
    });
    const cats = Array.from(
      new Set(habits.map((h) => h.category).filter((c) => c && c.trim() !== "")),
    ).sort();
    return apiOk({ categories: cats });
  })();
}

export async function POST_habits(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = habitCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const d = parsed.data;

    if (d.frequency === "custom" && d.customDays.length === 0) {
      return apiError("custom frequency requires at least one custom day", 422, "VALIDATION");
    }

    const maxPos = await db.habit.aggregate({
      where: { userId: user.id },
      _max: { position: true },
    });

    const startDate = d.startDate
      ? new Date(d.startDate + "T00:00:00")
      : new Date();

    const habit = await db.habit.create({
      data: {
        userId: user.id,
        name: d.name,
        description: d.description || "",
        color: d.color,
        icon: d.icon,
        frequency: d.frequency,
        customDays: d.customDays.join(","),
        targetCount: d.targetCount,
        startDate,
        position: (maxPos._max.position ?? -1) + 1,
        isArchived: false,
        category: d.category || "",
        timeOfDay: d.timeOfDay || "ANY_TIME",
      },
      include: { streak: true },
    });

    // Initialize streak record
    await recalculateStreak(habit.id);
    const fresh = await db.habit.findUnique({ where: { id: habit.id }, include: { streak: true } });
    return apiOk({ habit: serializeHabit(fresh!) }, 201);
  })();
}

export async function GET_habit(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.habit.findUnique({ where: { id }, include: { streak: true } });
    if (!habit || habit.userId !== user.id) return apiError("Habit not found", 404, "NOT_FOUND");
    return apiOk({ habit: serializeHabit(habit) });
  })();
}

export async function PATCH_habit(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.habit.findUnique({ where: { id } });
    if (!habit || habit.userId !== user.id) return apiError("Habit not found", 404, "NOT_FOUND");

    const body = await req.json().catch(() => ({}));
    const parsed = habitUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.description !== undefined) data.description = d.description;
    if (d.color !== undefined) data.color = d.color;
    if (d.icon !== undefined) data.icon = d.icon;
    if (d.frequency !== undefined) data.frequency = d.frequency;
    if (d.customDays !== undefined) data.customDays = d.customDays.join(",");
    if (d.targetCount !== undefined) data.targetCount = d.targetCount;
    if (d.startDate !== undefined) data.startDate = new Date(d.startDate + "T00:00:00");
    if (d.category !== undefined) data.category = d.category;
    if (d.timeOfDay !== undefined) data.timeOfDay = d.timeOfDay;

    const updated = await db.habit.update({ where: { id }, data, include: { streak: true } });
    await recalculateStreak(id);
    const fresh = await db.habit.findUnique({ where: { id }, include: { streak: true } });
    return apiOk({ habit: serializeHabit(fresh!) });
  })();
}

export async function DELETE_habit(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.habit.findUnique({ where: { id } });
    if (!habit || habit.userId !== user.id) return apiError("Habit not found", 404, "NOT_FOUND");
    await db.habit.delete({ where: { id } });
    return apiOk({ ok: true });
  })();
}

export async function POST_archive(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const habit = await db.habit.findUnique({ where: { id } });
    if (!habit || habit.userId !== user.id) return apiError("Habit not found", 404, "NOT_FOUND");

    const body = await req.json().catch(() => ({}));
    const archived = (body as { archived?: boolean })?.archived ?? true;

    const updated = await db.habit.update({
      where: { id },
      data: { isArchived: archived },
      include: { streak: true },
    });
    return apiOk({ habit: serializeHabit(updated) });
  })();
}

const reorderSchema = z.object({
  ordered_ids: z.array(z.string()).min(0),
});

export async function POST_reorder(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const ids = parsed.data.ordered_ids;

    // Verify ownership and update positions in a transaction
    await db.$transaction(
      ids.map((id, idx) =>
        db.habit.updateMany({ where: { id, userId: user.id }, data: { position: idx } }),
      ),
    );
    return apiOk({ ok: true });
  })();
}
