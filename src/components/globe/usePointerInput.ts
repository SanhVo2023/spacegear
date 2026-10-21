"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPointerInput, type PointerInput } from "./interaction";

const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/**
 * Cursor position (window-wide) and mouse or pen drags that start on `target`. Fine pointers only:
 * touch input is never captured or prevented, so it always scrolls the page. Without a target
 * (the globe is not on screen yet) nothing is listened to and the input stays where it was.
 */
export function usePointerInput(target: RefObject<HTMLElement | null> | undefined, enabled: boolean): RefObject<PointerInput> {
  const input = useRef<PointerInput>(createPointerInput());

  useEffect(() => {
    const element = target?.current;
    if (!enabled || !element || !window.matchMedia(FINE_POINTER).matches) return;
    const state = input.current;
    let id = -1;
    let lastX = 0;
    let lastY = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      state.x = (event.clientX / window.innerWidth) * 2 - 1;
      state.y = 1 - (event.clientY / window.innerHeight) * 2;
      if (!state.dragging || event.pointerId !== id) return;
      state.dx += event.clientX - lastX;
      state.dy += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch" || state.dragging) return;
      event.preventDefault(); // no text selection or native drag while spinning the globe
      id = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      state.dragging = true;
      element.setPointerCapture(id);
      element.setAttribute("data-dragging", "");
    };
    const up = (event: PointerEvent) => {
      // Movement not yet consumed by a frame stays in dx/dy: stepDrag still applies it after release.
      if (event.pointerId !== id) return;
      state.dragging = false;
      id = -1;
      element.removeAttribute("data-dragging");
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };
    window.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("lostpointercapture", up);
    return () => {
      window.removeEventListener("pointermove", move);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("lostpointercapture", up);
      element.removeAttribute("data-dragging");
      state.dragging = false;
      state.dx = 0;
      state.dy = 0;
    };
  }, [enabled, target]);

  return input;
}
