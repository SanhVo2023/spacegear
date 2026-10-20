"use client";

import type { MotionValue } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Ambient particle field that mimics the reference's drifting starfield.
 * Canvas-based, low-cost, respects reduced-motion.
 *
 * Optional `intensity` MotionValue accelerates the drift and adds radial
 * streaks (a subtle "warp") — used to sell forward motion during the globe zoom.
 */
export default function Starfield({
  density = 0.00018,
  className = "",
  intensity,
}: {
  density?: number;
  className?: string;
  intensity?: MotionValue<number>;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  // Keep the latest MotionValue without re-running the effect.
  const intensityRef = useRef<MotionValue<number> | undefined>(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars: {
      x: number;
      y: number;
      z: number;
      r: number;
      tw: number;
      tp: number;
    }[] = [];
    let raf = 0;
    let t = 0;

    const parent = canvas.parentElement as HTMLElement;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor(w * h * density);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.7 + 0.3,
        r: Math.random() * 1.3 + 0.2,
        tw: Math.random() * Math.PI * 2,
        tp: Math.random() * 0.02 + 0.004,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const warp = intensityRef.current?.get() ?? 1;
      const cx = w / 2;
      const cy = h / 2;
      for (const s of stars) {
        s.tw += s.tp;
        const a = (0.35 + Math.sin(s.tw) * 0.35) * s.z;
        // horizontal drift, accelerated by the warp factor
        s.x -= s.z * 0.08 * warp;
        if (s.x < -2) s.x = w + 2;
        if (warp > 2) {
          // radial streak away from center to sell forward motion
          const dx = s.x - cx;
          const dy = s.y - cy;
          const d = Math.hypot(dx, dy) || 1;
          const len = Math.min((warp - 1) * s.z * 4, 24);
          ctx.beginPath();
          ctx.strokeStyle = `rgba(235,225,220,${(a * 0.7).toFixed(3)})`;
          ctx.lineWidth = s.r;
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + (dx / d) * len, s.y + (dy / d) * len);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(235,225,220,${a.toFixed(3)})`;
          ctx.fill();
        }
      }
      t += 1;
      raf = requestAnimationFrame(draw);
    };

    resize();
    if (reduce) {
      draw();
    } else {
      raf = requestAnimationFrame(draw);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [density]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
