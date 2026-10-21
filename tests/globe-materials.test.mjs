import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

const { createGlobeMaterials, applyGlobeTextures } = await import("../src/components/globe/materials.ts");
const { BACKDROP_ENTRY, globeEntries } = await import("../src/components/globe/textures.ts");

const MAPS = ["day", "night", "normal", "spec", "clouds"];
const fakeSet = () => Object.fromEntries(MAPS.map((key) => [key, new THREE.Texture()]));

test("texture entries come from the manifest with the right sampling kind", () => {
  for (const tier of ["1k", "2k", "4k"]) {
    const entries = globeEntries(tier);
    assert.deepEqual(entries.map((entry) => entry.key), MAPS);
    assert.ok(entries.every((entry) => entry.url === `/textures/earth/${tier}/${entry.key}.webp` && entry.bytes > 0), tier);
    assert.deepEqual(Object.fromEntries(entries.map((entry) => [entry.key, entry.kind])), { day: "color", night: "mask", normal: "data", spec: "mask", clouds: "mask" });
  }
  assert.deepEqual({ url: BACKDROP_ENTRY.url, kind: BACKDROP_ENTRY.kind }, { url: "/images/galaxy.webp", kind: "color" });
});

test("the earth material samples every map and is tone-mapped by the renderer", () => {
  const textures = fakeSet();
  const { earth } = createGlobeMaterials(textures);
  for (const [uniform, key] of [["uDay", "day"], ["uNight", "night"], ["uNormal", "normal"], ["uSpec", "spec"], ["uClouds", "clouds"]]) {
    assert.equal(earth.uniforms[uniform].value, textures[key], uniform);
  }
  assert.equal(earth.toneMapped, true);
  assert.equal(earth.uniforms.uNormalGain.value, 4);
  assert.match(earth.fragmentShader, /#include <tonemapping_fragment>\s*#include <colorspace_fragment>/);
  assert.ok(earth.uniforms.uTwilight.value.equals(new THREE.Color("#fa6e43")), "brand orange twilight");
});

test("a new tier is rebound in place", () => {
  const first = fakeSet();
  const second = fakeSet();
  const materials = createGlobeMaterials(first);
  applyGlobeTextures(materials, second);
  for (const [uniform, key] of [["uDay", "day"], ["uNight", "night"], ["uNormal", "normal"], ["uSpec", "spec"], ["uClouds", "clouds"]]) {
    assert.equal(materials.earth.uniforms[uniform].value, second[key], uniform);
  }
});

test("no shader raises a possibly negative number to a power", () => {
  const materials = createGlobeMaterials(fakeSet());
  for (const material of Object.values(materials)) {
    assert.doesNotMatch(material.fragmentShader, /pow\(\s*\(/, `${material.name}: pow() of a bracketed difference can be negative`);
  }
});
