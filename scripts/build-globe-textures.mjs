// Builds the hero globe's texture tiers from the preserved source model.
//   public/textures/earth/{1k,2k,4k}/{day,night,normal,spec,clouds}.webp
//   src/components/globe/texture-manifest.ts (URLs and byte sizes for the loader and the intro counter)
// The source stores its maps south-up for the model's own UVs; every output is flipped upright, the
// layout three's SphereGeometry expects (north at the top row, longitude -180° at the left edge).
// Usage: node scripts/build-globe-textures.mjs [source.glb] [outDir] [manifest.ts]   (npm run build:textures)
// [outDir] only changes where the files are written: the manifest URLs always point at
// /textures/earth/<tier>/<map>.webp, where the site serves them.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

export const TIERS = { "1k": 1024, "2k": 2048, "4k": 4096 };
export const MAPS = ["day", "night", "normal", "spec", "clouds"];
// Every source map must be this size: each tier is then an exact 2:1 downsample, never cropped or upscaled.
const SOURCE_SIZE = { width: 4096, height: 2048 };
// Stored ×4 around 128 so the faint relief survives lossy WebP; the shader divides it back out.
export const NORMAL_GAIN = 4;
// The source's flat value per channel (its histogram mode: 90% of texels), re-centred on 128.
const NORMAL_FLAT = [128, 127];
// City lights: the night map's red channel minus its blue-grey land glow (R ≈ 13–18 off the cities).
const LIGHTS_FLOOR = 18;
// Gaussian blur sigma, in each tier's own pixels, that softens the ocean mask's coastline for the glint.
const SPEC_BLUR = 1.2;
// WebP quality per map and tier (measured in docs/superpowers/plans/2026-10-21-showcase-part1-globe.md).
const QUALITY = {
  day: { "1k": 85, "2k": 85, "4k": 85 },
  night: { "1k": 75, "2k": 75, "4k": 75 },
  normal: { "1k": 80, "2k": 80, "4k": 80 },
  spec: { "1k": 70, "2k": 70, "4k": 60 },
  clouds: { "1k": 70, "2k": 65, "4k": 55 },
};

/** The source model does not hold the maps this script expects. */
export class GlobeSourceError extends Error {
  name = "GlobeSourceError";
}

/** Splits a binary glTF into its JSON and binary chunks. */
export function readGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("Not a binary glTF file.");
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").trim());
  return { gltf, bin: buffer.subarray(28 + jsonLength) };
}

/** Texture index → image index (EXT_texture_webp keeps the image on the extension, so they differ). */
export function imageOfTexture(gltf, textureIndex) {
  const texture = gltf.textures?.[textureIndex];
  const image = texture?.extensions?.EXT_texture_webp?.source ?? texture?.source;
  if (image === undefined) throw new GlobeSourceError(`Texture ${textureIndex} has no image.`);
  return image;
}

/** Finds each map's image through the materials instead of trusting image order. */
export function sourceImages(gltf) {
  const materials = gltf.materials ?? [];
  const earth = materials.find((material) => material.normalTexture && material.emissiveTexture);
  const clouds = materials.find((material) => material.alphaMode === "BLEND");
  if (!earth || !clouds) throw new GlobeSourceError("Expected an Earth material (normal + emissive) and a BLEND cloud material.");
  const slot = (material, name, info) => {
    if (info?.index === undefined) throw new GlobeSourceError(`The ${material.name ?? "unnamed"} material has no ${name}.`);
    return imageOfTexture(gltf, info.index);
  };
  return {
    day: slot(earth, "pbrMetallicRoughness.baseColorTexture", earth.pbrMetallicRoughness?.baseColorTexture),
    night: slot(earth, "emissiveTexture", earth.emissiveTexture),
    normal: slot(earth, "normalTexture", earth.normalTexture),
    roughness: slot(earth, "pbrMetallicRoughness.metallicRoughnessTexture", earth.pbrMetallicRoughness?.metallicRoughnessTexture),
    clouds: slot(clouds, "pbrMetallicRoughness.baseColorTexture", clouds.pbrMetallicRoughness?.baseColorTexture),
  };
}

/** The encoded bytes of an image embedded in the binary chunk. */
export function imageBytes(gltf, bin, imageIndex) {
  const image = gltf.images?.[imageIndex];
  if (!image) throw new GlobeSourceError(`Image ${imageIndex} does not exist.`);
  if (image.bufferView === undefined) throw new GlobeSourceError(`Image ${imageIndex} is stored by URI (${image.uri ?? "none"}), not embedded in the GLB.`);
  const view = gltf.bufferViews[image.bufferView];
  const start = view.byteOffset ?? 0;
  return bin.subarray(start, start + view.byteLength);
}

/** Each source map's encoded bytes, checked to be 4096×2048. */
export async function sourceBuffers(gltf, bin) {
  const buffers = {};
  for (const [key, imageIndex] of Object.entries(sourceImages(gltf))) {
    const bytes = imageBytes(gltf, bin, imageIndex);
    const { width, height } = await sharp(bytes).metadata();
    if (width !== SOURCE_SIZE.width || height !== SOURCE_SIZE.height) {
      throw new GlobeSourceError(`The ${key} source (image ${imageIndex}) is ${width}×${height}; expected ${SOURCE_SIZE.width}×${SOURCE_SIZE.height}.`);
    }
    buffers[key] = bytes;
  }
  return buffers;
}

