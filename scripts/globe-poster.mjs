// The desktop poster's checks (used by browser-check.mjs, scripts/capture-hero-poster.mjs and the scratch
// proof scripts).
//
// The poster (public/images/hero-poster*.webp, scripts/capture-hero-poster.mjs) is the desktop hero's
// first paint, its loading state under the WebGL canvas and the static hero for reduced motion, no
// JavaScript, Save-Data and missing WebGL2. Phones and tablets keep the galaxy and never fetch it.
// `posterMatchCheck` compares the poster with the live globe's opening frame at desktop shapes,
// `heroContrastCheck` measures the hero copy's contrast over it, `staticBackdrop` reads the static hero's
// layout, and `saveDataDesktopCheck`, `boundaryCheck` and `textureFailureCheck` are whole-page checks.
// `captureHooks`, `posed` and `freezeOpeningPose` hold the live globe on its opening frame.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import sharp from "sharp";
import { SOFTWARE_RENDERER, fakeGpu } from "./globe-stream.mjs";

/** Any width candidate of the poster. */
export const POSTER_FILE = /\/images\/hero-poster(?:-\d+w)?\.webp$/;
const GALAXY_FILE = /\/images\/galaxy\.webp$/;
// Mirrors INTRO_SESSION_KEY in src/components/globe/intro-gate.ts: a repeat view skips the intro.
const INTRO_SESSION_KEY = "spacegear:intro-seen";
/** Requests for anything the globe downloads (the old GLB path included). */
export const GLOBE_DOWNLOAD = /\.glb(?:$|\?)|\/draco\/|\/textures\/earth\//;

// The globe's framing, read from src/components/globe/constants.ts so the checks follow a retune.
const constantsSource = await fs.readFile(new URL("../src/components/globe/constants.ts", import.meta.url), "utf8");
const constant = (name) => {
  const match = constantsSource.match(new RegExp(`export const ${name}(?::[^=]+)? = ([^;]+);`));
  if (!match) throw new Error(`constants.ts: ${name} not found`);
  return Function("Math", `"use strict"; return (${match[1]});`)(Math);
};
export const INITIAL_SPIN = constant("INITIAL_SPIN");
const HALF_HEIGHT = constant("CAMERA_Z") * Math.tan((constant("CAMERA_FOV") * Math.PI) / 360); // world units at the globe

/**
 * The opening frame's geometry at this viewport, in px: the camera keeps its vertical field of view, so the
 * globe's centre sits RIG_X world units right of the screen's centre (scaled by the viewport's height).
 * A sphere this close and this far off-axis shows a silhouette wider than its radius: about 1.07 ×
 * RIG_SCALE here (measured on the poster: the limb 778 px from the centre at 1000 px tall).
 */
export function openingGeometry(width, height) {
  const unit = height / 2 / HALF_HEIGHT;
  return { cx: width / 2 + constant("RIG_X")[0] * unit, cy: height / 2, r: constant("RIG_SCALE")[0] * unit * 1.07 };
}

/** Regions of the opening frame (px): inside the globe's disc, across its lit left limb, the open sky left of it. */
function regionsFor(width, height) {
  const { cx, cy, r } = openingGeometry(width, height);
  const box = (x0, y0, x1, y1) => {
    const left = Math.max(0, Math.round(x0)), top = Math.max(0, Math.round(y0));
    return { left, top, width: Math.min(width, Math.round(x1)) - left, height: Math.min(height, Math.round(y1)) - top };
  };
  return {
    globe: box(cx - 0.6 * r, cy - 0.6 * r, cx + 0.6 * r, cy + 0.6 * r),
    limb: box(cx - 1.12 * r, cy - 0.25 * r, cx - 0.88 * r, cy + 0.25 * r),
    sky: box(0.02 * width, 0.04 * height, Math.max(0.06 * width, cx - 1.2 * r), 0.96 * height),
  };
}
const SAMPLE = [96, 64];

