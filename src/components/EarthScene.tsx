"use client";

import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, use, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import Backdrop from "@/components/globe/Backdrop";
import Globe, { createGlobeFrame, type GlobeFrame } from "@/components/globe/Globe";
import { CAMERA_FOV, CAMERA_Z, EXPOSURE, FLARE_GAIN, FLARE_SECONDS, MAX_TILT, MOBILE_FPS, MOBILE_RADIUS, MOBILE_SUN_T, REVEAL_DELAY_SECONDS, REVEAL_SECONDS, RIG_SCALE, RIG_X, STREAM_IDLE_FALLBACK_MS, STREAM_IDLE_TIMEOUT_MS, SUN_END, SUN_START } from "@/components/globe/constants";
import { readNavigatorFacts, rendererName } from "@/components/globe/device";
import { createDragState, createSpring, stepDrag, stepSpring, unitOrZero, type PointerInput } from "@/components/globe/interaction";
import { getIntroPhase, INTRO_CHUNK_SHARE, introStore } from "@/components/globe/intro-store";
import { cameraZAt, clamp01, rigAt, slerpDirection, smoothstep, sunDirectionAt } from "@/components/globe/scroll";
import { disposeTextureSet, globeEntries, loadHeroTextures, releaseSource, streamTextureSet, type GlobeTextureSet, type HeroTextures } from "@/components/globe/textures";
import { canStream4k, streamMayStart, type GlobeTier } from "@/components/globe/tiers";
import { usePointerInput } from "@/components/globe/usePointerInput";

export type SceneVariant = "cinematic" | "mobile";
export type EarthSceneProps = {
  variant: SceneVariant;
  active: boolean;
  /** Hero scroll progress 0…1 (cinematic only). */
  progress?: MotionValue<number>;
  /** The element that takes drag input (cinematic, fine pointers only; set once the globe is ready). */
  dragTarget?: RefObject<HTMLElement | null>;
  /** The first textured frame has rendered. */
  onReady: () => void;
  /** A sharper tier is now on screen (the 4k swap on capable desktops). */
  onTier?: (tier: GlobeTier) => void;
  /** The WebGL context was lost: drop the canvas and keep the poster. */
  onLost: () => void;
};

const MOBILE_SUN = slerpDirection(SUN_START, SUN_END, MOBILE_SUN_T);
const RIG_START: [number, number, number] = [RIG_X[0], 0, 0];

/**
 * canStream4k for this page: a desktop with a mouse or trackpad, a hardware GPU with 4096 px textures,
 * enough memory and a fast connection.
 */
function streams4k(gl: THREE.WebGLRenderer): boolean {
  return canStream4k({
    viewportWidth: window.innerWidth,
    finePointer: window.matchMedia("(pointer: fine) and (hover: hover)").matches,
    ...readNavigatorFacts(),
    maxTextureSize: gl.capabilities.maxTextureSize,
    renderer: rendererName(gl.getContext()),
  });
}

/** Runs `callback` once the browser is idle. Safari has no requestIdleCallback: a timer stands in. Returns a cancel function. */
function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: STREAM_IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(id);
  }
  const timer = window.setTimeout(callback, STREAM_IDLE_FALLBACK_MS);
  return () => window.clearTimeout(timer);
}

type RigProps = { progress: MotionValue<number>; settled: RefObject<{ announced: boolean }>; children: ReactNode };

/**
 * Scroll beats: right of centre, then shrinking to the centre. Held exactly at rigAt until the scene
 * is announced, so a mount in the middle of the hero fades in already in place; eased after that.
 */
function Rig({ progress, settled, children }: RigProps) {
  const rig = useRef<THREE.Group>(null);
  // The target is recomputed only when the scroll progress changes.
  const target = useRef({ p: Number.NaN, scale: RIG_SCALE[0], x: RIG_X[0] });
  useFrame((_, raw) => {
    const group = rig.current;
    if (!group) return;
    const t = target.current;
    const p = progress.get();
    if (p !== t.p) {
      const placement = rigAt(p);
      t.p = p;
      t.scale = placement.scale;
      t.x = placement.x;
    }
    if (!settled.current.announced) {
      group.scale.setScalar(t.scale);
      group.position.x = t.x;
      return;
    }
    const delta = Math.min(raw, 0.1);
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, t.scale, 5, delta));
    group.position.x = THREE.MathUtils.damp(group.position.x, t.x, 5, delta);
  });
  return (
    <group ref={rig} scale={RIG_SCALE[0]} position={RIG_START}>
      {children}
    </group>
  );
}

/**
 * Wall-clock seconds, for everything timed across frames. R3F's own clock restarts from 0 whenever the
 * frame loop pauses and resumes (the hero leaving the screen, a hidden tab), so a reveal timed on it
 * would replay from black on every return.
 */