// Which source feeds each output map.
const SOURCE_OF = { day: "day", night: "night", normal: "normal", spec: "roughness", clouds: "clouds" };
const k = NORMAL_GAIN;
// Per-map processing of the upright source, at full resolution. sharp runs its operations in a fixed
// order (resize before flip, linear, channel extraction and negate), so this is rendered to raw pixels
// first and every tier is then resized from that buffer.
const PROCESS = {
  // Blue Marble colour, sRGB.
  day: (image) => image.removeAlpha(),
  // City lights only: red channel, land glow removed, rescaled to 0–255 (sRGB-encoded luminance).
  night: (image) => image.extractChannel(0).linear(255 / (255 - LIGHTS_FLOOR), (-LIGHTS_FLOOR * 255) / (255 - LIGHTS_FLOOR)),
  // Tangent-space relief: R = east slope, G = north slope (verified against the Andes and Himalaya), ×4 around
  // 128 before the downsample, so the tiers keep the slopes between the source's integer levels.
  normal: (image) => image.removeAlpha().linear([k, k, 0], [128 - k * NORMAL_FLAT[0], 128 - k * NORMAL_FLAT[1], 255]),
  // Ocean mask: the glTF roughness lives in green; oceans are 0 (smooth), land 255, so invert it.
  spec: (image) => image.extractChannel(1).negate(),
  // Cloud coverage: the source alpha is inverted (opaque where the sky is clear), so negate it.
  clouds: (image) => image.extractChannel(3).negate(),
};
// Per-tier finishing after the resize.
const FINISH = {
  spec: (image) => image.blur(SPEC_BLUR),
};

/** One map, upright and processed at full resolution, as raw pixels (decoded once for all tiers). */
export async function prepareMap(map, sources) {
  const { data, info } = await PROCESS[map](sharp(sources[SOURCE_OF[map]]).flip()).raw().toBuffer({ resolveWithObject: true });
  return { data, raw: { width: info.width, height: info.height, channels: info.channels } };
}

/** One tier of a prepared map: resized from the full-size pixels, then finished, ready to encode. */
export function tierImage(map, prepared, width) {
  const finish = FINISH[map] ?? ((image) => image);
  return finish(sharp(prepared.data, { raw: prepared.raw }).resize(width, width / 2, { kernel: "lanczos3" }));
}

const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

async function main(args = process.argv.slice(2)) {
  const [sourceArg, outArg, manifestArg] = args;
  const sourceFile = sourceArg ?? (existsSync("assets/source/earth-4k.glb") ? "assets/source/earth-4k.glb" : "public/models/earth-4k.glb");
  const outDir = outArg ?? "public/textures/earth";
  const manifestFile = manifestArg ?? "src/components/globe/texture-manifest.ts";

  const { gltf, bin } = readGlb(await fs.readFile(sourceFile));
  const sources = await sourceBuffers(gltf, bin);
  const galaxy = (await fs.stat("public/images/galaxy.webp")).size;
  // Tier keys first, so the manifest lists tiers, then maps, in a fixed order.
  const manifest = Object.fromEntries(Object.keys(TIERS).map((tier) => [tier, {}]));
  for (const tier of Object.keys(TIERS)) await fs.mkdir(path.join(outDir, tier), { recursive: true });

  for (const map of MAPS) {
    const prepared = await prepareMap(map, sources);
    for (const [tier, width] of Object.entries(TIERS)) {
      const info = await tierImage(map, prepared, width)
        .webp({ quality: QUALITY[map][tier], effort: 6, smartSubsample: map === "day" || map === "normal" })
        .toFile(path.join(outDir, tier, `${map}.webp`));
      manifest[tier][map] = { url: `/textures/earth/${tier}/${map}.webp`, bytes: info.size, width: info.width, height: info.height };
      console.log(`${tier} ${map}: ${kib(info.size)}`);
    }
  }
  for (const tier of Object.keys(TIERS)) {
    const total = Object.values(manifest[tier]).reduce((sum, entry) => sum + entry.bytes, 0);
    console.log(`${tier} total: ${kib(total)} (${total} B)`);
  }

  const body = [
    "// Generated by scripts/build-globe-textures.mjs. Do not edit by hand; regenerate with: node scripts/build-globe-textures.mjs",
    `export const GLOBE_TIERS = ${JSON.stringify(Object.keys(TIERS))} as const;`,
    `export const GLOBE_MAPS = ${JSON.stringify(MAPS)} as const;`,
    "",
    `export const GLOBE_TEXTURES = ${JSON.stringify(manifest, null, 2)} as const;`,
    "",
    "// The desktop scene's galaxy backdrop, counted in the intro's progress.",
    `export const BACKDROP_TEXTURE = ${JSON.stringify({ url: "/images/galaxy.webp", bytes: galaxy }, null, 2)} as const;`,
    "",
    `export const NORMAL_GAIN = ${NORMAL_GAIN};`,
    "",
  ].join("\n");
  await fs.mkdir(path.dirname(manifestFile), { recursive: true });
  await fs.writeFile(manifestFile, body);
  console.log(`Manifest written: ${manifestFile}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
