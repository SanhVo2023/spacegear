import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

const { LOOK, createGlobeMaterials, applyGlobeTextures } = await import("../src/components/globe/materials.ts");
const { BACKDROP_ENTRY, globeEntries } = await import("../src/components/globe/textures.ts");
const { ATMOSPHERE_RADIUS, CLOUD_RADIUS } = await import("../src/components/globe/constants.ts");

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
  assert.ok(earth.uniforms.uTwilight.value.equals(new THREE.Color(LOOK.twilight)), "twilight colour from LOOK");
  assert.equal(earth.uniforms.uCityGain.value, LOOK.cityGain, "city-light gain from LOOK");
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
  // Relief never lights the night side.
  assert.match(earth.fragmentShader, /max\(dot\(n, sun\), 0\.0\) \* smoothstep\(-0\.04, 0\.02, sunDot\)/);
});

test("no shader raises a possibly negative number to a power", () => {
  const materials = createGlobeMaterials(fakeSet());
  for (const material of Object.values(materials)) {
    assert.doesNotMatch(material.fragmentShader, /pow\(\s*\(/, `${material.name}: pow() of a bracketed difference can be negative`);
  }
});

test("clouds are a transparent shell that never writes depth", () => {
  const textures = fakeSet();
  const { clouds } = createGlobeMaterials(textures);
  assert.equal(clouds.transparent, true);
  assert.equal(clouds.depthWrite, false);
  assert.equal(clouds.uniforms.uClouds.value, textures.clouds);
  assert.equal(clouds.uniforms.uOpacity.value, LOOK.cloudOpacity);
});

test("the atmosphere is an additive back-face fresnel shell", () => {
  const { atmosphere } = createGlobeMaterials(fakeSet());
  assert.equal(atmosphere.side, THREE.BackSide);
  assert.equal(atmosphere.blending, THREE.AdditiveBlending);
  assert.equal(atmosphere.depthWrite, false);
  assert.ok(Math.abs(atmosphere.uniforms.uRimDepth.value - Math.sqrt(1 - 1 / ATMOSPHERE_RADIUS ** 2)) < 1e-12);
});

test("a new tier reaches the cloud shell too", () => {
  const second = fakeSet();
  const materials = createGlobeMaterials(fakeSet());
  applyGlobeTextures(materials, second);
  assert.equal(materials.clouds.uniforms.uClouds.value, second.clouds);
});

test("one sun direction drives every shell", () => {
  const { earth, clouds, atmosphere } = createGlobeMaterials(fakeSet());
  assert.equal(earth.uniforms.uSunDir, clouds.uniforms.uSunDir);
  assert.equal(earth.uniforms.uSunDir, atmosphere.uniforms.uSunDir);
  assert.equal(earth.uniforms.uReveal, clouds.uniforms.uReveal);
});

test("the twilight, cloud and atmosphere look comes from LOOK", () => {
  const { earth, clouds, atmosphere } = createGlobeMaterials(fakeSet());
  const e = earth.uniforms;
  const c = clouds.uniforms;
  const a = atmosphere.uniforms;
  // The twilight band is weighted by albedo luminance plus a floor, so it still shows over dark oceans.
  assert.deepEqual([e.uTwilightGain.value, e.uTwilightFloor.value], [LOOK.twilightGain, LOOK.twilightFloor]);
  assert.ok(LOOK.twilightFloor > 0, "the twilight band shows over dark oceans");
  // Cloud shadows are cast from the shell's real height.
  assert.ok(Math.abs(e.uCloudHeight.value - (CLOUD_RADIUS - 1)) < 1e-12, "cloud height from CLOUD_RADIUS");
  assert.deepEqual(
    [c.uOpacity.value, c.uCloudGain.value, c.uCloudAmbient.value, c.uCloudTwilightGain.value, c.uNightRim.value, c.uRimPower.value],
    [LOOK.cloudOpacity, LOOK.cloudGain, LOOK.cloudAmbient, LOOK.cloudTwilightGain, LOOK.cloudNightRim, LOOK.cloudRimPower],
  );
  assert.deepEqual(c.uCover.value.toArray(), [...LOOK.cloudCover]);
  assert.ok(c.uNightColor.value.equals(new THREE.Color(LOOK.cloudNight)), "moonlit cloud colour");
  assert.deepEqual(
    [a.uIntensity.value, a.uPower.value, a.uNightGain.value, a.uTwilightGain.value, a.uFloor.value, a.uForward.value, a.uForwardPower.value],
    [LOOK.atmosphereIntensity, LOOK.atmospherePower, LOOK.atmosphereNightGain, LOOK.atmosphereTwilightGain, LOOK.atmosphereFloor, LOOK.atmosphereForward, LOOK.atmosphereForwardPower],
  );
  assert.ok(a.uAtmoNight.value.equals(new THREE.Color(LOOK.atmosphereNight)), "night-side rim colour");
  assert.equal(a.uAtmoDay, earth.uniforms.uAtmoDay, "one day-side rim colour for the limb haze and the shell");
});

test("each shader declares exactly the uniforms its material wires", () => {
  const declared = (source) => [...source.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((match) => match[1]);
  for (const material of Object.values(createGlobeMaterials(fakeSet()))) {
    const names = new Set([...declared(material.vertexShader), ...declared(material.fragmentShader)]);
    assert.deepEqual([...names].sort(), Object.keys(material.uniforms).sort(), material.name);
  }
});

test("the atmosphere adds light without turning a transparent canvas opaque", () => {
  const { atmosphere } = createGlobeMaterials(fakeSet());
  // Premultiplied additive glow (ONE, ONE) whose alpha is set after the colour-space chunk: a
  // transparent canvas (the phone globe) stays see-through around the globe.
  assert.equal(atmosphere.premultipliedAlpha, true);
  assert.match(atmosphere.fragmentShader, /#include <colorspace_fragment>[\s\S]*gl_FragColor\.a = /);
});
