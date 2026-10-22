# Showcase Part 1 (Globe and Hero) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6.3 MB GLB globe with a procedural, shader-lit Earth (day/night terminator, brand-orange twilight, warm city lights, ocean glint, relief, cloud shell with shadows, fresnel atmosphere) fed by tiered WebP textures, and add cursor tilt, drag-to-spin, a scroll-linked sun sweep and dolly, a first-visit intro loader, a light phone/tablet globe and a re-captured poster, without regressing the reduced-motion, hidden-text, CLS, focus or CSP rules.

**Architecture:** A sharp script extracts five upright maps from `assets/source/earth-4k.glb` into 1k/2k/4k tiers under `public/textures/earth/` and writes a typed manifest. New modules in `src/components/globe/` split pure logic (constants, scroll math, springs and drag, device tiers, intro store and gate, all unit-tested in Node) from the three.js parts (loader with `THREE.LoadingManager` + `FileLoader` byte progress, GLSL, materials, `Globe`, `Backdrop`). `src/components/EarthScene.tsx` composes them in an R3F `Canvas` (desktop "cinematic" or phone "mobile" variant). `OrbitalCinematic.tsx` keeps the three scroll beats and gains the intro hold, word-mask headline, mobile globe and `<picture>` poster. An inline gate in the root layout decides the intro before first paint.

**Tech Stack:** Next.js 16.2.7 static export, React 19.2, three 0.184, @react-three/fiber 9.6, @react-three/drei 10.7 (`Stars` only), Motion 12, sharp 0.34, Playwright (browser-check), `node --test` with tsx.

---

## Conventions (read before every task)

Full rules: `C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/showcase-conventions.md`. The essentials:

- **Worktree:** `E:\Personal\clone website\spacegear`, branch `feat/spacegear-showcase`. Quote paths (the folder name has a space). Never touch `E:\Personal\clone website\platform-clone`. Never push, merge, deploy or use bare `git stash`.
- **Next 16 differs from older versions.** Read `node_modules/next/dist/docs/` before adding Next-specific code. This plan uses nothing Next-specific beyond what the repo already uses (`next/dynamic`, `next/link`, the root layout).
- **Memory is tight.** Builds, previews, `test:browser`, `check:seo`, `check:fidelity` and every Playwright script go through the lock helper, one heavy job at a time. Never run `next dev`. Never stop processes that are not yours.
- **Lock helper** (always with the Bash tool and `timeout: 600000`; it may wait for the lock first):
  - Rebuild and restart the preview: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild`
  - Run a heavy command: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run <command>`
  - Start or stop only the preview: `... 8787 start` / `... 8787 stop`. If a "see it fail" step finds no preview on 8787, start it first.
- **Fast gates** (no lock): `npm run lint && npm run typecheck && npm test`.
- **Heavy gates** (through the helper, in this order): rebuild, then `npm run check:seo -- http://127.0.0.1:8787`, then `npm run test:browser -- http://127.0.0.1:8787`.
- **Line endings:** the working tree is checked out with CRLF (`core.autocrlf=true`). The Edit tool matches the snippets below as written. If you script an edit instead, normalise CRLF to LF first.
- **Rules that must not regress:**
  1. Never branch rendered markup on `useReducedMotion()`. Reduced motion is `MotionProvider` (`skipAnimations`) plus the end-state CSS on `data-reveal` and the other `data-*` hooks in `globals.css` and `NoScriptStyles.tsx`. This plan gives every hero word its own `data-reveal`.
  2. Hidden-text gate: no text under `main` may sit in an element or ancestor with opacity < 0.99 in the no-JS and reduced-motion profiles. The intro overlay lives outside `main` and is `display: none` unless JavaScript marks the intro as playing.
  3. Accessible names contain the visible text; decorative layers are `aria-hidden`; keyboard access and the global `:focus-visible` ring stay intact.
  4. No invented claims. The intro counter and the `data-cursor="Drag"` label are UI text, not content. Do not restructure `src/lib/content.ts` (Part 3 moves it into `content/` in parallel).
  5. CSP in `public/_headers` stays as it is. Textures are same-origin `fetch` (allowed by `connect-src 'self'`) decoded with `createImageBitmap` (no URL, so `img-src` is not involved; the `<img>` fallback uses a `blob:` URL, already allowed).
  6. `scripts/package-site.mjs` keeps an explicit allowlist; `check-export` fails on unshipped references.
- **React Compiler lint rules are on** (eslint-plugin-react-hooks 7: `refs`, `immutability`, `set-state-in-effect`, `purity`). The code below already passes them. Keep the patterns: three.js objects are mutated only through `ref.current` or callback parameters (`state.gl`, `state.camera`), never through values returned by hooks; `ref.current` is read only in effects and callbacks; state is set from callbacks or timers, not synchronously in an effect body.
- **Commits:** `git status` first, add only the listed files, and end every message with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Ignore CRLF warnings.
- **Part 2 hook points** (do not build Part 2 here): the globe wrapper carries `data-cursor="Drag"` once ready; scroll is read from the section rect on `scroll` events (works with Lenis); hero CTAs stay plain `Link` elements. The hero `h1` already rises word by word from masks, so Part 2's `SplitReveal` should leave the hero headline alone.

### Real-GPU check snippets (the controller runs these in the owner's Chrome)

Frame pacing (paste in DevTools console, then scroll through the hero for 5 s):

```js
(() => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const tick = (now) => { worst = Math.max(worst, now - last); last = now; n++; if (now - t0 < 5000) requestAnimationFrame(tick); else console.log("fps", (n / 5).toFixed(1), "worst frame ms", worst.toFixed(1)); }; requestAnimationFrame(tick); })();
```

Long tasks after the intro (paste once the intro has finished, then scroll and drag for 15 s):

```js
(() => { const out = []; new PerformanceObserver((list) => list.getEntries().forEach((e) => out.push(Math.round(e.duration)))).observe({ type: "longtask" }); setTimeout(() => console.log("long tasks (ms):", out), 15000); })();
```

Globe state: `document.querySelector("#home .hero-scene")?.dataset` (shows `globe` and, from Task 7, `globeTier`).

---

## What the prototypes established

All of this was measured in the scratchpad (`C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/globe-proto/`); the code in this plan was type-checked, linted with the repo's ESLint config and unit-tested there, stage by stage.

**Source model (`assets/source/earth-4k.glb`, identical to the tracked `public/models/earth-4k.glb`):**

| Map | glTF texture → image (via `EXT_texture_webp.source`) | Content (mean RGB) |
|---|---|---|
| Day | 0 → 0 | Blue Marble colour |
| Night | 1 → **2** | City lights on a blue-grey land glow (7/10/23; land 13/16/28, cities ≈250/254/191) |
| Normal | 2 → **3** | Tangent-space normals, very faint (128±2 / 127±2 / 255); flat value is R=128, G=127 |
| Metal/roughness | 3 → **1** | G = roughness: oceans 0, land 255 (a clean land mask); B = metal (unused, metallicFactor 0) |
| Cloud colour | 4 → 4 | RGBA: RGB = cloud brightness (mean 67), **alpha inverted** (mean 184, opaque where the sky is clear, r = −0.99 with RGB) |
| Cloud emissive | 5 → 5 | Same as the cloud brightness (r = 0.99); not needed |

The scratchpad preview names `night`/`normal`/`rough` for images 1–3 were wrong: image 1 is metal/roughness, 2 is night lights, 3 is normal. All images are stored south-up; flipping them vertically gives a standard upright equirectangular map (not mirrored). The inverted cloud alpha is the main cause of today's "blotchy, dark" globe: with alpha BLEND and a 0.68 opacity factor, every clear-sky texel draws a dark film over the surface.

**Normal map orientation**, checked by integrating the slopes: after the vertical flip, R−128 is the eastward tilt (the Andes rise from the Pacific) and G−127 the northward tilt (the Himalaya fall toward the Ganges plain). So the upright map is standard "+X east, +Y north" and needs no channel flip, only re-centring of G.

**Encodings chosen** (sharp 0.34.5, WebP, `effort: 6`, Lanczos3 resize from the 4096 px source):

| Map | Pipeline | Quality 1k / 2k / 4k |
|---|---|---|
| `day` | flip, RGB | 85 / 85 / 85, `smartSubsample` |
| `night` | flip, red channel, minus the land glow (floor 18), rescaled; grey | 75 / 75 / 75 |
| `normal` | flip, (R−128)×4+128, (G−127)×4+128, B=255 (the ×4 gain survives lossy WebP; the shader divides it back) | 80 / 80 / 80, `smartSubsample` |
| `spec` | flip, 255 − roughness (ocean = white), 1.2 px blur; grey | 70 / 70 / 60 |
| `clouds` | flip, 255 − alpha (coverage); grey | 70 / 65 / 55 |

**Measured sizes** (bytes; these are the exact outputs the script produces):

| Tier | day | night | normal | spec | clouds | Total | Budget |
|---|---|---|---|---|---|---|---|
| 1k (phones) | 47,384 | 9,776 | 10,114 | 15,072 | 107,346 | **189,692 (185 KiB)** | ≤ 450 KiB |
| 2k (desktop first frame) | 147,336 | 38,960 | 53,410 | 40,094 | 380,862 | **660,662 (645 KiB)** | ≤ 900 KiB |
| 4k (streamed after idle) | 424,422 | 138,932 | 192,484 | 96,674 | 1,329,760 | **2,182,272 (2.08 MiB)** | ≤ 2.5 MiB |

Revised after the Task 1 review: each map is now processed at 4096 px and rendered to raw pixels before the resize (sharp applies resize before its other operations), so the 1k/2k figures are smaller than the prototype's and the normal tiers keep sub-level slopes (133 distinct levels at 1k instead of 44). Only the spec blur runs after the resize, at each tier's own size.

The desktop scene also loads the existing galaxy backdrop (`/images/galaxy.webp`, 305,952 B) as part of its first frame, so the desktop first frame downloads 966,614 B of images (plus the 85 KB poster at first paint); the tests cap it at 1,000,000 B. The phone globe adds only the 1k set; the phone hero already loads the galaxy as its LCP image.

**Look:** a CPU re-implementation of the shaders (`preview-render.mjs` in the prototype folder) rendered the opening beat (day side, Sahara and West Africa, blue limb) and the centred beat (night side with city lights, an upper-left lit crescent, orange twilight and a backlit rim). The constants in `constants.ts` and `LOOK` come from those renders; the controller tunes them on the real GPU.

## Key decisions

