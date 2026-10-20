"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, useGLTF, useTexture } from "@react-three/drei";
import { type MotionValue } from "motion/react";
import { Suspense, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

const MODEL = "/models/earth-hq.glb";
const GALAXY = "/images/galaxy.webp";

/* ---- scroll math (used inside useFrame; no React state) ---- */
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mapClamp = (
  x: number,
  inA: number,
  inB: number,
  outA: number,
  outB: number
) => {
  const t = clamp01((x - inA) / (inB - inA));
  return outA + (outB - outA) * t;
};
// While paused offscreen (frameloop "never"), a frame that still runs in
// `never` mode can get a huge delta (R3F passes the rAF timestamp in ms); cap
// it so the globe and galaxy keep turning smoothly instead of jumping to a
// random angle.
const spin = (delta: number) => Math.min(delta, 0.1);

// The visible sun sits in the upper-left of the frame (behind the globe), while
// the key light comes from a front-left angle so the camera-facing hemisphere
// stays lit. Sharing the x/y keeps the lighting visually consistent with the sun.
const SUN_POS = new THREE.Vector3(-9, 5.5, -26);
const LIGHT_POS = new THREE.Vector3(-4, 2.5, 4);

function Earth() {
  const { scene } = useGLTF(MODEL, "/draco/");
  const group = useRef<THREE.Group>(null);

  const prepared = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial;
        if (mat.emissiveMap) {
          mat.emissive = new THREE.Color("#ffd9a0");
          mat.emissiveIntensity = 2.4;
        }
        mat.toneMapped = true;
        mat.needsUpdate = true;
      });
    });
    return copy;
  }, [scene]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += spin(delta) * 0.035;
  });

  return (
    <group ref={group} rotation={[0, 0, 0.41]}>
      <primitive object={prepared} />
    </group>
  );
}

function Atmosphere({ progress }: { progress: MotionValue<number> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uInner: { value: new THREE.Color("#2b6cff") },
      uOuter: { value: new THREE.Color("#fa6e43") },
      uOpacity: { value: 0.85 },
    }),
    []
  );
  useFrame(() => {
    if (mat.current)
      mat.current.uniforms.uOpacity.value = mapClamp(
        progress.get(),
        0.45,
        0.65,
        0.85,
        0.5
      );
  });
  return (
    <mesh scale={2.5}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={mat}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal; varying vec3 vEye;
          void main(){
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            vEye = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`}
        fragmentShader={`
          varying vec3 vNormal; varying vec3 vEye;
          uniform vec3 uInner; uniform vec3 uOuter; uniform float uOpacity;
          void main(){
            float f = pow(1.0 - abs(dot(vNormal, vEye)), 2.4);
            vec3 col = mix(uInner, uOuter, smoothstep(0.2, 0.9, f));
            gl_FragColor = vec4(col, f * uOpacity);
          }`}
      />
    </mesh>
  );
}

/** Rig drives the scroll motion: Earth starts on the RIGHT showing half of it,
 *  then pulls back (zooms OUT) to the full planet centered. Never zooms in. */
function Rig({
  progress,
  children,
}: {
  progress: MotionValue<number>;
  children: ReactNode;
}) {
  const rig = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const g = rig.current;
    if (!g) return;
    const p = progress.get();
    const scaleT = mapClamp(p, 0.1, 0.62, 0.62, 0.26); // shrink → crisp full globe
    const xT = mapClamp(p, 0.1, 0.62, 2.4, 0); // side → center
    const s = THREE.MathUtils.damp(g.scale.x, scaleT, 5, delta);
    g.scale.setScalar(s);
    g.position.x = THREE.MathUtils.damp(g.position.x, xT, 5, delta);
  });
  return (
    <group ref={rig} scale={0.62} position={[2.4, 0, 0]}>
      {children}
    </group>
  );
}

/** Equirectangular-ish galaxy on a giant inverted sphere — the cosmic backdrop. */
function Galaxy() {
  const source = useTexture(GALAXY);
  const tex = useMemo(() => { const copy = source.clone(); copy.colorSpace = THREE.SRGBColorSpace; return copy; }, [source]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += spin(delta) * 0.004;
  });
  return (
    <mesh ref={ref} scale={120}>
      <sphereGeometry args={[1, 64, 64]} />
      {/* slight multiply keeps it calm while letting the nebula read clearly */}
      <meshBasicMaterial map={tex} color="#b6b6c0" side={THREE.BackSide} />
    </mesh>
  );
}

/** Visible sun: a bright core plus an additive radial glow sprite. */
function Sun() {
  const glow = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(255,244,222,1)");
    grd.addColorStop(0.22, "rgba(255,205,150,0.85)");
    grd.addColorStop(0.5, "rgba(250,140,80,0.28)");
    grd.addColorStop(1, "rgba(250,110,67,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  // A faint, distant sun — barely a warm haze in the corner. No flare.
  return (
    <group position={SUN_POS}>
      <mesh>
        <sphereGeometry args={[0.45, 24, 24]} />
        <meshBasicMaterial color="#ffe9cf" toneMapped={false} />
      </mesh>
      <sprite scale={[5, 5, 1]}>
        <spriteMaterial
          map={glow}
          transparent
          opacity={0.45}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}

/** FPV mouse-look: camera flies/looks around the globe following the cursor. */
function FpvCamera() {
  useFrame((state, delta) => {
    const { camera, pointer } = state;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 1.7, 3, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, pointer.y * 1.1, 3, delta);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function EarthScene({
  progress,
  dpr = [1, 2],
  active = true,
}: {
  progress: MotionValue<number>;
  dpr?: [number, number];
  active?: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.2], fov: 38 }}
      dpr={dpr}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.2;
      }}
      className="!absolute inset-0"
    >
      {/* key light from front-left (aligned with the sun's screen position) */}
      <directionalLight
        position={LIGHT_POS.toArray()}
        intensity={3.6}
        color="#fff4e8"
      />
      <directionalLight position={[6, -2, 3]} intensity={0.4} color="#9bbcff" />
      <ambientLight intensity={0.18} />

      <Suspense fallback={null}>
        {/* real 3D star field — parallaxes with the FPV camera for true depth.
            Inside Suspense so it appears with the scene, not over the poster's
            baked-in stars while the model loads. */}
        <Stars radius={45} depth={55} count={7000} factor={7} saturation={0} fade speed={0.5} />
        <Galaxy />
        <Sun />
        <Rig progress={progress}>
          <Earth />
          <Atmosphere progress={progress} />
        </Rig>
      </Suspense>

      <FpvCamera />
    </Canvas>
  );
}

useGLTF.preload(MODEL, "/draco/");
