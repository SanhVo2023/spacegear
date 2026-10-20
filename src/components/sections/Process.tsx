"use client";

import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader, FlameButton } from "@/components/ui";

const STEPS = [
  {
    step: "Step 1",
    name: "Smart Connect",
    desc: "Platform’s AI analyzes your tech stack and swiftly configures your ideal environment. One connection is all it takes to set everything up following industry best practices.",
    metric: 30,
    unit: "sec",
    metricLabel: "Average connection time",
  },
  {
    step: "Step 2",
    name: "Auto Configure",
    desc: "Best-practice defaults are provisioned automatically, tuned to your workloads with zero manual setup.",
    metric: 12,
    unit: "sec",
    metricLabel: "Average configuration time",
  },
  {
    step: "Step 3",
    name: "Live Optimize",
    desc: "Continuous, real-time optimization keeps performance high and costs low as your traffic shifts.",
    metric: 3,
    unit: "ms",
    metricLabel: "Average response time",
  },
  {
    step: "Step 4",
    name: "Auto Guard",
    desc: "Adaptive 24/7 security watches every layer and neutralizes threats before they reach you.",
    metric: 10,
    unit: "sec",
    metricLabel: "Average threat detection",
  },
];

/** Counts up from 0 to `to` the first time it scrolls into view. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12%" });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, to]);
  return <span ref={ref}>{Math.round(val)}</span>;
}

const EASE = [0.16, 1, 0.3, 1] as const;

function StepCard({ s, i }: { s: (typeof STEPS)[number]; i: number }) {
  return (
    <motion.div
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
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-flame">
            {s.step}
          </span>
          <h3 className="display mt-2 text-2xl text-ink">{s.name}</h3>
        </div>
        <motion.span
          className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-bg text-mut-2"
          whileHover={{ rotate: -12, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
        >
          →
        </motion.span>
      </div>

      <p className="relative mt-5 max-w-md text-[14px] leading-relaxed text-mut-2">
        {s.desc}
      </p>

      <div className="relative mt-7 flex items-end justify-between border-t border-line-soft pt-5">
        <span className="text-[12px] text-mut-3">{s.metricLabel}</span>
        <span className="display text-3xl text-ink-strong">
          <CountUp to={s.metric} />
          <span className="ml-1 text-base text-mut-2">{s.unit}</span>
        </span>
      </div>
    </motion.div>
  );
}

export default function Process() {
  const lineRef = useRef<HTMLDivElement>(null);
  const lineInView = useInView(lineRef, { once: true, margin: "-20%" });

  return (
    <section id="process" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader
          title="Our Process"
          index="003"
          heading="Optimized processes through simplified workflows."
          description="Seamless operations and processes from start to finish."
        />

        {/* animated connecting progress line */}
        <div ref={lineRef} className="relative mt-12 hidden h-px md:block">
          <div className="absolute inset-0 bg-line-soft" />
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-flame to-flame/40"
            initial={{ width: "0%" }}
            animate={lineInView ? { width: "100%" } : {}}
            transition={{ duration: 1.4, ease: EASE }}
          />
          {[0, 33.3, 66.6, 100].map((pos, i) => (
            <motion.span
              key={i}
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame"
              style={{ left: `${pos}%` }}
              initial={{ scale: 0 }}
              animate={lineInView ? { scale: 1 } : {}}
              transition={{ duration: 0.4, ease: EASE, delay: 0.3 + i * 0.28 }}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <StepCard key={s.step} s={s} i={i} />
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-8 flex flex-col gap-5 rounded-3xl border border-line bg-card/40 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-medium text-ink">
                Book a demo to see this process in action.
              </h3>
              <p className="mt-1 text-[14px] text-mut-2">
                Questions about our process? We’re here to help.
              </p>
            </div>
            <FlameButton href="#contact">Book a Demo</FlameButton>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
