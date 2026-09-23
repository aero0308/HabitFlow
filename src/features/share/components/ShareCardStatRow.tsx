import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

/* ============================================================================
   ShareCardStatRow — a single stat row in the right column.
   ----------------------------------------------------------------------------
   Layout: 3 columns
     Left:   value (big, white, font-black)
     Center: label (uppercase, violet, tracking-widest)
     Right:  icon (colored)

   Divider: 1px solid rgba(255,255,255,0.06) below each row.
============================================================================ */

export function ShareCardStatRow({
  value,
  label,
  icon: Icon,
  iconColor,
  isLast,
  layout,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  isLast?: boolean;
  layout: "portrait" | "landscape";
}) {
  const isPortrait = layout === "portrait";
  const valueSize = isPortrait ? 32 : 28;
  const rowPadding = isPortrait ? "16px 20px" : "12px 16px";

  const containerStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 16,
    padding: rowPadding,
    borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)",
  };

  return (
    <div style={containerStyle}>
      {/* Left: value */}
      <span
        style={{
          fontSize: valueSize,
          fontWeight: 900,
          color: "#ffffff",
          fontVariantNumeric: "tabular-nums",
          minWidth: 80,
          lineHeight: 1,
        }}
      >
        {value}
      </span>

      {/* Center: label */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#a78bfa",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
        }}
      >
        {label}
      </span>

      {/* Right: icon */}
      <Icon
        size={isPortrait ? 20 : 18}
        style={{ color: iconColor }}
      />
    </div>
  );
}
