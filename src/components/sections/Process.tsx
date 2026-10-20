"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader, FlameButton } from "@/components/ui";
import { PROCESS_CTA, PROCESS_STEPS, SECTIONS, type ProcessStep } from "@/lib/content";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Counts up from 0 to `to` the first time it scrolls into view. The server
 *  renders the final value, so the number is right without JavaScript. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-12%" });
  const [val, setVal] = useState(to);
  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, to, { duration: 1.1, ease: EASE, onUpdate: (v) => setVal(v) });
    return () => controls.stop();
  }, [inView, reduce, to]);
  return <span ref={ref}>{Math.round(val)}</span>;
}

export function StepCard({ s, i }: { s: ProcessStep; i: number }) {
  return (
    <motion.div
      data-reveal=""
      initial={{ opacity: 0, y: 40, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
      whileHover={{ y: -6 }}
      className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-line bg-card/60 p-7 transition-colors hover:border-flame/50"
    >
      {/* hover glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-flame/0 blur-2xl transition-colors duration-500 group-hover:bg-flame/20" />

      <div className="relative flex items-start justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-flame">{s.step}</span>
          {s.name && <h3 className="display mt-2 text-2xl text-ink">{s.name}</h3>}
        </div>
        <motion.span
          aria-hidden
          className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-bg text-mut-2"
          whileHover={{ rotate: -12, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
        >
          →
        </motion.span>
      </div>

      <p className="relative mt-5 max-w-md text-[14px] leading-relaxed text-mut-2">{s.desc}</p>

      {s.outputs.length > 0 && (
        <div className="relative mt-7 flex items-end justify-between gap-4 border-t border-line-soft pt-5">
          <span className="text-[12px] text-mut-2">{s.outputs.join(" · ")}</span>
          <span className="display shrink-0 text-3xl text-ink-strong">
            <CountUp to={s.outputs.length} />
            <span className="ml-1 text-base text-mut-2">{s.outputs.length === 1 ? "output" : "outputs"}</span>
          </span>
        </div>
      )}
    </motion.div>
  );
}

/** Animated connecting line + step cards. Used on the home page, Approach and service pages. */
export function ProcessSteps({ steps, gridClassName = "md:grid-cols-2 xl:grid-cols-4" }: { steps: ProcessStep[]; gridClassName?: string }) {
  const lineRef = useRef<HTMLDivElement>(null);
  const shown = useInView(lineRef, { once: true, margin: "-20%" });
  const dots = steps.map((_, i) => (steps.length === 1 ? 0 : (i / (steps.length - 1)) * 100));
  return (
    <>
      <div ref={lineRef} className="relative mt-12 hidden h-px md:block">
        <div className="absolute inset-0 bg-line-soft" />
        <motion.div
          data-line=""
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-flame to-flame/40"
          initial={{ width: "0%" }}
          animate={shown ? { width: "100%" } : {}}
          transition={{ duration: 1.4, ease: EASE }}
        />
        {dots.map((pos, i) => (
          <motion.span
            key={i}
            data-dot=""
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame"
            style={{ left: `${pos}%` }}
            initial={{ scale: 0 }}
            animate={shown ? { scale: 1 } : {}}
            transition={{ duration: 0.4, ease: EASE, delay: 0.3 + i * 0.28 }}
          />
        ))}
      </div>

      <div className={`mt-6 grid gap-4 ${gridClassName}`}>
        {steps.map((s, i) => (
          <StepCard key={s.step} s={s} i={i} />
        ))}
      </div>
    </>
  );
}

export default function Process() {
  return (
    <section id="process" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader {...SECTIONS.process} />
        <ProcessSteps steps={PROCESS_STEPS} />

        <Reveal delay={120}>
          <div className="mt-8 flex flex-col gap-5 rounded-3xl border border-line bg-card/40 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-medium text-ink">{PROCESS_CTA.title}</h3>
              <p className="mt-1 text-[14px] text-mut-2">{PROCESS_CTA.text}</p>
            </div>
            <FlameButton href={PROCESS_CTA.href}>{PROCESS_CTA.cta}</FlameButton>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
