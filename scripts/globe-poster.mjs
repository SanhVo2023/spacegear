// The desktop poster's checks (used by browser-check.mjs and the scratch proof scripts).
//
// The poster (public/images/hero-poster*.webp, scripts/capture-hero-poster.mjs) is the desktop hero's
// first paint, its loading state under the WebGL canvas and the static hero for reduced motion, no
// JavaScript, Save-Data and missing WebGL2. Phones and tablets keep the galaxy and never fetch it.
// `posterMatchCheck` compares the poster with the live globe's opening frame at a common desktop shape,
// `staticBackdrop` reads the static hero's layout, `saveDataDesktopCheck` and `boundaryCheck` are
// whole-page checks.
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

/** The hero backdrop's image as the browser chose it (the <picture> source or the <img>). */
export const backdropSource = (page) => page.locator("#home .hero-backdrop img").first().evaluate((img) => img.currentSrc);

/**
 * The static hero's backdrop on this viewport: its box relative to the hero, whether the image fills it,
 * how many of its overlays (the phone gradients) and 2D starfield canvases render, the image's
 * object-fit, whether the backdrop fades out at the bottom (a mask) and whether the statement starts
 * below it, on the page background.
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
    overlays: [...backdrop.children].filter((el) => !el.matches("picture, img") && shown(el)).length,
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
/** What desktopLayout must read on a static desktop hero whose viewport is `height` px tall. */
export const STATIC_DESKTOP = (height) => ({ top: 0, height, fills: true, fit: "cover", opacity: "1", overlays: 0, starfield: 0, faded: true, statementBelow: true });

// Regions of the opening frame, in fractions of the viewport at 1920×960: inside the globe's disc
// (centre about 1500, 480; radius 697 px), across its lit left limb and the open sky with the sun.
const REGIONS = {
  globe: { x: 0.56, y: 0.16, w: 0.42, h: 0.68 },
  limb: { x: 0.36, y: 0.3, w: 0.14, h: 0.4 },
  sky: { x: 0.02, y: 0.04, w: 0.36, h: 0.92 },
};
const SAMPLE = [96, 64];

/** Mean luma and the RGB pixels of a region, downsampled to SAMPLE (which averages out the stars). */
async function region(png, { x, y, w, h }) {
  const { width, height } = await sharp(png).metadata();
  const data = await sharp(png)
    .extract({ left: Math.round(width * x), top: Math.round(height * y), width: Math.round(width * w), height: Math.round(height * h) })
    .removeAlpha().resize(SAMPLE[0], SAMPLE[1], { fit: "fill" }).raw().toBuffer();
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
  const out = {};
  for (const [name, box] of Object.entries(REGIONS)) {
    const [ra, rb] = [await region(a, box), await region(b, box)];
    out[name] = { lumaA: round(ra.luma), lumaB: round(rb.luma), mad: round(meanAbsDiff(ra.data, rb.data)) };
  }
  return out;
}

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
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const png = await page.screenshot({ type: "png" });
  await page.evaluate(() => {
    document.querySelector("header")?.style.removeProperty("display");
    for (const el of document.querySelectorAll("#home .sticky > *")) el.style.removeProperty("visibility");
  });
  await still.evaluate((el) => el.remove());
  return png;
}

// What the poster must match: the same geometry (globe size and place, sun, limb) and the same brightness.
// Measured against the 2k first frame at 1920×960, 1422×745 and 1440×1000 (4k-tier poster): globe 1.6–1.9,
// limb 1.7–2.3, sky 0.4–0.5, luma within 1. A poster 3 % too large scores about 12 on the globe and limb,
// one stretched to the window about 30, and the previous GLB poster 50–80.
export const POSTER_TOLERANCE = { globe: 6, limb: 6, sky: 3, luma: 4 };

/**
 * A repeat desktop visit (no intro) at a common desktop shape, 1920×960: the poster under the canvas and
 * the canvas's first frame (its fade-in is switched off, so the shot lands on the opening pose) agree in
 * each region within POSTER_TOLERANCE, so the canvas fades in over the poster without a jump. The page
 * reports a software renderer, so it stays on the 2k set that every desktop shows first.
 */
export async function posterMatchCheck(browser, base, { viewport = { width: 1920, height: 960 }, save } = {}) {
  const context = await browser.newContext({ viewport });
  try {
    await context.addInitScript(fakeGpu, SOFTWARE_RENDERER);
    await context.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_SESSION_KEY);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "#home .hero-scene { transition: none !important; }" });
    await page.waitForSelector('#home .hero-scene[data-globe="ready"]', { timeout: 45000 });
    const live = await stageShot(page, "live");
    const source = await backdropSource(page);
    await page.waitForFunction(() => { const img = document.querySelector("#home .hero-backdrop img"); return img.complete && img.naturalWidth > 0; }, null, { timeout: 10000 });
    const poster = await stageShot(page, "poster");
    if (save) await save({ live, poster });
    const regions = await compareFrames(poster, live);
    const facts = { viewport, source: new URL(source).pathname, regions, errors };
    const fits = Object.entries(regions).every(([name, r]) => r.mad <= POSTER_TOLERANCE[name] && Math.abs(r.lumaA - r.lumaB) <= POSTER_TOLERANCE.luma);
    assert.ok(POSTER_FILE.test(source) && errors.length === 0, `poster match: the desktop hero's backdrop is the poster (${JSON.stringify(facts)})`);
    assert.ok(fits, `poster match: the poster matches the globe's opening frame at ${viewport.width}×${viewport.height} (poster vs live, mean abs diff and luma per region: ${JSON.stringify(regions)})`);
    return facts;
  } finally {
    await context.close();
  }
}

/** Save-Data on a desktop keeps the static poster: no intro and no globe download. */
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
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500); // past the idle-mount timeout
    const facts = {
      intro: await page.evaluate(() => document.documentElement.dataset.intro ?? null),
      scene: await page.locator("#home .hero-scene").count(),
      source: new URL(await backdropSource(page)).pathname,
      layout: await staticBackdrop(page),
      downloads, images: [...new Set(images)], errors,
    };
    assert.equal(facts.intro, null, `save-data: no intro (${JSON.stringify(facts)})`);
    assert.deepEqual(downloads, [], `save-data: no globe download (${JSON.stringify(facts)})`);
    assert.ok(POSTER_FILE.test(facts.source) && facts.scene === 0, `save-data: the static poster (${JSON.stringify(facts)})`);
    assert.deepEqual(desktopLayout(facts.layout), STATIC_DESKTOP(1000), `save-data: the poster covers the first screen and fades into the page above the statement (${JSON.stringify(facts)})`);
    assert.ok(facts.images.every((path) => POSTER_FILE.test(path)), `save-data: only the poster is fetched, never the galaxy (${JSON.stringify(facts)})`);
    assert.deepEqual(errors, [], "save-data: no page errors");
    return facts;
  } finally {
    await context.close();
  }
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
