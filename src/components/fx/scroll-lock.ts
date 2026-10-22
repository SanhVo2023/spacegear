/** Attribute on <html> that holds the page still (for example while an intro plays). SmoothScroll pauses
 *  Lenis while it is present; blocking native scrolling (overflow: hidden) stays the lock owner's job. */
export const SCROLL_LOCK_ATTR = "data-scroll-lock";

export function setScrollLock(locked: boolean) {
  document.documentElement.toggleAttribute(SCROLL_LOCK_ATTR, locked);
}