/** Mean luma and the RGB pixels of a region, downsampled to SAMPLE. */
async function region(png, box) {
  const data = await sharp(png).extract(box).removeAlpha().resize(SAMPLE[0], SAMPLE[1], { fit: "fill" }).raw().toBuffer();
  let luma = 0;
  for (let i = 0; i < data.length; i += 3) luma += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  return { data, luma: luma / (data.length / 3) };
}
const meanAbsDiff = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length; };
const round = (value) => Math.round(value * 10) / 10;

/**
 * Compares two full-viewport captures region by region: the mean luma of each and their mean absolute
 * difference per channel (0–255), downsampled.
 */
export async function compareFrames(a, b) {
  const { width, height } = await sharp(a).metadata();
  const out = {};
  for (const [name, box] of Object.entries(regionsFor(width, height))) {
    const [ra, rb] = [await region(a, box), await region(b, box)];
    out[name] = { lumaA: round(ra.luma), lumaB: round(rb.luma), mad: round(meanAbsDiff(ra.data, rb.data)) };
  }
  return out;
}

/** Init script: collects three's scenes (devtools hook) and lets a check freeze performance.now(). */
export function captureHooks() {
  const scenes = [];
  window.__scenes = scenes;
  const hook = new EventTarget();
  hook.addEventListener("observe", (event) => { if (event.detail?.isScene) scenes.push(event.detail); });
  window.__THREE_DEVTOOLS__ = hook;
  const now = performance.now.bind(performance);
  let frozen = null;
  performance.now = () => frozen ?? now();
  window.__freezeClock = () => { frozen = now(); };
}

/** Runs in the page: the globe's posed objects (null until the scene has its globe). */
export function posed() {
  for (const scene of window.__scenes) {
    let earth = null, clouds = null, sky = null, stars = null;
    scene.traverse((o) => {
      if (o.material?.name === "GlobeEarth") earth = o;
      if (o.material?.name === "GlobeClouds") clouds = o;
      if (o.isMesh && o.material?.map && o.material.side === 1) sky = o; // the galaxy's back-face sphere
      if (o.isPoints) stars = o;
    });
    if (earth && clouds && sky) return { scene, earth, clouds, sky, stars, spin: earth.parent, tilt: earth.parent.parent.parent, parallax: sky.parent };
  }
  return null;
}

/** The pose now (page side, through the devtools hook). */
export function readPose(page) {
  return page.evaluate((source) => {
    const found = (0, eval)(`(${source})`)();
    if (!found) throw new Error("The globe's objects were not found through three's devtools hook.");
    return { spin: found.spin.rotation.y, clouds: found.clouds.rotation.y, sky: found.sky.rotation.y, parallax: [found.parallax.rotation.x, found.parallax.rotation.y] };
  }, posed.toString());
}

const frames = (page, n = 3) => page.evaluate((n) => new Promise((resolve) => {
  const step = (left) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
  step(n);
}), n);

/**
 * Freezes the page's clock (every later frame has a zero delta) and puts the globe back on its opening
 * pose: the spin it mounts with, no cloud drift or sky turn, level, no parallax. Needs captureHooks.
 * Motion's animations also stop, so call it once the copy has settled.
 */
export async function freezeOpeningPose(page) {
  // The first frame after the freeze still advances by the time since the previous one: let it pass.
  await page.evaluate(() => window.__freezeClock());
  await frames(page, 2);
  await page.evaluate(({ source, spin }) => {
    const found = (0, eval)(`(${source})`)();
    found.spin.rotation.y = spin;
    found.clouds.rotation.y = 0;
    found.sky.rotation.y = 0;
    found.parallax.rotation.set(0, 0, 0);
    found.tilt.rotation.set(0, 0, 0);
  }, { source: posed.toString(), spin: INITIAL_SPIN });
  await frames(page, 3);
}

