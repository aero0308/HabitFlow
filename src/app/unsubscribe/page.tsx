"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

/**
 * Unsubscribe landing page.
 *
 * Reached when the user clicks "Unsubscribe" in a weekly summary email
 * (URL: /unsubscribe?token=<emailUnsubscribeToken>).
 *
 * Flow:
 *  1. Read token from the URL via useSearchParams.
 *  2. POST the token to /api/unsubscribe (one-shot fetch via TanStack Query).
 *  3. Derive UI purely from the query state (loading / success / invalid).
 *
 * Implementation note: we deliberately avoid setState-in-effect here to
 * satisfy the `react-hooks/set-state-in-effect` lint rule. The fetch lives
 * inside useQuery (TanStack Query manages its own state), and the visible
 * UI is a pure function of the query's status. We also derive `hasToken`
 * directly from the search params at render time instead of mirroring it
 * into local state.
 */

interface UnsubscribeResponse {
  ok?: boolean;
  detail?: string;
  code?: string;
}

async function postUnsubscribe(token: string, signal: AbortSignal): Promise<UnsubscribeResponse> {
  const res = await fetch("/api/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    signal,
  });
  if (res.ok) {
    return (await res.json().catch(() => ({}))) as UnsubscribeResponse;
  }
  const body = (await res.json().catch(() => ({}))) as UnsubscribeResponse;
  const err = new Error(body.detail || "Unsubscribe failed");
  (err as Error & { status?: number; code?: string }).status = res.status;
  (err as Error & { status?: number; code?: string }).code = body.code;
  throw err;
}

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  // Derive token directly from search params — NO mirroring into state.
  const token = searchParams.get("token") || "";
  const hasToken = token.length > 0;

  // useQuery manages its own state — no setState-in-effect needed here.
  const query = useQuery({
    queryKey: ["unsubscribe", token],
    queryFn: ({ signal }) => postUnsubscribe(token, signal),
    enabled: hasToken,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // ---- derived view state (purely a function of query/token) ----
  let headline = "";
  let sub = "";
  let icon: React.ReactNode = null;
  let tone: "success" | "error" | "loading" = "loading";

  if (!hasToken) {
    headline = "Invalid unsubscribe link";
    sub =
      "We couldn't find an unsubscribe token in the URL. Open the link from the bottom of your weekly email and try again.";
    tone = "error";
    icon = <XCircle className="h-10 w-10 text-red-500" aria-hidden="true" />;
  } else if (query.isPending) {
    headline = "Processing your request…";
    sub = "Hang tight — we're opting you out of weekly emails.";
    tone = "loading";
    icon = <Loader2 className="h-10 w-10 animate-spin text-violet-500" aria-hidden="true" />;
  } else if (query.isError) {
    headline = "Link expired or invalid";
    sub =
      (query.error as Error & { code?: string })?.message ||
      "This unsubscribe link is invalid, expired, or has already been used. You can also disable reminders from Settings → Notifications.";
    tone = "error";
    icon = <XCircle className="h-10 w-10 text-red-500" aria-hidden="true" />;
  } else if (query.isSuccess && query.data?.ok) {
    headline = "You're unsubscribed";
    sub =
      "You will no longer receive weekly summary emails from HabitFlow. You can re-enable them any time from Settings → Notifications.";
    tone = "success";
    icon = <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0b0b0f] px-4 py-12 text-center text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#26262f] bg-[#16161d] p-8 shadow-xl">
        <div className="mb-5 flex justify-center">{icon}</div>
        <h1 className="mb-3 text-2xl font-semibold tracking-tight">{headline}</h1>
        <p className="text-sm leading-relaxed text-[#9b9ba9]">{sub}</p>

        <div className="mt-7 flex flex-col items-stretch gap-2">
          <a
            href="/"
            className="inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            Back to HabitFlow
          </a>
          {tone !== "success" && (
            <a
              href="/settings"
              className="inline-flex w-full items-center justify-center rounded-lg border border-[#26262f] px-4 py-2.5 text-sm font-medium text-[#9b9ba9] transition-colors hover:bg-[#1d1d26] hover:text-white"
            >
              Open notification settings
            </a>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-[#5b5b66]">
        © {new Date().getFullYear()} HabitFlow
      </p>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#0b0b0f] px-4 text-white">
          <Loader2 className="h-10 w-10 animate-spin text-violet-500" aria-hidden="true" />
          <p className="mt-4 text-sm text-[#9b9ba9]">Loading…</p>
        </main>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
