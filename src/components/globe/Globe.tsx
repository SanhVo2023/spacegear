"use client";

import { useFrame, type RootState } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { ATMOSPHERE_RADIUS, AXIAL_TILT, CLOUD_DRIFT, CLOUD_RADIUS, IDLE_SPIN, INITIAL_SPIN } from "./constants";
import { applyGlobeTextures, createGlobeMaterials, LOOK } from "./materials";
import type { GlobeTextureSet } from "./textures";

/**
 * Per-frame inputs. The scene's driver writes them and the globe applies them in the same frame.
 * `idle`: the idle spin and the cloud drift run (false while the globe holds its opening pose).
 */
export type GlobeFrame = { sun: THREE.Vector3; spinBoost: number; tiltX: number; tiltY: number; reveal: number; flare: number; idle: boolean };
export function createGlobeFrame(): GlobeFrame {
  return { sun: new THREE.Vector3(0, 0, 1), spinBoost: 0, tiltX: 0, tiltY: 0, reveal: 1, flare: 1, idle: true };
}

const AXIS: [number, number, number] = [0, 0, AXIAL_TILT];
const SPIN_START: [number, number, number] = [0, INITIAL_SPIN, 0];
const TURN = Math.PI * 2;

type GlobeProps = {
  textures: GlobeTextureSet;
  frame: RefObject<GlobeFrame>;
  onFrame?: (frame: GlobeFrame, delta: number, state: RootState) => void;
};

/**
 * The Earth: a unit sphere with the day/night shader, a faster cloud shell and a fresnel atmosphere.
 * Hierarchy: pointer tilt → axial tilt → spin (surface and clouds); the atmosphere needs no spin.
 * Materials are created once and a new texture set (2k → 4k) is rebound in place. They are not
 * disposed on unmount: the globe only unmounts with its Canvas, whose context loss frees the GPU.
 */
export default function Globe({ textures, frame, onFrame }: GlobeProps) {
  const [materials] = useState(() => createGlobeMaterials(textures));
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const earth = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const atmosphere = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const earthMesh = earth.current;
    const cloudMesh = clouds.current;
    if (!earthMesh || !cloudMesh) return;
    applyGlobeTextures({ earth: earthMesh.material as THREE.ShaderMaterial, clouds: cloudMesh.material as THREE.ShaderMaterial }, textures);
  }, [textures]);

  useFrame((state, raw) => {
    const tiltGroup = tilt.current;
    const spinGroup = spin.current;
    const earthMesh = earth.current;
    const cloudMesh = clouds.current;
    const atmosphereMesh = atmosphere.current;
    if (!tiltGroup || !spinGroup || !earthMesh || !cloudMesh || !atmosphereMesh) return;
    const f = frame.current;
    const delta = Math.min(raw, 0.1);
    onFrame?.(f, delta, state);
    const idle = f.idle ? delta : 0;
    spinGroup.rotation.y += IDLE_SPIN * idle + f.spinBoost;
    // The clouds turn slightly faster than the surface; the earth shader offsets its cloud lookups
    // (shadows, glint and city-light dimming) by the same angle.
    cloudMesh.rotation.y = (cloudMesh.rotation.y + CLOUD_DRIFT * idle) % TURN;
    tiltGroup.rotation.set(f.tiltX, f.tiltY, 0);
    // uSunDir and uReveal are shared by every shell (materials.ts).
    const uniforms = (earthMesh.material as THREE.ShaderMaterial).uniforms;
    uniforms.uSunDir.value.copy(f.sun);
    uniforms.uReveal.value = f.reveal;
    uniforms.uCloudOffset.value = cloudMesh.rotation.y / TURN;
    (atmosphereMesh.material as THREE.ShaderMaterial).uniforms.uIntensity.value = LOOK.atmosphereIntensity * f.flare * f.reveal;
  });

  return (
    <group ref={tilt}>
      <group rotation={AXIS}>
        <group ref={spin} rotation={SPIN_START}>
          <mesh ref={earth} material={materials.earth}>
            <sphereGeometry args={[1, 128, 64]} />
          </mesh>
          <mesh ref={clouds} material={materials.clouds} renderOrder={1}>
            <sphereGeometry args={[CLOUD_RADIUS, 96, 48]} />
          </mesh>
        </group>
      </group>
      <mesh ref={atmosphere} material={materials.atmosphere} renderOrder={2}>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, 64, 32]} />
      </mesh>
    </group>
  );
}
