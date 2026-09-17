import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { z } from "zod";

const settingsSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().max(50).optional(),
  timezone: z.string().min(1).max(60).optional(),
  emailRemindersEnabled: z.boolean().optional(),
  browserRemindersEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM 24h").optional(),
  avatarUrl: z.string().max(500000).optional(),
  daypartMorningStart: z.string().optional(),
  daypartAfternoonStart: z.string().optional(),
  daypartEveningStart: z.string().optional(),
});

export async function GET_settings() {
  return withErrorHandler(async () => {
    const user = await requireUser();
    return apiOk({
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      emailRemindersEnabled: user.emailRemindersEnabled,
      browserRemindersEnabled: user.browserRemindersEnabled,
      reminderTime: user.reminderTime,
      daypartMorningStart: user.daypartMorningStart,
      daypartAfternoonStart: user.daypartAfternoonStart,
      daypartEveningStart: user.daypartEveningStart,
    });
  })();
}

export async function PATCH_settings(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const d = parsed.data;
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.firstName !== undefined ? { firstName: d.firstName } : {}),
        ...(d.lastName !== undefined ? { lastName: d.lastName } : {}),
        ...(d.timezone !== undefined ? { timezone: d.timezone } : {}),
        ...(d.emailRemindersEnabled !== undefined ? { emailRemindersEnabled: d.emailRemindersEnabled } : {}),
        ...(d.browserRemindersEnabled !== undefined ? { browserRemindersEnabled: d.browserRemindersEnabled } : {}),
        ...(d.reminderTime !== undefined ? { reminderTime: d.reminderTime } : {}),
        ...(d.avatarUrl !== undefined ? { avatarUrl: d.avatarUrl } : {}),
        ...(d.daypartMorningStart !== undefined ? { daypartMorningStart: d.daypartMorningStart } : {}),
        ...(d.daypartAfternoonStart !== undefined ? { daypartAfternoonStart: d.daypartAfternoonStart } : {}),
        ...(d.daypartEveningStart !== undefined ? { daypartEveningStart: d.daypartEveningStart } : {}),
      },
    });
    return apiOk({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      firstName: updated.firstName,
      lastName: updated.lastName,
      avatarUrl: updated.avatarUrl,
      timezone: updated.timezone,
      emailRemindersEnabled: updated.emailRemindersEnabled,
      browserRemindersEnabled: updated.browserRemindersEnabled,
      reminderTime: updated.reminderTime,
      daypartMorningStart: updated.daypartMorningStart,
      daypartAfternoonStart: updated.daypartAfternoonStart,
      daypartEveningStart: updated.daypartEveningStart,
    });
  })();
}
