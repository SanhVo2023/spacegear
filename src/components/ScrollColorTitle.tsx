"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { SplitWordChars, useSplitReveal } from "@/components/fx/SplitReveal";
import { charOffsets, splitWords } from "@/components/fx/split";

/**
 * Large section title that fills from faint grey to bright ink as it scrolls up through the viewport —
 * the same word-by-word fill used for the hero statement, scoped to a heading. On fine-pointer desktops
 * each word's characters also rise out of a mask when the title enters (SplitReveal); the heading's
 * aria-label keeps the whole title for assistive technology. Any title works, including CMS copy with
 * line breaks, accents or emoji: whitespace runs become single word breaks.
 */
export default function ScrollColorTitle({
  title,
  className = "",
}: {
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const split = useSplitReveal(ref);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "end 0.5"],
  });
  const words = splitWords(title);
  const offsets = charOffsets(words);
  const count = offsets.length ? offsets[offsets.length - 1] + words[words.length - 1].chars.length : 0;
  return (
    <h2
      ref={ref}
      aria-label={words.map((word) => word.text).join(" ")}
      data-split-title=""
      className={`display text-[clamp(38px,7vw,84px)] leading-[0.95] ${className}`}
      style={split ? ({ "--n": count } as CSSProperties) : undefined}
    >
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + 1 / words.length;
        return (
          <Word key={i} progress={scrollYProgress} range={[start, end]} split={split}>
            {split ? <SplitWordChars chars={word.chars} offset={offsets[i]} /> : word.text}
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
  split,
}: {
  children: ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
  split: boolean;
}) {
  const color = useTransform(progress, range, ["#3a3b3e", "#e3dbd8"]);
  return (
    <span className="mr-[0.26em] inline-block" aria-hidden={split || undefined}>
      <motion.span data-scroll-word="" style={{ color }}>{children}</motion.span>
    </span>
  );
}
