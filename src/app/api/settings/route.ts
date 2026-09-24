import { GET_settings, PATCH_settings } from "@/lib/settings-handlers";

// Allow up to 60s for the PATCH handler (avatar upload writes a large
// base64 data URL to the DB — can be slow on serverless cold starts).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export const GET = GET_settings;
export const PATCH = PATCH_settings;
