"use client";

import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

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

/** Galaxy sphere, 3D stars and the visible sun (moved here from the previous EarthScene). */
export default function Backdrop({ galaxy }: { galaxy: THREE.Texture }) {
  const sky = useRef<THREE.Mesh>(null);
  const glow = useMemo(() => sunGlow(), []);

  useFrame((_, raw) => {
    if (sky.current) sky.current.rotation.y += Math.min(raw, 0.1) * 0.004;
  });

  return (
    <group>
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
