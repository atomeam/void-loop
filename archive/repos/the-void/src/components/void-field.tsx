import { useEffect, useRef } from "react";
import type { AtmosphereId } from "@/lib/void-types";

const MOTION: Record<AtmosphereId, { vx: number; vy: number; wobble: number; count: number }> = {
  still: { vx: 0.015, vy: 0.03, wobble: 0.15, count: 48 },
  tide: { vx: 0.22, vy: 0.02, wobble: 0.12, count: 64 },
  ember: { vx: 0.03, vy: -0.16, wobble: 0.28, count: 42 },
  gale: { vx: 0.48, vy: 0.06, wobble: 0.55, count: 80 },
  paper: { vx: 0.01, vy: 0.01, wobble: 0.06, count: 28 },
  hollow: { vx: 0.07, vy: 0.07, wobble: 0.8, count: 56 },
};

type Particle = { x: number; y: number; r: number; a: number; p: number };

export function VoidField({
  atmosphere,
  density,
  className,
}: {
  atmosphere: AtmosphereId;
  density: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spec = MOTION[atmosphere];
    const count = Math.round(spec.count * (0.35 + density));
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      const { width, height } = canvas.getBoundingClientRect();
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.4,
        a: Math.random() * 0.45 + 0.12,
        p: Math.random() * Math.PI * 2,
      }));
    };

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      const css = getComputedStyle(document.documentElement);
      const color = css.getPropertyValue("--color-accent").trim() || "#c8ccd4";
      for (const p of particles) {
        if (!reduce) {
          p.p += 0.008 + spec.wobble * 0.01;
          p.x += spec.vx + Math.sin(p.p) * spec.wobble * 0.15;
          p.y += spec.vy + Math.cos(p.p * 0.7) * spec.wobble * 0.1;
          if (p.x < -4) p.x = width + 4;
          if (p.x > width + 4) p.x = -4;
          if (p.y < -4) p.y = height + 4;
          if (p.y > height + 4) p.y = -4;
        }
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.globalAlpha = p.a;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce && running) raf = requestAnimationFrame(draw);
    };

    resize();
    seed();
    draw();
    const onResize = () => {
      resize();
      seed();
      if (reduce) draw();
    };
    window.addEventListener("resize", onResize);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [atmosphere, density]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
