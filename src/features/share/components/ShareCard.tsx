"use client";

import { forwardRef, type CSSProperties } from "react";
import type { ShareCardData } from "@/features/share/hooks/useShareCardData";
import { ShareCardLandscape } from "./ShareCardLandscape";
import { ShareCardPortrait } from "./ShareCardPortrait";

export type { ShareCardData } from "@/features/share/hooks/useShareCardData";

export interface ShareCardProps {
  data: ShareCardData;
  variant: "portrait" | "landscape";
  className?: string;
  style?: CSSProperties;
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  function ShareCard({ data, variant, className, style }, ref) {
    if (variant === "landscape") {
      return <ShareCardLandscape ref={ref} data={data} className={className} style={style} />;
    }
    return <ShareCardPortrait ref={ref} data={data} className={className} style={style} />;
  },
);
