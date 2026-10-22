"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPointerInput, unitOrZero, type PointerInput } from "./interaction";

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const preventDefault = (event: Event) => event.preventDefault();

/**
 * Cursor position (window-wide) and mouse or pen drags that start on `target`. Fine pointers only:
 * touch input is never captured or prevented, so it always scrolls the page. Without a target
 * (the globe is not on screen yet) nothing is listened to and the input stays where it was.
 *
 * The press itself is left alone, so a click on the globe still moves focus like a click anywhere
 * else (it blurs an open nav dropdown). Text selection and native drag are blocked only while a drag
 * is in progress; the scene layer is also `user-select: none` (globals.css).
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
    // Ends the current drag. `cancelled`: no real release was seen, so the globe stops without a fling.
    const end = (cancelled: boolean) => {
      if (id === -1) return;
      const pointer = id;
      id = -1;
      state.dragging = false;
      if (cancelled) state.cancelled = true;
      element.removeAttribute("data-dragging");
      document.removeEventListener("selectstart", preventDefault);
      document.removeEventListener("dragstart", preventDefault);
      if (element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // Under pointer capture the pointer can be far outside the window: keep the tilt within ±1.
      state.x = unitOrZero((event.clientX / window.innerWidth) * 2 - 1);
      state.y = unitOrZero(1 - (event.clientY / window.innerHeight) * 2);
      if (event.pointerId !== id) return;
      // The primary button is up but no release reached the page (it happened outside the window).
      if ((event.buttons & 1) === 0) {
        end(true);
        return;
      }
      state.dx += event.clientX - lastX;
      state.dy += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch" || id !== -1) return;
      id = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      state.dragging = true;
      element.setPointerCapture(id);
      element.setAttribute("data-dragging", "");
      document.addEventListener("selectstart", preventDefault);
      document.addEventListener("dragstart", preventDefault);
    };
    // Movement not yet consumed by a frame stays in dx/dy: stepDrag still applies it after release.
    const up = (event: PointerEvent) => { if (event.pointerId === id) end(false); };
    const cancel = (event: PointerEvent) => { if (event.pointerId === id) end(true); };
    const blur = () => end(true);
    const visibility = () => { if (document.hidden) end(true); };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", cancel);
    element.addEventListener("lostpointercapture", cancel);
    return () => {
      // Unmounting mid-drag (the wrapper may stay): release the capture and clear data-dragging.
      end(true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", cancel);
      element.removeEventListener("lostpointercapture", cancel);
      state.dx = 0;
      state.dy = 0;
    };
  }, [enabled, target]);

  return input;
}
