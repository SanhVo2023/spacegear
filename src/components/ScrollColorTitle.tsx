"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";

/**
 * Large section title that fills from faint grey to bright ink as it scrolls
 * up through the viewport — the same word-by-word fill used for the hero
 * statement, scoped to a heading.
 */
export default function ScrollColorTitle({
  title,
  className = "",
}: {
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "end 0.5"],
  });
  const words = title.split(" ");
  return (
    <h2
      ref={ref}
      className={`display text-[clamp(38px,7vw,84px)] leading-[0.95] ${className}`}
    >
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + 1 / words.length;
        return (
          <Word key={i} progress={scrollYProgress} range={[start, end]}>
            {word}
          </Word>
        );
      })}
    </h2>
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
  const color = useTransform(progress, range, ["#3a3b3e", "#e3dbd8"]);
  return (
    <span className="mr-[0.26em] inline-block">
      <motion.span data-scroll-word="" style={{ color }}>{children}</motion.span>
    </span>
  );
}
