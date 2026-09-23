"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, CheckCircle2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogoDots } from "@/components/shared/logo-dots";

interface NavbarProps {
  onSignIn: () => void;
  onGetStarted: () => void;
}

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

// NOTE: The old DARK_SECTION_IDS + "inverted" logic has been removed.
// These sections (tour / features / pricing) used to be always-dark, so
// the navbar flipped to a dark "inverted" appearance when scrolling over
// them. Now that they're adaptive (light in light mode, dark in dark
// mode), the navbar's normal appearance (bg-background/80 backdrop-blur)
// already adapts correctly — no inversion needed.

function Logo() {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight text-foreground">
          HabitFlow
        </span>
      </div>
      <div className="ml-10">
        <LogoDots />
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="h-9 w-9"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

export function Navbar({ onSignIn, onGetStarted }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 8);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function scrollTo(href: string) {
    setMobileOpen(false);
    // Use setTimeout to ensure the mobile drawer has closed before scrolling,
    // otherwise the layout shift can interfere with scrollIntoView.
    setTimeout(() => {
      const el = document.querySelector(href);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 64; // 64px = navbar height
        window.scrollTo({ top, behavior: "smooth" });
      }
    }, 50);
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        !scrolled
          ? "bg-transparent border-b border-transparent"
          : "bg-background/80 backdrop-blur-lg border-b border-border/50 shadow-sm",
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Logo />

        {/* Desktop links — absolutely positioned relative to the HEADER
            (which is `fixed` and spans the full viewport), NOT the nav
            container (which is constrained by max-w-7xl + scrollbar
            gutter). This ensures the links are centered with respect to
            the WHOLE viewport, not just the nav container. The nav is
            NOT `relative`, so `absolute` children resolve to the header.
            Removed from flex layout (absolute), so justify-between only
            applies to Logo (left) and CTAs (right). */}
        <div className="hidden md:flex items-center gap-8 absolute left-[50vw] -translate-x-1/2 top-0 h-16">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Desktop CTAs — right-aligned via justify-between */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={onSignIn}>
            Sign in
          </Button>
          <Button
            size="sm"
            onClick={onGetStarted}
            className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
          >
            Get Started Free
          </Button>
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden backdrop-blur-lg border-b bg-background/95 border-border/50"
          >
            <div className="px-4 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-2 space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setMobileOpen(false);
                    onSignIn();
                  }}
                >
                  Sign in
                </Button>
                <Button
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
                  onClick={() => {
                    setMobileOpen(false);
                    onGetStarted();
                  }}
                >
                  Get Started Free
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