const seconds = () => performance.now() / 1000;

type Warmup = {
  queued: boolean;
  pending: THREE.Texture[];
  compiling: boolean;
  compiled: boolean;
  /** When the scene was first made visible (wall-clock seconds; -1 until then). */
  shownAt: number;
  announced: boolean;
  /** When the first textured frame was announced (wall-clock seconds; -1 until then). */
  announcedAt: number;
  /** The globe became ready under the intro overlay, so it fades up from black when the overlay lifts. */
  played: boolean;
  /**
   * When the overlay started to lift (wall-clock seconds; -1 until then). On the wall clock, the reveal
   * keeps step with the curtain and the headline: scrolled away or hidden mid-reveal, the globe comes
   * back as far along as they are, not rewound.
   */
  revealStart: number;
};

/**
 * The 4k upgrade (capable desktops). waiting → idle (an idle callback is pending) → streaming → done,
 * or skipped (not capable) or failed. A failure keeps the 2k set and is never retried.
 */
type Upgrade = {
  status: "waiting" | "idle" | "streaming" | "done" | "skipped" | "failed";
  cancelIdle: () => void;
  controller: AbortController | null;
  /** Decoded 4k maps waiting for their GPU upload, one per frame. */
  queue: { texture: THREE.Texture; uploaded: () => void }[];
};

type ContentsProps = {
  variant: SceneVariant;
  load: Promise<HeroTextures>;
  active: boolean;
  progress?: MotionValue<number>;
  pointer: RefObject<PointerInput>;
  onReady: () => void;
  onTier?: (tier: GlobeTier) => void;
};