/** The hero backdrop's image as the browser chose it (the <picture> source or the <img>). */
export const backdropSource = (page) => page.locator("#home .hero-backdrop img").first().evaluate((img) => img.currentSrc);

/**
 * The static hero's backdrop on this viewport: its box relative to the hero, whether the image fills it,
 * how many of its overlays (the phone gradients; the desktop legibility scrim does not count) and 2D
 * starfield canvases render, the image's object-fit, whether the backdrop fades out at the bottom (a mask)
 * and whether the statement starts below it, on the page background.
 */
export const staticBackdrop = (page) => page.evaluate(() => {
  const home = document.getElementById("home"), backdrop = home.querySelector(".hero-backdrop"), img = backdrop.querySelector("img");
  const h = home.getBoundingClientRect(), r = backdrop.getBoundingClientRect(), i = img.getBoundingClientRect();
  const shown = (el) => getComputedStyle(el).display !== "none" && el.getClientRects().length > 0;
  return {
    top: Math.round(r.top - h.top),
    height: Math.round(r.height),
    viewport: innerHeight,
    fills: Math.round(i.width) === Math.round(r.width) && Math.round(i.height) === Math.round(r.height),
    fit: getComputedStyle(img).objectFit,
    opacity: getComputedStyle(img).opacity,
    overlays: [...backdrop.children].filter((el) => !el.matches("picture, img, .hero-scrim") && shown(el)).length,
    starfield: [...home.querySelectorAll(":scope > div > canvas")].filter(shown).length,
    faded: /gradient/.test(getComputedStyle(backdrop).maskImage || getComputedStyle(backdrop).webkitMaskImage || ""),
    statementBelow: home.querySelector(".hero-statement").getBoundingClientRect().top >= r.bottom - 1,
  };
});

/**
 * The static backdrop's facts that a desktop must show: the first screen, filled, at full strength, alone,
 * fading into the page (where the hero stays static) above the statement.
 */
export const desktopLayout = ({ top, height, fills, fit, opacity, overlays, starfield, faded, statementBelow }) => ({ top, height, fills, fit, opacity, overlays, starfield, faded, statementBelow });
/** What desktopLayout must read on a static desktop hero whose viewport is `height` px tall (up to 2.4:1). */
export const STATIC_DESKTOP = (height) => ({ top: 0, height, fills: true, fit: "cover", opacity: "1", overlays: 0, starfield: 0, faded: true, statementBelow: true });

/** The hero stage with one layer showing: "live" (the WebGL canvas) or "poster" (the poster image). */
export async function stageShot(page, layer) {
  // No transitions: hidden copy with `transition-all` (the CTA) would otherwise stay visible for its duration.
  const still = await page.addStyleTag({ content: "#home .sticky, #home .sticky * { transition: none !important; }" });
  await page.evaluate((layer) => {
    document.querySelector("header")?.style.setProperty("display", "none");
    for (const el of document.querySelectorAll("#home .sticky > *")) {
      const keep = el.classList.contains(layer === "live" ? "hero-scene" : "hero-backdrop");
      el.style.setProperty("visibility", keep ? "visible" : "hidden");
    }
  }, layer);
  await frames(page, 2);
  const png = await page.screenshot({ type: "png" });
  await page.evaluate(() => {
    document.querySelector("header")?.style.removeProperty("display");
    for (const el of document.querySelectorAll("#home .sticky > *")) el.style.removeProperty("visibility");
  });
  await still.evaluate((el) => el.remove());
  return png;
}

// What the poster must match: the same geometry (globe size and place, sun, limb) and the same brightness.
// Measured against the 2k first frame (4k-tier poster) at 1422×745 to 3440×1300: see the Task 9 report.
// A poster 3 % too large scores about 12 on the globe and limb, one stretched to the window about 30, the
// previous GLB poster 50–80.
export const POSTER_TOLERANCE = { globe: 6, limb: 6, sky: 3, luma: 4 };
/** The shapes the poster is checked at: a common desktop window and an ultrawide one (wider than 2.4:1). */
export const MATCH_VIEWPORTS = [{ width: 1920, height: 960 }, { width: 3440, height: 1300 }];

