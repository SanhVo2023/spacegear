"use client";

import { useEffect, useRef } from "react";
import Wordmark from "@/components/Wordmark";
import { useFx } from "@/components/fx/env";
import { repelOffset, shownBelow } from "@/components/fx/math";

/** True while a view transition (the page curtain, PageTransition.tsx) runs. */
function transitioning() {
  try {
    return document.documentElement.matches(":active-view-transition");
  } catch {
    return false; // a browser without the selector has no view transitions either
  }
}

/**
 * The footer's giant drawn wordmark (<Wordmark>, docs/brand/). On fine-pointer desktops its nine glyphs
 * ([data-letter], staggered by their --i) rise in sequence once half the wordmark is uncovered, sink again
 * once it is covered (the page scrolled back up), so the rise replays each time the curtain opens, and lean
 * away from a nearby pointer. The footer is pinned behind the content in curtain mode, so an
 * IntersectionObserver would call it always visible: the rise follows `shownBelow()`, the wordmark's own share
 * below the content's bottom edge and inside the viewport (the curtain uncovers the footer from the bottom up
 * and the wordmark sits near its top; the same sum serves a footer in the page flow, where leaving through the
 * top does not count as covered). While a route change's curtain runs, the footer is held as a snapshot
 * (globals.css, FX block), so the letters keep their state until it ends: the rise never replays or flashes
 * under the curtain.
 *
 * The markup is the plain <Wordmark> for everyone; the motion is CSS under html[data-fx] (globals.css, FX
 * block), so touch, phones, reduced motion and no-JS keep the glyphs at rest (guidelines §9). The ™ never moves.
 */
export default function FooterWordmark() {
  const ref = useRef<HTMLParagraphElement>(null);
  const fx = useFx();

  useEffect(() => {
    const el = ref.current;
    const footer = el?.closest("footer");
    if (!fx || !el || !footer) return;
    let frame = 0;
    let pointerFrame = 0;
    let retry = 0;
    let px = 0;
    let py = 0;
    let letters: { node: HTMLElement; x: number; y: number }[] = [];
    const nodes = () => el.querySelectorAll<HTMLElement>("[data-letter]");
    const measure = () => {
      letters = [...nodes()].map((node) => {
        const r = node.getBoundingClientRect();
        // The resting centre: take the current lean back out.
        const rx = parseFloat(node.style.getPropertyValue("--rx")) || 0;
        const ry = parseFloat(node.style.getPropertyValue("--ry")) || 0;
        return { node, x: r.left + r.width / 2 - rx, y: r.top + r.height / 2 - ry };
      });
    };
    const reveal = () => {
      frame = 0;
      letters = [];
      if (transitioning()) {
        // Decide once the curtain has gone, against the page it leaves behind.
        if (!retry) retry = window.setTimeout(() => { retry = 0; reveal(); }, 120);
        return;
      }
      // The content ends where the footer begins: in curtain mode the pinned footer shows below that edge, in
      // the flow it starts there. Either way the document ends with the footer's height.
      const edge = document.documentElement.scrollHeight - footer.offsetHeight - window.scrollY;
      const box = el.getBoundingClientRect();
      const shown = shownBelow(box.top, box.bottom, edge, window.innerHeight);
      if (shown >= 0.5) el.setAttribute("data-in", "");
      else if (shown === 0 && box.bottom > 0) el.removeAttribute("data-in");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(reveal);
    };
    const lean = () => {
      pointerFrame = 0;
      if (!letters.length) measure();
      for (const letter of letters) {
        const offset = repelOffset(px - letter.x, py - letter.y, 150, 18);
        letter.node.style.setProperty("--rx", `${offset.x.toFixed(2)}px`);
        letter.node.style.setProperty("--ry", `${offset.y.toFixed(2)}px`);
      }
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") measure();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      px = event.clientX;
      py = event.clientY;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(lean);
    };
    const leave = () => {
      for (const node of nodes()) {
        node.style.removeProperty("--rx");
        node.style.removeProperty("--ry");
      }
    };
    reveal();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    footer.addEventListener("pointerenter", enter);
    footer.addEventListener("pointermove", move);
    footer.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pointerFrame);
      window.clearTimeout(retry);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      footer.removeEventListener("pointerenter", enter);
      footer.removeEventListener("pointermove", move);
      footer.removeEventListener("pointerleave", leave);
      leave();
      el.removeAttribute("data-in");
    };
  }, [fx]);

  // Footer.tsx's wordmark classes: 1em is the drawn type size, so the clamps keep the cell's size; the letters
  // sit in a flex row, so flex centring stands in for text-center on phones.
  return <Wordmark ref={ref} className="fx-wordmark flex justify-center text-[clamp(36px,10vw,104px)] lg:justify-start lg:text-[clamp(40px,8vw,104px)] text-flame" />;
}
