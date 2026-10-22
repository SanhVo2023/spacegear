"use client";

import { motion, useMotionValue, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useFx } from "./env";
import { TrackScroll } from "./ScrollDepth";

/**
 * Image parallax inside a clipped frame. On fine-pointer desktops the layer drifts from -`amount` to
 * +`amount` of its height as the frame crosses the viewport, scaled up just enough that no edge of the
 * frame ever shows. Transforms only, on a promoted layer (will-change, so scrolling moves it without a
 * repaint): the layer keeps the frame's box, so nothing shifts when the effect switches on after
 * hydration. Elsewhere it fills the frame exactly as before. `className` must position the
 * frame (for example "absolute inset-0").
 */
export default function Parallax({ children, className = "", amount = 0.07 }: { children: ReactNode; className?: string; amount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useFx();
  const progress = useMotionValue(0.5);
  const y = useTransform(progress, [0, 1], [`${-amount * 100}%`, `${amount * 100}%`]);
  return (
    <div ref={ref} data-parallax="" className={`overflow-hidden ${className}`}>
      {fx && <TrackScroll target={ref} progress={progress} offset={["start end", "end start"]} />}
      <motion.div className="absolute inset-0" style={fx ? { y, scale: 1 + 2 * amount + 0.02, willChange: "transform" } : undefined}>
        {children}
      </motion.div>
    </div>
  );
}