/**
 * A repeat desktop visit (no intro), per viewport: the poster under the canvas and the canvas's opening
 * frame (the clock frozen and the opening pose restored, so a slow machine cannot shoot late) agree in
 * each region within POSTER_TOLERANCE, so the canvas fades in over the poster without a jump. The page
 * reports a software renderer, so it stays on the 2k set that every desktop shows first.
 */
export async function posterMatchCheck(browser, base, { viewports = MATCH_VIEWPORTS, save } = {}) {
  const out = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    try {
      await context.addInitScript(fakeGpu, SOFTWARE_RENDERER);
      await context.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_SESSION_KEY);
      await context.addInitScript(captureHooks);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base, { waitUntil: "networkidle" });
      await page.waitForSelector('#home .hero-scene[data-globe="ready"]', { timeout: 45000 });
      await page.waitForFunction(() => { const img = document.querySelector("#home .hero-backdrop img"); return img.complete && img.naturalWidth > 0; }, null, { timeout: 10000 });
      await freezeOpeningPose(page);
      const live = await stageShot(page, "live");
      const poster = await stageShot(page, "poster");
      const source = await backdropSource(page);
      if (save) await save({ viewport, live, poster });
      const regions = await compareFrames(poster, live);
      const facts = { viewport, source: new URL(source).pathname, fit: await page.evaluate(() => getComputedStyle(document.querySelector("#home .hero-backdrop img")).objectFit), regions, errors };
      out.push(facts);
      const fits = Object.entries(regions).every(([name, r]) => r.mad <= POSTER_TOLERANCE[name] && Math.abs(r.lumaA - r.lumaB) <= POSTER_TOLERANCE.luma);
      assert.ok(POSTER_FILE.test(source) && errors.length === 0, `poster match: the desktop hero's backdrop is the poster (${JSON.stringify(facts)})`);
      assert.ok(fits, `poster match: the poster matches the globe's opening frame at ${viewport.width}×${viewport.height} (poster vs live, mean abs diff and luma per region: ${JSON.stringify(facts)})`);
    } finally {
      await context.close();
    }
  }
  return out;
}

// WCAG contrast of each word of the hero copy over what is behind it (the T8 method of statementContrast in
// globe-mobile.mjs, for any text): every pixel of the word's box is modelled as the word's colour over the
// background captured with the text made transparent (its halo stays, as part of what is behind it), and
// the word scores the 10th percentile of those ratios. Large text (24 px, or 18.66 px bold) needs 3:1,
// the rest 4.5:1.
const linear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (r, g, b) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(p * values.length))];

