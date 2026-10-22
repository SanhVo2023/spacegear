/**
 * What the hero shows on a device (the spec's device table). A leaf module with no imports, so the hero's
 * first-load chunk can decide on the phone globe without pulling in the globe's constants or texture
 * manifest (tiers.ts re-exports it for the rest of the globe code).
 */
export type HeroMode = "cinematic" | "mobile-globe" | "poster" | "galaxy";
export type DeviceEnv = {
  width: number;
  reducedMotion: boolean;
  saveData: boolean;
  webgl2: boolean;
  deviceMemory?: number;
  /** navigator.connection.effectiveType, where the browser reports it. */
  effectiveType?: string;
};

/** Connections too slow for the globe's extra bytes, as in the intro gate and canStream4k. */
export const SLOW_CONNECTION = /^(slow-2g|2g|3g)$/;

/**
 * Desktop (≥ 1024 px): the cinematic hero with motion, no Save-Data and WebGL2, otherwise the poster.
 * Phones and tablets: the 1k globe when they also have deviceMemory ≥ 4 (or unknown) and no slow
 * connection, otherwise the galaxy.
 */
export function chooseHeroMode(env: DeviceEnv): HeroMode {
  const animated = !env.reducedMotion && !env.saveData && env.webgl2;
  if (env.width >= 1024) return animated ? "cinematic" : "poster";
  const memory = env.deviceMemory === undefined || env.deviceMemory >= 4;
  const fast = !(env.effectiveType && SLOW_CONNECTION.test(env.effectiveType));
  return animated && memory && fast ? "mobile-globe" : "galaxy";
}
