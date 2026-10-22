"use client";

import { useEffect, useRef } from "react";
import { useFx } from "@/components/fx/env";
import { cellAt, ringDistance } from "@/components/fx/math";

/**
 * Grid of dots with a diagonal wave that sweeps a bright pulse through the
 * formation — they appear to constantly shift and move. Driven by the
 * `.dot-pulse` keyframes in globals.css, so it costs no JavaScript frames
 * and stops under prefers-reduced-motion. With `ripple`, on fine-pointer
 * desktops, moving over the field sends a ring of swelling dots out from
 * the pointer (Web Animations added on top of the pulse; no frames requested).
 */
export default function DotField({
  cols = 5,
  rows = 5,
  color = "#fa6e43",
  className = "",
  dotClassName = "h-1.5 w-1.5",
  ripple = false,
}: {
  cols?: number;
  rows?: number;
  color?: string;
  className?: string;
  dotClassName?: string;
  ripple?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useFx();

  useEffect(() => {
    const field = ref.current;
    if (!ripple || !fx || !field) return;
    let last = -1;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const r = field.getBoundingClientRect();
      const { row, col } = cellAt(event.clientX - r.left, event.clientY - r.top, r.width, r.height, cols, rows);
      const index = row * cols + col;
      if (index === last) return;
      last = index;
      field.querySelectorAll<HTMLElement>(".dot-pulse").forEach((dot, i) => {
        const ring = ringDistance(row, col, Math.floor(i / cols), i % cols);
        dot.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.9)" }, { transform: "scale(1)" }],
          { duration: 520, delay: ring * 70, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", composite: "add" },
        );
      });
    };
    const leave = () => {
      last = -1;
    };
    field.addEventListener("pointermove", move);
    field.addEventListener("pointerleave", leave);
    return () => {
      field.removeEventListener("pointermove", move);
      field.removeEventListener("pointerleave", leave);
    };
  }, [ripple, fx, cols, rows]);

  const cells = Array.from({ length: rows * cols }, (_, i) => ({
    r: Math.floor(i / cols),
    c: i % cols,
  }));
  return (
    <div
      ref={ref}
      aria-hidden
      data-ripple={ripple ? "" : undefined}
      className={`grid place-items-center gap-y-3 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {cells.map(({ r, c }, i) => (
        <span
          key={i}
          className={`dot-pulse rounded-full ${dotClassName}`}
          style={{
            backgroundColor: color,
            animationDelay: `${((r + c) % (cols + 1)) * 0.22}s`,
          }}
        />
      ))}
    </div>
  );
}
