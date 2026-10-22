import { useSyncExternalStore } from "react";

/** Heavy effects: smooth scroll, cursor, magnetic, tilt and spotlight, split titles, progress rail, grain, footer letters. */
export const FX_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)";
/** Light effects: CSS reveals and scroll draws, on every device that allows motion. */
export const MOTION_QUERY = "(prefers-reduced-motion: no-preference)";
/** Forced colours (Windows High Contrast): the system cursor stays, so the custom cursor never mounts. Asked as
 *  "active" and negated in script, so a browser without the feature (unknown, no match) still gets the cursor. */
export const FORCED_COLORS_QUERY = "(forced-colors: active)";

function mediaStore(query: string) {
  return {
    subscribe(onChange: () => void) {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    snapshot: () => window.matchMedia(query).matches,
    server: () => false,
  };
}
const fxStore = mediaStore(FX_QUERY);
const motionStore = mediaStore(MOTION_QUERY);
const forcedColorsStore = mediaStore(FORCED_COLORS_QUERY);

/** True once hydrated on a fine-pointer desktop that allows motion. False on the server and during hydration,
 *  so every visitor hydrates the static markup first (the OrbitalCinematic pattern). */
export function useFx(): boolean {
  return useSyncExternalStore(fxStore.subscribe, fxStore.snapshot, fxStore.server);
}

/** True once hydrated when the visitor allows motion (any pointer). */
export function useMotionOK(): boolean {
  return useSyncExternalStore(motionStore.subscribe, motionStore.snapshot, motionStore.server);
}

/** True once hydrated while forced colours are active (false on the server, during hydration and elsewhere). */
export function useForcedColors(): boolean {
  return useSyncExternalStore(forcedColorsStore.subscribe, forcedColorsStore.snapshot, forcedColorsStore.server);
}
