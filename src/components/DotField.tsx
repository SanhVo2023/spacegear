"use client";

import { motion } from "motion/react";

/**
 * Grid of dots with a diagonal wave that sweeps a bright pulse through the
 * formation — they appear to constantly shift and move.
 */
export default function DotField({
  cols = 5,
  rows = 5,
  color = "#fa6e43",
  className = "",
  dotClassName = "h-1.5 w-1.5",
}: {
  cols?: number;
  rows?: number;
  color?: string;
  className?: string;
  dotClassName?: string;
}) {
  const cells = Array.from({ length: rows * cols }, (_, i) => ({
    r: Math.floor(i / cols),
    c: i % cols,
  }));
  return (
    <div
      className={`grid place-items-center gap-y-3 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {cells.map(({ r, c }, i) => (
        <motion.span
          key={i}
          className={`rounded-full ${dotClassName}`}
          style={{ backgroundColor: color }}
          initial={{ opacity: 0.18 }}
          animate={{ opacity: [0.18, 1, 0.18], scale: [0.85, 1.25, 0.85] }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: ((r + c) % (cols + 1)) * 0.22,
          }}
        />
      ))}
    </div>
  );
}
