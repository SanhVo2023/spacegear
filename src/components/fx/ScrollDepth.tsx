"use client";

import { motion, useMotionValue, useScroll, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useFx } from "./env";

type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>["offset"];

/**
 * Copies `target`'s scroll progress (Motion `useScroll`, no spring) into `progress`. Rendered only while
 * `useFx()` holds, so phones, tablets, reduced motion and no-JS never subscribe to scrolling for an effect
 * they do not show; it renders nothing and requests frames only while the page scrolls.
 */
export function TrackScroll({ target, progress, offset }: { target: RefObject<HTMLElement | null>; progress: MotionValue<number>; offset: ScrollOffset }) {
  const { scrollYProgress } = useScroll({ target, offset });
  useEffect(() => {
    progress.set(scrollYProgress.get());
    return scrollYProgress.on("change", (value) => progress.set(value));
  }, [scrollYProgress, progress]);
  return null;
}

/**
 * Desktop "stack and scale": as the item leaves through the top of the viewport it lags (drifts down up to
 * `drift` px) and shrinks to `scale`, so the row below slides over it. Scroll-linked transforms only, so
 * no layout box moves, the section keeps its height and a still page requests no frames. The layer is
 * promoted (will-change), so the compositor scales it instead of repainting its images every frame.
 * Fine-pointer desktops only: elsewhere the wrapper has no transform and nothing tracks the scroll.
 */
export default function ScrollDepth({ children, className = "", drift = 96, scale = 0.9 }: { children: ReactNode; className?: string; drift?: number; scale?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useFx();
  const progress = useMotionValue(0);
  const y = useTransform(progress, [0, 1], [0, drift]);
  const s = useTransform(progress, [0, 1], [1, scale]);
  return (
    <motion.div ref={ref} data-depth="" className={className} style={fx ? { y, scale: s, transformOrigin: "50% 0%", willChange: "transform" } : undefined}>
      {fx && <TrackScroll target={ref} progress={progress} offset={["end 0.75", "end 0.1"]} />}
      {children}
    </motion.div>
  );
}
