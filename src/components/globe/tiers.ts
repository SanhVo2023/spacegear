import { REVEAL_END_SECONDS, STREAM_SETTLE_SECONDS } from "./constants";
import { SLOW_CONNECTION } from "./hero-mode";
import type { IntroPhase } from "./intro-store";
import { GLOBE_MAPS, GLOBE_TIERS } from "./texture-manifest";

/** The tier and map lists come from the generated manifest, so a new map can never be skipped silently. */
export { GLOBE_MAPS };
export type GlobeTier = (typeof GLOBE_TIERS)[number];
export type GlobeMapName = (typeof GLOBE_MAPS)[number];

/** The device table lives in a leaf module, so the hero's first-load chunk can import it alone. */
export { chooseHeroMode, SLOW_CONNECTION, type DeviceEnv, type HeroMode } from "./hero-mode";

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
  if (env.effectiveType && SLOW_CONNECTION.test(env.effectiveType)) return false;
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
