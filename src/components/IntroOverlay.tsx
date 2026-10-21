"use client";

import { useEffect, useRef } from "react";
import { INTRO_EXTRA_CAP_MS, INTRO_HOLD_MS, INTRO_LOAD_CAP_MS, INTRO_MIN_MS, INTRO_REVEAL_MS, introStore } from "@/components/globe/intro-store";

/** How fast the counter eases toward its target (1/s): steady while loading, a final surge once the globe is ready. */
const CHASE_RATE = 6;
const CATCH_UP_RATE = 9;
/** After a press on the overlay, a click that comes within this long of the release is cancelled. */
const SWALLOW_MS = 500;

/**
 * The first-visit intro: a 00→100 counter driven by the globe's real loading progress, a short hold on
 * 100, then the reveal (the overlay lifts like the site's curtain). It is rendered hidden on every page
 * and only shows when the inline gate (IntroGate.tsx) set html[data-intro="play"] before first paint.
 * Any input ends it at once. It is aria-hidden and holds nothing focusable; the skip link sits above it.
 * While loading it takes pointer presses (people click loading screens to skip them): a press only ends
 * the intro, and the click it makes is cancelled, so no link the visitor could not see ever fires.
 * If this script never runs, a CSS failsafe hides it and releases the hero copy (globals.css).
 */
export default function IntroOverlay() {
  const overlay = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    // Hydration after the 6 s CSS failsafe finds the copy already shown; moving data-intro past "play"
    // below re-applies its held entrance state, so it rises again (accepted: rare, and never blank).
    if (root.dataset.intro !== "play") return;
    introStore.start();
    const inputs = ["keydown", "wheel", "touchstart"] as const;
    let shown = 0;
    let printed = 0;
    let last = -1;
    let heldAt = -1;
    let frame = 0;
    let capTimer = 0;
    let readyTimer = 0;
    let doneTimer = 0;
    let swallowTimer = 0;

    const write = (value: number) => {
      const whole = Math.floor(value);
      if (whole !== printed && count.current) count.current.textContent = String(whole).padStart(2, "0");
      printed = whole;
      if (bar.current) bar.current.style.transform = `scaleX(${value / 100})`;
    };

    // The click that follows a primary press on the overlay is cancelled once. It may land after the
    // overlay has gone, on the link underneath (touch) or on a common ancestor (mouse); either way it
    // must not act. Disarmed by that click, a cancelled pointer, the next press, or SWALLOW_MS after the
    // release, so a later, deliberate click always goes through (also after a press that never released,
    // such as one that opened a context menu). Keyboard and scripted clicks (detail 0) are never touched.
    const swallow = (event: MouseEvent) => {
      if (event.detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
      disarm();
    };
    const released = () => {
      window.clearTimeout(swallowTimer);
      swallowTimer = window.setTimeout(disarm, SWALLOW_MS);
    };
    function disarm() {
      window.clearTimeout(swallowTimer);
      window.removeEventListener("click", swallow, true);
      window.removeEventListener("pointerup", released, true);
      window.removeEventListener("pointercancel", disarm, true);
      window.removeEventListener("pointerdown", disarm, true);
    }
    const arm = () => {
      disarm();
      window.addEventListener("click", swallow, true);
      window.addEventListener("pointerup", released, true);
      window.addEventListener("pointercancel", disarm, true);
      // Added while this press is being dispatched, so it first fires on the next press.
      window.addEventListener("pointerdown", disarm, true);
    };

    const detach = () => {
      for (const type of inputs) window.removeEventListener(type, skip, true);
      window.removeEventListener("pointerdown", press, true);
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
    function press(event: PointerEvent) {
      if (event.button === 0 && event.target instanceof Node && overlay.current?.contains(event.target)) arm();
      finish();
    }
    function scrolled() {
      if (window.scrollY > 4) finish();
    }
    const tick = (now: number) => {
      const { progress, ready, failed } = introStore.get();
      // Once the first textured frame is on screen, the catch-up, the hold and the reveal stay within INTRO_EXTRA_CAP_MS.
      if (ready && !readyTimer) readyTimer = window.setTimeout(reveal, INTRO_EXTRA_CAP_MS - INTRO_REVEAL_MS);
      const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      // Real progress, never ahead of it, but paced to take at least INTRO_MIN_MS; 100 only once the
      // first textured frame has rendered.
      const target = 100 * Math.min(now / INTRO_MIN_MS, ready ? 1 : Math.min(0.99, progress));
      shown += (target - shown) * (1 - Math.exp(-(ready ? CATCH_UP_RATE : CHASE_RATE) * dt));
      if (target - shown < 0.5) shown = target;
      write(shown);
      // The rAF time counts from navigation start, like performance.now(), so the load cap also covers
      // the time before hydration. At the cap (or on a failure) the reveal starts at once, without the hold.
      if (failed || now >= INTRO_LOAD_CAP_MS) {
        reveal();
        return;
      }
      if (shown >= 100) {
        if (heldAt < 0) heldAt = now;
        if (now - heldAt >= INTRO_HOLD_MS) {
          reveal();
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    for (const type of inputs) window.addEventListener(type, skip, { capture: true, passive: true });
    window.addEventListener("pointerdown", press, { capture: true, passive: true });
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
    return () => {
      stop();
      disarm();
    };
  }, []);

  return (
    <div ref={overlay} className="intro-overlay" aria-hidden="true">
      <span className="intro-count-mask">
        <span ref={count} className="intro-count">
          00
        </span>
      </span>
      <span className="intro-track">
        <span ref={bar} className="intro-bar" />
      </span>
    </div>
  );
}
