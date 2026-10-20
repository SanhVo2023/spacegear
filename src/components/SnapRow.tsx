"use client";

import { useEffect, useRef, useState, Children, type ReactNode } from "react";

/**
 * Mobile horizontal snap-carousel. Each child becomes a snap card; an optional
 * dot indicator tracks the active card. Owns its own overflow so the page never
 * scrolls sideways. Intended to be used inside a `lg:hidden` wrapper.
 */
export default function SnapRow({
  children,
  className = "",
  itemClassName = "w-[82%]",
  dots = true,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  dots?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const items = Children.toArray(children);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const cards = el.querySelectorAll<HTMLElement>("[data-snap-item]");
        const center = el.scrollLeft + el.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        cards.forEach((c, i) => {
          const cc = c.offsetLeft + c.offsetWidth / 2;
          const d = Math.abs(cc - center);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        setActive(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const goTo = (i: number) => {
    const el = ref.current;
    const card = el?.querySelectorAll<HTMLElement>("[data-snap-item]")[i];
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div className={className}>
      <div
        ref={ref}
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scroll-padding-left:1.25rem]"
      >
        {items.map((child, i) => (
          <div
            key={i}
            data-snap-item
            className={`shrink-0 snap-center ${itemClassName}`}
          >
            {child}
          </div>
        ))}
      </div>

      {dots && items.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to item ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-5 bg-flame" : "w-1.5 bg-mut-3/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
