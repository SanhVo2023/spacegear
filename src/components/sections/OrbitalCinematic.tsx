"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";
import { Component, Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { preload } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import Starfield from "@/components/Starfield";
import { ScrollFillText } from "@/components/motion";
import { Container } from "@/components/ui";
import { hasWebGL2, readDeviceEnv } from "@/components/globe/device";
import { getIntroPhase, getServerIntroPhase, INTRO_CHUNK_SHARE, introStore, type IntroPhase } from "@/components/globe/intro-store";
import { chooseHeroMode, type GlobeTier } from "@/components/globe/tiers";
import { HOME, type Stat as StatData } from "@/lib/content";

// 3D scene is client-only (WebGL) — load without SSR. Its code chunk fills the first INTRO_CHUNK_SHARE of
// the intro counter, so the count moves before the textures start; their bytes fill the rest (EarthScene.tsx).
const EarthScene = dynamic(
  () =>
    import("@/components/EarthScene").then((scene) => {
      introStore.setProgress(INTRO_CHUNK_SHARE);
      return scene;
    }),
  { ssr: false },
);

// Desktop, motion allowed, not on a data-saver connection → upgrade to the cinematic.
const QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
// Everyone else keeps the static hero, whose galaxy backdrop is the mobile LCP.
const STATIC_QUERY = `not all and ${QUERY}`;
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
 * If the scene throws (texture loader, shader or runtime error), drop the canvas
 * and keep the poster + copy on screen. WebGL2 context creation is checked
 * before mounting (R3F creates the renderer outside React's error handling).
 */
class SceneBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * The cinematic hero's WebGL layer. It exists only in the cinematic branch, so leaving that branch
 * (a resize below 1024 px, reduced motion turned on) discards its state, and a return mounts a fresh
 * scene that fades in over the poster again.
 */
function HeroScene({ progress, active }: { progress: MotionValue<number>; active: boolean }) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [globe, setGlobe] = useState<"idle" | "ready" | "failed">("idle");
  // The first frame shows the 2k set; capable desktops swap in the 4k set after the intro (EarthScene).
  const [tier, setTier] = useState<GlobeTier>("2k");
  // Set by a failure, which is final for the tier. The scene is a separate React root (R3F), so a context
  // lost in the moment between the 4k swap and its commit could otherwise report "4k" after the reset.
  const failed = useRef(false);
  // A failure also ends a running intro at once (its counter would otherwise wait for the cap). The poster
  // shows again, so the hero no longer reports the 4k tier.
  const fail = () => {
    failed.current = true;
    setGlobe("failed");
    setTier("2k");
    introStore.fail();
  };
  const onTier = (next: GlobeTier) => {
    if (!failed.current) setTier(next);
  };

  // Mount the WebGL scene at once while the intro covers the page (its loading drives the counter);
  // otherwise when the browser is idle, after the copy has painted. Only while the hero is on screen
  // (a reload mid-page fetches nothing).
  useEffect(() => {
    if (!active || ready || globe === "failed") return;
    const enable = () => {
      if (!hasWebGL2()) {
        introStore.fail(); // keep the poster; fetch no textures
        return;
      }
      setReady(true);
    };
    if (introStore.get().phase === "loading") {
      const timer = window.setTimeout(enable, 0);
      return () => window.clearTimeout(timer);
    }
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 0);
    return () => clearTimeout(timer);
  }, [active, ready, globe]);

  // The canvas fades in over the poster once its first textured frame has rendered (globals.css).
  // From then on a mouse or pen drag spins it, and Part 2's cursor shows its "Drag" label.
  const live = globe === "ready";
  return (
    <div ref={sceneRef} className="hero-scene absolute inset-0" data-globe={globe} data-globe-tier={tier} data-cursor={live ? "Drag" : undefined} aria-hidden>
      {ready && globe !== "failed" && (
        <SceneBoundary onError={fail}>
          {/* A failure is terminal: a first frame that lands after a loss never revives the scene. */}
          <EarthScene
            variant="cinematic"
            progress={progress}
            active={active}
            dragTarget={live ? sceneRef : undefined}
            onReady={() => setGlobe((g) => (g === "failed" ? g : "ready"))}
            onTier={onTier}
            onLost={fail}
          />
        </SceneBoundary>
      )}
    </div>
  );
}

