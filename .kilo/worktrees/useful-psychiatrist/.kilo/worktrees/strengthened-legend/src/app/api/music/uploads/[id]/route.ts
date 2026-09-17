import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * DELETE /api/music/uploads/[id] — delete an uploaded track.
 *
 * Uses findFirst with both id and userId so the ownership check happens in a
 * single query (no chance of leaking existence to other users). Deletes the
 * on-disk file best-effort (ignore failures) and then removes the DB row.
 * Returns { ok: true, id }.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const { id } = await params;

    // Ownership check happens here — findFirst with both id and userId means
    // a user can never learn that an id exists for someone else.
    const upload = await db.userUpload.findFirst({
      where: { id, userId: user.id },
      select: { id: true, userId: true, url: true },
    });
    if (!upload) {
      return apiError("Upload not found", 404, "NOT_FOUND");
    }

    // Delete the file on disk. Best-effort — if the file is missing or the
    // path is malformed we ignore the failure and still remove the DB record
    // so the user isn't stuck with a ghost entry.
    if (upload.url && upload.url.startsWith("/audio/")) {
      try {
        const publicAudioRoot = path.join(process.cwd(), "public", "audio");
        // upload.url looks like "/audio/{userId}/{file}". Strip the leading
        // "/audio/" and join under public/audio to get the absolute path.
        const rel = upload.url.slice("/audio/".length);
        const abs = path.join(publicAudioRoot, rel);
        // Defensive: ensure abs is inside publicAudioRoot.
        const normRoot = path.resolve(publicAudioRoot) + path.sep;
        const normAbs = path.resolve(abs);
        if (normAbs.startsWith(normRoot)) {
          await fs.unlink(normAbs).catch(() => {});
        }
      } catch {
        // Swallow. File deletion is best-effort.
      }
    }

    await db.userUpload.delete({ where: { id: upload.id } });

    return apiOk({ ok: true, id: upload.id });
  })();
}
