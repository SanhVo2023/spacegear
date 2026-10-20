// Builds public/models/earth-hq.glb from the preserved 4K source model.
// The Earth surface maps (base colour, night lights, normal, roughness) keep
// their full 4096×2048 resolution — they carry the detail you see. Only the
// cloud shell's two textures are resized to 3072 px; they hold ~90% of the bytes
// (2048 px read visibly softer than the original in the fidelity sheets).
// Usage: node scripts/opt-globe.mjs   (reads assets/source/earth-4k.glb)
import fs from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "assets/source/earth-4k.glb";
const TARGET = "public/models/earth-hq.glb";
const CLOUD_MATERIAL = "Material_62"; // cloud shell: base colour (with alpha) + emissive
const CLOUD_WIDTH = 3072;

const source = await fs.readFile(SOURCE);
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString().trim());
const binary = source.subarray(28 + jsonLength);

const imageOfTexture = (index) => gltf.textures[index].extensions?.EXT_texture_webp?.source ?? gltf.textures[index].source;
const cloud = gltf.materials.find((material) => material.name === CLOUD_MATERIAL);
if (!cloud) throw new Error(`Material ${CLOUD_MATERIAL} not found; inspect the model before changing this script.`);
const cloudImages = new Set(
  [cloud.pbrMetallicRoughness?.baseColorTexture?.index, cloud.emissiveTexture?.index]
    .filter((index) => index !== undefined)
    .map(imageOfTexture),
);
const viewToImage = new Map(gltf.images.map((image, index) => [image.bufferView, index]));

const chunks = [];
let offset = 0;
for (const [index, view] of gltf.bufferViews.entries()) {
  let data = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const image = viewToImage.get(index);
  if (image !== undefined && cloudImages.has(image)) {
    const before = data.length;
    data = await sharp(data).resize({ width: CLOUD_WIDTH }).webp({ quality: 85, alphaQuality: 90, effort: 6 }).toBuffer();
    console.log(`cloud texture ${image}: ${before} → ${data.length} bytes`);
  }
  view.byteOffset = offset;
  view.byteLength = data.length;
  const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
  data.copy(padded);
  chunks.push(padded);
  offset += padded.length;
}
gltf.buffers[0].byteLength = offset;
const jsonData = Buffer.from(JSON.stringify(gltf));
const jsonChunk = Buffer.alloc(Math.ceil(jsonData.length / 4) * 4, 32);
jsonData.copy(jsonChunk);
const bin = Buffer.concat(chunks);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + jsonChunk.length + bin.length, 8);
header.writeUInt32LE(jsonChunk.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(bin.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
await fs.writeFile(TARGET, Buffer.concat([header, jsonChunk, binHeader, bin]));
console.log(`Globe: ${source.length} → ${28 + jsonChunk.length + bin.length} bytes (${TARGET}).`);
