import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * POST /api/unsubscribe
 *
 * Body: { token: string }
 *
 * Marks the user identified by `emailUnsubscribeToken` as opted-out of weekly
 * email reminders by setting `emailRemindersEnabled = false`. Also clears
 * the token so it can't be reused to re-unsubscribe (and the user can later
 * re-subscribe via Settings which generates a new token).
 *
 * - No auth required (the token IS the credential).
 * - Returns 422 if the token doesn't match any user.
 */
const bodySchema = z.object({
  token: z.string().min(1, "token is required"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message || "Invalid input", code: "VALIDATION" },
      { status: 422 },
    );
  }

  const user = await db.user.findUnique({
    where: { emailUnsubscribeToken: parsed.data.token },
    select: { id: true, email: true },
  });

  if (!user) {
    return NextResponse.json(
      { detail: "Unsubscribe token not found or already used.", code: "TOKEN_NOT_FOUND" },
      { status: 422 },
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      emailRemindersEnabled: false,
      emailUnsubscribeToken: null,
    },
  });

  return NextResponse.json({ ok: true });
}