/** Per-word contrast of the text under `selector` on the current screen: the words that fail, and the six closest to failing. */
export async function copyContrast(page, selector = "#home .hero-copy") {
  const words = await page.evaluate((selector) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = (css) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
    const out = [];
    for (const root of document.querySelectorAll(selector)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement, style = getComputedStyle(el);
        if (style.visibility === "hidden") continue;
        let alpha = 1;
        for (let n = el; n; n = n.parentElement) alpha *= parseFloat(getComputedStyle(n).opacity);
        const [r, g, b, a] = rgba(style.color);
        const size = parseFloat(style.fontSize), weight = parseInt(style.fontWeight, 10);
        for (const match of node.textContent.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const rect = range.getClientRects()[0];
          if (!rect || rect.width < 1 || rect.bottom < 0 || rect.top > innerHeight) continue;
          out.push({ text: match[0], x: rect.left, y: rect.top, w: rect.width, h: rect.height, rgb: [r, g, b], alpha: alpha * (a / 255), size, large: size >= 24 || (size >= 18.66 && weight >= 700) });
        }
      }
    }
    return out;
  }, selector);
  // No transitions, or text with `transition-all` (the CTA) would still be fading out in the background shot.
  const hide = await page.addStyleTag({ content: `${selector}, ${selector} * { color: transparent !important; -webkit-text-fill-color: transparent !important; transition: none !important; } ${selector} svg { visibility: hidden !important; }` });
  await frames(page, 2);
  const { data, info } = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  await hide.evaluate((el) => el.remove());
  const scored = words.map((word) => {
    const ratios = [], [cr, cg, cb] = word.rgb, a = word.alpha;
    const x0 = Math.max(0, Math.floor(word.x)), y0 = Math.max(0, Math.floor(word.y));
    const x1 = Math.min(info.width, Math.ceil(word.x + word.w)), y1 = Math.min(info.height, Math.ceil(word.y + word.h));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * info.width + x) * 3, br = data[i], bg = data[i + 1], bb = data[i + 2];
      ratios.push(ratio(luminance(a * cr + (1 - a) * br, a * cg + (1 - a) * bg, a * cb + (1 - a) * bb), luminance(br, bg, bb)));
    }
    return { text: word.text, size: word.size, need: word.large ? 3 : 4.5, p10: Math.round(percentile(ratios, 0.1) * 100) / 100 };
  });
  const margin = (w) => w.p10 / w.need;
  return { words: scored.length, fails: scored.filter((w) => w.p10 < w.need), closest: [...scored].sort((a, b) => margin(a) - margin(b)).slice(0, 6) };
}

/** Polls until every hero entrance has ended: opacity 1, no transform, no blur. */
async function copySettled(page, timeout = 8000) {
  await page.waitForFunction(() => [...document.querySelectorAll("#home [data-reveal]")].every((el) => {
    for (let n = el; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.99) return false;
    const style = getComputedStyle(el);
    return ["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(style.transform) && ["none", "blur(0px)"].includes(style.filter);
  }), null, { timeout, polling: 100 });
}

/** Desktop shapes for the contrast check: laptops, a 1080p window, and large and ultrawide screens, where
 *  the 1240 px container keeps the copy near the centre while the globe grows with the height. */
export const CONTRAST_VIEWPORTS = [[1422, 745], [1920, 1080], [2560, 1440], [2560, 1300], [3440, 1300]];

/**
 * The hero copy's contrast over the desktop hero at CONTRAST_VIEWPORTS, in the static hero (reduced
 * motion: the poster) and the cinematic one (a repeat visit: the live globe on its opening frame). Every
 * word passes WCAG AA: 3:1 for the display headline (the em dash included: it is part of the heading's
 * name), 4.5:1 for the smaller text.
 */
export async function heroContrastCheck(browser, base, { viewports = CONTRAST_VIEWPORTS, css, save } = {}) {
  const out = {};
  for (const [width, height] of viewports) {
    for (const mode of ["static", "cinematic"]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: mode === "static" ? "reduce" : "no-preference" });
      try {
        await context.addInitScript(fakeGpu, SOFTWARE_RENDERER);
        await context.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_SESSION_KEY);
        await context.addInitScript(captureHooks);
        const page = await context.newPage();
        await page.goto(base, { waitUntil: "networkidle" });
        if (css) await page.addStyleTag({ content: css });
        if (mode === "cinematic") {
          await page.waitForSelector('#home .hero-scene[data-globe="ready"]', { timeout: 45000 });
          await page.waitForFunction(() => getComputedStyle(document.querySelector("#home .hero-scene")).opacity === "1", null, { timeout: 10000, polling: "raf" });
          await copySettled(page);
          await freezeOpeningPose(page);
        } else {
          await page.waitForTimeout(600);
        }
        if (save) await save({ width, height, mode, png: await page.screenshot() });
        const result = await copyContrast(page);
        out[`${mode}-${width}x${height}`] = result;
      } finally {
        await context.close();
      }
    }
  }
  const failing = Object.entries(out).filter(([, r]) => r.fails.length).map(([key, r]) => `${key}: ${r.fails.map((w) => `${w.text} ${w.p10}/${w.need}`).join(", ")}`);
  assert.deepEqual(failing, [], `hero contrast: every word of the hero copy keeps WCAG AA over the desktop hero (closest: ${JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, r]) => [k, r.closest.slice(0, 3)])))})`);
  return out;
}

