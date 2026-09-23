/**
 * Icon name → emoji map for AI-generated habit suggestions.
 *
 * The Habit model stores `icon` as a string (typically an emoji). When the
 * AI returns a suggestion, it picks an icon by *name* (e.g. "droplet") rather
 * than emitting a raw emoji character — providers sometimes mangle unicode
 * in JSON. We translate the name back to the emoji on the server before
 * persisting or returning to the client.
 *
 * If the AI returns a name we don't know, the caller falls back to whatever
 * raw string was provided (which may itself already be an emoji).
 */
export const HABIT_ICONS: Record<string, string> = {
  droplet: "💧",
  dumbbell: "🏋️",
  book: "📚",
  brain: "🧠",
  heart: "❤️",
  sun: "☀️",
  moon: "🌙",
  coffee: "☕",
  apple: "🍎",
  footprints: "🚶",
  yoga: "🧘",
  pen: "✍️",
  palette: "🎨",
  music: "🎵",
  code: "💻",
  languages: "🗣️",
  wallet: "💰",
  users: "👥",
  home: "🏠",
  sparkles: "✨",
  timer: "⏱️",
  target: "🎯",
};

/** Stable, ordered list of icon names — used to populate the prompt + picker. */
export const ICON_NAMES = Object.keys(HABIT_ICONS);

/**
 * Resolve an icon string returned by the AI to a display emoji.
 *
 * Accepts either:
 *   - a known icon name (e.g. "droplet") → returns the mapped emoji
 *   - an unknown name → returns the name as-is (callers can override)
 *   - a raw emoji string → returns it unchanged
 */
export function resolveIcon(icon: string | undefined | null): string {
  if (!icon) return "✅";
  const trimmed = icon.trim();
  if (!trimmed) return "✅";
  // If it's already a known icon name, map it
  if (HABIT_ICONS[trimmed]) return HABIT_ICONS[trimmed];
  // Otherwise treat it as a raw string (could already be an emoji)
  return trimmed;
}
