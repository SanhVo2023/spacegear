import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { MAPS, NORMAL_GAIN, TIERS, imageBytes, prepareMap, readGlb, sourceBuffers, sourceImages, tierImage } from "../scripts/build-globe-textures.mjs";

const { GLOBE_TEXTURES, GLOBE_TIERS, GLOBE_MAPS, BACKDROP_TEXTURE, NORMAL_GAIN: MANIFEST_GAIN } = await import("../src/components/globe/texture-manifest.ts");

// Spec budgets, in binary units: mobile ≤ 450 KiB, desktop first frame (2k) ≤ 900 KiB, full 4k set ≤ 2.5 MiB.
const BUDGET = { "1k": 450 * 1024, "2k": 900 * 1024, "4k": 2.5 * 1024 * 1024 };
// Everything the desktop scene downloads for its first frame: the 2k set plus the galaxy backdrop.
const FIRST_FRAME_BUDGET = 1_000_000;
const REBUILD = "re-run `node scripts/build-globe-textures.mjs`";
const repo = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const file = (url) => repo(`public${url}`);
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Mean of one channel over a longitude/latitude box of an upright equirectangular map. */
async function region(url, channel, [west, east], [south, north]) {
  const { width, height } = await sharp(file(url)).metadata();
  const left = Math.round(((west + 180) / 360) * width);
  const top = Math.round(((90 - north) / 180) * height);
  const box = { left, top, width: Math.round(((east + 180) / 360) * width) - left, height: Math.round(((90 - south) / 180) * height) - top };
  const { data } = await sharp(file(url)).extract(box).extractChannel(channel).raw().toBuffer({ resolveWithObject: true });
  return mean(data);
}

test("every tier holds the five maps as 2:1 WebP files that match the manifest", async () => {
  assert.deepEqual(GLOBE_TIERS, Object.keys(TIERS));
  assert.deepEqual(GLOBE_MAPS, MAPS);
  assert.deepEqual(Object.keys(GLOBE_TEXTURES), Object.keys(TIERS));
  for (const [tier, width] of Object.entries(TIERS)) {
    assert.deepEqual(Object.keys(GLOBE_TEXTURES[tier]), MAPS, tier);
    for (const map of MAPS) {
      const entry = GLOBE_TEXTURES[tier][map];
      assert.equal(entry.url, `/textures/earth/${tier}/${map}.webp`);
      const meta = await sharp(file(entry.url)).metadata();
      assert.equal(meta.format, "webp", entry.url);
      assert.equal(meta.width, width, `${entry.url} width; ${REBUILD}`);
      assert.equal(meta.height, width / 2, `${entry.url} height; ${REBUILD}`);
      assert.equal(meta.hasAlpha, false, `${entry.url} has no alpha channel`);
      assert.equal((await fs.stat(file(entry.url))).size, entry.bytes, `${entry.url} does not match the manifest; ${REBUILD}`);
    }
  }
});

test("the single-channel maps are grey and the day map keeps its colour", async () => {
  for (const tier of Object.keys(TIERS)) {
    for (const map of ["night", "spec", "clouds"]) {
      const [r, g, b] = (await sharp(file(GLOBE_TEXTURES[tier][map].url)).stats()).channels.map((channel) => channel.mean);
      assert.ok(Math.abs(r - g) < 0.5 && Math.abs(r - b) < 0.5, `${tier} ${map} is greyscale`);
    }
    const [r, , b] = (await sharp(file(GLOBE_TEXTURES[tier].day.url)).stats()).channels.map((channel) => channel.mean);
    assert.ok(b - r > 15, `${tier} day keeps its blue oceans`);
  }
});

test("each tier stays inside its download budget", () => {
  for (const [tier, budget] of Object.entries(BUDGET)) {
    const total = MAPS.reduce((sum, map) => sum + GLOBE_TEXTURES[tier][map].bytes, 0);
    assert.ok(total <= budget, `${tier}: ${total} bytes is over ${budget}`);
  }
});

test("the desktop first frame images stay within 1,000,000 bytes", () => {
  assert.ok(BACKDROP_TEXTURE.bytes > 0, "the galaxy backdrop is counted");
  const total = MAPS.reduce((sum, map) => sum + GLOBE_TEXTURES["2k"][map].bytes, 0) + BACKDROP_TEXTURE.bytes;
  assert.ok(total <= FIRST_FRAME_BUDGET, `desktop first frame images (2k set + galaxy): ${total} bytes is over ${FIRST_FRAME_BUDGET}`);
});

