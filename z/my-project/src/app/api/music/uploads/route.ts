import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { apiOk, withErrorHandler } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/music/uploads — list the current user's uploaded audio tracks.
 *
 * Returns the minimal payload needed by the music player:
 *   { uploads: [{ id, title, url, duration }] }
 * ordered by createdAt ascending so playlist order is stable.
 */
export async function GET(): Promise<NextResponse> {
  return withErrorHandler(async () => {
    const user = await requireUser();

    const uploads = await db.userUpload.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, url: true, duration: true },
    });

    return apiOk({ uploads });
  })();
}
