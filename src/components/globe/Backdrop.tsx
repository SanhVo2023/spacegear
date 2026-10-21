"use client";

import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { STAR_PARALLAX } from "./constants";
import type { PointerInput } from "./interaction";

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

/**
 * Galaxy sphere, 3D stars and the visible sun. They drift slightly against the cursor (parallax)
 * while the globe tilts toward it. Everything here lies behind the origin, so a turn of the group
 * in the same sense as the globe's tilt moves it the other way on screen.
 */
export default function Backdrop({ galaxy, pointer }: { galaxy: THREE.Texture; pointer: RefObject<PointerInput> }) {
  const parallax = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);
  const glow = useMemo(() => sunGlow(), []);

  useFrame((_, raw) => {
    const delta = Math.min(raw, 0.1);
    if (sky.current) sky.current.rotation.y += delta * 0.004;
    const group = parallax.current;
    if (!group) return;
    const input = pointer.current;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, input.x * STAR_PARALLAX, 3, delta);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, -input.y * STAR_PARALLAX * 0.6, 3, delta);
  });

  return (
    <group ref={parallax}>
      <Stars radius={45} depth={55} count={7000} factor={7} saturation={0} fade speed={0.5} />
      <mesh ref={sky} scale={120}>
        <sphereGeometry args={[1, 64, 64]} />
        {/* slight multiply keeps it calm while letting the nebula read clearly */}
        <meshBasicMaterial map={galaxy} color="#b6b6c0" side={THREE.BackSide} />
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
