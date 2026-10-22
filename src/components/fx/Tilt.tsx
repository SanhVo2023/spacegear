"use client";

import { motion, useSpring } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useFx } from "./env";
import { tiltAngles } from "./math";
import { useSpotlight } from "./Spotlight";

const SPRING = { stiffness: 220, damping: 20, mass: 0.6 };

/**
 * Subtle 3D tilt toward the pointer (at most `max` degrees), with an optional warm spotlight that follows it.
 * Fine-pointer desktops only: elsewhere the wrapper has no transform. The spotlight layer is decorative.
 * A transform never moves layout, so the tilt shifts nothing around it; the listeners never block an event.
 */
export default function Tilt({ children, className = "", max = 4, spotlight = false }: { children: ReactNode; className?: string; max?: number; spotlight?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useFx();
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  useSpotlight(ref, fx && spotlight);

  useEffect(() => {
    const el = ref.current;
    if (!fx || !el) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const angles = tiltAngles(event.clientX - r.left, event.clientY - r.top, r.width, r.height, max);
      rotateX.set(angles.rx);
      rotateY.set(angles.ry);
    };
    const leave = () => {
      rotateX.set(0);
      rotateY.set(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      // Settle at once: no spring keeps requesting frames after the effect is gone.
      rotateX.jump(0);
      rotateY.jump(0);
    };
  }, [fx, max, rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      data-tilt=""
      data-spotlight={spotlight ? "" : undefined}
      className={`relative ${className}`}
      style={fx ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
    >
      {children}
      {spotlight && <span aria-hidden className="fx-spotlight" />}
    </motion.div>
  );
}
