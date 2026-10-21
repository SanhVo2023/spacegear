"use client";

import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, use, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import Backdrop from "@/components/globe/Backdrop";
import Globe, { createGlobeFrame, type GlobeFrame } from "@/components/globe/Globe";
import { CAMERA_FOV, CAMERA_Z, EXPOSURE, FLARE_GAIN, FLARE_SECONDS, MAX_TILT, MOBILE_RADIUS, MOBILE_SUN_T, REVEAL_DELAY_SECONDS, REVEAL_SECONDS, RIG_SCALE, RIG_X, SUN_END, SUN_START } from "@/components/globe/constants";
import { createDragState, createSpring, stepDrag, stepSpring, unitOrZero, type PointerInput } from "@/components/globe/interaction";
import { getIntroPhase, INTRO_CHUNK_SHARE, introStore } from "@/components/globe/intro-store";
import { cameraZAt, clamp01, rigAt, slerpDirection, smoothstep, sunDirectionAt } from "@/components/globe/scroll";
import { loadHeroTextures, releaseSource, type HeroTextures } from "@/components/globe/textures";
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
  /** The WebGL context was lost: drop the canvas and keep the poster. */
  onLost: () => void;
};

const MOBILE_SUN = slerpDirection(SUN_START, SUN_END, MOBILE_SUN_T);
const RIG_START: [number, number, number] = [RIG_X[0], 0, 0];

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

type Warmup = {
  queued: boolean;
  pending: THREE.Texture[];
  compiling: boolean;
  compiled: boolean;
  shownAt: number;
  announced: boolean;
  /** The globe became ready under the intro overlay, so it fades up from black when the overlay lifts. */
  played: boolean;
  /** Clock time of the first frame after the overlay lifted (-1 until then). */
  revealStart: number;
};

type ContentsProps = {
  variant: SceneVariant;
  load: Promise<HeroTextures>;
  progress?: MotionValue<number>;
  pointer: RefObject<PointerInput>;
  onReady: () => void;
};

function SceneContents({ variant, load, progress, pointer, onReady }: ContentsProps) {
  const loaded = use(load);
  const root = useRef<THREE.Group>(null);
  const frame = useRef<GlobeFrame>(createGlobeFrame());
  const warm = useRef<Warmup>({ queued: false, pending: [], compiling: false, compiled: false, shownAt: -1, announced: false, played: false, revealStart: -1 });
  // Scroll targets, recomputed only when the progress changes.
  const scroll = useRef({ p: Number.NaN, cameraZ: CAMERA_Z, sun: new THREE.Vector3() });
  const tilt = useRef({ x: createSpring(), y: createSpring() });
  const drag = useRef(createDragState());

  // Queue the first set for one-per-frame GPU uploads.
  useEffect(() => {
    warm.current.pending = [...Object.values(loaded.globe), ...(loaded.backdrop ? [loaded.backdrop] : [])];
    warm.current.queued = true;
  }, [loaded]);

  // Warm-up: compile the programs without blocking (KHR_parallel_shader_compile), upload one
  // texture per frame so no single frame takes the whole upload, then show the scene.
  useFrame((state) => {
    const w = warm.current;
    const group = root.current;
    if (!group || w.announced) return;
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
      w.shownAt = state.clock.elapsedTime;
      return;
    }
    if (state.clock.elapsedTime <= w.shownAt) return;
    w.announced = true;
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
      if (w.revealStart < 0) w.revealStart = state.clock.elapsedTime;
      const t = state.clock.elapsedTime - w.revealStart - REVEAL_DELAY_SECONDS;
      f.reveal = smoothstep(0, REVEAL_SECONDS, t);
      f.flare = 1 + FLARE_GAIN * Math.sin(Math.PI * clamp01(t / FLARE_SECONDS));
    }
  };

  const globeNode = <Globe textures={loaded.globe} frame={frame} onFrame={drive} />;
  return (
    <group ref={root} visible={false}>
      {variant === "cinematic" && loaded.backdrop && <Backdrop galaxy={loaded.backdrop} pointer={pointer} />}
      {variant === "cinematic" && progress ? <Rig progress={progress} settled={warm}>{globeNode}</Rig> : <group scale={MOBILE_RADIUS}>{globeNode}</group>}
    </group>
  );
}

/**
 * The hero globe. Desktop ("cinematic"): 2k textures plus the galaxy backdrop, the scroll beats,
 * cursor tilt and drag; its loading drives the intro counter. Phones and tablets ("mobile"): the 1k
 * globe alone.
 */
export default function EarthScene({ variant, active, progress, dragTarget, onReady, onLost }: EarthSceneProps) {
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
  const pointer = usePointerInput(dragTarget, variant === "cinematic");

  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      dpr={variant === "cinematic" ? [1, 1.75] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: variant === "cinematic" ? "high-performance" : "default" }}
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
    >
      <Suspense fallback={null}>
        <SceneContents variant={variant} load={load} progress={progress} pointer={pointer} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
