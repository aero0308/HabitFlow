"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { fadeIn, staggerContainerFast, viewportOnce } from "../animations";

const TECH_BADGES = ["Next.js", "Prisma", "React", "TypeScript"];

export function SocialProof() {
  return (
    <section className="py-8 border-b border-border/40 bg-background/50">
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center gap-3 text-center"
        variants={staggerContainerFast}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        <motion.p
          variants={fadeIn}
          className="text-xs sm:text-sm font-medium text-muted-foreground tracking-wide"
        >
          Built by developers, for developers
        </motion.p>
        <motion.div
          variants={fadeIn}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {TECH_BADGES.map((tech) => (
            <Badge
              key={tech}
              variant="outline"
              className="px-3 py-1 text-xs font-medium bg-background/60 backdrop-blur-sm"
            >
              {tech}
            </Badge>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
