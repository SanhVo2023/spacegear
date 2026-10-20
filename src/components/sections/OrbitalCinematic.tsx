"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Starfield from "@/components/Starfield";
import { ScrollFillText } from "@/components/motion";
import { Container } from "@/components/ui";
import { HOME, type Stat as StatData } from "@/lib/content";

// 3D scene is client-only (WebGL) — load without SSR.
const EarthScene = dynamic(() => import("@/components/EarthScene"), { ssr: false });

// Desktop, motion allowed, not on a data-saver connection → upgrade to the cinematic.
const QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function eligible() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia(QUERY).matches && !connection?.saveData;
}
// false on the server and during hydration, true afterwards.
const noop = () => () => {};

/**
 * If the scene throws (model/texture loader or runtime error), drop the canvas
 * and keep the poster + copy on screen. WebGL context creation is checked
 * before mounting (R3F creates the renderer outside React's error handling).
 */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * Scroll-driven layer. It receives the shared `progress` MotionValue as a PROP
 * and runs its own useTransform — the same pattern the word-fill uses, which
 * keeps the bindings live.
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
  const fl = useTransform(progress, blur?.[0] ?? [0, 1], blur?.[1] ?? ["blur(0px)", "blur(0px)"]);
  return (
    <motion.div style={{ opacity: o, y: ty, scale: sc, filter: fl }} className={`transition-none ${className}`}>
      {children}
    </motion.div>
  );
}

function Stat({ value, unit, label, sub }: StatData) {
  return (
    <div className="flex items-start gap-4">
      <span className="display text-3xl text-flame">
        {value}
        {unit && <span className="align-super text-sm">{unit}</span>}
      </span>
      <span className="mt-1">
        <span className="block text-[14px] text-ink">{label}</span>
        <span className="block text-[12px] text-mut-2">{sub}</span>
      </span>
    </div>
  );
}

