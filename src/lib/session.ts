import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyToken, createAccessToken, createRefreshToken, REFRESH_EXPIRES_MS } from "@/lib/auth";

const ACCESS_COOKIE = "ht_access";
const REFRESH_COOKIE = "ht_refresh";

export async function setAuthCookies(accessToken: string, refreshToken: string, remember = false) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: true,                  // ← was: process.env.NODE_ENV === "production"
    sameSite: "none",              // ← was: "lax"
    path: "/",
    maxAge: 30 * 60, // 30 min
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: true,                  // ← was: process.env.NODE_ENV === "production"
    sameSite: "none",              // ← was: "lax"
    path: "/",
    maxAge: remember ? REFRESH_EXPIRES_MS / 1000 : undefined,
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}

export interface AuthUser {
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
}

/**
 * Get the current authenticated user from the access token cookie.
 * If the access token is expired/invalid but a valid refresh token exists,
 * this will rotate tokens and return the user (silent refresh on the server side).
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const access = await getAccessToken();
  let payload = access ? await verifyToken(access) : null;

  // Try silent refresh if access token invalid
  if (!payload || payload.type !== "access") {
    const refresh = await getRefreshToken();
    if (!refresh) return null;
    const refreshPayload = await verifyToken(refresh);
    if (!refreshPayload || refreshPayload.type !== "refresh") return null;

    // Validate the refresh token exists in DB (not revoked)
    const session = await db.session.findUnique({
      where: { refreshToken: refresh },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return null;

    const user = session.user;
    const newAccess = await createAccessToken({ id: user.id, email: user.email });
    const newRefresh = await createRefreshToken({ id: user.id, email: user.email });

    await db.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefresh,
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
      },
    });

    await setAuthCookies(newAccess, newRefresh, true);
    payload = { sub: user.id, email: user.email, type: "access" };
  }

  if (!payload) return null;

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;
  return {
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
    shareCardLastUpdated: user.shareCardLastUpdated,
    username: user.username,
  };
}

/**
 * Require authentication. Throws a tagged error that API routes can catch.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("UNAUTHORIZED");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  return user;
}
