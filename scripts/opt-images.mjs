import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const RAW = "public/gen-raw";
const jobs = [
  // product suite (bento cards)
  ["design-engine", "images/suite/design-engine.webp", 1000, "webp", 82],
  ["scale-matrix", "images/suite/scale-matrix.webp", 1000, "webp", 82],
  ["neural-net", "images/suite/neural-net.webp", 1000, "webp", 82],
  ["shield-core", "images/suite/shield-core.webp", 1000, "webp", 82],
  // labs thumbnails
  ["ethical-ai", "images/labs/ethical-ai.webp", 900, "webp", 80],
  ["zero-latency", "images/labs/zero-latency.webp", 900, "webp", 80],
  ["observability", "images/labs/observability.webp", 900, "webp", 80],
  ["process-automation", "images/labs/process-automation.webp", 900, "webp", 80],
  // og / social (jpg for max unfurl compatibility)
  ["og", "seo/og.jpg", 1200, "jpeg", 86],
  // cosmic backdrops
  ["space-bg", "images/space-bg.webp", 2400, "webp", 78],
  ["galaxy", "images/galaxy.webp", 3840, "webp", 84],
  // team portraits
  ["team-tygo", "images/team/tygo.webp", 900, "webp", 84],
  ["team-philip", "images/team/philip.webp", 900, "webp", 84],
  ["team-sarah", "images/team/sarah.webp", 900, "webp", 84],
  ["team-maya", "images/team/maya.webp", 900, "webp", 84],
  ["team-daniel", "images/team/daniel.webp", 900, "webp", 84],
  // reviewer headshots (shown grayscale)
  ["r1", "images/reviews/r1.webp", 600, "webp", 82],
  ["r2", "images/reviews/r2.webp", 600, "webp", 82],
  ["r3", "images/reviews/r3.webp", 600, "webp", 82],
  ["r4", "images/reviews/r4.webp", 600, "webp", 82],
  ["r5", "images/reviews/r5.webp", 600, "webp", 82],
  ["r6", "images/reviews/r6.webp", 600, "webp", 82],
  ["r7", "images/reviews/r7.webp", 600, "webp", 82],
  ["faq-team", "images/faq-team.webp", 1100, "webp", 82],
  ["neural-core", "images/suite/neural-core.webp", 1200, "webp", 84],
];

for (const [name, out, width, fmt, quality] of jobs) {
  const src = path.join(RAW, `${name}.png`);
  if (!existsSync(src)) {
    console.log(`skip (missing): ${name}`);
    continue;
  }
  const dest = path.join("public", out);
  await mkdir(path.dirname(dest), { recursive: true });
  let pipe = sharp(src).resize({ width, withoutEnlargement: true });
  pipe = fmt === "jpeg" ? pipe.jpeg({ quality }) : pipe.webp({ quality });
  const info = await pipe.toFile(dest);
  console.log(`${name} -> ${out}  (${(info.size / 1024).toFixed(0)} KB, ${info.width}x${info.height})`);
}
console.log("DONE");
