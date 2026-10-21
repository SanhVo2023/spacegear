import { REVEAL_END_SECONDS, STREAM_SETTLE_SECONDS } from "./constants";
import type { IntroPhase } from "./intro-store";
import { GLOBE_MAPS, GLOBE_TIERS } from "./texture-manifest";

/** The tier and map lists come from the generated manifest, so a new map can never be skipped silently. */
export { GLOBE_MAPS };
export type GlobeTier = (typeof GLOBE_TIERS)[number];
export type GlobeMapName = (typeof GLOBE_MAPS)[number];

/** What the hero shows on this device (the spec's device table). */
export type HeroMode = "cinematic" | "mobile-globe" | "poster" | "galaxy";
export type DeviceEnv = { width: number; reducedMotion: boolean; saveData: boolean; webgl2: boolean; deviceMemory?: number };

export function chooseHeroMode(env: DeviceEnv): HeroMode {
  const animated = !env.reducedMotion && !env.saveData && env.webgl2;
  if (env.width >= 1024) return animated ? "cinematic" : "poster";
  return animated && (env.deviceMemory === undefined || env.deviceMemory >= 4) ? "mobile-globe" : "galaxy";
}

export type GpuEnv = {
  viewportWidth: number;
  /** A mouse or trackpad: `(pointer: fine) and (hover: hover)`. */
  finePointer: boolean;
  saveData: boolean;
  effectiveType?: string;
  deviceMemory?: number;
  maxTextureSize: number;
  renderer: string;
};

/** Software rasterisers (headless SwiftShader, llvmpipe, Microsoft Basic Render) stay on 2k. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * The 4k set (≈2.1 MB download, ≈150 MB of GPU memory after the swap) streams after idle only on capable
 * desktops. A fine pointer is required: a tablet in landscape (≥ 1024 px, an Apple GPU, no deviceMemory)
 * would otherwise pass, for little visible gain on a touch screen and possibly over cellular.
 */
export function canStream4k(env: GpuEnv): boolean {
  if (env.viewportWidth < 1024 || !env.finePointer || env.saveData) return false;
  // Written as !(>=) so an unknown (NaN) texture limit fails too.
  if (!(env.maxTextureSize >= 4096) || SOFTWARE_RENDERER.test(env.renderer)) return false;
  if (env.effectiveType && /^(slow-2g|2g|3g)$/.test(env.effectiveType)) return false;
  return env.deviceMemory === undefined || env.deviceMemory >= 8;
}

export type StreamGate = {
  phase: IntroPhase;
  /** The globe became ready under the intro overlay, so the intro reveals it (EarthScene). */
  played: boolean;
  /** Seconds since the overlay started to lift; negative until then. */
  revealElapsed: number;
  /** Seconds since the first textured frame was announced. */
  shownElapsed: number;
};

/**
 * Whether the 4k stream may start (asked only once the first textured frame is on screen, so the 2k
 * uploads are done). Never while the intro covers the page or lifts. A globe that the intro revealed
 * waits until its fade-up and flare are over; any other waits out the canvas's fade-in over the
 * poster and the copy's entrance.
 */
export function streamMayStart({ phase, played, revealElapsed, shownElapsed }: StreamGate): boolean {
  if (phase === "loading" || phase === "reveal") return false;
  return played ? revealElapsed >= REVEAL_END_SECONDS : shownElapsed >= STREAM_SETTLE_SECONDS;
}
