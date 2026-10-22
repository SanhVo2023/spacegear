"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { createIdleLoop } from "./idle-loop";
import { SCROLL_LOCK_ATTR } from "./scroll-lock";

/** Wheel input over these keeps native scrolling (nested scrollers). */
const NESTED = "textarea, select, [data-snap-row], [data-lenis-prevent]";

/** Ends a glide in progress, so a native scroll is never pulled back toward the glide's target. */
function settle(lenis: Lenis) {
  if (lenis.isScrolling === "smooth") {
    lenis.stop();
    lenis.start();
  }
}

/**
 * Lenis smooth scrolling for fine-pointer desktops (FxLayer mounts it only there). Lenis scrolls the window
 * itself, so native scroll events, Motion's useScroll, sticky elements and scroll-padding-top keep working,
 * and anchors stay native. Keys, pointer presses, focus moves, hash links and history moves end a glide
 * first, so keyboard scrolling and the CurtainShell / hero focus handlers always win. Frames run only while
 * a glide is under way; `data-scroll-lock` on <html> pauses it.
 */
export default function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 1,
      anchors: false,
      stopInertiaOnNavigate: true,
      prevent: (node) => node.matches(NESTED),
    });
    // Lenis 1.3.26 (pinned) stops a native `scrollend` in the capture phase unless it is tracking a native scroll
    // (so during a glide, while stopped, or after its 400 ms reset), hiding it from every listener on the page.
    // Detach that private handler; destroy() removes it again harmlessly.
    window.removeEventListener("scrollend", (lenis as unknown as { onScrollEnd: EventListener }).onScrollEnd, { capture: true });
    lenisRef.current = lenis;
    const loop = createIdleLoop((time) => {
      lenis.raf(time);
      return lenis.isScrolling === "smooth";
    });
    const offWheel = lenis.on("virtual-scroll", () => loop.start());
    const end = () => settle(lenis);
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href*="#"]')) end();
    };
    const lock = () => {
      if (document.documentElement.hasAttribute(SCROLL_LOCK_ATTR)) lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(lock);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [SCROLL_LOCK_ATTR] });
    lock();
    window.addEventListener("keydown", end, true);
    window.addEventListener("pointerdown", end, true);
    document.addEventListener("focusin", end, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", end);
    window.addEventListener("popstate", end);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", end, true);
      window.removeEventListener("pointerdown", end, true);
      document.removeEventListener("focusin", end, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", end);
      window.removeEventListener("popstate", end);
      offWheel();
      loop.stop();
      // stop() first: otherwise the 400 ms velocity-reset timer Lenis leaves pending after a native scroll
      // puts the `lenis` class back on <html> after destroy().
      lenis.stop();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // A new route has a new height: end any glide and re-measure.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    settle(lenis);
    lenis.resize();
  }, [pathname]);

  return null;
}
