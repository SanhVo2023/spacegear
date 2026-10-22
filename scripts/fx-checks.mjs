// Browser checks for the motion system (src/components/fx). scripts/browser-check.mjs runs them inside its
// desktop profile and a touch context. Run them alone (faster while building an effect) with the preview's
// base URL, which is required (no default port):
//   node scripts/fx-checks.mjs http://127.0.0.1:8791
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

/** Page instrumentation, installed before any page script: counts animation frames and view transitions. */
function instrument() {
  window.__fx = { raf: 0, vt: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => { window.__fx.raf++; return raf(callback); };
  const start = Document.prototype.startViewTransition;
  if (start) Document.prototype.startViewTransition = function (...args) { window.__fx.vt++; return start.apply(this, args); };
}

/** Loads a route with a full page load and waits for the heavy-effect flag. */
export async function fresh(page, base, path = "/") {
  await page.goto("about:blank");
  await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-fx"), null, { timeout: 10000 });
}

/** Instant scroll (the page's CSS asks for smooth scrolling, which would make positions lag). */
export async function jumpTo(page, top) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
}

/** Document offset of a section's top edge. */
export function sectionTop(page, id) {
  return page.evaluate((sid) => window.scrollY + document.getElementById(sid).getBoundingClientRect().top, id);
}

/** Steps through the page so in-view effects get their chance to run, then returns to the top. */
export async function scrollPass(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await jumpTo(page, y);
    await page.waitForTimeout(60);
  }
  await jumpTo(page, 0);
  await page.waitForTimeout(200);
}

/** Animation frames requested during `ms` of idle time. */
export async function idleFrames(page, ms = 300) {
  const before = await page.evaluate(() => window.__fx.raf);
  await page.waitForTimeout(ms);
  return (await page.evaluate(() => window.__fx.raf)) - before;
}

/** Translation (m41, m42) and scale (a) of an element's computed transform. */
export function matrixOf(locator) {
  return locator.evaluate((el) => {
    const transform = getComputedStyle(el).transform;
    const m = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    return { a: m.a, m41: m.m41, m42: m.m42, is2D: m.is2D };
  });
}

async function fxState(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      fx: root.hasAttribute("data-fx"),
      lenis: root.classList.contains("lenis"),
      cursor: Boolean(document.querySelector("[data-fx-cursor-root]")),
      nativeCursorHidden: getComputedStyle(document.body).cursor === "none",
      grain: Boolean(document.querySelector("[data-fx-grain]")),
      rail: Boolean(document.querySelector("[data-fx-rail]")),
      splitChars: document.querySelectorAll("[data-split-char]").length,
      letters: document.querySelectorAll("[data-letter]").length,
      // Magnetic, Tilt, ScrollDepth and Parallax layers that carry a transform (none when the effects are off).
      moved: [...document.querySelectorAll("[data-magnetic], [data-tilt], [data-depth], [data-parallax] > *")].filter((el) => getComputedStyle(el).transform !== "none").length,
    };
  });
}
const ABSENT = { fx: false, lenis: false, cursor: false, nativeCursorHidden: false, grain: false, rail: false, splitChars: 0, letters: 0, moved: 0 };

/** Touch, phone, tablet, reduced-motion and no-JS profiles: no heavy effect is mounted. With `motionOff`
 *  (reduced motion, no JavaScript) the light reveals stay off too. */
export async function assertFxAbsent(page, label, { motionOff = false } = {}) {
  assert.deepEqual(await fxState(page), ABSENT, `${label}: heavy effects stay off`);
  if (motionOff) assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-fx-motion")), false, `${label}: reveal effects stay off`);
}

const DESKTOP_CHECKS = [];
const TOUCH_CHECKS = [];
/** Registers a check for the fine-pointer desktop (1440×1000). It gets (page, ctx) on a fresh home page. */
export function desktop(name, check) { DESKTOP_CHECKS.push([name, check]); }
/** Registers a check for the coarse-pointer context (1440×1000, touch). It gets (page, ctx). */
export function touch(name, check) { TOUCH_CHECKS.push([name, check]); }

/** Runs every desktop check in one tab of `context`; returns results the touch checks compare against. */
export async function checkFxDesktop({ context, base, report }) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(instrument);
  const ctx = { base, deepLinkTop: null };
  for (const [name, check] of DESKTOP_CHECKS) {
    await fresh(page, base);
    await check(page, ctx);
    report.interactions.push(`fx desktop: ${name}`);
  }
  assert.deepEqual(errors, [], "fx desktop: no page errors");
  await page.close();
  return ctx;
}

/** A coarse pointer at desktop width (touch laptop, large tablet): only reveals and scroll draws. */
export async function checkFxTouch({ browser, base, report, watchCsp, desktop: desktopResults }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true, isMobile: true });
  const cspProblems = watchCsp ? await watchCsp(context) : [];
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches), false, "touch: the emulated pointer is coarse (precondition)");
  await assertFxAbsent(page, "touch");
  report.interactions.push("fx touch: heavy effects stay off on a coarse pointer at 1440 px");
  const ctx = { base, desktop: desktopResults };
  for (const [name, check] of TOUCH_CHECKS) {
    await check(page, ctx);
    report.interactions.push(`fx touch: ${name}`);
  }
  assert.deepEqual(errors, [], "fx touch: no page errors");
  assert.deepEqual(cspProblems, [], "fx touch: no CSP violations");
  await context.close();
}

// --- Desktop and touch checks, one block per effect ---

desktop("the effect flags and the grain mount on a fine pointer at 1440 px", async (page) => {
  const state = await fxState(page);
  assert.equal(state.fx, true, "desktop: data-fx is set");
  assert.equal(state.grain, true, "desktop: the grain overlay mounts");
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-fx-motion")), true, "desktop: data-fx-motion is set");
  const grain = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector("[data-fx-grain]"));
    return { opacity: parseFloat(style.opacity), events: style.pointerEvents, position: style.position };
  });
  assert.ok(grain.opacity >= 0.03 && grain.opacity <= 0.04, `desktop: grain sits at 3–4% (${grain.opacity})`);
  assert.deepEqual({ events: grain.events, position: grain.position }, { events: "none", position: "fixed" }, "desktop: grain is a fixed, click-through overlay");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "desktop: effects add no horizontal overflow");
});

// --- Run alone ---

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2];
  if (!base) {
    console.error("usage: node scripts/fx-checks.mjs <base URL of the preview, e.g. http://127.0.0.1:8791>");
    process.exit(2);
  }
  const { launchBrowser } = await import("./browser-runtime.mjs");
  const browser = await launchBrowser();
  const report = { interactions: [] };
  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const desktopResults = await checkFxDesktop({ context: desktopContext, base, report });
    await desktopContext.close();
    for (const [label, options, flags] of [
      ["reduced-motion", { viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" }, { motionOff: true }],
      ["no-javascript", { viewport: { width: 1440, height: 1000 }, javaScriptEnabled: false }, { motionOff: true }],
      ["mobile-390", { viewport: { width: 390, height: 844 } }, {}],
    ]) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto(base, { waitUntil: "networkidle" });
      await assertFxAbsent(page, label, flags);
      report.interactions.push(`fx ${label}: effects stay off`);
      await context.close();
    }
    await checkFxTouch({ browser, base, report, desktop: desktopResults });
    console.log(report.interactions.join("\n"));
    console.log(`FX checks passed: ${report.interactions.length} checks.`);
  } finally {
    await browser.close();
  }
}
