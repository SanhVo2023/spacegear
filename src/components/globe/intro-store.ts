/** Intro loader state shared by IntroOverlay (root layout), the hero copy and the globe scene. */
export type IntroPhase = "off" | "loading" | "reveal" | "done";
export type IntroState = { phase: IntroPhase; progress: number; ready: boolean; failed: boolean };

/** The page reveals at most this long after the overlay appeared, even if textures are still loading. */
export const INTRO_LOAD_CAP_MS = 4000;
/** The counter's catch-up plus the reveal never add more than this once the globe is ready. */
export const INTRO_EXTRA_CAP_MS = 2500;
/** Overlay exit, globe fade-up and headline rise. */
export const INTRO_REVEAL_MS = 1100;

export function createIntroStore(initial: IntroPhase = "off") {
  let state: IntroState = { phase: initial, progress: 0, ready: false, failed: false };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<IntroState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  return {
    get: (): IntroState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (state.phase === "off") set({ phase: "loading" });
    },
    /** Monotonic, clamped to 0…1; NaN is ignored. */
    setProgress(fraction: number) {
      const next = Math.min(1, Math.max(state.progress, fraction));
      if (next > state.progress) set({ progress: next });
    },
    markReady() {
      if (!state.ready) set({ ready: true, progress: 1 });
    },
    fail() {
      if (!state.failed) set({ failed: true });
    },
    reveal() {
      if (state.phase === "loading") set({ phase: "reveal" });
    },
    finish() {
      if (state.phase === "loading" || state.phase === "reveal") set({ phase: "done" });
    },
  };
}
export type IntroStore = ReturnType<typeof createIntroStore>;

/** The page-wide store. The inline gate (IntroGate.tsx) has already run when this module loads. */
export const introStore = createIntroStore(
  typeof document !== "undefined" && document.documentElement.dataset.intro === "play" ? "loading" : "off",
);
export const getIntroPhase = (): IntroPhase => introStore.get().phase;
export const getServerIntroPhase = (): IntroPhase => "off";
