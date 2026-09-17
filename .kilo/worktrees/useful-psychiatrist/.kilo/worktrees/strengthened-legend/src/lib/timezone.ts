export function todayInTimezone(timezone?: string | null, browserTimezone?: string | null): string {
  const effective = (timezone && timezone !== "UTC") ? timezone : (browserTimezone || detectFromIntl());
  if (!effective) return toUTCDateString(new Date());
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: effective, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  catch { return toUTCDateString(new Date()); }
}
export function getBrowserTimezone(req: Request): string | null { return req.headers.get("x-browser-timezone") || null; }
function detectFromIntl(): string | null { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } }
function toUTCDateString(date: Date): string { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; }
