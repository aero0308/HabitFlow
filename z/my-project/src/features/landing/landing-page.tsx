"use client";

import { useState, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { ProductTour } from "./components/ProductTour";
import { Features } from "./components/Features";
import { UnifiedShowcase } from "./components/UnifiedShowcase";
import { HowItWorks } from "./components/HowItWorks";
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
        <ProductTour />
        <Features />
        <UnifiedShowcase onGetStarted={handleGetStarted} />
        <HowItWorks />
        <Testimonials />
        <Pricing onGetStarted={handleGetStarted} />
        <FAQ />
        <FinalCTA onGetStarted={handleGetStarted} />
      </main>
      <Footer />
    </div>
  );
}
