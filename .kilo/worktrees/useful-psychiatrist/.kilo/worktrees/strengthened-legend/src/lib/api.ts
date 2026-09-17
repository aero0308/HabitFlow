import { NextResponse } from "next/server";

/**
 * Consistent JSON error shape: { detail: string, code?: string }
 */
export function apiError(detail: string, status = 400, code?: string) {
  return NextResponse.json({ detail, code }, { status });
}

export function apiOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Wrap an API handler with error normalization.
 * Catches the UNAUTHORIZED tagged error from requireUser() and returns 401.
 */
export function withErrorHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.message === "UNAUTHORIZED" || e.status === 401) {
        return apiError("Not authenticated", 401, "UNAUTHORIZED");
      }
      if (e.status) {
        return apiError(e.message || "Error", e.status);
      }
      console.error("[api error]", e);
      return apiError(e.message || "Internal server error", 500);
    }
  };
}
