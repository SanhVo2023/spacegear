"use client";

import type { CSSProperties, RefObject } from "react";
import { useFx } from "./env";
import { useInViewFlag } from "./useInViewFlag";

/** Whether a title splits into characters (fine-pointer desktop, after hydration), plus the in-view flag that
 *  starts the rise. The server, no-JS, touch and reduced-motion visitors keep whole words. */
export function useSplitReveal(ref: RefObject<HTMLElement | null>): boolean {
  const split = useFx();
  useInViewFlag(ref, { enabled: split, amount: 0.35 });
  return split;
}

/** One word's characters, each rising out of the word's mask from blur to sharp (globals.css, FX block).
 *  Render it inside an aria-hidden word, under a heading that carries the full aria-label. The characters are
 *  graphemes (split.ts), so accents, emoji and flags stay whole, whatever the CMS title. */
export function SplitWordChars({ chars, offset }: { chars: string[]; offset: number }) {
  return (
    <span className="fx-split-mask">
      {chars.map((char, j) => (
        <span key={j} data-split-char="" className="fx-split-char" style={{ "--i": offset + j } as CSSProperties}>
          {char}
        </span>
      ))}
    </span>
  );
}
