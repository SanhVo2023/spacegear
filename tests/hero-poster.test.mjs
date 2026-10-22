import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const { POSTER, POSTER_ASPECT, POSTER_FILES } = await import("../src/components/globe/poster.ts");
const repo = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
// A full-viewport desktop WebP: the 1x poster stays under the galaxy's 306 KB phone LCP by a wide margin,
// and the 2x one (high-density screens and tall windows only) under it too.
const BUDGET = { 2400: 150_000, 3840: 260_000 };
const RECAPTURE = "re-run `node --import tsx scripts/capture-hero-poster.mjs <base>` on a real GPU";

test("each poster candidate is a WebP of the size its srcset entry declares, 2.4:1, within budget", async () => {
  assert.ok(POSTER_FILES.length >= 1);
  for (const file of POSTER_FILES) {
    const path = repo(`public${file.src}`);
    const meta = await sharp(path).metadata();
    const bytes = (await fs.stat(path)).size;
    assert.equal(meta.format, "webp", file.src);
    assert.deepEqual([meta.width, meta.height], [file.width, file.height], `${file.src} dimensions; ${RECAPTURE}`);
    assert.ok(Math.abs(file.width / file.height - POSTER_ASPECT) < 1e-9, `${file.src} is ${POSTER_ASPECT}:1`);
    assert.ok(bytes <= BUDGET[file.width], `${file.src}: ${bytes} bytes, budget ${BUDGET[file.width]}`);
  }
});

test("the srcset lists every candidate by width, and sizes follows the poster's aspect", () => {
  assert.equal(POSTER.srcSet, POSTER_FILES.map((file) => `${file.src} ${file.width}w`).join(", "));
  assert.equal(POSTER.src, POSTER_FILES[0].src);
  assert.deepEqual([POSTER.width, POSTER.height], [POSTER_FILES[0].width, POSTER_FILES[0].height]);
  // Shown at the viewport's height (object-fit: cover, and contain on windows wider than the poster), so
  // always POSTER_ASPECT × 100vh wide.
  assert.equal(POSTER.sizes, `${POSTER_ASPECT * 100}vh`);
  assert.equal(12 / 5, POSTER_ASPECT, "globals.css switches to contain at min-aspect-ratio: 12/5");
});

test("the poster is the shader globe's frame, not the GLB-era one", async () => {
  // The GLB poster was 1440×900 and dark (a blotchy night-side globe). The shader globe's opening frame
  // shows the lit day side: its right half is far brighter than open space.
  const { data, info } = await sharp(repo(`public${POSTER_FILES[0].src}`)).resize(240, 100, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const luma = (x0, x1) => {
    let sum = 0, n = 0;
    for (let y = 0; y < info.height; y++) for (let x = x0; x < x1; x++) { const i = (y * info.width + x) * 3; sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++; }
    return sum / n;
  };
  const sky = luma(0, 60), globe = luma(150, 240);
  assert.ok(globe > 70 && sky < 20, `the opening frame: a lit globe on the right (luma ${globe.toFixed(1)}) against dark space (${sky.toFixed(1)}); ${RECAPTURE}`);
});

test("packaging ships every poster candidate", async () => {
  const pkg = await fs.readFile(repo("scripts/package-site.mjs"), "utf8");
  for (const file of POSTER_FILES) assert.ok(pkg.includes(`"${file.src.slice(1)}"`), `package-site.mjs allowlists ${file.src}`);
});
