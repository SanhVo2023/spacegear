# Spacegear Fidelity Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make spacegear.tech look and move like the original `platform-clone` site, section for section, with honest Spacegear content. Keep every piece of Codex's infrastructure that does not affect appearance.

**Architecture:** Restore the original components from the preserved snapshot commit `c249c4d` with markup and class names unchanged. Feed them typed copy from `src/lib/content.ts`. Re-apply the accessibility, no-JS and performance fixes as invisible changes. Codex's semantic CSS lives on in a low-priority `legacy.css` layer until no markup uses it. A screenshot harness compares every section against the running original.

**Tech Stack:** Next.js 16.2.7 (static export), React 19, Tailwind CSS 4, Motion 12, three.js / React Three Fiber / Drei, Cloudflare Workers Static Assets + D1 + Turnstile, Playwright (Chromium), node:test + tsx, sharp.

**Spec:** `docs/superpowers/specs/2026-10-20-spacegear-fidelity-design.md` (read it first; it lists the approved content and the deliberate deviations).

---

## Conventions for every task

- **Working directory:** `E:\Personal\clone website\spacegear` (Git worktree, branch `feat/spacegear-fidelity`). Use Git Bash. Never edit files in `E:\Personal\clone website\platform-clone`: it is the reference.
- **Restoring an original file:** `git checkout c249c4d -- <path>`. Commit `c249c4d` ("preserve audited website source") holds the original platform-clone source byte for byte.
- **Next.js 16:** `AGENTS.md` warns that APIs differ from older versions. The patterns in this plan already compile in this repo. If you add anything else Next-specific, read the matching guide in `node_modules/next/dist/docs/` first.
- **Reference server (original site),** started once and left running in the background:
  ```bash
  cd "/e/Personal/clone website/platform-clone" && npx next start -p 3101 -H 127.0.0.1
  ```
  It serves the existing production build in `platform-clone/.next`. If that folder is missing, run `npm run build` there first; this writes only to `.next`.
- **Candidate server (this branch):**
  ```bash
  npm run build:cf
  XDG_CONFIG_HOME="$PWD/.wrangler/config" WRANGLER_LOG_PATH="$PWD/artifacts/wrangler-preview.log" npm run preview:cf   # background, port 8787
  ```
  On Windows, **stop the preview before running `build:cf` again**: Wrangler holds files in `dist/` and packaging fails while it runs.
- **Browser:** if Playwright cannot find Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium/Chrome, as Codex did, or run `npx playwright install chromium`.
- **Static checks** (fast): `npm run lint && npm run typecheck && npm test`.
- **Browser gates** (preview on :8787 running): `npm run check:seo` and `npm run test:browser`.
- **Fidelity gate** (both servers running): `npm run check:fidelity`. It writes side-by-side sheets to `artifacts/fidelity/<desktop|mobile>/<section>.jpg`. After any visual task, **open the sheets for the sections you touched and compare them by eye.** A passing height ratio is necessary, not sufficient.
- **Commits:** one per task (or per step where marked). End every commit message with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## File map

| File | Responsibility | Task |
|---|---|---|
| `scripts/fidelity-compare.mjs` (new) | Section-by-section screenshots of original vs candidate, height-ratio gate, side-by-side sheets | 2 |
| `scripts/opt-globe.mjs` (rewrite) | Build `public/models/earth-hq.glb`: full-res surface maps, 2048 px clouds | 3 |
| `scripts/prepare-assets.mjs` (edit) | Stop shrinking product art; wordmark favicon/OG | 3, 5 |
| `scripts/package-site.mjs` (edit) | Asset allowlist for the Cloudflare package | 3, 10, 16, 21 |
| `scripts/prune-legacy-css.mjs` (new) | Remove Codex CSS rules by selector as components are replaced | 6 |
| `src/lib/content.ts` (extend) | All copy and data for every section, typed | 4 |
| `tests/content.test.mjs` (new) | Honesty and shape rules for content | 4 |
| `src/lib/samples.ts` (new) | Dev-only sample data for Testimonials/Labs | 18 |
| `src/lib/quickstart.ts` (new) | sessionStorage key shared by footer form and contact form | 19 |
| `src/components/Brand.tsx` (rewrite) | `space—gear™` nav wordmark | 5 |
| `src/app/globals.css` (rewrite) | Original stylesheet + "Spacegear additions" | 6 |
| `src/app/legacy.css` (new, temporary) | Codex CSS inside `@layer components`; deleted in Task 21 | 6, 21 |
| `src/components/{motion,Reveal,ScrollColorTitle,StackCards,SnapRow,CurtainShell,ui,DotField,Starfield}.tsx` | Restored original primitives (+ no-JS/reduced-motion hooks) | 7 |
| `src/components/MotionProvider.tsx`, `NoScriptStyles.tsx` (new) | `MotionConfig reducedMotion="user"`; no-JS end-state CSS | 7 |
| `src/app/layout.tsx`, `src/app/page.tsx` | Shell (Nav + CurtainShell + Footer) and home composition | 8, 14, 17, 18 |
| `src/components/Nav.tsx` | Original nav, `<details>` mobile menu, keyboard dropdown | 9 |
| `src/components/sections/OrbitalCinematic.tsx`, `src/components/EarthScene.tsx` | Original hero choreography + Codex runtime guards + poster | 10 |
| `scripts/capture-hero-poster.mjs` (new) | Render the desktop globe still to `public/images/hero-poster.webp` | 10 |
| `src/components/sections/{Work,Services,Process,Analytics,Pricing,Faq,Team,Testimonials,Labs,Footer}.tsx` | Restored sections fed by content | 11–19 |
| `src/components/QuickStart.tsx` (new) | Footer "start with one challenge" form | 19 |
| `src/components/ContactForm.tsx` (edit) | Pre-fill from quick start | 19 |
| `src/components/PageIntro.tsx`, `src/app/**/page.tsx`, `src/app/not-found.tsx` | Inner pages in the original vocabulary | 20 |
| `scripts/browser-check.mjs`, `scripts/check-export.mjs`, `scripts/check-content.mjs` (edit) | New guards | 7, 16, 19, 20, 21 |

---

### Task 1: Baseline

**Files:** none changed.

- [ ] **Step 1: Confirm branch and clean tree**

Run: `git status --short && git branch --show-current && git log --oneline -1`
Expected: no changes; `feat/spacegear-fidelity`. HEAD is the spec commit on top of `a489cc6`.

- [ ] **Step 2: Confirm Codex's gates are green before touching anything**

Run: `npm run lint && npm run typecheck && npm test`
Expected: lint and both type checks print no errors; `npm test` ends with `# pass 15` and `# fail 0`.

- [ ] **Step 3: Build and start both servers**

Run the reference and candidate commands from *Conventions*. Then:
`curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3101/ http://127.0.0.1:8787/`
Expected: `200` twice.

- [ ] **Step 4: Confirm browser and SEO gates pass on the untouched branch**

Run: `npm run check:seo && npm run test:browser`
Expected: `SEO crawl passed: 12 pages…` and `Browser checks passed: 6 profiles…`. If a gate fails here, stop and report: the failure predates this plan.

---

### Task 2: Fidelity harness (the failing test for the whole plan)

**Files:**
- Create: `scripts/fidelity-compare.mjs`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the harness**

Create `scripts/fidelity-compare.mjs`:

```js
// Section-by-section visual comparison against the original platform-clone build.
// Usage: node scripts/fidelity-compare.mjs [originalBase] [candidateBase]
// Writes artifacts/fidelity/<profile>/<section>.jpg (original left, candidate right)
// and artifacts/fidelity/report.json. Exits 1 when a required section is missing
// or its height drifts more than the tolerance from the original.
import fs from "node:fs/promises";
import sharp from "sharp";
import { launchBrowser } from "./browser-runtime.mjs";

const originalBase = process.argv[2] || "http://127.0.0.1:3101";
const candidateBase = process.argv[3] || "http://127.0.0.1:8787";
const TOLERANCE = 0.15;
// Spacegear has five services where the original had four product columns.
const TOLERANCE_OVERRIDES = { "mobile:services": 0.3 };
const REQUIRED = ["home", "work", "services", "process", "analytics", "pricing", "faq", "team", "contact"];
// Rendered only once real, permission-confirmed entries exist.
const OPTIONAL = ["testimonials", "labs"];
const PROFILES = [
  { name: "desktop", width: 1440, height: 900, tile: 720 },
  { name: "mobile", width: 390, height: 844, tile: 390 },
];
const MAX_SCREENS = 3;

async function capture(browser, base, profile) {
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  // Walk the page once so in-view animations, count-ups and lazy images settle.
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 400) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  const shots = {};
  for (const id of [...REQUIRED, ...OPTIONAL]) {
    const box = await page.evaluate((sid) => {
      const el = document.getElementById(sid);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top + window.scrollY), height: Math.round(r.height) };
    }, id);
    if (!box) continue;
    const frames = [];
    const shoot = async (y, settle) => {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(settle);
      frames.push(await page.screenshot({ type: "png" }));
    };
    if (id === "home") {
      // The desktop hero is a pinned scroll sequence: sample its opening, zoom and statement beats.
      const travel = Math.max(0, box.height - profile.height);
      for (const p of travel > profile.height ? [0, 0.4, 0.85] : [0]) await shoot(Math.round(box.top + travel * p), 1200);
    } else if (id === "contact") {
      // The footer may be pinned behind the page (curtain), so read it at the very bottom.
      await shoot(total, 900);
    } else {
      const screens = Math.min(MAX_SCREENS, Math.ceil(box.height / profile.height));
      for (let s = 0; s < screens; s++) await shoot(box.top + s * profile.height, 900);
    }
    shots[id] = { ...box, frames };
  }
  await context.close();
  return shots;
}

async function stack(frames, width) {
  const parts = await Promise.all(frames.map((f) => sharp(f).resize({ width }).png().toBuffer({ resolveWithObject: true })));
  const height = parts.reduce((sum, p) => sum + p.info.height, 0);
  let top = 0;
  const layers = parts.map((p) => { const layer = { input: p.data, left: 0, top }; top += p.info.height; return layer; });
  const buffer = await sharp({ create: { width, height, channels: 3, background: "#000000" } }).composite(layers).png().toBuffer();
  return { buffer, height };
}

async function sideBySide(left, right, width, file) {
  const gap = 16;
  const height = Math.max(left.height, right.height);
  await sharp({ create: { width: width * 2 + gap, height, channels: 3, background: "#ff00ff" } })
    .composite([{ input: left.buffer, left: 0, top: 0 }, { input: right.buffer, left: width + gap, top: 0 }])
    .jpeg({ quality: 78 })
    .toFile(file);
}

const browser = await launchBrowser();
const report = { testedAt: new Date().toISOString(), originalBase, candidateBase, tolerance: TOLERANCE, results: [] };
let failed = false;
try {
  for (const profile of PROFILES) {
    const dir = `artifacts/fidelity/${profile.name}`;
    await fs.mkdir(dir, { recursive: true });
    const original = await capture(browser, originalBase, profile);
    const candidate = await capture(browser, candidateBase, profile);
    for (const id of [...REQUIRED, ...OPTIONAL]) {
      const o = original[id];
      const c = candidate[id];
      if (!c) {
        const ok = OPTIONAL.includes(id);
        if (!ok) failed = true;
        report.results.push({ profile: profile.name, section: id, ok, reason: ok ? "optional, not rendered" : "missing in candidate" });
        continue;
      }
      if (!o) { report.results.push({ profile: profile.name, section: id, ok: true, reason: "not in original" }); continue; }
      const ratio = c.height / o.height;
      const tolerance = TOLERANCE_OVERRIDES[`${profile.name}:${id}`] ?? TOLERANCE;
      const ok = Math.abs(1 - ratio) <= tolerance;
      if (!ok) failed = true;
      report.results.push({ profile: profile.name, section: id, ok, originalHeight: o.height, candidateHeight: c.height, ratio: Number(ratio.toFixed(3)) });
      await sideBySide(await stack(o.frames, profile.tile), await stack(c.frames, profile.tile), profile.tile, `${dir}/${id}.jpg`);
    }
  }
  await fs.writeFile("artifacts/fidelity/report.json", JSON.stringify(report, null, 2));
  for (const r of report.results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.profile.padEnd(8)} ${r.section.padEnd(13)} ${r.ratio ?? ""} ${r.reason ?? ""}`);
  if (failed) { console.error("Fidelity check failed. Review artifacts/fidelity/<profile>/<section>.jpg"); process.exitCode = 1; }
  else console.log("Fidelity check passed. Review every sheet in artifacts/fidelity/ before signing off.");
} finally {
  await browser.close();
}
```

- [ ] **Step 2: Register the script**

In `package.json` `"scripts"`, add after `"test:browser"`:

```json
    "check:fidelity": "node scripts/fidelity-compare.mjs"