/**
 * The phone and tablet globe: a light 1k scene behind the statement (EarthScene's "mobile" variant) on
 * devices that chooseHeroMode() allows after idle (WebGL2, deviceMemory ≥ 4 or unknown, no Save-Data,
 * motion allowed); everyone else keeps the galaxy and fetches nothing. Like HeroScene it exists only in
 * its branch (the static hero), so crossing 1024 px discards it and a return mounts a fresh one. It
 * renders nothing until the device qualifies, so the static markup and first paint stay as they were.
 * A failure (a lost context, a shader or loader error) is final: the canvas goes and the galaxy stays.
 */
function MobileScene() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [globe, setGlobe] = useState<"idle" | "ready" | "failed">("idle");
  const [active, setActive] = useState(true);
  const fail = () => setGlobe("failed");

  // When the browser is idle, after the copy and the galaxy have painted.
  useEffect(() => {
    const enable = () => {
      if (chooseHeroMode(readDeviceEnv()) === "mobile-globe") setEnabled(true);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 0);
    return () => clearTimeout(timer);
  }, []);

  // It renders only while it is on screen and the tab is visible; reduced motion turned on removes it.
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let visible = true;
    const update = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => { if (motion.matches) setEnabled(false); };
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", reduce);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      motion.removeEventListener("change", reduce);
    };
  }, [enabled]);

  if (!enabled) return null;
  // The canvas fades in over the galaxy once its first textured frame has rendered, and fades into the
  // page at the bottom (globals.css). At most the viewport's width and 520 px, so the globe (about 72 %
  // of the box) stays below the stats row at 320–1023 px and the copy above it stays legible.
  return (
    <div
      ref={ref}
      className="hero-mobile-globe pointer-events-none absolute bottom-0 left-1/2 aspect-square w-[min(100vw,520px)] -translate-x-1/2"
      data-globe={globe}
      aria-hidden
    >
      {globe !== "failed" && (
        <SceneBoundary onError={fail}>
          <EarthScene variant="mobile" active={active} onReady={() => setGlobe((g) => (g === "failed" ? g : "ready"))} onLost={fail} />
        </SceneBoundary>
      )}
    </div>
  );
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

/**
 * Entrance states. Every visitor starts from "hidden" (server-rendered). Without the intro the copy
 * goes straight to "shown". With it, it is "held" under the overlay, then "revealed": a slower,
 * later choreography timed to the curtain lift, with the words tipping up from their bottom-left
 * corner. The label comes from the intro store, whose server snapshot is "off", so the markup never
 * differs between server and client; reduced motion never plays the intro.
 */
type CopyState = "held" | "shown" | "revealed";
/** `start` is the phase when this copy mounted: a remount after the intro (crossing 1024 px, a client
 *  navigation back to "/") uses the normal timing. */
const copyState = (phase: IntroPhase, start: IntroPhase): CopyState =>
  phase === "loading" ? "held" : phase !== "off" && (start === "loading" || start === "reveal") ? "revealed" : "shown";
const EASE = [0.44, 0, 0.56, 1] as const;
const RISE = [0.16, 1, 0.3, 1] as const;
/** On intro visits the eyebrow, pitch and stats wait this much longer for the curtain to clear. */
const INTRO_COPY_DELAY = 0.45;
const fade = (delay: number): Variants => {
  const hidden = { opacity: 0, y: 28, filter: "blur(6px)" };
  const visible = { opacity: 1, y: 0, filter: "blur(0px)" };
  return {
    hidden,
    held: hidden,
    shown: { ...visible, transition: { duration: 0.9, ease: EASE, delay } },
    revealed: { ...visible, transition: { duration: 0.9, ease: EASE, delay: delay + INTRO_COPY_DELAY } },
  };
};
const EYEBROW = fade(0.05);
const PITCH = fade(0.3);
const STATS = fade(0.42);
const HEADLINE: Variants = {
  hidden: {},
  held: {},
  shown: { transition: { delayChildren: 0.12, staggerChildren: 0.045 } },
  revealed: { transition: { delayChildren: 0.55, staggerChildren: 0.055 } },
};
// 125 %, not 110 %: at the display face's 0.92 line height the ascenders of a word moved down by
// 110 % still reach into its mask's bottom padding, which would show slivers before the rise. Under
// the intro overlay the words also tip by 5° (transform-origin 0% 100% in globals.css); they end
// level, at transform: none, so the end-state CSS still matches.
const WORD: Variants = {
  hidden: { y: "125%" },
  held: { y: "125%", rotate: 5, transition: { duration: 0 } },
  shown: { y: "0%", rotate: 0, transition: { duration: 0.95, ease: RISE } },
  revealed: { y: "0%", rotate: 0, transition: { duration: 1.05, ease: RISE } },
};

