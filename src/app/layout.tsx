import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Production URL — used as the metadataBase so relative OG image URLs
// (e.g. "/og-image.png") are resolved into absolute URLs that LinkedIn /
// Twitter / Slack can actually fetch when generating link previews.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://habit-flow-nine-eta.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "HabitFlow — Build Better Habits, One Day at a Time",
  description:
    "Track daily habits, visualize your streaks, and stay consistent with data-driven insights. Free forever, no credit card required.",
  keywords: [
    "habit tracker",
    "streak tracking",
    "productivity",
    "goals",
    "habits",
    "daily routine",
    "self improvement",
  ],
  authors: [{ name: "Sachin Gupta" }],
  creator: "Sachin Gupta",
  applicationName: "HabitFlow",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "HabitFlow — Build Better Habits, One Day at a Time",
    description:
      "Track daily habits, visualize your streaks, and stay consistent with data-driven insights. Free forever, no credit card required.",
    type: "website",
    url: SITE_URL,
    siteName: "HabitFlow",
    locale: "en_US",
    images: [
      {
        // ?v=2 cache-busts the OG image so social platforms (Twitter,
        // LinkedIn, Slack) re-fetch the latest version instead of serving
        // a stale cached copy. Bump this whenever the og-image is
        // regenerated.
        url: "/og-image.png?v=2",
        width: 1344,
        height: 768,
        alt: "HabitFlow — Build better habits, one day at a time",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HabitFlow — Build Better Habits, One Day at a Time",
    description:
      "Track daily habits, visualize streaks, stay consistent. Free forever, no credit card required.",
    images: ["/og-image.png?v=2"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// viewport-fit=cover lets us use env(safe-area-inset-*) in CSS so the
// full-screen About modal (and other mobile UIs) can avoid the iOS notch /
// Dynamic Island / home indicator on iPhone X+ devices.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#080B11" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