```

(Add the comma on the preceding line.)

- [ ] **Step 3: Run it against Codex's build to see it fail**

Run (both servers up): `npm run check:fidelity`
Expected: exit code 1. Lines `FAIL desktop analytics … missing in candidate` and `FAIL desktop team … missing in candidate`, the same for mobile. Several height ratios fall well outside ±0.15. Open `artifacts/fidelity/desktop/work.jpg`: the left (original) bento is clearly different from the right (three cards).

- [ ] **Step 4: Commit**

```bash
git add scripts/fidelity-compare.mjs package.json
git commit -m "test: add section-by-section fidelity harness against the original site"
```

---

### Task 3: Restore full-quality art and globe

**Files:**
- Restore: `public/images/suite/*.webp` (from `c249c4d`)
- Rewrite: `scripts/opt-globe.mjs`
- Create: `public/models/earth-hq.glb` (generated)
- Modify: `scripts/prepare-assets.mjs`, `scripts/package-site.mjs`

- [ ] **Step 1: Restore the original product renders (1200 px, not Codex's 768 px re-encodes)**

```bash
git checkout c249c4d -- public/images/suite/
node --input-type=module -e 'import sharp from "sharp"; for (const n of ["design-engine","scale-matrix","neural-net","shield-core","neural-core"]) { const m = await sharp(`public/images/suite/${n}.webp`).metadata(); console.log(n, m.width + "x" + m.height); }'
```
Expected: every image prints width `1200` (for example `neural-core 1200x670`).

- [ ] **Step 2: Stop `prepare-assets.mjs` from shrinking them again**

In `scripts/prepare-assets.mjs`, delete these lines:

```js
for (const name of ["design-engine", "scale-matrix", "neural-net", "shield-core", "neural-core"]) {
  const file = `public/images/suite/${name}.webp`;
  const input = await fs.readFile(file);
  await sharp(input).resize({ width:768, withoutEnlargement:true }).webp({quality:74}).toFile(file);
}
```

- [ ] **Step 3: Rewrite the globe optimizer**

Replace the whole of `scripts/opt-globe.mjs` with:

```js
// Builds public/models/earth-hq.glb from the preserved 4K source model.
// The Earth surface maps (base colour, night lights, normal, roughness) keep
// their full 4096×2048 resolution — they carry the detail you see. Only the
// cloud shell's two textures are resized to 2048 px; they hold ~90% of the bytes.
// Usage: node scripts/opt-globe.mjs   (reads assets/source/earth-4k.glb)
import fs from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "assets/source/earth-4k.glb";
const TARGET = "public/models/earth-hq.glb";
const CLOUD_MATERIAL = "Material_62"; // cloud shell: base colour (with alpha) + emissive
const CLOUD_WIDTH = 2048;

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
```

- [ ] **Step 4: Generate the model**

Run:
```bash
test -f assets/source/earth-4k.glb || { mkdir -p assets/source && cp public/models/earth-4k.glb assets/source/earth-4k.glb; }
node scripts/opt-globe.mjs
```
Expected output (sizes ±5%):
```
cloud texture 4: 7260492 → 1945474 bytes
cloud texture 5: 1991192 → 599474 bytes
Globe: 10372724 → 3664xxx bytes (public/models/earth-hq.glb).
```

- [ ] **Step 5: Add the new assets to the Cloudflare package allowlist**

In `scripts/package-site.mjs`, in the `const assets=[...]` array, add `"images/galaxy.webp"` and `"models/earth-hq.glb"`. Insert them after `"images/galaxy-small.webp"` and after `"models/earth-optimized.glb"` respectively. Leave the old entries; Task 21 removes them.

- [ ] **Step 6: Verify the package**

Run: `npm run build:cf`
Expected: ends with `Export valid: 12 core pages…`. Then `ls -la dist/models dist/images/galaxy.webp` lists `earth-hq.glb` (~3.6 MB) and `galaxy.webp` (305,952 bytes).

- [ ] **Step 7: Commit**

```bash
git add public/images/suite scripts/opt-globe.mjs scripts/prepare-assets.mjs scripts/package-site.mjs public/models/earth-hq.glb
git commit -m "feat: restore full-resolution product art and a 4K-surface globe"
```

---

### Task 4: Content model and honesty rules (TDD)

**Files:**
- Create: `tests/content.test.mjs`
- Modify: `src/lib/content.ts` (replace `ENGAGEMENTS` and `FAQS`, append new exports)

- [ ] **Step 1: Write the failing test**

Create `tests/content.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

const content = await import("../src/lib/content.ts");

const PUBLIC_KEYS = ["HOME", "SECTIONS", "WORK", "PILLARS", "CORE_PANEL", "PROCESS_STEPS", "PROCESS_CTA", "APPROACH_STEPS", "MEASURE", "ENGAGEMENTS", "ENGAGEMENTS_FOOTER", "FAQS", "FAQ_CARD", "TEAM", "TEAM_ROLES", "FOUNDER", "TESTIMONIALS", "ARTICLES", "FOOTER", "SERVICES"];
const FORBIDDEN = [
  [/\$\s?\d/, "a price"],
  [/97\.8|31\.2|84\.7/, "an original platform metric"],
  [/TechCrunch|\bAWS\b/, "an unverified press or partnership claim"],
  [/Enterprise Clients|Active Users|Deployments|API Calls/i, "an unverified scale claim"],
  [/Platform®|Platform B\.V\.|Platform Labs|plat—form/, "the old brand"],
  [/Book a Demo/i, "the old call to action"],
  [/®/, "a registered-trademark sign (use ™ until the mark is registered)"],
  [/Amsterdam|New York|Dubai|Keizersgracht/, "an office location"],
  [/\b\d+(?:\.\d+)?\s?[MKB]\+/, "a scale figure"],
];

test("every public content export exists", () => {
  for (const key of PUBLIC_KEYS) assert.ok(key in content, `${key} is exported`);
});

test("public content makes no unverified claims", () => {
  const text = JSON.stringify(PUBLIC_KEYS.map((key) => content[key]));
  for (const [pattern, what] of FORBIDDEN) assert.doesNotMatch(text, pattern, `content contains ${what}`);
});

test("hero copy keeps the original four-line headline rhythm", () => {
  const { HOME } = content;
  assert.equal(HOME.headline.verbs.length, 3);
  assert.ok(HOME.headline.verbs.every((verb) => verb.length <= 6), "hero verbs must stay short");
  assert.equal(HOME.stats.length, 2);
  assert.equal(HOME.cta.label, "Discuss a project");
  assert.ok(HOME.pitch.text.length <= 48, "pitch line fits on one line like the original");
});

test("every section header has a title, a three-digit index, a heading and a description", () => {
  for (const [id, copy] of Object.entries(content.SECTIONS)) {
    for (const field of ["title", "index", "heading", "description"]) assert.ok(copy[field], `${id}.${field}`);
    assert.match(copy.index, /^\d{3}$/, `${id}.index`);
  }
});

test("illustrative measures are labelled as such", () => {
  assert.equal(content.MEASURE.illustrative, true);
  assert.match(content.SECTIONS.analytics.description, /illustrative/i);
  assert.match(content.SECTIONS.analytics.description, /not client results/i);
});

test("work tiles and service pillars point at real service pages", () => {
  const slugs = new Set(content.SERVICES.map((service) => service.slug));
  assert.equal(content.WORK.tiles.length, 4);
  for (const tile of content.WORK.tiles) assert.ok(slugs.has(tile.slug), tile.slug);
  assert.deepEqual(content.PILLARS.map((pillar) => pillar.slug).sort(), [...slugs].sort(), "one pillar per service");
});

test("process steps count real outputs instead of invented timings", () => {
  for (const step of [...content.PROCESS_STEPS, ...content.APPROACH_STEPS]) {
    assert.ok(step.outputs.length >= 1, step.step);
    assert.equal("metric" in step, false, `${step.step} has no timing metric`);
  }
});

test("engagements carry no prices and exactly one starting point", () => {
  for (const engagement of content.ENGAGEMENTS) {
    assert.equal("price" in engagement, false, engagement.name);
    assert.ok(engagement.deliverables.length >= 3 && engagement.outcomes.length >= 3, engagement.name);
  }
  assert.equal(content.ENGAGEMENTS.filter((engagement) => engagement.featured).length, 1);
});

test("the team section shows roles, not invented people", () => {
  for (const role of content.TEAM_ROLES) {
    assert.doesNotMatch(role.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/, `${role.name} looks like a person's name`);
    assert.doesNotMatch(role.img, /images\/team\//, "role cards must not use the stock portraits");
  }
});

test("testimonials and articles only hold publishable entries", () => {
  for (const item of content.TESTIMONIALS) {
    assert.equal(item.permissionConfirmed, true);
    assert.ok(item.name && item.company && item.quote && item.img);
    assert.doesNotMatch(item.img, /images\/reviews\//, "use the client's own approved photo");
  }
  for (const article of content.ARTICLES) {
    assert.ok(article.href && article.title && article.author);
    assert.doesNotMatch(article.img, /images\/labs\//, "use the article's own image");
  }
});

test("sample preview data is not part of public content", () => {
  for (const key of Object.keys(content)) assert.doesNotMatch(key, /SAMPLE/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test tests/content.test.mjs`
Expected: FAIL. `every public content export exists` reports `HOME is exported` as false, and the other tests throw on missing exports.

- [ ] **Step 3: Replace `ENGAGEMENTS` in `src/lib/content.ts`**

Replace the whole `export const ENGAGEMENTS = [ … ];` statement with:

```ts
export type Engagement = {
  name: string; short: string; label: string; description: string; img: string;
  stage: string; stageNo: string; deliverables: string[]; outcomes: string[]; featured: boolean;
};
export const ENGAGEMENTS: Engagement[] = [
  {
    name: "Assess & prioritize", short: "Assess", label: "Find the right starting point",
    description: "A Transformation Opportunity Assessment turns one business challenge into a clear set of options and a practical next step.",
    img: "/images/suite/design-engine.webp", stage: "Direction", stageNo: "01",
    deliverables: ["Current workflow and opportunity map", "Data and integration requirements", "Success criteria", "Recommended first pilot"],
    outcomes: ["A shared view of the problem", "Clear, agreed priorities", "Known data gaps", "A practical first step"],
    featured: true,
  },
  {
    name: "Validate & build", short: "Build", label: "Make it work",
    description: "Test the important assumptions, then design and deliver a solution around the way your business operates.",
    img: "/images/suite/shield-core.webp", stage: "Delivery", stageNo: "02",
    deliverables: ["Prototype and evaluation criteria", "Integrated, tested implementation", "Rollout plan", "Handover documentation"],
    outcomes: ["Evidence before larger investment", "A solution that fits the workflow", "Fewer manual handoffs", "A team ready to use it"],
    featured: false,
  },
  {
    name: "Embed & improve", short: "Improve", label: "Put it into daily use",
    description: "Support adoption, understand what happens in practice and improve the system as needs evolve.",
    img: "/images/suite/scale-matrix.webp", stage: "Adoption", stageNo: "03",
    deliverables: ["Adoption and operating guidance", "Performance and exception review", "Prioritized improvements", "Ongoing delivery support"],
    outcomes: ["Steady day-to-day use", "Fewer exceptions over time", "Visible performance", "A clear improvement backlog"],
    featured: false,
  },
];
export const ENGAGEMENTS_FOOTER = { text: "Not sure where to start? Tell us what you want to improve", href: "/contact/" };
```

(The existing `Pricing.tsx` keeps compiling: `name`, `label`, `description`, `deliverables` and `featured` are unchanged.)

- [ ] **Step 4: Replace `FAQS`**

Replace the whole `export const FAQS = [ … ];` statement with:

```ts
export const FAQS = [
  { question: "What does spacegear.tech do?", answer: "We help organizations change how work gets done: deciding where digital change and AI will help, building the systems, and supporting your team as they put them to use." },
  { question: "Where do we start?", answer: "Tell us what you would like to improve. If the next step is unclear, an Opportunity Assessment can map the workflow, identify options and recommend a first initiative. If you already have a brief, we can discuss delivery directly." },
  { question: "Do you work with our existing systems?", answer: "Yes. We start by understanding what is already in place. The right answer may be to improve a process, connect tools or extend a system, rather than replace everything." },
  { question: "Do we need our data ready before talking?", answer: "No. Understanding data quality, access and readiness can be part of the first engagement. You can start with the business problem." },
  { question: "How are AI solutions evaluated?", answer: "We agree what useful performance means, compare against a baseline and test relevant examples and exceptions. Human review and operating limits are designed around the use case." },
  { question: "How are scope and pricing agreed?", answer: "We discuss the objectives, constraints and deliverables first, then agree the scope and commercial terms. There are no software subscription tiers or fixed packages on this site." },
  { question: "Can you help after the first release?", answer: "Continuing improvement can include adoption, monitoring, exception review and further delivery. The level of support and responsibilities are agreed for the engagement." },
  { question: "Who do you work with?", answer: "Organizations of any size, industry or region. What matters is a real challenge you want to improve, not a sector or company-size requirement." },
];
```

- [ ] **Step 5: Append the section content**

Append to the end of `src/lib/content.ts`:

```ts
// ---------------------------------------------------------------------------
// Section content shaped to the original platform-clone layouts.
// Honesty rules (tests/content.test.mjs): no invented clients, staff, prices,
// timelines, offices, press or results. Illustrative figures are labelled
// where they render. See docs/superpowers/specs/2026-10-20-spacegear-fidelity-design.md.
// ---------------------------------------------------------------------------

export function serviceBySlug(slug: string): Service {
  const service = SERVICES.find((item) => item.slug === slug);
  if (!service) throw new Error(`Unknown service: ${slug}`);
  return service;
}

export type Stat = { value: string; unit: string; label: string; sub: string };
export const HOME = {
  eyebrow: { muted: "You bring the challenge,", strong: "we build the system." },
  headline: { lead: "The smarter way to", verbs: ["plan", "build", "scale"], tail: "your business." },
  pitch: { title: "Start with one challenge", text: "Tell us what you want to improve." },
  cta: { label: "Discuss a project", href: "/contact/" },
  stats: [
    { value: "05", unit: "", label: "Core services", sub: "From strategy to delivery" },
    { value: "03", unit: "", label: "Delivery stages", sub: "Direction to daily use" },
  ] as Stat[],
  corner: { title: "Applied AI & Deep Learning", sub: "// Featured service", href: "/services/applied-ai/" },
  scrollHint: "Scroll to explore ↓",
  statement: "We turn business challenges into working digital systems your team can use.",
};

export type SectionCopy = { title: string; index: string; heading: string; description: string };
export const SECTIONS = {
  work: { title: "What We Do", index: "001", heading: "Strategy and delivery under one roof, built to help you move faster with less friction.", description: "Every engagement starts with a real problem and ends with something your team can use." },
  services: { title: "Our Services", index: "002", heading: "Flexible services for modernizing operations and putting AI to work.", description: "Five capabilities that work on their own or together." },
  process: { title: "Our Process", index: "003", heading: "A clear path from the first conversation to daily use.", description: "Every stage produces something you can review and use." },
  analytics: { title: "What We Measure", index: "004", heading: "Know whether a change is working, with evidence you can act on.", description: "An illustrative example of the measures we agree before building — not client results." },
  pricing: { title: "Engagements", index: "005", heading: "Clear ways to work together. Scoped around your objectives.", description: "Start with one challenge or a defined project. Scope and terms are agreed before work begins." },
  faq: { title: "Questions & Answers", index: "006", heading: "Simple explanations to help you decide where to start.", description: "You don’t need every answer before starting a conversation." },
  team: { title: "Who You Work With", index: "007", heading: "The disciplines behind the work. Strategists, engineers and problem-solvers.", description: "You work directly with the people doing the thinking and the building." },
  testimonials: { title: "What Our Clients Say", index: "008", heading: "Stories from organizations we have worked with.", description: "Published with each client’s permission." },
  labs: { title: "Spacegear Labs", index: "009", heading: "Practical notes on transformation, AI and the systems behind everyday work.", description: "Explainers and field notes from our work." },
} satisfies Record<string, SectionCopy>;

export type WorkTile = { slug: string; name: string; img: string; desc: string; href: string };
function workTile(slug: string, name: string, img: string, desc: string): WorkTile {
  serviceBySlug(slug);
  return { slug, name, img, desc, href: `/services/${slug}/` };
}
export const WORK = {
  featured: { label: "Featured Service", name: "Applied AI", img: "/images/suite/neural-core.webp", href: "/services/applied-ai/" },
  lineup: {
    label: "Service Lineup", count: "5/5", title: "Strategy and Delivery Under One Roof",
    text: "Digital transformation, AI strategy, applied AI, automation and product delivery, connected from the first decision to daily use.",
    footer: "From direction to daily use",
  },
  tiles: [
    workTile("digital-transformation", "Digital Transformation", "/images/suite/design-engine.webp", "Find the friction, set priorities and plan a practical path forward."),
    workTile("automation-integration", "Automation & Integration", "/images/suite/scale-matrix.webp", "Connect your tools and remove repeated manual work."),
    workTile("ai-strategy", "AI Strategy", "/images/suite/neural-net.webp", "Decide where AI can help, what it needs and how to begin."),
    workTile("product-delivery", "Product Delivery", "/images/suite/shield-core.webp", "Carry an idea from discovery to software people use."),
  ],
  assessment: {
    title: "Opportunity Assessment", badge: "01/03", note: "The recommended first step.", chip: "Engagement stage",
    value: "01", unit: "/03", progress: 33.3, cta: "Start with an assessment", href: "/contact/",
  },
};

export type Pillar = { no: string; slug: string; name: string; tag: string; glyph: string; img: string; desc: string };
export const PILLARS: Pillar[] = [
  { no: "01", slug: "digital-transformation", name: "Digital Transformation", tag: "direction", glyph: "≈", img: "/images/suite/design-engine.webp", desc: serviceBySlug("digital-transformation").summary },
  { no: "02", slug: "ai-strategy", name: "AI Strategy", tag: "readiness", glyph: "◇", img: "/images/suite/neural-core.webp", desc: serviceBySlug("ai-strategy").summary },
  { no: "03", slug: "applied-ai", name: "Applied AI", tag: "intelligence", glyph: "◈", img: "/images/suite/neural-net.webp", desc: serviceBySlug("applied-ai").summary },
  { no: "04", slug: "automation-integration", name: "Automation", tag: "connection", glyph: "△", img: "/images/suite/scale-matrix.webp", desc: serviceBySlug("automation-integration").summary },
  { no: "05", slug: "product-delivery", name: "Product Delivery", tag: "delivery", glyph: "⬡", img: "/images/suite/shield-core.webp", desc: serviceBySlug("product-delivery").summary },
];
export const CORE_PANEL = {
  label: "Core Services", count: "5/5", title: "Modular, flexible services for modern digital operations",
  text: "We help you modernize how work gets done and put AI to practical use. spacegear.tech’s core capabilities include:",
  line: "Plan, build, connect and improve.", cta: "Explore Services in Depth", href: "/services/",
};

export type ProcessStep = { step: string; name?: string; desc: string; outputs: string[] };
export const PROCESS_STEPS: ProcessStep[] = [
  { step: "Step 1", name: "Assess", desc: "We map the current workflow, systems, constraints and people involved, and agree the problem before choosing a solution.", outputs: ["Current-state map", "Problem definition"] },
  { step: "Step 2", name: "Prioritize", desc: "We compare opportunities by value, feasibility and dependencies, then agree a baseline and what success means.", outputs: ["Opportunity shortlist", "Success criteria", "Roadmap"] },
  { step: "Step 3", name: "Build", desc: "We test the riskiest assumptions first, then design and engineer in reviewable increments around the real workflow.", outputs: ["Evaluated prototype", "Tested implementation"] },
  { step: "Step 4", name: "Adopt", desc: "We support rollout and handover, document how the system runs, and agree how to measure and improve it.", outputs: ["Rollout plan", "Operating guide", "Improvement backlog"] },
];
export const PROCESS_CTA = { title: "Want to see how this applies to your work?", text: "Questions about our process? We’re happy to talk it through.", cta: "Discuss a project", href: "/contact/" };
export const APPROACH_STEPS: ProcessStep[] = [
  { step: "Stage 1", name: "Assess", desc: "Understand the work. Map the current workflow, systems, constraints and people involved. Agree the problem before choosing a solution.", outputs: ["Current-state map", "Problem definition"] },
  { step: "Stage 2", name: "Prioritize", desc: "Choose a useful next step. Compare opportunities by value, feasibility and dependencies. Agree a baseline and what success would mean.", outputs: ["Opportunity shortlist", "Delivery roadmap"] },
  { step: "Stage 3", name: "Validate", desc: "Test the important assumptions with a prototype or a focused pilot, compare results with a baseline and decide what deserves further investment.", outputs: ["Evaluation evidence", "Go/no-go decision"] },
  { step: "Stage 4", name: "Deliver", desc: "Build around the real workflow. Design and engineer in reviewable increments, and test integrations, exceptions and the user experience before rollout.", outputs: ["Tested implementation", "Rollout plan"] },
  { step: "Stage 5", name: "Adopt", desc: "Prepare for everyday use. Document operation and ownership, support the handover and agree how to measure and improve the system.", outputs: ["Operating guidance", "Improvement backlog"] },
];

// Illustrative dashboard: the kind of measures agreed for a document workflow.
// Rendered under SECTIONS.analytics, whose description says "not client results".
export const MEASURE = {
  illustrative: true,
  imageCard: { img: "/images/suite/shield-core.webp", accent: "Illustrative", label: "Example" },
  workflow: {
    title: "Document Workflow", sub: "Sample run · illustrative", center: "62%",
    segments: [
      { label: "Auto-processed", value: 62, color: "#fa6e43" },
      { label: "Human review", value: 29, color: "#888891" },
      { label: "Exceptions", value: 9, color: "#434346" },
    ],
  },
  stages: [
    { name: "Intake", note: "Step 01", status: "Automated", detail: "12m → 2m", hands: [300, 65] },
    { name: "Extraction", note: "Step 02", status: "Assisted", detail: "9m → 3m", hands: [210, 150] },
    { name: "Review", note: "Step 03", status: "Human-led", detail: "Kept in control", hands: [120, 20] },
  ],
  stagesFooter: "Time per case · illustrative",
  accuracy: { label: "Accuracy vs. baseline", value: "94.6", unit: "%", sub: "Example target" },
  throughput: { title: "Cases Handled", sub: "Assisted vs. manual", legend: [{ value: "+68%", label: "Assisted" }, { value: "Base", label: "Manual" }] },
  readiness: {
    title: "Rollout Readiness", sub: "Where a pilot might stand", score: "82", scoreLabel: "Readiness score",
    bars: [{ label: "Data", v: 38 }, { label: "Integration", v: 79 }, { label: "Review", v: 92 }, { label: "Training", v: 84 }, { label: "Monitoring", v: 96 }],
  },
  coverage: { tag: "Evaluation set", value: "99.1%", label: "Test-case coverage", progress: 99.1 },
  connectors: { tag: "Connects with your stack", glyphs: ["◇", "◎", "△", "⬡"] },
  ticker: ["Workflow mapping", "Data readiness review", "AI evaluation", "Human-in-the-loop review", "Systems integration", "Rollout & training", "Monitoring & improvement", "Product delivery"],
  cta: { label: "See how we evaluate AI", href: "/services/applied-ai/" },
};

export const FAQ_CARD = {
  title: "You still have questions?",
  text: "Every organization’s situation is different. Tell us what you’re working on and we’ll suggest a sensible next step. No finished brief required.",
  cta: "Let’s have a chat", href: "/contact/",
  img: "/images/faq-team.webp", imgAlt: "People discussing a project around a table",
  badge: "we build the systems · you lead the change ·",
};

export type Person = { name: string; role: string; img: string; imgAlt: string; bio: string; links: { label: string; href: string }[] };
// Add the founder's real name, photo (public/images/people/), role, bio and
// profile links here when the owner supplies them; the card then leads the carousel.
export const FOUNDER: Person | null = null;
export const TEAM = { label: "How we work with you", cta: { label: "More about how we work", href: "/about/" } };
export const TEAM_ROLES: Person[] = [
  { name: "Strategy & Discovery", role: "Direction", img: "/images/suite/design-engine.webp", imgAlt: "", links: [], bio: "We start with how work actually happens, mapping workflows, systems and constraints so the first recommendation is grounded in your reality." },
  { name: "AI & Data Engineering", role: "Applied AI", img: "/images/suite/neural-net.webp", imgAlt: "", links: [], bio: "We evaluate AI against simpler alternatives, build with a measurable baseline and design the points where a person stays in control." },
  { name: "Product & Delivery", role: "Build", img: "/images/suite/shield-core.webp", imgAlt: "", links: [], bio: "We turn decisions into working software in reviewable increments, with explicit scope, acceptance criteria and a rollout plan." },
  { name: "Integration & Automation", role: "Connect", img: "/images/suite/scale-matrix.webp", imgAlt: "", links: [], bio: "We connect the tools you already use and remove repeated manual work, keeping exceptions visible and handoffs clear." },
  { name: "Adoption & Support", role: "Improve", img: "/images/suite/neural-core.webp", imgAlt: "", links: [], bio: "We prepare the handover, support everyday use and keep improving the system as your needs change." },
];

// Render only real, permission-confirmed quotes and published articles.
export type Testimonial = { img: string; name: string; role: string; company: string; quote: string; permissionConfirmed: true };
export const TESTIMONIALS: Testimonial[] = [];
export type Article = { slug: string; author: string; title: string; sub: string; img: string; href: string };
export const ARTICLES: Article[] = [];

export type FooterLink = { label: string; href: string };
export const FOOTER = {
  badge: "we build the systems · you lead the change ·",
  tagline: "The smarter way to plan, build and scale your business.",
  identity: ["Digital transformation", "& AI consulting"],
  identityStrong: "spacegear.tech",
  columns: [
    [
      { label: "Home", href: "/" }, { label: "What We Do", href: "/#work" }, { label: "Services", href: "/services/" },
      { label: "Process", href: "/#process" }, { label: "What We Measure", href: "/#analytics" }, { label: "Engagements", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" }, { label: "Who You Work With", href: "/#team" },
    ],
    [
      { label: "Approach", href: "/approach/" }, { label: "About", href: "/about/" }, { label: "Contact", href: "/contact/" },
      { label: "Applied AI", href: "/services/applied-ai/" }, { label: "Automation", href: "/services/automation-integration/" },
      { label: "Product Delivery", href: "/services/product-delivery/" }, { label: "Privacy", href: "/privacy/" }, { label: "Terms", href: "/terms/" },
    ],
  ] as FooterLink[][],
  quickStart: { title: "Start with one challenge", text: "Leave your name and email and we’ll take you to a short brief.", note: "We only use these details to respond to you." },
  about: "helps organizations turn business challenges into working digital systems.",
};
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --import tsx --test tests/content.test.mjs`
Expected: `# pass 11`, `# fail 0`.

- [ ] **Step 7: Run the full static suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: lint and types clean; `# pass 26`, `# fail 0` (Codex's 15 + 11 new).

- [ ] **Step 8: Commit**

```bash
git add src/lib/content.ts tests/content.test.mjs
git commit -m "feat: model honest Spacegear content for every original section"
```

---

### Task 5: Wordmark and identity assets

**Files:**
- Rewrite: `src/components/Brand.tsx`
- Modify: `scripts/prepare-assets.mjs` (icon + OG SVG strings)
- Regenerate: `public/icon.svg`, `public/apple-icon.png`, `src/app/favicon.ico`, `public/seo/og.png`

- [ ] **Step 1: Replace the brand component**

Replace `src/components/Brand.tsx` with:

```tsx
/** The space—gear wordmark, styled exactly like the original plat—form mark.
 *  ™ (not ®) until the mark is registered. */
export default function Brand() {
  return (
    <span className="text-[19px] font-medium tracking-tight text-flame">
      space<span className="text-ink">—</span>gear
      <sup className="ml-0.5 text-[9px] text-mut-3">™</sup>
    </span>
  );
}
```

(Codex's `Nav.tsx` and `Footer.tsx` call `<Brand />` with no props, so they keep compiling until they are replaced.)

- [ ] **Step 2: Switch favicon and social card from the planet logo to the wordmark**

In `scripts/prepare-assets.mjs`, replace the line that starts `const icon = \`<svg` with:

```js
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#161719"/><text x="40" y="88" text-anchor="middle" fill="#fa6e43" font-family="Arial,sans-serif" font-size="76" font-weight="600">s</text><rect x="66" y="62" width="40" height="9" rx="2" fill="#e3dbd8"/></svg>`;
```

Then replace the line that starts `const og = \`<svg` with:

```js
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#161719"/><defs><radialGradient id="g" cx="0.78" cy="0.42" r="0.5"><stop offset="0" stop-color="#fa6e43" stop-opacity=".35"/><stop offset="1" stop-color="#161719" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="960" cy="270" r="26" fill="#fa6e43"/><circle cx="960" cy="270" r="92" fill="none" stroke="#5f5f66" stroke-dasharray="3 9"/><text x="70" y="120" fill="#fa6e43" font-family="Arial,sans-serif" font-size="44" font-weight="600">space<tspan fill="#e3dbd8">—</tspan>gear</text><text x="70" y="270" fill="#eee7e3" font-family="Arial,sans-serif" font-size="66">The smarter way to</text><text x="70" y="350" fill="#eee7e3" font-family="Arial,sans-serif" font-size="66"><tspan fill="#fa6e43">plan</tspan>, <tspan fill="#fa6e43">build</tspan> and <tspan fill="#fa6e43">scale</tspan>.</text><text x="70" y="460" fill="#c0b9bc" font-family="Arial,sans-serif" font-size="26">Digital transformation &amp; AI consulting · spacegear.tech</text><path d="M70 535H1130" stroke="#2a2b2e"/></svg>`;
```

- [ ] **Step 3: Regenerate identity assets**

Run: `node scripts/prepare-assets.mjs`
Expected: `Prepared responsive art, local decoders and spacegear.tech identity assets.` Open `public/seo/og.png` and `public/apple-icon.png` to confirm the wordmark renders. `git status` shows only the icon/og/favicon files changed (plus `galaxy-small.webp`, which can be re-encoded byte-for-byte differently; include it).

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck`. Expected: clean.

```bash
git add src/components/Brand.tsx scripts/prepare-assets.mjs public/icon.svg public/apple-icon.png public/seo/og.png src/app/favicon.ico public/images/galaxy-small.webp
git commit -m "feat: adopt the space—gear wordmark for nav, favicon and social card"
```

---

### Task 6: Stylesheets — original first, Codex CSS demoted

**Files:**
- Create: `src/app/legacy.css`, `scripts/prune-legacy-css.mjs`
- Rewrite: `src/app/globals.css`
- Modify: `src/app/layout.tsx` (import `legacy.css`)

- [ ] **Step 1: Move Codex's CSS into a low-priority layer**

Codex's own rules begin at the line `/* spacegear.tech — keep the original charcoal, orbital imagery and orange. */` in `src/app/globals.css`. Run:

