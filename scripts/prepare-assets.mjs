import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
await fs.mkdir("assets/source", { recursive: true });
await fs.copyFile("public/models/earth-4k.glb", "assets/source/earth-4k.glb");
await sharp(await fs.readFile("public/images/galaxy.webp")).resize(1600).webp({quality:66}).toFile("public/images/galaxy-small.webp");
await fs.mkdir("public/draco", { recursive: true });
for (const file of ["draco_wasm_wrapper.js", "draco_decoder.wasm", "draco_decoder.js"]) {
  await fs.copyFile(path.join("node_modules/three/examples/jsm/libs/draco/gltf",file),path.join("public/draco",file));
}
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#161719"/><text x="40" y="88" text-anchor="middle" fill="#fa6e43" font-family="Arial,sans-serif" font-size="76" font-weight="600">s</text><rect x="66" y="62" width="40" height="9" rx="2" fill="#e3dbd8"/></svg>`;
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
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#161719"/><defs><radialGradient id="g" cx="0.78" cy="0.42" r="0.5"><stop offset="0" stop-color="#fa6e43" stop-opacity=".35"/><stop offset="1" stop-color="#161719" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="960" cy="270" r="26" fill="#fa6e43"/><circle cx="960" cy="270" r="92" fill="none" stroke="#5f5f66" stroke-dasharray="3 9"/><text x="70" y="120" fill="#fa6e43" font-family="Arial,sans-serif" font-size="44" font-weight="600">space<tspan fill="#e3dbd8">—</tspan>gear</text><text x="70" y="270" fill="#eee7e3" font-family="Arial,sans-serif" font-size="66">The smarter way to</text><text x="70" y="350" fill="#eee7e3" font-family="Arial,sans-serif" font-size="66"><tspan fill="#fa6e43">plan</tspan>, <tspan fill="#fa6e43">build</tspan> and <tspan fill="#fa6e43">scale</tspan>.</text><text x="70" y="460" fill="#c0b9bc" font-family="Arial,sans-serif" font-size="26">Digital transformation &amp; AI consulting · spacegear.tech</text><path d="M70 535H1130" stroke="#2a2b2e"/></svg>`;
await sharp(Buffer.from(og)).png().toFile("public/seo/og.png");
console.log("Prepared responsive art, local decoders and spacegear.tech identity assets.");