- **Shader material on a procedural sphere**, as the spec says. Lighting is in world space and linear light; the earth shader takes the smooth sphere normal for the terminator and the relief normal only for Lambert shading, so relief never moves the day/night line.
- **Colour pipeline:** colour maps (`day`, galaxy) are `SRGBColorSpace` textures (hardware decode); data maps (`normal`) and masks (`night`, `spec`, `clouds`) are linear (`NoColorSpace`); the night lights are sRGB-encoded luminance decoded in GLSL with `pow(x, 2.2)`. Output is `SRGBColorSpace`. **Tone mapping is ACES Filmic at exposure 1.2**, set explicitly in `onCreated`: it is what the current scene (R3F's default) uses, so the galaxy, stars and sun keep their look; its toe keeps space black and its shoulder rolls the over-bright city lights (×3.75) to a warm white instead of clipping. AgX was rejected: it lifts the blacks of space and desaturates the brand-orange twilight.
- **Masks use `RedFormat`** (R8 on the GPU): the 4k set costs about 120 MB of GPU memory (with mipmaps) instead of about 220 MB.
- **Loader:** `THREE.FileLoader` (`responseType: "blob"`, one shared `THREE.LoadingManager` per set) gives byte progress from the response stream; `createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" })` decodes off the main thread (an `<img>` + `decode()` fallback covers Safari < 17 and Firefox < 98, the same rule three's GLTFLoader uses). **Progress** = 90 % bytes received (weighted by the manifest's sizes) + 10 % decoded; the counter only reaches 100 when the first textured frame has rendered.
- **No long first frame:** shaders compile with `renderer.compileAsync` (KHR_parallel_shader_compile) while the scene is hidden, textures upload one per frame with `renderer.initTexture`, and each decoded ImageBitmap is closed after upload. The 4k swap uses the same one-per-frame upload, then disposes the 2k set.
- **Intro gate before first paint:** an inline script in the root layout (`IntroGate`) sets `html[data-intro="play"]` only on the home page, with no hash, at ≥ 1024 px with motion allowed, without Save-Data, with WebGL2, and once per tab session (`sessionStorage`). The overlay (in the layout, outside `main`, `pointer-events: none`) is `display: none` otherwise, so it never shows without JavaScript. Any key, pointer press, wheel, touch, focus or scroll ends it at once. Caps: the page reveals at most 4 s after first paint even if textures are still loading, and the counter catch-up plus reveal never add more than 2.5 s once the globe is ready.
- **Device tiers** (`chooseHeroMode`): desktop with motion, no Save-Data and WebGL2 → cinematic (2k, then 4k after idle when `canStream4k`: hardware GPU, `maxTextureSize ≥ 4096`, `deviceMemory ≥ 8` or unknown, not 2g/3g); desktop otherwise → poster; phone/tablet with motion, no Save-Data, WebGL2 and `deviceMemory ≥ 4` or unknown → 1k globe; otherwise → galaxy. Software renderers (headless SwiftShader) stay on 2k, so `test:browser` never pulls the 4k set; the 4k path is verified on the real GPU.
- **Interaction:** the old FPV mouse-look camera is replaced by the spec's model: the globe tilts toward the cursor (spring, ≤ 6°), the stars and galaxy drift slightly the other way, and a mouse/pen drag spins the globe with inertia and a sprung pitch. Touch is never captured or prevented.
- **Scroll:** the existing manual rect scrubber stays the single progress source (it works with Lenis). The sun direction slerps from front-left to upper-left-behind over the shrink window (p 0.08 → 0.62), and the camera dollies from z 6.2 to 5.75 over the whole hero.

## Deviations from the spec (with reasons)

1. **Cloud coverage comes from the inverted cloud alpha**, not "the cloud alpha": the source alpha is opaque where the sky is clear.
2. **The night map ships as single-channel city lights** (red channel minus the land glow), tinted warm in the shader, so the night side shows only lights, as the spec asks.
3. **The normal map is stored at ×4 gain around 128** (and its G channel re-centred from 127); otherwise lossy WebP erases the ±2-level relief.
4. **The intro plays on desktop only** (≥ 1024 px). Phones keep their static hero, whose galaxy image is their LCP; an overlay there would only delay content.
5. **Desktop fallbacks show the poster** (reduced motion, no JavaScript, Save-Data, no WebGL2) through a `<picture>` source in the static hero; phones and tablets fall back to the galaxy. The static desktop backdrop hides the phone gradients and 2D starfield so it matches the cinematic opening frame exactly.
6. **The phone globe uses the existing 2D `Starfield`** as its stars (cheaper than drei `Stars`) and has no galaxy sphere; its canvas is transparent over the galaxy image.
7. **CLS is now asserted** (< 0.05 per profile) instead of only recorded, and the rAF-budget check also covers `mobile-390` because phones now render WebGL.
8. **The hero headline rises word by word** from per-word masks (the line breaks are unknown at render time); the accessible name stays the plain sentence.
9. **CSP unchanged**, as instructed, even though `connect-src blob:` and `worker-src blob:` were only needed by the GLTF/Draco path (see the open questions in Task 11).

## File map

| File | Responsibility | Task |
|---|---|---|
| `scripts/build-globe-textures.mjs` | Extract, flip and encode the five maps × three tiers; write the manifest | 1 |
| `public/textures/earth/{1k,2k,4k}/{day,night,normal,spec,clouds}.webp` | Generated texture tiers (committed) | 1 |
| `src/components/globe/texture-manifest.ts` | Generated: URLs, byte sizes and dimensions per tier; galaxy size; `NORMAL_GAIN` | 1 |
| `tests/globe-textures.test.mjs` | Dimensions, channels, orientation, budgets, source mapping | 1 |
| `src/components/globe/constants.ts` | All framing, motion and intro tunables | 2 |
| `src/components/globe/scroll.ts` | `mapClamp`, `smoothstep`, `slerpDirection`, `sunDirectionAt`, `rigAt`, `cameraZAt` | 2 |
| `src/components/globe/interaction.ts` | `stepSpring`, `PointerInput`, `stepDrag` (inertia, pitch) | 2 |
| `src/components/globe/tiers.ts` | `GlobeTier`, `GlobeMapName`, `chooseHeroMode`, `canStream4k` | 2 |
| `src/components/globe/intro-store.ts` | Intro phases and progress store, caps | 2 |
| `src/components/globe/intro-gate.ts` | `runIntroGate` (serialised inline) and `introGateScript` | 2 |
| `tests/globe-logic.test.mjs` | Unit tests for the pure modules above | 2 |
| `src/components/globe/textures.ts` | `loadTextureSet`, `loadHeroTextures`, `globeEntries`, decode, `releaseSource`, `disposeTextureSet` | 3 |
| `src/components/globe/shaders.ts` | GLSL: earth (Task 3), clouds and atmosphere (Task 4) | 3, 4 |
| `src/components/globe/materials.ts` | `LOOK`, `createGlobeMaterials`, `applyGlobeTextures` | 3, 4 |
| `src/components/globe/Globe.tsx` | Earth mesh, cloud shell, atmosphere; applies `GlobeFrame` each frame | 3, 4 |
| `src/components/globe/Backdrop.tsx` | Galaxy sphere, drei `Stars`, visible sun; pointer parallax | 3, 5 |
| `src/components/globe/device.ts` | `hasWebGL2` (Task 3), `readDeviceEnv` (Task 8) | 3, 8 |
| `src/components/EarthScene.tsx` | Canvas, colour pipeline, warm-up, per-frame driver, intro reveal, 4k streaming, variants | 3–7 |
| `tests/globe-materials.test.mjs` | Manifest entries and material wiring | 3, 4 |
| `src/components/globe/usePointerInput.ts` | Cursor position and fine-pointer drag on the globe wrapper | 5 |
| `src/components/IntroGate.tsx` | Inline pre-paint gate script | 6 |
| `src/components/IntroOverlay.tsx` | The `00→100` counter and reveal timing | 6 |
| `src/app/layout.tsx` | Mounts the gate and the overlay; `suppressHydrationWarning` on `<html>` | 6 |
| `src/components/sections/OrbitalCinematic.tsx` | Scene wrapper and states, intro hold, word masks, mobile globe, `<picture>` poster | 3, 5–9 |
| `src/app/globals.css` | Canvas fade-in, cursor, word masks, intro overlay, mobile globe mask | 3, 5, 6, 8 |
| `scripts/browser-check.mjs` | Globe, intro, tier, mobile, fallback and CLS assertions | 3–9 |
| `scripts/capture-hero-poster.mjs` | Re-capture the poster from the shader globe | 9 |
| `public/images/hero-poster.webp` | Re-captured poster | 9 |
| `scripts/package-site.mjs`, `scripts/check-export.mjs` | Ship the textures; then forbid GLB/Draco | 3, 10 |
| `scripts/prepare-assets.mjs`, `eslint.config.mjs` | Drop the Draco copy step and ignore | 10 |
| `public/models/earth-hq.glb`, `public/draco/*`, `scripts/opt-globe.mjs` | Deleted | 10 |
| `README.md`, `docs/operations/implementation-status.md`, this plan | Rebuild instructions and measured results | 11 |

`public/models/earth-4k.glb` stays tracked: it is the committed copy of the source model (`assets/source/` is gitignored), `prepare-assets.mjs` copies it, the texture script falls back to it, and `check-export` already keeps it out of `dist/`.

## Task overview

1. Globe texture tiers (script, outputs, manifest, tests)
2. Pure globe logic (constants, scroll, interaction, tiers, intro store and gate)
3. Shader earth replaces the GLB (loader, earth GLSL, Globe, Backdrop, EarthScene, packaging, browser checks)
4. Clouds, atmosphere and the scroll-linked sun sweep and dolly
5. Cursor tilt, drag-to-spin and star parallax
6. Intro loader and word-mask headline
7. 4k streaming on capable desktops
8. Phone and tablet 1k globe
9. Poster and fallbacks
10. Remove the GLB, Draco and the old optimiser
11. Final gates, measurements and docs


---

### Task 1: Globe texture tiers

Extract the five maps from the source model, flip them upright, encode the three tiers and write the manifest. Nothing on the site changes yet (the files are not packaged until Task 3).

**Files:**
- Create: `scripts/build-globe-textures.mjs`
- Create (generated): `public/textures/earth/1k/*.webp`, `public/textures/earth/2k/*.webp`, `public/textures/earth/4k/*.webp` (5 files each), `src/components/globe/texture-manifest.ts`
- Test: `tests/globe-textures.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/globe-textures.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --import tsx --test tests/globe-textures.test.mjs`
Expected: FAIL, `Cannot find module '…/scripts/build-globe-textures.mjs'`.

- [ ] **Step 3: Write the texture script**

Create `scripts/build-globe-textures.mjs`:

```js
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
```

- [ ] **Step 4: Generate the tiers and the manifest**

Run (from the worktree root; about 15 s, light on memory): `node scripts/build-globe-textures.mjs` (or `npm run build:textures`)

Expected output (sharp 0.34.5 is deterministic, so the sizes should match exactly; these are the figures after the Task 1 review fixes):

```
1k day: 46.3 KiB
2k day: 143.9 KiB
4k day: 414.5 KiB
1k night: 9.5 KiB
2k night: 38.0 KiB
4k night: 135.7 KiB
1k normal: 9.9 KiB
2k normal: 52.2 KiB
4k normal: 188.0 KiB
1k spec: 14.7 KiB
2k spec: 39.2 KiB
4k spec: 94.4 KiB
1k clouds: 104.8 KiB
2k clouds: 371.9 KiB
4k clouds: 1298.6 KiB
1k total: 185.2 KiB (189692 B)
2k total: 645.2 KiB (660662 B)
4k total: 2131.1 KiB (2182272 B)
Manifest written: src/components/globe/texture-manifest.ts
```

If `assets/source/earth-4k.glb` is missing, the script reads `public/models/earth-4k.glb` (the same file). Open `public/textures/earth/2k/day.webp` in an image viewer: the Arctic is at the top and the Americas on the left.

- [ ] **Step 5: Run the test and see it pass**

Run: `node --import tsx --test tests/globe-textures.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass (the generated manifest type-checks and lints as written).

No heavy gate: nothing that ships changes in this task (`package-site.mjs` does not copy `textures/` yet).

- [ ] **Step 7: Commit**

```bash
git add scripts/build-globe-textures.mjs tests/globe-textures.test.mjs src/components/globe/texture-manifest.ts public/textures/earth
git commit -m "feat: build upright globe texture tiers from the source model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check:** none (no visual change yet).


---

### Task 2: Pure globe logic

The framing, motion, tier and intro rules as plain TypeScript, unit-tested in Node. No three.js, no React, no DOM at import time. The site does not use them until Task 3.

**Files:**
- Create: `src/components/globe/constants.ts`, `src/components/globe/scroll.ts`, `src/components/globe/interaction.ts`, `src/components/globe/tiers.ts`, `src/components/globe/intro-store.ts`, `src/components/globe/intro-gate.ts`
- Test: `tests/globe-logic.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/globe-logic.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

const constants = await import("../src/components/globe/constants.ts");
const scroll = await import("../src/components/globe/scroll.ts");
const interaction = await import("../src/components/globe/interaction.ts");
const tiers = await import("../src/components/globe/tiers.ts");
const intro = await import("../src/components/globe/intro-store.ts");
const gate = await import("../src/components/globe/intro-gate.ts");

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearVec = (a, b, eps = 1e-9) => a.every((value, index) => near(value, b[index], eps));

test("the sun sweeps from the opening light to behind the centred globe", () => {
  assert.ok(nearVec(scroll.sunDirectionAt(0), scroll.normalize(constants.SUN_START)));
  assert.ok(nearVec(scroll.sunDirectionAt(1), scroll.normalize(constants.SUN_END)));
  let previousZ = Infinity;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const sun = scroll.sunDirectionAt(p);
    assert.ok(near(Math.hypot(...sun), 1), `unit vector at ${p}`);
    assert.ok(sun[2] <= previousZ + 1e-9, `the sun keeps moving behind the globe at ${p}`);
    previousZ = sun[2];
  }
  assert.ok(scroll.sunDirectionAt(constants.SUN_SWEEP[1])[2] < 0, "behind the globe at the centred beat");
});

test("the rig keeps the three beats' framing on a unit sphere and the camera dollies in", () => {
  const open = scroll.rigAt(0);
  const centred = scroll.rigAt(constants.RIG_RANGE[1]);
  assert.ok(near(open.scale, 3.1) && near(open.x, 2.4), JSON.stringify(open));
  assert.ok(near(centred.scale, 1.3, 1e-9) && near(centred.x, 0, 1e-9), JSON.stringify(centred));
  assert.deepEqual(scroll.rigAt(1), centred);
  assert.equal(scroll.cameraZAt(0), constants.CAMERA_Z);
  assert.ok(near(scroll.cameraZAt(1), 5.75));
  assert.ok(scroll.cameraZAt(0.5) < constants.CAMERA_Z && scroll.cameraZAt(0.5) > 5.75);
});

test("the tilt spring settles on its target with little overshoot", () => {
  const spring = interaction.createSpring();
  let peak = 0;
  for (let i = 0; i < 120; i++) peak = Math.max(peak, interaction.stepSpring(spring, 0.1, 1 / 60));
  assert.ok(Math.abs(spring.value - 0.1) < 1e-3, `settled within 2 s (${spring.value})`);
  assert.ok(peak < 0.11, `under 10% overshoot (${peak})`);
  const jump = interaction.createSpring();
  interaction.stepSpring(jump, 1, 5);
  assert.ok(Number.isFinite(jump.value) && Math.abs(jump.value) < 2, "a long frame stays stable");
});

test("dragging spins with the pointer, then coasts and stops", () => {
  const input = interaction.createPointerInput();
  const state = interaction.createDragState();
  input.dragging = true;
  input.dx = 144; // a tenth of a 1440 px viewport
  assert.ok(near(interaction.stepDrag(input, state, 1 / 60, 1440), Math.PI / 10));
  assert.equal(input.dx, 0, "the movement is consumed");
  input.dragging = false;
  let coast = 0;
  for (let i = 0; i < 60 * 6; i++) coast += interaction.stepDrag(input, state, 1 / 60, 1440);
  assert.ok(coast > 0, "inertia carries the spin after release");
  assert.equal(state.velocity, 0, "and stops within six seconds");
});

test("vertical drag pitches within limits and levels out on release", () => {
  const input = interaction.createPointerInput();
  const state = interaction.createDragState();
  input.dragging = true;
  for (let i = 0; i < 30; i++) {
    input.dy = 200;
    interaction.stepDrag(input, state, 1 / 60, 1440);
  }
  assert.equal(state.pitchTarget, constants.MAX_PITCH);
  input.dragging = false;
  for (let i = 0; i < 180; i++) interaction.stepDrag(input, state, 1 / 60, 1440);
  assert.ok(Math.abs(state.pitch.value) < 1e-3, `level again (${state.pitch.value})`);
});

test("the hero mode follows the spec's device table", () => {
  const desktop = { width: 1440, reducedMotion: false, saveData: false, webgl2: true };
  assert.equal(tiers.chooseHeroMode(desktop), "cinematic");
  assert.equal(tiers.chooseHeroMode({ ...desktop, reducedMotion: true }), "poster");
  assert.equal(tiers.chooseHeroMode({ ...desktop, webgl2: false }), "poster");
  assert.equal(tiers.chooseHeroMode({ ...desktop, saveData: true }), "poster");
  const phone = { ...desktop, width: 390 };
  assert.equal(tiers.chooseHeroMode(phone), "mobile-globe");
  assert.equal(tiers.chooseHeroMode({ ...phone, deviceMemory: 4 }), "mobile-globe");
  assert.equal(tiers.chooseHeroMode({ ...desktop, width: 768 }), "mobile-globe");
  assert.equal(tiers.chooseHeroMode({ ...phone, deviceMemory: 2 }), "galaxy");
  assert.equal(tiers.chooseHeroMode({ ...phone, saveData: true }), "galaxy");
  assert.equal(tiers.chooseHeroMode({ ...phone, reducedMotion: true }), "galaxy");
  assert.equal(tiers.chooseHeroMode({ ...phone, webgl2: false }), "galaxy");
});

test("the 4k set streams only to capable desktops with a hardware GPU", () => {
  const gpu = { viewportWidth: 1440, saveData: false, maxTextureSize: 16384, renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)" };
  assert.equal(tiers.canStream4k(gpu), true);
  assert.equal(tiers.canStream4k({ ...gpu, deviceMemory: 8, effectiveType: "4g" }), true);
  assert.equal(tiers.canStream4k({ ...gpu, deviceMemory: 4 }), false);
  assert.equal(tiers.canStream4k({ ...gpu, saveData: true }), false);
  assert.equal(tiers.canStream4k({ ...gpu, effectiveType: "3g" }), false);
  assert.equal(tiers.canStream4k({ ...gpu, maxTextureSize: 2048 }), false);
  assert.equal(tiers.canStream4k({ ...gpu, renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)" }), false);
  assert.equal(tiers.canStream4k({ ...gpu, viewportWidth: 800 }), false);
  assert.deepEqual([...tiers.GLOBE_MAPS], ["day", "night", "normal", "spec", "clouds"]);
});

test("intro progress only moves forward and the phases run in order", () => {
  const store = intro.createIntroStore("off");
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  store.reveal();
  store.finish();
  assert.equal(store.get().phase, "off", "without an intro there are no phases");
  store.start();
  assert.equal(store.get().phase, "loading");
  store.setProgress(0.5);
  store.setProgress(0.3);
  assert.equal(store.get().progress, 0.5, "never goes back");
  store.setProgress(2);
  assert.equal(store.get().progress, 1, "clamped");
  store.setProgress(Number.NaN);
  assert.equal(store.get().progress, 1, "NaN ignored");
  store.markReady();
  assert.equal(store.get().ready, true);
  store.reveal();
  assert.equal(store.get().phase, "reveal");
  store.finish();
  assert.equal(store.get().phase, "done");
  store.start();
  assert.equal(store.get().phase, "done", "a finished intro never restarts");
  unsubscribe();
  const before = calls;
  store.fail();
  assert.equal(calls, before, "unsubscribed listeners are not called");
});

test("the caps leave room for the reveal and the store starts off on the server", () => {
  assert.ok(intro.INTRO_REVEAL_MS + 500 <= intro.INTRO_EXTRA_CAP_MS);
  assert.ok(intro.INTRO_EXTRA_CAP_MS <= 2500 && intro.INTRO_LOAD_CAP_MS <= 4000);
  assert.equal(intro.introStore.get().phase, "off");
  assert.equal(intro.getServerIntroPhase(), "off");
});

function fakeWindow({ path = "/", hash = "", desktop = true, saveData = false, webgl2 = true, seen = false, storageThrows = false } = {}) {
  const attributes = {};
  const storage = new Map(seen ? [[gate.INTRO_SESSION_KEY, "1"]] : []);
  return {
    attributes,
    storage,
    location: { pathname: path, hash },
    matchMedia: (query) => ({ matches: query === gate.INTRO_QUERY && desktop }),
    sessionStorage: {
      getItem: (key) => {
        if (storageThrows) throw new Error("storage blocked");
        return storage.get(key) ?? null;
      },
      setItem: (key, value) => storage.set(key, value),
    },
    navigator: saveData ? { connection: { saveData: true } } : {},
    document: { documentElement: { setAttribute: (name, value) => { attributes[name] = value; } } },
    ...(webgl2 ? { WebGL2RenderingContext: function WebGL2RenderingContext() {} } : {}),
  };
}

test("the intro plays once, on a first desktop visit to the home page", () => {
  const win = fakeWindow();
  assert.equal(gate.runIntroGate(gate.INTRO_SESSION_KEY, gate.INTRO_QUERY, win), true);
  assert.equal(win.attributes["data-intro"], "play");
  assert.equal(win.storage.get(gate.INTRO_SESSION_KEY), "1");
  delete win.attributes["data-intro"];
  assert.equal(gate.runIntroGate(gate.INTRO_SESSION_KEY, gate.INTRO_QUERY, win), false, "a repeat view skips it");
  assert.equal(win.attributes["data-intro"], undefined);
});

test("the intro is skipped for reduced motion or phones, Save-Data, deep links, other pages, no WebGL2 and blocked storage", () => {
  for (const options of [{ desktop: false }, { saveData: true }, { hash: "#pricing" }, { path: "/services/" }, { webgl2: false }, { seen: true }, { storageThrows: true }]) {
    const win = fakeWindow(options);
    assert.equal(gate.runIntroGate(gate.INTRO_SESSION_KEY, gate.INTRO_QUERY, win), false, JSON.stringify(options));
    assert.equal(win.attributes["data-intro"], undefined, JSON.stringify(options));
  }
});

test("the serialised gate runs on its own as an inline script", () => {
  const win = fakeWindow();
  new Function("window", gate.introGateScript())(win);
  assert.equal(win.attributes["data-intro"], "play");
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --import tsx --test tests/globe-logic.test.mjs`
Expected: FAIL, `Cannot find module '…/src/components/globe/constants.ts'`.

- [ ] **Step 3: Create the constants**

Create `src/components/globe/constants.ts`:

```ts
/**
 * Tunables for the hero globe. World units: the Earth's radius is 1 and the camera looks at the
 * origin from +Z. Change motion and framing numbers here, and shading numbers in LOOK (materials.ts).
 */
export type Vec3 = [number, number, number];

export const CLOUD_RADIUS = 1.012;
export const ATMOSPHERE_RADIUS = 1.08;
/** Earth's axial tilt (23.5°), as in the previous scene. */
export const AXIAL_TILT = 0.41;
/**
 * Spin about the axis at mount. rotation.y = -(λ + 90°) turns longitude λ toward +Z; the extra -21°
 * allows for the opening frame, where the camera sees the off-centre globe about 21° off-axis.
 * West Africa and Europe face the reader at the first beat.
 */
export const INITIAL_SPIN = (-(10 + 90 + 21) * Math.PI) / 180;
/** rad/s, the previous scene's rate. */
export const IDLE_SPIN = 0.035;
/** rad/s on top of the surface spin. */
export const CLOUD_DRIFT = 0.006;

export const CAMERA_FOV = 38;
export const CAMERA_Z = 6.2;
/** ACES Filmic exposure, unchanged from the previous scene so the galaxy and stars keep their look. */
export const EXPOSURE = 1.2;

/** Toward the sun. Opening beat: front-left, the visible face lit. Centred beat: upper-left, behind. */
export const SUN_START: Vec3 = [-4, 2.5, 4];
export const SUN_END: Vec3 = [-0.8, 0.45, -0.45];
/** Scroll window of the sun sweep (the same window as the shrink to centre). */
export const SUN_SWEEP: [number, number] = [0.08, 0.62];
/** The mobile globe's fixed sun: mostly night with a lit crescent, like the desktop's centred beat. */
export const MOBILE_SUN_T = 0.8;
export const MOBILE_RADIUS = 1.5;

/** Rig: the previous model's radius 5 × its 0.62 → 0.26 rig scale, now on a unit sphere. */
export const RIG_RANGE: [number, number] = [0.1, 0.62];
export const RIG_SCALE: [number, number] = [3.1, 1.3];
export const RIG_X: [number, number] = [2.4, 0];
/** Slow camera dolly-in over the whole hero. */
export const DOLLY_Z: [number, number] = [CAMERA_Z, 5.75];

/** Pointer tilt (≈6°), drag pitch limit and drag feel. */
export const MAX_TILT = (6 * Math.PI) / 180;
export const MAX_PITCH = 0.3;
export const DRAG_RADIANS_PER_VIEWPORT = Math.PI;
/** 1/s, exponential decay of the release velocity. */
export const DRAG_FRICTION = 2.2;
/** Radians at the viewport edge. */
export const STAR_PARALLAX = 0.03;

/** Intro reveal: the globe fades up from black while the atmosphere flares. */
export const REVEAL_SECONDS = 1.2;
export const FLARE_SECONDS = 1.6;
export const FLARE_GAIN = 1.6;
```

- [ ] **Step 4: Create the scroll math**

Create `src/components/globe/scroll.ts`:

```ts
import { DOLLY_Z, RIG_RANGE, RIG_SCALE, RIG_X, SUN_END, SUN_START, SUN_SWEEP, type Vec3 } from "./constants";

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function mapClamp(x: number, inA: number, inB: number, outA: number, outB: number): number {
  return outA + (outB - outA) * clamp01((x - inA) / (inB - inA));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/** Spherical interpolation between two directions; the result is a unit vector. */
export function slerpDirection(from: Vec3, to: Vec3, t: number): Vec3 {
  const a = normalize(from);
  const b = normalize(to);
  const cos = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(cos);
  if (omega < 1e-4) return a;
  const sin = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sin;
  const wb = Math.sin(t * omega) / sin;
  return normalize([a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]);
}

/** Toward the sun at hero scroll progress p: the terminator crosses the face as the globe centres. */
export function sunDirectionAt(p: number): Vec3 {
  return slerpDirection(SUN_START, SUN_END, smoothstep(SUN_SWEEP[0], SUN_SWEEP[1], p));
}

/** Globe placement for the scroll beats: right of centre, then shrinking to the centre. */
export function rigAt(p: number): { scale: number; x: number } {
  return {
    scale: mapClamp(p, RIG_RANGE[0], RIG_RANGE[1], RIG_SCALE[0], RIG_SCALE[1]),
    x: mapClamp(p, RIG_RANGE[0], RIG_RANGE[1], RIG_X[0], RIG_X[1]),
  };
}

/** Slow camera dolly-in across the whole hero. */
export function cameraZAt(p: number): number {
  return mapClamp(p, 0, 1, DOLLY_Z[0], DOLLY_Z[1]);
}
```

- [ ] **Step 5: Create the spring and drag model**

Create `src/components/globe/interaction.ts`:

```ts
import { DRAG_FRICTION, DRAG_RADIANS_PER_VIEWPORT, MAX_PITCH } from "./constants";

export type Spring = { value: number; velocity: number };
export const createSpring = (value = 0): Spring => ({ value, velocity: 0 });

/** Damped spring toward a target (semi-implicit Euler in 1/120 s substeps, so long frames stay stable). */
export function stepSpring(spring: Spring, target: number, dt: number, stiffness = 60, damping = 14): number {
  let remaining = Math.min(Math.max(dt, 0), 0.25);
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 120);
    spring.velocity += (stiffness * (target - spring.value) - damping * spring.velocity) * h;
    spring.value += spring.velocity * h;
    remaining -= h;
  }
  return spring.value;
}

/** Pointer state shared by the DOM listeners and the render loop. x, y: -1…1 across the viewport, y up. */
export type PointerInput = { x: number; y: number; dragging: boolean; dx: number; dy: number };
export const createPointerInput = (): PointerInput => ({ x: 0, y: 0, dragging: false, dx: 0, dy: 0 });

export type DragState = { velocity: number; pitchTarget: number; pitch: Spring };
export const createDragState = (): DragState => ({ velocity: 0, pitchTarget: 0, pitch: createSpring() });

/**
 * Consumes this frame's drag movement and returns the extra spin (radians) to apply now. While
 * dragging, the globe follows the pointer; after release it keeps the release velocity and eases
 * back to the idle spin (exponential friction). Vertical drag pitches the globe, clamped, and it
 * springs back to level on release.
 */
export function stepDrag(input: PointerInput, state: DragState, dt: number, viewportWidth: number): number {
  const scale = DRAG_RADIANS_PER_VIEWPORT / Math.max(1, viewportWidth);
  let spin: number;
  if (input.dragging) {
    spin = input.dx * scale;
    if (dt > 0) state.velocity = state.velocity * 0.5 + (spin / dt) * 0.5;
    state.pitchTarget = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, state.pitchTarget + input.dy * scale));
  } else {
    state.velocity *= Math.exp(-DRAG_FRICTION * dt);
    if (Math.abs(state.velocity) < 1e-3) state.velocity = 0;
    spin = state.velocity * dt;
    state.pitchTarget = 0;
  }
  input.dx = 0;
  input.dy = 0;
  stepSpring(state.pitch, state.pitchTarget, dt, 40, 12);
  return spin;
}
```

- [ ] **Step 6: Create the device tiers**

Create `src/components/globe/tiers.ts`:

```ts
import { GLOBE_TEXTURES } from "./texture-manifest";

export type GlobeTier = keyof typeof GLOBE_TEXTURES;
export type GlobeMapName = keyof (typeof GLOBE_TEXTURES)["1k"];
export const GLOBE_MAPS: readonly GlobeMapName[] = ["day", "night", "normal", "spec", "clouds"];

/** What the hero shows on this device (the spec's device table). */
export type HeroMode = "cinematic" | "mobile-globe" | "poster" | "galaxy";
export type DeviceEnv = { width: number; reducedMotion: boolean; saveData: boolean; webgl2: boolean; deviceMemory?: number };

export function chooseHeroMode(env: DeviceEnv): HeroMode {
  const animated = !env.reducedMotion && !env.saveData && env.webgl2;
  if (env.width >= 1024) return animated ? "cinematic" : "poster";
  return animated && (env.deviceMemory === undefined || env.deviceMemory >= 4) ? "mobile-globe" : "galaxy";
}

export type GpuEnv = {
  viewportWidth: number;
  saveData: boolean;
  effectiveType?: string;
  deviceMemory?: number;
  maxTextureSize: number;
  renderer: string;
};

/** Software rasterisers (headless SwiftShader, llvmpipe, Microsoft Basic Render) stay on 2k. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** The 4k set (≈2.1 MB download, ≈120 MB of GPU memory) streams after idle only on capable desktops. */
export function canStream4k(env: GpuEnv): boolean {
  if (env.viewportWidth < 1024 || env.saveData) return false;
  if (env.maxTextureSize < 4096 || SOFTWARE_RENDERER.test(env.renderer)) return false;
  if (env.effectiveType && /^(slow-2g|2g|3g)$/.test(env.effectiveType)) return false;
  return env.deviceMemory === undefined || env.deviceMemory >= 8;
}
```

- [ ] **Step 7: Create the intro store**

Create `src/components/globe/intro-store.ts`:

```ts
/** Intro loader state shared by IntroOverlay (root layout), the hero copy and the globe scene. */
export type IntroPhase = "off" | "loading" | "reveal" | "done";
export type IntroState = { phase: IntroPhase; progress: number; ready: boolean; failed: boolean };

/** The page reveals at most this long after the overlay appeared, even if textures are still loading. */
export const INTRO_LOAD_CAP_MS = 4000;
/** The counter's catch-up plus the reveal never add more than this once the globe is ready. */
export const INTRO_EXTRA_CAP_MS = 2500;
/** Overlay exit, globe fade-up and headline rise. */
export const INTRO_REVEAL_MS = 1100;

export function createIntroStore(initial: IntroPhase = "off") {
  let state: IntroState = { phase: initial, progress: 0, ready: false, failed: false };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<IntroState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  return {
    get: (): IntroState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (state.phase === "off") set({ phase: "loading" });
    },
    /** Monotonic, clamped to 0…1; NaN is ignored. */
    setProgress(fraction: number) {
      const next = Math.min(1, Math.max(state.progress, fraction));
      if (next > state.progress) set({ progress: next });
    },
    markReady() {
      if (!state.ready) set({ ready: true, progress: 1 });
    },
    fail() {
      if (!state.failed) set({ failed: true });
    },
    reveal() {
      if (state.phase === "loading") set({ phase: "reveal" });
    },
    finish() {
      if (state.phase === "loading" || state.phase === "reveal") set({ phase: "done" });
    },
  };
}
export type IntroStore = ReturnType<typeof createIntroStore>;

/** The page-wide store. The inline gate (IntroGate.tsx) has already run when this module loads. */
export const introStore = createIntroStore(
  typeof document !== "undefined" && document.documentElement.dataset.intro === "play" ? "loading" : "off",
);
export const getIntroPhase = (): IntroPhase => introStore.get().phase;
export const getServerIntroPhase = (): IntroPhase => "off";
```

- [ ] **Step 8: Create the intro gate**

Create `src/components/globe/intro-gate.ts`:

```ts
export const INTRO_SESSION_KEY = "spacegear:intro-seen";
export const INTRO_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

type GateWindow = {
  location: { pathname: string; hash: string };
  matchMedia(query: string): { matches: boolean };
  sessionStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  navigator: { connection?: { saveData?: boolean } };
  document: { documentElement: { setAttribute(name: string, value: string): void } };
  WebGL2RenderingContext?: unknown;
};

/**
 * Decides before first paint whether the intro plays: the home page without a hash, a desktop
 * width with motion allowed, no Save-Data, WebGL2 present, and not yet seen in this tab's session.
 * It is serialised with toString() into an inline script, so it must not use anything outside its
 * parameters.
 */
export function runIntroGate(key: string, query: string, win: GateWindow): boolean {
  try {
    if (win.location.pathname !== "/" || win.location.hash) return false;
    if (!win.matchMedia(query).matches) return false;
    if (win.navigator.connection && win.navigator.connection.saveData) return false;
    if (typeof win.WebGL2RenderingContext !== "function") return false;
    if (win.sessionStorage.getItem(key)) return false;
    win.sessionStorage.setItem(key, "1");
    win.document.documentElement.setAttribute("data-intro", "play");
    return true;
  } catch {
    return false;
  }
}

/** The inline script body rendered by IntroGate.tsx. */
export function introGateScript(): string {
  return `(${runIntroGate.toString()})(${JSON.stringify(INTRO_SESSION_KEY)},${JSON.stringify(INTRO_QUERY)},window);`;
}
```

- [ ] **Step 9: Run the test and see it pass**

Run: `node --import tsx --test tests/globe-logic.test.mjs`
Expected: PASS, 12 tests.

- [ ] **Step 10: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass. No heavy gate: nothing imports these modules yet.

- [ ] **Step 11: Commit**

```bash
git add src/components/globe/constants.ts src/components/globe/scroll.ts src/components/globe/interaction.ts src/components/globe/tiers.ts src/components/globe/intro-store.ts src/components/globe/intro-gate.ts tests/globe-logic.test.mjs
git commit -m "feat: add the globe's framing, motion, tier and intro rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check:** none.


---

### Task 3: Shader earth replaces the GLB

The hero now renders a unit sphere with the earth shader (day/night terminator, twilight band, city lights, ocean glint, relief, cloud shadows) from the 2k tier, plus the unchanged galaxy, stars and visible sun. The sun is fixed at the opening light for now (the sweep comes in Task 4); clouds and atmosphere shells come in Task 4. The GLB is no longer requested; its files are deleted in Task 10.

**Files:**
- Create: `src/components/globe/textures.ts`, `src/components/globe/shaders.ts`, `src/components/globe/materials.ts`, `src/components/globe/Globe.tsx`, `src/components/globe/Backdrop.tsx`, `src/components/globe/device.ts`
- Replace: `src/components/EarthScene.tsx`
- Modify: `src/components/sections/OrbitalCinematic.tsx`, `src/app/globals.css`, `scripts/package-site.mjs`, `scripts/check-export.mjs`, `scripts/browser-check.mjs`
- Test: `tests/globe-materials.test.mjs`, `scripts/browser-check.mjs`

- [ ] **Step 1: Write the failing unit test**

Create `tests/globe-materials.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

const { createGlobeMaterials, applyGlobeTextures } = await import("../src/components/globe/materials.ts");
const { BACKDROP_ENTRY, globeEntries } = await import("../src/components/globe/textures.ts");

const MAPS = ["day", "night", "normal", "spec", "clouds"];
const fakeSet = () => Object.fromEntries(MAPS.map((key) => [key, new THREE.Texture()]));

test("texture entries come from the manifest with the right sampling kind", () => {
  for (const tier of ["1k", "2k", "4k"]) {
    const entries = globeEntries(tier);
    assert.deepEqual(entries.map((entry) => entry.key), MAPS);
    assert.ok(entries.every((entry) => entry.url === `/textures/earth/${tier}/${entry.key}.webp` && entry.bytes > 0), tier);
    assert.deepEqual(Object.fromEntries(entries.map((entry) => [entry.key, entry.kind])), { day: "color", night: "mask", normal: "data", spec: "mask", clouds: "mask" });
  }
  assert.deepEqual({ url: BACKDROP_ENTRY.url, kind: BACKDROP_ENTRY.kind }, { url: "/images/galaxy.webp", kind: "color" });
});

test("the earth material samples every map and is tone-mapped by the renderer", () => {
  const textures = fakeSet();
  const { earth } = createGlobeMaterials(textures);
  for (const [uniform, key] of [["uDay", "day"], ["uNight", "night"], ["uNormal", "normal"], ["uSpec", "spec"], ["uClouds", "clouds"]]) {
    assert.equal(earth.uniforms[uniform].value, textures[key], uniform);
  }
  assert.equal(earth.toneMapped, true);
  assert.equal(earth.uniforms.uNormalGain.value, 4);
  assert.match(earth.fragmentShader, /#include <tonemapping_fragment>\s*#include <colorspace_fragment>/);
  assert.ok(earth.uniforms.uTwilight.value.equals(new THREE.Color("#fa6e43")), "brand orange twilight");
});

test("a new tier is rebound in place", () => {
  const first = fakeSet();
  const second = fakeSet();
  const materials = createGlobeMaterials(first);
  applyGlobeTextures(materials, second);
  for (const [uniform, key] of [["uDay", "day"], ["uNight", "night"], ["uNormal", "normal"], ["uSpec", "spec"], ["uClouds", "clouds"]]) {
    assert.equal(materials.earth.uniforms[uniform].value, second[key], uniform);
  }
});

test("no shader raises a possibly negative number to a power", () => {
  const materials = createGlobeMaterials(fakeSet());
  for (const material of Object.values(materials)) {
    assert.doesNotMatch(material.fragmentShader, /pow\(\s*\(/, `${material.name}: pow() of a bracketed difference can be negative`);
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --import tsx --test tests/globe-materials.test.mjs`
Expected: FAIL, `Cannot find module '…/src/components/globe/materials.ts'`.

- [ ] **Step 3: Write the failing browser checks**

Edit 1 of 8 in `scripts/browser-check.mjs`. Replace:

```js
import { build } from "esbuild";
import { launchBrowser } from "./browser-runtime.mjs";
```

with:

```js
import { build } from "esbuild";
import sharp from "sharp";
import { launchBrowser } from "./browser-runtime.mjs";
```

Edit 2 of 8 in `scripts/browser-check.mjs`. Replace:

```js
// Records CSP violations and blocked-texture errors on every page and route a context opens.
```

with:

```js
// Screenshot of the hero globe's canvas alone (the copy, scrim and hint layers hidden), cropped to a
// region given in fractions of the canvas, downsampled to 96×64 RGB.
async function globeCapture(page, region = { x: 0.55, y: 0.2, w: 0.4, h: 0.6 }) {
  const toggle = hide => page.evaluate(hide => {
    for (const el of document.querySelectorAll("#home .sticky > :not(.hero-scene)")) {
      if (hide) el.style.setProperty("visibility", "hidden"); else el.style.removeProperty("visibility");
    }
  }, hide);
  await toggle(true);
  const png = await page.locator("#home .hero-scene canvas").screenshot();
  await toggle(false);
  const image = sharp(png);
  const { width, height } = await image.metadata();
  return image
    .extract({ left: Math.round(width * region.x), top: Math.round(height * region.y), width: Math.round(width * region.w), height: Math.round(height * region.h) })
    .removeAlpha().resize(96, 64, { fit: "fill" }).raw().toBuffer();
}
// Mean and spread of luminance, and the number of distinct colours (4 bits per channel).
function pixelStats(data) {
  let sum = 0, squares = 0;
  const colours = new Set();
  for (let i = 0; i < data.length; i += 3) {
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += luma; squares += luma * luma;
    colours.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
  }
  const n = data.length / 3, mean = sum / n;
  return { mean: Math.round(mean), stdev: Math.round(Math.sqrt(Math.max(0, squares / n - mean * mean))), distinct: colours.size };
}

// Records CSP violations and blocked-texture errors on every page and route a context opens.
```

Edit 3 of 8 in `scripts/browser-check.mjs`. Replace:

```js
    // Counts decoded image bitmaps; three's GLTF loader decodes the globe's embedded textures this way.
```

with:

```js
    // Counts decoded image bitmaps; the globe's texture loader decodes its WebP maps this way.
```

Edit 4 of 8 in `scripts/browser-check.mjs`. Replace:

```js
    page.on("request", request => requests.push(request.url()));
    await page.addInitScript(() => {
```

with:

```js
    page.on("request", request => requests.push(request.url()));
    // three.js reports shader compile and link failures as console errors starting with "THREE.".
    const shaderErrors = [];
    page.on("console", message => { if (message.type() === "error" && /THREE\./.test(message.text())) shaderErrors.push(message.text().slice(0, 300)); });
    await page.addInitScript(() => {
```

Edit 5 of 8 in `scripts/browser-check.mjs`. Replace:

```js
    const models = requests.filter(url => /\.glb(?:$|\?)/.test(url));
    if (profile.width < 1024 || profile.reducedMotion || profile.javaScriptEnabled === false) assert.equal(models.length, 0, `${profile.name}: no model`);
    if (profile.name === "desktop") {
      assert.equal(models.length, 1, "desktop enhancement loads one model");
      // The globe's textures are embedded in the model and fetched as blob: URLs; the CSP must let them load.
      await page.waitForFunction(() => window.__bitmaps.some(b => b.w >= 512), null, { timeout: 20000 }).catch(() => {});
      assert.deepEqual(cspProblems, [], "desktop /: the globe loads without CSP violations or texture errors");
      assert.ok(await page.evaluate(() => window.__bitmaps.some(b => b.w >= 512)), "desktop /: the globe's embedded textures decode");
      report.interactions.push("desktop globe textures decode under the shipped CSP");
    }
```

with:

```js
    if (profile.name === "desktop") {
      // The globe streams same-origin WebP maps (fetch + createImageBitmap) under the shipped CSP.
      await page.waitForSelector('#home .hero-scene[data-globe="ready"]', { timeout: 45000 });
      await page.waitForTimeout(900); // the canvas's 0.6 s fade-in over the poster
      assert.deepEqual(cspProblems, [], "desktop /: the globe loads without CSP violations or texture errors");
      assert.deepEqual(shaderErrors, [], "desktop /: the globe's shaders compile");
      assert.ok(await page.evaluate(() => window.__bitmaps.some(b => b.w === 2048)), "desktop /: the 2k maps decode");
      const textures = requests.filter(url => url.includes("/textures/earth/"));
      assert.ok(textures.length >= 5 && textures.every(url => url.includes("/textures/earth/2k/")), `desktop: the first frame uses the 2k set (${textures.join(", ")})`);
      const pixels = pixelStats(await globeCapture(page));
      assert.ok(pixels.stdev > 10 && pixels.distinct > 40, `desktop: the globe renders non-uniform pixels (${JSON.stringify(pixels)})`);
      report.interactions.push(`desktop globe renders its 2k maps under the shipped CSP (${JSON.stringify(pixels)})`);
    }
```

Edit 6 of 8 in `scripts/browser-check.mjs`. Replace:

```js
    assert.deepEqual(errors, [], `${profile.name}: console errors`);
    const metrics = await page.evaluate(() => ({
      ...window.__audit,
      resourceBytes: performance.getEntriesByType("resource").reduce((sum, entry) => sum + entry.encodedBodySize, 0),
      jsBytes: performance.getEntriesByType("resource").filter(entry => entry.initiatorType === "script").reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    }));
    report.profiles.push({ name: profile.name, models: models.length, ...metrics });
```

with:

```js
    assert.deepEqual(errors, [], `${profile.name}: console errors`);
    // No GLB or Draco file is ever requested; reduced motion and no-JS load no globe textures at all.
    const forbidden = requests.filter(url => /\.glb(?:$|\?)|\/draco\//.test(url));
    assert.deepEqual(forbidden, [], `${profile.name}: no GLB or Draco request`);
    const textureRequests = requests.filter(url => url.includes("/textures/earth/"));
    if (profile.reducedMotion || profile.javaScriptEnabled === false) assert.deepEqual(textureRequests, [], `${profile.name}: no globe textures`);
    const metrics = await page.evaluate(() => ({
      ...window.__audit,
      resourceBytes: performance.getEntriesByType("resource").reduce((sum, entry) => sum + entry.encodedBodySize, 0),
      jsBytes: performance.getEntriesByType("resource").filter(entry => entry.initiatorType === "script").reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    }));
    // Layout stability is now gated, not only recorded: the hero's static → cinematic and poster →
    // canvas swaps must not shift content (unset without JavaScript).
    assert.ok(!(metrics.cls >= 0.05), `${profile.name}: cumulative layout shift ${metrics.cls}`);
    report.profiles.push({ name: profile.name, textures: textureRequests.length, ...metrics });
```

Edit 7 of 8 in `scripts/browser-check.mjs`. Replace:

```js
  const fallbackErrors = [], fallbackModels = [];
  fallbackPage.on("pageerror", error => fallbackErrors.push(error.message));
  fallbackPage.on("request", request => { if (/\.glb(?:$|\?)/.test(request.url())) fallbackModels.push(request.url()); });
```

with:

```js
  const fallbackErrors = [], fallbackDownloads = [];
  fallbackPage.on("pageerror", error => fallbackErrors.push(error.message));
  fallbackPage.on("request", request => { if (/\.glb(?:$|\?)|\/draco\/|\/textures\/earth\//.test(request.url())) fallbackDownloads.push(request.url()); });
```

Edit 8 of 8 in `scripts/browser-check.mjs`. Replace:

```js
  assert.deepEqual(fallbackModels, [], "webgl-fallback: no model download");
  await fallbackPage.close();
  report.interactions.push("failed WebGL retains headline, poster and CTA, without errors or the model download");
```

with:

```js
  assert.deepEqual(fallbackDownloads, [], "webgl-fallback: no model, decoder or texture download");
  await fallbackPage.close();
  report.interactions.push("failed WebGL retains headline, poster and CTA, without errors or any globe download");
```

- [ ] **Step 4: Run the browser check against the current build and see it fail**

Run: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787`
Expected: FAIL in the `desktop` profile with `page.waitForSelector: Timeout 45000ms exceeded` waiting for `#home .hero-scene[data-globe="ready"]` (the old build has no `data-globe`).

- [ ] **Step 5: Create the texture loader**

Create `src/components/globe/textures.ts`:

```ts
import * as THREE from "three";
import { BACKDROP_TEXTURE, GLOBE_TEXTURES } from "./texture-manifest";
import { GLOBE_MAPS, type GlobeMapName, type GlobeTier } from "./tiers";

/** How a map is sampled: colour (sRGB, RGBA), data (linear RGBA) or mask (linear, red channel only). */
export type TextureKind = "color" | "data" | "mask";
export type TextureEntry<K extends string = string> = { key: K; url: string; bytes: number; kind: TextureKind };
export type GlobeTextureSet = Record<GlobeMapName, THREE.Texture>;
export type HeroTextures = { globe: GlobeTextureSet; backdrop: THREE.Texture | null };

const KIND: Record<GlobeMapName, TextureKind> = { day: "color", night: "mask", normal: "data", spec: "mask", clouds: "mask" };

export function globeEntries(tier: GlobeTier): TextureEntry<GlobeMapName>[] {
  return GLOBE_MAPS.map((key) => ({ key, url: GLOBE_TEXTURES[tier][key].url, bytes: GLOBE_TEXTURES[tier][key].bytes, kind: KIND[key] }));
}

export const BACKDROP_ENTRY: TextureEntry<"backdrop"> = { key: "backdrop", url: BACKDROP_TEXTURE.url, bytes: BACKDROP_TEXTURE.bytes, kind: "color" };

/** createImageBitmap honours imageOrientation in Chromium, Firefox ≥ 98 and Safari ≥ 17 (as three's GLTFLoader checks). */
function bitmapOptionsSupported(): boolean {
  if (typeof createImageBitmap === "undefined") return false;
  const agent = navigator.userAgent;
  const safari = /^((?!chrome|android).)*safari/i.test(agent) ? Number(agent.match(/version\/(\d+)/i)?.[1] ?? 0) : Infinity;
  const firefox = agent.includes("Firefox") ? Number(agent.match(/Firefox\/(\d+)/)?.[1] ?? 0) : Infinity;
  return safari >= 17 && firefox >= 98;
}

type Decoded = { image: ImageBitmap | HTMLImageElement; bitmap: boolean };

/** Decodes off the main thread. Bitmaps are flipped here, because WebGL ignores UNPACK_FLIP_Y for them. */
async function decode(blob: Blob): Promise<Decoded> {
  if (bitmapOptionsSupported()) {
    try {
      const image = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" });
      return { image, bitmap: true };
    } catch {
      // Fall through to the <img> decoder.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { image, bitmap: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toTexture(kind: TextureKind, decoded: Decoded): THREE.Texture {
  const texture: THREE.Texture = new THREE.Texture(decoded.image);
  texture.flipY = !decoded.bitmap;
  texture.colorSpace = kind === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.format = kind === "mask" ? THREE.RedFormat : THREE.RGBAFormat;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8; // three clamps this to the GPU's maximum
  texture.needsUpdate = true;
  return texture;
}

export type LoadOptions = { manager?: THREE.LoadingManager; onProgress?: (fraction: number) => void };

/**
 * Fetches every entry with THREE.FileLoader (byte progress from the response stream; the manifest's
 * sizes weight it), decodes it and wraps it in a texture. Progress: 90% bytes, 10% decoding.
 */
export async function loadTextureSet<K extends string>(entries: TextureEntry<K>[], { manager = new THREE.LoadingManager(), onProgress }: LoadOptions = {}): Promise<Record<K, THREE.Texture>> {
  const expected = entries.reduce((sum, entry) => sum + entry.bytes, 0) || 1;
  const received = new Map<K, number>();
  let decoded = 0;
  const report = () => {
    let bytes = 0;
    for (const entry of entries) bytes += Math.min(received.get(entry.key) ?? 0, entry.bytes);
    onProgress?.(0.9 * (bytes / expected) + (0.1 * decoded) / entries.length);
  };
  const loader = new THREE.FileLoader<Blob>(manager).setResponseType("blob");
  const pairs = await Promise.all(
    entries.map(async (entry) => {
      const blob = await loader.loadAsync(entry.url, (event) => {
        received.set(entry.key, event.loaded);
        report();
      });
      received.set(entry.key, entry.bytes);
      report();
      const texture = toTexture(entry.kind, await decode(blob));
      decoded += 1;
      report();
      return [entry.key, texture] as const;
    }),
  );
  return Object.fromEntries(pairs) as Record<K, THREE.Texture>;
}

/** The hero's first set: the globe tier plus, on desktop, the galaxy backdrop. */
export async function loadHeroTextures(tier: GlobeTier, { backdrop, onProgress }: { backdrop: boolean; onProgress?: (fraction: number) => void }): Promise<HeroTextures> {
  const entries: TextureEntry<GlobeMapName | "backdrop">[] = [...globeEntries(tier), ...(backdrop ? [BACKDROP_ENTRY] : [])];
  const { backdrop: sky, ...globe } = await loadTextureSet(entries, { onProgress });
  return { globe: globe as GlobeTextureSet, backdrop: sky ?? null };
}

/** After the GPU upload, frees the decoded copy (ImageBitmaps only; an <img> fallback is left to GC). */
export function releaseSource(texture: THREE.Texture): void {
  const data: unknown = texture.source.data;
  if (typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap) data.close();
}

export function disposeTextureSet(set: Record<string, THREE.Texture>): void {
  for (const texture of Object.values(set)) texture.dispose();
}
```

- [ ] **Step 6: Create the earth shaders**

Create `src/components/globe/shaders.ts`:

```ts
/**
 * GLSL for the hero globe (three.js ShaderMaterial, GLSL ES 1.0 style; three maps it to WebGL2).
 * All lighting is in world space and in linear light. Every fragment shader ends with three's
 * tone mapping (ACES Filmic, set on the renderer) and output colour-space chunks.
 * pow() is only ever given a non-negative base: pow(x, y) with x < 0 is undefined in GLSL.
 */

export const EARTH_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vEastW;
varying vec3 vNorthW;
varying vec3 vPosW;
varying float vCosLat;

void main() {
  vUv = uv;
  // Unit sphere: the object-space normal is the position. East follows +u and north follows +v
  // of three's SphereGeometry UVs, matching the upright equirectangular maps.
  vec3 n = normalize(position);
  vec3 e = vec3(n.z, 0.0, -n.x);
  vCosLat = length(e);
  e = vCosLat > 1e-5 ? e / vCosLat : vec3(0.0, 0.0, -1.0);
  mat3 toWorld = mat3(modelMatrix);
  vNormalW = normalize(toWorld * n);
  vEastW = normalize(toWorld * e);
  vNorthW = normalize(toWorld * cross(n, e));
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const EARTH_FRAGMENT = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uNormal;
uniform sampler2D uSpec;
uniform sampler2D uClouds;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uTwilight;
uniform vec3 uCityColor;
uniform vec3 uAtmoDay;
uniform float uCityGain;
uniform float uTwilightGain;
uniform float uRimGain;
uniform float uRelief;
uniform float uNormalGain;
uniform float uCloudOffset;
uniform float uCloudShadow;
uniform float uNightAmbient;
uniform float uReveal;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vEastW;
varying vec3 vNorthW;
varying vec3 vPosW;
varying float vCosLat;

const float PI = 3.141592653589793;
const float CLOUD_HEIGHT = 0.012;

void main() {
  vec3 n0 = normalize(vNormalW);
  vec3 east = normalize(vEastW);
  vec3 north = normalize(vNorthW);
  vec3 sun = normalize(uSunDir);
  vec3 view = normalize(cameraPosition - vPosW);

  // Relief: the normal map stores east and north slopes, multiplied by uNormalGain, around 0.5.
  vec2 slope = (texture2D(uNormal, vUv).rg * 2.0 - 1.0) / uNormalGain;
  vec3 n = normalize(n0 + uRelief * (slope.x * east + slope.y * north));

  // The terminator follows the smooth sphere; relief only shades within the day side.
  float sunDot = dot(n0, sun);
  float dayMix = smoothstep(-0.10, 0.22, sunDot);
  float nightMix = 1.0 - smoothstep(-0.18, 0.06, sunDot);
  float band = (sunDot - 0.03) / 0.07;
  float twilight = exp(-band * band);

  // Clouds: the shell turns faster than the surface (uCloudOffset, in turns). The shadow is the
  // cover one cloud height toward the sun.
  vec2 cloudUv = vec2(vUv.x - uCloudOffset, vUv.y);
  vec3 toward = sun - n0 * sunDot;
  float reach = CLOUD_HEIGHT / max(sunDot, 0.2);
  vec2 shadowUv = cloudUv + vec2(
    dot(toward, east) * reach / (2.0 * PI * max(vCosLat, 0.05)),
    dot(toward, north) * reach / PI
  );
  float cloudAbove = texture2D(uClouds, cloudUv).r;
  float cloudShadow = texture2D(uClouds, shadowUv).r;

  // Day: Lambert with relief, darkened under cloud shadows.
  vec3 albedo = texture2D(uDay, vUv).rgb;
  vec3 color = albedo * uSunColor * max(dot(n, sun), 0.0) * (1.0 - uCloudShadow * cloudShadow * dayMix);

  // Oceans: a Blinn-Phong glint on the smooth normal, masked by the ocean map and open sky.
  float ocean = texture2D(uSpec, vUv).r;
  vec3 halfway = normalize(sun + view);
  float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n0, view), 0.0), 5.0);
  float glint = pow(max(dot(n0, halfway), 0.0), 140.0) * (0.5 + fresnel);
  color += uSunColor * glint * ocean * dayMix * (1.0 - cloudAbove) * 0.7;

  // Twilight: brand-orange light along the terminator.
  color += albedo * uTwilight * twilight * uTwilightGain;

  // Night: only the city lights (sRGB-encoded luminance), warm and over-bright, dimmed under clouds.
  float lights = pow(texture2D(uNight, vUv).r, 2.2);
  color += uCityColor * uCityGain * lights * nightMix * (1.0 - 0.7 * cloudAbove);
  color += albedo * uNightAmbient * (1.0 - dayMix);

  // Day-side limb haze.
  float rim = pow(1.0 - max(dot(n0, view), 0.0), 3.0);
  color += uAtmoDay * rim * dayMix * uRimGain;

  gl_FragColor = vec4(color * uReveal, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
```

- [ ] **Step 7: Create the earth material**

Create `src/components/globe/materials.ts`:

```ts
import * as THREE from "three";
import { EARTH_FRAGMENT, EARTH_VERTEX } from "./shaders";
import { NORMAL_GAIN } from "./texture-manifest";
import type { GlobeTextureSet } from "./textures";

/**
 * Look tunables. Colours are sRGB hex (three converts them to linear); gains are linear and
 * calibrated for ACES Filmic at EXPOSURE 1.2 (constants.ts).
 */
export const LOOK = {
  sunColor: "#fff4e8",
  sunIntensity: 1.75,
  twilight: "#fa6e43",
  twilightGain: 0.38,
  city: "#ffb46b",
  cityGain: 3.75,
  atmosphereDay: "#5aa2ff",
  rimGain: 0.38,
  relief: 3,
  cloudShadow: 0.45,
  nightAmbient: 0.0125,
} as const;

export type GlobeMaterials = { earth: THREE.ShaderMaterial };

export function createGlobeMaterials(textures: GlobeTextureSet): GlobeMaterials {
  const earth = new THREE.ShaderMaterial({
    name: "GlobeEarth",
    vertexShader: EARTH_VERTEX,
    fragmentShader: EARTH_FRAGMENT,
    uniforms: {
      uDay: { value: textures.day },
      uNight: { value: textures.night },
      uNormal: { value: textures.normal },
      uSpec: { value: textures.spec },
      uClouds: { value: textures.clouds },
      uSunDir: { value: new THREE.Vector3(0, 0, 1) },
      uSunColor: { value: new THREE.Color(LOOK.sunColor).multiplyScalar(LOOK.sunIntensity) },
      uTwilight: { value: new THREE.Color(LOOK.twilight) },
      uAtmoDay: { value: new THREE.Color(LOOK.atmosphereDay) },
      uReveal: { value: 1 },
      uCityColor: { value: new THREE.Color(LOOK.city) },
      uCityGain: { value: LOOK.cityGain },
      uTwilightGain: { value: LOOK.twilightGain },
      uRimGain: { value: LOOK.rimGain },
      uRelief: { value: LOOK.relief },
      uNormalGain: { value: NORMAL_GAIN },
      uCloudOffset: { value: 0 },
      uCloudShadow: { value: LOOK.cloudShadow },
      uNightAmbient: { value: LOOK.nightAmbient },
    },
  });
  return { earth };
}

/** Rebinds a new texture set (2k → 4k) in place. */
export function applyGlobeTextures(target: { earth: THREE.ShaderMaterial; clouds?: THREE.ShaderMaterial }, textures: GlobeTextureSet): void {
  const uniforms = target.earth.uniforms;
  uniforms.uDay.value = textures.day;
  uniforms.uNight.value = textures.night;
  uniforms.uNormal.value = textures.normal;
  uniforms.uSpec.value = textures.spec;
  uniforms.uClouds.value = textures.clouds;
  if (target.clouds) target.clouds.uniforms.uClouds.value = textures.clouds;
}
```

- [ ] **Step 8: Create the Globe component**

Create `src/components/globe/Globe.tsx`:

```tsx
"use client";

import { useFrame, type RootState } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { AXIAL_TILT, IDLE_SPIN, INITIAL_SPIN } from "./constants";
import { applyGlobeTextures, createGlobeMaterials } from "./materials";
import type { GlobeTextureSet } from "./textures";

/** Per-frame inputs. The scene's driver writes them and the globe applies them in the same frame. */
export type GlobeFrame = { sun: THREE.Vector3; spinBoost: number; tiltX: number; tiltY: number; reveal: number; flare: number };
export function createGlobeFrame(): GlobeFrame {
  return { sun: new THREE.Vector3(0, 0, 1), spinBoost: 0, tiltX: 0, tiltY: 0, reveal: 1, flare: 1 };
}

const AXIS: [number, number, number] = [0, 0, AXIAL_TILT];
const SPIN_START: [number, number, number] = [0, INITIAL_SPIN, 0];

type GlobeProps = {
  textures: GlobeTextureSet;
  frame: RefObject<GlobeFrame>;
  onFrame?: (frame: GlobeFrame, delta: number, state: RootState) => void;
};

/**
 * The Earth: a unit sphere with the day/night shader. Hierarchy: pointer tilt → axial tilt → spin.
 * The material is created once and a new texture set is rebound in place. It is not disposed on
 * unmount: the globe only unmounts with its Canvas, whose context loss frees the GPU.
 */
export default function Globe({ textures, frame, onFrame }: GlobeProps) {
  const [materials] = useState(() => createGlobeMaterials(textures));
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const earth = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const earthMesh = earth.current;
    if (earthMesh) applyGlobeTextures({ earth: earthMesh.material as THREE.ShaderMaterial }, textures);
  }, [textures]);

  useFrame((state, raw) => {
    const tiltGroup = tilt.current;
    const spinGroup = spin.current;
    const earthMesh = earth.current;
    if (!tiltGroup || !spinGroup || !earthMesh) return;
    const f = frame.current;
    const delta = Math.min(raw, 0.1);
    onFrame?.(f, delta, state);
    spinGroup.rotation.y += IDLE_SPIN * delta + f.spinBoost;
    tiltGroup.rotation.set(f.tiltX, f.tiltY, 0);
    const uniforms = (earthMesh.material as THREE.ShaderMaterial).uniforms;
    uniforms.uSunDir.value.copy(f.sun);
    uniforms.uReveal.value = f.reveal;
  });

  return (
    <group ref={tilt}>
      <group rotation={AXIS}>
        <group ref={spin} rotation={SPIN_START}>
          <mesh ref={earth} material={materials.earth}>
            <sphereGeometry args={[1, 128, 64]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
```

- [ ] **Step 9: Move the galaxy, stars and sun into Backdrop**

Create `src/components/globe/Backdrop.tsx` (the same objects and values as the old `EarthScene`, now taking the galaxy texture from the loader):

```tsx
"use client";

import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// The visible sun: a faint warm haze upper-left behind the globe, as in the previous scene.
const SUN_POSITION: [number, number, number] = [-9, 5.5, -26];

function sunGlow(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,244,222,1)");
  gradient.addColorStop(0.22, "rgba(255,205,150,0.85)");
  gradient.addColorStop(0.5, "rgba(250,140,80,0.28)");
  gradient.addColorStop(1, "rgba(250,110,67,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

/** Galaxy sphere, 3D stars and the visible sun (moved here unchanged from the previous EarthScene). */
export default function Backdrop({ galaxy }: { galaxy: THREE.Texture }) {
  const sky = useRef<THREE.Mesh>(null);
  const glow = useMemo(() => sunGlow(), []);

  useFrame((_, raw) => {
    if (sky.current) sky.current.rotation.y += Math.min(raw, 0.1) * 0.004;
  });

  return (
    <group>
      <Stars radius={45} depth={55} count={7000} factor={7} saturation={0} fade speed={0.5} />
      <mesh ref={sky} scale={120}>
        <sphereGeometry args={[1, 64, 64]} />
        {/* slight multiply keeps it calm while letting the nebula read clearly */}
        <meshBasicMaterial map={galaxy} color="#b6b6c0" side={THREE.BackSide} />
      </mesh>
      <group position={SUN_POSITION}>
        <mesh>
          <sphereGeometry args={[0.45, 24, 24]} />
          <meshBasicMaterial color="#ffe9cf" toneMapped={false} />
        </mesh>
        <sprite scale={[5, 5, 1]}>
          <spriteMaterial map={glow} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </group>
  );
}
```

- [ ] **Step 10: Create the WebGL2 check**

Create `src/components/globe/device.ts`:

```ts
/** True when a WebGL2 context can be created; the test context is released at once. */
export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 11: Replace the scene**

Replace the whole of `src/components/EarthScene.tsx` with:

```tsx
"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, use, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import Backdrop from "@/components/globe/Backdrop";
import Globe, { createGlobeFrame, type GlobeFrame } from "@/components/globe/Globe";
import { CAMERA_FOV, CAMERA_Z, EXPOSURE, MOBILE_RADIUS, MOBILE_SUN_T, RIG_SCALE, RIG_X, SUN_END, SUN_START } from "@/components/globe/constants";
import { normalize, rigAt, slerpDirection } from "@/components/globe/scroll";
import { loadHeroTextures, releaseSource, type HeroTextures } from "@/components/globe/textures";

export type SceneVariant = "cinematic" | "mobile";
export type EarthSceneProps = {
  variant: SceneVariant;
  active: boolean;
  /** Hero scroll progress 0…1 (cinematic only). */
  progress?: MotionValue<number>;
  /** The first textured frame has rendered. */
  onReady: () => void;
  /** The WebGL context was lost: drop the canvas and keep the poster. */
  onLost: () => void;
};

const CINEMATIC_SUN = normalize(SUN_START);
const MOBILE_SUN = slerpDirection(SUN_START, SUN_END, MOBILE_SUN_T);
const RIG_START: [number, number, number] = [RIG_X[0], 0, 0];

/** Scroll beats: right of centre, then shrinking to the centre (eased toward rigAt). */
function Rig({ progress, children }: { progress: MotionValue<number>; children: ReactNode }) {
  const rig = useRef<THREE.Group>(null);
  useFrame((_, raw) => {
    const group = rig.current;
    if (!group) return;
    const delta = Math.min(raw, 0.1);
    const target = rigAt(progress.get());
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, target.scale, 5, delta));
    group.position.x = THREE.MathUtils.damp(group.position.x, target.x, 5, delta);
  });
  return (
    <group ref={rig} scale={RIG_SCALE[0]} position={RIG_START}>
      {children}
    </group>
  );
}

type Warmup = {
  queued: boolean;
  pending: THREE.Texture[];
  compiling: boolean;
  compiled: boolean;
  shownAt: number;
  announced: boolean;
};

type ContentsProps = {
  variant: SceneVariant;
  load: Promise<HeroTextures>;
  progress?: MotionValue<number>;
  onReady: () => void;
};

function SceneContents({ variant, load, progress, onReady }: ContentsProps) {
  const loaded = use(load);
  const root = useRef<THREE.Group>(null);
  const frame = useRef<GlobeFrame>(createGlobeFrame());
  const warm = useRef<Warmup>({ queued: false, pending: [], compiling: false, compiled: false, shownAt: -1, announced: false });

  // Queue the first set for one-per-frame GPU uploads.
  useEffect(() => {
    warm.current.pending = [...Object.values(loaded.globe), ...(loaded.backdrop ? [loaded.backdrop] : [])];
    warm.current.queued = true;
  }, [loaded]);

  // Warm-up: compile the programs without blocking (KHR_parallel_shader_compile), upload one
  // texture per frame so no single frame takes the whole upload, then show the scene.
  useFrame((state) => {
    const w = warm.current;
    const group = root.current;
    if (!group || w.announced) return;
    if (!w.compiling) {
      w.compiling = true;
      state.gl
        .compileAsync(group, state.camera, state.scene)
        .catch(() => undefined)
        .then(() => {
          w.compiled = true;
        });
    }
    const next = w.pending.shift();
    if (next) {
      state.gl.initTexture(next);
      releaseSource(next);
      return;
    }
    if (!w.queued || !w.compiled) return;
    if (!group.visible) {
      group.visible = true;
      w.shownAt = state.clock.elapsedTime;
      return;
    }
    if (state.clock.elapsedTime <= w.shownAt) return;
    w.announced = true;
    onReady();
  });

  // Per-frame driver, called by the Globe before it applies the frame.
  const drive = (f: GlobeFrame) => {
    const [sx, sy, sz] = variant === "cinematic" ? CINEMATIC_SUN : MOBILE_SUN;
    f.sun.set(sx, sy, sz);
  };

  const globeNode = <Globe textures={loaded.globe} frame={frame} onFrame={drive} />;
  return (
    <group ref={root} visible={false}>
      {variant === "cinematic" && loaded.backdrop && <Backdrop galaxy={loaded.backdrop} />}
      {variant === "cinematic" && progress ? <Rig progress={progress}>{globeNode}</Rig> : <group scale={MOBILE_RADIUS}>{globeNode}</group>}
    </group>
  );
}

/**
 * The hero globe. Desktop ("cinematic"): 2k textures plus the galaxy backdrop and the scroll beats.
 * Phones and tablets ("mobile"): the 1k globe alone.
 */
export default function EarthScene({ variant, active, progress, onReady, onLost }: EarthSceneProps) {
  const [load] = useState(() => {
    const promise = loadHeroTextures(variant === "cinematic" ? "2k" : "1k", { backdrop: variant === "cinematic" });
    // A failed load surfaces through use() → SceneBoundary; this only marks the rejection handled.
    promise.catch(() => undefined);
    return promise;
  });

  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      dpr={variant === "cinematic" ? [1, 2] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: variant === "cinematic" ? "high-performance" : "default" }}
      onCreated={({ gl }) => {
        // ACES Filmic with sRGB output, as before: deep space blacks and a warm roll-off for the
        // over-bright city lights. Textures: colour maps sRGB, data maps linear.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
      }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <SceneContents variant={variant} load={load} progress={progress} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
```

This removes `useGLTF`, `useTexture`, the Draco path, the module-level `useGLTF.preload`, the old lights and the FPV mouse-look camera (Task 5 replaces it with the spec's tilt and parallax).

- [ ] **Step 12: Wire the scene into the hero**

Edit 1 of 4 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
import { Container } from "@/components/ui";
import { HOME, type Stat as StatData } from "@/lib/content";
```

with:

```tsx
import { Container } from "@/components/ui";
import { hasWebGL2 } from "@/components/globe/device";
import { HOME, type Stat as StatData } from "@/lib/content";
```

Edit 2 of 4 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
/**
 * If the scene throws (model/texture loader or runtime error), drop the canvas
 * and keep the poster + copy on screen. WebGL context creation is checked
 * before mounting (R3F creates the renderer outside React's error handling).
 */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
```

with:

```tsx
/**
 * If the scene throws (texture loader, shader or runtime error), drop the canvas
 * and keep the poster + copy on screen. WebGL2 context creation is checked
 * before mounting (R3F creates the renderer outside React's error handling).
 */
class SceneBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}
```

Edit 3 of 4 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const progress = useMotionValue(0);

  // Mount the WebGL scene when the browser is idle, after the copy has painted,
  // and only while the hero is on screen (a reload mid-page fetches nothing).
  useEffect(() => {
    if (!cinematic || !active || ready) return;
    const enable = () => {
      const gl = document.createElement("canvas").getContext("webgl2");
      if (!gl) return; // keep the poster; skip the 6.3 MB model
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      setReady(true);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 0);
    return () => clearTimeout(timer);
  }, [cinematic, active, ready]);
```

with:

```tsx
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [globe, setGlobe] = useState<"idle" | "ready" | "failed">("idle");
  const progress = useMotionValue(0);
  const fail = () => setGlobe("failed");

  // Mount the WebGL scene when the browser is idle, after the copy has painted,
  // and only while the hero is on screen (a reload mid-page fetches nothing).
  useEffect(() => {
    if (!cinematic || !active || ready || globe === "failed") return;
    const enable = () => {
      if (!hasWebGL2()) return; // keep the poster; fetch no textures
      setReady(true);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 0);
    return () => clearTimeout(timer);
  }, [cinematic, active, ready, globe]);
```

Edit 4 of 4 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
        {/* the 3D scene supplies the galaxy, sun and earth */}
        {ready && (
          <div className="hero-scene absolute inset-0" aria-hidden>
            <SceneBoundary>
              <EarthScene progress={progress} active={active} />
            </SceneBoundary>
          </div>
        )}
```

with:

```tsx
        {/* the 3D scene supplies the galaxy, sun and earth; it fades in over the poster (globals.css) */}
        <div className="hero-scene absolute inset-0" data-globe={globe} aria-hidden>
          {ready && globe !== "failed" && (
            <SceneBoundary onError={fail}>
              <EarthScene variant="cinematic" progress={progress} active={active} onReady={() => setGlobe("ready")} onLost={fail} />
            </SceneBoundary>
          )}
        </div>
```

- [ ] **Step 13: Fade the canvas in over the poster**

Edit 1 of 1 in `src/app/globals.css`. Replace:

```css
/* Faded hero copy: its links stop taking clicks (focus is handled in JS). */
#home[data-copy-hidden] a { pointer-events: none; }
```

with:

```css
/* Faded hero copy: its links stop taking clicks (focus is handled in JS). */
#home[data-copy-hidden] a { pointer-events: none; }

/* The hero globe canvas (EarthScene.tsx) fades in over the poster once its first textured frame
   has rendered (data-globe="ready"). */
.hero-scene { opacity: 0; transition: opacity 0.6s cubic-bezier(0.44, 0, 0.56, 1); }
.hero-scene[data-globe="ready"] { opacity: 1; }
```

- [ ] **Step 14: Ship the texture tiers and scan for them**

Edit 1 of 2 in `scripts/package-site.mjs`. Replace:

```js
const assets=["apple-icon.png",
```

with:

```js
// The hero globe's texture tiers (scripts/build-globe-textures.mjs): 1k phones, 2k desktop first frame, 4k streamed.
const globeTextures=["1k","2k","4k"].flatMap(tier=>["day","night","normal","spec","clouds"].map(map=>`textures/earth/${tier}/${map}.webp`));
const assets=["apple-icon.png",
```

Edit 2 of 2 in `scripts/package-site.mjs`. Replace:

```js
"draco/draco_decoder.js"];
```

with:

```js
"draco/draco_decoder.js",...globeTextures];
```

Edit 1 of 1 in `scripts/check-export.mjs`. Replace:

```js
// Assets referenced only from JS chunks (the globe model, section art) and the Draco decoder files must ship too.
const chunkAsset=/"(\/(?:images|models)\/
```

with:

```js
// Assets referenced only from JS chunks (the globe texture tiers, section art) and the Draco decoder files must ship too.
const chunkAsset=/"(\/(?:images|models|textures)\/
```

- [ ] **Step 15: Run the unit tests and see them pass**

Run: `node --import tsx --test tests/globe-materials.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 16: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 17: Heavy gates**

Run, one after the other:
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild` — expected tail: `Export valid: 12 core pages, …` and `preview up on :8787`.
2. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787` — expected: `SEO crawl passed: 12 pages, …`.
3. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787` — expected: `Browser checks passed: 6 profiles; …`. `artifacts/browser-report.json` lists `desktop globe renders its 2k maps under the shipped CSP ({"mean":…,"stdev":…,"distinct":…})`.

If the desktop pixel check fails with a low `stdev`, open `artifacts/desktop.png`; a black globe usually means a shader error (the `shaderErrors` assertion prints it) or a texture that never uploaded.

- [ ] **Step 18: Commit**

```bash
git add src/components/globe/textures.ts src/components/globe/shaders.ts src/components/globe/materials.ts src/components/globe/Globe.tsx src/components/globe/Backdrop.tsx src/components/globe/device.ts src/components/EarthScene.tsx src/components/sections/OrbitalCinematic.tsx src/app/globals.css scripts/package-site.mjs scripts/check-export.mjs scripts/browser-check.mjs tests/globe-materials.test.mjs
git commit -m "feat: render the hero globe with a day/night shader from 2k textures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check (controller, owner's Chrome at 1422×745, http://127.0.0.1:8787/):**
- Opening beat: the globe on the right, lit from the front-left; continents upright (West Africa and Europe facing), oceans dark navy with a soft glint, no dark blotches, no city lights on the day side; an orange twilight band along the terminator near the right edge; galaxy, stars and the faint sun as before.
- The relief is visible only as faint shading near the terminator (mountain ranges), not as noise.
- Scroll to the statement beat: the globe shrinks to the centre as before (same sun for now).
- DevTools Network: `/textures/earth/2k/*.webp` and `/images/galaxy.webp`, no `.glb`, no `/draco/`. Console: no `THREE.` errors.
- Expected for now: the poster under the canvas is still the old GLB render, so the 0.6 s crossfade shows a different globe (Task 9 re-captures it).
- Run the frame-pacing snippet: note the fps.


---

### Task 4: Clouds, atmosphere and the scroll-linked sun sweep and dolly

Adds the cloud shell (sun-lit, fading at night with a faint moonlit rim, drifting faster than the surface; the earth shader already casts its shadows) and the back-face fresnel atmosphere (blue by day, orange at the terminator, faint at night, flaring when backlit). The sun now sweeps with scroll so the terminator crosses the face and the city lights come on as the globe centres, and the camera dollies in slowly.

**Files:**
- Modify: `src/components/globe/shaders.ts` (append), `tests/globe-materials.test.mjs` (header and append), `scripts/browser-check.mjs`
- Replace: `src/components/globe/materials.ts`, `src/components/globe/Globe.tsx`, `src/components/EarthScene.tsx`
- Test: `tests/globe-materials.test.mjs`, `scripts/browser-check.mjs`

- [ ] **Step 1: Write the failing unit tests**

In `tests/globe-materials.test.mjs`, replace:

```js
const { createGlobeMaterials, applyGlobeTextures } = await import("../src/components/globe/materials.ts");
const { BACKDROP_ENTRY, globeEntries } = await import("../src/components/globe/textures.ts");
```

with:

```js
const { createGlobeMaterials, applyGlobeTextures, LOOK } = await import("../src/components/globe/materials.ts");
const { BACKDROP_ENTRY, globeEntries } = await import("../src/components/globe/textures.ts");
const { ATMOSPHERE_RADIUS } = await import("../src/components/globe/constants.ts");
```

Then append to the end of the file, after one blank line:

```js
test("clouds are a transparent shell that never writes depth", () => {
  const textures = fakeSet();
  const { clouds } = createGlobeMaterials(textures);
  assert.equal(clouds.transparent, true);
  assert.equal(clouds.depthWrite, false);
  assert.equal(clouds.uniforms.uClouds.value, textures.clouds);
  assert.equal(clouds.uniforms.uOpacity.value, LOOK.cloudOpacity);
});

test("the atmosphere is an additive back-face fresnel shell", () => {
  const { atmosphere } = createGlobeMaterials(fakeSet());
  assert.equal(atmosphere.side, THREE.BackSide);
  assert.equal(atmosphere.blending, THREE.AdditiveBlending);
  assert.equal(atmosphere.depthWrite, false);
  assert.ok(Math.abs(atmosphere.uniforms.uRimDepth.value - Math.sqrt(1 - 1 / ATMOSPHERE_RADIUS ** 2)) < 1e-12);
});

test("a new tier reaches the cloud shell too", () => {
  const second = fakeSet();
  const materials = createGlobeMaterials(fakeSet());
  applyGlobeTextures(materials, second);
  assert.equal(materials.clouds.uniforms.uClouds.value, second.clouds);
});

test("one sun direction drives every shell", () => {
  const { earth, clouds, atmosphere } = createGlobeMaterials(fakeSet());
  assert.equal(earth.uniforms.uSunDir, clouds.uniforms.uSunDir);
  assert.equal(earth.uniforms.uSunDir, atmosphere.uniforms.uSunDir);
  assert.equal(earth.uniforms.uReveal, clouds.uniforms.uReveal);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --import tsx --test tests/globe-materials.test.mjs`
Expected: FAIL in `clouds are a transparent shell that never writes depth` (`Cannot read properties of undefined (reading 'transparent')`) and the other three new tests.

- [ ] **Step 3: Write the failing browser check**

Edit 1 of 1 in `scripts/browser-check.mjs`. Replace:

```js
      report.interactions.push(`desktop globe renders its 2k maps under the shipped CSP (${JSON.stringify(pixels)})`);
    }
```

with:

```js
      report.interactions.push(`desktop globe renders its 2k maps under the shipped CSP (${JSON.stringify(pixels)})`);

      // The sun sweeps with scroll: at the centred beat the visible disc turns to its night side.
      const centre = { x: 0.4, y: 0.3, w: 0.2, h: 0.4 };
      const dayCentre = pixelStats(await globeCapture(page, centre));
      await page.evaluate(() => {
        const home = document.getElementById("home");
        window.scrollTo({ top: window.scrollY + home.getBoundingClientRect().top + (home.offsetHeight - innerHeight) * 0.62, behavior: "instant" });
      });
      await page.waitForTimeout(2500); // the rig, sun and dolly ease into place
      const nightCentre = pixelStats(await globeCapture(page, centre));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(1500);
      assert.ok(nightCentre.mean < dayCentre.mean * 0.6, `desktop: the terminator sweeps across the globe with scroll (day ${dayCentre.mean}, night ${nightCentre.mean})`);
      report.interactions.push("desktop sun sweep turns the centred globe to its night side");
    }
```

- [ ] **Step 4: Run it against the Task 3 build and see it fail**

Run: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787`
Expected: FAIL with `desktop: the terminator sweeps across the globe with scroll (day …, night …)`: with the fixed Task 3 sun the centred globe is still lit.

- [ ] **Step 5: Add the cloud and atmosphere shaders**

Append to the end of `src/components/globe/shaders.ts` (after `EARTH_FRAGMENT`, separated by one blank line):

```ts
export const CLOUDS_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const CLOUDS_FRAGMENT = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uTwilight;
uniform float uCloudTwilightGain;
uniform float uOpacity;
uniform float uReveal;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  // Crush the thinnest haze so the coverage reads as clouds, not fog.
  float cover = smoothstep(0.12, 0.85, texture2D(uClouds, vUv).r);
  vec3 n = normalize(vNormalW);
  vec3 sun = normalize(uSunDir);
  vec3 view = normalize(cameraPosition - vPosW);
  float sunDot = dot(n, sun);
  float dayMix = smoothstep(-0.12, 0.25, sunDot);
  float band = (sunDot - 0.03) / 0.08;
  float twilight = exp(-band * band);

  // Sunlit white tops, warmed along the terminator.
  vec3 lit = uSunColor * (0.08 + 0.92 * max(sunDot, 0.0)) + uTwilight * twilight * uCloudTwilightGain;
  // Night: clouds fade out except for a faint moonlit rim.
  float rim = pow(1.0 - max(dot(n, view), 0.0), 2.0);
  vec3 moon = vec3(0.016, 0.02, 0.031);
  vec3 color = mix(moon, lit, dayMix);
  float alpha = cover * uOpacity * mix(0.18 * rim, 1.0, dayMix);

  gl_FragColor = vec4(color * uReveal, alpha * uReveal);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uAtmoDay;
uniform vec3 uAtmoNight;
uniform vec3 uTwilight;
uniform float uRimDepth;
uniform float uIntensity;

varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 view = normalize(cameraPosition - vPosW);
  vec3 sun = normalize(uSunDir);
  // Back faces only: n·view runs from 0 at the shell's edge to -uRimDepth where the line of sight
  // grazes the planet, so the glow is brightest against the limb and fades outward (fresnel rim).
  float depth = clamp(-dot(n, view) / uRimDepth, 0.0, 1.0);
  float glow = pow(depth, 2.2);
  float sunDot = dot(n, sun);
  float dayMix = smoothstep(-0.3, 0.4, sunDot);
  float band = (sunDot - 0.02) / 0.13;
  float twilight = exp(-band * band);
  // Forward scattering: the rim flares when the sun is behind the planet.
  float forward = pow(max(dot(-view, sun), 0.0), 3.0);
  vec3 color = mix(uAtmoNight * 0.25, uAtmoDay, dayMix) + uTwilight * twilight * 0.7;
  float strength = glow * uIntensity * (0.12 + 0.88 * max(dayMix, twilight)) * (1.0 + 2.5 * forward);

  gl_FragColor = vec4(color * strength, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
```

- [ ] **Step 6: Replace the materials**

Replace the whole of `src/components/globe/materials.ts` with:

```ts
import * as THREE from "three";
import { ATMOSPHERE_RADIUS } from "./constants";
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX, CLOUDS_FRAGMENT, CLOUDS_VERTEX, EARTH_FRAGMENT, EARTH_VERTEX } from "./shaders";
import { NORMAL_GAIN } from "./texture-manifest";
import type { GlobeTextureSet } from "./textures";

/**
 * Look tunables. Colours are sRGB hex (three converts them to linear); gains are linear and
 * calibrated for ACES Filmic at EXPOSURE 1.2 (constants.ts).
 */
export const LOOK = {
  sunColor: "#fff4e8",
  sunIntensity: 1.75,
  twilight: "#fa6e43",
  twilightGain: 0.38,
  cloudTwilightGain: 0.42,
  city: "#ffb46b",
  cityGain: 3.75,
  atmosphereDay: "#5aa2ff",
  atmosphereNight: "#1b2a55",
  atmosphereIntensity: 0.92,
  rimGain: 0.38,
  relief: 3,
  cloudShadow: 0.45,
  cloudOpacity: 0.95,
  nightAmbient: 0.0125,
} as const;

export type GlobeMaterials = { earth: THREE.ShaderMaterial; clouds: THREE.ShaderMaterial; atmosphere: THREE.ShaderMaterial };

export function createGlobeMaterials(textures: GlobeTextureSet): GlobeMaterials {
  // Shared by reference, so one write per frame updates every shell.
  const uSunDir = { value: new THREE.Vector3(0, 0, 1) };
  const uSunColor = { value: new THREE.Color(LOOK.sunColor).multiplyScalar(LOOK.sunIntensity) };
  const uTwilight = { value: new THREE.Color(LOOK.twilight) };
  const uAtmoDay = { value: new THREE.Color(LOOK.atmosphereDay) };
  const uReveal = { value: 1 };

  const earth = new THREE.ShaderMaterial({
    name: "GlobeEarth",
    vertexShader: EARTH_VERTEX,
    fragmentShader: EARTH_FRAGMENT,
    uniforms: {
      uDay: { value: textures.day },
      uNight: { value: textures.night },
      uNormal: { value: textures.normal },
      uSpec: { value: textures.spec },
      uClouds: { value: textures.clouds },
      uSunDir,
      uSunColor,
      uTwilight,
      uAtmoDay,
      uReveal,
      uCityColor: { value: new THREE.Color(LOOK.city) },
      uCityGain: { value: LOOK.cityGain },
      uTwilightGain: { value: LOOK.twilightGain },
      uRimGain: { value: LOOK.rimGain },
      uRelief: { value: LOOK.relief },
      uNormalGain: { value: NORMAL_GAIN },
      uCloudOffset: { value: 0 },
      uCloudShadow: { value: LOOK.cloudShadow },
      uNightAmbient: { value: LOOK.nightAmbient },
    },
  });

  const clouds = new THREE.ShaderMaterial({
    name: "GlobeClouds",
    vertexShader: CLOUDS_VERTEX,
    fragmentShader: CLOUDS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uClouds: { value: textures.clouds },
      uSunDir,
      uSunColor,
      uTwilight,
      uReveal,
      uCloudTwilightGain: { value: LOOK.cloudTwilightGain },
      uOpacity: { value: LOOK.cloudOpacity },
    },
  });

  const atmosphere = new THREE.ShaderMaterial({
    name: "GlobeAtmosphere",
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSunDir,
      uTwilight,
      uAtmoDay,
      uAtmoNight: { value: new THREE.Color(LOOK.atmosphereNight) },
      uRimDepth: { value: Math.sqrt(1 - 1 / (ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS)) },
      uIntensity: { value: LOOK.atmosphereIntensity },
    },
  });

  return { earth, clouds, atmosphere };
}

/** Rebinds a new texture set (2k → 4k) in place. */
export function applyGlobeTextures(target: { earth: THREE.ShaderMaterial; clouds?: THREE.ShaderMaterial }, textures: GlobeTextureSet): void {
  const uniforms = target.earth.uniforms;
  uniforms.uDay.value = textures.day;
  uniforms.uNight.value = textures.night;
  uniforms.uNormal.value = textures.normal;
  uniforms.uSpec.value = textures.spec;
  uniforms.uClouds.value = textures.clouds;
  if (target.clouds) target.clouds.uniforms.uClouds.value = textures.clouds;
}
```

- [ ] **Step 7: Replace the Globe component**

Replace the whole of `src/components/globe/Globe.tsx` with:

```tsx
"use client";

import { useFrame, type RootState } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { ATMOSPHERE_RADIUS, AXIAL_TILT, CLOUD_DRIFT, CLOUD_RADIUS, IDLE_SPIN, INITIAL_SPIN } from "./constants";
import { applyGlobeTextures, createGlobeMaterials, LOOK } from "./materials";
import type { GlobeTextureSet } from "./textures";

/** Per-frame inputs. The scene's driver writes them and the globe applies them in the same frame. */
export type GlobeFrame = { sun: THREE.Vector3; spinBoost: number; tiltX: number; tiltY: number; reveal: number; flare: number };
export function createGlobeFrame(): GlobeFrame {
  return { sun: new THREE.Vector3(0, 0, 1), spinBoost: 0, tiltX: 0, tiltY: 0, reveal: 1, flare: 1 };
}

const AXIS: [number, number, number] = [0, 0, AXIAL_TILT];
const SPIN_START: [number, number, number] = [0, INITIAL_SPIN, 0];
const TURN = Math.PI * 2;

type GlobeProps = {
  textures: GlobeTextureSet;
  frame: RefObject<GlobeFrame>;
  onFrame?: (frame: GlobeFrame, delta: number, state: RootState) => void;
};

/**
 * The Earth: a unit sphere with the day/night shader, a faster cloud shell and a fresnel atmosphere.
 * Hierarchy: pointer tilt → axial tilt → spin (surface and clouds); the atmosphere needs no spin.
 * Materials are created once and a new texture set (2k → 4k) is rebound in place. They are not
 * disposed on unmount: the globe only unmounts with its Canvas, whose context loss frees the GPU.
 */
export default function Globe({ textures, frame, onFrame }: GlobeProps) {
  const [materials] = useState(() => createGlobeMaterials(textures));
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const earth = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const atmosphere = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const earthMesh = earth.current;
    const cloudMesh = clouds.current;
    if (!earthMesh || !cloudMesh) return;
    applyGlobeTextures({ earth: earthMesh.material as THREE.ShaderMaterial, clouds: cloudMesh.material as THREE.ShaderMaterial }, textures);
  }, [textures]);

  useFrame((state, raw) => {
    const tiltGroup = tilt.current;
    const spinGroup = spin.current;
    const earthMesh = earth.current;
    const cloudMesh = clouds.current;
    const atmosphereMesh = atmosphere.current;
    if (!tiltGroup || !spinGroup || !earthMesh || !cloudMesh || !atmosphereMesh) return;
    const f = frame.current;
    const delta = Math.min(raw, 0.1);
    onFrame?.(f, delta, state);
    spinGroup.rotation.y += IDLE_SPIN * delta + f.spinBoost;
    cloudMesh.rotation.y = (cloudMesh.rotation.y + CLOUD_DRIFT * delta) % TURN;
    tiltGroup.rotation.set(f.tiltX, f.tiltY, 0);
    const uniforms = (earthMesh.material as THREE.ShaderMaterial).uniforms;
    uniforms.uSunDir.value.copy(f.sun);
    uniforms.uReveal.value = f.reveal;
    uniforms.uCloudOffset.value = cloudMesh.rotation.y / TURN;
    (atmosphereMesh.material as THREE.ShaderMaterial).uniforms.uIntensity.value = LOOK.atmosphereIntensity * f.flare * f.reveal;
  });

  return (
    <group ref={tilt}>
      <group rotation={AXIS}>
        <group ref={spin} rotation={SPIN_START}>
          <mesh ref={earth} material={materials.earth}>
            <sphereGeometry args={[1, 128, 64]} />
          </mesh>
          <mesh ref={clouds} material={materials.clouds} renderOrder={1}>
            <sphereGeometry args={[CLOUD_RADIUS, 96, 48]} />
          </mesh>
        </group>
      </group>
      <mesh ref={atmosphere} material={materials.atmosphere} renderOrder={2}>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, 64, 32]} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 8: Sweep the sun and dolly the camera**

Replace the whole of `src/components/EarthScene.tsx` with:

```tsx
"use client";

import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, use, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import Backdrop from "@/components/globe/Backdrop";
import Globe, { createGlobeFrame, type GlobeFrame } from "@/components/globe/Globe";
import { CAMERA_FOV, CAMERA_Z, EXPOSURE, MOBILE_RADIUS, MOBILE_SUN_T, RIG_SCALE, RIG_X, SUN_END, SUN_START } from "@/components/globe/constants";
import { cameraZAt, rigAt, slerpDirection, sunDirectionAt } from "@/components/globe/scroll";
import { loadHeroTextures, releaseSource, type HeroTextures } from "@/components/globe/textures";

export type SceneVariant = "cinematic" | "mobile";
export type EarthSceneProps = {
  variant: SceneVariant;
  active: boolean;
  /** Hero scroll progress 0…1 (cinematic only). */
  progress?: MotionValue<number>;
  /** The first textured frame has rendered. */
  onReady: () => void;
  /** The WebGL context was lost: drop the canvas and keep the poster. */
  onLost: () => void;
};

const MOBILE_SUN = slerpDirection(SUN_START, SUN_END, MOBILE_SUN_T);
const RIG_START: [number, number, number] = [RIG_X[0], 0, 0];

/** Scroll beats: right of centre, then shrinking to the centre (eased toward rigAt). */
function Rig({ progress, children }: { progress: MotionValue<number>; children: ReactNode }) {
  const rig = useRef<THREE.Group>(null);
  useFrame((_, raw) => {
    const group = rig.current;
    if (!group) return;
    const delta = Math.min(raw, 0.1);
    const target = rigAt(progress.get());
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, target.scale, 5, delta));
    group.position.x = THREE.MathUtils.damp(group.position.x, target.x, 5, delta);
  });
  return (
    <group ref={rig} scale={RIG_SCALE[0]} position={RIG_START}>
      {children}
    </group>
  );
}

type Warmup = {
  queued: boolean;
  pending: THREE.Texture[];
  compiling: boolean;
  compiled: boolean;
  shownAt: number;
  announced: boolean;
};

type ContentsProps = {
  variant: SceneVariant;
  load: Promise<HeroTextures>;
  progress?: MotionValue<number>;
  onReady: () => void;
};

function SceneContents({ variant, load, progress, onReady }: ContentsProps) {
  const loaded = use(load);
  const root = useRef<THREE.Group>(null);
  const frame = useRef<GlobeFrame>(createGlobeFrame());
  const warm = useRef<Warmup>({ queued: false, pending: [], compiling: false, compiled: false, shownAt: -1, announced: false });
  const sunTarget = useRef(new THREE.Vector3());

  // Queue the first set for one-per-frame GPU uploads.
  useEffect(() => {
    warm.current.pending = [...Object.values(loaded.globe), ...(loaded.backdrop ? [loaded.backdrop] : [])];
    warm.current.queued = true;
  }, [loaded]);

  // Warm-up: compile the programs without blocking (KHR_parallel_shader_compile), upload one
  // texture per frame so no single frame takes the whole upload, then show the scene.
  useFrame((state) => {
    const w = warm.current;
    const group = root.current;
    if (!group || w.announced) return;
    if (!w.compiling) {
      w.compiling = true;
      state.gl
        .compileAsync(group, state.camera, state.scene)
        .catch(() => undefined)
        .then(() => {
          w.compiled = true;
        });
    }
    const next = w.pending.shift();
    if (next) {
      state.gl.initTexture(next);
      releaseSource(next);
      return;
    }
    if (!w.queued || !w.compiled) return;
    if (!group.visible) {
      group.visible = true;
      w.shownAt = state.clock.elapsedTime;
      return;
    }
    if (state.clock.elapsedTime <= w.shownAt) return;
    w.announced = true;
    onReady();
  });

  // Per-frame driver, called by the Globe before it applies the frame.
  const drive = (f: GlobeFrame, delta: number, state: RootState) => {
    const p = progress?.get() ?? 0;
    // The sun sweeps with scroll on desktop (the terminator crosses the face and the city lights
    // come on as the globe centres); phones keep a fixed crescent.
    const [sx, sy, sz] = variant === "cinematic" ? sunDirectionAt(p) : MOBILE_SUN;
    sunTarget.current.set(sx, sy, sz);
    if (warm.current.announced) f.sun.lerp(sunTarget.current, 1 - Math.exp(-6 * delta)).normalize();
    else f.sun.copy(sunTarget.current);
    // Slow camera dolly-in across the hero.
    if (variant === "cinematic") state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, cameraZAt(p), 3, delta);
  };

  const globeNode = <Globe textures={loaded.globe} frame={frame} onFrame={drive} />;
  return (
    <group ref={root} visible={false}>
      {variant === "cinematic" && loaded.backdrop && <Backdrop galaxy={loaded.backdrop} />}
      {variant === "cinematic" && progress ? <Rig progress={progress}>{globeNode}</Rig> : <group scale={MOBILE_RADIUS}>{globeNode}</group>}
    </group>
  );
}

/**
 * The hero globe. Desktop ("cinematic"): 2k textures plus the galaxy backdrop and the scroll beats.
 * Phones and tablets ("mobile"): the 1k globe alone.
 */
export default function EarthScene({ variant, active, progress, onReady, onLost }: EarthSceneProps) {
  const [load] = useState(() => {
    const promise = loadHeroTextures(variant === "cinematic" ? "2k" : "1k", { backdrop: variant === "cinematic" });
    // A failed load surfaces through use() → SceneBoundary; this only marks the rejection handled.
    promise.catch(() => undefined);
    return promise;
  });

  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      dpr={variant === "cinematic" ? [1, 2] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: variant === "cinematic" ? "high-performance" : "default" }}
      onCreated={({ gl }) => {
        // ACES Filmic with sRGB output, as before: deep space blacks and a warm roll-off for the
        // over-bright city lights. Textures: colour maps sRGB, data maps linear.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
      }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <SceneContents variant={variant} load={load} progress={progress} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
```

- [ ] **Step 9: Run the unit tests and see them pass**

Run: `node --import tsx --test tests/globe-materials.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 10: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 11: Heavy gates**

Run, one after the other:
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild` — expected: `Export valid: …`, `preview up on :8787`.
2. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787` — expected: `SEO crawl passed: …`.
3. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787` — expected: `Browser checks passed: 6 profiles; …`, with `desktop sun sweep turns the centred globe to its night side` in the report.

- [ ] **Step 12: Commit**

```bash
git add src/components/globe/shaders.ts src/components/globe/materials.ts src/components/globe/Globe.tsx src/components/EarthScene.tsx tests/globe-materials.test.mjs scripts/browser-check.mjs
git commit -m "feat: add the cloud shell, fresnel atmosphere and scroll-linked sun sweep

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check (1422×745):**
- Opening beat: white clouds with soft shadows on the land and sea below them; no blue tint; the clouds drift slowly against the surface.
- A thin blue rim on the lit limb, warming to orange where it meets the terminator, faint on the night limb.
- Scroll slowly to the statement beat: the terminator sweeps across the face, the city lights (warm, slightly glowing) appear on the night side as the globe reaches the centre, the upper-left crescent stays lit and the rim brightens because the globe is backlit; the camera pushes in slightly; no popping.
- Night side: no clouds except a faint rim near the limb; city lights dim under clouds.
- Frame-pacing snippet: steady ≈ 60 fps at 1440p on the GTX 1660 Ti. If the twilight, glint or city lights need tuning, change `LOOK` in `materials.ts` or the sun constants in `constants.ts` only, and record the new values in Task 11.


---

### Task 5: Cursor tilt, drag-to-spin and star parallax

On fine pointers the globe tilts toward the cursor (spring, ≤ 6°) and the stars, galaxy and sun drift slightly the other way. A mouse or pen drag on the hero spins the globe with inertia (it coasts, then eases back to the idle spin) and pitches it within ±0.3 rad, springing back level on release. Touch is never captured or prevented, so it always scrolls. The wrapper carries `data-cursor="Drag"` for Part 2's cursor.

**Files:**
- Create: `src/components/globe/usePointerInput.ts`
- Replace: `src/components/globe/Backdrop.tsx`, `src/components/EarthScene.tsx`
- Modify: `src/components/sections/OrbitalCinematic.tsx`, `src/app/globals.css`, `scripts/browser-check.mjs`
- Test: `scripts/browser-check.mjs` (the spring and drag maths were unit-tested in Task 2)

- [ ] **Step 1: Write the failing browser check**

Edit 1 of 2 in `scripts/browser-check.mjs`. Replace:

```js
// Records CSP violations and blocked-texture errors on every page and route a context opens.
```

with:

```js
function meanDifference(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

// Records CSP violations and blocked-texture errors on every page and route a context opens.
```

Edit 2 of 2 in `scripts/browser-check.mjs`. Replace:

```js
      report.interactions.push("desktop sun sweep turns the centred globe to its night side");
    }
```

with:

```js
      report.interactions.push("desktop sun sweep turns the centred globe to its night side");

      // Mouse drag spins the globe with inertia and never scrolls the page; touch is left alone.
      const scene = page.locator("#home .hero-scene");
      assert.equal(await scene.getAttribute("data-cursor"), "Drag", "desktop: the globe offers a Drag cursor label");
      assert.equal(await scene.evaluate(el => getComputedStyle(el).touchAction), "auto", "desktop: the globe never blocks touch scrolling");
      assert.ok(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches), "desktop: the test browser reports a fine pointer (drag is fine-pointer only)");
      const idleA = await globeCapture(page);
      await page.waitForTimeout(700);
      const idleB = await globeCapture(page);
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await page.mouse.move(1000, 520);
      await page.mouse.down();
      const dragging = await scene.evaluate(el => el.hasAttribute("data-dragging"));
      for (let i = 1; i <= 12; i++) await page.mouse.move(1000 - i * 40, 520);
      await page.mouse.up();
      await page.waitForTimeout(250);
      const dragged = await globeCapture(page);
      assert.equal(dragging, true, "desktop: pressing on the globe starts a drag");
      assert.equal(await page.evaluate(() => window.scrollY), scrollBefore, "desktop: dragging the globe does not scroll the page");
      const idleChange = meanDifference(idleA, idleB), dragChange = meanDifference(idleB, dragged);
      assert.ok(dragChange > Math.max(4, idleChange * 3), `desktop: dragging spins the globe (drag ${dragChange.toFixed(1)}, idle ${idleChange.toFixed(1)})`);
      report.interactions.push("desktop globe drag spins it without scrolling the page");
    }
```

- [ ] **Step 2: Run it against the Task 4 build and see it fail**

Run: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787`
Expected: FAIL with `desktop: the globe offers a Drag cursor label` (`null` !== `"Drag"`).

- [ ] **Step 3: Create the pointer hook**

Create `src/components/globe/usePointerInput.ts`:

```ts
"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPointerInput, type PointerInput } from "./interaction";

const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/**
 * Cursor position (window-wide) and mouse or pen drags that start on `target`. Fine pointers only:
 * touch input is never captured or prevented, so it always scrolls the page.
 */
export function usePointerInput(target: RefObject<HTMLElement | null> | undefined, enabled: boolean): RefObject<PointerInput> {
  const input = useRef<PointerInput>(createPointerInput());

  useEffect(() => {
    const element = target?.current;
    if (!enabled || !element || !window.matchMedia(FINE_POINTER).matches) return;
    const state = input.current;
    let id = -1;
    let lastX = 0;
    let lastY = 0;
    const move = (event: PointerEvent) => {
      state.x = (event.clientX / window.innerWidth) * 2 - 1;
      state.y = 1 - (event.clientY / window.innerHeight) * 2;
      if (!state.dragging || event.pointerId !== id) return;
      state.dx += event.clientX - lastX;
      state.dy += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      event.preventDefault(); // no text selection or native drag while spinning the globe
      id = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      state.dragging = true;
      element.setPointerCapture(id);
      element.setAttribute("data-dragging", "");
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== id) return;
      state.dragging = false;
      id = -1;
      element.removeAttribute("data-dragging");
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };
    window.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("lostpointercapture", up);
    return () => {
      window.removeEventListener("pointermove", move);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("lostpointercapture", up);
      element.removeAttribute("data-dragging");
      state.dragging = false;
    };
  }, [enabled, target]);

  return input;
}
```

- [ ] **Step 4: Add the parallax to the backdrop**

Replace the whole of `src/components/globe/Backdrop.tsx` with:

```tsx
"use client";

import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { STAR_PARALLAX } from "./constants";
import type { PointerInput } from "./interaction";

// The visible sun: a faint warm haze upper-left behind the globe, as in the previous scene.
const SUN_POSITION: [number, number, number] = [-9, 5.5, -26];

function sunGlow(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,244,222,1)");
  gradient.addColorStop(0.22, "rgba(255,205,150,0.85)");
  gradient.addColorStop(0.5, "rgba(250,140,80,0.28)");
  gradient.addColorStop(1, "rgba(250,110,67,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

/** Galaxy sphere, 3D stars and the visible sun. They drift slightly against the cursor (parallax). */
export default function Backdrop({ galaxy, pointer }: { galaxy: THREE.Texture; pointer: RefObject<PointerInput> }) {
  const parallax = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);
  const glow = useMemo(() => sunGlow(), []);

  useFrame((_, raw) => {
    const delta = Math.min(raw, 0.1);
    if (sky.current) sky.current.rotation.y += delta * 0.004;
    const group = parallax.current;
    if (!group) return;
    const input = pointer.current;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, -input.x * STAR_PARALLAX, 3, delta);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, input.y * STAR_PARALLAX * 0.6, 3, delta);
  });

  return (
    <group ref={parallax}>
      <Stars radius={45} depth={55} count={7000} factor={7} saturation={0} fade speed={0.5} />
      <mesh ref={sky} scale={120}>
        <sphereGeometry args={[1, 64, 64]} />
        {/* slight multiply keeps it calm while letting the nebula read clearly */}
        <meshBasicMaterial map={galaxy} color="#b6b6c0" side={THREE.BackSide} />
      </mesh>
      <group position={SUN_POSITION}>
        <mesh>
          <sphereGeometry args={[0.45, 24, 24]} />
          <meshBasicMaterial color="#ffe9cf" toneMapped={false} />
        </mesh>
        <sprite scale={[5, 5, 1]}>
          <spriteMaterial map={glow} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </group>
  );
}
```

- [ ] **Step 5: Drive the tilt and the drag**

Replace the whole of `src/components/EarthScene.tsx` with:

```tsx
"use client";

import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, use, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import Backdrop from "@/components/globe/Backdrop";
import Globe, { createGlobeFrame, type GlobeFrame } from "@/components/globe/Globe";
import { CAMERA_FOV, CAMERA_Z, EXPOSURE, MAX_TILT, MOBILE_RADIUS, MOBILE_SUN_T, RIG_SCALE, RIG_X, SUN_END, SUN_START } from "@/components/globe/constants";
import { createDragState, createSpring, stepDrag, stepSpring, type PointerInput } from "@/components/globe/interaction";
import { cameraZAt, rigAt, slerpDirection, sunDirectionAt } from "@/components/globe/scroll";
import { loadHeroTextures, releaseSource, type HeroTextures } from "@/components/globe/textures";
import { usePointerInput } from "@/components/globe/usePointerInput";

export type SceneVariant = "cinematic" | "mobile";
export type EarthSceneProps = {
  variant: SceneVariant;
  active: boolean;
  /** Hero scroll progress 0…1 (cinematic only). */
  progress?: MotionValue<number>;
  /** The element that takes drag input (cinematic, fine pointers only). */
  dragTarget?: RefObject<HTMLElement | null>;
  /** The first textured frame has rendered. */
  onReady: () => void;
  /** The WebGL context was lost: drop the canvas and keep the poster. */
  onLost: () => void;
};

const MOBILE_SUN = slerpDirection(SUN_START, SUN_END, MOBILE_SUN_T);
const RIG_START: [number, number, number] = [RIG_X[0], 0, 0];

/** Scroll beats: right of centre, then shrinking to the centre (eased toward rigAt). */
function Rig({ progress, children }: { progress: MotionValue<number>; children: ReactNode }) {
  const rig = useRef<THREE.Group>(null);
  useFrame((_, raw) => {
    const group = rig.current;
    if (!group) return;
    const delta = Math.min(raw, 0.1);
    const target = rigAt(progress.get());
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, target.scale, 5, delta));
    group.position.x = THREE.MathUtils.damp(group.position.x, target.x, 5, delta);
  });
  return (
    <group ref={rig} scale={RIG_SCALE[0]} position={RIG_START}>
      {children}
    </group>
  );
}

type Warmup = {
  queued: boolean;
  pending: THREE.Texture[];
  compiling: boolean;
  compiled: boolean;
  shownAt: number;
  announced: boolean;
};

type ContentsProps = {
  variant: SceneVariant;
  load: Promise<HeroTextures>;
  progress?: MotionValue<number>;
  pointer: RefObject<PointerInput>;
  onReady: () => void;
};

function SceneContents({ variant, load, progress, pointer, onReady }: ContentsProps) {
  const loaded = use(load);
  const root = useRef<THREE.Group>(null);
  const frame = useRef<GlobeFrame>(createGlobeFrame());
  const warm = useRef<Warmup>({ queued: false, pending: [], compiling: false, compiled: false, shownAt: -1, announced: false });
  const tilt = useRef({ x: createSpring(), y: createSpring() });
  const drag = useRef(createDragState());
  const sunTarget = useRef(new THREE.Vector3());

  // Queue the first set for one-per-frame GPU uploads.
  useEffect(() => {
    warm.current.pending = [...Object.values(loaded.globe), ...(loaded.backdrop ? [loaded.backdrop] : [])];
    warm.current.queued = true;
  }, [loaded]);

  // Warm-up: compile the programs without blocking (KHR_parallel_shader_compile), upload one
  // texture per frame so no single frame takes the whole upload, then show the scene.
  useFrame((state) => {
    const w = warm.current;
    const group = root.current;
    if (!group || w.announced) return;
    if (!w.compiling) {
      w.compiling = true;
      state.gl
        .compileAsync(group, state.camera, state.scene)
        .catch(() => undefined)
        .then(() => {
          w.compiled = true;
        });
    }
    const next = w.pending.shift();
    if (next) {
      state.gl.initTexture(next);
      releaseSource(next);
      return;
    }
    if (!w.queued || !w.compiled) return;
    if (!group.visible) {
      group.visible = true;
      w.shownAt = state.clock.elapsedTime;
      return;
    }
    if (state.clock.elapsedTime <= w.shownAt) return;
    w.announced = true;
    onReady();
  });

  // Per-frame driver, called by the Globe before it applies the frame.
  const drive = (f: GlobeFrame, delta: number, state: RootState) => {
    const p = progress?.get() ?? 0;
    // The sun sweeps with scroll on desktop (the terminator crosses the face and the city lights
    // come on as the globe centres); phones keep a fixed crescent.
    const [sx, sy, sz] = variant === "cinematic" ? sunDirectionAt(p) : MOBILE_SUN;
    sunTarget.current.set(sx, sy, sz);
    if (warm.current.announced) f.sun.lerp(sunTarget.current, 1 - Math.exp(-6 * delta)).normalize();
    else f.sun.copy(sunTarget.current);

    if (variant === "cinematic") {
      // Slow camera dolly-in across the hero.
      state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, cameraZAt(p), 3, delta);
      // Cursor tilt (spring, ≈6°) plus drag spin with inertia and a sprung pitch.
      const input = pointer.current;
      f.spinBoost = stepDrag(input, drag.current, delta, window.innerWidth);
      f.tiltX = stepSpring(tilt.current.x, -input.y * MAX_TILT, delta) + drag.current.pitch.value;
      f.tiltY = stepSpring(tilt.current.y, input.x * MAX_TILT, delta);
    }
  };

  const globeNode = <Globe textures={loaded.globe} frame={frame} onFrame={drive} />;
  return (
    <group ref={root} visible={false}>
      {variant === "cinematic" && loaded.backdrop && <Backdrop galaxy={loaded.backdrop} pointer={pointer} />}
      {variant === "cinematic" && progress ? <Rig progress={progress}>{globeNode}</Rig> : <group scale={MOBILE_RADIUS}>{globeNode}</group>}
    </group>
  );
}

/**
 * The hero globe. Desktop ("cinematic"): 2k textures plus the galaxy backdrop, scroll beats, cursor
 * tilt and drag. Phones and tablets ("mobile"): the 1k globe alone.
 */
export default function EarthScene({ variant, active, progress, dragTarget, onReady, onLost }: EarthSceneProps) {
  const [load] = useState(() => {
    const promise = loadHeroTextures(variant === "cinematic" ? "2k" : "1k", { backdrop: variant === "cinematic" });
    // A failed load surfaces through use() → SceneBoundary; this only marks the rejection handled.
    promise.catch(() => undefined);
    return promise;
  });
  const pointer = usePointerInput(dragTarget, variant === "cinematic");

  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      dpr={variant === "cinematic" ? [1, 2] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: variant === "cinematic" ? "high-performance" : "default" }}
      onCreated={({ gl }) => {
        // ACES Filmic with sRGB output, as before: deep space blacks and a warm roll-off for the
        // over-bright city lights. Textures: colour maps sRGB, data maps linear.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
      }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <SceneContents variant={variant} load={load} progress={progress} pointer={pointer} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
```

- [ ] **Step 6: Give the scene its drag target and cursor label**

Edit 1 of 2 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
  const outerRef = useRef<HTMLElement | null>(null);
```

with:

```tsx
  const outerRef = useRef<HTMLElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
```

Edit 2 of 2 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
        <div className="hero-scene absolute inset-0" data-globe={globe} aria-hidden>
          {ready && globe !== "failed" && (
            <SceneBoundary onError={fail}>
              <EarthScene variant="cinematic" progress={progress} active={active} onReady={() => setGlobe("ready")} onLost={fail} />
            </SceneBoundary>
          )}
        </div>
```

with:

```tsx
        <div
          ref={sceneRef}
          className="hero-scene absolute inset-0"
          data-globe={globe}
          data-cursor={globe === "ready" ? "Drag" : undefined}
          aria-hidden
        >
          {ready && globe !== "failed" && (
            <SceneBoundary onError={fail}>
              <EarthScene variant="cinematic" progress={progress} active={active} dragTarget={sceneRef} onReady={() => setGlobe("ready")} onLost={fail} />
            </SceneBoundary>
          )}
        </div>
```

- [ ] **Step 7: Show grab cursors on fine pointers**

Edit 1 of 1 in `src/app/globals.css`. Replace:

```css
.hero-scene[data-globe="ready"] { opacity: 1; }
```

with:

```css
.hero-scene[data-globe="ready"] { opacity: 1; }
/* Fine pointers can spin the globe (usePointerInput.ts); touch keeps native scrolling. */
@media (hover: hover) and (pointer: fine) {
  .hero-scene[data-globe="ready"] { cursor: grab; }
  .hero-scene[data-dragging] { cursor: grabbing; }
}
```

- [ ] **Step 8: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 9: Heavy gates**

Run, one after the other:
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild` — expected: `Export valid: …`, `preview up on :8787`.
2. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787` — expected: `SEO crawl passed: …`.
3. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787` — expected: `Browser checks passed: 6 profiles; …`, with `desktop globe drag spins it without scrolling the page` in the report. The existing hero-focus and footer-focus checks must still pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/globe/usePointerInput.ts src/components/globe/Backdrop.tsx src/components/EarthScene.tsx src/components/sections/OrbitalCinematic.tsx src/app/globals.css scripts/browser-check.mjs
git commit -m "feat: tilt the globe toward the cursor, spin it by drag and add star parallax

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check (1422×745):**
- Move the cursor around: the globe tilts toward it smoothly (small, about 6°), the stars and the sun drift slightly the other way; no jitter when the cursor stops.
- Drag the globe left and right: it follows, coasts after release and eases back to the idle spin within a few seconds; a vertical drag pitches it and it springs back level. The cursor shows grab, then grabbing.
- Mouse-wheel scrolling over the globe still scrolls the page; the "Discuss a project" button and the corner card still click; Tab still reaches them with the orange focus ring.
- DevTools device toolbar with touch (any phone preset, reload): the desktop hero is not shown there, so nothing changes; on a desktop-sized window with touch emulation, swiping scrolls the page.


---

### Task 6: Intro loader and word-mask headline

On a first desktop visit the page opens on a `00→100` counter driven by the real 2k-texture progress; when the first textured frame has rendered, the counter finishes, the overlay lifts, the globe fades up from black with an atmosphere flare and the headline words rise out of their masks. The inline gate decides before first paint, so the overlay never flashes and never shows without JavaScript, under reduced motion, on Save-Data, on phones or on repeat views in the same tab. The headline words rise from masks for every visitor (with or without the intro); reduced motion and no-JS get the end state through the existing `[data-reveal]` CSS.

**Files:**
- Create: `src/components/IntroGate.tsx`, `src/components/IntroOverlay.tsx`
- Replace: `src/components/EarthScene.tsx`
- Modify: `src/app/layout.tsx`, `src/components/sections/OrbitalCinematic.tsx`, `src/app/globals.css`, `scripts/browser-check.mjs`
- Test: `scripts/browser-check.mjs` (the gate and store were unit-tested in Task 2)

- [ ] **Step 1: Write the failing browser checks**

Edit 1 of 3 in `scripts/browser-check.mjs`. Replace:

```js
      new PerformanceObserver(list => { window.__audit.longTasks += list.getEntries().length; }).observe({ type: "longtask", buffered: true });
    });
```

with:

```js
      new PerformanceObserver(list => { window.__audit.longTasks += list.getEntries().length; }).observe({ type: "longtask", buffered: true });
      // Intro and globe state changes with timestamps (data-intro on <html>, data-globe on the hero scene).
      window.__heroLog = [];
      new MutationObserver(records => { for (const r of records) window.__heroLog.push({ attr: r.attributeName, value: r.target.getAttribute(r.attributeName), t: performance.now() }); })
        .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-intro", "data-globe"] });
    });
```

Edit 2 of 3 in `scripts/browser-check.mjs`. Replace:

```js
    if (profile.name === "desktop") {
      // The globe streams same-origin WebP maps
```

with:

```js
    // The intro plays once per session on a first desktop visit and is skipped everywhere else.
    const heroLog = async () => (await page.evaluate(() => window.__heroLog)) ?? [];
    const played = log => log.some(entry => entry.attr === "data-intro" && entry.value === "play");
    if (profile.javaScriptEnabled === false) {
      assert.equal(await page.locator(".intro-overlay").evaluate(el => getComputedStyle(el).display), "none", "no-javascript: the intro overlay never shows");
    } else if (profile.name === "desktop") {
      await page.waitForFunction(() => window.__heroLog.some(entry => entry.attr === "data-intro" && entry.value === "done"), null, { timeout: 45000 });
      const log = await heroLog();
      const play = log.find(entry => entry.attr === "data-intro" && entry.value === "play");
      const ready = log.find(entry => entry.attr === "data-globe" && entry.value === "ready");
      const done = log.find(entry => entry.attr === "data-intro" && entry.value === "done");
      assert.ok(play, "desktop: the intro plays on the first visit");
      // At most 2.5 s after the globe is ready, or after the 4 s loading cap (300 ms slack for timers).
      const limit = Math.min(ready ? ready.t : Infinity, play.t + 4000) + 2500 + 300;
      assert.ok(done.t <= limit, `desktop: the intro ends within 2.5 s of loading (${JSON.stringify({ play: play.t, ready: ready?.t, done: done.t })})`);
    } else {
      assert.equal(played(await heroLog()), false, `${profile.name}: no intro`);
    }
    if (profile.name === "desktop") {
      // The globe streams same-origin WebP maps
```

Edit 3 of 3 in `scripts/browser-check.mjs`. Replace:

```js
      report.interactions.push("desktop globe drag spins it without scrolling the page");
    }
```

with:

```js
      report.interactions.push("desktop globe drag spins it without scrolling the page");

      // A second visit in the same session skips the intro.
      await page.reload({ waitUntil: "networkidle" });
      await page.locator("h1").waitFor({ state: "visible" });
      assert.equal(played(await heroLog()), false, "desktop: the intro is skipped on the second visit");
      report.interactions.push("desktop intro plays once per session and ends within 2.5 s of loading");
    }
```

- [ ] **Step 2: Run them against the Task 5 build and see them fail**

Run: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787`
Expected: FAIL in the `desktop` profile with `page.waitForFunction: Timeout 45000ms exceeded` (no `data-intro` yet).

- [ ] **Step 3: Create the inline gate**

Create `src/components/IntroGate.tsx`:

```tsx
import { introGateScript } from "@/components/globe/intro-gate";

/**
 * Runs inline before first paint and marks html[data-intro="play"] on a first desktop visit to
 * the home page (rules in intro-gate.ts). Without JavaScript nothing is marked, so the intro
 * overlay never shows. CSP: script-src already allows inline scripts.
 */
export default function IntroGate() {
  return <script dangerouslySetInnerHTML={{ __html: introGateScript() }} />;
}
```

- [ ] **Step 4: Create the overlay**

Create `src/components/IntroOverlay.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { INTRO_EXTRA_CAP_MS, INTRO_LOAD_CAP_MS, INTRO_REVEAL_MS, introStore } from "@/components/globe/intro-store";

/**
 * The first-visit intro: a 00→100 counter driven by the globe's real texture progress, then the
 * reveal. It is rendered hidden on every page and only shows when the inline gate (IntroGate.tsx)
 * set html[data-intro="play"] before first paint. Any input ends it at once; it never takes pointer
 * events, so it cannot trap focus or swallow a click.
 */
export default function IntroOverlay() {
  const count = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "play") return;
    introStore.start();
    const started = performance.now();
    const inputs = ["keydown", "pointerdown", "wheel", "touchstart"] as const;
    let shown = 0;
    let readyAt = 0;
    let frame = 0;
    let capTimer = 0;
    let doneTimer = 0;

    const write = (value: number) => {
      if (count.current) count.current.textContent = String(Math.floor(value)).padStart(2, "0");
      if (bar.current) bar.current.style.transform = `scaleX(${value / 100})`;
    };
    const skip = () => finish();
    const scrolled = () => {
      if (window.scrollY > 4) finish();
    };
    const detach = () => {
      for (const type of inputs) window.removeEventListener(type, skip, true);
      document.removeEventListener("focusin", skip, true);
      window.removeEventListener("scroll", scrolled);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(capTimer);
      window.clearTimeout(doneTimer);
      detach();
    };
    function finish() {
      stop();
      root.dataset.intro = "done";
      introStore.finish();
    }
    const reveal = () => {
      if (root.dataset.intro !== "play") return;
      cancelAnimationFrame(frame);
      window.clearTimeout(capTimer);
      write(100);
      root.dataset.intro = "reveal";
      introStore.reveal();
      doneTimer = window.setTimeout(finish, INTRO_REVEAL_MS);
    };
    const tick = (now: number) => {
      const { progress, ready, failed } = introStore.get();
      if (ready && !readyAt) {
        readyAt = now;
        capTimer = window.setTimeout(reveal, INTRO_EXTRA_CAP_MS - INTRO_REVEAL_MS);
      }
      const target = ready ? 100 : Math.min(99, progress * 100);
      shown += (target - shown) * (ready ? 0.22 : 0.1);
      if (target - shown < 0.5) shown = target;
      write(shown);
      if ((ready && shown >= 100) || failed || now - started > INTRO_LOAD_CAP_MS) {
        reveal();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    for (const type of inputs) window.addEventListener(type, skip, { capture: true, passive: true });
    document.addEventListener("focusin", skip, true);
    window.addEventListener("scroll", scrolled, { passive: true });
    if (window.scrollY > 4) finish();
    else frame = requestAnimationFrame(tick);
    return stop;
  }, []);

  return (
    <div className="intro-overlay" aria-hidden="true">
      <span ref={count} className="intro-count">
        00
      </span>
      <span className="intro-track">
        <span ref={bar} className="intro-bar" />
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Mount both in the root layout**

Edit 1 of 2 in `src/app/layout.tsx`. Replace:

```tsx
import NoScriptStyles from "@/components/NoScriptStyles";
```

with:

```tsx
import NoScriptStyles from "@/components/NoScriptStyles";
import IntroGate from "@/components/IntroGate";
import IntroOverlay from "@/components/IntroOverlay";
```

Edit 2 of 2 in `src/app/layout.tsx`. Replace:

```tsx
  return <html lang="en" className={`${inter.variable} ${mono.variable} antialiased`}><body id="top">
    <NoScriptStyles />
    <a className="skip-link" href="#main">Skip to content</a>
```

with:

```tsx
  // suppressHydrationWarning: the inline intro gate may add data-intro to <html> before hydration.
  return <html lang="en" className={`${inter.variable} ${mono.variable} antialiased`} suppressHydrationWarning><body id="top">
    <IntroGate />
    <NoScriptStyles />
    <a className="skip-link" href="#main">Skip to content</a>
    <IntroOverlay />
```

`suppressHydrationWarning` applies to the `<html>` element's own attributes only; React 19 does not remove the extra `data-intro` attribute during hydration.

- [ ] **Step 6: Hold the hero copy for the intro and split the headline into masked words**

Edit 1 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
```

with:

```tsx
import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";
import { Component, Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
```

Edit 2 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
import { hasWebGL2 } from "@/components/globe/device";
```

with:

```tsx
import { hasWebGL2 } from "@/components/globe/device";
import { getIntroPhase, getServerIntroPhase, introStore } from "@/components/globe/intro-store";
```

Edit 3 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
function HeroCopy() {
  const EASE = [0.44, 0, 0.56, 1] as const;
  // Same markup for every visitor (static export): reduced motion is handled by
  // MotionProvider (skipAnimations) and the reduced-motion end-state CSS.
  const v = (delay: number) => ({
    initial: { opacity: 0, y: 28, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.9, ease: EASE, delay },
  });
  const [first, second, third] = HOME.headline.verbs;
  return (
    <div className="hero-copy mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
      <motion.p data-reveal="" {...v(0.05)} className="text-[15px] leading-tight">
        <span className="text-mut-2">{HOME.eyebrow.muted}</span>{" "}
        <span className="font-medium text-ink">{HOME.eyebrow.strong}</span>
      </motion.p>

      <motion.h1 data-reveal="" {...v(0.15)} className="display mx-auto mt-6 max-w-3xl text-[clamp(38px,7.4vw,92px)] text-ink">
        <span className="text-mut-3">— </span>
        {HOME.headline.lead} <span className="text-flame">{first}</span>,{" "}
        <span className="text-flame">{second}</span>, and{" "}
        <span className="text-flame">{third}</span> {HOME.headline.tail}
      </motion.h1>

      <motion.div data-reveal="" {...v(0.3)} className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:items-center lg:items-start">
```

with:

```tsx
const EASE = [0.44, 0, 0.56, 1] as const;
const RISE = [0.16, 1, 0.3, 1] as const;
const fade = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: EASE, delay } },
});
const EYEBROW = fade(0.05);
const PITCH = fade(0.3);
const STATS = fade(0.42);
const HEADLINE: Variants = { hidden: {}, shown: { transition: { delayChildren: 0.12, staggerChildren: 0.045 } } };
const WORD: Variants = { hidden: { y: "110%" }, shown: { y: "0%", transition: { duration: 0.95, ease: RISE } } };

type Word = { text: string; tone?: string; after?: string };
const [FIRST, SECOND, THIRD] = HOME.headline.verbs;
// "— The smarter way to plan, build, and scale your business." as single words, each in its own mask.
const WORDS: Word[] = [
  { text: "—", tone: "text-mut-3" },
  ...HOME.headline.lead.split(" ").map((text) => ({ text })),
  { text: FIRST, tone: "text-flame", after: "," },
  { text: SECOND, tone: "text-flame", after: "," },
  { text: "and" },
  { text: THIRD, tone: "text-flame" },
  ...HOME.headline.tail.split(" ").map((text) => ({ text })),
];

function HeroCopy() {
  // Same markup for every visitor (static export). The intro holds the copy until its reveal;
  // reduced motion and no-JS get the end state from CSS on [data-reveal] (globals.css, NoScriptStyles).
  const phase = useSyncExternalStore(introStore.subscribe, getIntroPhase, getServerIntroPhase);
  const state = phase === "loading" ? "hidden" : "shown";
  return (
    <div className="hero-copy mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
      <motion.p data-reveal="" variants={EYEBROW} initial="hidden" animate={state} className="text-[15px] leading-tight">
        <span className="text-mut-2">{HOME.eyebrow.muted}</span>{" "}
        <span className="font-medium text-ink">{HOME.eyebrow.strong}</span>
      </motion.p>

      {/* Each word rises out of its own mask (.hero-word-mask); the accessible name is the plain sentence. */}
      <motion.h1 variants={HEADLINE} initial="hidden" animate={state} className="display mx-auto mt-6 max-w-3xl text-[clamp(38px,7.4vw,92px)] text-ink">
        {WORDS.map((word, index) => (
          <Fragment key={index}>
            {index > 0 && " "}
            <span className="hero-word-mask">
              <motion.span data-reveal="" variants={WORD} className="hero-word">
                {word.tone ? <span className={word.tone}>{word.text}</span> : word.text}
                {word.after}
              </motion.span>
            </span>
          </Fragment>
        ))}
      </motion.h1>

      <motion.div data-reveal="" variants={PITCH} initial="hidden" animate={state} className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:items-center lg:items-start">
```

Edit 4 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
      <motion.div data-reveal="" {...v(0.42)} className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-10 lg:justify-start">
```

with:

```tsx
      <motion.div data-reveal="" variants={STATS} initial="hidden" animate={state} className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-10 lg:justify-start">
```

Edit 5 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
  const fail = () => setGlobe("failed");

  // Mount the WebGL scene when the browser is idle, after the copy has painted,
  // and only while the hero is on screen (a reload mid-page fetches nothing).
  useEffect(() => {
    if (!cinematic || !active || ready || globe === "failed") return;
    const enable = () => {
      if (!hasWebGL2()) return; // keep the poster; fetch no textures
      setReady(true);
    };
    if ("requestIdleCallback" in window) {
```

with:

```tsx
  const fail = () => {
    setGlobe("failed");
    introStore.fail();
  };

  // Mount the WebGL scene at once while the intro covers the page; otherwise when the browser is
  // idle after the copy has painted. Only while the hero is on screen (a reload mid-page fetches nothing).
  useEffect(() => {
    if (!cinematic || !active || ready || globe === "failed") return;
    const enable = () => {
      if (!hasWebGL2()) {
        introStore.fail(); // keep the poster; fetch no textures
        return;
      }
      setReady(true);
    };
    if (introStore.get().phase === "loading") {
      const timer = window.setTimeout(enable, 0);
      return () => window.clearTimeout(timer);
    }
    if ("requestIdleCallback" in window) {
```

- [ ] **Step 7: Report progress, readiness and the reveal from the scene**

Replace the whole of `src/components/EarthScene.tsx` with:

```tsx
"use client";

import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, use, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import Backdrop from "@/components/globe/Backdrop";
import Globe, { createGlobeFrame, type GlobeFrame } from "@/components/globe/Globe";
import { CAMERA_FOV, CAMERA_Z, EXPOSURE, FLARE_GAIN, FLARE_SECONDS, MAX_TILT, MOBILE_RADIUS, MOBILE_SUN_T, REVEAL_SECONDS, RIG_SCALE, RIG_X, SUN_END, SUN_START } from "@/components/globe/constants";
import { createDragState, createSpring, stepDrag, stepSpring, type PointerInput } from "@/components/globe/interaction";
import { getIntroPhase, introStore } from "@/components/globe/intro-store";
import { cameraZAt, clamp01, rigAt, slerpDirection, smoothstep, sunDirectionAt } from "@/components/globe/scroll";
import { loadHeroTextures, releaseSource, type HeroTextures } from "@/components/globe/textures";
import { usePointerInput } from "@/components/globe/usePointerInput";

export type SceneVariant = "cinematic" | "mobile";
export type EarthSceneProps = {
  variant: SceneVariant;
  active: boolean;
  /** Hero scroll progress 0…1 (cinematic only). */
  progress?: MotionValue<number>;
  /** The element that takes drag input (cinematic, fine pointers only). */
  dragTarget?: RefObject<HTMLElement | null>;
  /** The first textured frame has rendered. */
  onReady: () => void;
  /** The WebGL context was lost: drop the canvas and keep the poster. */
  onLost: () => void;
};

const MOBILE_SUN = slerpDirection(SUN_START, SUN_END, MOBILE_SUN_T);
const RIG_START: [number, number, number] = [RIG_X[0], 0, 0];

/** Scroll beats: right of centre, then shrinking to the centre (eased toward rigAt). */
function Rig({ progress, children }: { progress: MotionValue<number>; children: ReactNode }) {
  const rig = useRef<THREE.Group>(null);
  useFrame((_, raw) => {
    const group = rig.current;
    if (!group) return;
    const delta = Math.min(raw, 0.1);
    const target = rigAt(progress.get());
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, target.scale, 5, delta));
    group.position.x = THREE.MathUtils.damp(group.position.x, target.x, 5, delta);
  });
  return (
    <group ref={rig} scale={RIG_SCALE[0]} position={RIG_START}>
      {children}
    </group>
  );
}

type Warmup = {
  queued: boolean;
  pending: THREE.Texture[];
  compiling: boolean;
  compiled: boolean;
  shownAt: number;
  announced: boolean;
  played: boolean;
  revealStart: number;
};

type ContentsProps = {
  variant: SceneVariant;
  load: Promise<HeroTextures>;
  progress?: MotionValue<number>;
  pointer: RefObject<PointerInput>;
  onReady: () => void;
};

function SceneContents({ variant, load, progress, pointer, onReady }: ContentsProps) {
  const loaded = use(load);
  const root = useRef<THREE.Group>(null);
  const frame = useRef<GlobeFrame>(createGlobeFrame());
  const warm = useRef<Warmup>({ queued: false, pending: [], compiling: false, compiled: false, shownAt: -1, announced: false, played: false, revealStart: -1 });
  const tilt = useRef({ x: createSpring(), y: createSpring() });
  const drag = useRef(createDragState());
  const sunTarget = useRef(new THREE.Vector3());

  // Queue the first set for one-per-frame GPU uploads, and note whether the intro is running.
  useEffect(() => {
    warm.current.pending = [...Object.values(loaded.globe), ...(loaded.backdrop ? [loaded.backdrop] : [])];
    warm.current.queued = true;
    warm.current.played = introStore.get().phase !== "off";
  }, [loaded]);

  // Warm-up: compile the programs without blocking (KHR_parallel_shader_compile), upload one
  // texture per frame so no single frame takes the whole upload, then show the scene.
  useFrame((state) => {
    const w = warm.current;
    const group = root.current;
    if (!group || w.announced) return;
    if (!w.compiling) {
      w.compiling = true;
      state.gl
        .compileAsync(group, state.camera, state.scene)
        .catch(() => undefined)
        .then(() => {
          w.compiled = true;
        });
    }
    const next = w.pending.shift();
    if (next) {
      state.gl.initTexture(next);
      releaseSource(next);
      return;
    }
    if (!w.queued || !w.compiled) return;
    if (!group.visible) {
      group.visible = true;
      w.shownAt = state.clock.elapsedTime;
      return;
    }
    if (state.clock.elapsedTime <= w.shownAt) return;
    w.announced = true;
    if (variant === "cinematic") introStore.markReady();
    onReady();
  });

  // Per-frame driver, called by the Globe before it applies the frame.
  const drive = (f: GlobeFrame, delta: number, state: RootState) => {
    const w = warm.current;
    const p = progress?.get() ?? 0;
    // The sun sweeps with scroll on desktop (the terminator crosses the face and the city lights
    // come on as the globe centres); phones keep a fixed crescent.
    const [sx, sy, sz] = variant === "cinematic" ? sunDirectionAt(p) : MOBILE_SUN;
    sunTarget.current.set(sx, sy, sz);
    if (w.announced) f.sun.lerp(sunTarget.current, 1 - Math.exp(-6 * delta)).normalize();
    else f.sun.copy(sunTarget.current);

    if (variant === "cinematic") {
      // Slow camera dolly-in across the hero.
      state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, cameraZAt(p), 3, delta);
      // Cursor tilt (spring, ≈6°) plus drag spin with inertia and a sprung pitch.
      const input = pointer.current;
      f.spinBoost = stepDrag(input, drag.current, delta, window.innerWidth);
      f.tiltX = stepSpring(tilt.current.x, -input.y * MAX_TILT, delta) + drag.current.pitch.value;
      f.tiltY = stepSpring(tilt.current.y, input.x * MAX_TILT, delta);
    }

    // With the intro, the globe fades up from black and the atmosphere flares once the overlay
    // lifts. Otherwise the canvas itself fades in over the poster (globals.css).
    if (!w.played) {
      f.reveal = 1;
      f.flare = 1;
      return;
    }
    if (getIntroPhase() === "loading") {
      f.reveal = 0;
      f.flare = 1;
      return;
    }
    if (w.revealStart < 0) w.revealStart = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - w.revealStart;
    f.reveal = smoothstep(0, REVEAL_SECONDS, t);
    f.flare = 1 + FLARE_GAIN * Math.sin(Math.PI * clamp01(t / FLARE_SECONDS));
  };

  const globeNode = <Globe textures={loaded.globe} frame={frame} onFrame={drive} />;
  return (
    <group ref={root} visible={false}>
      {variant === "cinematic" && loaded.backdrop && <Backdrop galaxy={loaded.backdrop} pointer={pointer} />}
      {variant === "cinematic" && progress ? <Rig progress={progress}>{globeNode}</Rig> : <group scale={MOBILE_RADIUS}>{globeNode}</group>}
    </group>
  );
}

/**
 * The hero globe. Desktop ("cinematic"): 2k textures plus the galaxy backdrop, scroll beats, cursor
 * tilt and drag; its loading drives the intro counter. Phones and tablets ("mobile"): the 1k globe alone.
 */
export default function EarthScene({ variant, active, progress, dragTarget, onReady, onLost }: EarthSceneProps) {
  const [load] = useState(() => {
    const promise = loadHeroTextures(variant === "cinematic" ? "2k" : "1k", {
      backdrop: variant === "cinematic",
      onProgress: variant === "cinematic" ? introStore.setProgress : undefined,
    });
    // A failed load surfaces through use() → SceneBoundary; this only marks the rejection handled.
    promise.catch(() => undefined);
    return promise;
  });
  const pointer = usePointerInput(dragTarget, variant === "cinematic");

  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      dpr={variant === "cinematic" ? [1, 2] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: variant === "cinematic" ? "high-performance" : "default" }}
      onCreated={({ gl }) => {
        // ACES Filmic with sRGB output, as before: deep space blacks and a warm roll-off for the
        // over-bright city lights. Textures: colour maps sRGB, data maps linear.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
      }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <SceneContents variant={variant} load={load} progress={progress} pointer={pointer} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
```

- [ ] **Step 8: Style the masks and the overlay**

Edit 1 of 1 in `src/app/globals.css`. Replace:

```css
  .hero-scene[data-dragging] { cursor: grabbing; }
}
```

with:

```css
  .hero-scene[data-dragging] { cursor: grabbing; }
}

/* Hero headline words rise out of masks (OrbitalCinematic.tsx). The padding keeps descenders and
   the display face's 0.92 line height inside the clip; the negative margins cancel it in layout. */
.hero-word-mask { display: inline-block; overflow: hidden; vertical-align: top; padding: 0.08em 0.04em 0.18em; margin: -0.08em -0.04em -0.18em; }
.hero-word { display: inline-block; }

/* Intro loader (IntroOverlay.tsx). It shows only while the inline gate (IntroGate.tsx) has set
   html[data-intro]: never without JavaScript, under reduced motion, on Save-Data or on repeat views. */
.intro-overlay { display: none; }
html[data-intro="play"] .intro-overlay,
html[data-intro="reveal"] .intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: flex-end;
  gap: 32px;
  padding: 0 32px 40px;
  background: #08080b;
  pointer-events: none;
}
.intro-count { font-weight: 500; font-size: clamp(72px, 11vw, 168px); line-height: 0.85; letter-spacing: -0.05em; color: #e3dbd8; font-variant-numeric: tabular-nums; }
.intro-track { position: relative; flex: 1; height: 1px; margin-bottom: 20px; overflow: hidden; background: #2a2b2e; }
.intro-bar { position: absolute; inset: 0; background: #fa6e43; transform: scaleX(0); transform-origin: left; }
html[data-intro="reveal"] .intro-overlay { opacity: 0; transition: opacity 0.8s cubic-bezier(0.44, 0, 0.56, 1) 0.2s; }
html[data-intro="reveal"] .intro-count { opacity: 0; transform: translateY(-24%); transition: opacity 0.5s, transform 0.7s cubic-bezier(0.44, 0, 0.56, 1); }
@media (prefers-reduced-motion: reduce) {
  html[data-intro] .intro-overlay { display: none !important; }
}
```

- [ ] **Step 9: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass (`tests/content.test.mjs` still finds the headline verbs in `HOME`; `content.ts` is unchanged).

- [ ] **Step 10: Heavy gates**

Run, one after the other:
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild` — expected: `Export valid: …`, `preview up on :8787`.
2. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787` — expected: `SEO crawl passed: …` (one visible `h1` per page without JavaScript, the overlay is not under `main` and has no heading).
3. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787` — expected: `Browser checks passed: 6 profiles; …`, with `desktop intro plays once per session and ends within 2.5 s of loading`. The hidden-text sweeps in the `reduced-motion` and `no-javascript` profiles must still report no transparent text, and the reduced-motion profile must still report zero running animations.

- [ ] **Step 11: Commit**

```bash
git add src/components/IntroGate.tsx src/components/IntroOverlay.tsx src/app/layout.tsx src/components/sections/OrbitalCinematic.tsx src/components/EarthScene.tsx src/app/globals.css scripts/browser-check.mjs
git commit -m "feat: add the first-visit intro loader and the word-mask hero headline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check (1422×745):**
- Open the site in a new tab (a new tab is a new session). The page opens on the dark overlay with the counter; it climbs with the real download (DevTools Network throttling "Fast 4G" makes it visible), reaches 100, the overlay fades, the globe fades up from black with a short atmosphere flare and the headline words rise line by line. Nothing flashes before the overlay.
- Time from the counter reaching 100 to the copy being fully in place: about 1.1–1.6 s, never more than 2.5 s.
- Reload the tab: no intro; the poster, then the globe fade in; the headline words rise.
- In a new tab, press Tab or scroll during the intro: it ends at once and focus is visible.
- DevTools Rendering → `prefers-reduced-motion: reduce`, new tab: no intro, the static hero (the galaxy backdrop until Task 9 switches desktops to the poster), copy fully visible.
- DevTools → disable JavaScript, new tab: no overlay, copy visible.
- The headline breaks into the same lines as before the change, with no clipped descenders on "way", "plan," or "your".


---

### Task 7: 4k streaming on capable desktops

After the intro (or straight away when there is none) and once the browser is idle, capable desktops fetch the 4k set, upload it one texture per frame, swap the material uniforms in place and free the 2k set. `canStream4k` (Task 2) requires a hardware GPU, `maxTextureSize ≥ 4096`, `deviceMemory ≥ 8` or unknown, no Save-Data and no 2g/3g connection. The wrapper reports the tier in `data-globe-tier`.

**Files:**
- Replace: `src/components/EarthScene.tsx`
- Modify: `src/components/sections/OrbitalCinematic.tsx`, `scripts/browser-check.mjs`
- Test: `scripts/browser-check.mjs` (the capability rule was unit-tested in Task 2)

- [ ] **Step 1: Write the failing browser checks**

Edit 1 of 2 in `scripts/browser-check.mjs`. Replace:

```js
      assert.ok(textures.length >= 5 && textures.every(url => url.includes("/textures/earth/2k/")), `desktop: the first frame uses the 2k set (${textures.join(", ")})`);
```

with:

```js
      assert.ok(textures.length >= 5 && textures.every(url => url.includes("/textures/earth/2k/")), `desktop: the first frame uses the 2k set (${textures.join(", ")})`);
      assert.equal(await page.locator("#home .hero-scene").getAttribute("data-globe-tier"), "2k", "desktop: the 2k tier is on screen first");
```

Edit 2 of 2 in `scripts/browser-check.mjs`. Replace:

```js
    if (profile.reducedMotion || profile.javaScriptEnabled === false) assert.deepEqual(textureRequests, [], `${profile.name}: no globe textures`);
```

with:

```js
    if (profile.reducedMotion || profile.javaScriptEnabled === false) assert.deepEqual(textureRequests, [], `${profile.name}: no globe textures`);
    if (profile.name === "desktop") {
      // The 4k set streams only on hardware GPUs; headless Chromium renders WebGL with SwiftShader.
      const renderer = await page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        const info = gl?.getExtension("WEBGL_debug_renderer_info");
        return gl ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : "";
      });
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) {
        assert.ok(!textureRequests.some(url => url.includes("/textures/earth/4k/")), `desktop (${renderer}): a software renderer never streams the 4k set`);
      }
      report.interactions.push(`desktop WebGL renderer: ${renderer}`);
    }
```

- [ ] **Step 2: Run them against the Task 6 build and see them fail**

Run: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787`
Expected: FAIL with `desktop: the 2k tier is on screen first` (`null` !== `"2k"`).

- [ ] **Step 3: Stream the 4k set**

Replace the whole of `src/components/EarthScene.tsx` with:

```tsx
"use client";

import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, use, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import Backdrop from "@/components/globe/Backdrop";
import Globe, { createGlobeFrame, type GlobeFrame } from "@/components/globe/Globe";
import { CAMERA_FOV, CAMERA_Z, EXPOSURE, FLARE_GAIN, FLARE_SECONDS, MAX_TILT, MOBILE_RADIUS, MOBILE_SUN_T, REVEAL_SECONDS, RIG_SCALE, RIG_X, SUN_END, SUN_START } from "@/components/globe/constants";
import { createDragState, createSpring, stepDrag, stepSpring, type PointerInput } from "@/components/globe/interaction";
import { getIntroPhase, getServerIntroPhase, introStore } from "@/components/globe/intro-store";
import { cameraZAt, clamp01, rigAt, slerpDirection, smoothstep, sunDirectionAt } from "@/components/globe/scroll";
import { disposeTextureSet, globeEntries, loadHeroTextures, loadTextureSet, releaseSource, type GlobeTextureSet, type HeroTextures } from "@/components/globe/textures";
import { canStream4k, type GlobeTier } from "@/components/globe/tiers";
import { usePointerInput } from "@/components/globe/usePointerInput";

export type SceneVariant = "cinematic" | "mobile";
export type EarthSceneProps = {
  variant: SceneVariant;
  active: boolean;
  /** Hero scroll progress 0…1 (cinematic only). */
  progress?: MotionValue<number>;
  /** The element that takes drag input (cinematic, fine pointers only). */
  dragTarget?: RefObject<HTMLElement | null>;
  /** The first textured frame has rendered. */
  onReady: () => void;
  /** A higher texture tier is now on screen. */
  onTier?: (tier: GlobeTier) => void;
  /** The WebGL context was lost: drop the canvas and keep the poster. */
  onLost: () => void;
};

const MOBILE_SUN = slerpDirection(SUN_START, SUN_END, MOBILE_SUN_T);
const RIG_START: [number, number, number] = [RIG_X[0], 0, 0];

function rendererName(gl: THREE.WebGLRenderer): string {
  const context = gl.getContext();
  const info = context.getExtension("WEBGL_debug_renderer_info");
  return String(context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER));
}

/** Scroll beats: right of centre, then shrinking to the centre (eased toward rigAt). */
function Rig({ progress, children }: { progress: MotionValue<number>; children: ReactNode }) {
  const rig = useRef<THREE.Group>(null);
  useFrame((_, raw) => {
    const group = rig.current;
    if (!group) return;
    const delta = Math.min(raw, 0.1);
    const target = rigAt(progress.get());
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, target.scale, 5, delta));
    group.position.x = THREE.MathUtils.damp(group.position.x, target.x, 5, delta);
  });
  return (
    <group ref={rig} scale={RIG_SCALE[0]} position={RIG_START}>
      {children}
    </group>
  );
}

