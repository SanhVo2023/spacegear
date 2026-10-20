"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Starfield from "@/components/Starfield";
import { ScrollFillText } from "@/components/motion";
import { Container } from "@/components/ui";

// 3D scene is client-only (WebGL) — load without SSR.
const EarthScene = dynamic(() => import("@/components/EarthScene"), {
  ssr: false,
});

const STATEMENT =
  "We run your infrastructure so you can focus on building great products.";

/**
 * Scroll-driven layer. It receives the shared `progress` MotionValue as a PROP
 * and runs its own useTransform — the same pattern the word-fill uses, which
 * keeps the bindings live (parent-level useTransform bindings were getting
 * orphaned across re-renders).
 */
function Choreo({
  progress,
  opacity,
  y,
  scale,
  blur,
  className = "",
  children,
}: {
  progress: MotionValue<number>;
  opacity?: [number[], number[]];
  y?: [number[], number[]];
  scale?: [number[], number[]];
  blur?: [number[], string[]];
  className?: string;
  children?: ReactNode;
}) {
  const o = useTransform(progress, opacity?.[0] ?? [0, 1], opacity?.[1] ?? [1, 1]);
  const ty = useTransform(progress, y?.[0] ?? [0, 1], y?.[1] ?? [0, 0]);
  const sc = useTransform(progress, scale?.[0] ?? [0, 1], scale?.[1] ?? [1, 1]);
  const fl = useTransform(
    progress,
    blur?.[0] ?? [0, 1],
    blur?.[1] ?? ["blur(0px)", "blur(0px)"]
  );
  return (
    <motion.div
      style={{ opacity: o, y: ty, scale: sc, filter: fl }}
      // `transition-none` defeats an inherited `transition: all` that otherwise
      // makes the scroll-driven opacity/filter lag behind the scrubber.
      className={`transition-none ${className}`}
    >
      {children}
    </motion.div>
  );
}

function Stat({
  value,
  unit,
  label,
  sub,
}: {
  value: string;
  unit: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="display text-3xl text-flame">
        {value}
        <span className="align-super text-sm">{unit}</span>
      </span>
      <span className="mt-1">
        <span className="block text-[14px] text-ink">{label}</span>
        <span className="block text-[12px] text-mut-3">{sub}</span>
      </span>
    </div>
  );
}

