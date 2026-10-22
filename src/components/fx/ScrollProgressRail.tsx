"use client";

import { motion, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { useFx } from "./env";

export type RailItem = { id: string; label: string };

/**
 * Right-side progress rail for the home page (fine-pointer desktops). Plain anchor links, so keyboard,
 * scroll-padding-top and smooth native anchors behave like the footer's section list. The section in the
 * middle of the viewport is marked aria-current; labels show on hover and focus. It fades out while the
 * hero or the footer fills the screen, and focus brings it back. It renders nothing until useFx() is true,
 * so the server, no-JS, touch and reduced-motion visitors keep the footer's "Home page sections" list as
 * the equivalent.
 */
export default function ScrollProgressRail({ items }: { items: RailItem[] }) {
  const fx = useFx();
  if (!fx) return null;
  return <Rail items={items} />;
}

function Rail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  // Page progress for the hairline fill: read from scroll events, no spring, so an idle page requests no frames.
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const seen = new Map<string, boolean>();
    // A 1% band just above the middle of the viewport: the section crossing it is the one in view.
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
      setActive(items.find((item) => seen.get(item.id))?.id ?? null);
    }, { rootMargin: "-45% 0px -54% 0px" });
    for (const item of items) {
      const section = document.getElementById(item.id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" data-fx-rail="" data-idle={active ? undefined : ""} className="fx-rail">
      <span aria-hidden className="fx-rail-track">
        <motion.span className="fx-rail-fill" style={{ scaleY: scrollYProgress }} />
      </span>
      <ol className="fx-rail-list">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={item.id === active ? "location" : undefined} className="fx-rail-link">
              <span className="fx-rail-label">{item.label}</span>
              <span aria-hidden className="fx-rail-dot" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
