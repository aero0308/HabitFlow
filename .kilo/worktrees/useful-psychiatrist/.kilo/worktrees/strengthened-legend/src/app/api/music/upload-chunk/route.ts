import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Per-chunk body cap. Each request body must be at most 2 MB so the server
// never buffers a giant request in memory.
const MAX_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB

// Total reconstructed file cap. Matches the single-file upload route.
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20MB

// Same allowed MIME set as the single-file upload route.
const ALLOWED_MIME = new Set<string>([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/vorbis",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/flac",
  "audio/x-flac",
  "audio/webm",
  "audio/aiff",
  "audio/x-aiff",
  "audio/amr",
  "audio/3gpp",
  "audio/3gpp2",
  "audio/x-ms-wma",
  "audio/basic",
]);

const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/vorbis": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/webm": "webm",
  "audio/aiff": "aiff",
  "audio/x-aiff": "aiff",
  "audio/amr": "amr",
  "audio/3gpp": "3gp",
  "audio/3gpp2": "3g2",
  "audio/x-ms-wma": "wma",
  "audio/basic": "au",
};

const AUDIO_EXT = new Set([
  "mp3",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "opus",
  "wav",
  "flac",
  "weba",
  "webm",
  "aiff",
  "aif",
  "amr",
  "3gp",
  "3g2",
  "wma",
  "au",
]);

function sanitizeFileName(name: string): string {
  const base = (name || "").split(/[\\/]/).pop() || "";
  const noExt = base.replace(/\.[^.]*$/, "");
  const cleaned = noExt
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || "audio";
}

function titleFromFileName(fileName: string): string {
  const base = (fileName || "").split(/[\\/]/).pop() || "";
  const noExt = base.replace(/\.[^.]*$/, "");
  return (noExt || "Untitled track").slice(0, 120);
}

function pickExtension(fileName: string, mime: string): string {
  const fileExt = (fileName.split(".").pop() || "").toLowerCase();
  if (fileExt && AUDIO_EXT.has(fileExt)) return fileExt;
  if (mime && MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];
  if (mime && mime.startsWith("audio/")) {
    const sub = mime.split("/")[1] || "";
    const cleaned = sub.replace(/^x-/, "").split(";")[0];
    if (cleaned && AUDIO_EXT.has(cleaned)) return cleaned;
  }
  return "mp3";
}

/**
 * Validate that a string looks like a sane uploadId: alphanum + dash, capped.
 * Used to build a temp-file name and we don't want path traversal.
 */