```bash
node --input-type=module -e '
import fs from "node:fs";
const css = fs.readFileSync("src/app/globals.css", "utf8");
const marker = "/* spacegear.tech — keep the original charcoal, orbital imagery and orange. */";
const at = css.indexOf(marker);
if (at < 0) throw new Error("marker not found");
const legacy = "/* Codex semantic CSS, kept only while its markup remains. Inside @layer components\n   so Tailwind utilities on restored components always win. Deleted in Task 21. */\n@layer components {\n" + css.slice(at) + "\n}\n";
fs.writeFileSync("src/app/legacy.css", legacy);
console.log("legacy.css lines:", legacy.split("\n").length);'
```
Expected: `legacy.css lines:` followed by a number around 330.

- [ ] **Step 2: Restore the original stylesheet and add the Spacegear block**

```bash
git checkout c249c4d -- src/app/globals.css
```

In the restored file, change `--font-mono: var(--font-mono), monospace;` to `--font-mono: var(--font-code), monospace;`. The local font in `layout.tsx` exposes `--font-code`, and the original line referred to itself. Then append to the end of `src/app/globals.css`:

```css
/* ------------------------------------------------------------------ */
/* Spacegear additions (fidelity rebuild). Everything above is the     */
/* original platform-clone stylesheet, unchanged except --font-mono.   */
/* ------------------------------------------------------------------ */

:root {
  interpolate-size: allow-keywords;
}

/* Keyboard focus stays visible everywhere. */
:focus-visible {
  outline: 2px solid #fa6e43;
  outline-offset: 3px;
  border-radius: 6px;
}

.skip-link {
  position: fixed;
  z-index: 100;
  top: 12px;
  left: 16px;
  padding: 12px 20px;
  border-radius: 12px;
  background: #fa6e43;
  color: #161719;
  font-size: 13px;
  font-weight: 500;
  transform: translateY(-160%);
  transition: transform 0.2s;
}
.skip-link:focus {
  transform: none;
}

/* Ambient loops as CSS: no JavaScript frames, paused for reduced motion. */
@keyframes dotPulse {
  0%, 100% { opacity: 0.18; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.25); }
}
.dot-pulse { opacity: 0.18; animation: dotPulse 2.6s ease-in-out infinite; }
@keyframes tilePulse {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}
.tile-pulse { animation: tilePulse 2.2s ease-in-out infinite; }
@keyframes spinSlow { to { transform: rotate(360deg); } }
.spin-16 { animation: spinSlow 16s linear infinite; }
.spin-18 { animation: spinSlow 18s linear infinite; }
.spin-26 { animation: spinSlow 26s linear infinite; }

/* FAQ: native <details> with the original open/close motion. */
.faq-item::details-content {
  block-size: 0;
  overflow: hidden;
  transition: block-size 0.3s ease, content-visibility 0.3s allow-discrete;
}
.faq-item[open]::details-content { block-size: auto; }
.faq-item > summary::-webkit-details-marker,
.mobile-menu > summary::-webkit-details-marker { display: none; }

@media (prefers-reduced-motion: reduce) {
  .dot-pulse, .tile-pulse, .spin-16, .spin-18, .spin-26, .marquee-track, .pulse-dot { animation: none; }
  .dot-pulse { opacity: 0.6; }
  .faq-item::details-content { transition: none; }
  html { scroll-behavior: auto; }
}

/* Contact form (logic in ContactForm.tsx) in the original input style. */
.contact-form { position: relative; border: 1px solid #2a2b2e; border-radius: 16px; background: rgba(29, 30, 33, 0.5); padding: 28px; }
.form-row { display: grid; gap: 0 12px; }
@media (min-width: 640px) { .form-row { grid-template-columns: 1fr 1fr; } }
.field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; font-size: 13px; color: #e3dbd8; }
.field label span { font-size: 12px; color: #888891; }
.field input, .field select, .field textarea { width: 100%; border: 1px solid #2a2b2e; border-radius: 12px; background: rgba(33, 34, 37, 0.6); padding: 14px 16px; font-size: 14px; color: #e3dbd8; }
.field input::placeholder, .field textarea::placeholder { color: #888891; }
.field input:focus, .field select:focus, .field textarea:focus { border-color: #fa6e43; outline: none; }
.field textarea { min-height: 160px; resize: vertical; }
.field-error { font-size: 12px; color: #ffaf92; }
.form-note { margin: 16px 0; font-size: 12px; color: #888891; }
.form-note a { color: #fa6e43; }
.form-note a:hover { text-decoration: underline; }
.form-feedback { margin-bottom: 16px; border: 1px solid rgba(250, 110, 67, 0.4); border-radius: 12px; background: rgba(250, 110, 67, 0.06); padding: 14px 16px; font-size: 13px; color: #e3dbd8; }
.contact-form .button { display: inline-flex; align-items: center; gap: 8px; border-radius: 12px; background: #fa6e43; padding: 14px 20px; font-size: 13px; font-weight: 500; color: #161719; transition: filter 0.3s, box-shadow 0.3s; }
.contact-form .button:hover:not(:disabled) { filter: brightness(1.1); box-shadow: 0 10px 30px -8px rgba(250, 110, 67, 0.6); }
.contact-form .button:disabled { cursor: not-allowed; opacity: 0.55; }
.honeypot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

/* Privacy and terms text inside the original card style. */
.prose-card section + section { margin-top: 40px; }
.prose-card h2 { font-size: 24px; font-weight: 500; letter-spacing: -0.04em; line-height: 1.1; color: #e3dbd8; }
.prose-card p { margin-top: 12px; font-size: 14px; line-height: 1.7; color: #888891; }
.prose-card a { color: #fa6e43; text-decoration: underline; text-underline-offset: 4px; }
.prose-card .policy-preview { margin: 0 0 32px; border: 1px solid rgba(250, 110, 67, 0.4); border-radius: 12px; background: rgba(250, 110, 67, 0.05); padding: 16px 18px; font-size: 13px; color: #e3dbd8; }
```

- [ ] **Step 3: Write the legacy pruning helper**

Create `scripts/prune-legacy-css.mjs`:

```js
// Removes single-line rules from src/app/legacy.css as Codex markup is replaced.
// Arguments starting with "." match any rule whose selector contains that text
// (".hero-" removes .hero-copy, .orbital-hero .hero-stage, …). Arguments
// starting with "=" match a whole selector exactly ("=body", "=h1,h2,h3").
// Usage: node scripts/prune-legacy-css.mjs .site-header .nav-shell "=h2"
import fs from "node:fs/promises";

const file = "src/app/legacy.css";
const targets = process.argv.slice(2);
if (!targets.length) throw new Error("Pass at least one selector target.");
const squash = (text) => text.replace(/\s+/g, "");
const matches = (selector) => targets.some((target) =>
  target.startsWith("=") ? squash(selector) === squash(target.slice(1)) : selector.includes(target));

const kept = [];
const removed = [];
for (const line of (await fs.readFile(file, "utf8")).split("\n")) {
  const rule = line.match(/^\s*([^{}@]+?)\s*\{[^{}]*\}\s*$/);
  if (rule && matches(rule[1])) removed.push(line.trim());
  else kept.push(line);
}
await fs.writeFile(file, kept.join("\n"));
console.log(`Removed ${removed.length} rule(s) from ${file}:\n${removed.join("\n")}`);
```

- [ ] **Step 4: Drop Codex's global element rules (they would restyle every restored heading and paragraph)**

Run:
```bash
node scripts/prune-legacy-css.mjs "=body" "=a" "=button, input, textarea, select" "=a, button, summary, input, textarea, select" "=:focus-visible" "=section, [id]" "=h1,h2,h3,p,figure" "=h1,h2,h3" "=h2" "=summary::-webkit-details-marker"
```
Expected: `Removed 11 rule(s)`, listing `body {…}`, `a {…}`, the two `button…` rules, `:focus-visible {…}`, `section, [id] {…}`, `h1,h2,h3,p,figure {…}`, `h1,h2,h3 {…}`, two `h2 {…}` rules (one inside a media block) and `summary::-webkit-details-marker {…}`.

- [ ] **Step 5: Import the legacy layer**

In `src/app/layout.tsx`, below `import "./globals.css";` add:

```ts
import "./legacy.css";
```

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run typecheck && npm run build:cf`
Expected: clean; `Export valid: 12 core pages…`. Start the preview and open http://127.0.0.1:8787/ to check that Codex's pages still render, with headings back to the original sizes. Small spacing differences are expected; they disappear as each section is replaced.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/app/legacy.css src/app/layout.tsx scripts/prune-legacy-css.mjs
git commit -m "style: restore the original stylesheet and demote Codex CSS to a layer"
```

---

### Task 7: Original motion and UI primitives

**Files:**
- Restore: `src/components/{motion,Reveal,ScrollColorTitle,StackCards,SnapRow,CurtainShell,ui,DotField,Starfield}.tsx`
- Rewrite after restore: `motion.tsx`, `DotField.tsx`, `Starfield.tsx`
- Edit after restore: `ScrollColorTitle.tsx`, `SnapRow.tsx`, `ui.tsx`
- Create: `src/components/MotionProvider.tsx`, `src/components/NoScriptStyles.tsx`
- Modify: `scripts/browser-check.mjs`

- [ ] **Step 1: Restore the originals**

```bash
git checkout c249c4d -- src/components/motion.tsx src/components/Reveal.tsx src/components/ScrollColorTitle.tsx src/components/StackCards.tsx src/components/SnapRow.tsx src/components/CurtainShell.tsx src/components/ui.tsx src/components/DotField.tsx src/components/Starfield.tsx
```

- [ ] **Step 2: Replace `src/components/motion.tsx`** (the original plus reduced-motion, no-JS hooks and shared fill bars)

```tsx
"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "motion/react";
import { useRef, type ReactNode } from "react";

/** Framer's signature appear easing + timing for enter animations. */
const EASE = [0.44, 0, 0.56, 1] as const;
const FILL_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Appear: fade + translateY (+ optional blur), fired once on scroll-in.
 * Mirrors the reference's per-element appear effect. `data-reveal` lets the
 * no-JS stylesheet show the end state; reduced motion renders it directly.
 */
export function Appear({
  children,
  delay = 0,
  y = 40,
  blur = true,
  className = "",
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  blur?: boolean;
  className?: string;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      data-reveal=""
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: blur ? "blur(6px)" : "blur(0px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount: 0.25, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger container — children should be <AppearItem>. */
export function AppearGroup({
  children,
  className = "",
  stagger = 0.09,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function AppearItem({
  children,
  className = "",
  y = 34,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      data-reveal=""
      className={className}
      variants={{
        hidden: { opacity: 0, y, filter: "blur(6px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.75, ease: EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Horizontal progress fill that grows into view (final width without JS or motion). */
export function FillBar({
  value,
  className = "",
  duration = 1.1,
  delay = 0,
}: {
  value: number;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const target = `${value}%`;
  if (reduce) return <div className={className} style={{ width: target }} />;
  return (
    <motion.div
      data-fill=""
      className={className}
      style={{ "--fill": target } as MotionStyle}
      initial={{ width: 0 }}
      whileInView={{ width: target }}
      viewport={{ once: true }}
      transition={{ duration, ease: FILL_EASE, delay }}
    />
  );
}

/** Vertical bar that grows into view (final height without JS or motion). */
export function FillColumn({
  value,
  className = "",
  duration = 0.8,
  delay = 0,
}: {
  value: number;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const target = `${value}%`;
  if (reduce) return <div className={className} style={{ height: target }} />;
  return (
    <motion.div
      data-fill-h=""
      className={className}
      style={{ "--fill": target } as MotionStyle}
      initial={{ height: 0 }}
      whileInView={{ height: target }}
      viewport={{ once: true }}
      transition={{ duration, ease: FILL_EASE, delay }}
    />
  );
}

/** Parallax: translate element on Y as it passes through the viewport. */
export function Parallax({
  children,
  amount = 80,
  className = "",
}: {
  children: ReactNode;
  amount?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

export function useSectionProgress(): [
  React.RefObject<HTMLDivElement | null>,
  MotionValue<number>
] {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  return [ref, scrollYProgress];
}

/**
 * ScrollFillText — the reference's hallmark statement effect.
 * Words illuminate from muted → bright sequentially as the user scrolls
 * through a tall pinned region.
 */
export function ScrollFillText({
  text,
  className = "",
  progress,
  range = [0, 1],
}: {
  text: string;
  className?: string;
  /** When provided, the fill is driven by this external progress instead of an
   *  internal useScroll — lets a parent share one scroll scrubber. */
  progress?: MotionValue<number>;
  /** Sub-window of the external progress over which the fill completes. */
  range?: [number, number];
}) {
  if (progress) {
    return (
      <ScrollFillInner
        text={text}
        className={className}
        progress={progress}
        range={range}
      />
    );
  }
  return <ScrollFillSelf text={text} className={className} />;
}

/** Internal-scroll variant (original behavior) for standalone usage. */
function ScrollFillSelf({ text, className }: { text: string; className: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.4"],
  });
  return (
    <div ref={ref} className={className}>
      <ScrollFillInner text={text} progress={scrollYProgress} range={[0, 1]} />
    </div>
  );
}

/** Renders the words; maps each word's slot INTO the supplied range window. */
function ScrollFillInner({
  text,
  className = "",
  progress,
  range,
}: {
  text: string;
  className?: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const words = text.split(" ");
  const [lo, hi] = range;
  const span = hi - lo;
  return (
    <p
      className={`display text-[clamp(34px,7vw,86px)] leading-[0.98] ${className}`}
    >
      {words.map((word, i) => {
        const start = lo + span * (i / words.length);
        const end = lo + span * ((i + 1) / words.length);
        return (
          <Word key={i} progress={progress} range={[start, end]}>
            {word}
          </Word>
        );
      })}
    </p>
  );
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  const color = useTransform(progress, range, ["#3a3b3e", "#e3dbd8"]);
  return (
    <span className="relative mr-[0.22em] inline-block">
      <motion.span data-scroll-word="" style={{ opacity, color }}>{children}</motion.span>
    </span>
  );
}
```

- [ ] **Step 3: Mark scroll-title words for the no-JS stylesheet**

In `src/components/ScrollColorTitle.tsx`, replace:
```tsx
      <motion.span style={{ color }}>{children}</motion.span>
```
with:
```tsx
      <motion.span data-scroll-word="" style={{ color }}>{children}</motion.span>
```

- [ ] **Step 4: Mark snap carousels (the 320 px text check skips intentionally scrolled cards)**

In `src/components/SnapRow.tsx`, replace:
```tsx
      <div
        ref={ref}
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scroll-padding-left:1.25rem]"
      >
```
with:
```tsx
      <div
        ref={ref}
        data-snap-row=""
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scroll-padding-left:1.25rem]"
      >
```

- [ ] **Step 5: Replace `src/components/DotField.tsx`** (same look; CSS-driven)

