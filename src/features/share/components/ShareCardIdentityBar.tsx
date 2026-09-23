import type { CSSProperties } from "react";

/* ============================================================================
   ShareCardIdentityBar — a solid violet bar below the header title.
   ----------------------------------------------------------------------------
   Layout: 3 columns
     Left:   current streak number (big, white, font-black)
     Center: display name (uppercase, bold)
     Right:  days tracked (e.g., "365d")

   Mimics the "00 vs 00" colored bar from sports broadcast graphics.
============================================================================ */

export function ShareCardIdentityBar({
  displayName,
  currentStreak,
  daysTracked,
  layout,
}: {
  displayName: string;
  currentStreak: number;
  daysTracked: number;
  layout: "portrait" | "landscape";
}) {
  const isPortrait = layout === "portrait";
  const numberSize = isPortrait ? 44 : 36;

  const containerStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    background: "linear-gradient(90deg, #7c3aed 0%, #8b5cf6 50%, #7c3aed 100%)",
    padding: isPortrait ? "14px 24px" : "10px 20px",
    gap: 12,
  };

  return (
    <div style={containerStyle}>
      {/* Left: streak number */}
      <div style={{ textAlign: "left" }}>
        <span
          style={{
            fontSize: numberSize,
            fontWeight: 900,
            color: "#ffffff",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {currentStreak}
        </span>
        <span
          style={{
            fontSize: isPortrait ? 14 : 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            marginLeft: 4,
            textTransform: "uppercase",
          }}
        >
          d
        </span>
      </div>

      {/* Center: name */}
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            fontSize: isPortrait ? 18 : 16,
            fontWeight: 700,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: 1.5,
          }}
        >
          {displayName}
        </span>
      </div>

      {/* Right: days tracked */}
      <div style={{ textAlign: "right" }}>
        <span
          style={{
            fontSize: numberSize,
            fontWeight: 900,
            color: "#ffffff",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {daysTracked}
        </span>
        <span
          style={{
            fontSize: isPortrait ? 14 : 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            marginLeft: 4,
            textTransform: "uppercase",
          }}
        >
          d
        </span>
      </div>
    </div>
  );
}
