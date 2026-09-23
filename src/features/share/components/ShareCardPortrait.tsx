import { forwardRef, type CSSProperties } from "react";
import type { ShareCardData } from "@/features/share/hooks/useShareCardData";
import { ShareCardPhoto } from "./ShareCardPhoto";
import { ShareCardIdentityBar } from "./ShareCardIdentityBar";
import { ShareCardStats } from "./ShareCardStats";

/* ============================================================================
   ShareCardPortrait — 1080×1350 (4:5) sports stat card.
   ----------------------------------------------------------------------------
   Stacked vertically:
     TOP (40%):    Photo / initials monogram + name badge
     BOTTOM (60%): Header → Identity bar → 6 stat rows → Footer

   Same content as landscape, but with more vertical breathing room.
============================================================================ */

const W = 1080;
const H = 1350;
const PHOTO_H = 540; // 40% of 1350
const FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const ShareCardPortrait = forwardRef<HTMLDivElement, {
  data: ShareCardData;
  className?: string;
  style?: CSSProperties;
}>(function ShareCardPortrait({ data, className, style }, ref) {
  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0510",
        color: "#ffffff",
        fontFamily: FONT_FAMILY,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* ====== TOP: PHOTO (40%) ====== */}
      <div style={{ width: "100%", height: PHOTO_H, flexShrink: 0 }}>
        <ShareCardPhoto
          displayName={data.displayName}
          avatarUrl={data.avatarUrl}
          layout="portrait"
        />
      </div>

      {/* ====== BOTTOM: STATS DASHBOARD (60%) ====== */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Ambient violet glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-8%",
            left: "30%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        {/* 1. Header block */}
        <div style={{ padding: "32px 40px 0", position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: 13,
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
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: -2,
              color: "#8b5cf6",
              marginTop: 6,
              lineHeight: 1,
            }}
          >
            SEASON STATS
          </div>
        </div>

        {/* 2. Identity bar */}
        <div style={{ marginTop: 20, position: "relative", zIndex: 1 }}>
          <ShareCardIdentityBar
            displayName={data.displayName}
            currentStreak={data.currentStreak}
            daysTracked={data.daysTracked}
            layout="portrait"
          />
        </div>

        {/* 3. Stat rows */}
        <div style={{ flex: 1, position: "relative", zIndex: 1, overflow: "hidden" }}>
          <ShareCardStats data={data} layout="portrait" />
        </div>

        {/* 4. Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 40px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #8b5cf6, #a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              H
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: 1 }}>
              HabitFlow
            </span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, textTransform: "uppercase", letterSpacing: 1 }}>
            habitflow.app
          </span>
        </div>
      </div>
    </div>
  );
});