function isSafeId(id: string): boolean {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

/**
 * POST /api/music/upload-chunk — chunked upload.
 *
 * Metadata comes in via query params (so the request body is just raw bytes):
 *   uploadId     — client-generated id for this upload session
 *   chunkIndex   — 0-based chunk number
 *   totalChunks  — total number of chunks expected
 *   fileName     — original file name
 *   mime         — declared MIME type
 *   totalSize    — declared total file size in bytes
 *
 * The request body is the raw chunk bytes. On each non-final chunk we append
 * to /tmp-uploads/{userId}-{uploadId} and respond with { ok, chunkIndex,
 * received, totalChunks }. On the final chunk we validate the total size,
 * move the file to /public/audio/{userId}/{finalName}, create a UserUpload
 * record, and return { upload, complete: true }.
 */
export async function POST(req: Request): Promise<NextResponse> {
  return withErrorHandler(async () => {
    const user = await requireUser();

    const url = new URL(req.url);
    const uploadId = url.searchParams.get("uploadId") || "";
    const chunkIndexStr = url.searchParams.get("chunkIndex");
    const totalChunksStr = url.searchParams.get("totalChunks");
    const fileName = url.searchParams.get("fileName") || "";
    const mime = (url.searchParams.get("mime") || "").toLowerCase();
    const totalSizeStr = url.searchParams.get("totalSize");

    if (!isSafeId(uploadId)) {
      return apiError("Invalid uploadId", 400, "BAD_UPLOAD_ID");
    }
    const chunkIndex = chunkIndexStr === null ? NaN : Number.parseInt(chunkIndexStr, 10);
    const totalChunks = totalChunksStr === null ? NaN : Number.parseInt(totalChunksStr, 10);
    if (!Number.isFinite(chunkIndex) || chunkIndex < 0 || chunkIndex > 100000) {
      return apiError("Invalid chunkIndex", 400, "BAD_CHUNK_INDEX");
    }
    if (!Number.isFinite(totalChunks) || totalChunks < 1 || totalChunks > 100000) {
      return apiError("Invalid totalChunks", 400, "BAD_TOTAL_CHUNKS");
    }
    if (chunkIndex >= totalChunks) {
      return apiError("chunkIndex must be < totalChunks", 400, "BAD_CHUNK_INDEX");
    }
    if (!fileName) {
      return apiError("Missing fileName", 400, "BAD_FILE_NAME");
    }
    if (!mime || !ALLOWED_MIME.has(mime)) {
      return apiError(
        `Unsupported file type "${mime || "unknown"}". Must be an audio file.`,
        415,
        "UNSUPPORTED_MEDIA_TYPE",
      );
    }
    if (totalSizeStr !== null) {
      const declaredTotal = Number.parseInt(totalSizeStr, 10);
      if (Number.isFinite(declaredTotal) && declaredTotal > MAX_TOTAL_BYTES) {
        return apiError(
          `Declared total size too large (${declaredTotal} bytes). Max is ${MAX_TOTAL_BYTES} bytes (20MB).`,
          413,
          "FILE_TOO_LARGE",
        );
      }
    }

    // Read the chunk body. We cap at MAX_CHUNK_BYTES to avoid OOM on bad input.
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length > MAX_CHUNK_BYTES) {
      return apiError(
        `Chunk too large (${buf.length} bytes). Max per-chunk is ${MAX_CHUNK_BYTES} bytes (2 MB).`,
        413,
        "CHUNK_TOO_LARGE",
      );
    }

    // Append the chunk to the user-scoped temp file. fs.mkdir ensures the
    // tmp-uploads dir exists. flag: 'a' creates the file if missing and
    // appends in one atomic syscall.
    const tmpRoot = path.join(process.cwd(), "tmp-uploads");
    await fs.mkdir(tmpRoot, { recursive: true });
    const tmpPath = path.join(tmpRoot, `${user.id}-${uploadId}`);
    // { flag: 'a' } creates the file if missing and appends.
    await fs.writeFile(tmpPath, buf, { flag: "a" });

    const isLastChunk = chunkIndex === totalChunks - 1;
    if (!isLastChunk) {
      return apiOk({
        ok: true,
        chunkIndex,
        received: buf.length,
        totalChunks,
      });
    }

    // --- final chunk: validate, move, persist record ----------------------

    // Stat the reconstructed temp file to confirm the total size.
    const stat = await fs.stat(tmpPath).catch(async () => null);
    if (!stat || !stat.isFile()) {
      // Shouldn't happen, but be defensive.
      return apiError(
        "Reconstructed file not found after final chunk",
        500,
        "TEMP_FILE_MISSING",
      );
    }
    if (stat.size > MAX_TOTAL_BYTES) {
      // Best-effort cleanup of the oversize temp file.
      await fs.unlink(tmpPath).catch(() => {});
      return apiError(
        `Reconstructed file too large (${stat.size} bytes). Max is ${MAX_TOTAL_BYTES} bytes (20MB).`,
        413,
        "FILE_TOO_LARGE",
      );
    }
    if (stat.size === 0) {
      await fs.unlink(tmpPath).catch(() => {});
      return apiError("Reconstructed file is empty", 400, "EMPTY_FILE");
    }

    // Move the temp file to its final location under /public/audio/{userId}.
    const ext = pickExtension(fileName, mime);
    const sanitized = sanitizeFileName(fileName);
    const timestamp = Date.now();
    const finalName = `${timestamp}-${sanitized}.${ext}`;
    const publicAudioRoot = path.join(process.cwd(), "public", "audio");
    const userDir = path.join(publicAudioRoot, user.id);
    await fs.mkdir(userDir, { recursive: true });
    const finalPath = path.join(userDir, finalName);

    // fs.rename is atomic on the same filesystem. If it fails (e.g. cross-device),
    // fall back to copy + unlink.
    try {
      await fs.rename(tmpPath, finalPath);
    } catch {
      await fs.copyFile(tmpPath, finalPath);
      await fs.unlink(tmpPath).catch(() => {});
    }

    const urlPath = `/audio/${user.id}/${finalName}`;
    const title = titleFromFileName(fileName);

    const upload = await db.userUpload.create({
      data: {
        userId: user.id,
        title,
        url: urlPath,
        duration: null,
      },
      select: { id: true, title: true, url: true, duration: true },
    });

    return apiOk(
      {
        upload,
        complete: true,
        chunkIndex,
        totalChunks,
        size: stat.size,
      },
      201,
    );
  })();
}
