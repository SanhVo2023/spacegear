"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createIdleLoop } from "./idle-loop";
import { trailStep, type Trail } from "./math";

type CursorState = "hidden" | "idle" | "hover" | "label" | "text";

/** Elements that make the ring grow. */
const INTERACTIVE = 'a[href], button, summary, label, [role="button"], [role="switch"], [role="marquee"]';
/** Over form fields the custom cursor steps aside for the native caret. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);
/** A pointer this far (px) from the ring, re-entering the window say, puts the ring on it at once. */
const RING_SNAP = 300;

function place(el: HTMLElement, x: number, y: number) {
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

/** The newest point an input event carries: the last coalesced one when the browser merged several. */
function latest(event: PointerEvent) {
  const merged = event.getCoalescedEvents?.();
  return merged?.length ? merged[merged.length - 1] : event;
}

/**
 * Dot + ring cursor for fine-pointer desktops (FxLayer mounts it only there). The dot is written straight
 * from the input event (pointerrawupdate where the browser has it), so it is painted in the next frame. The
 * ring trails it on a critically damped follower (trailStep) whose frame loop stops once it rests. The ring
 * grows over interactive elements and shows the label of the nearest [data-cursor] ("View", "Drag", "Open").
 * Over form fields and during keyboard use it steps aside and the native cursor returns, so it never covers
 * a focus ring. It is click-through and hidden from assistive technology.
 */
export default function Cursor() {
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<CursorState>("hidden");
  const [label, setLabel] = useState("");
  const pathname = usePathname();
  const recheck = useRef(() => {});

  useEffect(() => {
    const root = document.documentElement;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;
    let visible = false;
    let px = -100;
    let py = -100;
    let trail: Trail = { x: px, y: py, vx: 0, vy: 0 };
    const loop = createIdleLoop((_, dt) => {
      const step = trailStep(trail, px, py, dt / 1000);
      trail = step.trail;
      place(ring, trail.x, trail.y);
      return step.moving;
    });
    const classify = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      if (!el) {
        setState("idle");
        return;
      }
      if (el.closest(TEXT_ENTRY)) {
        setState("text");
        return;
      }
      const labelled = el.closest<HTMLElement>("[data-cursor]");
      if (labelled?.dataset.cursor) {
        setLabel(labelled.dataset.cursor);
        setState("label");
        return;
      }
      setState(el.closest(INTERACTIVE) ? "hover" : "idle");
    };
    const hide = () => {
      visible = false;
      root.removeAttribute("data-fx-cursor");
      setState("hidden");
    };
    const onMove = (event: Event) => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType !== "mouse") {
        if (visible) hide();
        return;
      }
      const point = latest(pointer);
      px = point.clientX;
      py = point.clientY;
      place(dot, px, py);
      if (!visible || Math.hypot(px - trail.x, py - trail.y) > RING_SNAP) {
        loop.stop();
        trail = { x: px, y: py, vx: 0, vy: 0 };
        place(ring, px, py);
      } else {
        loop.start();
      }
      if (!visible) {
        visible = true;
        root.setAttribute("data-fx-cursor", "");
        classify(pointer.target);
      }
    };
    const onDown = (event: PointerEvent) => {
      if (visible && event.pointerType !== "mouse") hide();
    };
    const onOver = (event: PointerEvent) => {
      if (visible && event.pointerType === "mouse") classify(event.target);
    };
    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (visible && !MODIFIERS.has(event.key)) hide();
    };
    // A click navigation swaps the page under a still pointer, and not every browser sends pointerover then.
    recheck.current = () => {
      if (visible) classify(document.elementFromPoint(px, py));
    };
    // pointerrawupdate (Chromium, secure contexts) fires as soon as the input arrives, not aligned to a frame.
    const move = "onpointerrawupdate" in window ? "pointerrawupdate" : "pointermove";
    window.addEventListener(move, onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", hide);
    return () => {
      loop.stop();
      window.removeEventListener(move, onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", hide);
      root.removeAttribute("data-fx-cursor");
      recheck.current = () => {};
    };
  }, []);

  // After a route change, read again what is under the pointer (a stale "View" would otherwise stay).
  useEffect(() => {
    recheck.current();
  }, [pathname]);

  // The two moving spans carry no React style: their transforms are written directly, outside rendering.
  return (
    <div aria-hidden data-fx-cursor-root="" data-state={state} className="fx-cursor">
      {/* The outer span carries the position, the inner one scales: CSS `scale` applies outside `transform`,
          so scaling the positioned span itself would pull the dot toward the viewport origin. */}
      <span ref={dotRef} className="fx-cursor-dot-pos">
        <span className="fx-cursor-dot" />
      </span>
      <span ref={ringRef} className="fx-cursor-ring">
        <span className="fx-cursor-disc" />
        <span className="fx-cursor-label">{label}</span>
      </span>
    </div>
  );
}