/**
 * Save-Data on a desktop keeps the static poster: no intro and no globe download. The inline gate marks it
 * before first paint, so the first paint is already the static layout (no 300vh reserve, the poster fading
 * into the page above the statement), not only after hydration.
 */
export async function saveDataDesktopCheck(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "connection", { configurable: true, get: () => ({ saveData: true, effectiveType: "4g", addEventListener() {}, removeEventListener() {} }) }));
    const page = await context.newPage();
    const downloads = [], images = [], errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (GLOBE_DOWNLOAD.test(request.url())) downloads.push(request.url());
      if (/\/images\/(hero-poster|galaxy)/.test(request.url())) images.push(new URL(request.url()).pathname);
    });
    // First paint, before hydration: the scripts are held.
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route("**/_next/static/**", async (route) => {
      if (route.request().resourceType() === "script") await held;
      await route.continue().catch(() => {});
    });
    await page.goto(base, { waitUntil: "commit" });
    await page.waitForFunction(() => { const img = document.querySelector("#home .hero-backdrop img"); return Boolean(img?.complete && img.naturalWidth > 0); }, null, { timeout: 15000 });
    const painted = { marked: await page.evaluate(() => document.documentElement.hasAttribute("data-save-data")), hero: await page.evaluate(() => Math.round(document.getElementById("home").getBoundingClientRect().height)), layout: await staticBackdrop(page) };
    release();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500); // past the idle-mount timeout
    const facts = {
      painted,
      intro: await page.evaluate(() => document.documentElement.dataset.intro ?? null),
      scene: await page.locator("#home .hero-scene").count(),
      source: new URL(await backdropSource(page)).pathname,
      hero: await page.evaluate(() => Math.round(document.getElementById("home").getBoundingClientRect().height)),
      layout: await staticBackdrop(page),
      downloads, images: [...new Set(images)], errors,
    };
    assert.equal(facts.intro, null, `save-data: no intro (${JSON.stringify(facts)})`);
    assert.deepEqual(downloads, [], `save-data: no globe download (${JSON.stringify(facts)})`);
    assert.ok(POSTER_FILE.test(facts.source) && facts.scene === 0, `save-data: the static poster (${JSON.stringify(facts)})`);
    assert.ok(painted.marked && painted.hero === facts.hero && painted.hero < 2 * 1000, `save-data: the first paint is already the static hero, without the cinematic's 300vh reserve (${JSON.stringify(facts)})`);
    assert.deepEqual([desktopLayout(painted.layout), desktopLayout(facts.layout)], [STATIC_DESKTOP(1000), STATIC_DESKTOP(1000)], `save-data: from first paint the poster covers the first screen and fades into the page above the statement (${JSON.stringify(facts)})`);
    assert.ok(facts.images.every((path) => POSTER_FILE.test(path)), `save-data: only the poster is fetched, never the galaxy (${JSON.stringify(facts)})`);
    assert.deepEqual(errors, [], "save-data: no page errors");
    return facts;
  } finally {
    await context.close();
  }
}

/**
 * A desktop whose first texture set fails (the 2k clouds map answers 404): the scene gives up, the hero
 * keeps the poster and the copy, and nothing surfaces as an uncaught page error.
 */