```tsx
/**
 * Grid of dots with a diagonal wave that sweeps a bright pulse through the
 * formation — they appear to constantly shift and move. Driven by the
 * `.dot-pulse` keyframes in globals.css, so it costs no JavaScript frames
 * and stops under prefers-reduced-motion.
 */
export default function DotField({
  cols = 5,
  rows = 5,
  color = "#fa6e43",
  className = "",
  dotClassName = "h-1.5 w-1.5",
}: {
  cols?: number;
  rows?: number;
  color?: string;
  className?: string;
  dotClassName?: string;
}) {
  const cells = Array.from({ length: rows * cols }, (_, i) => ({
    r: Math.floor(i / cols),
    c: i % cols,
  }));
  return (
    <div
      aria-hidden
      className={`grid place-items-center gap-y-3 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {cells.map(({ r, c }, i) => (
        <span
          key={i}
          className={`dot-pulse rounded-full ${dotClassName}`}
          style={{
            backgroundColor: color,
            animationDelay: `${((r + c) % (cols + 1)) * 0.22}s`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Replace `src/components/Starfield.tsx`.** Same drift; fixes the reduced-motion loop Codex found (`draw()` always rescheduled itself), pauses offscreen, and drops the unused warp prop that broke lint.

```tsx
"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient particle field that mimics the reference's drifting starfield.
 * Canvas-based and low-cost: one still frame under reduced motion, and no
 * frames at all while the canvas is offscreen.
 */
export default function Starfield({
  density = 0.00018,
  className = "",
}: {
  density?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let stars: { x: number; y: number; z: number; r: number; tw: number; tp: number }[] = [];
    let raf = 0;
    let visible = true;
    const parent = canvas.parentElement as HTMLElement;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor(w * h * density);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.7 + 0.3,
        r: Math.random() * 1.3 + 0.2,
        tw: Math.random() * Math.PI * 2,
        tp: Math.random() * 0.02 + 0.004,
      }));
      if (reduce) draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.tw += s.tp;
        const a = (0.35 + Math.sin(s.tw) * 0.35) * s.z;
        s.x -= s.z * 0.08;
        if (s.x < -2) s.x = w + 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235,225,220,${a.toFixed(3)})`;
        ctx.fill();
      }
    };

    const loop = () => {
      draw();
      raf = visible ? requestAnimationFrame(loop) : 0;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !reduce && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [density]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
```

- [ ] **Step 7: Edit `src/components/ui.tsx`.** Real links, Spacegear mark, readable descriptions, and a CTA band.

7a. Replace the first line `import type { ReactNode } from "react";` with:
```tsx
import Link from "next/link";
import type { ReactNode } from "react";
```

7b. In `SectionHeader`, replace:
```tsx
            plat<span className="text-flame">—</span>form
```
with:
```tsx
            space<span className="text-flame">—</span>gear
```
and replace:
```tsx
          <p className="text-[12px] leading-relaxed text-mut-3">{description}</p>
```
with:
```tsx
          <p className="text-[12px] leading-relaxed text-mut-2">{description}</p>
```

7c. Replace the whole `FlameButton` and `GhostButton` functions with:
```tsx
export function FlameButton({
  children,
  href = "/contact/",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl bg-flame px-5 py-[14px] text-[13px] font-medium text-[#161719] transition-all duration-300 hover:brightness-110 hover:shadow-[0_10px_30px_-8px_rgba(250,110,67,0.6)] ${className}`}
    >
      {children}
      <ArrowIcon />
    </Link>
  );
}

export function GhostButton({
  children,
  href = "/",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card-2/60 px-5 py-[14px] text-[13px] font-medium text-ink transition-colors duration-300 hover:border-mut-3 hover:bg-card-3/60 ${className}`}
    >
      {children}
    </Link>
  );
}
```

7d. Append to the end of `ui.tsx`:
```tsx
/** Closing call-to-action band (from the original /services page). */
export function CtaBand({
  title,
  text,
  cta = "Discuss a project",
  href = "/contact/",
}: {
  title: string;
  text: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-line bg-card/40 p-10 text-center">
      <h2 className="display text-3xl text-ink">{title}</h2>
      <p className="max-w-md text-[14px] text-mut-2">{text}</p>
      <FlameButton href={href}>{cta}</FlameButton>
    </div>
  );
}
```

- [ ] **Step 8: Create the motion provider and the no-JS stylesheet**

`src/components/MotionProvider.tsx`:
```tsx
"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Honour the visitor's reduced-motion setting for every Motion animation. */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
```

`src/components/NoScriptStyles.tsx`:
```tsx
// Without JavaScript, entrance animations never run. These rules show their
// end state so every heading, paragraph, bar and chart stays visible.
const CSS = [
  "[data-reveal],.reveal{opacity:1!important;transform:none!important;filter:none!important}",
  "[data-scroll-word]{opacity:1!important;color:#e3dbd8!important}",
  "[data-fill]{width:var(--fill)!important}",
  "[data-fill-h]{height:var(--fill)!important}",
  "[data-fill-svg]{width:100%!important}",
  "[data-line]{width:100%!important}",
  "[data-dot]{transform:none!important}",
].join("");

export default function NoScriptStyles() {
  return <noscript dangerouslySetInnerHTML={{ __html: `<style>${CSS}</style>` }} />;
}
```

(Both are wired into the layout in Task 8.)

- [ ] **Step 9: Guard no-JS visibility in the browser check (write the assertion now; it protects every later task)**

In `scripts/browser-check.mjs`, after the line:
```js
    await page.locator("h1").waitFor({ state: "visible" });
```
insert:
```js
    if (profile.javaScriptEnabled === false) {
      const transparent = await page.evaluate(() => [...document.querySelectorAll("main h1, main h2, main h3, main p")]
        .filter(el => !el.closest("[data-hover-reveal]") && el.getClientRects().length > 0)
        .filter(el => { for (let n = el; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.99) return true; return false; })
        .map(el => el.textContent.trim().slice(0, 60)));
      assert.deepEqual(transparent, [], "no-javascript: entrance states must not hide content");
    }
```

In the 320 px loop, replace:
```js
    const clipped = await narrowPage.evaluate(() => [...document.querySelectorAll("main h1, main h2, main p, main label")].flatMap(el => {
```
with:
```js
    const clipped = await narrowPage.evaluate(() => [...document.querySelectorAll("main h1, main h2, main p, main label")].filter(el => !el.closest("[data-snap-row]")).flatMap(el => {
```

- [ ] **Step 10: Verify**

Run: `npm run lint && npm run typecheck && npm test`
Expected: clean, `# pass 26`. The restored primitives are not imported yet, but they must compile and lint. If lint flags `react-hooks/set-state-in-effect` in `CurtainShell.tsx`, change its effect body to call `measure` from `requestAnimationFrame(measure)` instead of synchronously, and cancel the frame in the cleanup.

- [ ] **Step 11: Commit**

```bash
git add src/components scripts/browser-check.mjs
git commit -m "feat: restore original motion and UI primitives with no-JS and reduced-motion support"
```

---

### Task 8: Page shell — curtain footer and curtain panel

**Files:**
- Rewrite: `src/app/layout.tsx`
- Rewrite: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import Nav from "@/components/Nav";
import CurtainShell from "@/components/CurtainShell";
import MotionProvider from "@/components/MotionProvider";
import NoScriptStyles from "@/components/NoScriptStyles";
import Footer from "@/components/sections/Footer";
import StructuredData from "@/components/StructuredData";
import { SITE } from "@/lib/site";
import "./globals.css";
import "./legacy.css";

const inter = localFont({ src: "./fonts/inter-latin.woff2", variable: "--font-inter", display: "swap" });
const mono = localFont({ src: "./fonts/jetbrains-mono-latin.woff2", variable: "--font-code", display: "swap", preload: false });
export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin), title: `${SITE.name} | Digital Transformation & AI Consulting`, description: SITE.description,
  robots: { index: SITE.publicationMode === "production", follow: SITE.publicationMode === "production" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${inter.variable} ${mono.variable} antialiased`}><body id="top">
    <NoScriptStyles />
    <a className="skip-link" href="#main">Skip to content</a>
    <MotionProvider>
      <Nav />
      {/* Original curtain: page content lifts away to reveal the pinned footer (desktop). */}
      <CurtainShell footer={<Footer />}>{children}</CurtainShell>
    </MotionProvider>
    <StructuredData data={{ "@context": "https://schema.org", "@graph": [
      { "@type": "Organization", "@id": `${SITE.origin}/#organization`, name: SITE.name, url: SITE.origin, description: SITE.description, logo: `${SITE.origin}/icon.svg`, ...(SITE.contactEmail ? { email: SITE.contactEmail } : {}) },
      { "@type": "WebSite", "@id": `${SITE.origin}/#website`, url: SITE.origin, name: SITE.name, publisher: { "@id": `${SITE.origin}/#organization` } }
    ] }} />
  </body></html>;
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`.** Add the original rounded panel that slides over the pinned hero; keep Codex's sections for now.

```tsx
import { buildMetadata } from "@/lib/seo";
import OrbitalCinematic from "@/components/sections/OrbitalCinematic";
import Work from "@/components/sections/Work";
import Services from "@/components/sections/Services";
import DeliveryExample from "@/components/sections/DeliveryExample";
import Process from "@/components/sections/Process";
import Pricing from "@/components/sections/Pricing";
import Faq from "@/components/sections/Faq";

export const metadata = buildMetadata({ title: "Digital Transformation & AI Consulting", description: "Turn business challenges into working digital systems. spacegear.tech brings digital transformation, AI strategy and hands-on delivery together.", path: "/" });

export default function Home() {
  return (
    <main id="main" className="relative bg-bg">
      <OrbitalCinematic />
      {/* curtain: this panel slides up over the locked hero background */}
      <div className="relative z-10 rounded-t-[28px] border-t border-line bg-bg shadow-[0_-30px_60px_-20px_rgba(0,0,0,0.75)]">
        <Work />
        <Services />
        <DeliveryExample />
        <Process />
        <Pricing />
        <Faq />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck && npm run build:cf`, restart the preview, then `npm run test:browser`.
Expected: all pass. At 1440×1000 the footer is pinned behind the page and revealed at the bottom (curtain). At 900 px tall it stays in normal flow, exactly as the original does.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: restore the curtain shell and hero curtain panel"
```

---

### Task 9: Navigation

**Files:**
- Rewrite: `src/components/Nav.tsx`
- Modify: `src/app/legacy.css` (prune Codex nav rules)

- [ ] **Step 1: Replace `src/components/Nav.tsx`**

Original look. The mobile menu stays a `<details class="mobile-menu">` because the existing browser test drives it and it works without JS. The Services dropdown opens on hover and focus, and Escape closes it.

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Brand from "@/components/Brand";
import { SERVICES } from "@/lib/content";

type Item = { label: string; href: string };

const PRIMARY: Item[] = [{ label: "Home", href: "/" }];
const SERVICE_ITEMS: Item[] = SERVICES.map((s) => ({ label: s.name, href: `/services/${s.slug}/` }));
const TAIL: Item[] = [
  { label: "Approach", href: "/approach/" },
  { label: "About", href: "/about/" },
  { label: "Engagements", href: "/#pricing" },
  { label: "Contact", href: "/contact/" },
];

function Dropdown({ label, href, items }: { label: string; href: string; items: Item[] }) {
  const [dismissed, setDismissed] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const open = dismissed
    ? ""
    : "group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100";
  return (
    <li
      className="group relative"
      onMouseEnter={() => setDismissed(false)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDismissed(false); }}
      onKeyDown={(event) => { if (event.key === "Escape") { setDismissed(true); trigger.current?.focus(); } }}
    >
      <Link
        ref={trigger}
        prefetch={false}
        href={href}
        aria-haspopup="true"
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors group-hover:text-ink group-focus-within:text-ink"
      >
        {label}
        <span aria-hidden className="text-[9px] text-mut-3 transition-transform group-hover:rotate-180 group-focus-within:rotate-180">
          ▾
        </span>
      </Link>
      <div className={`invisible absolute left-0 top-full z-10 pt-2 opacity-0 transition-all duration-200 ${open}`}>
        <ul className="w-64 rounded-xl border border-line bg-[#161719]/95 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                prefetch={false}
                href={it.href}
                className="block truncate rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors hover:bg-card-2 hover:text-ink"
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function MobileGroup({ title, items, onNavigate }: { title: string; items: Item[]; onNavigate: () => void }) {
  return (
    <div className="mt-2 border-t border-line-soft pt-2">
      <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{title}</p>
      {items.map((it) => (
        <Link
          prefetch={false}
          key={it.href}
          href={it.href}
          onClick={onNavigate}
          className="block truncate rounded-lg px-4 py-2.5 text-[13px] text-mut-2 hover:bg-card-2 hover:text-ink"
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => { if (menu.current) menu.current.open = false; };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        aria-label="Main navigation"
        className={`flex w-full max-w-[1180px] items-center justify-between gap-4 rounded-2xl border px-3 py-2 transition-all duration-500 ${
          scrolled ? "border-line bg-[#161719]/85 backdrop-blur-xl" : "border-transparent bg-[#161719]/30 backdrop-blur-md"
        }`}
      >
        <Link prefetch={false} href="/" aria-label="spacegear.tech home" className="flex items-center gap-2 pl-2">
          <Brand />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {PRIMARY.map((it) => (
            <li key={it.href}>
              <Link prefetch={false} href={it.href} className="rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors hover:text-ink">
                {it.label}
              </Link>
            </li>
          ))}
          <Dropdown label="Services" href="/services/" items={SERVICE_ITEMS} />
          {TAIL.map((it) => (
            <li key={it.href}>
              <Link prefetch={false} href={it.href} className="rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors hover:text-ink">
                {it.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            prefetch={false}
            href="/contact/"
            className="hidden rounded-xl border border-line px-4 py-2 text-[13px] text-ink transition-colors hover:border-mut-3 sm:inline-flex"
          >
            Discuss a project
          </Link>
          <details
            ref={menu}
            className="mobile-menu lg:hidden"
            onKeyDown={(event) => { if (event.key === "Escape") { close(); menu.current?.querySelector("summary")?.focus(); } }}
          >
            <summary
              aria-label="Open navigation"
              className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-xl border border-line text-ink"
            >
              <span aria-hidden className="space-y-1">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            </summary>
            {/* mobile sitemap — positioned against the fixed header, like the original */}
            <div className="scrollbar-none absolute left-4 right-4 top-[72px] max-h-[78vh] overflow-y-auto rounded-2xl border border-line bg-[#161719]/97 p-3 backdrop-blur-xl">
              {[...PRIMARY, { label: "Services", href: "/services/" }, ...TAIL].map((it) => (
                <Link
                  prefetch={false}
                  key={it.href}
                  href={it.href}
                  onClick={close}
                  className="block rounded-lg px-4 py-3 text-[15px] text-ink hover:bg-card-2"
                >
                  {it.label}
                </Link>
              ))}
              <MobileGroup title="All services" items={SERVICE_ITEMS} onNavigate={close} />
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Remove Codex's nav CSS**

Run: `node scripts/prune-legacy-css.mjs .site-header .nav-shell .brand .desktop-links .mobile-menu .menu-lines .mobile-links`
Expected: `Removed N rule(s)`, all of them nav-related. One of them also lists `.text-link:hover`; that is fine, since Task 20 replaces that markup.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck && npm run build:cf`, restart the preview, then `npm run test:browser`.
Expected: pass. The mobile-390 profile's "mobile menu keyboard open/Escape/focus and navigation" interaction is recorded. Then check by hand at 1440 px:
- The pill nav is transparent at the top and solid after scrolling.
- `space—gear™` is in orange with a light dash.
- Hovering **Services** drops the 5-service menu.
- Tabbing onto Services opens it, and Escape closes it while keeping focus on the trigger.

- [ ] **Step 4: Commit**

```bash
git add src/components/Nav.tsx src/app/legacy.css
git commit -m "feat: restore the original navigation with keyboard-accessible menus"
```

---

### Task 10: Hero — pinned globe cinematic

**Files:**
- Rewrite: `src/components/sections/OrbitalCinematic.tsx`
- Modify: `src/components/EarthScene.tsx`
- Create: `scripts/capture-hero-poster.mjs`, `public/images/hero-poster.webp` (generated)
- Modify: `scripts/package-site.mjs`, `src/app/legacy.css`

- [ ] **Step 1: Point the 3D scene back at full-quality assets**

In `src/components/EarthScene.tsx`, make these replacements:
- `const MODEL = "/models/earth-optimized.glb";` becomes `const MODEL = "/models/earth-hq.glb";`
- `const GALAXY = "/images/galaxy-small.webp";` becomes `const GALAXY = "/images/galaxy.webp";`
- `dpr = [1, 1.5],` becomes `dpr = [1, 2],`
- `count={1800}` becomes `count={7000}`
- Append at the end of the file:
  ```tsx

  useGLTF.preload(MODEL, "/draco/");
  ```

- [ ] **Step 2: Replace `src/components/sections/OrbitalCinematic.tsx`**

This is the original choreography plus Codex's guards: eligibility, idle mount, offscreen pause and WebGL error boundary. It adds a poster, and the copy comes from `HOME`. The `hero-copy`, `hero-backdrop` and `hero-scene` classes are hooks for the browser check and the poster script.

```tsx
"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Starfield from "@/components/Starfield";
import { ScrollFillText } from "@/components/motion";
import { Container } from "@/components/ui";
import { HOME, type Stat as StatData } from "@/lib/content";

// 3D scene is client-only (WebGL) — load without SSR.
const EarthScene = dynamic(() => import("@/components/EarthScene"), { ssr: false });

// Desktop, motion allowed, not on a data-saver connection → upgrade to the cinematic.
const QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function eligible() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia(QUERY).matches && !connection?.saveData;
}

/** If WebGL fails, drop the canvas and keep the poster + copy on screen. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * Scroll-driven layer. It receives the shared `progress` MotionValue as a PROP
 * and runs its own useTransform — the same pattern the word-fill uses, which
 * keeps the bindings live.
 */
function Choreo({
  progress,
  opacity,
  y,
  scale,
  blur,
  className = "",
  children,
}: {
  progress: MotionValue<number>;
  opacity?: [number[], number[]];
  y?: [number[], number[]];
  scale?: [number[], number[]];
  blur?: [number[], string[]];
  className?: string;
  children?: ReactNode;
}) {
  const o = useTransform(progress, opacity?.[0] ?? [0, 1], opacity?.[1] ?? [1, 1]);
  const ty = useTransform(progress, y?.[0] ?? [0, 1], y?.[1] ?? [0, 0]);
  const sc = useTransform(progress, scale?.[0] ?? [0, 1], scale?.[1] ?? [1, 1]);
  const fl = useTransform(progress, blur?.[0] ?? [0, 1], blur?.[1] ?? ["blur(0px)", "blur(0px)"]);
  return (
    <motion.div style={{ opacity: o, y: ty, scale: sc, filter: fl }} className={`transition-none ${className}`}>
      {children}
    </motion.div>
  );
}

function Stat({ value, unit, label, sub }: StatData) {
  return (
    <div className="flex items-start gap-4">
      <span className="display text-3xl text-flame">
        {value}
        {unit && <span className="align-super text-sm">{unit}</span>}
      </span>
      <span className="mt-1">
        <span className="block text-[14px] text-ink">{label}</span>
        <span className="block text-[12px] text-mut-2">{sub}</span>
      </span>
    </div>
  );
}

function HeroCopy() {
  const reduce = useReducedMotion();
  const EASE = [0.44, 0, 0.56, 1] as const;
  const v = (delay: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 28, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.9, ease: EASE, delay },
        };
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
        <div>
          <h2 className="text-xl font-medium text-ink">{HOME.pitch.title}</h2>
          <p className="mx-auto mt-1 max-w-xs text-[13px] text-mut-2">{HOME.pitch.text}</p>
        </div>
        <Link
          prefetch={false}
          href={HOME.cta.href}
          className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-xl bg-flame px-5 py-3 text-[13px] font-medium text-[#161719] transition-all hover:brightness-110 hover:shadow-[0_10px_30px_-8px_rgba(250,110,67,0.6)]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2 6.5h12M5.5 2v2M10.5 2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {HOME.cta.label}
        </Link>
      </motion.div>

      <motion.div data-reveal="" {...v(0.42)} className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-10 lg:justify-start">
        {HOME.stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </motion.div>
    </div>
  );
}

export default function OrbitalCinematic() {
  const outerRef = useRef<HTMLElement | null>(null);
  const cinematic = useSyncExternalStore(subscribe, eligible, () => false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const progress = useMotionValue(0);

  // Mount the WebGL scene when the browser is idle, after the copy has painted.
  useEffect(() => {
    if (!cinematic) return;
    const enable = () => setReady(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable);
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 0);
    return () => clearTimeout(timer);
  }, [cinematic]);

  // Manual scroll scrubber from the section's own rect; pause rendering offscreen.
  useEffect(() => {
    const el = outerRef.current;
    if (!el || !cinematic) return;
    let frame = 0;
    let visible = true;
    const update = () => {
      const rect = el.getBoundingClientRect();
      progress.set(Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - window.innerHeight))));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const visibility = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibility(); });
    observer.observe(el);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", visibility);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", visibility);
      progress.set(0);
    };
  }, [cinematic, progress]);

  // Mobile / reduced motion / no JS / first paint: the static cosmic hero (no three.js fetched).
  if (!cinematic) {
    return (
      <section id="home" className="relative overflow-hidden">
        <div className="hero-backdrop pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/galaxy.webp" alt="" aria-hidden width={3840} height={1629} fetchPriority="high" className="h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/35 to-bg" />
          <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_75%_0%,rgba(250,110,67,0.18),rgba(22,23,25,0)_60%)]" />
        </div>
        <Starfield className="opacity-50" />

        <Container className="relative flex min-h-[90svh] flex-col justify-center pt-28 pb-20">
          <HeroCopy />
        </Container>

        <Container className="relative pb-24">
          <ScrollFillText text={HOME.statement} className="max-w-3xl" />
        </Container>
      </section>
    );
  }

  return (
    <section ref={outerRef} id="home" className="relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#08080b]">
        {/* poster: loading state and WebGL fallback (scripts/capture-hero-poster.mjs) */}
        <div className="hero-backdrop pointer-events-none absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hero-poster.webp" alt="" width={1440} height={900} className="h-full w-full object-cover" />
        </div>

        {/* the 3D scene supplies the galaxy, sun and earth */}
        {ready && (
          <div className="hero-scene absolute inset-0" aria-hidden>
            <SceneBoundary>
              <EarthScene progress={progress} active={active} />
            </SceneBoundary>
          </div>
        )}

        {/* legibility scrim for the statement beat */}
        <Choreo progress={progress} opacity={[[0.5, 0.62], [0, 0.55]]} className="pointer-events-none absolute inset-0 bg-[#0f0f12]" />

        {/* hero copy */}
        <Choreo
          progress={progress}
          opacity={[[0, 0.18, 0.34], [1, 1, 0]]}
          y={[[0, 0.34], [0, -60]]}
          blur={[[0, 0.34], ["blur(0px)", "blur(8px)"]]}
          className="pointer-events-none absolute inset-0 flex items-center"
        >
          <Container className="relative">
            <HeroCopy />
          </Container>

          <Link
            prefetch={false}
            href={HOME.corner.href}
            className="pointer-events-auto absolute bottom-10 right-8 hidden w-72 items-center justify-between rounded-xl border border-line bg-card/80 px-4 py-3 backdrop-blur lg:flex"
          >
            <div>
              <p className="text-[13px] text-ink">{HOME.corner.title}</p>
              <p className="font-mono text-[11px] text-mut-3">{HOME.corner.sub}</p>
            </div>
            <span aria-hidden className="text-flame">→</span>
          </Link>
        </Choreo>

        {/* scroll hint */}
        <Choreo progress={progress} opacity={[[0, 0.12], [1, 0]]} className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-2 rounded-full border border-line bg-card/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-2 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-flame pulse-dot" />
            {HOME.scrollHint}
          </span>
        </Choreo>

        {/* statement, fills word-by-word over the centred globe */}
        <Choreo progress={progress} opacity={[[0.5, 0.6], [0, 1]]} className="pointer-events-none absolute inset-0 flex items-center">
          <Container className="relative">
            <ScrollFillText text={HOME.statement} className="max-w-4xl" progress={progress} range={[0.58, 0.9]} />
          </Container>
        </Choreo>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Remove Codex's hero CSS**

Run: `node scripts/prune-legacy-css.mjs .orbital-hero .hero-`
Expected: removes the `.orbital-hero`, `.hero-stage`, `.hero-backdrop`, `.hero-poster-globe`, `.hero-shade`, `.hero-content`, `.hero-copy…`, `.hero-actions`, `.hero-caption…` and `.hero-statement…` rules. Check the output: if a multi-line rule containing `.hero-` survives (the script only removes single-line rules), delete it by hand.

- [ ] **Step 4: Write the poster capture script**

Create `scripts/capture-hero-poster.mjs`:

```js
// Renders the desktop globe's opening frame to public/images/hero-poster.webp.
// The poster sits under the WebGL canvas: loading state and WebGL fallback.
// Usage (local preview running): node scripts/capture-hero-poster.mjs [base]
// Re-run whenever the globe model, galaxy or EarthScene camera changes.
import sharp from "sharp";
import { launchBrowser } from "./browser-runtime.mjs";

const base = process.argv[2] || "http://127.0.0.1:8787";
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("#home .hero-scene canvas", { timeout: 30000 });
  await page.waitForTimeout(5000); // model + 4K textures decode, sun glow settles
  await page.evaluate(() => {
    document.querySelector("header")?.style.setProperty("visibility", "hidden");
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

- [ ] **Step 5: Allowlist the poster, build, capture, rebuild**

In `scripts/package-site.mjs`, add `"images/hero-poster.webp"` to the `assets` array. Then:

```bash
npm run build:cf
# start preview (Conventions), wait for 200 on :8787
node scripts/capture-hero-poster.mjs
# stop preview
npm run build:cf
# start preview again
```
Expected: `Hero poster written…`. Open `public/images/hero-poster.webp`. It should show the night-lit Earth on the right, the sun haze top-left and a star field, with no text and no nav.

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run typecheck && npm run test:browser && npm run check:seo`
Expected: pass. The desktop profile loads exactly one `.glb` (`earth-hq.glb`). The failed-WebGL check finds `.hero-copy` → "Discuss a project" and `.hero-backdrop img`. No GLB loads at 320, 390 or 768 px, nor with reduced motion or no JavaScript.

Run: `npm run check:fidelity` and open `artifacts/fidelity/desktop/home.jpg`. Compare the three stacked beats against the original:
1. Copy left with three orange verbs, the two stat chips, the corner card bottom-right and the "Scroll to explore" pill, over a **sharp** night-lights globe on the right.
2. The globe shrinks toward the centre.
3. The statement fills word-by-word over the centred globe.

`ok desktop home` must report a ratio of 1.0. If the clouds look softer than the original, change `CLOUD_WIDTH` in `scripts/opt-globe.mjs` to `3072`, rerun it, recapture the poster and compare again. The model grows to about 6.3 MB.

Open `artifacts/fidelity/mobile/home.jpg`: galaxy backdrop, centred copy, and the statement below.

- [ ] **Step 7: Commit**

```bash
git add src/components/sections/OrbitalCinematic.tsx src/components/EarthScene.tsx scripts/capture-hero-poster.mjs public/images/hero-poster.webp scripts/package-site.mjs src/app/legacy.css
git commit -m "feat: restore the pinned globe hero with full-quality assets and a poster fallback"
```

---

### Task 11: What We Do (original Work bento)

**Files:**
- Rewrite: `src/components/sections/Work.tsx`

- [ ] **Step 1: Replace `src/components/sections/Work.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Appear, AppearGroup, AppearItem, FillBar } from "@/components/motion";
import { Container, ArrowButton } from "@/components/ui";
import ScrollColorTitle from "@/components/ScrollColorTitle";
import StackCards from "@/components/StackCards";
import DotField from "@/components/DotField";
import { SECTIONS, WORK, type WorkTile } from "@/lib/content";

/** small animated drag-handle dots, top-right of each tile */
function GridDots() {
  return (
    <span aria-hidden className="grid grid-cols-3 gap-[3px] opacity-50 transition-opacity duration-300 group-hover:opacity-100">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

function ArrowBtn() {
  return <ArrowButton />;
}

/** Service tile with hover-revealed description + image zoom. Reused on service pages. */
export function Tile({ name, img, desc, href }: WorkTile) {
  return (
    <Link prefetch={false} href={href} className="group relative block h-full overflow-hidden rounded-2xl border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-110"
      />
      {/* base gradient (legibility); a touch stronger on mobile where the desc is always shown */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f] via-[#0c0d0f]/30 to-transparent lg:via-transparent" />
      <div className="absolute inset-0 bg-[#0b0c0e]/0 transition-colors duration-500 group-hover:bg-[#0b0c0e]/65" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_70%_15%,rgba(250,110,67,0.22),transparent_72%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex h-full flex-col justify-between p-5 text-ink">
        <div className="flex items-start justify-between">
          <h3 className="text-[15px] font-medium drop-shadow">{name}</h3>
          <GridDots />
        </div>
        <div>
          {/* visible on mobile, hover/focus-revealed on desktop */}
          <p
            data-hover-reveal=""
            className="mb-3 max-w-[24ch] text-[12.5px] leading-relaxed text-mut-2 transition-all duration-[400ms] ease-out lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-visible:translate-y-0 lg:group-focus-visible:opacity-100"
          >
            {desc}
          </p>
          <ArrowBtn />
        </div>
      </div>
    </Link>
  );
}

function LineupPanel({ variant }: { variant: "desktop" | "mobile" }) {
  const l = WORK.lineup;
  const header = (
    <div className="flex items-center justify-between border-b border-[#161719]/20 pb-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{l.label}</span>
      <span className="font-mono text-[11px] tracking-[0.2em]">{l.count}</span>
    </div>
  );
  if (variant === "mobile") {
    return (
      <div className="flex h-[46vh] flex-col justify-between overflow-hidden rounded-2xl bg-flame p-6 text-[#161719]">
        <div>
          {header}
          <h3 className="display mt-4 text-2xl leading-tight">{l.title}</h3>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a2a17]">{l.text}</p>
        </div>
        <DotField cols={6} rows={3} color="#161719" className="gap-y-3" />
        <div className="flex items-center gap-2 border-t border-[#161719]/20 pt-3">
          <span aria-hidden className="text-base">◉</span>
          <span className="text-[13px] font-medium">{l.footer}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-flame p-6 text-[#161719]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_80%_10%,rgba(255,255,255,0.18),transparent_60%)]" />
      <div className="relative">
        {header}
        <h3 className="display mt-5 text-2xl leading-tight">{l.title}</h3>
        <p className="mt-3 text-[13px] leading-relaxed text-[#5a2a17]">{l.text}</p>
      </div>
      {/* flowing dot matrix */}
      <DotField cols={6} rows={5} color="#161719" className="relative my-4 gap-y-3.5" />
      <div className="relative flex items-center gap-2 border-t border-[#161719]/20 pt-3">
        <span aria-hidden className="text-base">◉</span>
        <span className="text-[13px] font-medium">{l.footer}</span>
      </div>
    </div>
  );
}

function AssessmentCard({ variant }: { variant: "desktop" | "mobile" }) {
  const a = WORK.assessment;
  const title = (
    <>
      <h3 className="display text-xl text-ink-strong">
        {a.title} <span className="text-mut-2">{a.badge}</span>
      </h3>
      <p className="mt-1 text-[13px] text-flame">{a.note}</p>
    </>
  );
  const bar = <FillBar value={a.progress} className="h-full rounded-full bg-flame" />;
  if (variant === "mobile") {
    return (
      <div className="mt-4 rounded-2xl border border-line bg-card p-6">
        {title}
        <p className="display mt-3 text-3xl text-mut">
          {a.value}<span className="text-base text-mut-3">{a.unit}</span>
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-3">{bar}</div>
        <Link prefetch={false} href={a.href} className="group mt-4 flex items-center justify-between">
          <span className="text-[13px] text-ink">{a.cta}</span>
          <ArrowBtn />
        </Link>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-line bg-card p-6">
      <div>
        {title}
        <div className="mt-4">
          <span className="inline-block rounded-md bg-card-3 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-mut-2">{a.chip}</span>
          <p className="display mt-2 text-3xl text-mut">
            {a.value}<span className="text-base text-mut-3">{a.unit}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-3">{bar}</div>
        </div>
      </div>
      <Link prefetch={false} href={a.href} className="group flex items-center justify-between">
        <span className="text-[13px] text-ink">{a.cta}</span>
        <ArrowBtn />
      </Link>
    </div>
  );
}

export default function Work() {
  const copy = SECTIONS.work;
  const f = WORK.featured;
  return (
    <section id="work" className="relative py-24">
      <Container>
        {/* header */}
        <ScrollColorTitle title={copy.title} />

        <Appear delay={0.05}>
          <div className="mt-8 grid gap-6 border-t border-line-soft pt-8 lg:grid-cols-[200px_1fr_240px]">
            <div className="font-mono text-[11px] leading-relaxed text-mut-3">
              <span className="text-mut">{copy.index}</span>
              <br />
              space<span className="text-flame">—</span>gear
            </div>
            <h3 className="display max-w-md text-[clamp(22px,2.6vw,34px)] text-ink">{copy.heading}</h3>
            <p className="text-[12px] leading-relaxed text-mut-2">{copy.description}</p>
          </div>
        </Appear>

        {/* bento (desktop) */}
        <AppearGroup className="mt-10 hidden auto-rows-[200px] gap-4 lg:grid lg:grid-cols-3 lg:[grid-auto-rows:200px]" stagger={0.07}>
          {/* featured service — spans 2 cols, 2 rows */}
          <AppearItem className="sm:col-span-2 sm:row-span-2">
            <Link prefetch={false} href={f.href} className="group relative block h-full min-h-[260px] overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.img} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/80 via-transparent to-[#0c0d0f]/40" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{f.label}</span>
                    <h3 className="display mt-1 text-2xl text-ink-strong">{f.name}</h3>
                  </div>
                  <GridDots />
                </div>
                <ArrowBtn />
              </div>
            </Link>
          </AppearItem>

          {/* service lineup orange panel — spans 2 rows */}
          <AppearItem className="sm:row-span-2">
            <LineupPanel variant="desktop" />
          </AppearItem>

          {WORK.tiles.map((tile) => (
            <AppearItem key={tile.slug} className="h-full">
              <Tile {...tile} />
            </AppearItem>
          ))}

          {/* animated neural placeholder */}
          <AppearItem className="hidden h-full sm:block">
            <div aria-hidden className="relative grid h-full place-items-center overflow-hidden rounded-2xl border border-line bg-card/40">
              <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(250,110,67,0.08),transparent_70%)]" />
              <div className="spin-26 grid grid-cols-3 gap-2.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className="tile-pulse h-2 w-2 rounded-[3px] bg-flame/70" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            </div>
          </AppearItem>

          <AppearItem className="h-full">
            <AssessmentCard variant="desktop" />
          </AppearItem>
        </AppearGroup>

        {/* mobile: curtain card-stack — featured → services → lineup, each card freezes while the next slides over */}
        <div className="mt-10 lg:hidden">
          <StackCards top={88} step={14} gap={64}>
            <Link prefetch={false} href={f.href} className="group relative block h-[46vh] overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.img} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/85 via-transparent to-[#0c0d0f]/30" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{f.label}</span>
                    <h3 className="display mt-1 text-2xl text-ink-strong">{f.name}</h3>
                  </div>
                  <GridDots />
                </div>
                <ArrowBtn />
              </div>
            </Link>

            {WORK.tiles.map((tile) => (
              <div key={tile.slug} className="h-[46vh]">
                <Tile {...tile} />
              </div>
            ))}

            <LineupPanel variant="mobile" />
          </StackCards>

          <AssessmentCard variant="mobile" />
        </div>
      </Container>
    </section>
  );
}
```

> Bento order matches the original: the first three tiles fill row 3, and the fourth tile, the pulsing placeholder and the assessment card fill row 4.

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run typecheck && npm run build:cf`, restart the preview, then `npm run check:fidelity`.
Expected: `ok desktop work` and `ok mobile work` (ratios within ±0.15). Open `artifacts/fidelity/desktop/work.jpg` and confirm:
- the giant grey→white "What We Do" title
- the `001 / space—gear` row
- the 2×2 featured card
- the orange lineup panel with pulsing dots
- four tiles with grid dots and orange arrow buttons
- the pulsing 3×3 placeholder
- the assessment card with its progress bar

On mobile: the stacking cards freeze and slide over each other. Hover a tile at 1440 px: the image zooms, the description rises in and an orange glow appears. Then run `npm run test:browser`; expected pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Work.tsx
git commit -m "feat: restore the original work bento as What We Do"
```

---

### Task 12: Our Services (horizontal accordion, 5 columns)

**Files:**
- Rewrite: `src/components/sections/Services.tsx`

- [ ] **Step 1: Replace `src/components/sections/Services.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import DotField from "@/components/DotField";
import { Container, SectionHeader, FlameButton } from "@/components/ui";
import { CORE_PANEL, PILLARS, SECTIONS } from "@/lib/content";

function CorePanel() {
  return (
    <div className="flex h-full flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
      <div className="flex items-center justify-between border-b border-line-soft pb-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{CORE_PANEL.label}</span>
        <span className="font-mono text-[12px] tracking-[0.2em] text-flame">{CORE_PANEL.count}</span>
      </div>
      <h3 className="display text-[clamp(22px,2.4vw,32px)] text-ink">{CORE_PANEL.title}</h3>
      <p className="text-[13px] leading-relaxed text-mut-2">{CORE_PANEL.text}</p>
      {/* animated dot matrix */}
      <DotField cols={5} rows={5} className="my-2 gap-y-5 px-1" />
      <div className="mt-auto flex items-center gap-3">
        <span aria-hidden className="grid h-6 w-6 place-items-center rounded bg-card-3 text-flame">⠿</span>
        <span className="text-[13px] font-medium text-ink">{CORE_PANEL.line}</span>
      </div>
      <FlameButton href={CORE_PANEL.href} className="w-full">{CORE_PANEL.cta}</FlameButton>
    </div>
  );
}

export default function Services() {
  const [active, setActive] = useState(0);

  return (
    <section id="services" className="relative scroll-mt-24 py-24">
      <div className="pointer-events-none absolute right-0 top-20 h-[420px] w-[420px] flame-glow opacity-40 blur-sm" />
      <Container className="relative">
        <SectionHeader {...SECTIONS.services} />

        {/* Desktop: horizontal accordion — opens on hover (original) and on keyboard focus */}
        <Reveal delay={100}>
          <div className="mt-12 hidden gap-3 lg:flex lg:h-[520px]">
            <div className="flex flex-1 gap-3">
              {PILLARS.map((s, i) => {
                const isActive = i === active;
                return (
                  <Link
                    prefetch={false}
                    key={s.no}
                    href={`/services/${s.slug}/`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isActive ? "flex-[2.6] border-flame bg-flame" : "flex-[0.8] border-line bg-card/50 hover:bg-card-2"
                    }`}
                  >
                    {/* top row: arrow + number */}
                    <div className="flex items-center gap-3 p-5">
                      <span aria-hidden className={`text-lg ${isActive ? "text-[#161719]" : "text-mut-2"}`}>{isActive ? "↗" : "↓"}</span>
                      <span className={`display text-3xl ${isActive ? "text-[#161719]" : "text-mut-3"}`}>{s.no}</span>
                    </div>

                    {/* active content */}
                    <div className={`px-5 transition-opacity duration-300 ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                      <h3 className="text-xl font-medium text-[#161719]">{s.name}</h3>
                      <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[#5a2a17]">{s.desc}</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.img} alt="" className="mt-5 h-48 w-full max-w-sm rounded-xl object-cover" />
                    </div>

                    {/* bottom tag */}
                    <div className="absolute bottom-5 left-5">
                      <div aria-hidden className={`text-lg ${isActive ? "text-[#161719]" : "text-mut-3"}`}>
                        {isActive && <span className="block">{s.glyph}</span>}
                      </div>
                      <span className={`mt-1 block text-[13px] ${isActive ? "font-medium text-[#161719]" : "text-mut-2"}`}>{s.tag}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="w-[34%]">
              <CorePanel />
            </div>
          </div>
        </Reveal>

        {/* Mobile: stacked list */}
        <div className="mt-10 space-y-3 lg:hidden">
          {PILLARS.map((s, i) => (
            <Reveal as="div" key={s.no} delay={60 + i * 50}>
              <Link prefetch={false} href={`/services/${s.slug}/`} className="block rounded-2xl border border-line bg-card/50 p-5">
                <div className="flex items-center justify-between">
                  <span className="display text-2xl text-flame">{s.no}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{s.tag}</span>
                </div>
                <h3 className="mt-3 text-lg font-medium text-ink">{s.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-mut-2">{s.desc}</p>
              </Link>
            </Reveal>
          ))}
          <Reveal as="div" delay={300}>
            <CorePanel />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run the static checks and build, restart the preview, then `npm run check:fidelity`.
Expected: `ok desktop services` and `ok mobile services` (mobile tolerance 0.3). In `artifacts/fidelity/desktop/services.jpg`, the first column is expanded orange with its image, and four collapsed columns show `↓ 02`…`↓ 05` with tags at the bottom. **Check that `05` is not clipped** in the collapsed columns. If it is, change `flex-[2.6]` to `flex-[2.3]` in the active class and rebuild. The Core Services card shows `5/5`, the dot matrix and a full-width orange button. At 1440 px, hovering and Tab-focusing columns expand them.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Services.tsx
git commit -m "feat: restore the horizontal services accordion with five services"
```

---

### Task 13: Our Process (timeline, count-ups, CTA banner)

**Files:**
- Rewrite: `src/components/sections/Process.tsx` (exports `StepCard`, `ProcessSteps` for inner pages)

- [ ] **Step 1: Replace `src/components/sections/Process.tsx`**

```tsx
"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader, FlameButton } from "@/components/ui";
import { PROCESS_CTA, PROCESS_STEPS, SECTIONS, type ProcessStep } from "@/lib/content";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Counts up from 0 to `to` the first time it scrolls into view. The server
 *  renders the final value, so the number is right without JavaScript. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-12%" });
  const [val, setVal] = useState(to);
  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, to, { duration: 1.1, ease: EASE, onUpdate: (v) => setVal(v) });
    return () => controls.stop();
  }, [inView, reduce, to]);
  return <span ref={ref}>{Math.round(val)}</span>;
}

export function StepCard({ s, i }: { s: ProcessStep; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      data-reveal=""
      initial={reduce ? false : { opacity: 0, y: 40, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
      whileHover={{ y: -6 }}
      className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-line bg-card/60 p-7 transition-colors hover:border-flame/50"
    >
      {/* hover glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-flame/0 blur-2xl transition-colors duration-500 group-hover:bg-flame/20" />

      <div className="relative flex items-start justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-flame">{s.step}</span>
          {s.name && <h3 className="display mt-2 text-2xl text-ink">{s.name}</h3>}
        </div>
        <motion.span
          aria-hidden
          className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-bg text-mut-2"
          whileHover={{ rotate: -12, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
        >
          →
        </motion.span>
      </div>

      <p className="relative mt-5 max-w-md text-[14px] leading-relaxed text-mut-2">{s.desc}</p>

      {s.outputs.length > 0 && (
        <div className="relative mt-7 flex items-end justify-between gap-4 border-t border-line-soft pt-5">
          <span className="text-[12px] text-mut-2">{s.outputs.join(" · ")}</span>
          <span className="display shrink-0 text-3xl text-ink-strong">
            <CountUp to={s.outputs.length} />
            <span className="ml-1 text-base text-mut-2">{s.outputs.length === 1 ? "output" : "outputs"}</span>
          </span>
        </div>
      )}
    </motion.div>
  );
}

/** Animated connecting line + step cards. Used on the home page, Approach and service pages. */
export function ProcessSteps({ steps, gridClassName = "md:grid-cols-2 xl:grid-cols-4" }: { steps: ProcessStep[]; gridClassName?: string }) {
  const lineRef = useRef<HTMLDivElement>(null);
  const lineInView = useInView(lineRef, { once: true, margin: "-20%" });
  const reduce = useReducedMotion();
  const shown = reduce || lineInView;
  const dots = steps.map((_, i) => (steps.length === 1 ? 0 : (i / (steps.length - 1)) * 100));
  return (
    <>
      <div ref={lineRef} className="relative mt-12 hidden h-px md:block">
        <div className="absolute inset-0 bg-line-soft" />
        <motion.div
          data-line=""
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-flame to-flame/40"
          initial={reduce ? false : { width: "0%" }}
          animate={shown ? { width: "100%" } : {}}
          transition={{ duration: 1.4, ease: EASE }}
        />
        {dots.map((pos, i) => (
          <motion.span
            key={i}
            data-dot=""
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame"
            style={{ left: `${pos}%` }}
            initial={reduce ? false : { scale: 0 }}
            animate={shown ? { scale: 1 } : {}}
            transition={{ duration: 0.4, ease: EASE, delay: 0.3 + i * 0.28 }}
          />
        ))}
      </div>

      <div className={`mt-6 grid gap-4 ${gridClassName}`}>
        {steps.map((s, i) => (
          <StepCard key={s.step} s={s} i={i} />
        ))}
      </div>
    </>
  );
}

export default function Process() {
  return (
    <section id="process" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader {...SECTIONS.process} />
        <ProcessSteps steps={PROCESS_STEPS} />

        <Reveal delay={120}>
          <div className="mt-8 flex flex-col gap-5 rounded-3xl border border-line bg-card/40 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-medium text-ink">{PROCESS_CTA.title}</h3>
              <p className="mt-1 text-[14px] text-mut-2">{PROCESS_CTA.text}</p>
            </div>
            <FlameButton href={PROCESS_CTA.href}>{PROCESS_CTA.cta}</FlameButton>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Static checks, build, restart the preview, then `npm run check:fidelity`.
Expected: `ok desktop process` and `ok mobile process`. In `artifacts/fidelity/desktop/process.jpg`:
- the orange timeline with four dots
- four cards with orange `STEP n` labels, display names, an arrow box, and an output list next to a count such as `2 outputs`
- the CTA banner below

At 1440 px, hovering a card lifts it and adds an orange glow. Then run `npm run test:browser`; expected pass, including reduced-motion (no running animations).

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Process.tsx
git commit -m "feat: restore the process timeline with honest output counts"
```

---

### Task 14: What We Measure (original analytics dashboard, illustrative)

**Files:**
- Create: `src/components/sections/Analytics.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/components/sections/Analytics.tsx`**

```tsx
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import Reveal from "@/components/Reveal";
import { FillBar, FillColumn } from "@/components/motion";
import { Container, SectionHeader } from "@/components/ui";
import { MEASURE, SECTIONS } from "@/lib/content";

const EASE = [0.16, 1, 0.3, 1] as const;

function Dial({ h, m }: { h: number; m: number }) {
  return (
    <svg viewBox="0 0 100 100" className="h-14 w-14" aria-hidden>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#2a2b2e" strokeWidth="2" />
      <line
        x1="50" y1="50" x2={50 + 26 * Math.cos((h - 90) * (Math.PI / 180))}
        y2={50 + 26 * Math.sin((h - 90) * (Math.PI / 180))}
        stroke="#e3dbd8" strokeWidth="3" strokeLinecap="round"
      />
      <line
        x1="50" y1="50" x2={50 + 38 * Math.cos((m - 90) * (Math.PI / 180))}
        y2={50 + 38 * Math.sin((m - 90) * (Math.PI / 180))}
        stroke="#fa6e43" strokeWidth="2.5" strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="3" fill="#fa6e43" />
    </svg>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card/55 p-6 ${className}`}>{children}</div>;
}

export default function Analytics() {
  const reduce = useReducedMotion();
  const w = MEASURE.workflow;
  let acc = 0;
  const conic = w.segments.map((s) => { const from = acc; acc += s.value; return `${s.color} ${from}% ${acc}%`; }).join(", ");
  const [assisted, manual] = MEASURE.throughput.legend;

  return (
    <section id="analytics" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader {...SECTIONS.analytics} />

        {/* top row */}
        <div className="mt-12 grid gap-4 lg:grid-cols-[1.25fr_0.85fr_1.15fr]">
          <Reveal as="div">
            <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MEASURE.imageCard.img} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e] via-[#0b0c0e]/30 to-transparent" />
              <span className="absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                <span className="text-flame">{MEASURE.imageCard.accent}</span> {MEASURE.imageCard.label}
              </span>
              <span className="absolute bottom-5 left-5 text-[15px] font-medium text-flame">
                space<span className="text-ink">—</span>gear
              </span>
            </div>
          </Reveal>

          <Reveal as="div" delay={60}>
            <Card className="h-full">
              <h3 className="text-[14px] font-medium text-ink">{w.title}</h3>
              <p className="text-[12px] text-mut-2">{w.sub}</p>
              <div className="mt-5 flex items-center gap-5">
                <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${conic})` }}>
                  <div className="absolute inset-[13px] grid place-items-center rounded-full bg-card">
                    <span className="display text-xl text-ink-strong">{w.center}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {w.segments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-[12px]">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="flex-1 text-mut">{s.label}</span>
                      <span className="text-ink">{s.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal as="div" delay={120}>
            <Card className="h-full">
              <div className="grid grid-cols-3 gap-3">
                {MEASURE.stages.map((c) => (
                  <div key={c.name} className="flex flex-col items-center text-center">
                    <span className="text-[12px] text-ink">{c.name}</span>
                    <span className="font-mono text-[10px] text-mut-3">{c.note}</span>
                    <div className="my-2"><Dial h={c.hands[0]} m={c.hands[1]} /></div>
                    <span className="text-[11px] text-flame">{c.status}</span>
                    <span className="font-mono text-[10px] text-mut-2">{c.detail}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 border-t border-line-soft pt-3">
                <span className="h-1.5 w-1.5 rounded-full bg-flame pulse-dot" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-2">{MEASURE.stagesFooter}</span>
              </div>
            </Card>
          </Reveal>
        </div>

        {/* bottom row */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr_0.7fr]">
          <Reveal as="div">
            <Card className="flex h-full flex-col">
              <div className="flex flex-1 items-end gap-1.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <FillColumn key={i} value={35 + ((i * 37) % 60)} className="flex-1 rounded-sm bg-flame/80" duration={0.6} delay={i * 0.03} />
                ))}
              </div>
              <p className="mt-4 text-[12px] text-mut-2">{MEASURE.accuracy.label}</p>
              <p className="display mt-1 text-3xl text-ink-strong">
                {MEASURE.accuracy.value}<span className="text-base text-mut-2">{MEASURE.accuracy.unit}</span>
              </p>
              <p className="text-[12px] text-mut-2">{MEASURE.accuracy.sub}</p>
            </Card>
          </Reveal>

          <Reveal as="div" delay={60}>
            <Card className="flex h-full flex-col">
              <h3 className="text-[14px] font-medium text-ink">{MEASURE.throughput.title}</h3>
              <p className="text-[12px] text-mut-2">{MEASURE.throughput.sub}</p>
              <svg viewBox="0 0 200 90" preserveAspectRatio="none" className="mt-3 h-24 w-full" aria-hidden>
                <defs>
                  <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fa6e43" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#fa6e43" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="perfClip">
                    {reduce ? (
                      <rect x="0" y="0" height="90" width="200" />
                    ) : (
                      <motion.rect
                        data-fill-svg=""
                        x="0"
                        y="0"
                        height="90"
                        initial={{ width: 0 }}
                        whileInView={{ width: 200 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, ease: EASE }}
                      />
                    )}
                  </clipPath>
                </defs>
                <g clipPath="url(#perfClip)">
                  <polygon fill="url(#perfFill)" points="0,70 33,55 66,60 100,38 133,42 166,18 200,8 200,90 0,90" />
                  <polyline fill="none" stroke="#5f5f66" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points="0,78 33,72 66,66 100,60 133,55 166,46 200,40" />
                  <polyline fill="none" stroke="#fa6e43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points="0,70 33,55 66,60 100,38 133,42 166,18 200,8" />
                </g>
              </svg>
              <div className="mt-auto flex gap-6 pt-3 text-[12px]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-flame" /> <span className="text-ink">{assisted.value}</span> <span className="text-mut-2">{assisted.label}</span></span>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mut-3" /> <span className="text-ink">{manual.value}</span> <span className="text-mut-2">{manual.label}</span></span>
              </div>
            </Card>
          </Reveal>

          <Reveal as="div" delay={120}>
            <Card className="flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-medium text-ink">{MEASURE.readiness.title}</h3>
                  <p className="text-[12px] text-mut-2">{MEASURE.readiness.sub}</p>
                </div>
                <div className="text-right">
                  <span className="display text-2xl text-flame">{MEASURE.readiness.score}</span>
                  <span className="text-[12px] text-mut-2">/100</span>
                  <p className="text-[10px] text-mut-2">{MEASURE.readiness.scoreLabel}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-1 items-end gap-3">
                {MEASURE.readiness.bars.map((e, i) => (
                  <div key={e.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end rounded-md bg-bg/60">
                      <FillColumn value={e.v} className="w-full rounded-md bg-flame/85" delay={i * 0.08} />
                    </div>
                    <span className="text-[10px] text-ink">{e.v}%</span>
                    <span className="font-mono text-[9px] text-mut-3">{e.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal as="div" delay={180}>
            <div className="flex h-full flex-col gap-4">
              <Card className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-3">{MEASURE.coverage.tag}</span>
                <p className="display mt-2 text-3xl text-ink-strong">{MEASURE.coverage.value}</p>
                <p className="text-[12px] text-mut-2">{MEASURE.coverage.label}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card-3">
                  <FillBar value={MEASURE.coverage.progress} className="h-full rounded-full bg-flame" duration={1} />
                </div>
              </Card>
              <Card className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-3">{MEASURE.connectors.tag}</span>
                <div aria-hidden className="mt-3 flex gap-2">
                  {MEASURE.connectors.glyphs.map((g) => (
                    <span key={g} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">{g}</span>
                  ))}
                </div>
              </Card>
            </div>
          </Reveal>
        </div>

        {/* capabilities marquee */}
        <Reveal delay={120}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card/40 py-4">
            <div className="marquee-track">
              {[...MEASURE.ticker, ...MEASURE.ticker].map((item, i) => (
                <span key={i} aria-hidden={i >= MEASURE.ticker.length} className="mx-4 flex items-center gap-3 text-[14px] text-mut-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-flame" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">{MEASURE.cta.label}</span>
            <Link
              prefetch={false}
              href={MEASURE.cta.href}
              aria-label={MEASURE.cta.label}
              className="grid h-10 w-10 place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-1"
            >
              →
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Put it on the home page in the original position (and retire the delivery example)**

In `src/app/page.tsx`:
- replace `import DeliveryExample from "@/components/sections/DeliveryExample";` with `import Analytics from "@/components/sections/Analytics";`
- remove `<DeliveryExample />`
- insert `<Analytics />` directly after `<Process />`

The order becomes Work, Services, Process, Analytics, Pricing, Faq.

- [ ] **Step 3: Verify**

Static checks, build, restart the preview, then `npm run check:fidelity`.
Expected: `ok desktop analytics` and `ok mobile analytics`, which were missing in Task 2. In `artifacts/fidelity/desktop/analytics.jpg`:
- the header reads "…illustrative example… not client results"
- top row: an image card ("ILLUSTRATIVE EXAMPLE" + `space—gear`), the donut (62% auto-processed), and three stage dials
- bottom row: 14 growing bars (94.6%), a line chart, five readiness bars with the 82/100 score, and the coverage and connectors cards
- the capability marquee, and the arrow CTA

Run `npm run test:browser`; expected pass, including reduced-motion: the marquee and pulse dots are paused by the media query.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Analytics.tsx src/app/page.tsx
git commit -m "feat: restore the analytics dashboard as an illustrative What We Measure section"
```

---

### Task 15: Engagements (original pricing rows, no prices)

**Files:**
- Rewrite: `src/components/sections/Pricing.tsx`

- [ ] **Step 1: Replace `src/components/sections/Pricing.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import { Container, SectionHeader } from "@/components/ui";
import { ENGAGEMENTS, ENGAGEMENTS_FOOTER, SECTIONS, type Engagement } from "@/lib/content";

/** Original billing toggle, repurposed: switch the list between deliverables and outcomes. */
function Toggle({ outcomes, onToggle }: { outcomes: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-[12px]">
      <span className={outcomes ? "text-mut-2" : "text-ink"}>Deliverables</span>
      <button
        type="button"
        role="switch"
        aria-checked={outcomes}
        aria-label="Show outcomes instead of deliverables"
        onClick={() => onToggle(!outcomes)}
        className="relative h-5 w-9 rounded-full bg-card-3 transition-colors"
      >
        <motion.span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-flame"
          animate={{ left: outcomes ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      <span className={outcomes ? "text-ink" : "text-mut-2"}>Outcomes</span>
    </div>
  );
}

function Cell({ label, children, className = "" }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col justify-center p-6 ${className}`}>
      {label && <span className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{label}</span>}
      {children}
    </div>
  );
}

function EngagementRow({ item, selected, onSelect }: { item: Engagement; selected: boolean; onSelect: () => void }) {
  const [outcomes, setOutcomes] = useState(false);
  const list = outcomes ? item.outcomes : item.deliverables;
  return (
    <motion.div
      animate={{
        borderColor: selected ? "#fa6e43" : "#2a2b2e",
        boxShadow: selected ? "0 18px 50px -20px rgba(250,110,67,0.45)" : "0 0 0 0 rgba(0,0,0,0)",
        scale: selected ? 1.01 : 1,
      }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-1 overflow-hidden rounded-2xl border bg-card/40 md:grid-cols-2 lg:grid-cols-[220px_1fr_1fr_1.5fr_auto] lg:divide-x lg:divide-line-soft"
    >
      {/* image tile */}
      <div className="relative h-44 overflow-hidden lg:h-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.img} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e]/70 to-transparent" />
        <span className="absolute left-5 top-5 text-[15px] font-medium text-ink">{item.short}</span>
        {item.featured && (
          <span className="absolute right-4 top-4 rounded-full bg-flame/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-flame">
            Start here
          </span>
        )}
      </div>

      {/* stage + toggle (the original price cell) */}
      <Cell label="Stage">
        <span className="display text-4xl text-ink">{item.stageNo}</span>
        <Toggle outcomes={outcomes} onToggle={setOutcomes} />
      </Cell>

      {/* engagement + focus stacked (the original plan + seats cells) */}
      <div className="grid grid-rows-2 lg:divide-y lg:divide-line-soft">
        <Cell label="Engagement">
          <span className="text-lg text-ink">{item.name}</span>
        </Cell>
        <Cell label="Focus">
          <span className="display text-2xl text-mut">{item.stage}</span>
        </Cell>
      </div>

      {/* deliverables / outcomes */}
      <Cell label={outcomes ? "Outcomes" : "Deliverables"}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-live="polite">
          {list.map((entry) => (
            <li key={entry} className="flex items-center gap-2 text-[12.5px] text-mut">
              <span aria-hidden className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
              {entry}
            </li>
          ))}
        </ul>
      </Cell>

      {/* select */}
      <Cell>
        <motion.button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          whileTap={{ scale: 0.96 }}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-medium transition-colors duration-300 ${
            selected
              ? "bg-flame text-[#161719]"
              : item.featured
                ? "bg-flame/90 text-[#161719] hover:bg-flame"
                : "border border-line text-ink hover:border-flame hover:text-flame"
          }`}
        >
          <motion.span
            key={selected ? "on" : "off"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            {selected ? "✓" : "→"}
          </motion.span>
          {selected ? "Selected" : "Select"}
        </motion.button>
      </Cell>
    </motion.div>
  );
}

export default function Pricing() {
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = ENGAGEMENTS.find((item) => item.name === selected);
  return (
    <section id="pricing" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader {...SECTIONS.pricing} />

        {/* desktop: stacked rows */}
        <div className="mt-12 hidden space-y-4 lg:block">
          {ENGAGEMENTS.map((item, i) => (
            <Reveal as="div" key={item.name} delay={80 + i * 80}>
              <EngagementRow item={item} selected={selected === item.name} onSelect={() => setSelected(item.name)} />
            </Reveal>
          ))}
        </div>

        {/* mobile: swipeable cards */}
        <SnapRow className="mt-10 lg:hidden" itemClassName="w-[85%]">
          {ENGAGEMENTS.map((item) => (
            <EngagementRow key={item.name} item={item} selected={selected === item.name} onSelect={() => setSelected(item.name)} />
          ))}
        </SnapRow>

        {chosen && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center text-[13px] text-flame">
            {chosen.short} selected —{" "}
            <Link prefetch={false} href="/contact/" className="underline underline-offset-4">tell us about your challenge</Link> to get started.
          </motion.p>
        )}

        <Reveal delay={120}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">{ENGAGEMENTS_FOOTER.text}</span>
            <Link
              prefetch={false}
              href={ENGAGEMENTS_FOOTER.href}
              aria-label="Discuss a project"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-1"
            >
              →
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Static checks, build, restart the preview, then `npm run check:fidelity`.
Expected: `ok desktop pricing` and `ok mobile pricing`. In `artifacts/fidelity/desktop/pricing.jpg`:
- three horizontal rows, each with an image tile ("Assess" + "START HERE" badge) and a big `01` stage with the toggle
- stacked Engagement/Focus cells, a two-column ✓ list, and a Select button

At 1440 px, clicking Select gives the row an orange border and lift, and shows the message line. The toggle switches the list. Mobile shows a swipe carousel with dots. `npm run test:browser` passes; at 320 px the snap cards are skipped by design.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Pricing.tsx
git commit -m "feat: restore the pricing rows as engagements without prices"
```

---

### Task 16: Questions & Answers

**Files:**
- Rewrite: `src/components/sections/Faq.tsx` (exports `FaqAccordion`, `StillQuestionsCard`, `CircleBadge`)
- Modify: `src/app/services/[slug]/page.tsx` (import), `scripts/browser-check.mjs`, `scripts/package-site.mjs`, `src/app/legacy.css`

- [ ] **Step 1: Point the browser check at the new accordion (failing first)**

In `scripts/browser-check.mjs`, replace:
```js
    const faq = page.locator(".faq-list details").first();
```
with:
```js
    // second item: closed by default (the first opens on load, as in the original)
    const faq = page.locator(".faq-accordion details").nth(1);
```
Build, restart the preview, run `npm run test:browser`.
Expected: FAIL with a locator timeout on `.faq-accordion details`, because the markup doesn't exist yet.

- [ ] **Step 2: Replace `src/components/sections/Faq.tsx`**

```tsx
"use client";

import { motion } from "motion/react";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader, FlameButton } from "@/components/ui";
import { FAQ_CARD, FAQS, SECTIONS } from "@/lib/content";

type QA = { question: string; answer: string };

/** Two short lines that cross into an X when open. */
function ToggleIcon({ open }: { open: boolean }) {
  return (
    <span aria-hidden className="relative grid h-5 w-5 shrink-0 place-items-center">
      <motion.span
        className="absolute h-[2px] w-4 rounded-full bg-flame"
        animate={{ rotate: open ? 45 : 0, y: open ? 0 : -3 }}
        transition={{ duration: 0.25 }}
      />
      <motion.span
        className="absolute h-[2px] w-4 rounded-full bg-flame"
        animate={{ rotate: open ? -45 : 0, y: open ? 0 : 3 }}
        transition={{ duration: 0.25 }}
      />
    </span>
  );
}

/** Native <details> keeps every answer reachable without JavaScript; the shared
 *  `name` makes the group exclusive, like the original one-open accordion. */
function Item({ item, group, defaultOpen }: { item: QA; group: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      name={group}
      open={defaultOpen}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={`faq-item overflow-hidden rounded-xl border transition-colors duration-300 ${
        open ? "border-flame/40 bg-card-2/60" : "border-line bg-card/40 hover:bg-card-2/40"
      }`}
    >
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="text-[15px] text-ink">{item.question}</span>
        <ToggleIcon open={open} />
      </summary>
      <p className="max-w-xl px-5 pb-5 text-[13.5px] leading-relaxed text-mut-2">{item.answer}</p>
    </details>
  );
}

export function FaqAccordion({ items, group, firstOpen = true }: { items: QA[]; group: string; firstOpen?: boolean }) {
  return (
    <div className="faq-accordion space-y-3">
      {items.map((item, i) => (
        <Item key={item.question} item={item} group={group} defaultOpen={firstOpen && i === 0} />
      ))}
    </div>
  );
}

/** Rotating circular badge with an orange core (matches the footer mark). */
export function CircleBadge() {
  return (
    <div aria-hidden className="relative h-20 w-20">
      <svg viewBox="0 0 100 100" className="spin-16 h-full w-full">
        <defs>
          <path id="faqCircle" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <text className="fill-ink/80 font-mono text-[8px] uppercase tracking-[0.16em]">
          <textPath href="#faqCircle" startOffset="0%">{FAQ_CARD.badge}</textPath>
        </text>
      </svg>
      <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame shadow-[0_0_20px_rgba(250,110,67,0.6)]" />
    </div>
  );
}

export function StillQuestionsCard() {
  return (
    <div className="lg:sticky lg:top-28">
      <div className="overflow-hidden rounded-2xl border border-line bg-card/50">
        <div className="relative h-56 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FAQ_CARD.img} alt={FAQ_CARD.imgAlt} loading="lazy" className="h-full w-full object-cover grayscale" />
          <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
          <div className="absolute bottom-3 right-3">
            <CircleBadge />
          </div>
        </div>
        <div className="p-7 text-center lg:text-left">
          <h3 className="display text-2xl text-ink">{FAQ_CARD.title}</h3>
          <p className="mt-3 text-[13.5px] leading-relaxed text-mut-2">{FAQ_CARD.text}</p>
          <div className="mt-6 flex justify-center lg:justify-start">
            <FlameButton href={FAQ_CARD.href}>{FAQ_CARD.cta}</FlameButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Faq() {
  return (
    <section id="faq" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader {...SECTIONS.faq} />
        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal delay={60}>
            <FaqAccordion items={FAQS} group="home-faq" />
          </Reveal>
          <Reveal delay={100}>
            <StillQuestionsCard />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 3: Keep the service pages compiling (they imported `FaqList`)**

In `src/app/services/[slug]/page.tsx`:
- replace `import { FaqList } from "@/components/sections/Faq";` with `import { FaqAccordion } from "@/components/sections/Faq";`
- replace `<FaqList items={service.faqs}/>` with `<FaqAccordion items={service.faqs} group={`faq-${slug}`}/>`

- [ ] **Step 4: Ship the photo and drop Codex's FAQ CSS**

Add `"images/faq-team.webp"` to the `assets` array in `scripts/package-site.mjs`. Then run:
`node scripts/prune-legacy-css.mjs .faq-grid .faq-list`

- [ ] **Step 5: Verify**

Static checks, build, restart the preview, `npm run test:browser`, `npm run check:fidelity`.
Expected:
- The browser check passes in every profile. With no JavaScript, the `<details>` element still toggles on Enter.
- `ok desktop faq` and `ok mobile faq`.
- The sheet shows 8 questions with the first open (orange border, × icon), the others showing the `=` icon, and the grayscale photo card with the rotating badge, sticky while you scroll.
- Opening another question closes the first.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/Faq.tsx "src/app/services/[slug]/page.tsx" scripts/browser-check.mjs scripts/package-site.mjs src/app/legacy.css
git commit -m "feat: restore the FAQ accordion and photo card with native details"
```

---

### Task 17: Who You Work With (original team carousel, role cards)

**Files:**
- Create: `src/components/sections/Team.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/components/sections/Team.tsx`**

```tsx
"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader } from "@/components/ui";
import { FOUNDER, SECTIONS, TEAM, TEAM_ROLES } from "@/lib/content";

const MEMBERS = FOUNDER ? [FOUNDER, ...TEAM_ROLES] : TEAM_ROLES;
const EASE = [0.16, 1, 0.3, 1] as const;

export default function Team() {
  const [i, setI] = useState(0);
  const m = MEMBERS[i];
  const go = (d: number) => setI((p) => (p + d + MEMBERS.length) % MEMBERS.length);

  return (
    <section id="team" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader {...SECTIONS.team} />

        <Reveal delay={100}>
          <div className="mt-12 overflow-hidden rounded-3xl border border-line bg-card/40">
            <div className="grid lg:grid-cols-[1fr_400px_92px]">
              {/* LEFT: header + name/role + bio */}
              <div className="flex flex-col border-b border-line-soft lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-line-soft px-7 py-5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{TEAM.label}</span>
                  <div aria-hidden className="flex items-center gap-1.5">
                    {MEMBERS.map((_, k) => (
                      <span key={k} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? "w-5 bg-flame" : "w-1.5 bg-mut-3/50"}`} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-7" aria-live="polite">
                  {/* initial={false}: the first card renders in place (no-JS visible, no load animation) */}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`h${i}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, ease: EASE }}
                    >
                      <h3 className="display text-[clamp(24px,2.4vw,34px)] text-ink">{m.name}</h3>
                      <p className="mt-1 text-[13px] text-flame">{m.role}</p>
                    </motion.div>
                  </AnimatePresence>

                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={`b${i}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, ease: EASE, delay: 0.05 }}
                      className="mt-10 max-w-md text-[13px] leading-relaxed text-mut-2"
                    >
                      {m.bio}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* CENTER: image — swipe to change; fixed 3:4 cell */}
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(1);
                  else if (info.offset.x > 60) go(-1);
                }}
                className="relative order-first h-[480px] cursor-grab touch-pan-y overflow-hidden bg-[#0d0e10] active:cursor-grabbing lg:order-none lg:h-[540px]"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.img
                    key={i}
                    src={m.img}
                    alt={m.imgAlt}
                    draggable={false}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  />
                </AnimatePresence>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card/30 to-transparent" />
                <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/60 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mut-2 backdrop-blur lg:hidden">
                  ‹ swipe ›
                </span>
              </motion.div>

              {/* RIGHT: arrows (+ real profile links when a person has them) */}
              <div className="flex flex-row items-center justify-between border-t border-line-soft lg:flex-col lg:justify-start lg:border-l lg:border-t-0">
                <div className="flex gap-2 p-5 lg:w-full lg:justify-center lg:gap-3 lg:border-b lg:border-line-soft">
                  <button type="button" onClick={() => go(-1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame">←</button>
                  <button type="button" onClick={() => go(1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame">→</button>
                </div>
                {m.links.length > 0 && (
                  <div className="flex gap-3 p-5 lg:mt-6 lg:flex-col lg:gap-5">
                    {m.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.label}
                        className="grid h-7 w-7 place-items-center rounded text-[13px] text-mut-3 transition-colors hover:text-flame"
                      >
                        {link.label.slice(0, 2).toLowerCase()}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">{TEAM.cta.label}</span>
            <Link
              prefetch={false}
              href={TEAM.cta.href}
              aria-label={TEAM.cta.label}
              className="grid h-10 w-10 place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-1"
            >
              →
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Add it to the home page after the FAQ**

In `src/app/page.tsx`, add `import Team from "@/components/sections/Team";` and insert `<Team />` after `<Faq />`.

- [ ] **Step 3: Verify**

Static checks, build, restart the preview, `npm run test:browser`, `npm run check:fidelity`.
Expected:
- Browser check passes; the no-JS transparency assertion finds nothing, because `initial={false}` renders the first card in place.
- `ok desktop team` and `ok mobile team`. The `team` sheet shows the carousel card: header label + dots, "Strategy & Discovery / Direction" + bio, a 400 px image column and an arrows column.
- Arrows and swipe change the card with the original fade/slide.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Team.tsx src/app/page.tsx
git commit -m "feat: restore the team carousel as role cards without invented people"
```

---

### Task 18: Testimonials and Labs (data-gated) with a dev-only sample mode

**Files:**
- Create: `src/lib/samples.ts`, `src/components/sections/Testimonials.tsx`, `src/components/sections/Labs.tsx`
- Modify: `src/app/page.tsx`, `scripts/check-content.mjs`, `scripts/check-export.mjs`

- [ ] **Step 1: Create `src/lib/samples.ts`**

```ts
// Development-only preview data for the Testimonials and Labs layouts.
// These are NOT real clients or articles. Sections read them only when
// `next dev` runs with NEXT_PUBLIC_SHOW_SAMPLES=true. Production builds cannot
// render them: NODE_ENV is "production", check-content refuses the flag, and
// check-export fails if SAMPLE_MARKER appears in exported HTML.
import type { Article, Testimonial } from "./content";

export const SAMPLE_MARKER = "spacegear-sample-content";
export const SHOW_SAMPLES = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SHOW_SAMPLES === "true";

export const SAMPLE_TESTIMONIALS: Testimonial[] = [
  { img: "/images/reviews/r1.webp", name: "Sample Person A", role: "Sample role", company: "Sample Co.", quote: "Sample quote. Replace with a real, permission-confirmed testimonial before launch.", permissionConfirmed: true },
  { img: "/images/reviews/r2.webp", name: "Sample Person B", role: "Sample role", company: "Sample Co.", quote: "Sample quote. Shows how a longer testimonial wraps inside the original quote card layout.", permissionConfirmed: true },
  { img: "/images/reviews/r3.webp", name: "Sample Person C", role: "Sample role", company: "Sample Co.", quote: "Sample quote. Thumbnails below switch between entries, as in the original.", permissionConfirmed: true },
];

export const SAMPLE_ARTICLES: Article[] = [
  { slug: "sample-a", author: "Sample author", title: "Sample article title", sub: "Sample summary. Replace with a published article.", img: "/images/labs/ethical-ai.webp", href: "/" },
  { slug: "sample-b", author: "Sample author", title: "Sample article title", sub: "Sample summary. Replace with a published article.", img: "/images/labs/zero-latency.webp", href: "/" },
  { slug: "sample-c", author: "Sample author", title: "Sample article title", sub: "Sample summary. Replace with a published article.", img: "/images/labs/observability.webp", href: "/" },
  { slug: "sample-d", author: "Sample author", title: "Sample article title", sub: "Sample summary. Replace with a published article.", img: "/images/labs/process-automation.webp", href: "/" },
];
```

- [ ] **Step 2: Create `src/components/sections/Testimonials.tsx`**

```tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader } from "@/components/ui";
import { SECTIONS, TESTIMONIALS } from "@/lib/content";
import { SAMPLE_MARKER, SAMPLE_TESTIMONIALS, SHOW_SAMPLES } from "@/lib/samples";

const USING_SAMPLES = TESTIMONIALS.length === 0 && SHOW_SAMPLES;
const REVIEWS = TESTIMONIALS.length ? TESTIMONIALS : USING_SAMPLES ? SAMPLE_TESTIMONIALS : [];
const EASE = [0.16, 1, 0.3, 1] as const;

export default function Testimonials() {
  const [i, setI] = useState(0);
  // Renders only real, permission-confirmed quotes (or dev samples).
  if (REVIEWS.length === 0) return null;
  const r = REVIEWS[i];
  const go = (d: number) => setI((p) => (p + d + REVIEWS.length) % REVIEWS.length);

  return (
    <section id="testimonials" data-sample={USING_SAMPLES ? SAMPLE_MARKER : undefined} className="relative scroll-mt-24 py-24">
      <Container>
        {USING_SAMPLES && <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-flame">Sample content — not a real client</p>}
        <SectionHeader {...SECTIONS.testimonials} />

        <Reveal delay={100}>
          <div className="mt-12 overflow-hidden rounded-3xl border border-line bg-card/40">
            <div className="grid lg:grid-cols-[300px_1fr_120px]">
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(1);
                  else if (info.offset.x > 60) go(-1);
                }}
                className="relative order-first h-72 cursor-grab touch-pan-y overflow-hidden bg-[#0d0e10] active:cursor-grabbing lg:h-auto lg:cursor-default lg:border-r lg:border-line-soft"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.img
                    key={i}
                    src={r.img}
                    alt={r.name}
                    draggable={false}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover grayscale"
                  />
                </AnimatePresence>
                <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/60 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mut-2 backdrop-blur lg:hidden">‹ swipe ›</span>
              </motion.div>

              <div className="flex flex-col justify-between p-8">
                <span aria-hidden className="display text-5xl leading-none text-flame">“</span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.blockquote
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="mt-4 max-w-xl text-[clamp(16px,1.6vw,21px)] italic leading-relaxed text-ink"
                  >
                    {r.quote}
                  </motion.blockquote>
                </AnimatePresence>
                <div className="mt-8 flex items-end justify-between border-t border-line-soft pt-6">
                  <div>
                    <p className="display text-xl text-ink">{r.name}</p>
                    <p className="text-[12px] text-mut-2">{r.role}</p>
                  </div>
                  <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-mut-2">{r.company}</span>
                </div>
              </div>

              <div className="hidden flex-col items-center justify-center gap-4 border-l border-line-soft lg:flex">
                <button type="button" onClick={() => go(-1)} aria-label="Previous" className="grid h-10 w-10 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame">←</button>
                <button type="button" onClick={() => go(1)} aria-label="Next" className="grid h-10 w-10 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame">→</button>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-line-soft px-5 py-4">
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-mut-3 sm:block">Reviews</span>
              <div aria-hidden className="flex items-center gap-1.5">
                {REVIEWS.map((_, k) => (
                  <span key={k} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? "w-5 bg-flame" : "w-1.5 bg-mut-3/50"}`} />
                ))}
              </div>
              <div className="ml-auto flex gap-2 lg:hidden">
                <button type="button" onClick={() => go(-1)} aria-label="Previous" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">←</button>
                <button type="button" onClick={() => go(1)} aria-label="Next" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">→</button>
              </div>
            </div>

            <div className="scrollbar-none flex gap-2 overflow-x-auto border-t border-line-soft p-3">
              {REVIEWS.map((rv, k) => (
                <button
                  type="button"
                  key={rv.name}
                  onClick={() => setI(k)}
                  aria-label={`Show ${rv.name}`}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition-all duration-300 ${k === i ? "border-flame ring-1 ring-flame" : "border-line opacity-60 hover:opacity-100"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={rv.img} alt="" className={`h-full w-full object-cover ${k === i ? "" : "grayscale"}`} />
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
```

- [ ] **Step 3: Create `src/components/sections/Labs.tsx`**

```tsx
import Link from "next/link";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import { Container, SectionHeader } from "@/components/ui";
import { ARTICLES, SECTIONS, type Article } from "@/lib/content";
import { SAMPLE_ARTICLES, SAMPLE_MARKER, SHOW_SAMPLES } from "@/lib/samples";

const USING_SAMPLES = ARTICLES.length === 0 && SHOW_SAMPLES;
const ITEMS = ARTICLES.length ? ARTICLES : USING_SAMPLES ? SAMPLE_ARTICLES : [];

function ArticleCard({ a }: { a: Article }) {
  const external = /^https?:\/\//.test(a.href);
  const className = "group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card/50 transition-colors hover:border-flame/40";
  const body = (
    <>
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2 font-mono text-[11px] text-mut-3">
          <span>Written by</span>
          <span className="text-mut">{a.author}</span>
        </div>
        <h3 className="mt-4 text-lg font-medium leading-snug text-ink transition-colors group-hover:text-ink-strong">{a.title}</h3>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-mut-2">{a.sub}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-[13px] text-flame">
          Read article
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </>
  );
  return external ? (
    <a href={a.href} target="_blank" rel="noopener noreferrer" className={className}>{body}</a>
  ) : (
    <Link prefetch={false} href={a.href} className={className}>{body}</Link>
  );
}

export default function Labs() {
  // Renders only real published articles (or dev samples).
  if (ITEMS.length === 0) return null;
  return (
    <section id="labs" data-sample={USING_SAMPLES ? SAMPLE_MARKER : undefined} className="relative scroll-mt-24 py-24">
      <Container>
        {USING_SAMPLES && <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-flame">Sample content — not a real article</p>}
        <SectionHeader {...SECTIONS.labs} />

        <div className="mt-12 hidden gap-4 sm:grid sm:grid-cols-2">
          {ITEMS.map((a, i) => (
            <Reveal key={a.slug} delay={80 + i * 70}>
              <ArticleCard a={a} />
            </Reveal>
          ))}
        </div>

        <SnapRow className="mt-10 sm:hidden" itemClassName="w-[85%]">
          {ITEMS.map((a) => (
            <ArticleCard key={a.slug} a={a} />
          ))}
        </SnapRow>
      </Container>
    </section>
  );
}
```

- [ ] **Step 4: Add both to the home page**

In `src/app/page.tsx`, add:
```tsx
import Testimonials from "@/components/sections/Testimonials";
import Labs from "@/components/sections/Labs";
```
and insert `<Testimonials />` and `<Labs />` after `<Team />`. The final order is Work, Services, Process, Analytics, Pricing, Faq, Team, Testimonials, Labs, which matches the original.

- [ ] **Step 5: Refuse samples in production**

In `scripts/check-content.mjs`, before the line `if (errors.length) {`, insert:
```js
if (mode === "production" && process.env.NEXT_PUBLIC_SHOW_SAMPLES === "true") errors.push("sample sections cannot be enabled for production");
```

In `scripts/check-export.mjs`, before the line `if(errors.length){console.error(...`, insert:
```js
// Sample preview content (src/lib/samples.ts) must never be rendered into the export.
async function scanSamples(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scanSamples(file);else if(/\.(html|txt)$/.test(entry.name)&&(await fs.readFile(file,"utf8")).includes("spacegear-sample-content"))errors.push(`Sample content exported: ${path.relative(root,file)}`);}}
await scanSamples(root);
```

- [ ] **Step 6: Verify both modes**

Production-style build (no samples):
Run: `npm run lint && npm run typecheck && npm test && npm run build:cf`
Expected: pass; `Export valid…`. `grep -c 'id="testimonials"' dist/index.html` prints `0`. With the preview restarted, `npm run check:fidelity` reports `ok … testimonials optional, not rendered` and the same for `labs`.

Sample preview (dev only):
Run: `NEXT_PUBLIC_SHOW_SAMPLES=true npx next dev -p 3200`, then open http://127.0.0.1:3200/#testimonials.
Expected: both sections render with the orange "Sample content — not a real …" label. They look like the original's quote card with thumbnails and the 2×2 article grid. Stop the dev server.

Guard check:
Run: `SITE_MODE=production NEXT_PUBLIC_SHOW_SAMPLES=true node --experimental-strip-types scripts/check-content.mjs --production`
Expected: exits 1, listing `sample sections cannot be enabled for production` along with the existing missing-contact and policy errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/samples.ts src/components/sections/Testimonials.tsx src/components/sections/Labs.tsx src/app/page.tsx scripts/check-content.mjs scripts/check-export.mjs
git commit -m "feat: restore testimonials and labs, rendered only from real entries"
```

---

### Task 19: Footer and quick start (TDD for the hand-off)

**Files:**
- Create: `src/lib/quickstart.ts`, `src/components/QuickStart.tsx`
- Rewrite: `src/components/sections/Footer.tsx`
- Modify: `src/components/ContactForm.tsx`, `scripts/browser-check.mjs`

- [ ] **Step 1: Write the failing browser assertions**

In `scripts/browser-check.mjs`, in the form-fixture block:

(a) Replace:
```js
  await formPage.goto(`${base}/__form-fixture/`, { waitUntil: "networkidle" });
```
with:
```js
  await formPage.addInitScript(() => {
    if (sessionStorage.getItem("fixture-prefilled")) return;
    sessionStorage.setItem("fixture-prefilled", "1");
    sessionStorage.setItem("spacegear:quickstart", JSON.stringify({ name: "Sam Quickstart", email: "sam@gmail.com" }));
  });
  await formPage.goto(`${base}/__form-fixture/`, { waitUntil: "networkidle" });
  await formPage.waitForFunction(() => document.querySelector("#name")?.value === "Sam Quickstart");
  assert.equal(await formPage.locator("#email").inputValue(), "sam@gmail.com", "quick-start email prefilled");
  assert.equal(await formPage.evaluate(() => sessionStorage.getItem("spacegear:quickstart")), null, "quick-start details are used once");
```

(b) After the line `report.interactions.push("native FAQ keyboard toggles, contact service selection, compact viewport/text zoom, preview form disabled");`, insert:
```js
  const quick = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await quick.goto(base, { waitUntil: "networkidle" });
  await quick.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await quick.waitForTimeout(400);
  await quick.getByLabel("Your name").fill("Robin Footer");
  await quick.getByLabel("Your email").fill("robin@gmail.com");
  await quick.getByRole("button", { name: "Continue to the project brief" }).click();
  await quick.waitForURL("**/contact/");
  await quick.waitForFunction(() => document.querySelector("#name")?.value === "Robin Footer");
  assert.equal(await quick.locator("#email").inputValue(), "robin@gmail.com");
  assert.equal(new URL(quick.url()).search, "", "quick start keeps personal details out of the URL");
  await quick.close();
  report.interactions.push("footer quick start hands name and email to the contact form without using the URL");
```

Build, restart the preview, run `npm run test:browser`.
Expected: FAIL at `waitForFunction` (timeout). Nothing reads the stored details yet.

- [ ] **Step 2: Shared key**

Create `src/lib/quickstart.ts`:
```ts
/** sessionStorage key: footer quick-start form → contact form pre-fill. */
export const QUICKSTART_KEY = "spacegear:quickstart";
```

- [ ] **Step 3: Contact form reads the hand-off**

In `src/components/ContactForm.tsx`:
- after `import Link from "next/link";` add `import { QUICKSTART_KEY } from "../lib/quickstart";` (relative, so the esbuild fixture and the tsx test resolve it).
- after the `useEffect` that pre-selects `?service=`, add:
```tsx
  useEffect(() => {
    // Name and email handed over by the footer quick-start form (never via the URL).
    try {
      const saved = sessionStorage.getItem(QUICKSTART_KEY);
      if (!saved) return;
      sessionStorage.removeItem(QUICKSTART_KEY);
      const { name, email } = JSON.parse(saved) as { name?: unknown; email?: unknown };
      const fields = form.current?.elements;
      const nameInput = fields?.namedItem("name") as HTMLInputElement | null;
      const emailInput = fields?.namedItem("email") as HTMLInputElement | null;
      if (nameInput && typeof name === "string") nameInput.value = name.slice(0, 100);
      if (emailInput && typeof email === "string") emailInput.value = email.slice(0, 254);
    } catch {
      // Storage unavailable or malformed: the visitor simply types their details.
    }
  }, []);
```

- [ ] **Step 4: Quick-start form**

Create `src/components/QuickStart.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useRef, type FormEvent } from "react";
import { QUICKSTART_KEY } from "@/lib/quickstart";

/** Footer "start with one challenge" form (the original newsletter look).
 *  Carries name + email to the contact page through sessionStorage so the
 *  details never appear in a URL. Without JavaScript it opens the contact
 *  page; the inputs have no `name`, so nothing is submitted. */
export default function QuickStart() {
  const router = useRouter();
  const name = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      sessionStorage.setItem(QUICKSTART_KEY, JSON.stringify({ name: name.current?.value.trim() ?? "", email: email.current?.value.trim() ?? "" }));
    } catch {
      // Storage unavailable (private mode): the contact page still opens.
    }
    router.push("/contact/");
  }

  const input = "w-full rounded-xl border border-line bg-card-2/60 px-4 py-3.5 text-[14px] text-ink placeholder:text-mut-2 focus:border-flame focus:outline-none";
  return (
    <form action="/contact/" method="get" onSubmit={submit} className="mt-6 space-y-3">
      <input ref={name} type="text" autoComplete="name" maxLength={100} aria-label="Your name" placeholder="Your Name" className={input} />
      <div className="flex gap-2">
        <input ref={email} type="email" autoComplete="email" maxLength={254} aria-label="Your email" placeholder="Your Email" className={input} />
        <button
          type="submit"
          aria-label="Continue to the project brief"
          className="grid aspect-square h-[50px] place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-0.5"
        >
          →
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Replace `src/components/sections/Footer.tsx`** (server component; the badge spins in CSS)

```tsx
import Link from "next/link";
import QuickStart from "@/components/QuickStart";
import { Container } from "@/components/ui";
import { FOOTER } from "@/lib/content";
import { SITE } from "@/lib/site";

/** Rotating circular wordmark badge with an orange core. */
function CircleBadge() {
  return (
    <div aria-hidden className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="spin-18 h-full w-full">
        <defs>
          <path id="circlePath" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
        </defs>
        <text className="fill-mut-2 font-mono text-[8.5px] uppercase tracking-[0.18em]">
          <textPath href="#circlePath" startOffset="0%">{FOOTER.badge}</textPath>
        </text>
      </svg>
      <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame shadow-[0_0_24px_rgba(250,110,67,0.6)]" />
    </div>
  );
}

function DotHeader() {
  return (
    <div aria-hidden className="mb-6 flex gap-1.5">
      <span className="h-1.5 w-5 rounded-full bg-flame" />
      <span className="h-1.5 w-1.5 rounded-full bg-mut-3/60" />
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  const pill = "grid h-9 place-items-center rounded-lg border border-line px-3 text-mut-2 transition-colors hover:border-flame hover:text-flame";
  return (
    <footer id="contact" className="relative overflow-hidden border-t border-line bg-[#0c0d0f]">
      <Container className="py-12">
        {/* top bento */}
        <div className="grid overflow-hidden rounded-3xl border border-line bg-card/30 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col items-center gap-6 border-b border-line-soft p-6 text-center sm:p-8 lg:items-start lg:justify-between lg:gap-10 lg:border-b-0 lg:border-r lg:text-left">
            <CircleBadge />
            <p className="max-w-xs text-[15px] leading-snug text-mut lg:border-l lg:border-line lg:pl-4">{FOOTER.tagline}</p>
          </div>

          <div className="relative overflow-hidden p-6 text-center sm:p-8 lg:text-left">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_70%_40%,rgba(250,110,67,0.08),transparent_60%)]" />
            {SITE.contactEmail ? (
              <a href={`mailto:${SITE.contactEmail}`} className="relative inline-block text-[13px] text-mut-2 transition-colors hover:text-flame lg:float-right">
                {SITE.contactEmail}
              </a>
            ) : (
              <Link prefetch={false} href="/contact/" className="relative inline-block text-[13px] text-mut-2 transition-colors hover:text-flame lg:float-right">
                Discuss a project ↗
              </Link>
            )}
            <div className="relative mt-4 lg:mt-8">
              {/* sized so "space—gear" (one glyph wider than "plat—form") fills the same cell */}
              <h2 aria-label="spacegear.tech" className="display text-[clamp(48px,10.8vw,116px)] leading-[0.85] text-flame">
                space<span className="text-ink">—</span>gear
                <sup className="ml-1 align-top text-base text-mut-3">™</sup>
              </h2>
              <div className="mt-5 text-[13px] leading-relaxed text-mut-2 lg:mt-6">
                <p>{FOOTER.identity[0]}</p>
                <p>{FOOTER.identity[1]}</p>
                <p className="font-medium text-ink">{FOOTER.identityStrong}</p>
              </div>
            </div>
          </div>
        </div>

        {/* middle bento */}
        <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-card/30 lg:grid lg:grid-cols-[0.6fr_0.6fr_1.1fr]">
          <div className="grid grid-cols-2 border-b border-line-soft lg:contents lg:border-b-0">
            {FOOTER.columns.map((col, ci) => (
              <nav
                key={ci}
                aria-label={ci === 0 ? "Home page sections" : "Pages"}
                className={`p-6 sm:p-8 lg:border-r lg:border-line-soft ${ci === 0 ? "border-r border-line-soft lg:border-r" : ""}`}
              >
                <DotHeader />
                <ul className="space-y-3">
                  {col.map((it) => (
                    <li key={it.href}>
                      <Link prefetch={false} href={it.href} className="text-[14px] text-mut-2 transition-colors hover:text-ink">{it.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            <h3 className="display text-2xl text-ink-strong">{FOOTER.quickStart.title}</h3>
            <p className="mt-2 text-[13px] text-mut-2">
              {FOOTER.quickStart.text} <span className="text-flame">*</span>
            </p>
            <QuickStart />
            <p className="mt-4 text-[12px] text-mut-2">
              By continuing, you agree to our{" "}
              <Link prefetch={false} href="/privacy/" className="text-flame hover:underline">Privacy policy.</Link>
            </p>
            <p className="mt-2 text-[12px] text-flame">* {FOOTER.quickStart.note}</p>
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-4 grid overflow-hidden rounded-3xl border border-line bg-card/30 text-[12px] lg:grid-cols-[1fr_1.2fr_auto_auto]">
          <div className="border-b border-line-soft p-6 text-mut-2 lg:border-b-0 lg:border-r">
            <p>© {year} spacegear.tech. All rights reserved.</p>
            <p className="mt-2">Digital transformation &amp; AI consulting.</p>
          </div>
          <div className="border-b border-line-soft p-6 text-mut-2 lg:border-b-0 lg:border-r">
            <span className="font-medium text-ink">spacegear.tech</span> {FOOTER.about}
          </div>
          <div className="flex items-center gap-3 border-b border-line-soft p-6 lg:border-b-0 lg:border-r">
            {SITE.socialProfiles.length > 0 ? (
              SITE.socialProfiles.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={new URL(url).hostname} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-mut-2 transition-colors hover:border-flame hover:text-flame">
                  {new URL(url).hostname.replace(/^www\./, "").slice(0, 2)}
                </a>
              ))
            ) : (
              <>
                <Link prefetch={false} href="/privacy/" className={pill}>Privacy</Link>
                <Link prefetch={false} href="/terms/" className={pill}>Terms</Link>
              </>
            )}
          </div>
          <a href="#top" aria-label="Back to top" className="grid place-items-center p-6 text-flame transition-colors hover:bg-card-2">
            <span aria-hidden className="text-xl">↑</span>
          </a>
        </div>
      </Container>
    </footer>
  );
}
```

- [ ] **Step 6: Verify (the Step 1 assertions now pass)**

Run: `npm run lint && npm run typecheck && npm test` (the `contact-render` test must still pass), then `npm run build:cf`, restart the preview, `npm run test:browser`.
Expected: pass, with the new interaction "footer quick start hands name and email…" recorded.

Run: `npm run check:fidelity`; expected `ok desktop contact` and `ok mobile contact`. Open `artifacts/fidelity/desktop/contact.jpg` and confirm:
- three bentos: the rotating badge + tagline; the giant orange `space—gear™`, fully inside its cell with no clipping; and the identity lines
- two link columns with dot headers, and the quick-start form
- the bottom bar with Privacy/Terms pills and ↑

At 1440×1000 the footer is revealed by the curtain at the bottom of every page.

- [ ] **Step 7: Commit**

```bash
git add src/lib/quickstart.ts src/components/QuickStart.tsx src/components/sections/Footer.tsx src/components/ContactForm.tsx scripts/browser-check.mjs
git commit -m "feat: restore the original footer with a privacy-preserving quick start"
```

---

### Task 20: Inner pages in the original vocabulary

**Files:**
- Rewrite: `src/components/PageIntro.tsx`, `src/app/services/page.tsx`, `src/app/services/[slug]/page.tsx`, `src/app/approach/page.tsx`, `src/app/about/page.tsx`, `src/app/contact/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/not-found.tsx`

- [ ] **Step 1: Replace `src/components/PageIntro.tsx`** (header of the original `/services` page)

```tsx
import Link from "next/link";

/** Inner-page header from the original /services page: back link, eyebrow, display H1, lead. */
export default function PageIntro({
  eyebrow,
  title,
  description,
  back = { href: "/", label: "Home" },
}: {
  eyebrow: string;
  title: string;
  description: string;
  back?: { href: string; label: string };
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link prefetch={false} href={back.href} className="font-mono text-[12px] text-mut-2 transition-colors hover:text-flame">
          ← {back.label}
        </Link>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
          {eyebrow}
        </span>
      </div>
      <h1 className="display mt-6 max-w-3xl break-words text-[clamp(32px,6vw,72px)] text-ink">{title}</h1>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">{description}</p>
    </>
  );
}
```

- [ ] **Step 2: Replace `src/app/services/page.tsx`** (original services list layout)

```tsx
import Link from "next/link";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { ArrowIcon, Container, CtaBand } from "@/components/ui";
import { PILLARS, serviceBySlug } from "@/lib/content";
import { buildMetadata, breadcrumbData } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Services", description: "Explore digital transformation strategy, AI consulting, applied AI and deep learning, automation, integration and digital product delivery.", path: "/services/" });

export default function ServicesPage() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-20">
        <Container>
          <PageIntro
            eyebrow="Strategy & delivery"
            title="Flexible services for modernizing operations and putting AI to work."
            description="Five capabilities — plan, build, connect and improve — that work on their own or together, from the first decision to daily use."
          />

          <div className="mt-12 space-y-4">
            {PILLARS.map((pillar) => {
              const service = serviceBySlug(pillar.slug);
              const href = `/services/${service.slug}/`;
              return (
                <article
                  key={service.slug}
                  className="grid gap-6 overflow-hidden rounded-3xl border border-line bg-card/50 p-8 lg:grid-cols-[80px_1fr_320px] lg:items-center"
                >
                  <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                    <span className="display text-3xl text-flame">{pillar.no}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{pillar.tag}</span>
                  </div>
                  <div>
                    <h2 className="display text-2xl text-ink">
                      <Link prefetch={false} href={href} className="transition-colors hover:text-flame">{service.name}</Link>
                    </h2>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mut-2">{service.buyerProblem}</p>
                    <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                      {service.deliverables.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-[13px] text-mut">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-flame" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link prefetch={false} href={href} className="group mt-6 inline-flex items-center gap-2 text-[13px] text-flame">
                      Explore this service <ArrowIcon />
                    </Link>
                  </div>
                  <div className="relative h-44 overflow-hidden rounded-2xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pillar.img} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                </article>
              );
            })}
          </div>

          <CtaBand title="Plan, build, connect and improve." text="See how the services work together for your organization." />
        </Container>
      </section>
      <StructuredData data={breadcrumbData([{ name: "Home", path: "/" }, { name: "Services", path: "/services/" }])} />
    </main>
  );
}
```

- [ ] **Step 3: Replace `src/app/services/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { Container, CtaBand, FlameButton, SectionHeader } from "@/components/ui";
import { ProcessSteps } from "@/components/sections/Process";
import { FaqAccordion, StillQuestionsCard } from "@/components/sections/Faq";
import { Tile } from "@/components/sections/Work";
import { PILLARS, SERVICES } from "@/lib/content";
import { SITE } from "@/lib/site";
import { buildMetadata, breadcrumbData, canonicalUrl } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return SERVICES.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = SERVICES.find((item) => item.slug === slug);
  if (!service) notFound();
  return buildMetadata({ title: service.name, description: service.summary, path: `/services/${slug}/` });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = SERVICES.find((item) => item.slug === slug);
  if (!service) notFound();
  const pillar = PILLARS.find((item) => item.slug === slug);
  const related = PILLARS.filter((item) => item.slug !== slug);

  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro eyebrow={service.category} title={service.name} description={service.summary} back={{ href: "/services/", label: "Services" }} />

          <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col justify-between gap-8 rounded-3xl border border-line bg-card/50 p-8">
              <div>
                <h2 className="display text-[clamp(26px,3vw,40px)] text-ink">Start with the work you want to improve.</h2>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">{service.buyerProblem}</p>
              </div>
              <FlameButton href={`/contact/?service=${slug}`} className="w-fit">Discuss a project</FlameButton>
            </div>
            <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
              <div className="flex items-center justify-between border-b border-line-soft pb-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">What you receive</span>
                <span className="font-mono text-[12px] tracking-[0.2em] text-flame">{String(service.deliverables.length).padStart(2, "0")}</span>
              </div>
              <ul className="space-y-3">
                {service.deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-mut">
                    <span aria-hidden className="mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              {pillar && (
                <div className="relative mt-auto h-40 overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pillar.img} alt="" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-24">
            <SectionHeader title="How It Works" index="001" heading="From first conversation to a useful outcome." description="Scope, access, responsibilities and acceptance criteria are agreed before delivery." />
            <ProcessSteps steps={service.process.map((desc, i) => ({ step: `Step ${i + 1}`, desc, outputs: [] }))} gridClassName="md:grid-cols-3" />
          </div>

          <div className="mt-24">
            <SectionHeader title="Questions & Answers" index="002" heading="A few useful answers about this service." description="Ask us anything else when we talk." />
            <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <FaqAccordion items={service.faqs} group={`faq-${slug}`} />
              <StillQuestionsCard />
            </div>
          </div>

          <div className="mt-24">
            <SectionHeader title="Related Services" index="003" heading="Capabilities that often work together." description="Each one also works on its own." />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <div key={item.slug} className="h-[260px]">
                  <Tile slug={item.slug} name={item.name} img={item.img} desc={item.desc} href={`/services/${item.slug}/`} />
                </div>
              ))}
            </div>
          </div>

          <CtaBand title="Tell us what you want to improve." text="Share the challenge. We’ll suggest a sensible first step." href={`/contact/?service=${slug}`} />
        </Container>
      </section>
      <StructuredData data={{ "@context": "https://schema.org", "@type": "Service", name: service.name, description: service.summary, url: canonicalUrl(`/services/${slug}/`), provider: { "@id": `${SITE.origin}/#organization` } }} />
      <StructuredData data={breadcrumbData([{ name: "Home", path: "/" }, { name: "Services", path: "/services/" }, { name: service.name, path: `/services/${slug}/` }])} />
    </main>
  );
}
```

- [ ] **Step 4: Replace `src/app/approach/page.tsx`**

```tsx
import PageIntro from "@/components/PageIntro";
import { ProcessSteps } from "@/components/sections/Process";
import { Container, CtaBand } from "@/components/ui";
import { APPROACH_STEPS } from "@/lib/content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Our Approach", description: "Assess, prioritize, validate, deliver and adopt. A practical approach to digital transformation and AI implementation with clear decisions and handover.", path: "/approach/" });

export default function Approach() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro
            eyebrow="How we work"
            title="A clear path from intention to implementation."
            description="Useful deliverables, visible decisions and a shared understanding of what comes next. The depth of each stage follows the engagement."
          />
          <ProcessSteps steps={APPROACH_STEPS} gridClassName="md:grid-cols-2 xl:grid-cols-5" />
          <CtaBand title="Start with the challenge in front of you." text="Tell us where you are and we’ll suggest a sensible starting point." />
        </Container>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Replace `src/app/about/page.tsx`**

```tsx
import PageIntro from "@/components/PageIntro";
import DotField from "@/components/DotField";
import Team from "@/components/sections/Team";
import { Container, CtaBand } from "@/components/ui";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "About", description: "spacegear.tech connects digital transformation and AI strategy with hands-on delivery, practical implementation and adoption.", path: "/about/" });

const PRINCIPLES = ["Understand before recommending", "Make assumptions visible and testable", "Design for the whole workflow", "Keep human judgment where it matters", "Make handover part of delivery"];

export default function About() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-12">
        <Container>
          <PageIntro
            eyebrow="About spacegear.tech"
            title="Good thinking should become useful work."
            description="We connect business strategy, technology and delivery to help you make a meaningful change in the way work gets done."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-line bg-card/50 p-8">
              <h2 className="display text-[clamp(26px,3vw,40px)] text-ink">Business context first. Technology with a purpose.</h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">Digital transformation starts with a real challenge. We look at the work, the people using the systems and the constraints around them, then choose an approach that makes sense.</p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">AI and deep learning are part of the toolkit. So are process design, integration and thoughtful software engineering. The goal is a solution you can operate, understand and improve.</p>
            </div>
            <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
              <div className="flex items-center justify-between border-b border-line-soft pb-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">Working principles</span>
                <span className="font-mono text-[12px] tracking-[0.2em] text-flame">0{PRINCIPLES.length}</span>
              </div>
              <ul className="space-y-3">
                {PRINCIPLES.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[13.5px] text-mut">
                    <span aria-hidden className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <DotField cols={5} rows={3} className="mt-auto gap-y-4 px-1" />
            </div>
          </div>
        </Container>
      </section>
      <Team />
      <section className="pb-24">
        <Container>
          <CtaBand title="From the first decision to what happens next." text="We bring strategy and implementation into the same conversation." cta="See how we work" href="/approach/" />
        </Container>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Replace `src/app/contact/page.tsx`**

```tsx
import PageIntro from "@/components/PageIntro";
import ContactForm from "@/components/ContactForm";
import { CircleBadge } from "@/components/sections/Faq";
import { Container } from "@/components/ui";
import { FAQ_CARD, SERVICES } from "@/lib/content";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Discuss a Project", description: "Tell spacegear.tech what you want to improve. Start a conversation about digital transformation, AI, automation or software delivery.", path: "/contact/" });

export default function Contact() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro
            eyebrow="Let’s start a conversation"
            title="What would you like to improve?"
            description="A challenge, an idea or a project already in motion. Tell us where you are and what you want to make possible."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <aside className="overflow-hidden rounded-2xl border border-line bg-card/50">
              <div className="relative h-56 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FAQ_CARD.img} alt={FAQ_CARD.imgAlt} className="h-full w-full object-cover grayscale" />
                <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
                <div className="absolute bottom-3 right-3"><CircleBadge /></div>
              </div>
              <div className="p-7">
                <h2 className="display text-2xl text-ink">A useful next step starts here.</h2>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mut-2">You don’t need a finished brief or ready-to-use data. Share what you know, and we can work through the next questions together.</p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mut-2">We review your brief and respond about a suitable next step.</p>
                {SITE.contactEmail && (
                  <p className="mt-5"><a className="text-[13px] text-flame hover:underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></p>
                )}
              </div>
            </aside>
            <ContactForm services={SERVICES.map(({ slug, shortName }) => ({ slug, name: shortName }))} siteKey={SITE.turnstileSiteKey} />
          </div>
        </Container>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Privacy, terms and 404 in the original card style**

In `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`, make the same two edits. Keep every `<section>`, heading and paragraph exactly as Codex wrote them.

(a) Add `import { Container } from "@/components/ui";` to the imports.

(b) Replace the opening:
```tsx
  return <main id="main"><PageIntro eyebrow="Website information" title="Privacy." description="How information submitted through this website is handled."/><div className="site-container prose-page">
```
with:
```tsx
  return <main id="main" className="relative min-h-screen bg-bg"><section className="pt-32 pb-24"><Container><PageIntro eyebrow="Website information" title="Privacy." description="How information submitted through this website is handled."/><div className="prose-card mt-12 max-w-3xl rounded-3xl border border-line bg-card/40 p-8 sm:p-10">
```
In terms, the `PageIntro` props are `title="Website terms."` and `description="Information about using this website and discussing an engagement."`. Then replace the closing `</div></main>;` with `</div></Container></section></main>;` in both files.

Replace `src/app/not-found.tsx` with:
```tsx
import { Container, FlameButton, GhostButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-40 pb-24">
        <Container>
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
            Page not found
          </span>
          <h1 className="display mt-6 text-[clamp(40px,8vw,96px)] text-ink">
            A different <span className="text-flame">direction</span>.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">This page is unavailable. Explore our services or tell us what you would like to improve.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <FlameButton href="/services/">Explore services</FlameButton>
            <GhostButton href="/">Back to home</GhostButton>
          </div>
        </Container>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Verify**

Run: `npm run lint && npm run typecheck && npm test && npm run build:cf`, restart the preview, `npm run check:seo && npm run test:browser`.
Expected: the SEO crawl passes with 12 pages, one H1 each and no broken links or images. The browser check passes, including all 12 routes fitting in 320 px and the contact page at 200% text with no overflow. Visit each route at 1440 px and 390 px and confirm:
- the original header (back link, eyebrow, big display H1)
- card styles that match the home sections
- inputs on `/contact/` in the original rounded dark style

- [ ] **Step 9: Commit**

```bash
git add src/components/PageIntro.tsx src/app
git commit -m "feat: rebuild inner pages from the original design vocabulary"
```

---

### Task 21: Remove what no longer renders

**Files:**
- Delete: `src/app/legacy.css`, `src/components/sections/DeliveryExample.tsx`, `public/models/earth-optimized.glb`, `public/images/earth-color.webp`
- Modify: `src/app/layout.tsx`, `src/lib/content.ts` (remove `USE_CASES`), `scripts/package-site.mjs`, `scripts/opt-globe.mjs` (no change), `.gitignore` (no change)

- [ ] **Step 1: Prove no markup uses Codex's classes any more**

Run:
```bash
grep -rnoE 'className="[^"]*\b(site-container|section-pad|section-top|section-heading|eyebrow|text-link|button-primary|button-outline|button-dark|challenge-|services-home|service-accordion|delivery-grid|workflow|process-grid|engagement-|faq-grid|site-footer|footer-|page-intro|detail-|deliverables|service-index|related-services|prose-page|contact-grid|contact-aside|not-found)' src || echo "no legacy classes"
```
Expected: `no legacy classes`. **Exception:** `ContactForm.tsx` keeps `button button-primary`, which is now styled by `.contact-form .button` in `globals.css`. If any other match appears, restyle that element with the original Tailwind utilities before continuing.

- [ ] **Step 2: Delete the legacy layer and dead code**

```bash
git rm src/app/legacy.css src/components/sections/DeliveryExample.tsx public/models/earth-optimized.glb public/images/earth-color.webp
```
In `src/app/layout.tsx`, delete the line `import "./legacy.css";`. In `src/lib/content.ts`, delete the `export const USE_CASES = [ … ];` statement; nothing imports it now. Confirm with `grep -rn USE_CASES src scripts tests`, which should print nothing.

- [ ] **Step 3: Tighten the package allowlist**

In `scripts/package-site.mjs`, remove `"images/galaxy-small.webp"`, `"images/earth-color.webp"` and `"models/earth-optimized.glb"` from `assets`. Confirm that no source still references them:
```bash
grep -rnE "galaxy-small|earth-color|earth-optimized" src scripts || echo "unreferenced"
```
Expected: `unreferenced` (`prepare-assets.mjs` still *writes* `galaxy-small.webp`; that is harmless, and the file is not shipped).

- [ ] **Step 4: Verify everything**

Run: `npm run lint && npm run typecheck && npm test && npm run build:cf`, restart the preview, `npm run check:seo && npm run test:browser`.
Expected: all pass. `dist/` contains no `earth-optimized`, `earth-4k`, `images/team|reviews|labs` or `gen-raw` files (check-export enforces this).

- [ ] **Step 5: Commit**

```bash
git add -A src scripts public
git commit -m "chore: remove Codex CSS layer and assets the restored design no longer uses"
```

---

### Task 22: Full verification and fidelity sign-off

**Files:**
- Modify: `README.md`, `docs/operations/implementation-status.md`

- [ ] **Step 1: Run every gate from a clean build**

Stop the preview, then:
```bash
rm -rf out dist .next
npm run lint && npm run typecheck && npm test && npm run build:cf
```
Start the preview, then:
```bash
npm run check:seo && npm run test:browser && npm run check:fidelity
```
Expected:
- lint and both type checks clean
- `# pass 26`
- `Export valid: 12 core pages`
- `SEO crawl passed: 12 pages…`
- `Browser checks passed: 6 profiles…`
- `Fidelity check passed.`, with every required section `ok` on desktop and mobile and `testimonials`/`labs` reported as optional

- [ ] **Step 2: Review every side-by-side sheet against the signature checklist**

Open each file in `artifacts/fidelity/desktop/` and `artifacts/fidelity/mobile/` and tick each item. For any item that fails, fix it, rerun Step 1, and come back.

- [ ] **Nav:** pill bar, transparent at the top and solid after scrolling; orange `space—gear™` with a light dash; Services ▾ dropdown; ghost "Discuss a project" button; hamburger panel on mobile.
- [ ] **Hero, desktop beat 1:** sharp night-lights globe on the right with the sun haze top-left and a dense star field. Copy on the left: "You bring the challenge, **we build the system.**" and "— The smarter way to **plan**, **build**, and **scale** your business." in four lines. Below it, the pitch + orange calendar CTA, the `05`/`03` stats, the corner card bottom-right and the "Scroll to explore" pill.
- [ ] **Hero, beats 2–3:** the globe shrinks to the centre and the statement fills word by word; the rounded curtain panel then slides over.
- [ ] **Hero, mobile:** galaxy backdrop, centred copy, statement below.
- [ ] **What We Do:** giant grey→white title; `001 / space—gear` row; 2×2 featured card; orange lineup panel with pulsing dots; four tiles (grid dots, orange arrow, hover zoom + description); pulsing 3×3 tile; assessment card with a 33% bar; stacking cards on mobile.
- [ ] **Our Services:** five columns, one expanded orange with its image, collapsed ones showing `↓ 0n` + tag; Core Services `5/5` card with dot matrix and full-width button.
- [ ] **Our Process:** orange timeline with four dots; four lifting cards with output counts; CTA banner.
- [ ] **What We Measure:** "illustrative… not client results" header; three-card top row; four-card bottom row with growing bars; capability marquee; arrow CTA.
- [ ] **Engagements:** three horizontal rows ("Start here" on Assess); stage + toggle; stacked cells; two-column ✓ list; Select button with the selected glow; swipe carousel on mobile.
- [ ] **Questions & Answers:** eight items, the first open with the orange × icon; sticky grayscale photo card with the rotating badge.
- [ ] **Who You Work With:** carousel card with dots, name/role/bio, image column and arrows.
- [ ] **Footer:** three bentos; rotating badge; giant `space—gear™` fully inside its cell; link columns with dot headers; quick-start form; bottom bar; curtain reveal at 1440×1000.

- [ ] **Step 3: Measure the asset budget for the record (observation, not a Lighthouse claim)**

Run:
```bash
ls -la dist/models/earth-hq.glb dist/images/hero-poster.webp dist/images/galaxy.webp
node -e 'const r=require("./artifacts/browser-report.json"); for (const p of r.profiles) console.log(p.name, Math.round(p.resourceBytes/1024)+" KiB", "cls="+p.cls.toFixed(3))'
```
Record the numbers in Step 4. If desktop `cls` is above `0.1`, the swap from static to cinematic hero is shifting the copy. Make the static hero's `Container` use `min-h-screen items-center` on desktop (`lg:min-h-screen`) so both variants place the copy at the same height, then rerun Step 1.

- [ ] **Step 4: Document**

In `README.md`, under `## Verification`, add `npm run check:fidelity` to the command list and this paragraph:

```markdown
`check:fidelity` compares every home section with the original platform-clone build. Serve it with `npx next start -p 3101 -H 127.0.0.1` from that folder, alongside the local Cloudflare preview. The check writes side-by-side sheets to `artifacts/fidelity/`. A person reviews those sheets before release; the height check alone is not sign-off.
```

In `docs/operations/implementation-status.md`, add a section `## Fidelity rebuild (feat/spacegear-fidelity)` containing:
- the Step 1 results
- the Step 3 sizes and resource numbers, as local unthrottled observations
- the signed checklist
- the remaining owner inputs: founder name/photo/bio for the team card, real testimonials, published articles, social profile URLs, ™→® once the mark is registered, and the contact email and policy approval already listed by Codex

- [ ] **Step 5: Commit**

```bash
git add README.md docs/operations/implementation-status.md
git commit -m "docs: record the fidelity rebuild verification and remaining owner inputs"
```

- [ ] **Step 6: Hand back**

Report to the owner:
- the branch name and commit list
- the pass/fail lines from Step 1
- four sheets to look at first: `artifacts/fidelity/desktop/home.jpg`, `work.jpg`, `services.jpg` and `contact.jpg`
- the owner inputs from Step 4

Do not merge, push or deploy; Codex's launch gates (Cloudflare account, contact email, policies) still apply.
