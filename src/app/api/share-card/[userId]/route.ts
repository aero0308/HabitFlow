import { apiOk, apiError, withErrorHandler } from "@/lib/api";
import { getShareCardData } from "@/lib/share-card";

/**
 * GET /api/share-card/[userId]
 *
 * Public endpoint (no auth). Returns the ShareCard data for a user — either
 * looked up by their id (cuid) OR by their public username.
 *
 * Returns 404 when:
 *   - user doesn't exist
 *   - user exists but has `isShareCardPublic=false`
 *
 * Response shape matches `ShareCardDataDto` from `src/lib/share-card.ts`.
 *
 * Note: the public share page at `/share/[username]` calls `getShareCardData`
 * directly (server component, no fetch round-trip). This route is here for
 * future client-side fetchers (e.g. embedding share cards on third-party
 * sites, or a "view a friend's card" flow).
 */
export const GET = withErrorHandler(async (req: Request, { params }: { params: Promise<{ userId: string }> }) => {
  const { userId } = await params;
  if (!userId) return apiError("Missing user id", 400, "BAD_REQUEST");

  const data = await getShareCardData(userId);
  if (!data) {
    return apiError("Share card not available", 404, "NOT_PUBLIC");
  }
  return apiOk(data);
});
