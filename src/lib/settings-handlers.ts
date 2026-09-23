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
  // ---- Share Card feature ----
  tagline: z.string().max(120).optional(),
  isShareCardPublic: z.boolean().optional(),
  username: z.string().max(40).optional(),
});

/**
 * Generate a unique, URL-safe username from the user's first name + a short
 * random suffix. Falls back to "user" if no first name is set. Retries with
 * a different suffix if the chosen name is already taken.
 */
async function generateUniqueUsername(base: string): Promise<string> {
  const slug = (base || "user")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20) || "user";
  for (let attempt = 0; attempt < 6; attempt++) {
    // 4-hex suffix keeps things short and human-friendly
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${slug}-${suffix}`;
    const clash = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  // Extremely unlikely fallback: full cuid-style suffix
  return `${slug}-${Math.random().toString(36).slice(2, 10)}`;
}

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
      tagline: user.tagline,
      isShareCardPublic: user.isShareCardPublic,
      shareCardLastUpdated: user.shareCardLastUpdated
        ? user.shareCardLastUpdated.toISOString()
        : null,
      username: user.username,
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

    // If the user is enabling public sharing and has no username yet,
    // auto-generate one so the public share URL `/share/{username}` works.
    let generatedUsername: string | null = null;
    if (d.isShareCardPublic === true && !user.username) {
      generatedUsername = await generateUniqueUsername(user.firstName || user.name);
    }
    // If the user is renaming their username, validate it's not taken.
    if (d.username && d.username !== user.username) {
      const clash = await db.user.findUnique({
        where: { username: d.username },
        select: { id: true },
      });
      if (clash && clash.id !== user.id) {
        return apiError("That username is already taken", 422, "USERNAME_TAKEN");
      }
    }

    const isEnablingPublic = d.isShareCardPublic === true && !user.isShareCardPublic;

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
        ...(d.tagline !== undefined ? { tagline: d.tagline } : {}),
        ...(d.isShareCardPublic !== undefined ? { isShareCardPublic: d.isShareCardPublic } : {}),
        ...(d.username !== undefined ? { username: d.username } : {}),
        ...(generatedUsername ? { username: generatedUsername } : {}),
        // Bump "shareCardLastUpdated" whenever the user enables public sharing
        // OR updates any share-card-related field (tagline, username, avatar,
        // name, firstName, lastName).
        ...(isEnablingPublic ||
        d.tagline !== undefined ||
        d.username !== undefined ||
        d.avatarUrl !== undefined ||
        d.name !== undefined ||
        d.firstName !== undefined ||
        d.lastName !== undefined
          ? { shareCardLastUpdated: new Date() }
          : {}),
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
      tagline: updated.tagline,
      isShareCardPublic: updated.isShareCardPublic,
      shareCardLastUpdated: updated.shareCardLastUpdated
        ? updated.shareCardLastUpdated.toISOString()
        : null,
      username: updated.username,
    });
  })();
}
