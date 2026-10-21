// Builds the hero globe's texture tiers from the preserved source model.
//   public/textures/earth/{1k,2k,4k}/{day,night,normal,spec,clouds}.webp
//   src/components/globe/texture-manifest.ts (URLs and byte sizes for the loader and the intro counter)
// The source stores its maps south-up for the model's own UVs; every output is flipped upright, the
// layout three's SphereGeometry expects (north at the top row, longitude -180° at the left edge).
// Usage: node scripts/build-globe-textures.mjs [source.glb] [outDir] [manifest.ts]
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

export const TIERS = { "1k": 1024, "2k": 2048, "4k": 4096 };
export const MAPS = ["day", "night", "normal", "spec", "clouds"];
// Stored ×4 around 128 so the faint relief survives lossy WebP; the shader divides it back out.
export const NORMAL_GAIN = 4;
// The source's flat value per channel (its histogram mode: 90% of texels), re-centred on 128.
const NORMAL_FLAT = [128, 127];
// City lights: the night map's red channel minus its blue-grey land glow (R ≈ 13–18 off the cities).
const LIGHTS_FLOOR = 18;
// WebP quality per map and tier (measured in docs/superpowers/plans/2026-10-21-showcase-part1-globe.md).
const QUALITY = {
  day: { "1k": 85, "2k": 85, "4k": 85 },
  night: { "1k": 75, "2k": 75, "4k": 75 },
  normal: { "1k": 80, "2k": 80, "4k": 80 },
  spec: { "1k": 70, "2k": 70, "4k": 60 },
  clouds: { "1k": 70, "2k": 65, "4k": 55 },
};

const [sourceArg, outArg, manifestArg] = process.argv.slice(2);
const SOURCE = sourceArg ?? (existsSync("assets/source/earth-4k.glb") ? "assets/source/earth-4k.glb" : "public/models/earth-4k.glb");
const OUT = outArg ?? "public/textures/earth";
const MANIFEST = manifestArg ?? "src/components/globe/texture-manifest.ts";

/** Splits a binary glTF into its JSON and binary chunks. */
export function readGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("Not a binary glTF file.");
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").trim());
  return { gltf, bin: buffer.subarray(28 + jsonLength) };
}

/** Texture index → image index (EXT_texture_webp keeps the image on the extension, so they differ). */
export function imageOfTexture(gltf, textureIndex) {
  const texture = gltf.textures[textureIndex];
  return texture.extensions?.EXT_texture_webp?.source ?? texture.source;
}

/** Finds each map's image through the materials instead of trusting image order. */
export function sourceImages(gltf) {
  const earth = gltf.materials.find((material) => material.normalTexture && material.emissiveTexture);
  const clouds = gltf.materials.find((material) => material.alphaMode === "BLEND");
  if (!earth || !clouds) throw new Error("Expected an Earth material (normal + emissive) and a BLEND cloud material.");
  return {
    day: imageOfTexture(gltf, earth.pbrMetallicRoughness.baseColorTexture.index),
    night: imageOfTexture(gltf, earth.emissiveTexture.index),
    normal: imageOfTexture(gltf, earth.normalTexture.index),
    roughness: imageOfTexture(gltf, earth.pbrMetallicRoughness.metallicRoughnessTexture.index),
    clouds: imageOfTexture(gltf, clouds.pbrMetallicRoughness.baseColorTexture.index),
  };
}

function imageBytes(gltf, bin, imageIndex) {
  const view = gltf.bufferViews[gltf.images[imageIndex].bufferView];
  const start = view.byteOffset ?? 0;
  return bin.subarray(start, start + view.byteLength);
}

/** Full-resolution, upright source pipelines, one per output map. */
function pipelines(gltf, bin) {
  const images = sourceImages(gltf);
  const read = (key) => sharp(imageBytes(gltf, bin, images[key])).flip();
  const k = NORMAL_GAIN;
  return {
    // Blue Marble colour, sRGB.
    day: () => read("day").removeAlpha(),
    // City lights only: red channel, land glow removed, rescaled to 0–255 (sRGB-encoded luminance).
    night: () => read("night").extractChannel(0).linear(255 / (255 - LIGHTS_FLOOR), (-LIGHTS_FLOOR * 255) / (255 - LIGHTS_FLOOR)),
    // Tangent-space relief: R = east slope, G = north slope (verified against the Andes and Himalaya), ×4 around 128.
    normal: () => read("normal").removeAlpha().linear([k, k, 0], [128 - k * NORMAL_FLAT[0], 128 - k * NORMAL_FLAT[1], 255]),
    // Ocean mask: the glTF roughness lives in green; oceans are 0 (smooth), land 255. Softened 1 px for the glint.
    spec: () => read("roughness").extractChannel(1).negate().blur(1.2),
    // Cloud coverage: the source alpha is inverted (opaque where the sky is clear), so negate it.
    clouds: () => read("clouds").extractChannel(3).negate(),
  };
}

async function main() {
  const { gltf, bin } = readGlb(await fs.readFile(SOURCE));
  const make = pipelines(gltf, bin);
  const manifest = {};
  for (const [tier, width] of Object.entries(TIERS)) {
    manifest[tier] = {};
    await fs.mkdir(path.join(OUT, tier), { recursive: true });
    for (const map of MAPS) {
      const file = path.join(OUT, tier, `${map}.webp`);
      const info = await make[map]()
        .resize(width, width / 2, { kernel: "lanczos3" })
        .webp({ quality: QUALITY[map][tier], effort: 6, smartSubsample: map === "day" || map === "normal" })
        .toFile(file);
      manifest[tier][map] = { url: `/textures/earth/${tier}/${map}.webp`, bytes: info.size, width: info.width, height: info.height };
      console.log(`${tier} ${map}: ${(info.size / 1024).toFixed(1)} KB`);
    }
    const total = Object.values(manifest[tier]).reduce((sum, entry) => sum + entry.bytes, 0);
    console.log(`${tier} total: ${(total / 1024).toFixed(1)} KB`);
  }
  const galaxy = await fs.stat("public/images/galaxy.webp").then((stat) => stat.size).catch(() => 0);
  const body = [
    "// Generated by scripts/build-globe-textures.mjs. Do not edit by hand.",
    `export const GLOBE_TEXTURES = ${JSON.stringify(manifest, null, 2)} as const;`,
    "",
    "// The desktop scene's galaxy backdrop, counted in the intro's progress.",
    `export const BACKDROP_TEXTURE = ${JSON.stringify({ url: "/images/galaxy.webp", bytes: galaxy }, null, 2)} as const;`,
    "",
    `export const NORMAL_GAIN = ${NORMAL_GAIN};`,
    "",
  ].join("\n");
  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(MANIFEST, body);
  console.log(`Manifest written: ${MANIFEST}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
