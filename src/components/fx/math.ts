// Pure maths for the motion system: no DOM, no React. Unit-tested in tests/fx.test.mjs.

/** Clamps `value` into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Turns -0 (and NaN) into 0, so results compare cleanly. */
function tidy(value: number): number {
  return value || 0;
}

/** Frame-rate independent exponential smoothing from `current` toward `target` over `dt` seconds. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return tidy(current + (target - current) * (1 - Math.exp(-lambda * dt)));
}

/** Magnetic pull for a w×h element when the pointer is (dx, dy) px from its centre: a fraction of the
 *  offset capped at `max` px, plus the offset normalised to [-1, 1] for the arrow-glyph nudge. */
export function magnetOffset(dx: number, dy: number, w: number, h: number, max = 10, strength = 0.35) {
  return {
    x: tidy(clamp(dx * strength, -max, max)),
    y: tidy(clamp(dy * strength, -max, max)),
    nx: tidy(clamp(dx / Math.max(1, w / 2), -1, 1)),
    ny: tidy(clamp(dy / Math.max(1, h / 2), -1, 1)),
  };
}

/** 3D tilt in degrees for a pointer at (px, py) inside a w×h card: the side under the pointer dips away. */
export function tiltAngles(px: number, py: number, w: number, h: number, max = 4) {
  const nx = clamp((px / Math.max(1, w)) * 2 - 1, -1, 1);
  const ny = clamp((py / Math.max(1, h)) * 2 - 1, -1, 1);
  return { rx: tidy(-ny * max), ry: tidy(nx * max) };
}

/** Push-away offset for a letter when the pointer is (dx, dy) px from its centre: nothing outside
 *  `radius`, rising quadratically to `max` px near the centre, pointing away from the pointer. */
export function repelOffset(dx: number, dy: number, radius = 140, max = 18) {
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance >= radius) return { x: 0, y: 0 };
  const push = (1 - distance / radius) ** 2 * max;
  return { x: tidy((-dx / distance) * push), y: tidy((-dy / distance) * push) };
}

/** Capability-ticker response to a scroll velocity in px/s: playback rate (1–5) and skew (±8°). */
export function tickerFromVelocity(velocity: number) {
  return {
    rate: 1 + clamp(Math.abs(velocity) / 900, 0, 4),
    skew: tidy(clamp(-velocity / 320, -8, 8)),
  };
}

/** Share of the footer (0–1) the curtain has uncovered. Works for the pinned curtain and for a footer in flow,
 *  because both end the document with the footer's height. */
export function curtainReveal(scrollY: number, viewportH: number, scrollHeight: number, footerH: number) {
  if (footerH <= 0) return 1;
  return clamp((scrollY + viewportH - (scrollHeight - footerH)) / footerH, 0, 1);
}

/** Share (0–1) of a box spanning `top` to `bottom` (viewport px) that shows: inside the viewport and below
 *  `edge`, the bottom of the page content, under which the footer shows (pinned behind the content, or
 *  following it in the flow). The footer wordmark rises on its own share: the curtain uncovers the pinned footer
 *  from the bottom up, and the wordmark sits near its top. */
export function shownBelow(top: number, bottom: number, edge: number, viewportH: number) {
  if (bottom <= top) return 0;
  return tidy(clamp((Math.min(bottom, viewportH) - Math.max(top, edge, 0)) / (bottom - top), 0, 1));
}

/** Grid cell under a pointer at (px, py) inside a w×h field of cols×rows cells. */
export function cellAt(px: number, py: number, w: number, h: number, cols: number, rows: number) {
  return {
    row: clamp(Math.floor((py / Math.max(1, h)) * rows), 0, rows - 1),
    col: clamp(Math.floor((px / Math.max(1, w)) * cols), 0, cols - 1),
  };
}

/** Ring distance between two cells (0 for the same cell, 1 for its eight neighbours, …): the ripple's delay step. */
export function ringDistance(r0: number, c0: number, r: number, c: number) {
  return Math.max(Math.abs(r - r0), Math.abs(c - c0));
}
