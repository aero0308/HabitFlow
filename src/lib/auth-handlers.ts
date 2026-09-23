import { db } from "@/lib/db";
import { hashPassword, verifyPassword, createAccessToken, createRefreshToken } from "@/lib/auth";
import { setAuthCookies, clearAuthCookies, getCurrentUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(80),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional().default(false),
});

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  timezone: string;
  emailRemindersEnabled: boolean;
  browserRemindersEnabled: boolean;
  reminderTime: string;
  daypartMorningStart: string;
  daypartAfternoonStart: string;
  daypartEveningStart: string;
  tagline: string;
  isShareCardPublic: boolean;
  shareCardLastUpdated: Date | null;
  username: string;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    firstName: u.firstName,
    lastName: u.lastName,
    avatarUrl: u.avatarUrl,
    timezone: u.timezone,
    emailRemindersEnabled: u.emailRemindersEnabled,
    browserRemindersEnabled: u.browserRemindersEnabled,
    reminderTime: u.reminderTime,
    daypartMorningStart: u.daypartMorningStart,
    daypartAfternoonStart: u.daypartAfternoonStart,
    daypartEveningStart: u.daypartEveningStart,
    tagline: u.tagline,
    isShareCardPublic: u.isShareCardPublic,
    shareCardLastUpdated: u.shareCardLastUpdated ? u.shareCardLastUpdated.toISOString() : null,
    username: u.username,
  };
}

export async function POST_register(req: Request) {
  return withErrorHandler(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const { email, password, name } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return apiError("Email already registered", 409, "EMAIL_TAKEN");

    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: { email, hashedPassword, name },
    });

    const access = await createAccessToken({ id: user.id, email: user.email });
    const refresh = await createRefreshToken({ id: user.id, email: user.email });
    await db.session.create({
      data: {
        userId: user.id,
        refreshToken: refresh,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await setAuthCookies(access, refresh, true);

    return apiOk({ user: publicUser(user), access, refresh }, 201);
  })();
}

export async function POST_login(req: Request) {
  return withErrorHandler(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", 422, "VALIDATION");
    }
    const { email, password, remember } = parsed.data;

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return apiError("Invalid email or password", 401, "INVALID_CREDENTIALS");

    const ok = await verifyPassword(password, user.hashedPassword);
    if (!ok) return apiError("Invalid email or password", 401, "INVALID_CREDENTIALS");

    const access = await createAccessToken({ id: user.id, email: user.email });
    const refresh = await createRefreshToken({ id: user.id, email: user.email });
    await db.session.create({
      data: {
        userId: user.id,
        refreshToken: refresh,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await setAuthCookies(access, refresh, remember);

    return apiOk({ user: publicUser(user), access, refresh });
  })();
}

export async function POST_refresh(req: Request) {
  return withErrorHandler(async () => {
    const body = await req.json().catch(() => ({}));
    const refreshToken = (body as { refresh?: string })?.refresh;
    if (!refreshToken) {
      return apiError("Refresh token required", 400, "NO_REFRESH");
    }
    const session = await db.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      return apiError("Invalid or expired refresh token", 401, "INVALID_REFRESH");
    }
    const user = session.user;
    const access = await createAccessToken({ id: user.id, email: user.email });
    return apiOk({ access });
  })();
}

export async function GET_me() {
  return withErrorHandler(async () => {
    const user = await getCurrentUser();
    if (!user) return apiError("Not authenticated", 401, "UNAUTHORIZED");
    return apiOk({ user: publicUser(user) });
  })();
}

export async function POST_logout() {
  return withErrorHandler(async () => {
    await clearAuthCookies();
    return apiOk({ ok: true });
  })();
}
