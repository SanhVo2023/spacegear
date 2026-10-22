"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { SKY_TURN, STAR_PARALLAX } from "./constants";
import { openingRamp, unitOrZero, type PointerInput } from "./interaction";
import Stars from "./Stars";

// The visible sun: a faint warm haze in the upper-left corner, behind the globe. Placed high and wide
// enough that the disc stays clear of the hero copy on common desktop viewports.
const SUN_POSITION: [number, number, number] = [-20, 12.5, -26];

function sunGlow(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,244,222,1)");
  gradient.addColorStop(0.22, "rgba(255,205,150,0.85)");
  gradient.addColorStop(0.5, "rgba(250,140,80,0.28)");
  gradient.addColorStop(1, "rgba(250,110,67,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

type BackdropProps = {
  galaxy: THREE.Texture;
  pointer: RefObject<PointerInput>;
  /** The scene's first-frame state: the sky holds still while the globe holds its opening pose. */
  settled: RefObject<{ announced: boolean; announcedAt: number }>;
};

/**
 * Galaxy sphere, 3D stars and the visible sun. They drift slightly against the cursor (parallax)
 * while the globe tilts toward it. Everything here lies behind the origin, so a turn of the group
 * in the same sense as the globe's tilt moves it the other way on screen. Through the canvas's fade-in
 * over the poster the sky neither turns nor follows the cursor, so it lands on the poster; then both ease
 * in with the opening ramp.
 */
export default function Backdrop({ galaxy, pointer, settled }: BackdropProps) {
  const parallax = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);
  const glow = useMemo(() => sunGlow(), []);

  useFrame((_, raw) => {
    const ramp = openingRamp(settled.current, performance.now() / 1000);
    const delta = Math.min(raw, 0.1);
    if (sky.current) sky.current.rotation.y += delta * SKY_TURN * ramp;
    const group = parallax.current;
    if (!group) return;
    const input = pointer.current;
    // Signs are the reverse of the plan's code (-x, +y), which moved the backdrop toward the cursor.
    const aim = STAR_PARALLAX * ramp;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, unitOrZero(input.x) * aim, 3, delta);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, -unitOrZero(input.y) * aim * 0.6, 3, delta);
  });

  return (
    <group ref={parallax}>
      <Stars />
      {/* The sky is the background: drawn first and without writing depth, so the 3D stars beyond it show
          over it and only the globe hides them. */}
      <mesh ref={sky} scale={120} renderOrder={-1}>
        <sphereGeometry args={[1, 64, 64]} />
        {/* slight multiply keeps it calm while letting the nebula read clearly */}
        <meshBasicMaterial map={galaxy} color="#b6b6c0" side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <group position={SUN_POSITION}>
        <mesh>
          <sphereGeometry args={[0.45, 24, 24]} />
          <meshBasicMaterial color="#ffe9cf" toneMapped={false} />
        </mesh>
        <sprite scale={[9, 9, 1]}>
          <spriteMaterial map={glow} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </group>
  );
}
