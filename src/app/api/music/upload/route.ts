import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED = new Set([
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg",
    "audio/aac", "audio/m4a", "audio/x-m4a", "audio/flac", "audio/webm",
]);

/**
 * POST /api/music/upload — single-file upload.
 * Uses Vercel Blob in production, /public/audio/ in local dev.
 */
export const POST = withErrorHandler(async (req: Request) => {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("No file", 422, "VALIDATION");
    if (file.size === 0) return apiError("Empty file", 422, "VALIDATION");
    if (file.size > MAX_BYTES) return apiError(`File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)`, 422, "VALIDATION");
    const typeOk = ALLOWED.has(file.type) || /\.(mp3|wav|ogg|aac|m4a|flac|webm)$/i.test(file.name);
    if (!typeOk) return apiError("Only audio files", 422, "VALIDATION");

    const safeBase = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_").slice(0, 60) || "track";
    const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || "mp3").toLowerCase();
    const finalName = `${Date.now()}-${safeBase}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const isVercel = !!process.env.BLOB_READ_WRITE_TOKEN;
    let urlPath: string;

    if (isVercel) {
        const blob = await put(`audio/${user.id}/${finalName}`, buffer, {
            contentType: file.type || "audio/mpeg",
            access: "public",
        });
        urlPath = blob.url;
    } else {
        const userDir = path.join(process.cwd(), "public", "audio", user.id);
        await mkdir(userDir, { recursive: true });
        await writeFile(path.join(userDir, finalName), buffer);
        urlPath = `/audio/${user.id}/${finalName}`;
    }

    const title = file.name.replace(/\.[^.]+$/, "");
    const upload = await db.userUpload.create({
        data: { userId: user.id, title, url: urlPath, duration: null },
        select: { id: true, title: true, url: true, duration: true },
    });

    return apiOk({ upload });
});
