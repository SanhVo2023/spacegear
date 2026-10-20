import fs from "node:fs/promises";
import sharp from "sharp";
const source = await fs.readFile("assets/source/earth-4k.glb");
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString().trim());
const binary = source.subarray(28 + jsonLength);
const imageViews = new Map(gltf.images.map((image, index) => [image.bufferView, index]));
const chunks = []; let offset = 0;
for (const [index, view] of gltf.bufferViews.entries()) {
  let data = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  if (imageViews.has(index)) {
    data = await sharp(data).resize({ width: 1536, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    if (imageViews.get(index) === 0) await sharp(data).resize(640).webp({ quality: 65 }).toFile("public/images/earth-color.webp");
  }
  view.byteOffset = offset; view.byteLength = data.length;
  const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
  data.copy(padded); chunks.push(padded); offset += padded.length;
}
gltf.buffers[0].byteLength = offset;
const jsonData = Buffer.from(JSON.stringify(gltf));
const jsonChunk = Buffer.alloc(Math.ceil(jsonData.length / 4) * 4, 32); jsonData.copy(jsonChunk);
const bin = Buffer.concat(chunks); const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonChunk.length + bin.length, 8);
header.writeUInt32LE(jsonChunk.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
await fs.writeFile("public/models/earth-optimized.glb", Buffer.concat([header, jsonChunk, binHeader, bin]));
console.log(`Globe: ${source.length} → ${28 + jsonChunk.length + bin.length} bytes.`);
