"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Linkedin, Mail, ExternalLink, ArrowUpRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { aboutContent } from "./aboutContent";

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  const { social, flagship, otherProjects, cta } = aboutContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Mobile: full-screen sheet with safe-area padding, sticky top bar
        // and sticky bottom CTA so the user can always close/email without
        // scrolling to the very top or bottom.
        // Desktop: centered 640px modal with normal padding.
        // IMPORTANT: the base DialogContent class includes
        // `translate-x-[-50%] translate-y-[-50%]` (used together with
        // `top-[50%] left-[50%]` to center the modal on desktop). On mobile
        // we set `inset-0` to override top/left → 0, so we MUST also reset
        // the translate to 0 — otherwise the modal ends up offscreen at
        // (-50% width, -50% height) = roughly (-187px, -422px) on a 390x844
        // viewport. Hence the explicit `translate-x-0 translate-y-0` below,
        // which only applies on mobile (the `sm:` variants re-enable the
        // -50% translate for the centered desktop layout).
        className="
          fixed inset-0 translate-x-0 translate-y-0
          sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          rounded-none sm:rounded-2xl
          max-w-none sm:max-w-[640px] w-full sm:w-[calc(100%-2rem)]
          h-[100dvh] sm:h-auto sm:max-h-[85vh]
          max-h-[100dvh] sm:max-h-[85vh]
          overflow-y-auto no-scrollbar
          bg-background/95 sm:bg-background text-foreground
          border-0 sm:border shadow-none sm:shadow-xl
          p-0 sm:p-6 gap-0
          flex flex-col
          safe-area-pt safe-area-pb
        "
        overlayClassName="bg-black/60 backdrop-blur-md"
        // On mobile we render our own sticky close button (see header below),
        // so hide the default Radix X to avoid double close buttons.
        showCloseButton={false}
      >
        {/* Sticky mobile top bar (hidden on sm+ where the regular close
            button is fine). Provides a large, reachable close target and
            a small "About" label so the user always knows where they are. */}
        <div className="sm:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-12 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60 -mx-0">
          <span className="text-[11px] font-bold tracking-widest uppercase text-violet-600 dark:text-violet-300">
            About the developer
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 -mr-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key="about-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex-1 px-4 sm:px-0 pt-6 pb-4 sm:pt-0 sm:pb-0 min-h-0"
          >
            <DialogHeader className="text-left mb-4 sm:mb-5">
              <Badge
                variant="outline"
                className="mb-2 sm:mb-3 text-[10px] font-bold tracking-widest uppercase text-violet-600 dark:text-violet-300 border-violet-500/30 bg-violet-500/5 w-fit"
              >
                About
              </Badge>
              <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Hi, I&apos;m Sachin.
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm mt-1">
                {aboutContent.role} · {aboutContent.tagline}
              </DialogDescription>
            </DialogHeader>

            {/* Intro: photo + bio + social */}
            <section className="flex flex-col sm:flex-row gap-3 sm:gap-5">
              <Avatar />
              <div className="flex-1 space-y-3 min-w-0">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {aboutContent.bio}
                </p>
                <div className="flex items-center gap-2">
                  <SocialLink
                    href={social.github}
                    label="GitHub"
                    icon={<Github className="w-4 h-4" />}
                  />
                  <SocialLink
                    href={social.linkedin}
                    label="LinkedIn"
                    icon={<Linkedin className="w-4 h-4" />}
                  />
                  <SocialLink
                    href={`mailto:${social.email}`}
                    label="Email"
                    icon={<Mail className="w-4 h-4" />}
                  />
                </div>
              </div>
            </section>

            <Separator className="my-4 sm:my-5" />

            {/* Flagship project */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
                  {flagship.label}
                </span>
                <span className="h-px flex-1 bg-border/60" />
              </div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                {flagship.name}
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {flagship.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {flagship.stack.map((tech) => (
                  <Badge
                    key={tech}
                    variant="secondary"
                    className="text-[10px] font-medium bg-muted/60 text-muted-foreground"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  asChild
                  size="sm"
                  className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white border-0 shadow-lg shadow-violet-500/20 transition-all"
                >
                  <a
                    href={flagship.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Live demo
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-border/60 hover:bg-muted">
                  <a
                    href={flagship.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="w-3.5 h-3.5" />
                    Source
                  </a>
                </Button>
              </div>
            </section>

            <Separator className="my-4 sm:my-5" />

            {/* Other projects */}
            <section className="space-y-2.5">
              <h3 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                Other projects
              </h3>
              <ul className="space-y-2.5">
                {otherProjects.map((proj) => (
                  <li key={proj.name}>
                    {proj.url ? (
                      <a
                        href={proj.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-2 rounded-lg p-2 -mx-2 hover:bg-muted/60 transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-violet-500 transition-colors flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                            {proj.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {proj.description}
                          </p>
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-start gap-2 p-2 -mx-2 opacity-70">
                        <ArrowUpRight className="w-4 h-4 mt-0.5 text-muted-foreground/50 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{proj.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {proj.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <Separator className="my-4 sm:my-5" />

            {/* Footer CTA — on mobile this sits inline at the end of the
                scrollable content. We DON'T make it sticky here because
                the sticky top bar already gives the user a clear escape
                hatch, and a sticky bottom bar would steal too much vertical
                real estate on small screens. */}
            <section className="text-center space-y-3 pb-2">
              <p className="text-sm text-foreground">{cta.text}</p>
              <Button
                asChild
                size="sm"
                className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white border-0 shadow-lg shadow-violet-500/20 transition-all w-full sm:w-auto"
              >
                <a href={`mailto:${social.email}`}>
                  <Mail className="w-3.5 h-3.5" />
                  {cta.emailLabel}
                </a>
              </Button>
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/60 mt-3">
                {cta.footer}
              </p>
            </section>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Internal components ---------------- */

function Avatar() {
  const [errored, setErrored] = useState(false);

  if (!errored) {
    return (
      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-violet-500/30 self-start sm:self-auto">
        <img
          src={aboutContent.photo}
          alt={aboutContent.name}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }

  // Fallback: gradient circle with initial
  return (
    <div
      className="
        w-14 h-14 sm:w-20 sm:h-20 rounded-full flex-shrink-0 flex items-center justify-center
        bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white
        ring-2 ring-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.25)]
      "
      aria-label={aboutContent.name}
    >
      <span className="text-xl sm:text-3xl font-bold">S</span>
    </div>
  );
}

function SocialLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="
        inline-flex items-center justify-center w-9 h-9 rounded-md
        text-muted-foreground hover:text-foreground hover:bg-muted
        border border-border/60 transition-colors
        flex-shrink-0
      "
    >
      {icon}
    </a>
  );
}