export async function textureFailureCheck(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await context.addInitScript(fakeGpu, SOFTWARE_RENDERER);
    await context.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_SESSION_KEY);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/textures/earth/2k/clouds.webp", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#home .hero-scene")?.dataset.globe === "failed", null, { timeout: 20000 });
    await page.waitForTimeout(800);
    const facts = await page.evaluate(() => ({ globe: document.querySelector("#home .hero-scene").dataset.globe, canvases: document.querySelectorAll("#home .hero-scene canvas").length, poster: document.querySelector("#home .hero-backdrop img").currentSrc, headline: Boolean(document.querySelector("#home h1")?.getClientRects().length) }));
    facts.errors = errors;
    assert.ok(facts.globe === "failed" && facts.canvases === 0 && POSTER_FILE.test(new URL(facts.poster).pathname) && facts.headline, `texture failure: the scene gives up and the poster and copy stay (${JSON.stringify(facts)})`);
    assert.deepEqual(errors, [], `texture failure: nothing escapes as an uncaught page error (${JSON.stringify(facts)})`);
    return facts;
  } finally {
    await context.close();
  }
}

/**
 * Windows wider than the poster's 2.4:1 show it pillarboxed (object-fit: contain). In the static hero
 * (reduced motion, no JavaScript) its sides are feathered into the page, so the globe is not cut by a hard
 * vertical edge; the cinematic hero (where the canvas fades in over the poster) and windows up to 2.4:1
 * keep the plain image.
 */
export async function ultrawideFeatherCheck(browser, base) {
  const out = {};
  for (const [label, viewport, options] of [
    ["static-3440x1300", { width: 3440, height: 1300 }, { reducedMotion: "reduce" }],
    ["nojs-3440x1300", { width: 3440, height: 1300 }, { javaScriptEnabled: false }],
    ["cinematic-3440x1300", { width: 3440, height: 1300 }, {}],
    ["static-2560x1440", { width: 2560, height: 1440 }, { reducedMotion: "reduce" }],
  ]) {
    const context = await browser.newContext({ viewport, ...options });
    try {
      if (options.javaScriptEnabled !== false) await context.addInitScript(fakeGpu, SOFTWARE_RENDERER);
      const page = await context.newPage();
      await page.goto(base, { waitUntil: "networkidle" });
      if (label.startsWith("cinematic")) await page.waitForSelector("#home .hero-scene", { state: "attached", timeout: 30000 });
      out[label] = await page.evaluate(() => {
        const img = document.querySelector("#home .hero-backdrop img"), style = getComputedStyle(img);
        return { fit: style.objectFit, mask: style.maskImage || style.webkitMaskImage || "none" };
      });
    } finally {
      await context.close();
    }
  }
  const feathered = (facts) => facts.fit === "contain" && /linear-gradient/.test(facts.mask);
  assert.ok(feathered(out["static-3440x1300"]) && feathered(out["nojs-3440x1300"]), `ultrawide static hero: the pillarboxed poster's sides are feathered (${JSON.stringify(out)})`);
  assert.deepEqual([out["cinematic-3440x1300"], out["static-2560x1440"]], [{ fit: "contain", mask: "none" }, { fit: "cover", mask: "none" }], `the cinematic hero and windows up to 2.4:1 keep the plain poster (${JSON.stringify(out)})`);
  return out;
}

/**
 * Either side of the 1024 px boundary with reduced motion (the static hero): 1024 px shows the poster over
 * exactly the first screen, 1023 px the galaxy over the whole hero, each without layout shift. At 1024 px
 * with motion allowed, hydration swaps the static hero for the cinematic one: the poster keeps its box and
 * image and the sections below stay where they were painted.
 */