function SceneContents({ variant, load, active, progress, pointer, onReady, onTier }: ContentsProps) {
  const loaded = use(load);
  // The texture set on screen: the first set, then (capable desktops) the 4k set.
  const [globe, setGlobe] = useState<GlobeTextureSet>(loaded.globe);
  const shown = useRef<GlobeTextureSet>(loaded.globe);
  const root = useRef<THREE.Group>(null);
  const frame = useRef<GlobeFrame>(createGlobeFrame());
  const warm = useRef<Warmup>({ queued: false, pending: [], compiling: false, compiled: false, shownAt: -1, announced: false, announcedAt: -1, played: false, revealStart: -1 });
  const upgrade = useRef<Upgrade>({ status: "waiting", cancelIdle: () => {}, controller: null, queue: [] });
  // Frames run only while the hero is on screen in a visible tab (frameloop in EarthScene).
  const live = useRef(active);
  // Scroll targets, recomputed only when the progress changes.
  const scroll = useRef({ p: Number.NaN, cameraZ: CAMERA_Z, sun: new THREE.Vector3() });
  const tilt = useRef({ x: createSpring(), y: createSpring() });
  const drag = useRef(createDragState());

  // Queue the first set for one-per-frame GPU uploads.
  useEffect(() => {
    warm.current.pending = [...Object.values(loaded.globe), ...(loaded.backdrop ? [loaded.backdrop] : [])];
    warm.current.queued = true;
  }, [loaded]);

  useEffect(() => {
    live.current = active;
  }, [active]);

  // Phones and tablets render on demand (EarthScene), MOBILE_FPS frames a second while on screen in a
  // visible tab: the warm-up's uploads, then the slow idle spin. Off screen nothing asks for a frame.
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (variant === "cinematic" || !active) return;
    invalidate();
    const timer = window.setInterval(() => invalidate(), 1000 / MOBILE_FPS);
    return () => window.clearInterval(timer);
  }, [variant, active, invalidate]);

  // The reveal starts when the overlay starts to lift, even if no frame runs at that moment (a hidden
  // tab when the load cap fires); drive() falls back to its first frame after the lift.
  useEffect(
    () =>
      introStore.subscribe(() => {
        const w = warm.current;
        if (w.revealStart < 0 && w.announced && w.played && getIntroPhase() !== "loading") w.revealStart = seconds();
      }),
    [],
  );

  // Leaving the hero for good (the cinematic branch, a failure, a navigation): cancel a pending start
  // and abort the 4k stream, which frees every map it made; the queued maps are never uploaded.
  useEffect(() => {
    const u = upgrade.current;
    return () => {
      u.cancelIdle();
      u.controller?.abort();
      u.queue.length = 0;
    };
  }, []);

  // The swap. The Globe has already rebound all five maps in its own effect (children's effects run
  // first, and no frame runs between the two), so no frame ever mixes resolutions; free the 2k set.
  useEffect(() => {
    const previous = shown.current;
    shown.current = globe;
    if (previous === globe) return;
    disposeTextureSet(previous);
    onTier?.("4k");
  }, [globe, onTier]);

  // Streams the 4k set: each decoded map waits in the queue for a frame to upload it (upgradeStep),
  // and the next map is decoded only after that, so uploads pause while the hero is off screen.
  const startStream = (u: Upgrade) => {
    u.status = "streaming";
    const controller = new AbortController();
    u.controller = controller;
    streamTextureSet(globeEntries("4k"), {
      signal: controller.signal,
      upload: (texture) => new Promise<void>((uploaded) => { u.queue.push({ texture, uploaded }); }),
    }).then(
      (set) => {
        // Unmounted as the last upload landed: the set never goes on screen.
        if (controller.signal.aborted) return disposeTextureSet(set);
        u.status = "done";
        setGlobe(set);
      },
      () => {
        // A missing or undecodable map, a lost context or an unmount: the loader has freed every 4k
        // map it made. The 2k set stays on screen.
        u.status = "failed";
      },
    );
  };

  // After the first frame: one queued 4k upload per frame; otherwise, once the intro and the globe's
  // reveal (or, without them, the canvas fade-in and the copy's entrance) are over, ask capable
  // desktops to start the stream when the browser is idle.
  const upgradeStep = (state: RootState) => {
    const u = upgrade.current;
    const job = u.queue.shift();
    if (job) {
      state.gl.initTexture(job.texture);
      releaseSource(job.texture);
      job.uploaded();
      return;
    }
    if (u.status !== "waiting") return;
    const w = warm.current;
    const now = seconds();
    const gate = { phase: getIntroPhase(), played: w.played, revealElapsed: w.revealStart < 0 ? -1 : now - w.revealStart, shownElapsed: now - w.announcedAt };
    if (!streamMayStart(gate)) return;
    if (!streams4k(state.gl)) {
      u.status = "skipped";
      return;
    }
    u.status = "idle";
    u.cancelIdle = whenIdle(() => {
      // Off screen or in a hidden tab: wait for the next frame, which comes only once it is back.
      if (!live.current || document.hidden) u.status = "waiting";
      else startStream(u);
    });
  };

  // Warm-up: compile the programs without blocking (KHR_parallel_shader_compile), upload one
  // texture per frame so no single frame takes the whole upload, then show the scene. After that,
  // capable desktops stream the 4k set the same way.
  useFrame((state) => {
    const w = warm.current;
    const group = root.current;
    if (!group) return;
    if (w.announced) {
      if (variant === "cinematic") upgradeStep(state);
      return;
    }
    if (!w.compiling) {
      w.compiling = true;
      state.gl
        .compileAsync(group, state.camera, state.scene)
        .catch(() => undefined)
        .then(() => {
          w.compiled = true;
        });
    }
    const next = w.pending.shift();
    if (next) {
      state.gl.initTexture(next);
      releaseSource(next);
      return;
    }
    if (!w.queued || !w.compiled) return;
    if (!group.visible) {
      group.visible = true;
      w.shownAt = seconds();
      return;
    }
    if (seconds() <= w.shownAt) return;
    w.announced = true;
    w.announcedAt = seconds();
    if (variant === "cinematic") {
      // The first textured frame is on screen: the intro counter may reach 100. Under the overlay the
      // globe then waits, black, for the reveal (drive).
      w.played = getIntroPhase() === "loading";
      introStore.markReady();
    }
    onReady();
  });

  // Per-frame driver, called by the Globe before it applies the frame.
  const drive = (f: GlobeFrame, delta: number, state: RootState) => {
    const p = progress?.get() ?? 0;
    const targets = scroll.current;
    if (p !== targets.p) {
      targets.p = p;
      // The sun sweeps with scroll on desktop (the terminator crosses the face and the city lights
      // come on as the globe centres); phones keep a fixed crescent.
      const [sx, sy, sz] = variant === "cinematic" ? sunDirectionAt(p) : MOBILE_SUN;
      targets.sun.set(sx, sy, sz);
      // Slow camera dolly-in across the hero.
      targets.cameraZ = cameraZAt(p);
    }
    // Exact until the globe is on screen, so it fades in already in place; eased after that, so a
    // jump in scroll never snaps the light or the camera.
    const settled = warm.current.announced;
    if (settled) f.sun.lerp(targets.sun, 1 - Math.exp(-6 * delta)).normalize();
    else f.sun.copy(targets.sun);
    if (variant !== "cinematic") return;
    state.camera.position.z = settled ? THREE.MathUtils.damp(state.camera.position.z, targets.cameraZ, 3, delta) : targets.cameraZ;
    // Cursor tilt (spring, ≤ 6°) plus drag spin with inertia and a sprung pitch (fine pointers only).
    const input = pointer.current;
    f.spinBoost = stepDrag(input, drag.current, delta, window.innerWidth);
    f.tiltX = stepSpring(tilt.current.x, -unitOrZero(input.y) * MAX_TILT, delta) + drag.current.pitch.value;
    f.tiltY = stepSpring(tilt.current.y, unitOrZero(input.x) * MAX_TILT, delta);

    // Intro reveal. A globe that became ready under the overlay stays black until the overlay lifts and
    // for REVEAL_DELAY_SECONDS after (a silhouette against the galaxy, like an eclipse), then fades up
    // while the atmosphere flares once. Without the intro, or when the intro ended first (its load cap,
    // an input), the canvas itself fades in over the poster (globals.css).
    const w = warm.current;
    const covered = getIntroPhase() === "loading";
    if (!(w.announced ? w.played : covered)) {
      f.reveal = 1;
      f.flare = 1;
    } else if (covered) {
      f.reveal = 0;
      f.flare = 1;
    } else {
      if (w.revealStart < 0) w.revealStart = seconds();
      const t = seconds() - w.revealStart - REVEAL_DELAY_SECONDS;
      f.reveal = smoothstep(0, REVEAL_SECONDS, t);
      f.flare = 1 + FLARE_GAIN * Math.sin(Math.PI * clamp01(t / FLARE_SECONDS));
    }
  };

  const globeNode = <Globe textures={globe} frame={frame} onFrame={drive} />;
  return (
    <group ref={root} visible={false}>
      {variant === "cinematic" && loaded.backdrop && <Backdrop galaxy={loaded.backdrop} pointer={pointer} />}
      {variant === "cinematic" && progress ? <Rig progress={progress} settled={warm}>{globeNode}</Rig> : <group scale={MOBILE_RADIUS}>{globeNode}</group>}
    </group>
  );
}

