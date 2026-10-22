import { useEffect, type RefObject } from "react";

/**
 * Sets `data-in` on the element when it enters the viewport (and, with `once: false`, removes it when it
 * leaves). CSS reveals key off the attribute, so there is no React state and no animation frame.
 */
export function useInViewFlag(
  ref: RefObject<Element | null>,
  { enabled = true, amount = 0.25, once = true }: { enabled?: boolean; amount?: number; once?: boolean } = {},
) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.setAttribute("data-in", "");
        if (once) observer.disconnect();
      } else if (!once) {
        el.removeAttribute("data-in");
      }
    }, { threshold: amount });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled, amount, once]);
}
