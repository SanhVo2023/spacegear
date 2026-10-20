"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Curtain reveal: the page content sits on a higher layer with a solid
 * background; the footer is pinned behind it. As you scroll to the end, the
 * content "lifts away" to reveal the footer underneath — like a curtain.
 *
 * Only engaged when the footer fits within the viewport (desktop). Otherwise
 * the footer renders in normal flow so every link stays reachable.
 */
export default function CurtainShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const footerRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  const [curtain, setCurtain] = useState(false);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const measure = () => {
      const fh = el.offsetHeight;
      setH(fh);
      setCurtain(window.innerWidth >= 1024 && fh <= window.innerHeight - 8);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <>
      <div
        className="relative z-20 bg-bg"
        style={curtain ? { marginBottom: h } : undefined}
      >
        {children}
      </div>
      <div
        ref={footerRef}
        className={
          curtain ? "fixed bottom-0 left-0 right-0 z-0" : "relative z-0"
        }
      >
        {footer}
      </div>
    </>
  );
}
