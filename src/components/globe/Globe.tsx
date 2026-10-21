"use client";

import { useFrame, type RootState } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { AXIAL_TILT, IDLE_SPIN, INITIAL_SPIN } from "./constants";
import { applyGlobeTextures, createGlobeMaterials } from "./materials";
import type { GlobeTextureSet } from "./textures";

/** Per-frame inputs. The scene's driver writes them and the globe applies them in the same frame. */
export type GlobeFrame = { sun: THREE.Vector3; spinBoost: number; tiltX: number; tiltY: number; reveal: number; flare: number };
export function createGlobeFrame(): GlobeFrame {
  return { sun: new THREE.Vector3(0, 0, 1), spinBoost: 0, tiltX: 0, tiltY: 0, reveal: 1, flare: 1 };
}

const AXIS: [number, number, number] = [0, 0, AXIAL_TILT];
const SPIN_START: [number, number, number] = [0, INITIAL_SPIN, 0];

type GlobeProps = {
  textures: GlobeTextureSet;
  frame: RefObject<GlobeFrame>;
  onFrame?: (frame: GlobeFrame, delta: number, state: RootState) => void;
};

/**
 * The Earth: a unit sphere with the day/night shader. Hierarchy: pointer tilt → axial tilt → spin.
 * The material is created once and a new texture set is rebound in place. It is not disposed on
 * unmount: the globe only unmounts with its Canvas, whose context loss frees the GPU.
 */
export default function Globe({ textures, frame, onFrame }: GlobeProps) {
  const [materials] = useState(() => createGlobeMaterials(textures));
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const earth = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const earthMesh = earth.current;
    if (earthMesh) applyGlobeTextures({ earth: earthMesh.material as THREE.ShaderMaterial }, textures);
  }, [textures]);

  useFrame((state, raw) => {
    const tiltGroup = tilt.current;
    const spinGroup = spin.current;
    const earthMesh = earth.current;
    if (!tiltGroup || !spinGroup || !earthMesh) return;
    const f = frame.current;
    const delta = Math.min(raw, 0.1);
    onFrame?.(f, delta, state);
    spinGroup.rotation.y += IDLE_SPIN * delta + f.spinBoost;
    tiltGroup.rotation.set(f.tiltX, f.tiltY, 0);
    const uniforms = (earthMesh.material as THREE.ShaderMaterial).uniforms;
    uniforms.uSunDir.value.copy(f.sun);
    uniforms.uReveal.value = f.reveal;
  });

  return (
    <group ref={tilt}>
      <group rotation={AXIS}>
        <group ref={spin} rotation={SPIN_START}>
          <mesh ref={earth} material={materials.earth}>
            <sphereGeometry args={[1, 128, 64]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
