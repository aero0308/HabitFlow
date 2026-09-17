"use client";

import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  color: string;
  shape: "rect" | "circle";
  size: number;
  life: number;
}

const COLORS = ["#10b981", "#0d9488", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9", "#ef4444", "#84cc16"];

/**
 * Lightweight canvas confetti. Call `fire()` to launch a burst from the top center.
 * Renders nothing visible until fired. Auto-cleans up when all particles expire.
 */
export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFireRef = useRef(0);
  // Keep animate in a ref so it can self-reference without re-creating
  const animateRef = useRef<() => void>(() => {});

  const ensureCanvas = useCallback(() => {
    if (canvasRef.current) return canvasRef.current;
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:9999;width:100vw;height:100vh;";
    document.body.appendChild(canvas);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvasRef.current = canvas;
    return canvas;
  }, []);

  // Define the animate loop once (reads refs, no closure deps)
  useEffect(() => {
    animateRef.current = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        rafRef.current = null;
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gravity = 0.18;
      const drag = 0.992;
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= drag;
        p.vy = p.vy * drag + gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        p.life -= 0.008;

        if (p.life <= 0 || p.y > canvas.height + 40) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (particles.length > 0) {
        rafRef.current = requestAnimationFrame(() => animateRef.current());
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = null;
      }
    };
  }, []);

  const fire = useCallback(
    (opts?: { count?: number; originX?: number; originY?: number }) => {
      const canvas = ensureCanvas();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = Date.now();
      if (now - lastFireRef.current < 200) return;
      lastFireRef.current = now;

      const count = opts?.count ?? 140;
      const ox = opts?.originX ?? canvas.width / 2;
      const oy = opts?.originY ?? 80;

      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 4 + Math.random() * 8;
        newParticles.push({
          x: ox + (Math.random() - 0.5) * 60,
          y: oy,
          vx: Math.cos(angle - Math.PI / 2) * speed * (0.5 + Math.random()),
          vy: Math.sin(angle - Math.PI / 2) * speed - Math.random() * 4 - 2,
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: Math.random() > 0.5 ? "rect" : "circle",
          size: 6 + Math.random() * 6,
          life: 1,
        });
      }
      particlesRef.current.push(...newParticles);

      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => animateRef.current());
      }
    },
    [ensureCanvas],
  );

  // Handle resize
  useEffect(() => {
    function onResize() {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
      canvasRef.current = null;
    };
  }, []);

  return { fire };
}
