import fs from "node:fs/promises";
await fs.mkdir("assets/source", { recursive: true });
await fs.copyFile("public/models/earth-4k.glb", "assets/source/earth-4k.glb");
// The icons (public/icon.svg, apple-icon.png, icon-192/512, icon-maskable-512, src/app/favicon.ico) and
// public/seo/og.png come from the brand kit (docs/brand/) and are committed as they are: nothing here
// regenerates them, so a rerun cannot bring back the old identity.
console.log("Prepared the globe source.");
