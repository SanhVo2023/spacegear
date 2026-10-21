import { DOLLY_Z, RIG_RANGE, RIG_SCALE, RIG_X, SUN_END, SUN_START, SUN_SWEEP, type Vec3 } from "./constants";

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function mapClamp(x: number, inA: number, inB: number, outA: number, outB: number): number {
  return outA + (outB - outA) * clamp01((x - inA) / (inB - inA));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/** Spherical interpolation between two directions; the result is a unit vector. */
export function slerpDirection(from: Vec3, to: Vec3, t: number): Vec3 {
  const a = normalize(from);
  const b = normalize(to);
  const cos = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(cos);
  if (omega < 1e-4) return a;
  const sin = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sin;
  const wb = Math.sin(t * omega) / sin;
  return normalize([a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]);
}

/** Toward the sun at hero scroll progress p: the terminator crosses the face as the globe centres. */
export function sunDirectionAt(p: number): Vec3 {
  return slerpDirection(SUN_START, SUN_END, smoothstep(SUN_SWEEP[0], SUN_SWEEP[1], p));
}

/** Globe placement for the scroll beats: right of centre, then shrinking to the centre. */
export function rigAt(p: number): { scale: number; x: number } {
  return {
    scale: mapClamp(p, RIG_RANGE[0], RIG_RANGE[1], RIG_SCALE[0], RIG_SCALE[1]),
    x: mapClamp(p, RIG_RANGE[0], RIG_RANGE[1], RIG_X[0], RIG_X[1]),
  };
}

/** Slow camera dolly-in across the whole hero. */
export function cameraZAt(p: number): number {
  return mapClamp(p, 0, 1, DOLLY_Z[0], DOLLY_Z[1]);
}