test("the maps are upright and encoded the way the shader decodes them", async () => {
  const tier = GLOBE_TEXTURES["1k"];
  // Ocean mask: white ocean, black land. The Arctic Ocean is the top rows, Antarctica the bottom ones.
  assert.ok((await region(tier.spec.url, 0, [-180, 180], [85, 90])) > 200, "the Arctic Ocean is at the top");
  assert.ok((await region(tier.spec.url, 0, [-180, 180], [-90, -81])) < 60, "Antarctica is at the bottom");
  // Clouds: coverage (mean ≈ 71), not the source's inverted alpha (mean ≈ 184).
  const clouds = (await sharp(file(tier.clouds.url)).stats()).channels[0].mean;
  assert.ok(clouds > 40 && clouds < 110, `cloud coverage mean ${clouds}`);
  // Night: city lights only; the blue land glow is gone.
  const night = (await sharp(file(tier.night.url)).stats()).channels[0];
  assert.ok(night.mean < 3 && night.max > 200, `night lights mean ${night.mean}, max ${night.max}`);
  // Normal: slopes re-centred on 128, relief that survived compression, Z up.
  const [x, y, z] = (await sharp(file(tier.normal.url)).stats()).channels;
  assert.ok(Math.abs(x.mean - 128) < 2 && Math.abs(y.mean - 128) < 2, `normal map centred (${x.mean}, ${y.mean})`);
  assert.ok(x.stdev > 2 && y.stdev > 2, "relief survives compression");
  assert.ok(z.mean > 250, "normal Z channel");
  assert.equal(MANIFEST_GAIN, NORMAL_GAIN);
});

test("east is east and the relief slopes have the right sign", async () => {
  const tier = GLOBE_TEXTURES["1k"];
  // Ocean mask: the central Pacific is ocean and the Congo basin is land (a mirrored map puts the Atlantic there).
  const pacific = await region(tier.spec.url, 0, [-152.5, -147.5], [-2.5, 2.5]);
  assert.ok(pacific > 240, `the Pacific at 150°W, 0° is ocean (${pacific.toFixed(1)})`);
  const africa = await region(tier.spec.url, 0, [19.5, 24.5], [-0.5, 4.5]);
  assert.ok(africa < 15, `Central Africa at 22°E, 2°N is land (${africa.toFixed(1)})`);
  // Normal: G − 128 is the northward tilt, R − 128 the eastward tilt.
  const himalaya = (await region(tier.normal.url, 1, [78, 90], [26, 30])) - 128;
  assert.ok(himalaya < -1, `the Himalaya's south flank faces south (G − 128 = ${himalaya.toFixed(2)})`);
  const andes = (await region(tier.normal.url, 0, [-80, -74], [-18, -5])) - 128;
  assert.ok(andes < -1, `the Andes' west flank faces west (R − 128 = ${andes.toFixed(2)})`);
});

test("the normal gain is applied before the downsample, so the 1k tier keeps sub-level slopes", async () => {
  const { gltf, bin } = readGlb(await fs.readFile(repo("public/models/earth-4k.glb")));
  const normal = await prepareMap("normal", await sourceBuffers(gltf, bin));
  const { data, info } = await tierImage("normal", normal, TIERS["1k"]).raw().toBuffer({ resolveWithObject: true });
  const east = new Set();
  for (let i = 0; i < data.length; i += info.channels) east.add(data[i]);
  // Gaining after the resize multiplies already-rounded levels, which leaves 44; gaining first leaves about 133.
  assert.ok(east.size > 100, `the 1k normal map has ${east.size} distinct east-slope levels before encoding`);
});

test("source maps are found through the materials, not the image order", async () => {
  const { gltf, bin } = readGlb(await fs.readFile(repo("public/models/earth-4k.glb")));
  assert.deepEqual(sourceImages(gltf), { day: 0, night: 2, normal: 3, roughness: 1, clouds: 4 });
  assert.deepEqual(Object.keys(await sourceBuffers(gltf, bin)), ["day", "night", "normal", "roughness", "clouds"]);
});

test("a source without the expected maps fails with a named error", async () => {
  const { gltf, bin } = readGlb(await fs.readFile(repo("public/models/earth-4k.glb")));
  const withoutRoughness = structuredClone(gltf);
  delete withoutRoughness.materials.find((material) => material.normalTexture).pbrMetallicRoughness.metallicRoughnessTexture;
  assert.throws(() => sourceImages(withoutRoughness), { name: "GlobeSourceError", message: /metallicRoughnessTexture/ });

  const byUri = structuredClone(gltf);
  byUri.images[0] = { uri: "day.webp" };
  assert.throws(() => imageBytes(byUri, bin, 0), { name: "GlobeSourceError", message: /URI/ });

  // A smaller source would make the tiers upscales (and a non-2:1 one would be cropped).
  const small = await sharp({ create: { width: 64, height: 32, channels: 3, background: "#000" } }).webp().toBuffer();
  const tiny = { ...gltf, bufferViews: gltf.bufferViews.map(() => ({ buffer: 0, byteOffset: 0, byteLength: small.length })) };
  await assert.rejects(sourceBuffers(tiny, small), { name: "GlobeSourceError", message: /64×32/ });
});

test("the backdrop entry is the shipped galaxy image", async () => {
  assert.equal(BACKDROP_TEXTURE.url, "/images/galaxy.webp");
  assert.equal(BACKDROP_TEXTURE.bytes, (await fs.stat(repo("public/images/galaxy.webp"))).size, `the galaxy size does not match the manifest; ${REBUILD}`);
});
