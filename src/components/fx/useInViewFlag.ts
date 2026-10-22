import { useEffect, type RefObject } from "react";

/**
 * Sets `data-in` on the element the first time it enters the viewport. CSS reveals key off the attribute,
 * so there is no React state and no animation frame.
 */
export function useInViewFlag(
  ref: RefObject<Element | null>,
  { enabled = true, amount = 0.25 }: { enabled?: boolean; amount?: number } = {},
) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      el.setAttribute("data-in", "");
      observer.disconnect();
    }, { threshold: amount });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled, amount]);
}
