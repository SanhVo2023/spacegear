import { DRAG_FRICTION, DRAG_RADIANS_PER_VIEWPORT, MAX_PITCH } from "./constants";

export type Spring = { value: number; velocity: number };
export const createSpring = (value = 0): Spring => ({ value, velocity: 0 });

/** Damped spring toward a target (semi-implicit Euler in 1/120 s substeps, so long frames stay stable). */
export function stepSpring(spring: Spring, target: number, dt: number, stiffness = 60, damping = 14): number {
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
 * back to the idle spin (exponential friction). Vertical drag pitches the globe, clamped, and it
 * springs back to level on release.
 */
export function stepDrag(input: PointerInput, state: DragState, dt: number, viewportWidth: number): number {
  const scale = DRAG_RADIANS_PER_VIEWPORT / Math.max(1, viewportWidth);
  let spin: number;
  if (input.dragging) {
    spin = input.dx * scale;
    if (dt > 0) state.velocity = state.velocity * 0.5 + (spin / dt) * 0.5;
    state.pitchTarget = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, state.pitchTarget + input.dy * scale));
  } else {
    state.velocity *= Math.exp(-DRAG_FRICTION * dt);
    if (Math.abs(state.velocity) < 1e-3) state.velocity = 0;
    spin = state.velocity * dt;
    state.pitchTarget = 0;
  }
  input.dx = 0;
  input.dy = 0;
  stepSpring(state.pitch, state.pitchTarget, dt, 40, 12);
  return spin;
}
