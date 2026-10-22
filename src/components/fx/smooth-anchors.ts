import { useEffect } from "react";

/**
 * Attribute on <html> that lets the page's `scroll-behavior: smooth` apply (globals.css, FX block). Without
 * it every scroll is instant. That holds for no-JS and reduced-motion visitors, and for every visitor until
 * the first press or key after a page load or a history move. So the scrolls the browser makes on its own
 * never glide from the top of the page: restoring the position on a reload or on Back, and following a
 * deep link.
 */
export const SMOOTH_ANCHORS_ATTR = "data-fx-smooth-anchors";

/**
 * Smooth anchor scrolling only for the scrolls a visitor asks for. It turns on at the first pointer press or
 * key, the inputs that follow a link. It turns off again on a history move (popstate), whose position the
 * browser restores once Next has rendered that entry, possibly a few frames later.
 *
 * It also sets Next's `data-scroll-behavior="smooth"` opt-in, so a route change opens the new page at its
 * top at once (Next 16 no longer forces that by default; hash-only changes still glide). It requests no
 * animation frames.
 */
export function useSmoothAnchors(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const on = () => root.setAttribute(SMOOTH_ANCHORS_ATTR, "");
    const off = () => root.removeAttribute(SMOOTH_ANCHORS_ATTR);
    root.dataset.scrollBehavior = "smooth";
    window.addEventListener("pointerdown", on, { capture: true, passive: true });
    window.addEventListener("keydown", on, true);
    window.addEventListener("popstate", off);
    return () => {
      window.removeEventListener("pointerdown", on, true);
      window.removeEventListener("keydown", on, true);
      window.removeEventListener("popstate", off);
      off();
      delete root.dataset.scrollBehavior;
    };
  }, [enabled]);
}
