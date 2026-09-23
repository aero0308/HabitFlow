import type { Variants } from "framer-motion";

// Shared Framer Motion variants for the landing page.
// All animations respect prefers-reduced-motion automatically via Framer's config.

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

// Stagger container — children animate in sequence
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Default viewport config for useInView
export const viewportOnce = { once: true, margin: "-80px" };

// Floating blob animation (slow infinite loop)
export const blobAnimation: Variants = {
  animate: {
    x: [0, 30, -20, 0],
    y: [0, -20, 30, 0],
    scale: [1, 1.05, 0.98, 1],
    transition: {
      duration: 20,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const blobAnimationAlt: Variants = {
  animate: {
    x: [0, -25, 20, 0],
    y: [0, 25, -15, 0],
    scale: [1, 0.95, 1.08, 1],
    transition: {
      duration: 25,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};