function HeroCopy() {
  const EASE = [0.44, 0, 0.56, 1] as const;
  const v = (delay: number) => ({
    initial: { opacity: 0, y: 28, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.9, ease: EASE, delay },
  });
  return (
    <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
      <motion.p {...v(0.05)} className="text-[15px] leading-tight">
        <span className="text-mut-2">You innovate,</span>{" "}
        <span className="font-medium text-ink">we automate.</span>
      </motion.p>

      <motion.h1
        {...v(0.15)}
        className="display mx-auto mt-6 max-w-3xl text-[clamp(38px,7.4vw,92px)] text-ink"
      >
        <span className="text-mut-3">— </span>The smarter way to{" "}
        <span className="text-flame">build</span>,{" "}
        <span className="text-flame">run</span>, and{" "}
        <span className="text-flame">scale</span> your business.
      </motion.h1>

      <motion.div
        {...v(0.3)}
        className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:items-center lg:items-start"
      >
        <div>
          <h2 className="text-xl font-medium text-ink">See Platform in action</h2>
          <p className="mx-auto mt-1 max-w-xs text-[13px] text-mut-2">
            Join our guided tour and explore all features live.
          </p>
        </div>
        <a
          href="#contact"
          className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-xl bg-flame px-5 py-3 text-[13px] font-medium text-[#161719] transition-all hover:brightness-110 hover:shadow-[0_10px_30px_-8px_rgba(250,110,67,0.6)]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2 6.5h12M5.5 2v2M10.5 2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Book a Demo
        </a>
      </motion.div>

      <motion.div
        {...v(0.42)}
        className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-10 lg:justify-start"
      >
        <Stat value="97.8" unit="%" label="Uptime" sub="30-day monitoring" />
        <Stat value="+31.2" unit="%" label="Performance" sub="AI optimized bundle" />
      </motion.div>
    </div>
  );
}

export default function OrbitalCinematic() {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const prefersReduced = useReducedMotion();
  // `mounted` gates the upgrade: SSR + first client paint always render the
  // static hero (identical → no hydration mismatch, and three.js is never
  // fetched on mobile). Desktop upgrades to the cinematic after mount.
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const cinematic = mounted && isDesktop && !prefersReduced;

  // Manual scroll scrubber — computed from the section's own rect. Reliable for
  // both .get() (read in the Canvas) and change events (DOM layers), where
  // motion's useScroll proved flaky inside this sticky/pinned layout.
  const progress = useMotionValue(0);
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 0;
      progress.set(p);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [progress, cinematic]);

  // Mobile / reduced-motion: a static cosmic hero — NO 3D globe (the whole
  // three.js bundle is never fetched here since EarthScene only mounts below).
  if (!cinematic) {
    return (
      <section id="home" className="relative overflow-hidden">
        {/* generated galaxy backdrop + legibility gradients */}
        <div className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/galaxy.webp"
            alt=""
            aria-hidden
            className="h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/35 to-bg" />
          <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_75%_0%,rgba(250,110,67,0.18),rgba(22,23,25,0)_60%)]" />
        </div>
        <Starfield className="opacity-50" />

        <Container className="relative flex min-h-[90svh] flex-col justify-center pt-28 pb-20">
          <HeroCopy />
        </Container>

        <Container className="relative pb-24">
          <ScrollFillText text={STATEMENT} className="max-w-3xl" />
        </Container>
      </section>
    );
  }

  return (
    <section ref={outerRef} id="home" className="relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#08080b]">
        {/* the 3D scene supplies the galaxy, sun and earth */}
        <div className="absolute inset-0">
          <EarthScene progress={progress} />
        </div>

        {/* layer 4 — legibility scrim for the statement beat */}
        <Choreo
          progress={progress}
          opacity={[[0.5, 0.62], [0, 0.55]]}
          className="pointer-events-none absolute inset-0 bg-[#0f0f12]"
        />

        {/* layer 5 — hero copy */}
        <Choreo
          progress={progress}
          opacity={[[0, 0.18, 0.34], [1, 1, 0]]}
          y={[[0, 0.34], [0, -60]]}
          blur={[[0, 0.34], ["blur(0px)", "blur(8px)"]]}
          className="pointer-events-none absolute inset-0 flex items-center"
        >
          <Container className="relative">
            <HeroCopy />
          </Container>

          <div className="pointer-events-auto absolute bottom-10 right-8 hidden w-72 items-center justify-between rounded-xl border border-line bg-card/80 px-4 py-3 backdrop-blur lg:flex">
            <div>
              <p className="text-[13px] text-ink">Neural Network</p>
              <p className="font-mono text-[11px] text-mut-3">// Latest Release</p>
            </div>
            <span className="text-flame">→</span>
          </div>
        </Choreo>

        {/* scroll hint */}
        <Choreo
          progress={progress}
          opacity={[[0, 0.12], [1, 0]]}
          className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2"
        >
          <span className="flex items-center gap-2 rounded-full border border-line bg-card/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-2 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-flame pulse-dot" />
            Scroll to explore ↓
          </span>
        </Choreo>

        {/* layer 6 — statement, fills word-by-word over the centered globe */}
        <Choreo
          progress={progress}
          opacity={[[0.5, 0.6], [0, 1]]}
          className="pointer-events-none absolute inset-0 flex items-center"
        >
          <Container className="relative">
            <ScrollFillText
              text={STATEMENT}
              className="max-w-4xl"
              progress={progress}
              range={[0.58, 0.9]}
            />
          </Container>
        </Choreo>
      </div>
    </section>
  );
}
