"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, use, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import Backdrop from "@/components/globe/Backdrop";
import Globe, { createGlobeFrame, type GlobeFrame } from "@/components/globe/Globe";
import { CAMERA_FOV, CAMERA_Z, EXPOSURE, MOBILE_RADIUS, MOBILE_SUN_T, RIG_SCALE, RIG_X, SUN_END, SUN_START } from "@/components/globe/constants";
import { normalize, rigAt, slerpDirection } from "@/components/globe/scroll";
import { loadHeroTextures, releaseSource, type HeroTextures } from "@/components/globe/textures";

export type SceneVariant = "cinematic" | "mobile";
export type EarthSceneProps = {
  variant: SceneVariant;
  active: boolean;
  /** Hero scroll progress 0…1 (cinematic only). */
  progress?: MotionValue<number>;
  /** The first textured frame has rendered. */
  onReady: () => void;
  /** The WebGL context was lost: drop the canvas and keep the poster. */
  onLost: () => void;
};

const CINEMATIC_SUN = normalize(SUN_START);
const MOBILE_SUN = slerpDirection(SUN_START, SUN_END, MOBILE_SUN_T);
const RIG_START: [number, number, number] = [RIG_X[0], 0, 0];

/** Scroll beats: right of centre, then shrinking to the centre (eased toward rigAt). */
function Rig({ progress, children }: { progress: MotionValue<number>; children: ReactNode }) {
  const rig = useRef<THREE.Group>(null);
  useFrame((_, raw) => {
    const group = rig.current;
    if (!group) return;
    const delta = Math.min(raw, 0.1);
    const target = rigAt(progress.get());
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, target.scale, 5, delta));
    group.position.x = THREE.MathUtils.damp(group.position.x, target.x, 5, delta);
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
};

type ContentsProps = {
  variant: SceneVariant;
  load: Promise<HeroTextures>;
  progress?: MotionValue<number>;
  onReady: () => void;
};

function SceneContents({ variant, load, progress, onReady }: ContentsProps) {
  const loaded = use(load);
  const root = useRef<THREE.Group>(null);
  const frame = useRef<GlobeFrame>(createGlobeFrame());
  const warm = useRef<Warmup>({ queued: false, pending: [], compiling: false, compiled: false, shownAt: -1, announced: false });

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
    onReady();
  });

  // Per-frame driver, called by the Globe before it applies the frame.
  const drive = (f: GlobeFrame) => {
    const [sx, sy, sz] = variant === "cinematic" ? CINEMATIC_SUN : MOBILE_SUN;
    f.sun.set(sx, sy, sz);
  };

  const globeNode = <Globe textures={loaded.globe} frame={frame} onFrame={drive} />;
  return (
    <group ref={root} visible={false}>
      {variant === "cinematic" && loaded.backdrop && <Backdrop galaxy={loaded.backdrop} />}
      {variant === "cinematic" && progress ? <Rig progress={progress}>{globeNode}</Rig> : <group scale={MOBILE_RADIUS}>{globeNode}</group>}
    </group>
  );
}

/**
 * The hero globe. Desktop ("cinematic"): 2k textures plus the galaxy backdrop and the scroll beats.
 * Phones and tablets ("mobile"): the 1k globe alone.
 */
export default function EarthScene({ variant, active, progress, onReady, onLost }: EarthSceneProps) {
  const [load] = useState(() => {
    const promise = loadHeroTextures(variant === "cinematic" ? "2k" : "1k", { backdrop: variant === "cinematic" });
    // A failed load surfaces through use() → SceneBoundary; this only marks the rejection handled.
    promise.catch(() => undefined);
    return promise;
  });

  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      dpr={variant === "cinematic" ? [1, 2] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: variant === "cinematic" ? "high-performance" : "default" }}
      onCreated={({ gl }) => {
        // ACES Filmic with sRGB output, as before: deep space blacks and a warm roll-off for the
        // over-bright city lights. Textures: colour maps sRGB, data maps linear.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
      }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <SceneContents variant={variant} load={load} progress={progress} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
