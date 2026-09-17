import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { db } from "@/lib/db";
import { del } from "@vercel/blob";
import { unlink } from "fs/promises";
import path from "path";

/**
 * DELETE /api/music/uploads/[id] — delete an uploaded track.
 * Deletes from Vercel Blob (if URL is a blob URL) or local disk.
 */
export const DELETE = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;

  const upload = await db.userUpload.findFirst({
    where: { id, userId: user.id },
    select: { id: true, url: true },
  });
  if (!upload) return apiError("Upload not found", 404, "NOT_FOUND");

  // Delete from Vercel Blob (URL starts with http) or local disk (/audio/...)
  if (upload.url?.startsWith("http")) {
    try { await del(upload.url); } catch {}
  } else if (upload.url?.startsWith("/audio/")) {
    try {
      const abs = path.join(process.cwd(), "public", upload.url);
      await unlink(abs).catch(() => {});
    } catch {}
  }

  await db.userUpload.delete({ where: { id: upload.id } });
  return apiOk({ ok: true, id: upload.id });
});