/**
 * The hero globe. Desktop ("cinematic"): 2k textures plus the galaxy backdrop, the scroll beats,
 * cursor tilt and drag; its loading drives the intro counter. Once the intro is over and the browser
 * is idle, capable desktops stream the 4k set and swap it in place. Phones and tablets ("mobile"):
 * the 1k globe alone on a transparent canvas (no galaxy, no 3D stars), lit as a fixed crescent, taking
 * no input and rendered on demand at MOBILE_FPS; it never streams 4k.
 */
export default function EarthScene({ variant, active, progress, dragTarget, onReady, onTier, onLost }: EarthSceneProps) {
  const [load] = useState(() => {
    const promise = loadHeroTextures(variant === "cinematic" ? "2k" : "1k", {
      backdrop: variant === "cinematic",
      // The scene's own code chunk filled the counter's first INTRO_CHUNK_SHARE (OrbitalCinematic.tsx).
      onProgress: variant === "cinematic" ? (fraction) => introStore.setProgress(INTRO_CHUNK_SHARE + (1 - INTRO_CHUNK_SHARE) * fraction) : undefined,
    });
    // A failed load surfaces through use() → SceneBoundary; this only marks the rejection handled.
    promise.catch(() => undefined);
    return promise;
  });
  const cinematic = variant === "cinematic";
  const pointer = usePointerInput(dragTarget, cinematic);

  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      dpr={cinematic ? [1, 1.75] : [1, 1.5]}
      // Desktop: every display frame while on screen. Phones and tablets: on demand, MOBILE_FPS a second
      // (SceneContents). Off screen or in a hidden tab: no frames at all.
      frameloop={active ? (cinematic ? "always" : "demand") : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: cinematic ? "high-performance" : "default" }}
      onCreated={({ gl }) => {
        // ACES Filmic with sRGB output, as before: deep space blacks and a warm roll-off for the
        // over-bright city lights. Textures: colour maps sRGB, data maps linear.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        // R3F force-loses the context 500 ms after the Canvas unmounts; only a loss while the canvas
        // is still on the page is a real failure.
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", () => { if (canvas.isConnected) onLost(); }, { once: true });
        // A shader that fails to compile or link drops the canvas and keeps the poster.
        gl.debug.onShaderError = (context, program, vertexShader, fragmentShader) => {
          console.error("THREE.WebGLProgram: shader error", context.getProgramInfoLog(program), context.getShaderInfoLog(vertexShader), context.getShaderInfoLog(fragmentShader));
          onLost();
        };
      }}
      className="!absolute inset-0"
      // R3F gives its wrapper pointer-events: auto. The phone globe takes no input at all (no drag, no
      // tilt), so presses and touches over it reach the page and a swipe scrolls it.
      style={cinematic ? undefined : { pointerEvents: "none" }}
    >
      <Suspense fallback={null}>
        <SceneContents variant={variant} load={load} active={active} progress={progress} pointer={pointer} onReady={onReady} onTier={onTier} />
      </Suspense>
    </Canvas>
  );
}
