import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "dev-super-secret-change-me-in-production-32chars+";
const JWT_ALG = process.env.JWT_ALGORITHM || "HS256";
const ACCESS_EXPIRES_MIN = Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 30);
const REFRESH_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS || 7);

const encoder = new TextEncoder();

function toSecretKey(): Uint8Array {
  return encoder.encode(JWT_SECRET);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
}

export async function createAccessToken(user: { id: string; email: string }): Promise<string> {
  return new SignJWT({ email: user.email, type: "access" })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_EXPIRES_MIN}m`)
    .sign(toSecretKey());
}

export async function createRefreshToken(user: { id: string; email: string }): Promise<string> {
  return new SignJWT({ email: user.email, type: "refresh" })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_EXPIRES_DAYS}d`)
    .sign(toSecretKey());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, toSecretKey());
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      type: payload.type as "access" | "refresh",
    };
  } catch {
    return null;
  }
}

export const REFRESH_EXPIRES_MS = REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
