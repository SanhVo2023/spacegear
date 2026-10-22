"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useFx } from "./env";
import { magnetOffset } from "./math";

const SPRING = { stiffness: 260, damping: 18, mass: 0.5 };
const MotionLink = motion.create(Link);

/**
 * Magnetic pull for buttons and pills. While a mouse is over the element it leans toward the pointer
 * (spring, at most `max` px) and sets --mx/--my (-1..1) so an inner [data-magnetic-glyph] can nudge
 * further. Fine-pointer desktops only; everywhere else the element never moves. It only listens: it never
 * calls preventDefault or captures the pointer, so clicks, drags and focus behave as before.
 */
export function useMagnetic<T extends HTMLElement>(max = 10) {
  const ref = useRef<T>(null);
  const fx = useFx();
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const x = useSpring(targetX, SPRING);
  const y = useSpring(targetY, SPRING);

  useEffect(() => {
    const el = ref.current;
    if (!fx || !el) return;
    let measured = false;
    let cx = 0, cy = 0, w = 1, h = 1;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // The resting box: take the current pull back out.
      cx = r.left + r.width / 2 - x.get();
      cy = r.top + r.height / 2 - y.get();
      w = r.width;
      h = r.height;
      measured = true;
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") measure();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (!measured) measure();
      const pull = magnetOffset(event.clientX - cx, event.clientY - cy, w, h, max);
      targetX.set(pull.x);
      targetY.set(pull.y);
      el.style.setProperty("--mx", pull.nx.toFixed(3));
      el.style.setProperty("--my", pull.ny.toFixed(3));
    };
    const leave = () => {
      measured = false;
      targetX.set(0);
      targetY.set(0);
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    };
    // A scroll (a wheel glide with the pointer resting on the button) moves the button under the pointer:
    // the next move measures it again instead of pulling toward where it used to be.
    const stale = () => {
      measured = false;
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", stale, { passive: true });
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", stale);
      leave();
      // Settle at once: no spring keeps requesting frames after the effect is gone.
      x.jump(0);
      y.jump(0);
    };
  }, [fx, max, targetX, targetY, x, y]);

  return { ref, x, y };
}

/** A next/link that is itself magnetic (no wrapper, so classes such as w-full keep working). */
export function MagneticLink({ href, className = "", children, max = 10 }: { href: string; className?: string; children: ReactNode; max?: number }) {
  const { ref, x, y } = useMagnetic<HTMLAnchorElement>(max);
  return (
    <MotionLink ref={ref} prefetch={false} href={href} data-magnetic="" className={className} style={{ x, y }}>
      {children}
    </MotionLink>
  );
}
