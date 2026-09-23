import type { CSSProperties } from "react";

/* ============================================================================
   ShareCardPhoto — the left column (landscape) or top section (portrait).
   ----------------------------------------------------------------------------
   Shows the user's avatar photo filling the entire area, or a HUGE initials
   monogram (like a jersey number) on a gradient background if no photo.

   A name badge sits at the bottom-left corner, overlapping the photo.
============================================================================ */

function initials(name: string): string {
  return (name || "H")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ShareCardPhoto({
  displayName,
  avatarUrl,
  layout,
}: {
  displayName: string;
  avatarUrl: string;
  layout: "portrait" | "landscape";
}) {
  const isPortrait = layout === "portrait";
  const initialsFontSize = isPortrait ? 200 : 160;

  const containerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    background: avatarUrl
      ? "#0a0510"
      : "linear-gradient(135deg, #1a0f2e 0%, #0f0518 50%, #0a0510 100%)",
  };

  return (
    <div style={containerStyle}>
      {/* Photo or initials.
          NOTE: crossOrigin="anonymous" is only set for non-data URLs
          (i.e. http/https URLs). Data URLs (base64) don't support CORS
          and adding crossOrigin can cause the browser to silently refuse
          to load the image. This was the bug — profile uploads are stored
          as base64 data URLs, so the photo wasn't rendering. */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          {...(!avatarUrl.startsWith("data:") ? { crossOrigin: "anonymous" as const } : {})}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Ambient glow behind initials */}
          <div
            style={{
              position: "absolute",
              width: "60%",
              height: "60%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)",
            }}
          />
          <span
            style={{
              fontSize: initialsFontSize,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: -8,
              lineHeight: 1,
              background: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 60%, #8b5cf6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              position: "relative",
              zIndex: 1,
            }}
          >
            {initials(displayName)}
          </span>
        </div>
      )}

      {/* Diagonal hatch overlay at 5% opacity for depth */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 12px)",
          pointerEvents: "none",
        }}
      />

      {/* Top-left corner accent (violet bracket) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 48,
          height: 48,
          borderTop: "4px solid #8b5cf6",
          borderLeft: "4px solid #8b5cf6",
        }}
      />

      {/* Bottom-left name badge */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          backgroundColor: "rgba(0,0,0,0.75)",
          borderRadius: 8,
          padding: "10px 20px",
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontSize: isPortrait ? 22 : 18,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {displayName}
        </span>
      </div>
    </div>
  );
}
