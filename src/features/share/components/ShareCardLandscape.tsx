import { forwardRef, type CSSProperties } from "react";
import type { ShareCardData } from "@/features/share/hooks/useShareCardData";
import { ShareCardPhoto } from "./ShareCardPhoto";
import { ShareCardIdentityBar } from "./ShareCardIdentityBar";
import { ShareCardStats } from "./ShareCardStats";

/* ============================================================================
   ShareCardLandscape — 1200×675 (16:9) sports stat card.
   ----------------------------------------------------------------------------
   Two-column layout:
     LEFT (42%):  Photo / initials monogram + name badge
     RIGHT (58%): Header → Identity bar → 6 stat rows → Footer

   Square edges (no rounded corners). Dark violet background.
============================================================================ */

const W = 1200;
const H = 675;
const FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const ShareCardLandscape = forwardRef<HTMLDivElement, {
  data: ShareCardData;
  className?: string;
  style?: CSSProperties;
}>(function ShareCardLandscape({ data, className, style }, ref) {
  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: W,
        height: H,
        display: "grid",
        gridTemplateColumns: "42% 58%",
        backgroundColor: "#0a0510",
        color: "#ffffff",
        fontFamily: FONT_FAMILY,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* ====== LEFT: PHOTO ====== */}
      <div style={{ position: "relative", height: "100%" }}>
        <ShareCardPhoto
          displayName={data.displayName}
          avatarUrl={data.avatarUrl}
          layout="landscape"
        />
      </div>

      {/* ====== RIGHT: STATS DASHBOARD ====== */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          borderLeft: "2px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Ambient violet glow top-left of right column */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-10%",
            left: "-5%",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        {/* 1. Header block */}
        <div style={{ padding: "24px 28px 0", position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            HabitFlow Athlete
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: -2,
              color: "#8b5cf6",
              marginTop: 4,
              lineHeight: 1,
            }}
          >
            SEASON STATS
          </div>
        </div>

        {/* 2. Identity bar */}
        <div style={{ marginTop: 16, position: "relative", zIndex: 1 }}>
          <ShareCardIdentityBar
            displayName={data.displayName}
            currentStreak={data.currentStreak}
            daysTracked={data.daysTracked}
            layout="landscape"
          />
        </div>

        {/* 3. Stat rows */}
        <div style={{ flex: 1, position: "relative", zIndex: 1, overflow: "hidden" }}>
          <ShareCardStats data={data} layout="landscape" />
        </div>

        {/* 4. Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 28px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #8b5cf6, #a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 10,
              }}
            >
              H
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
              HabitFlow
            </span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
            habitflow.app
          </span>
        </div>
      </div>
    </div>
  );
});
