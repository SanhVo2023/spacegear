import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import { MAPS, NORMAL_GAIN, TIERS, readGlb, sourceImages } from "../scripts/build-globe-textures.mjs";

const { GLOBE_TEXTURES, BACKDROP_TEXTURE, NORMAL_GAIN: MANIFEST_GAIN } = await import("../src/components/globe/texture-manifest.ts");

// Spec budget: mobile ≤ ~450 KB, desktop first frame (2k) ≤ ~900 KB, full 4k set ≤ ~2.5 MB.
const BUDGET = { "1k": 450 * 1024, "2k": 900 * 1024, "4k": 2.5 * 1024 * 1024 };
const file = (url) => `public${url}`;
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
async function band(url, top, height) {
  const { data } = await sharp(file(url)).extract({ left: 0, top, width: 1024, height }).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  return mean(data);
}

test("every tier holds the five maps as 2:1 WebP files that match the manifest", async () => {
  assert.deepEqual(Object.keys(GLOBE_TEXTURES), Object.keys(TIERS));
  for (const [tier, width] of Object.entries(TIERS)) {
    assert.deepEqual(Object.keys(GLOBE_TEXTURES[tier]), MAPS, tier);
    for (const map of MAPS) {
      const entry = GLOBE_TEXTURES[tier][map];
      assert.equal(entry.url, `/textures/earth/${tier}/${map}.webp`);
      const meta = await sharp(file(entry.url)).metadata();
      assert.equal(meta.format, "webp", entry.url);
      assert.equal(meta.width, width, entry.url);
      assert.equal(meta.height, width / 2, entry.url);
      assert.equal(meta.hasAlpha, false, `${entry.url} has no alpha channel`);
      assert.equal((await fs.stat(file(entry.url))).size, entry.bytes, `${entry.url} matches the manifest`);
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

test("the maps are upright and encoded the way the shader decodes them", async () => {
  const tier = GLOBE_TEXTURES["1k"];
  // Ocean mask: white ocean, black land. The Arctic Ocean is the top row, Antarctica the bottom.
  assert.ok((await band(tier.spec.url, 0, 15)) > 200, "the Arctic Ocean is at the top");
  assert.ok((await band(tier.spec.url, 486, 26)) < 60, "Antarctica is at the bottom");
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

test("source maps are found through the materials, not the image order", async () => {
  const { gltf } = readGlb(await fs.readFile("public/models/earth-4k.glb"));
  assert.deepEqual(sourceImages(gltf), { day: 0, night: 2, normal: 3, roughness: 1, clouds: 4 });
});

test("the backdrop entry is the shipped galaxy image", async () => {
  assert.equal(BACKDROP_TEXTURE.url, "/images/galaxy.webp");
  assert.equal(BACKDROP_TEXTURE.bytes, (await fs.stat("public/images/galaxy.webp")).size);
});
