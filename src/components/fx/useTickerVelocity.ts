"use client";

import { useEffect, type RefObject } from "react";
import { useFx } from "./env";
import { createIdleLoop } from "./idle-loop";
import { damp, tickerFromVelocity } from "./math";

type TickerRefs = {
  box: RefObject<HTMLElement | null>;
  skew: RefObject<HTMLElement | null>;
  track: RefObject<HTMLElement | null>;
};

/**
 * Scroll velocity drives the capability ticker on fine-pointer desktops: it speeds up and leans while the page
 * moves and settles back at rest. It listens only while the ticker is on screen, its frame loop stops itself
 * once the ticker is at rest, and hovering or focusing the ticker still stops it dead (WCAG 2.2.2): the CSS
 * pause wins and the skew drops to zero.
 */
export function useTickerVelocity({ box, skew, track }: TickerRefs) {
  const fx = useFx();
  useEffect(() => {
    const boxEl = box.current;
    const skewEl = skew.current;
    const trackEl = track.current;
    if (!fx || !boxEl || !skewEl || !trackEl) return;
    const marquee = trackEl.getAnimations()[0];
    let target = 0;
    let current = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    const apply = (velocity: number) => {
      const paused = boxEl.matches(":hover, :focus-within");
      const { rate, skew: degrees } = tickerFromVelocity(paused ? 0 : velocity);
      if (marquee) marquee.playbackRate = rate;
      skewEl.style.transform = degrees ? `skewX(${degrees.toFixed(2)}deg)` : "";
    };
    const loop = createIdleLoop((_, dt) => {
      const seconds = dt / 1000;
      target = damp(target, 0, 5, seconds);
      current = damp(current, target, 10, seconds);
      const busy = Math.abs(current) > 4 || Math.abs(target) > 4;
      if (!busy) current = target = 0;
      apply(current);
      return busy;
    });
    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      target = (y - lastY) / (Math.max(1, now - lastT) / 1000);
      lastY = y;
      lastT = now;
      loop.start();
    };
    const reset = () => {
      loop.stop();
      current = target = 0;
      apply(0);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        lastY = window.scrollY;
        lastT = performance.now();
        window.addEventListener("scroll", onScroll, { passive: true });
      } else {
        window.removeEventListener("scroll", onScroll);
        reset();
      }
    });
    observer.observe(boxEl);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      reset();
    };
  }, [fx, box, skew, track]);
}
