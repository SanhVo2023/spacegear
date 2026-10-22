"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Honour the visitor's reduced-motion setting for every Motion animation.
 * Components render the same markup either way (the static HTML is built
 * without the setting); under reduced motion `skipAnimations` makes every
 * transition jump straight to its end value, and the reduced-motion block in
 * globals.css shows entrance end states from first paint.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <MotionConfig reducedMotion="user" skipAnimations={reduce ?? false}>
      {children}
    </MotionConfig>
  );
}
