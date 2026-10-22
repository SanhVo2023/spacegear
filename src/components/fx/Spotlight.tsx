"use client";

import { useEffect, type RefObject } from "react";

/** Moves the `.fx-spotlight` highlight (globals.css, FX block) under the pointer by setting --sx/--sy on the
 *  element, at most once per frame and only while a mouse moves over it. */
export function useSpotlight(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let frame = 0;
    let px = 0;
    let py = 0;
    const paint = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", `${(px - r.left).toFixed(1)}px`);
      el.style.setProperty("--sy", `${(py - r.top).toFixed(1)}px`);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      px = event.clientX;
      py = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    el.addEventListener("pointermove", move);
    return () => {
      el.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
      el.style.removeProperty("--sx");
      el.style.removeProperty("--sy");
    };
  }, [ref, enabled]);
}
