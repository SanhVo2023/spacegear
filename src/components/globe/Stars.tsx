"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { STARS } from "./constants";

/** mulberry32: a small seeded generator, so every load draws the same sky as the poster. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// drei's starfield shader without the pulse (its size followed sin(time), so the live sky would never
// match the poster): soft round points whose size falls off with distance. Tone mapping and the output
// colour space apply as for the rest of the scene.
const VERTEX = /* glsl */ `
attribute float size;
varying vec3 vColor;
void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (${STARS.pointScale.toFixed(1)} / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}`;
const FRAGMENT = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = distance(gl_PointCoord, vec2(0.5));
  gl_FragColor = vec4(vColor, 1.0 / (1.0 + exp(16.0 * (d - 0.25))));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * The 3D stars of the desktop backdrop: drei's <Stars> distribution (a shell of STARS.count points between
 * STARS.near and STARS.far, sizes 0.5…1 × STARS.factor), drawn from a fixed seed so the poster and every
 * load show the same sky, and still (no pulse). They lie beyond the galaxy sphere, which is drawn first
 * without writing depth (Backdrop.tsx), so they show over it and only the globe hides them.
 */
export default function Stars() {
  const [geometry, material] = useMemo(() => {
    const random = seeded(STARS.seed);
    const positions = new Float32Array(STARS.count * 3);
    const colors = new Float32Array(STARS.count * 3);
    const sizes = new Float32Array(STARS.count);
    const color = new THREE.Color();
    const point = new THREE.Vector3();
    const spherical = new THREE.Spherical();
    const step = (STARS.far - STARS.near) / STARS.count;
    let radius = STARS.far;
    for (let i = 0; i < STARS.count; i++) {
      sizes[i] = (0.5 + 0.5 * random()) * STARS.factor;
      radius -= step * random() * 2;
      point.setFromSpherical(spherical.set(Math.max(STARS.near, radius), Math.acos(1 - random() * 2), random() * 2 * Math.PI));
      point.toArray(positions, i * 3);
      color.setHSL(i / STARS.count, STARS.saturation, STARS.lightness);
      color.toArray(colors, i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      name: "BackdropStars",
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return [geometry, material] as const;
  }, []);
  return <points geometry={geometry} material={material} />;
}
