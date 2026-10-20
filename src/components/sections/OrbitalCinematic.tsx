"use client";
import Link from "next/link";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion, useMotionValue, useTransform } from "motion/react";

const EarthScene = dynamic(() => import("@/components/EarthScene"), { ssr: false });
const query = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function eligible() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia(query).matches && !connection?.saveData;
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
export default function OrbitalCinematic() {
  const outer = useRef<HTMLElement>(null);
  const canEnhance = useSyncExternalStore(subscribe, eligible, () => false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const progress = useMotionValue(0);
  const copyY = useTransform(progress, [0, .7], [0, -95]);
  const copyOpacity = useTransform(progress, [0, .3, .65], [1, 1, 0]);
  useEffect(() => {
    if (!canEnhance) return;
    const enable = () => setReady(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable);
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 0);
    return () => clearTimeout(timer);
  }, [canEnhance]);
  useEffect(() => {
    const el = outer.current; if (!el || !canEnhance) return;
    let frame = 0; let visible = true;
    const update = () => {
      const rect = el.getBoundingClientRect();
      progress.set(Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - window.innerHeight))));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const visibility = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibility(); });
    observer.observe(el);
    window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", visibility);
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); document.removeEventListener("visibilitychange", visibility); progress.set(0); };
  }, [canEnhance, progress]);
  return <section ref={outer} id="home" className="orbital-hero">
    <div className="hero-stage">
      <div className="hero-backdrop" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/galaxy-small.webp" width="1600" height="900" alt="" fetchPriority="high"/>
        <div className="hero-poster-globe"/>
      </div>
      {canEnhance && ready && <div className="hero-scene" aria-hidden="true"><SceneBoundary><EarthScene progress={progress} active={active}/></SceneBoundary></div>}
      <div className="hero-shade" aria-hidden="true"/>
      <div className="hero-content site-container"><motion.div className="hero-copy" style={canEnhance ? { y: copyY, opacity: copyOpacity } : undefined}>
        <p className="eyebrow">Digital transformation & AI consulting</p>
        <h1>Turn business challenges into working digital systems.</h1>
        <p>spacegear.tech helps you modernize operations, connect your data and put AI to work—from the first decision to systems your team can use and improve.</p>
        <div className="hero-actions"><Link prefetch={false} href="/contact/" className="button button-primary">Discuss a project <span aria-hidden="true">↗</span></Link><Link prefetch={false} href="/approach/" className="button button-outline">See how we work</Link></div>
      </motion.div></div>
      <div className="hero-caption" aria-hidden="true"><span>Scroll to explore ↓</span><span>Strategy. Technology. Delivery.</span></div>
    </div>
    <div className="hero-statement"><div className="site-container"><p><span>A clear direction.</span><br/><span>A working solution.</span><br/><span>A team ready to use it.</span></p></div></div>
  </section>;
}