type Word = { text: string; tone?: string; after?: string };
const [FIRST, SECOND, THIRD] = HOME.headline.verbs;
// "— The smarter way to plan, build, and scale your business." as single words, each in its own mask.
const WORDS: Word[] = [
  { text: "—", tone: "text-mut-3" },
  ...HOME.headline.lead.split(" ").map((text) => ({ text })),
  { text: FIRST, tone: "text-flame", after: "," },
  { text: SECOND, tone: "text-flame", after: "," },
  { text: "and" },
  { text: THIRD, tone: "text-flame" },
  ...HOME.headline.tail.split(" ").map((text) => ({ text })),
];

function HeroCopy() {
  // Same markup for every visitor (static export). The intro holds the copy until its reveal;
  // reduced motion and no-JS get the end state from CSS on [data-reveal] (globals.css, NoScriptStyles).
  const phase = useSyncExternalStore(introStore.subscribe, getIntroPhase, getServerIntroPhase);
  // Only picks an animation label, never markup; on the server (and so in the HTML) it is "off".
  const [startPhase] = useState(getIntroPhase);
  const state = copyState(phase, startPhase);
  return (
    <div className="hero-copy mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
      <motion.p data-reveal="" variants={EYEBROW} initial="hidden" animate={state} className="text-[15px] leading-tight">
        <span className="text-mut-2">{HOME.eyebrow.muted}</span>{" "}
        <span className="font-medium text-ink">{HOME.eyebrow.strong}</span>
      </motion.p>

      {/* Each word rises out of its own mask (.hero-word-mask). The heading's accessible name is the
          sentence itself; role="none" keeps Chrome from exposing each inline-block mask as a group,
          so assistive technology gets plain runs of text, as with the unsplit markup. */}
      <motion.h1 variants={HEADLINE} initial="hidden" animate={state} className="display mx-auto mt-6 max-w-3xl text-[clamp(38px,7.4vw,92px)] text-ink">
        {WORDS.map((word, index) => (
          <Fragment key={index}>
            {index > 0 && " "}
            <span role="none" className="hero-word-mask">
              <motion.span data-reveal="" variants={WORD} className="hero-word">
                {word.tone ? <span className={word.tone}>{word.text}</span> : word.text}
                {word.after}
              </motion.span>
            </span>
          </Fragment>
        ))}
      </motion.h1>

      <motion.div data-reveal="" variants={PITCH} initial="hidden" animate={state} className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:items-center lg:items-start">
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

      <motion.div data-reveal="" variants={STATS} initial="hidden" animate={state} className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-10 lg:justify-start">
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
  const [active, setActive] = useState(true);
  const progress = useMotionValue(0);

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

  // Mobile / reduced motion / no JS / first paint: the static cosmic hero (no three.js fetched until a
  // phone or tablet qualifies for the 1k globe, MobileScene). Until hydration, eligible desktops reserve
  // the cinematic's 300vh (.hero-reserve in globals.css) so deep links and reloads land where they will stay.
  if (!cinematic) {
    // Hero images go first in <head>, one per visitor: the cinematic's poster (high priority) on the
    // desktops that will show it, the galaxy everywhere else. The galaxy <img> below reuses this
    // media-scoped preload instead of React's automatic one, which every desktop fetched first.
    preload("/images/hero-poster.webp", { as: "image", media: QUERY, fetchPriority: "high" });
    preload("/images/galaxy.webp", { as: "image", media: STATIC_QUERY });
    return (
      <section id="home" className={hydrated ? "relative" : "hero-reserve relative"}>
        <div className="relative overflow-hidden">
          <div className="hero-backdrop pointer-events-none absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/galaxy.webp" alt="" aria-hidden width={3840} height={1629} className="h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/35 to-bg" />
            <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_75%_0%,rgba(250,110,67,0.18),rgba(22,23,25,0)_60%)]" />
          </div>
          <Starfield className="opacity-50" />
          <MobileScene />

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
        <HeroScene progress={progress} active={active} />

        {/* legibility scrim for the statement beat */}
        <Choreo progress={progress} opacity={[[0.5, 0.62], [0, 0.55]]} className="pointer-events-none absolute inset-0 bg-[#0f0f12]" />

        {/* hero copy */}
        <Choreo
          progress={progress}
          opacity={[[0, 0.18, 0.34], [1, 1, 0]]}
          y={[[0, 0.34], [0, -60]]}
          blur={[[0, 0.34], ["blur(0px)", "blur(8px)"]]}
          className="hero-copy-layer pointer-events-none absolute inset-0 flex items-center"
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
