import type { ShareCardBadge } from "@/features/share/hooks/useShareCardData";

/**
 * ShareCardBadges — a row of 4-6 earned-achievement circles on the share card.
 *
 * Each badge is a circle (default 56px, configurable via `size` prop) with:
 *   - bg-[#0a0a0f] dark inner background
 *   - 1.5px colored border (uses the badge's color from the data)
 *   - Inner emoji icon (24px for 56px circles, 18px for 40px)
 *   - Outer glow: 0 0 16px rgba(badge-color, 0.4)
 *
 * Pure presentational leaf — uses literal hex values + inline styles so the
 * PNG export is deterministic across light/dark modes.
 *
 * If more badges than `max`, shows a "+N more" chip.
 */
export function ShareCardBadges({
  badges,
  max = 6,
  size = 56,
}: {
  badges: ShareCardBadge[];
  max?: number;
  size?: number;
}) {
  const shown = badges.slice(0, max);
  const overflow = badges.length - shown.length;
  if (shown.length === 0) return null;

  const iconSize = size >= 48 ? 24 : 18;
  const gap = size >= 48 ? 12 : 8;

  return (
    <div
      className="flex items-center justify-center flex-wrap"
      style={{ gap }}
    >
      {shown.map((b) => (
        <div
          key={b.id}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: "#0a0a0f",
            border: `1.5px solid ${b.color}`,
            boxShadow: `0 0 16px ${b.color}66`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: iconSize,
          }}
        >
          <span>{b.icon}</span>
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size >= 48 ? 12 : 10,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 600,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
