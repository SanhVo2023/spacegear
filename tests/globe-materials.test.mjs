import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

const { LOOK, createGlobeMaterials, applyGlobeTextures } = await import("../src/components/globe/materials.ts");
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

test("the ocean glint is two lobes whose shape and strength come from LOOK", () => {
  const { earth } = createGlobeMaterials(fakeSet());
  const u = earth.uniforms;
  assert.deepEqual(
    [u.uGlintExp.value, u.uGlintGain.value, u.uSheenExp.value, u.uSheenGain.value],
    [LOOK.glintExponent, LOOK.glintGain, LOOK.sheenExponent, LOOK.sheenGain],
  );
  assert.ok(u.uSunColor.value.equals(new THREE.Color(LOOK.sunColor).multiplyScalar(LOOK.sunIntensity)), "sun colour × LOOK.sunIntensity");
  assert.match(earth.fragmentShader, /uGlintGain \* pow\(nh, uGlintExp\) \+ uSheenGain \* pow\(nh, uSheenExp\)/);
  assert.doesNotMatch(earth.fragmentShader, /140\.0|\* 0\.7;/, "no hard-coded glint exponent or gain");
});

test("the earth shader builds its tangent frame per fragment and decodes relief without bias", () => {
  const { earth } = createGlobeMaterials(fakeSet());
  // East and north from the spin axis at each fragment: no interpolated east/north/cos(latitude) varyings.
  assert.match(earth.vertexShader, /vAxisW = normalize\(mat3\(modelMatrix\) \* vec3\(0\.0, 1\.0, 0\.0\)\)/);
  assert.match(earth.fragmentShader, /vec3 east = cross\(vAxisW, n0\);[\s\S]*float cosLat = length\(east\);[\s\S]*vec3 north = cross\(n0, east\);/);
  assert.doesNotMatch(`${earth.vertexShader}\n${earth.fragmentShader}`, /vEastW|vNorthW|vCosLat/);
  // The encoder (scripts/build-globe-textures.mjs) stores flat as 128 in both channels, × NORMAL_GAIN.
  assert.match(earth.fragmentShader, /\.rg \* 255\.0 - 128\.0\) \/ \(127\.5 \* uNormalGain\)/);
  // Relief never lights the night side, and the twilight band still shows over dark oceans.
  assert.match(earth.fragmentShader, /max\(dot\(n, sun\), 0\.0\) \* smoothstep\(-0\.04, 0\.02, sunDot\)/);
  assert.match(earth.fragmentShader, /\(albedo \+ 0\.04\) \* uTwilight \* twilight \* uTwilightGain/);
});

test("no shader raises a possibly negative number to a power", () => {
  const materials = createGlobeMaterials(fakeSet());
  for (const material of Object.values(materials)) {
    assert.doesNotMatch(material.fragmentShader, /pow\(\s*\(/, `${material.name}: pow() of a bracketed difference can be negative`);
  }
});
