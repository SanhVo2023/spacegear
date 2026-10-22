"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type CursorState = "hidden" | "idle" | "hover" | "label" | "text";

/** Elements that make the ring grow. */
const INTERACTIVE = 'a[href], button, summary, label, [role="button"], [role="switch"], [role="marquee"]';
/** Over form fields the custom cursor steps aside for the native caret. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);
const RING = { stiffness: 480, damping: 38, mass: 0.6 };

/**
 * Dot + ring cursor for fine-pointer desktops (FxLayer mounts it only there), inverted against the page.
 * The ring grows over interactive elements and shows the label of the nearest [data-cursor] ("View",
 * "Drag", "Open"). Over form fields and during keyboard use it steps aside and the native cursor returns,
 * so it never covers a focus ring. It is click-through and hidden from assistive technology.
 */
export default function Cursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, RING);
  const ringY = useSpring(y, RING);
  const [state, setState] = useState<CursorState>("hidden");
  const [label, setLabel] = useState("");
  const pathname = usePathname();
  const recheck = useRef(() => {});

  useEffect(() => {
    const root = document.documentElement;
    let visible = false;
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
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        if (visible) hide();
        return;
      }
      x.set(event.clientX);
      y.set(event.clientY);
      if (!visible) {
        visible = true;
        ringX.jump(event.clientX);
        ringY.jump(event.clientY);
        root.setAttribute("data-fx-cursor", "");
        classify(event.target);
      }
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
      if (visible) classify(document.elementFromPoint(x.get(), y.get()));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", hide);
      root.removeAttribute("data-fx-cursor");
      recheck.current = () => {};
    };
  }, [x, y, ringX, ringY]);

  // After a route change, read again what is under the pointer (a stale "View" would otherwise stay).
  useEffect(() => {
    recheck.current();
  }, [pathname]);

  return (
    <div aria-hidden data-fx-cursor-root="" data-state={state} className="fx-cursor">
      {/* The outer span carries the position, the inner one scales: CSS `scale` applies outside `transform`,
          so scaling the positioned span itself would pull the dot toward the viewport origin. */}
      <motion.span className="fx-cursor-dot-pos" style={{ x, y }}>
        <span className="fx-cursor-dot" />
      </motion.span>
      <motion.span className="fx-cursor-ring" style={{ x: ringX, y: ringY }}>
        <span className="fx-cursor-disc" />
        <span className="fx-cursor-label">{label}</span>
      </motion.span>
    </div>
  );
}
