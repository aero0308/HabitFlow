/**
 * Bad-habit milestone definitions + label helpers.
 *
 * Three milestone dimensions:
 *  - "days"  : clean-day milestones (1, 3, 7, 14, 30, 60, 90, 180, 365)
 *  - "money" : cumulative money saved (USD values: 10, 50, 100, 250, 500, 1000, 5000)
 *  - "time"  : cumulative hours reclaimed (10, 50, 100, 500)
 *
 * Labels are user-facing (e.g. "1 week clean", "$50 saved", "10 hours reclaimed").
 * Tone is supportive — celebratory, never shaming.
 */

export const DAY_MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365] as const;
export const MONEY_MILESTONES_USD = [10, 50, 100, 250, 500, 1000, 5000] as const;
export const TIME_MILESTONES_HOURS = [10, 50, 100, 500] as const;

export type MilestoneType = "days" | "money" | "time";

export interface MilestoneDef {
  type: MilestoneType;
  value: number;
  label: string;
}

/**
 * Build a friendly label for a clean-day milestone.
 * Examples:
 *   1   -> "1 day clean"
 *   7   -> "1 week clean"
 *   14  -> "2 weeks clean"
 *   30  -> "1 month clean"
 *   90  -> "3 months clean"
 *   365 -> "1 year clean"
 */
export function dayMilestoneLabel(days: number): string {
  if (days <= 0) return "0 days clean";
  if (days === 1) return "1 day clean";
  if (days === 7) return "1 week clean";
  if (days === 14) return "2 weeks clean";
  if (days === 30) return "1 month clean";
  if (days === 60) return "2 months clean";
  if (days === 90) return "3 months clean";
  if (days === 180) return "6 months clean";
  if (days === 365) return "1 year clean";
  if (days < 7) return `${days} days clean`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "1 week clean" : `${w} weeks clean`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return m === 1 ? "1 month clean" : `${m} months clean`;
  }
  const y = Math.floor(days / 365);
  return y === 1 ? "1 year clean" : `${y} years clean`;
}

/**
 * Label for a money-saved milestone. Currency is a 3-letter ISO code (USD/EUR/GBP/INR...).
 * We use Intl.NumberFormat so the symbol and grouping follow the user's locale.
 */
export function moneyMilestoneLabel(amount: number, currency: string): string {
  return `${formatCurrency(amount, currency)} saved`;
}

/**
 * Label for a time-reclaimed milestone.
 */
export function timeMilestoneLabel(hours: number): string {
  if (hours === 1) return "1 hour reclaimed";
  return `${hours} hours reclaimed`;
}

/**
 * Format a numeric amount as a currency string using Intl.NumberFormat.
 * Falls back to `USD ${amount}` if the currency is invalid.
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

/**
 * Returns the full milestone definition for a given (type, value) pair.
 */
export function milestoneDef(type: MilestoneType, value: number, currency = "USD"): MilestoneDef {
  switch (type) {
    case "days":
      return { type, value, label: dayMilestoneLabel(value) };
    case "money":
      return { type, value, label: moneyMilestoneLabel(value, currency) };
    case "time":
      return { type, value, label: timeMilestoneLabel(value) };
  }
}

/**
 * All milestone definitions across the three dimensions, in canonical order.
 */
export function allMilestones(currency = "USD"): MilestoneDef[] {
  return [
    ...DAY_MILESTONES.map((v) => milestoneDef("days", v, currency)),
    ...MONEY_MILESTONES_USD.map((v) => milestoneDef("money", v, currency)),
    ...TIME_MILESTONES_HOURS.map((v) => milestoneDef("time", v, currency)),
  ];
}