export async function boundaryCheck(browser, base) {
  const out = {};
  for (const [width, reducedMotion] of [[1024, "reduce"], [1023, "reduce"]]) {
    const context = await browser.newContext({ viewport: { width, height: 768 }, reducedMotion });
    try {
      await context.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      });
      const page = await context.newPage();
      const posters = [];
      page.on("request", (request) => { if (POSTER_FILE.test(new URL(request.url()).pathname)) posters.push(request.url()); });
      await page.goto(base, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const facts = { source: new URL(await backdropSource(page)).pathname, layout: await staticBackdrop(page), cls: await page.evaluate(() => window.__cls), posters: posters.length };
      out[`${width}-reduced`] = facts;
      if (width >= 1024) {
        assert.ok(POSTER_FILE.test(facts.source), `${width} px reduced motion: the poster (${JSON.stringify(facts)})`);
        assert.deepEqual(desktopLayout(facts.layout), STATIC_DESKTOP(768), `${width} px reduced motion: the poster covers exactly the first screen, without the phone gradients or the 2D stars, and fades into the page above the statement (${JSON.stringify(facts)})`);
      } else {
        assert.ok(GALAXY_FILE.test(facts.source) && facts.posters === 0, `${width} px reduced motion: the galaxy, and no poster download (${JSON.stringify(facts)})`);
        assert.ok(facts.layout.height > 768 && facts.layout.overlays === 2 && facts.layout.starfield === 1, `${width} px reduced motion: the galaxy, its gradients and the 2D stars cover the whole hero (${JSON.stringify(facts)})`);
      }
      assert.ok(facts.cls < 0.05, `${width} px reduced motion: cumulative layout shift ${facts.cls}`);
    } finally {
      await context.close();
    }
  }
  // Hydration at 1024 px with motion: the scripts are held so the static first paint can be measured.
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  try {
    await context.addInitScript(fakeGpu, SOFTWARE_RENDERER);
    await context.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_SESSION_KEY);
    await context.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await context.newPage();
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route("**/_next/static/**", async (route) => {
      if (route.request().resourceType() === "script") await held;
      await route.continue().catch(() => {});
    });
    const geometry = () => page.evaluate(() => {
      const home = document.getElementById("home"), next = home.nextElementSibling;
      const backdrop = home.querySelector(".hero-backdrop"), img = backdrop.querySelector("img"), r = backdrop.getBoundingClientRect();
      const mask = getComputedStyle(backdrop).maskImage || getComputedStyle(backdrop).webkitMaskImage || "none";
      return { cinematic: Boolean(home.querySelector(".hero-scene")), next: Math.round(next.getBoundingClientRect().top + scrollY), backdrop: [Math.round(r.top), Math.round(r.height), Math.round(r.width)], source: new URL(img.currentSrc || img.src).pathname, mask };
    });
    await page.goto(base, { waitUntil: "commit" });
    await page.waitForFunction(() => { const img = document.querySelector("#home .hero-backdrop img"); return Boolean(img?.complete && img.naturalWidth > 0); }, null, { timeout: 15000 });
    const painted = await geometry();
    release();
    await page.waitForSelector("#home .hero-scene", { state: "attached", timeout: 30000 });
    await page.waitForTimeout(300);
    const hydrated = await geometry();
    const cls = await page.evaluate(() => window.__cls);
    out["1024-hydration"] = { painted, hydrated, cls };
    assert.ok(!painted.cinematic && hydrated.cinematic, `1024 px: the static first paint hydrates into the cinematic hero (precondition: ${JSON.stringify(out["1024-hydration"])})`);
    assert.deepEqual({ next: hydrated.next, backdrop: hydrated.backdrop, source: hydrated.source }, { next: painted.next, backdrop: painted.backdrop, source: painted.source }, `1024 px: hydration keeps the poster's box and image, and the next section where it was painted (${JSON.stringify(out["1024-hydration"])})`);
    assert.ok(POSTER_FILE.test(painted.source) && cls < 0.05, `1024 px: the first paint shows the poster, without layout shift (${JSON.stringify(out["1024-hydration"])})`);
    assert.equal(painted.mask, "none", `1024 px: the first paint is the full opening frame, unfaded, as the canvas will show it (${JSON.stringify(out["1024-hydration"])})`);
  } finally {
    await context.close();
  }
  return out;
}