function HeroCopy() {
  const EASE = [0.44, 0, 0.56, 1] as const;
  // Same markup for every visitor (static export): reduced motion is handled by
  // MotionProvider (skipAnimations) and the reduced-motion end-state CSS.
  const v = (delay: number) => ({
    initial: { opacity: 0, y: 28, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.9, ease: EASE, delay },
  });
  const [first, second, third] = HOME.headline.verbs;
  return (
    <div className="hero-copy mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
      <motion.p data-reveal="" {...v(0.05)} className="text-[15px] leading-tight">
        <span className="text-mut-2">{HOME.eyebrow.muted}</span>{" "}
        <span className="font-medium text-ink">{HOME.eyebrow.strong}</span>
      </motion.p>

      <motion.h1 data-reveal="" {...v(0.15)} className="display mx-auto mt-6 max-w-3xl text-[clamp(38px,7.4vw,92px)] text-ink">
        <span className="text-mut-3">— </span>
        {HOME.headline.lead} <span className="text-flame">{first}</span>,{" "}
        <span className="text-flame">{second}</span>, and{" "}
        <span className="text-flame">{third}</span> {HOME.headline.tail}
      </motion.h1>

      <motion.div data-reveal="" {...v(0.3)} className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:items-center lg:items-start">
        <div>
          <h2 className="text-xl font-medium text-ink">{HOME.pitch.title}</h2>
          <p className="mx-auto mt-1 max-w-xs text-[13px] text-mut-2">{HOME.pitch.text}</p>
        </div>
        <Link
          prefetch={false}
          href={HOME.cta.href}
          className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-xl bg-flame px-5 py-3 text-[13px] font-medium text-[#161719] transition-all hover:brightness-110 hover:shadow-[0_10px_30px_-8px_rgba(250,110,67,0.6)]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2 6.5h12M5.5 2v2M10.5 2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {HOME.cta.label}
        </Link>
      </motion.div>

      <motion.div data-reveal="" {...v(0.42)} className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-10 lg:justify-start">
        {HOME.stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </motion.div>
    </div>
  );
}

export default function OrbitalCinematic() {
  const outerRef = useRef<HTMLElement | null>(null);
  const cinematic = useSyncExternalStore(subscribe, eligible, () => false);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const progress = useMotionValue(0);

  // Mount the WebGL scene when the browser is idle, after the copy has painted,
  // and only while the hero is on screen (a reload mid-page fetches nothing).
  useEffect(() => {
    if (!cinematic || !active || ready) return;
    const enable = () => {
      const gl = document.createElement("canvas").getContext("webgl2");
      if (!gl) return; // keep the poster; skip the 6.3 MB model
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      setReady(true);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 0);
    return () => clearTimeout(timer);
  }, [cinematic, active, ready]);

  // Manual scroll scrubber from the section's own rect; pause rendering offscreen.
  useEffect(() => {
    const el = outerRef.current;
    if (!el || !cinematic) return;
    let frame = 0;
    let visible = true;
    let copyHidden = false;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - window.innerHeight)));
      progress.set(p);
      // Once the copy has faded, its links stop taking clicks (see globals.css).
      if (p > 0.3 !== copyHidden) {
        copyHidden = p > 0.3;
        el.toggleAttribute("data-copy-hidden", copyHidden);
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const visibility = () => setActive(visible && !document.hidden);
    // The copy fades out as the hero scrolls, but its links stay focusable.
    // Keyboard focus entering them scrolls back to the opening frame.
    const reveal = () => {
      if (progress.get() > 0.15)
        window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top, behavior: "instant" });
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibility(); });
    observer.observe(el);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", visibility);
    el.addEventListener("focusin", reveal);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", visibility);
      el.removeEventListener("focusin", reveal);
      el.removeAttribute("data-copy-hidden");
      progress.set(0);
    };
  }, [cinematic, progress]);

  // Mobile / reduced motion / no JS / first paint: the static cosmic hero (no three.js fetched).
  // Until hydration, eligible desktops reserve the cinematic's 300vh (.hero-reserve in
  // globals.css) so deep links and reloads land where they will stay.
  if (!cinematic) {
    return (
      <section id="home" className={hydrated ? "relative" : "hero-reserve relative"}>
        {/* the cinematic's poster, fetched early on the desktops that will show it */}
        <link rel="preload" as="image" href="/images/hero-poster.webp" media={QUERY} />
        <div className="relative overflow-hidden">
          <div className="hero-backdrop pointer-events-none absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/galaxy.webp" alt="" aria-hidden width={3840} height={1629} className="h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/35 to-bg" />
            <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_75%_0%,rgba(250,110,67,0.18),rgba(22,23,25,0)_60%)]" />
          </div>
          <Starfield className="opacity-50" />

          <Container className="relative flex min-h-[90svh] flex-col justify-center pt-28 pb-20">
            <HeroCopy />
          </Container>

          <Container className="relative pb-24">
            <ScrollFillText text={HOME.statement} className="max-w-3xl" />
          </Container>
        </div>
      </section>
    );
  }

  return (
    <section ref={outerRef} id="home" className="relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#08080b]">
        {/* poster: loading state and WebGL fallback (scripts/capture-hero-poster.mjs) */}
        <div className="hero-backdrop pointer-events-none absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hero-poster.webp" alt="" width={1440} height={900} className="h-full w-full object-cover" />
        </div>

        {/* the 3D scene supplies the galaxy, sun and earth */}
        {ready && (
          <div className="hero-scene absolute inset-0" aria-hidden>
            <SceneBoundary>
              <EarthScene progress={progress} active={active} />
            </SceneBoundary>
          </div>
        )}

        {/* legibility scrim for the statement beat */}
        <Choreo progress={progress} opacity={[[0.5, 0.62], [0, 0.55]]} className="pointer-events-none absolute inset-0 bg-[#0f0f12]" />

        {/* hero copy */}
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

          <Link
            prefetch={false}
            href={HOME.corner.href}
            className="pointer-events-auto absolute bottom-10 right-8 hidden w-72 items-center justify-between rounded-xl border border-line bg-card/80 px-4 py-3 backdrop-blur lg:flex"
          >
            <div>
              <p className="text-[13px] text-ink">{HOME.corner.title}</p>
              <p className="font-mono text-[11px] text-mut-3">{HOME.corner.sub}</p>
            </div>
            <span aria-hidden className="text-flame">→</span>
          </Link>
        </Choreo>

        {/* scroll hint */}
        <Choreo progress={progress} opacity={[[0, 0.12], [1, 0]]} className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-2 rounded-full border border-line bg-card/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-2 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-flame pulse-dot" />
            {HOME.scrollHint}
          </span>
        </Choreo>

        {/* statement, fills word-by-word over the centred globe */}
        <Choreo progress={progress} opacity={[[0.5, 0.6], [0, 1]]} className="pointer-events-none absolute inset-0 flex items-center">
          <Container className="relative">
            <ScrollFillText text={HOME.statement} className="max-w-4xl" progress={progress} range={[0.58, 0.9]} />
          </Container>
        </Choreo>
      </div>
    </section>
  );
}
