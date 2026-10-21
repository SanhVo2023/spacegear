"use client";

import { useEffect, useRef } from "react";
import { INTRO_EXTRA_CAP_MS, INTRO_LOAD_CAP_MS, INTRO_REVEAL_MS, introStore } from "@/components/globe/intro-store";

/** How fast the counter eases toward its target (1/s): steady while loading, quicker once the globe is ready. */
const CHASE_RATE = 6;
const CATCH_UP_RATE = 15;

/**
 * The first-visit intro: a 00→100 counter driven by the globe's real texture progress, then the
 * reveal. It is rendered hidden on every page and only shows when the inline gate (IntroGate.tsx)
 * set html[data-intro="play"] before first paint. Any input ends it at once. It is aria-hidden, holds
 * nothing focusable and never takes pointer events, so it cannot trap focus or swallow a click; the
 * skip link sits above it. If this script never runs, a CSS failsafe hides it (globals.css).
 */
export default function IntroOverlay() {
  const count = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "play") return;
    introStore.start();
    const inputs = ["keydown", "pointerdown", "wheel", "touchstart"] as const;
    let shown = 0;
    let printed = 0;
    let last = -1;
    let frame = 0;
    let capTimer = 0;
    let readyTimer = 0;
    let doneTimer = 0;

    const write = (value: number) => {
      const whole = Math.floor(value);
      if (whole !== printed && count.current) count.current.textContent = String(whole).padStart(2, "0");
      printed = whole;
      if (bar.current) bar.current.style.transform = `scaleX(${value / 100})`;
    };
    const detach = () => {
      for (const type of inputs) window.removeEventListener(type, skip, true);
      document.removeEventListener("focusin", skip, true);
      window.removeEventListener("scroll", scrolled);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(capTimer);
      window.clearTimeout(readyTimer);
      window.clearTimeout(doneTimer);
      detach();
    };
    const finish = () => {
      stop();
      root.dataset.intro = "done";
      introStore.finish();
    };
    const reveal = () => {
      if (root.dataset.intro !== "play") return;
      cancelAnimationFrame(frame);
      window.clearTimeout(capTimer);
      window.clearTimeout(readyTimer);
      write(100);
      root.dataset.intro = "reveal";
      introStore.reveal();
      doneTimer = window.setTimeout(finish, INTRO_REVEAL_MS);
    };
    function skip() {
      finish();
    }
    function scrolled() {
      if (window.scrollY > 4) finish();
    }
    const tick = (now: number) => {
      const { progress, ready, failed } = introStore.get();
      // Once the first textured frame is on screen, the catch-up plus the reveal stay within INTRO_EXTRA_CAP_MS.
      if (ready && !readyTimer) readyTimer = window.setTimeout(reveal, INTRO_EXTRA_CAP_MS - INTRO_REVEAL_MS);
      const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      // The counter only reaches 100 once the first textured frame has rendered.
      const target = ready ? 100 : Math.min(99, progress * 100);
      shown += (target - shown) * (1 - Math.exp(-(ready ? CATCH_UP_RATE : CHASE_RATE) * dt));
      if (target - shown < 0.5) shown = target;
      write(shown);
      // The rAF time counts from navigation start, like performance.now(), so the load cap also
      // covers the time before hydration: the page reveals at most INTRO_LOAD_CAP_MS after first paint.
      if ((ready && shown >= 100) || failed || now >= INTRO_LOAD_CAP_MS) {
        reveal();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    for (const type of inputs) window.addEventListener(type, skip, { capture: true, passive: true });
    document.addEventListener("focusin", skip, true);
    window.addEventListener("scroll", scrolled, { passive: true });
    // Input before hydration (a scroll, or Tab to the skip link) has already ended it for the visitor.
    const focused = document.activeElement;
    if (window.scrollY > 4 || (focused && focused !== document.body)) finish();
    else {
      // The load cap also holds when frames are paused (a background tab): timers still run.
      capTimer = window.setTimeout(reveal, Math.max(0, INTRO_LOAD_CAP_MS - performance.now()));
      frame = requestAnimationFrame(tick);
    }
    return stop;
  }, []);

  return (
    <div className="intro-overlay" aria-hidden="true">
      <span ref={count} className="intro-count">
        00
      </span>
      <span className="intro-track">
        <span ref={bar} className="intro-bar" />
      </span>
    </div>
  );
}
