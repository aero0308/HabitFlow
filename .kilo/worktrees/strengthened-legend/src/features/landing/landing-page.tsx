"use client";

import { useState, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { ScrollShowcase } from "./components/ScrollShowcase";
import { Features } from "./components/Features";
import { MoodShowcase } from "./components/MoodShowcase";
import { HowItWorks } from "./components/HowItWorks";
import { LivePreview } from "./components/LivePreview";
import { Testimonials } from "./components/Testimonials";
import { Pricing } from "./components/Pricing";
import { FAQ } from "./components/FAQ";
import { FinalCTA } from "./components/FinalCTA";
import { Footer } from "./components/Footer";

export type AuthView = "landing" | "login" | "register";

interface LandingPageProps {
  onShowAuth: (view: "login" | "register") => void;
}

export function LandingPage({ onShowAuth }: LandingPageProps) {
  const handleGetStarted = useCallback(() => onShowAuth("register"), [onShowAuth]);
  const handleSignIn = useCallback(() => onShowAuth("login"), [onShowAuth]);
  const handleViewDemo = useCallback(() => onShowAuth("login"), [onShowAuth]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar onSignIn={handleSignIn} onGetStarted={handleGetStarted} />
      <main>
        <Hero onGetStarted={handleGetStarted} onViewDemo={handleViewDemo} />
        <ScrollShowcase />
        <Features />
        <MoodShowcase />
        <HowItWorks />
        <LivePreview />
        <Testimonials />
        <Pricing onGetStarted={handleGetStarted} />
        <FAQ />
        <FinalCTA onGetStarted={handleGetStarted} />
      </main>
      <Footer />
    </div>
  );
}
