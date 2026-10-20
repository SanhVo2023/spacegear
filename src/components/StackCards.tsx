"use client";

import { Children, type ReactNode } from "react";

/**
 * Sticky "card-stack" curtain. Each child pins (freezes) as it reaches the top
 * offset, and the next card scrolls up and slides over it — leaving a small
 * cascading lip of the cards beneath. Cards must be opaque. Mobile-oriented.
 */
export default function StackCards({
  children,
  top = 92,
  step = 12,
  gap = 96,
  className = "",
}: {
  children: ReactNode;
  /** sticky offset for the first card (px, below the nav) */
  top?: number;
  /** extra offset added per card so earlier cards peek out (px) */
  step?: number;
  /** scroll distance between cards (px) */
  gap?: number;
  className?: string;
}) {
  const items = Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <div
          key={i}
          className="sticky"
          style={{
            top: top + i * step,
            marginBottom: i < items.length - 1 ? gap : 0,
            zIndex: i + 1,
          }}
        >
          <div className="shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.7)]">
            {child}
          </div>
        </div>
      ))}
    </div>
  );
}
