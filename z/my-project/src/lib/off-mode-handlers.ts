import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { withErrorHandler, apiError } from "@/lib/api";
import { z } from "zod";

const offModeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional().default(""),
});

function serialize(m: { id: string; userId: string; startDate: string; endDate: string; reason: string; createdAt: Date }) {
  return {
    id: m.id,
    startDate: m.startDate,
    endDate: m.endDate,
    reason: m.reason,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function GET_off_modes() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const modes = await db.offMode.findMany({
      where: { userId: user.id },
      orderBy: { startDate: "desc" },
    });
    return Response.json({ offModes: modes.map(serialize) });
  })();
}

export async function POST_off_mode(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = offModeSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid", 422, "VALIDATION");
    const { startDate, endDate, reason } = parsed.data;
    if (endDate < startDate) return apiError("End date must be after start date", 422, "INVALID_DATE");
    const mode = await db.offMode.create({
      data: { userId: user.id, startDate, endDate, reason },
    });
    return Response.json({ offMode: serialize(mode) }, { status: 201 });
  })();
}

export async function DELETE_off_mode(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const mode = await db.offMode.findUnique({ where: { id } });
    if (!mode || mode.userId !== user.id) return apiError("Off mode not found", 404, "NOT_FOUND");
    await db.offMode.delete({ where: { id } });
    return Response.json({ ok: true });
  })();
}

/** Check if a date is inside any off-mode range for a user */
export async function isDateInOffMode(userId: string, dateStr: string): Promise<boolean> {
  const modes = await db.offMode.findMany({
    where: { userId, startDate: { lte: dateStr }, endDate: { gte: dateStr } },
  });
  return modes.length > 0;
}
