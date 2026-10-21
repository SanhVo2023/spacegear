import { DRAG_FRICTION, DRAG_RADIANS_PER_VIEWPORT, MAX_PITCH, MAX_SPIN } from "./constants";

/** Seconds: the fling velocity follows the pointer's speed with this time constant, at any frame rate. */
const VELOCITY_SMOOTHING = 0.04;

export type Spring = { value: number; velocity: number };
export const createSpring = (value = 0): Spring => ({ value, velocity: 0 });

/**
 * Damped spring toward a target (semi-implicit Euler in 1/120 s substeps, so long frames stay stable).
 * A non-finite target leaves the spring where it is.
 */
export function stepSpring(spring: Spring, target: number, dt: number, stiffness = 60, damping = 14): number {
  if (!Number.isFinite(target)) return spring.value;
  let remaining = Math.min(Math.max(dt, 0), 0.25);
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 120);
    spring.velocity += (stiffness * (target - spring.value) - damping * spring.velocity) * h;
    spring.value += spring.velocity * h;
    remaining -= h;
  }
  return spring.value;
}

/** Pointer state shared by the DOM listeners and the render loop. x, y: -1…1 across the viewport, y up. */
export type PointerInput = { x: number; y: number; dragging: boolean; dx: number; dy: number };
export const createPointerInput = (): PointerInput => ({ x: 0, y: 0, dragging: false, dx: 0, dy: 0 });

export type DragState = { velocity: number; pitchTarget: number; pitch: Spring };
export const createDragState = (): DragState => ({ velocity: 0, pitchTarget: 0, pitch: createSpring() });

/**
 * Consumes this frame's drag movement and returns the extra spin (radians) to apply now. While
 * dragging, the globe follows the pointer; after release it keeps the release velocity and eases
 * back to the idle spin (exponential friction), never faster than MAX_SPIN. Vertical drag pitches
 * the globe, clamped, and it springs back to level on release. A NaN, negative or zero dt moves
 * nothing but the pointer-driven spin; a long one counts as 0.25 s.
 */
export function stepDrag(input: PointerInput, state: DragState, dt: number, viewportWidth: number): number {
  const h = dt > 0 ? Math.min(dt, 0.25) : 0;
  const scale = DRAG_RADIANS_PER_VIEWPORT / Math.max(1, viewportWidth);
  let spin: number;
  if (input.dragging) {
    spin = input.dx * scale;
    if (h > 0) {
      // Time-based smoothing toward this frame's pointer speed (spin / h), written so a very short
      // frame moves the estimate by at most spin / VELOCITY_SMOOTHING instead of inflating it.
      const k = 1 - Math.exp(-h / VELOCITY_SMOOTHING);
      const velocity = state.velocity + spin * (k / h) - state.velocity * k;
      state.velocity = Math.min(MAX_SPIN, Math.max(-MAX_SPIN, velocity));
    }
    state.pitchTarget = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, state.pitchTarget + input.dy * scale));
  } else {
    state.velocity *= Math.exp(-DRAG_FRICTION * h);
    if (Math.abs(state.velocity) < 1e-3) state.velocity = 0;
    spin = state.velocity * h;
    state.pitchTarget = 0;
  }
  input.dx = 0;
  input.dy = 0;
  stepSpring(state.pitch, state.pitchTarget, h, 40, 12);
  return spin;
}