type Warmup = {
  queued: boolean;
  pending: THREE.Texture[];
  compiling: boolean;
  compiled: boolean;
  shownAt: number;
  announced: boolean;
  played: boolean;
  revealStart: number;
  gpu: { maxTextureSize: number; renderer: string } | null;
};

type ContentsProps = {
  variant: SceneVariant;
  load: Promise<HeroTextures>;
  progress?: MotionValue<number>;
  pointer: RefObject<PointerInput>;
  onReady: () => void;
  onTier?: (tier: GlobeTier) => void;
};

function SceneContents({ variant, load, progress, pointer, onReady, onTier }: ContentsProps) {
  const loaded = use(load);
  const [globe, setGlobe] = useState<GlobeTextureSet>(loaded.globe);
  const [ready, setReady] = useState(false);
  const phase = useSyncExternalStore(introStore.subscribe, getIntroPhase, getServerIntroPhase);
  const root = useRef<THREE.Group>(null);
  const frame = useRef<GlobeFrame>(createGlobeFrame());
  const warm = useRef<Warmup>({ queued: false, pending: [], compiling: false, compiled: false, shownAt: -1, announced: false, played: false, revealStart: -1, gpu: null });
  const upgrade = useRef<{ pending: THREE.Texture[]; set: GlobeTextureSet | null }>({ pending: [], set: null });
  const shown = useRef<GlobeTextureSet | null>(null);
  const tilt = useRef({ x: createSpring(), y: createSpring() });
  const drag = useRef(createDragState());
  const sunTarget = useRef(new THREE.Vector3());

  // Queue the first set for one-per-frame GPU uploads, and note whether the intro is running.
  useEffect(() => {
    warm.current.pending = [...Object.values(loaded.globe), ...(loaded.backdrop ? [loaded.backdrop] : [])];
    warm.current.queued = true;
    warm.current.played = introStore.get().phase !== "off";
  }, [loaded]);

  // After a tier swap the Globe has rebound its uniforms; free the previous set.
  useEffect(() => {
    const previous = shown.current;
    shown.current = globe;
    if (previous && previous !== globe) disposeTextureSet(previous);
  }, [globe]);

  // Capable desktops stream the 4k set once the intro is over and the browser is idle.
  useEffect(() => {
    const gpu = warm.current.gpu;
    if (variant !== "cinematic" || !ready || !gpu || phase === "loading" || phase === "reveal") return;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
    const capable = canStream4k({
      viewportWidth: window.innerWidth,
      saveData: Boolean(nav.connection?.saveData),
      effectiveType: nav.connection?.effectiveType,
      deviceMemory: nav.deviceMemory,
      ...gpu,
    });
    if (!capable) return;
    let cancelled = false;
    const start = () => {
      loadTextureSet(globeEntries("4k"))
        .then((set) => {
          if (cancelled) return disposeTextureSet(set);
          upgrade.current = { pending: Object.values(set), set };
        })
        .catch(() => {
          // Keep the 2k set.
        });
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 6000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const timer = setTimeout(start, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [variant, ready, phase]);

  // Warm-up, then streaming: compile the programs without blocking (KHR_parallel_shader_compile),
  // upload one texture per frame so no single frame takes the whole upload, then show the scene.
  useFrame((state) => {
    const w = warm.current;
    const group = root.current;
    if (!group) return;
    if (!w.announced) {
      if (!w.compiling) {
        w.compiling = true;
        state.gl
          .compileAsync(group, state.camera, state.scene)
          .catch(() => undefined)
          .then(() => {
            w.compiled = true;
          });
      }
      const next = w.pending.shift();
      if (next) {
        state.gl.initTexture(next);
        releaseSource(next);
        return;
      }
      if (!w.queued || !w.compiled) return;
      if (!group.visible) {
        group.visible = true;
        w.shownAt = state.clock.elapsedTime;
        return;
      }
      if (state.clock.elapsedTime <= w.shownAt) return;
      w.announced = true;
      w.gpu = { maxTextureSize: state.gl.capabilities.maxTextureSize, renderer: rendererName(state.gl) };
      if (variant === "cinematic") introStore.markReady();
      setReady(true);
      onReady();
      return;
    }
    const u = upgrade.current;
    const next = u.pending.shift();
    if (!next) return;
    state.gl.initTexture(next);
    releaseSource(next);
    if (u.pending.length === 0 && u.set) {
      const set = u.set;
      u.set = null;
      setGlobe(set);
      onTier?.("4k");
    }
  });

  // Per-frame driver, called by the Globe before it applies the frame.
  const drive = (f: GlobeFrame, delta: number, state: RootState) => {
    const w = warm.current;
    const p = progress?.get() ?? 0;
    const [sx, sy, sz] = variant === "cinematic" ? sunDirectionAt(p) : MOBILE_SUN;
    sunTarget.current.set(sx, sy, sz);
    if (w.announced) f.sun.lerp(sunTarget.current, 1 - Math.exp(-6 * delta)).normalize();
    else f.sun.copy(sunTarget.current);

    if (variant === "cinematic") {
      state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, cameraZAt(p), 3, delta);
      const input = pointer.current;
      f.spinBoost = stepDrag(input, drag.current, delta, window.innerWidth);
      f.tiltX = stepSpring(tilt.current.x, -input.y * MAX_TILT, delta) + drag.current.pitch.value;
      f.tiltY = stepSpring(tilt.current.y, input.x * MAX_TILT, delta);
    }

    // With the intro, the globe fades up from black and the atmosphere flares once the overlay
    // lifts. Otherwise the canvas itself fades in over the poster (globals.css).
    if (!w.played) {
      f.reveal = 1;
      f.flare = 1;
      return;
    }
    if (getIntroPhase() === "loading") {
      f.reveal = 0;
      f.flare = 1;
      return;
    }
    if (w.revealStart < 0) w.revealStart = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - w.revealStart;
    f.reveal = smoothstep(0, REVEAL_SECONDS, t);
    f.flare = 1 + FLARE_GAIN * Math.sin(Math.PI * clamp01(t / FLARE_SECONDS));
  };

  const globeNode = <Globe textures={globe} frame={frame} onFrame={drive} />;
  return (
    <group ref={root} visible={false}>
      {variant === "cinematic" && loaded.backdrop && <Backdrop galaxy={loaded.backdrop} pointer={pointer} />}
      {variant === "cinematic" && progress ? <Rig progress={progress}>{globeNode}</Rig> : <group scale={MOBILE_RADIUS}>{globeNode}</group>}
    </group>
  );
}

/**
 * The hero globe. Desktop ("cinematic"): 2k textures plus the galaxy backdrop, scroll beats, cursor
 * tilt and drag, then 4k after idle on capable GPUs. Phones and tablets ("mobile"): the 1k globe alone.
 */
export default function EarthScene({ variant, active, progress, dragTarget, onReady, onTier, onLost }: EarthSceneProps) {
  const [load] = useState(() => {
    const promise = loadHeroTextures(variant === "cinematic" ? "2k" : "1k", {
      backdrop: variant === "cinematic",
      onProgress: variant === "cinematic" ? introStore.setProgress : undefined,
    });
    // A failed load surfaces through use() → SceneBoundary; this only marks the rejection handled.
    promise.catch(() => undefined);
    return promise;
  });
  const pointer = usePointerInput(dragTarget, variant === "cinematic");

  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      dpr={variant === "cinematic" ? [1, 2] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: variant === "cinematic" ? "high-performance" : "default" }}
      onCreated={({ gl }) => {
        // ACES Filmic with sRGB output, as before: deep space blacks and a warm roll-off for the
        // over-bright city lights. Textures: colour maps sRGB, data maps linear.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
      }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <SceneContents variant={variant} load={load} progress={progress} pointer={pointer} onReady={onReady} onTier={onTier} />
      </Suspense>
    </Canvas>
  );
}
```

- [ ] **Step 4: Report the tier on the wrapper**

Edit 1 of 3 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
import { getIntroPhase, getServerIntroPhase, introStore } from "@/components/globe/intro-store";
```

with:

```tsx
import { getIntroPhase, getServerIntroPhase, introStore } from "@/components/globe/intro-store";
import { type GlobeTier } from "@/components/globe/tiers";
```

Edit 2 of 3 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
  const [globe, setGlobe] = useState<"idle" | "ready" | "failed">("idle");
```

with:

```tsx
  const [globe, setGlobe] = useState<"idle" | "ready" | "failed">("idle");
  const [tier, setTier] = useState<GlobeTier>("2k");
```

Edit 3 of 3 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
          data-globe={globe}
          data-cursor={globe === "ready" ? "Drag" : undefined}
          aria-hidden
        >
          {ready && globe !== "failed" && (
            <SceneBoundary onError={fail}>
              <EarthScene variant="cinematic" progress={progress} active={active} dragTarget={sceneRef} onReady={() => setGlobe("ready")} onLost={fail} />
            </SceneBoundary>
          )}
```

with:

```tsx
          data-globe={globe}
          data-globe-tier={tier}
          data-cursor={globe === "ready" ? "Drag" : undefined}
          aria-hidden
        >
          {ready && globe !== "failed" && (
            <SceneBoundary onError={fail}>
              <EarthScene
                variant="cinematic"
                progress={progress}
                active={active}
                dragTarget={sceneRef}
                onReady={() => setGlobe("ready")}
                onTier={setTier}
                onLost={fail}
              />
            </SceneBoundary>
          )}
```

- [ ] **Step 5: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 6: Heavy gates**

Run, one after the other:
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild` — expected: `Export valid: …`, `preview up on :8787`.
2. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787` — expected: `SEO crawl passed: …`.
3. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787` — expected: `Browser checks passed: 6 profiles; …`, and the report records `desktop WebGL renderer: ANGLE (Google, Vulkan … SwiftShader …)`. The 4k set is never fetched under SwiftShader; the real GPU check below covers the swap.

- [ ] **Step 7: Commit**

```bash
git add src/components/EarthScene.tsx src/components/sections/OrbitalCinematic.tsx scripts/browser-check.mjs
git commit -m "feat: stream the 4k globe textures after idle on capable desktops

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check (1422×745):**
- Load the home page and wait a few seconds after the intro. Network shows the five `/textures/earth/4k/*.webp` (≈ 2.1 MB) after the first-frame requests; the globe-state snippet shows `globeTier: "4k"`.
- At the opening beat (the large globe on the right) coastlines, city lights and cloud edges are visibly sharper than with 2k; there is no flash or hitch at the swap.
- Run the long-task snippet during the swap: no entry over 100 ms. If one appears, note its duration and whether it coincides with a 4k upload (the fix would be lowering the 4k clouds to 2k in `globeEntries`).
- Task manager (Shift+Esc): the GPU process memory rises by roughly 120 MB at the swap and stays flat afterwards.


---

### Task 8: Phone and tablet 1k globe

Below 1024 px the hero stays the static layout (galaxy image as LCP, copy, statement). After idle, devices that pass `chooseHeroMode` (WebGL2, `deviceMemory ≥ 4` or unknown, no Save-Data, motion allowed) get the 1k globe behind the statement: a transparent canvas (dpr ≤ 1.5) with a fixed night-side crescent, no galaxy sphere and no 3D stars (the existing 2D starfield stays), fading into the page at the bottom. It renders only while on screen. Everything else keeps the galaxy. `EarthScene` already has the `mobile` variant since Task 3.

**Files:**
- Replace: `src/components/globe/device.ts`
- Modify: `src/components/sections/OrbitalCinematic.tsx`, `src/app/globals.css`, `scripts/browser-check.mjs`
- Test: `scripts/browser-check.mjs` (the device rule was unit-tested in Task 2)

- [ ] **Step 1: Write the failing browser checks**

Edit 1 of 3 in `scripts/browser-check.mjs`. Replace:

```js
    if (profile.reducedMotion) assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === "running").length), 0);
```

with:

```js
    if (profile.name === "mobile-390") {
      await page.waitForSelector('#home .hero-mobile-globe[data-globe="ready"]', { timeout: 45000 });
      assert.deepEqual(shaderErrors, [], "mobile-390: the globe's shaders compile");
      report.interactions.push("mobile 1k globe renders");
    }
    if (profile.reducedMotion) assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === "running").length), 0);
```

Edit 2 of 3 in `scripts/browser-check.mjs`. Replace:

```js
    if (profile.name === "desktop") {
      await page.waitForTimeout(300);
      const before = await page.evaluate(() => window.__audit.rafRequests);
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => window.__audit.rafRequests);
      assert.ok(after - before <= 2, "offscreen scene must stop requesting frames");
      report.interactions.push("desktop globe stops rendering offscreen");
    }
```

with:

```js
    if (profile.name === "desktop" || profile.name === "mobile-390") {
      await page.waitForTimeout(300);
      const before = await page.evaluate(() => window.__audit.rafRequests);
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => window.__audit.rafRequests);
      assert.ok(after - before <= 2, `${profile.name}: offscreen scene must stop requesting frames`);
      report.interactions.push(`${profile.name} globe stops rendering offscreen`);
    }
```

Edit 3 of 3 in `scripts/browser-check.mjs`. Replace:

```js
    if (profile.name === "desktop") {
      // The 4k set streams only on hardware GPUs;
```

with:

```js
    if (profile.width < 1024 && !profile.reducedMotion && profile.javaScriptEnabled !== false) {
      // Phones and tablets load the 1k set or, when they fall back to the galaxy, nothing.
      assert.ok(textureRequests.every(url => url.includes("/textures/earth/1k/")), `${profile.name}: only 1k globe textures (${textureRequests.join(", ")})`);
      assert.ok(await page.evaluate(() => window.__bitmaps.every(b => b.w <= 1024)), `${profile.name}: nothing larger than 1k decodes`);
    }
    if (profile.name === "desktop") {
      // The 4k set streams only on hardware GPUs;
```

- [ ] **Step 2: Run them against the Task 7 build and see them fail**

Run: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787`
Expected: FAIL in the `mobile-390` profile with `page.waitForSelector: Timeout 45000ms exceeded` waiting for `#home .hero-mobile-globe[data-globe="ready"]`.

- [ ] **Step 3: Read the device facts**

Replace the whole of `src/components/globe/device.ts` with:

```ts
import type { DeviceEnv } from "./tiers";

/** True when a WebGL2 context can be created; the test context is released at once. */
export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** The facts chooseHeroMode() needs, read from the browser. */
export function readDeviceEnv(): DeviceEnv {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    width: window.innerWidth,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: Boolean(nav.connection?.saveData),
    deviceMemory: nav.deviceMemory,
    webgl2: hasWebGL2(),
  };
}
```

- [ ] **Step 4: Mount the phone globe in the static hero**

Edit 1 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
import { hasWebGL2 } from "@/components/globe/device";
import { getIntroPhase, getServerIntroPhase, introStore } from "@/components/globe/intro-store";
import { type GlobeTier } from "@/components/globe/tiers";
```

with:

```tsx
import { hasWebGL2, readDeviceEnv } from "@/components/globe/device";
import { getIntroPhase, getServerIntroPhase, introStore } from "@/components/globe/intro-store";
import { chooseHeroMode, type GlobeTier } from "@/components/globe/tiers";
```

Edit 2 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
  const sceneRef = useRef<HTMLDivElement | null>(null);
```

with:

```tsx
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const mobileRef = useRef<HTMLDivElement | null>(null);
```

Edit 3 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
  const [tier, setTier] = useState<GlobeTier>("2k");
```

with:

```tsx
  const [tier, setTier] = useState<GlobeTier>("2k");
  const [mobileGlobe, setMobileGlobe] = useState(false);
  const [mobileState, setMobileState] = useState<"idle" | "ready">("idle");
  const [mobileActive, setMobileActive] = useState(true);
```

Edit 4 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
  }, [cinematic, progress]);

  // Mobile / reduced motion / no JS / first paint: the static cosmic hero (no three.js fetched).
```

with:

```tsx
  }, [cinematic, progress]);

  // Phones and tablets: a light 1k globe behind the statement when the device can afford it
  // (WebGL2, deviceMemory ≥ 4 or unknown, no Save-Data, motion allowed). Otherwise the galaxy stays.
  useEffect(() => {
    if (cinematic) return;
    const enable = () => {
      if (chooseHeroMode(readDeviceEnv()) === "mobile-globe") setMobileGlobe(true);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 0);
    return () => clearTimeout(timer);
  }, [cinematic]);

  // The mobile globe renders only while it is on screen and the tab is visible.
  useEffect(() => {
    const el = mobileRef.current;
    if (!mobileGlobe || !el) return;
    let visible = true;
    const update = () => setMobileActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [mobileGlobe]);

  // Mobile / reduced motion / no JS / first paint: the static cosmic hero (no three.js fetched
  // until a phone or tablet qualifies for the 1k globe).
```

Edit 5 of 5 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
          <Starfield className="opacity-50" />
```

with:

```tsx
          <Starfield className="opacity-50" />
          {mobileGlobe && (
            <div
              ref={mobileRef}
              className="hero-mobile-globe pointer-events-none absolute bottom-0 left-1/2 aspect-square w-[min(120vw,720px)] -translate-x-1/2"
              data-globe={mobileState}
              aria-hidden
            >
              <SceneBoundary onError={() => setMobileGlobe(false)}>
                <EarthScene variant="mobile" active={mobileActive} onReady={() => setMobileState("ready")} onLost={() => setMobileGlobe(false)} />
              </SceneBoundary>
            </div>
          )}
```

- [ ] **Step 5: Fade it in and blend it into the page**

Edit 1 of 1 in `src/app/globals.css`. Replace:

```css
/* The hero globe canvas (EarthScene.tsx) fades in over the poster once its first textured frame
   has rendered (data-globe="ready"). */
.hero-scene { opacity: 0; transition: opacity 0.6s cubic-bezier(0.44, 0, 0.56, 1); }
.hero-scene[data-globe="ready"] { opacity: 1; }
```

with:

```css
/* The hero globe canvases (EarthScene.tsx) fade in over the poster or the galaxy once their first
   textured frame has rendered (data-globe="ready"). */
.hero-scene,
.hero-mobile-globe { opacity: 0; transition: opacity 0.6s cubic-bezier(0.44, 0, 0.56, 1); }
.hero-scene[data-globe="ready"],
.hero-mobile-globe[data-globe="ready"] { opacity: 1; }
/* The phone and tablet globe sits behind the statement and fades into the page at the bottom. */
.hero-mobile-globe { mask-image: linear-gradient(to bottom, #000 55%, transparent 100%); }
```

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 7: Heavy gates**

Run, one after the other:
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild` — expected: `Export valid: …`, `preview up on :8787`.
2. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787` — expected: `SEO crawl passed: …`.
3. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787` — expected: `Browser checks passed: 6 profiles; …`, with `mobile 1k globe renders` and `mobile-390 globe stops rendering offscreen`. The 320 px text-clipping sweep and the mobile menu checks must still pass. If the `mobile-390` rAF budget fails, find the caller before loosening anything: temporarily log `new Error().stack` in the init script's `requestAnimationFrame` wrapper.

- [ ] **Step 8: Commit**

```bash
git add src/components/globe/device.ts src/components/sections/OrbitalCinematic.tsx src/app/globals.css scripts/browser-check.mjs
git commit -m "feat: add a light 1k globe to the phone and tablet hero

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check (owner's Chrome, DevTools device toolbar):**
- iPhone 14 Pro (393×852, DPR 3) and iPad Air (820×1180): after a moment the globe fades in behind the statement, mostly night with city lights and a lit crescent upper-left, the atmosphere rim, and it fades into the page at the bottom; the copy above stays legible.
- Touch-scroll through the hero (device toolbar touch): scrolling is never blocked; the globe has no drag.
- Network: only `/textures/earth/1k/*.webp` (≈ 191 KB); no 2k, no galaxy re-download.
- Rendering → `prefers-reduced-motion: reduce`, reload: the galaxy hero, no globe, no textures.
- Optionally on a real phone over the LAN: the globe appears and scrolling stays smooth.


---

### Task 9: Poster and fallbacks

Re-capture the poster from the shader globe's opening frame, and make it the desktop static backdrop: first paint, reduced motion, no JavaScript, Save-Data and no WebGL2 all show the poster (through a `<picture>` source), while phones and tablets keep the galaxy. On desktop the static backdrop now covers exactly the first screen and drops the phone-only gradients and 2D starfield, so the first paint matches the cinematic's opening frame and the canvas fade-in is seamless.

**Files:**
- Replace: `scripts/capture-hero-poster.mjs`
- Regenerate: `public/images/hero-poster.webp`
- Modify: `src/components/sections/OrbitalCinematic.tsx`, `scripts/browser-check.mjs`
- Test: `scripts/browser-check.mjs`

- [ ] **Step 1: Write the failing browser checks**

Edit 1 of 2 in `scripts/browser-check.mjs`. Replace:

```js
    if (profile.width < 1024 && !profile.reducedMotion && profile.javaScriptEnabled !== false) {
      // Phones and tablets load the 1k set
```

with:

```js
    // Static backdrops: the globe poster on desktops (also reduced motion and no-JS), the galaxy on phones and tablets.
    const backdrop = await page.locator("#home .hero-backdrop img").first().evaluate(img => img.currentSrc);
    assert.ok(backdrop.endsWith(profile.width >= 1024 ? "/images/hero-poster.webp" : "/images/galaxy.webp"), `${profile.name}: hero backdrop ${backdrop}`);
    if (profile.width < 1024 && !profile.reducedMotion && profile.javaScriptEnabled !== false) {
      // Phones and tablets load the 1k set
```

Edit 2 of 2 in `scripts/browser-check.mjs`. Replace:

```js
  report.interactions.push("failed WebGL retains headline, poster and CTA, without errors or any globe download");
```

with:

```js
  report.interactions.push("failed WebGL retains headline, poster and CTA, without errors or any globe download");

  // Save-Data on a desktop keeps the static poster: no intro and no globe download.
  const saveData = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const saveDataDownloads = [];
  saveData.on("request", request => { if (/\.glb(?:$|\?)|\/draco\/|\/textures\/earth\//.test(request.url())) saveDataDownloads.push(request.url()); });
  await saveData.addInitScript(() => Object.defineProperty(Navigator.prototype, "connection", { configurable: true, get: () => ({ saveData: true, effectiveType: "4g" }) }));
  await saveData.goto(base, { waitUntil: "networkidle" });
  await saveData.waitForTimeout(2500); // past the idle-mount timeout
  assert.equal(await saveData.evaluate(() => document.documentElement.dataset.intro ?? null), null, "save-data: no intro");
  assert.deepEqual(saveDataDownloads, [], "save-data: no globe download");
  assert.ok((await saveData.locator("#home .hero-backdrop img").first().evaluate(img => img.currentSrc)).endsWith("/images/hero-poster.webp"), "save-data: the static poster");
  await saveData.close();
  report.interactions.push("Save-Data desktop keeps the static poster, without the intro or any globe download");
```

- [ ] **Step 2: Run them against the Task 8 build and see them fail**

Run: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787`
Expected: FAIL in the `reduced-motion` profile with `reduced-motion: hero backdrop http://127.0.0.1:8787/images/galaxy.webp`.

- [ ] **Step 3: Update the poster capture**

Replace the whole of `scripts/capture-hero-poster.mjs` with:

```js
// Renders the desktop globe's opening frame to public/images/hero-poster.webp.
// The poster is the desktop hero's first paint, its loading state under the WebGL canvas and the
// static hero for reduced motion, no JavaScript, Save-Data and missing WebGL2.
// Usage (local preview running): node scripts/capture-hero-poster.mjs [base]
// Re-run whenever the globe textures, shaders, galaxy or camera framing change.
import sharp from "sharp";
import { launchBrowser } from "./browser-runtime.mjs";

const base = process.argv[2] || "http://127.0.0.1:8787";
// Mirrors INTRO_SESSION_KEY in src/components/globe/intro-gate.ts: the poster is the opening frame, not the intro.
const INTRO_SESSION_KEY = "spacegear:intro-seen";
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_SESSION_KEY);
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector('#home .hero-scene[data-globe="ready"]', { timeout: 60000 });
  await page.waitForTimeout(900); // the canvas's 0.6 s fade-in over the old poster
  if (!requests.some((url) => url.includes("/textures/earth/2k/"))) throw new Error("The globe did not load its 2k textures.");
  await page.evaluate(() => {
    // display, not visibility: the nav's 500 ms `transition-all` would keep it visible for the shot.
    document.querySelector("header")?.style.setProperty("display", "none");
    document.querySelector(".intro-overlay")?.style.setProperty("display", "none");
    const stage = document.querySelector("#home .sticky");
    for (const el of stage ? [...stage.children] : []) {
      if (!el.classList.contains("hero-scene")) el.style.visibility = "hidden";
    }
  });
  await page.waitForTimeout(300);
  const png = await page.screenshot({ type: "png" });
  await sharp(png).webp({ quality: 80 }).toFile("public/images/hero-poster.webp");
  console.log("Hero poster written: public/images/hero-poster.webp");
} finally {
  await browser.close();
}
```

- [ ] **Step 4: Re-capture the poster from the Task 8 preview**

The preview on 8787 still serves the Task 8 build, which already has the final look. Run:
`bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run node scripts/capture-hero-poster.mjs http://127.0.0.1:8787`
Expected: `Hero poster written: public/images/hero-poster.webp`. Open the file: the shader globe on the right, lit from the front-left, with clouds and the blue rim, galaxy and stars behind; no header, no copy. (It is rendered by SwiftShader, so the controller compares its colours with the real GPU below.)

- [ ] **Step 5: Show the poster on the desktop static hero**

Edit 1 of 3 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
// Desktop, motion allowed, not on a data-saver connection → upgrade to the cinematic.
const QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
// Everyone else keeps the static hero, whose galaxy backdrop is the mobile LCP.
const STATIC_QUERY = `not all and ${QUERY}`;
```

with:

```tsx
// Desktop, motion allowed, not on a data-saver connection → upgrade to the cinematic.
const QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
// The static hero's backdrop: the globe poster on desktops (reduced motion, no JS, Save-Data and
// first paint), the galaxy on phones and tablets.
const DESKTOP = "(min-width: 1024px)";
const MOBILE = "(max-width: 1023.98px)";
const POSTER = "/images/hero-poster.webp";
const GALAXY = "/images/galaxy.webp";
```

Edit 2 of 3 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
  // Mobile / reduced motion / no JS / first paint: the static cosmic hero (no three.js fetched
  // until a phone or tablet qualifies for the 1k globe).
  // Until hydration, eligible desktops reserve the cinematic's 300vh (.hero-reserve in
  // globals.css) so deep links and reloads land where they will stay.
  if (!cinematic) {
    // Hero images go first in <head>, one per visitor: the cinematic's poster (high priority) on the
    // desktops that will show it, the galaxy everywhere else. The galaxy <img> below reuses this
    // media-scoped preload instead of React's automatic one, which every desktop fetched first.
    preload("/images/hero-poster.webp", { as: "image", media: QUERY, fetchPriority: "high" });
    preload("/images/galaxy.webp", { as: "image", media: STATIC_QUERY });
    return (
      <section id="home" className={hydrated ? "relative" : "hero-reserve relative"}>
        <div className="relative overflow-hidden">
          <div className="hero-backdrop pointer-events-none absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/galaxy.webp" alt="" aria-hidden width={3840} height={1629} className="h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/35 to-bg" />
            <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_75%_0%,rgba(250,110,67,0.18),rgba(22,23,25,0)_60%)]" />
          </div>
          <Starfield className="opacity-50" />
```

with:

```tsx
  // Mobile / reduced motion / no JS / Save-Data / first paint: the static hero (no three.js fetched
  // until a phone or tablet qualifies for the 1k globe). Until hydration, eligible desktops reserve
  // the cinematic's 300vh (.hero-reserve in globals.css) so deep links and reloads land where they will stay.
  if (!cinematic) {
    // Hero images go first in <head>, one per visitor, matching the <picture> source each one shows.
    preload(POSTER, { as: "image", media: DESKTOP, fetchPriority: "high" });
    preload(GALAXY, { as: "image", media: MOBILE });
    return (
      <section id="home" className={hydrated ? "relative" : "hero-reserve relative"}>
        <div className="relative overflow-hidden">
          {/* desktop: the poster covers the first screen exactly like the cinematic's sticky stage */}
          <div className="hero-backdrop pointer-events-none absolute inset-0 lg:bottom-auto lg:h-screen">
            <picture>
              <source media={DESKTOP} srcSet={POSTER} width={1440} height={900} />
              <img src={GALAXY} alt="" aria-hidden width={3840} height={1629} className="h-full w-full object-cover opacity-70 lg:opacity-100" />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/35 to-bg lg:hidden" />
            <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_75%_0%,rgba(250,110,67,0.18),rgba(22,23,25,0)_60%)] lg:hidden" />
          </div>
          <Starfield className="opacity-50 lg:hidden" />
