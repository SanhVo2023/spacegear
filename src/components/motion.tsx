"use client";

import {
  motion,
  useScroll,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "motion/react";
import { useRef, type ReactNode } from "react";

/** Framer's signature appear easing + timing for enter animations. */
const EASE = [0.44, 0, 0.56, 1] as const;
const FILL_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Appear: fade + translateY (+ optional blur), fired once on scroll-in.
 * Mirrors the reference's per-element appear effect. The markup never
 * branches on reduced motion (the static export is rendered without it, so a
 * branch would not survive hydration). Instead `data-reveal` carries the end
 * state: the no-JS stylesheet and the reduced-motion block in globals.css
 * show it from first paint, and MotionProvider's `skipAnimations` makes any
 * later transition instant.
 */
export function Appear({
  children,
  delay = 0,
  y = 40,
  blur = true,
  className = "",
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  blur?: boolean;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y, filter: blur ? "blur(6px)" : "blur(0px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount: 0.25, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger container — children should be <AppearItem>. */
export function AppearGroup({
  children,
  className = "",
  stagger = 0.09,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function AppearItem({
  children,
  className = "",
  y = 34,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      data-reveal=""
      className={className}
      variants={{
        hidden: { opacity: 0, y, filter: "blur(6px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.75, ease: EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Horizontal progress fill that grows into view (final width without JS or motion). */
export function FillBar({
  value,
  className = "",
  duration = 1.1,
  delay = 0,
}: {
  value: number;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  const target = `${value}%`;
  return (
    <motion.div
      data-fill=""
      className={className}
      style={{ "--fill": target } as MotionStyle}
      initial={{ width: 0 }}
      whileInView={{ width: target }}
      viewport={{ once: true }}
      transition={{ duration, ease: FILL_EASE, delay }}
    />
  );
}

/** Vertical bar that grows into view (final height without JS or motion). */
export function FillColumn({
  value,
  className = "",
  duration = 0.8,
  delay = 0,
}: {
  value: number;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  const target = `${value}%`;
  return (
    <motion.div
      data-fill-h=""
      className={className}
      style={{ "--fill": target } as MotionStyle}
      initial={{ height: 0 }}
      whileInView={{ height: target }}
      viewport={{ once: true }}
      transition={{ duration, ease: FILL_EASE, delay }}
    />
  );
}

/**
 * ScrollFillText — the reference's hallmark statement effect.
 * Words illuminate from muted → bright sequentially as the user scrolls
 * through a tall pinned region.
 */
export function ScrollFillText({
  text,
  className = "",
  progress,
  range = [0, 1],
}: {
  text: string;
  className?: string;
  /** When provided, the fill is driven by this external progress instead of an
   *  internal useScroll — lets a parent share one scroll scrubber. */
  progress?: MotionValue<number>;
  /** Sub-window of the external progress over which the fill completes. */
  range?: [number, number];
}) {
  if (progress) {
    return (
      <ScrollFillInner
        text={text}
        className={className}
        progress={progress}
        range={range}
      />
    );
  }
  return <ScrollFillSelf text={text} className={className} />;
}

/** Internal-scroll variant (original behavior) for standalone usage. */
function ScrollFillSelf({ text, className }: { text: string; className: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.4"],
  });
  return (
    <div ref={ref} className={className}>
      <ScrollFillInner text={text} progress={scrollYProgress} range={[0, 1]} />
    </div>
  );
}

/** Renders the words; maps each word's slot INTO the supplied range window. */
function ScrollFillInner({
  text,
  className = "",
  progress,
  range,
}: {
  text: string;
  className?: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const words = text.split(" ");
  const [lo, hi] = range;
  const span = hi - lo;
  return (
    <p
      className={`display text-[clamp(34px,7vw,86px)] leading-[0.98] ${className}`}
    >
      {words.map((word, i) => {
        const start = lo + span * (i / words.length);
        const end = lo + span * ((i + 1) / words.length);
        return (
          <Word key={i} progress={progress} range={[start, end]}>
            {word}
          </Word>
        );
      })}
    </p>
  );
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  const color = useTransform(progress, range, ["#3a3b3e", "#e3dbd8"]);
  return (
    <span className="relative mr-[0.22em] inline-block">
      <motion.span data-scroll-word="" style={{ opacity, color }}>{children}</motion.span>
    </span>
  );
}
