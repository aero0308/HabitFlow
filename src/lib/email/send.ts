import { render } from "@react-email/render";
import type { ReactElement } from "react";

/**
 * Resend email wrapper with a dev console fallback.
 *
 * In production (RESEND_API_KEY set), uses the Resend SDK to actually send
 * the email through `api.resend.com/emails`.
 *
 * In dev (no RESEND_API_KEY), logs the rendered HTML + metadata to the server
 * console so developers can preview the email without spamming real inboxes.
 */

export interface SendEmailArgs {
  from?: string;
  to: string;
  subject: string;
  react: ReactElement;
  /** Optional plain-text body. If omitted, Resend derives one from the HTML. */
  text?: string;
  /** Optional reply-to address. */
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  mode: "production" | "dev-console";
  messageId?: string;
  error?: string;
}

/** True when no RESEND_API_KEY is configured — emails are logged instead of sent. */
export function isDevEmailMode(): boolean {
  const k = process.env.RESEND_API_KEY;
  return !k || k === "test";
}

/** From email — uses FROM_EMAIL env var, falls back to a sensible default. */
export function getFromEmail(): string {
  return process.env.FROM_EMAIL || "HabitFlow <habits@yourdomain.com>";
}

/** Public app URL — uses NEXT_PUBLIC_APP_URL, falls back to localhost in dev. */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Render a React Email component to an HTML string.
 */
export async function renderEmailHtml(component: ReactElement): Promise<string> {
  return await render(component, { pretty: true });
}

/**
 * Send an email.
 *
 * - In production with RESEND_API_KEY: sends via Resend.
 * - Otherwise: logs to console (dev preview mode).
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const from = args.from || getFromEmail();
  const html = await renderEmailHtml(args.react);

  if (isDevEmailMode()) {
    console.log("\n" + "=".repeat(72));
    console.log("📧 EMAIL (dev console — not actually sent)");
    console.log(`From:    ${from}`);
    console.log(`To:      ${args.to}`);
    console.log(`Subject: ${args.subject}`);
    if (args.replyTo) console.log(`Reply-To: ${args.replyTo}`);
    console.log("-".repeat(72));
    console.log(html);
    console.log("=".repeat(72) + "\n");
    return { ok: true, mode: "dev-console", messageId: `dev-console-${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html,
        text: args.text,
        reply_to: args.replyTo,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, mode: "production", error: `Resend ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, mode: "production", messageId: data.id };
  } catch (e) {
    return { ok: false, mode: "production", error: (e as Error).message };
  }
}