```

Edit 3 of 3 in `src/components/sections/OrbitalCinematic.tsx`. Replace:

```tsx
          <img src="/images/hero-poster.webp" alt="" width={1440} height={900} className="h-full w-full object-cover" />
```

with:

```tsx
          <img src={POSTER} alt="" width={1440} height={900} className="h-full w-full object-cover" />
```

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 7: Heavy gates**

Run, one after the other:
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild` — expected: `Export valid: …` (the `<source srcset>` poster reference is checked as shipped), `preview up on :8787`.
2. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787` — expected: `SEO crawl passed: …`.
3. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787` — expected: `Browser checks passed: 6 profiles; …`, with `Save-Data desktop keeps the static poster, without the intro or any globe download` and `failed WebGL retains headline, poster and CTA, without errors or any globe download`; the deep-link check (`#pricing`) and CLS gate still pass.

- [ ] **Step 8: Commit**

```bash
git add scripts/capture-hero-poster.mjs public/images/hero-poster.webp src/components/sections/OrbitalCinematic.tsx scripts/browser-check.mjs
git commit -m "feat: re-capture the hero poster from the shader globe and use it for desktop fallbacks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check (1422×745):**
- Reload (repeat view, no intro): the poster appears first and the live globe fades in over it with no jump in position, size or brightness. If the SwiftShader poster's colours differ visibly from the real GPU render, the controller may instead take the poster in the owner's Chrome at 1440×900 with the header and copy hidden (the same steps as the script) and save it as WebP quality 80.
- Rendering → `prefers-reduced-motion: reduce`, reload: the poster is the hero backdrop, the copy sits on the left and stays legible, the statement follows below on the page background, no animation.
- Disable JavaScript, reload: the same poster hero.
- Phone presets: still the galaxy backdrop (plus the 1k globe from Task 8 when motion is allowed).


---

### Task 10: Remove the GLB, Draco and the old optimiser

Nothing has requested the GLB or the Draco decoder since Task 3. Delete them and the script that built the GLB, stop shipping them, and make `check-export` fail if a `.glb` or a `draco/` file ever reaches `dist/` again. `public/models/earth-4k.glb` stays (it is the committed source copy; `check-export` already excludes it from `dist/`). The CSP is unchanged.

**Files:**
- Delete: `public/models/earth-hq.glb`, `public/draco/draco_decoder.js`, `public/draco/draco_decoder.wasm`, `public/draco/draco_wasm_wrapper.js`, `scripts/opt-globe.mjs`
- Modify: `scripts/check-export.mjs`, `scripts/package-site.mjs`, `scripts/prepare-assets.mjs`, `eslint.config.mjs`
- Test: `scripts/check-export.mjs` (run on `dist/`)

- [ ] **Step 1: Write the failing export check**

Edit 1 of 5 in `scripts/check-export.mjs`. Replace:

```js
|vercel\.svg|next\.svg/.test(relative))errors.push(
```

with:

```js
|vercel\.svg|next\.svg|\.glb$|(?:^|\/)draco\//.test(relative))errors.push(
```

Edit 2 of 5 in `scripts/check-export.mjs`. Replace:

```js
const localAsset=/(?:src|href|poster)="(\/(?:images|models|draco|seo)\/
```

with:

```js
const localAsset=/(?:src|href|poster)="(\/(?:images|textures|seo)\/
```

Edit 3 of 5 in `scripts/check-export.mjs`. Replace:

```js
if(/^\/(?:images|models|draco|seo)\//.test(url))await need(url,from);
```

with:

```js
if(/^\/(?:images|textures|seo)\//.test(url))await need(url,from);
```

Edit 4 of 5 in `scripts/check-export.mjs`. Replace:

```js
// Assets referenced only from JS chunks (the globe texture tiers, section art) and the Draco decoder files must ship too.
const chunkAsset=/"(\/(?:images|models|textures)\/[A-Za-z0-9_./-]+\.(?:glb|webp|png|jpe?g|svg|avif))"/g;
```

with:

```js
// Assets referenced only from JS chunks (the globe texture tiers, section art) must ship too. No GLB or Draco
// decoder ships at all (the "Excluded" check above).
const chunkAsset=/"(\/(?:images|textures)\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|svg|avif))"/g;
```

Edit 5 of 5 in `scripts/check-export.mjs`. Replace:

```js
for(const file of ["draco/draco_decoder.wasm","draco/draco_wasm_wrapper.js","draco/draco_decoder.js"])await fs.access(path.join(root,file)).catch(()=>errors.push(`Missing Draco decoder file: ${file}`));
```

with nothing (delete these lines).

- [ ] **Step 2: Run it on the current package and see it fail**

Run: `node scripts/check-export.mjs`
Expected: exit code 1 and these four lines (in any order):

```
Excluded source/template asset: draco/draco_decoder.js
Excluded source/template asset: draco/draco_decoder.wasm
Excluded source/template asset: draco/draco_wasm_wrapper.js
Excluded source/template asset: models/earth-hq.glb
```

- [ ] **Step 3: Delete the GLB, the decoder and the optimiser**

Run: `git rm public/models/earth-hq.glb public/draco/draco_decoder.js public/draco/draco_decoder.wasm public/draco/draco_wasm_wrapper.js scripts/opt-globe.mjs`
Expected: five `rm '…'` lines.

- [ ] **Step 4: Stop shipping them**

Edit 1 of 1 in `scripts/package-site.mjs`. Replace:

```js
"images/faq-team.webp","models/earth-hq.glb","seo/og.png","draco/draco_decoder.wasm","draco/draco_wasm_wrapper.js","draco/draco_decoder.js",...globeTextures];
```

with:

```js
"images/faq-team.webp","seo/og.png",...globeTextures];
```

- [ ] **Step 5: Stop recreating the decoder and drop its lint ignore**

Edit 1 of 3 in `scripts/prepare-assets.mjs`. Replace:

```js
import path from "node:path";
```

with nothing (delete these lines).

Edit 2 of 3 in `scripts/prepare-assets.mjs`. Replace:

```js
await fs.mkdir("public/draco", { recursive: true });
for (const file of ["draco_wasm_wrapper.js", "draco_decoder.wasm", "draco_decoder.js"]) {
  await fs.copyFile(path.join("node_modules/three/examples/jsm/libs/draco/gltf",file),path.join("public/draco",file));
}
```

with nothing (delete these lines).

Edit 3 of 3 in `scripts/prepare-assets.mjs`. Replace:

```js
console.log("Prepared the globe source, local decoders and spacegear.tech identity assets.");
```

with:

```js
console.log("Prepared the globe source and spacegear.tech identity assets.");
```

Edit 1 of 1 in `eslint.config.mjs`. Replace:

```js
    "public/draco/**",
```

with nothing (delete these lines).

- [ ] **Step 6: Confirm nothing else refers to them**

Run: `git grep -n -i -e "draco" -e "earth-hq" -e "useGLTF" -e "opt-globe" -- src scripts tests package.json eslint.config.mjs`
Expected: only the forbid checks, i.e. five lines in `scripts/browser-check.mjs` (the "No GLB or Draco" comment and assertion, and the regexes of the fallback and Save-Data pages) and two in `scripts/check-export.mjs` (the `Excluded` pattern and the chunk-scan comment). No match in `src/`.

- [ ] **Step 7: Clear the stale copies from the local package**

Preview packaging never deletes files from `dist/`, so the old copies would stay and fail the new check. Stop the preview (Wrangler holds `dist/` open on Windows), delete them, and let the rebuild restart it:
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 stop` — expected: `preview :8787 stopped`.
2. `rm -rf "E:/Personal/clone website/spacegear/dist/models" "E:/Personal/clone website/spacegear/dist/draco"` (`dist/` is untracked build output).

- [ ] **Step 8: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 9: Heavy gates**

Run, one after the other:
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild` — expected: `Export valid: 12 core pages, …` (now about 6 MiB smaller than before Task 3) and `preview up on :8787`.
2. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787` — expected: `SEO crawl passed: …`.
3. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787` — expected: `Browser checks passed: 6 profiles; …`.

- [ ] **Step 10: Commit**

```bash
git add scripts/check-export.mjs scripts/package-site.mjs scripts/prepare-assets.mjs eslint.config.mjs
git commit -m "chore: remove the GLB globe, the Draco decoder and the old optimiser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(The five deletions are already staged by `git rm`.)

**Real-GPU check:** load the home page with DevTools Network open: no `.glb` and no `/draco/` request; the globe, intro and fallbacks behave as after Task 9.


---

### Task 11: Final gates, measurements and docs

Close Part 1: confirm every gate on the final code, measure what the browser actually downloads, run the full real-GPU pass and record the results and any tuning in the docs.

**Files:**
- Modify: `README.md`, `docs/operations/implementation-status.md`, `docs/superpowers/plans/2026-10-21-showcase-part1-globe.md` (this file)

- [ ] **Step 1: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass, including the 6 texture, 12 logic and 8 material tests.

- [ ] **Step 2: Heavy gates on the final code**

Task 10 ran them on the final code. Run them again only if any commit after Task 10 touched `src/`, `scripts/` or `public/` (for example a `LOOK` tweak from a real-GPU check):
1. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 rebuild`
2. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787`
3. `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787`
Expected: `Export valid: …`, `SEO crawl passed: …`, `Browser checks passed: 6 profiles; …`.

- [ ] **Step 3: Layout guard (only when the controller has started the reference server)**

`check:fidelity` needs the original site on port 3101, which is usually stopped for memory. Run it only if the controller says so:
`bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear" 8787 run npm run check:fidelity -- http://127.0.0.1:3101 http://127.0.0.1:8787`
Expected: every home section within tolerance. Part 1 changes no section height: the cinematic is still 300vh, the static hero keeps `min-h-[90svh]`, and the word masks keep the headline's line boxes. Any difference is a regression to fix, not a tolerance to add.

- [ ] **Step 4: Measure**

Run: `node --import tsx -e "import('./src/components/globe/texture-manifest.ts').then(({ GLOBE_TEXTURES }) => { for (const [tier, maps] of Object.entries(GLOBE_TEXTURES)) console.log(tier, Object.values(maps).reduce((sum, entry) => sum + entry.bytes, 0)); })"`
Expected: `1k 195130`, `2k 685498`, `4k 2182436` (different only if the controller re-encoded a tier; then use the printed values).

Run: `node -e "const r = require('./artifacts/browser-report.json'); for (const p of r.profiles) console.log(p.name, 'bytes', p.resourceBytes, 'js', p.jsBytes, 'textures', p.textures, 'cls', p.cls, 'lcp', Math.round(p.lcp || 0), 'longTasks', p.longTasks)"`
Expected: six lines; `desktop` shows `textures` ≥ 5 (the five 2k maps), the phone profiles show five 1k maps (or 0 if a phone fell back to the galaxy), `reduced-motion` and `no-javascript` show 0. Desktop `bytes` should be roughly 2 MB, down from the 7.94 MB recorded before this part: the 6.3 MB GLB and the Draco decoder are replaced by the 0.69 MB 2k set (the galaxy and poster were already loaded).

- [ ] **Step 5: Real-GPU pass (controller)**

In the owner's Chrome at 1422×745, in a new tab: intro, opening beat, drag and tilt, scroll through the sun sweep to the statement beat and the curtain, then a reload (no intro, 4k after idle). Run the frame-pacing and long-task snippets. Note: fps at the opening and centred beats, the worst frame, any long task over 100 ms, and whether the 4k swap happened. Repeat the phone check from Task 8 in the device toolbar.

- [ ] **Step 6: Document the rebuild steps**

In `README.md`, replace:

```md
## Content and release
```

with:

```md
## Hero globe

The home hero renders the Earth with a custom three.js shader from texture tiers in `public/textures/earth/` (1k for phones and tablets, 2k for the desktop first frame, 4k streamed after idle on capable GPUs). Rebuild them from the preserved model with `node scripts/build-globe-textures.mjs`. It reads `assets/source/earth-4k.glb` (or `public/models/earth-4k.glb` when the local copy is absent) and rewrites `src/components/globe/texture-manifest.ts`. Look-and-feel tunables live in `src/components/globe/constants.ts` and `LOOK` in `src/components/globe/materials.ts`. After a visual change, re-capture the desktop poster with the preview running: `node scripts/capture-hero-poster.mjs http://127.0.0.1:8787`.

## Content and release
```

- [ ] **Step 7: Record the results**

Append this section to the end of `docs/operations/implementation-status.md`, writing in the numbers printed in Step 4 and observed in Step 5 where the table says so:

```md
## Showcase Part 1: globe and hero (feat/spacegear-showcase)

- The hero globe is a procedural sphere with custom GLSL (day/night terminator, brand-orange twilight, warm city lights, ocean glint, relief, cloud shell with shadows, fresnel atmosphere), ACES Filmic at exposure 1.2 with sRGB output. The GLB, the Draco decoder and `scripts/opt-globe.mjs` are gone; `check-export` fails if a GLB or Draco file ships.
- Texture tiers from `scripts/build-globe-textures.mjs` (WebP): 1k 189,692 B, 2k 660,662 B, 4k 2,182,272 B. The desktop first frame adds the existing 305,952 B galaxy. The previous desktop globe download was 6,320,916 B (GLB) plus the Draco decoder.
- The source model's cloud alpha is inverted (opaque where the sky is clear); the old material drew it as a dark film, which caused the blotchy look.
- First-visit intro (desktop only, once per tab session), skipped for reduced motion, no JavaScript, Save-Data, deep links and repeat views; it reveals at most 2.5 s after the globe is ready and at most 4 s after first paint.
- Devices: desktop 2k then 4k after idle (hardware GPU, ≥ 8 GB or unknown memory); phones and tablets a 1k globe when WebGL2, ≥ 4 GB or unknown memory and no Save-Data; otherwise the galaxy. Reduced motion, no JavaScript, Save-Data and missing WebGL2 on desktop show the re-captured poster.

| Measurement (local, unthrottled) | Value |
|---|---|
| Desktop resource bytes (browser-report `desktop.bytes`) | from Step 4 |
| Phone resource bytes (`mobile-390.bytes`) | from Step 4 |
| CLS, all profiles (max) | from Step 4 |
| Owner GPU (GTX 1660 Ti, 1440p): fps at the opening and centred beats, worst frame | from Step 5 |
| Long tasks over 100 ms after the intro | from Step 5 |
| 4k swap observed | from Step 5 |
```

(Replace each "from Step 4" or "from Step 5" cell with the measured value; these are measurements, not design inputs.)

- [ ] **Step 8: Record the execution in this plan**

At the top of this file, directly under the header block, add a section `## Amendments made during execution` that lists, one bullet each: every value changed from this plan during the real-GPU checks (for example `LOOK.cityGain 3.75 → 4.2`), any step that had to differ from the plan and why, and the measured table from Step 7.

- [ ] **Step 9: Commit**

```bash
git add README.md docs/operations/implementation-status.md docs/superpowers/plans/2026-10-21-showcase-part1-globe.md
git commit -m "docs: record the globe rebuild, its budgets and how to regenerate it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Real-GPU check:** Step 5 is the final pass for Part 1. The owner reviews before Part 2 starts; nothing is merged, pushed or deployed.

---

## Open questions for the owner

1. **CSP tightening.** `connect-src blob:` and `worker-src 'self' blob:` were added for the GLB's embedded textures and Draco workers. Nothing needs them after Part 1. They stay because the brief says to keep the CSP; removing them would be a one-line change to `public/_headers` once the owner agrees.
2. **Phone hero weight.** The 1k set is 185 KiB, inside the 450 KiB budget, but phones also load the 299 KiB galaxy as their LCP image, so the phone hero downloads about 484 KiB in total. A smaller phone galaxy would be a separate change.
3. **Poster capture.** The poster is captured in headless Chromium (SwiftShader). If its colours differ visibly from the real GPU, Task 9 allows a manual capture in the owner's Chrome.
4. **4k gating.** `deviceMemory ≥ 8` excludes 4 GB desktops from the 4k set. Chrome caps `deviceMemory` at 8, so every capable desktop qualifies; lower it only if a 4 GB machine renders 4k smoothly.


---

## Self-review (writing-plans checklist)

**Spec coverage (Part 1, guardrails, testing, delivery):**

| Spec requirement | Where |
|---|---|
| Procedural sphere + custom `ShaderMaterial`, maps from `assets/source/earth-4k.glb` | Tasks 1, 3 |
| Texture script, upright day/night/normal/spec/clouds, 1k/2k/4k tiers, measured sizes | Task 1; sizes above |
| Sun light with Lambert and normal relief; soft terminator; `#fa6e43` twilight; night shows only warm, over-bright city lights; ocean Blinn-Phong glint from the spec mask | Task 3 (`EARTH_FRAGMENT`) |
| Cloud shell ≈ 1.01, faster than the surface, sun-lit, fading at night with a moonlit rim, shadows sampled toward the sun | Tasks 3 (shadows), 4 (shell, drift) |
| Back-face additive fresnel atmosphere: blue day, orange terminator, faint night | Task 4 |
| Tone mapping and colour space consistent with the current scene, chosen explicitly | Task 3 (`onCreated`), Key decisions |
| Existing stars and galaxy kept; stars get mouse parallax | Tasks 3, 5 |
| Cursor tilt (spring, ≈ 6°), drag with inertia easing back to idle, not on touch, never blocking scroll | Tasks 2, 5 |
| Three scroll beats kept; sun sweeps with scroll (city lights as the globe centres); slow dolly-in | Tasks 2, 3, 4 |
| Intro: `00→100` from real progress via `THREE.LoadingManager`; globe fades up with a flare; headline rises from masks; once per session; ≈ 2.5 s cap; skipped for reduced motion, no-JS, Save-Data, repeat views; hidden without JS | Tasks 2, 3, 6 |
| Devices: desktop 2k then 4k; phones/tablets 1k under the memory/WebGL2/Save-Data rule, else galaxy; reduced motion or no WebGL2 → re-captured poster | Tasks 2, 7, 8, 9 |
| Budget: ≤ 900 KB first frame, ≤ 2.5 MB 4k, ≤ 450 KB mobile, no GLB/Draco, 60 fps, no long task > 100 ms after the intro, record measurements | Tasks 1, 10, 11 (+ real-GPU snippets) |
| Removals: GLB, Draco files and loaders, `opt-globe.mjs`, GLTF preload; allowlist and `check-export` updated; CSP kept | Tasks 3, 10 |
| Tests: texture-script unit tests; browser-check for non-uniform globe pixels, no CSP violations, intro skips, mobile 1k only, no GLB/Draco, rAF budget, CLS | Tasks 1, 3–9 |
| Guardrails: no `useReducedMotion()` markup branch, hidden-text gate, accessible names, CSP, gates green, real-GPU check per task | Conventions; every task |
| Part 2/3 hook points: `data-cursor="Drag"`, no smooth-scroll assumptions, plain CTAs, `content.ts` untouched | Conventions, Task 5 |

**Placeholder scan:** no "TBD", "TODO", "similar to Task N" or unspecified error handling. The only values left for execution are measurements (Task 11, Steps 4, 5 and 7), which cannot be known before the code runs.

**Type and name consistency:** every code block was produced from one scratchpad mirror and checked there. `tsc` passed for the Task 3, 4, 5, 6, 7 and 8 stages and the final state; ESLint with the repo's config (including the React Compiler rules) passed for the Task 3, 5 and 6 stages and the final state; the 26 unit tests pass against the final code. The edit snippets for `OrbitalCinematic.tsx`, `browser-check.mjs`, `globals.css`, `layout.tsx`, `package-site.mjs`, `check-export.mjs`, `prepare-assets.mjs` and `eslint.config.mjs` were applied mechanically, in task order, to copies of the current files: each "Replace" text matched exactly once, and the chain reproduces the final files. Shared names: `loadHeroTextures`, `loadTextureSet`, `globeEntries`, `releaseSource`, `disposeTextureSet`, `createGlobeMaterials`, `applyGlobeTextures`, `LOOK`, `GlobeFrame`/`createGlobeFrame`, `introStore`/`getIntroPhase`/`getServerIntroPhase`, `runIntroGate`/`introGateScript`/`INTRO_SESSION_KEY`, `chooseHeroMode`, `canStream4k`, `hasWebGL2`, `readDeviceEnv`, `usePointerInput`, `stepSpring`, `stepDrag`, `sunDirectionAt`, `rigAt`, `cameraZAt`.

**Not verifiable before execution:** the GLSL compiles only in a browser (the Task 3 shader-error assertion and pixel check catch failures in headless SwiftShader; the real-GPU checks catch ANGLE/D3D11 differences), and the look constants are first estimates from a CPU re-implementation of the shaders.

## Controller amendments (before execution, 2026-10-21)

- **Owner open questions, resolved by the controller:**
  1. **CSP:** in Task 10, after the GLB and Draco files are gone, remove `blob:` from `connect-src` only. `ade9924` added it for GLTFLoader's embedded textures. Keep `worker-src 'self' blob:` and `img-src … blob:`: the `<img>` decode fallback uses a `blob:` URL, and Turnstile may use workers. `test:browser` must still report no `securitypolicyviolation`.
  2. **Phone hero ≈ 484 KiB** (1k set 185 KiB after the Task 1 review fix, plus the existing galaxy LCP image): accepted.
  3. **4k rule** (`deviceMemory ≥ 8` or unknown, hardware GPU, `maxTextureSize ≥ 4096`, not 2g/3g): accepted.
- **Order:** Part 1 runs in the main worktree (port 8787) while Part 3 runs in `spacegear-cms` (port 8788). Part 3's branch merges after Part 1, then Part 2 runs.
- **Task 1 review fix (6c51552):**
  - The committed `scripts/build-globe-textures.mjs` and `tests/globe-textures.test.mjs` are now the reference. Task 1's code blocks show the pre-review version.
  - The manifest now also exports `GLOBE_TIERS` and `GLOBE_MAPS` as `as const` arrays.
- **Task 2 must derive its lists from the manifest.** Import `GLOBE_MAPS` (and `GLOBE_TIERS` where needed) from `texture-manifest.ts` instead of restating `GLOBE_MAPS: readonly GlobeMapName[]` by hand. Then a new map can never be skipped silently.
- **Task 2 review follow-ups:**
  - `intro-gate.ts` now ships a hand-written ES5 literal (`INTRO_GATE_SCRIPT`). `introGateScript()` still returns it, so Task 6's `IntroGate.tsx` is unchanged.
  - `stepDrag` guards `dt` and caps spin at `MAX_SPIN`.
  - `clamp01` and `slerpDirection` are hardened.
  - Read the committed modules, not Task 2's code blocks.
- **Task 6 must make the intro cap hold before hydration** (found in the Task 2 review):
  1. In `IntroOverlay`, measure `INTRO_LOAD_CAP_MS` from navigation start (`performance.now()`, or the rAF timestamp, both relative to `timeOrigin`), not from the effect's own start. That makes the cap count from first paint, as the spec says.
  2. Add a pure-CSS failsafe, so a JS failure can never leave the page black: `html[data-intro="play"] .intro-overlay { animation: intro-failsafe 0s linear 6s forwards } @keyframes intro-failsafe { to { visibility: hidden; opacity: 0 } }`. It stops applying once the attribute leaves "play".
  3. The gate also skips the intro when `navigator.connection.effectiveType` is slow-2g, 2g or 3g, consistent with `canStream4k`. Add this to the Task 2 literal if it is not there yet.
  4. Task 6's browser check must assert that the overlay is gone within `INTRO_LOAD_CAP_MS` plus the reveal time of navigation start, and that the failsafe hides it when the overlay script never runs. For the second check, block the JS chunks with `page.route` in one test.
- **Task 3 review fixes (look and robustness).** The committed files are the reference.
  - **Glint:** two lobes driven by uniforms. `LOOK.glintExponent`/`glintGain`/`sheenExponent`/`sheenGain` start at 700/0.7/40/0.055.
  - **Sun:** `LOOK.sunIntensity` is 1.3. `SUN_POSITION` is `[-20, 12.5, -26]` with sprite scale 9, so the disc stays out of the hero copy.
  - `INITIAL_SPIN` is +0.45 rad, so the glint shows in the opening frame.
  - The twilight stays visible over the ocean.
  - The polar tangent frame is computed per fragment.
  - The relief Lambert term is gated by the smooth terminator, and the normal decode is unbiased.
  - Shader errors reach the fallback through `gl.debug.onShaderError`.
  - A context loss only counts when the canvas is still connected, so R3F's own unmount is no longer a "failure". The hero scene recovers when it remounts.
  - The loader closes every bitmap: `disposeTextureSet` calls `releaseSource`, and a failed set releases its fulfilled maps and aborts the manager.
  - DPR is capped at 1.75.
- **Later tasks that "Replace the whole of" a file must not drop these fixes.** This covers `EarthScene.tsx` (Tasks 4–7), `materials.ts` and `Globe.tsx` (Task 4), and `Backdrop.tsx` (Task 5).
  - Treat each such block as the target behaviour for that task's new features. Apply it as edits on top of the committed file and keep every Task 3 review fix listed above.
  - The look constants live in `LOOK`/`constants.ts`; never re-hard-code them in GLSL.
  - Each later task's real-GPU step may tune only `LOOK` and the constants.
- **Task 3's real-GPU check** judges orientation, colour, seams, the glint and the sun position only. The blotch-free look is judged after Task 4, because the cloud-shadow terms need the cloud shell.
- **`HeroScene` (from the Task 3 review fix `242c27e`).** The scene layer moved into a `HeroScene` child of `OrbitalCinematic.tsx` that exists only in the cinematic branch.
  - Any `OrbitalCinematic` edit in Tasks 5–7 that touches the scene layer applies inside `HeroScene`. That covers `sceneRef`, `data-cursor`/`dragTarget`, `fail` and `introStore`, the mount effect, and `tier`/`onTier`.
  - Drop those snippets' `!cinematic ||` guard. Re-read the committed file and apply the intent of each edit.
- **Task 4 carries these Task 3 follow-ups:**
  - `onReady={() => setGlobe((g) => (g === "failed" ? g : "ready"))}`, so a failure is terminal.
  - Make `tests/globe-loader.test.mjs` deterministic: send the 404 only after the `createImageBitmap` stub has seen both blobs.
- **Task 4 review fixes (`8ecfbad`).** The committed files are the reference. They include:
  - limb-lit atmosphere;
  - luminance-weighted twilight with `twilightFloor`;
  - `uCloudHeight`;
  - cloud discard;
  - a rig and camera snap until announced;
  - per-`p` recompute;
  - the uniform-set test.
- **Real-GPU check after Task 4 (GTX 1660 Ti):** the look is approved.
- **Task 5 carries these look and robustness items:**
  - `LOOK.twilight` becomes `#ff8240`, with a comment that the input compensates for ACES so the band renders at the brand hue (#fa6e43 renders as brick red at the band's brightness).
  - `LOOK.cityGain` becomes 4.5.
  - The sun target vector moves into the `scroll` ref.
  - `stepDrag` assigns velocity only when `Number.isFinite`.
  - Add a test that 60 Hz and 144 Hz release velocities agree within about 2 % after a steady drag.
- **Task 9 is high priority.** Until the poster is recaptured, first paint shows the OLD GLB poster: dark, blotchy, with the sun behind the headline.
- **Task 7 rule amended after the Task 8 review (2026-10-22): the 4k stream needs a fine pointer.**
  - **Why:** an iPad in landscape (≥ 1024 px) passed `canStream4k`: an Apple GPU, no `deviceMemory`, no `effectiveType`. It then downloaded the 2.08 MiB 4k set, possibly over cellular, and held about 150 MiB of GPU memory, for little visible gain on a touch screen.
  - **Rule:** `GpuEnv` gains `finePointer`, read in `EarthScene` from `matchMedia("(pointer: fine) and (hover: hover)")`, and `canStream4k` requires it. A tablet in landscape keeps the cinematic hero and its 2k set; it still plays the intro (`INTRO_QUERY` is unchanged).
  - **Checks:** a unit test (a coarse pointer, an iPad in landscape, a Mac with an Apple GPU) and `coarseLandscapeCheck` in `scripts/globe-stream.mjs`: a 1024×768 touch context with the fake GTX and 8 GB shows the cinematic hero, requests no 4k map and keeps the `2k` tier. The capable-desktop scenario asserts its fine pointer as a precondition.
- **Task 8 review (2026-10-22).** The committed files are the reference.
  - **Statement contrast:** over the phone globe the filled statement fell to a WCAG ratio of 1.75–2.96 (10th percentile, worst word). `MobileScene` now dims the globe from `brightness(1)` to `brightness(0.55)` while the statement's first word fills, driven by the statement's own scroll progress (`StaticStage` owns the `useScroll` and passes it to `ScrollFillText`). The words also get a dark halo while the globe is present. `browser-check` requires 4.5:1 for filled words at 320, 390 and 768 px (`scripts/globe-mobile.mjs` `statementContrast`); measured 8.3–9.7.
  - **Mount gating:** the phone globe mounts only after the load event, once the page has been still for `INPUT_QUIET_MS` (500 ms with no touch held or ended, no scroll, counted from load), when the browser is idle and `#home` is on screen. A reload far down the page therefore fetches nothing. Chrome restores that scroll after load, smoothly under `scroll-behavior: smooth`, and a `#hash` link does the same, so the quiet time is what keeps the hero from counting as on screen at load. Slow connections (`effectiveType` slow-2g, 2g, 3g) keep the galaxy; `chooseHeroMode` takes `effectiveType` and lives in the leaf module `hero-mode.ts`, so the first-load chunk no longer carries the globe's constants or texture manifest.
  - **One load per scene:** `EarthScene` keeps a scene's pending first load until a scene commits with it. A first render retried before commit (state updates during a scroll) refetched the 1k set five times for one canvas.
  - **4k gate:** see the Task 7 amendment above (a fine pointer is required).
  - **Long-task allowance for the first 4k upload:** 120 ms, not the 150 ms the review proposed. Clean runs measure 49–75 ms; a first upload made 120 ms slower measured 144–151 ms, which 150 ms let through in 2 of 3 runs.
  - **Task 11 budget:** the phone hero transfers about 722 KB: the 238 KB (gzip) scene chunk, the 1k set (189,692 B) and the galaxy (305,952 B), not only the 1k set.
  - **For the owner's GPU check:** the globe's night disc averages about RGB 7 against the page's about 23, so on a phone it can read as a black hole; judge it on a real screen.
