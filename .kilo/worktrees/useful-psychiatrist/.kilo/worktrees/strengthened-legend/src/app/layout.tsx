import type { Metadata } from "next";
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

export const metadata: Metadata = {
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
  authors: [{ name: "HabitFlow" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "HabitFlow — Build Better Habits, One Day at a Time",
    description:
      "Track daily habits, visualize your streaks, and stay consistent with data-driven insights. Free forever.",
    type: "website",
    siteName: "HabitFlow",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "HabitFlow" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HabitFlow — Build Better Habits",
    description: "Track daily habits, visualize streaks, stay consistent. Free forever.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
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
