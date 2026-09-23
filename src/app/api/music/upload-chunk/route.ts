import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { writeFile, mkdir, unlink, stat, readFile } from "fs/promises";
import path from "path";
import { put, del } from "@vercel/blob";

const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_CHUNK_BYTES = 2 * 1024 * 1024; // 2MB per chunk
const ALLOWED = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg",
  "audio/aac", "audio/m4a", "audio/x-m4a", "audio/flac", "audio/webm",
]);

/**
 * Chunked upload — works on Vercel (read-only filesystem) by:
 * 1. Accumulating chunks in /tmp/ (Vercel's writable temp directory)
 * 2. On the final chunk, uploading the assembled file to Vercel Blob
 * 3. Storing the Blob URL in the UserUpload DB record
 *
 * Falls back to /public/audio/ for local dev (when BLOB_READ_WRITE_TOKEN
 * is not set).
 */
export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireUser();
  const u = new URL(req.url);
  const uploadId = u.searchParams.get("uploadId") || "";
  const chunkIndex = parseInt(u.searchParams.get("chunkIndex") || "0", 10);
  const totalChunks = parseInt(u.searchParams.get("totalChunks") || "1", 10);
  const fileName = u.searchParams.get("fileName") || "track.mp3";
  const mime = u.searchParams.get("mime") || "audio/mpeg";
  const totalSize = parseInt(u.searchParams.get("totalSize") || "0", 10);

  if (!uploadId || !/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
    return apiError("Invalid uploadId", 422, "VALIDATION");
  }
  if (totalSize > MAX_TOTAL_BYTES) {
    return apiError(`File too large (max ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)}MB)`, 422, "VALIDATION");
  }
  const typeOk = ALLOWED.has(mime) || /\.(mp3|wav|ogg|aac|m4a|flac|webm)$/i.test(fileName);
  if (!typeOk) {
    return apiError("Only audio files are allowed", 422, "VALIDATION");
  }

  // Read chunk (≤2MB)
  const chunkBuf = Buffer.from(await req.arrayBuffer());
  if (chunkBuf.length > MAX_CHUNK_BYTES) {
    return apiError(`Chunk too large`, 422, "VALIDATION");
  }

  // Use /tmp/ (writable on Vercel serverless) or local tmp-uploads for dev
  const isVercel = !!process.env.BLOB_READ_WRITE_TOKEN;
  const tmpDir = isVercel
    ? path.join("/tmp", "habitflow-uploads")
    : path.join(process.cwd(), "tmp-uploads");
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${user.id}-${uploadId}`);
  await writeFile(tmpPath, chunkBuf, { flag: "a" });

  // Not the last chunk → ack
  if (chunkIndex < totalChunks - 1) {
    return apiOk({ ok: true, chunkIndex, received: chunkIndex + 1, totalChunks });
  }

  // Last chunk → finalize
  const finalStat = await stat(tmpPath);
  if (finalStat.size > MAX_TOTAL_BYTES) {
    try { await unlink(tmpPath); } catch {}
    return apiError(`File too large (max ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)}MB)`, 422, "VALIDATION");
  }

  const safeBase = fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_").slice(0, 60) || "track";
  const ext = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] || "mp3").toLowerCase();
  const finalName = `${Date.now()}-${safeBase}.${ext}`;

  let urlPath: string;

  if (isVercel) {
    // Upload to Vercel Blob
    const fileBuffer = await readFile(tmpPath);
    const blob = await put(`audio/${user.id}/${finalName}`, fileBuffer, {
      contentType: mime || "audio/mpeg",
      access: "public",
    });
    urlPath = blob.url;
    // Clean up temp file
    try { await unlink(tmpPath); } catch {}
  } else {
    // Local dev: save to /public/audio/{userId}/
    const userDir = path.join(process.cwd(), "public", "audio", user.id);
    await mkdir(userDir, { recursive: true });
    const finalPath = path.join(userDir, finalName);
    try {
      await import("fs/promises").then(fs => fs.rename(tmpPath, finalPath));
    } catch {
      const fileBuffer = await readFile(tmpPath);
      await writeFile(finalPath, fileBuffer);
      try { await unlink(tmpPath); } catch {}
    }
    urlPath = `/audio/${user.id}/${finalName}`;
  }

  const title = fileName.replace(/\.[^.]+$/, "");
  const upload = await db.userUpload.create({
    data: { userId: user.id, title, url: urlPath, duration: null },
    select: { id: true, title: true, url: true, duration: true },
  });

  return apiOk({ upload, complete: true });
});
