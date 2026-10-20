import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
await fs.mkdir("assets/source", { recursive: true });
await fs.copyFile("public/models/earth-4k.glb", "assets/source/earth-4k.glb");
await sharp(await fs.readFile("public/images/galaxy.webp")).resize(1600).webp({quality:66}).toFile("public/images/galaxy-small.webp");
for (const name of ["design-engine", "scale-matrix", "neural-net", "shield-core", "neural-core"]) {
  const file = `public/images/suite/${name}.webp`;
  const input = await fs.readFile(file);
  await sharp(input).resize({ width:768, withoutEnlargement:true }).webp({quality:74}).toFile(file);
}
await fs.mkdir("public/draco", { recursive: true });
for (const file of ["draco_wasm_wrapper.js", "draco_decoder.wasm", "draco_decoder.js"]) {
  await fs.copyFile(path.join("node_modules/three/examples/jsm/libs/draco/gltf",file),path.join("public/draco",file));
}
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#161719"/><g stroke="#fa6e43" stroke-width="4" fill="none"><circle cx="64" cy="64" r="26"/><ellipse cx="64" cy="64" rx="53" ry="18" transform="rotate(-35 64 64)"/></g><circle cx="96" cy="40" r="7" fill="#fa6e43"/></svg>`;
await fs.writeFile("public/icon.svg",icon);
await sharp(Buffer.from(icon)).resize(180).png().toFile("public/apple-icon.png");
const faviconPng = await sharp(Buffer.from(icon)).resize(64).png().toBuffer();
const favicon = Buffer.alloc(22 + faviconPng.length);
favicon.writeUInt16LE(1, 2); favicon.writeUInt16LE(1, 4);
favicon[6] = 64; favicon[7] = 64;
favicon.writeUInt16LE(1, 10); favicon.writeUInt16LE(32, 12);
favicon.writeUInt32LE(faviconPng.length, 14); favicon.writeUInt32LE(22, 18);
faviconPng.copy(favicon, 22);
await fs.writeFile("src/app/favicon.ico", favicon);
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#161719"/><g fill="none" stroke="#fa6e43" opacity=".65"><circle cx="1040" cy="300" r="180"/><ellipse cx="1040" cy="300" rx="285" ry="100" transform="rotate(-35 1040 300)"/><circle cx="1040" cy="300" r="140" opacity=".4"/></g><text x="70" y="110" fill="#fa6e43" font-family="Arial,sans-serif" font-size="34">spacegear.tech</text><text x="70" y="250" fill="#eee7e3" font-family="Arial,sans-serif" font-size="63">Strategy to</text><text x="70" y="326" fill="#eee7e3" font-family="Arial,sans-serif" font-size="63">working systems.</text><text x="70" y="444" fill="#c0b9bc" font-family="Arial,sans-serif" font-size="25">Digital transformation &amp; AI consulting</text><path d="M70 535H1130" stroke="#414044"/><circle cx="1080" cy="110" r="8" fill="#fa6e43"/></svg>`;
await sharp(Buffer.from(og)).png().toFile("public/seo/og.png");
console.log("Prepared responsive art, local decoders and spacegear.tech identity assets.");
