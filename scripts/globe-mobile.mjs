// The phone and tablet globe's checks (used by browser-check.mjs and the scratch proof scripts).
//
// `mobileProbe` (an init script) records when idle callbacks run, the live timers made with setInterval
// (by delay) and every WebGL context the page creates. `watchSceneChunk` finds the scene's code chunk by
// its content (three's WebGLRenderer). `mountOrder` reads when the page loaded, the idle callback that
// started the globe and the chunk and texture requests. `statementContrast` measures the WCAG contrast of
// the hero statement's filled words against what is behind them. `deepReloadCheck` and `touchHoldCheck`
// are whole-page checks on a phone. (A retried first render reusing the scene's pending load is unit-tested
// in tests/globe-pending.test.mjs: no page reliably interrupts that render.)
import assert from "node:assert/strict";
import sharp from "sharp";
import { CAPABLE_DESKTOP, fakeGpu } from "./globe-stream.mjs";

/** Init script (runs in the page): see the header. The record is `window.__mobile`. */
export function mobileProbe() {
  const record = { idle: [], intervals: new Map(), webgl: [] };
  window.__mobile = record;
  const ric = window.requestIdleCallback;
  if (ric) window.requestIdleCallback = function (callback, options) {
    return ric.call(window, (deadline) => { record.idle.push(performance.now()); callback(deadline); }, options);
  };
  const setInterval = window.setInterval, clearInterval = window.clearInterval;
  window.setInterval = function (handler, ms, ...rest) {
    const id = setInterval.call(window, handler, ms, ...rest);
    record.intervals.set(id, Number(ms) || 0);
    return id;
  };
  window.clearInterval = function (id) {
    record.intervals.delete(id);
    return clearInterval.call(window, id);
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    const context = getContext.call(this, type, ...args);
    if (context && /webgl/.test(type) && !record.webgl.includes(context)) record.webgl.push(context);
    return context;
  };
}

/** Live setInterval timers with this delay. */
export const liveIntervals = (page, ms) => page.evaluate((ms) => [...window.__mobile.intervals.values()].filter((delay) => delay === ms).length, ms);

/** Paths of the script responses that carry three's renderer (the scene chunk), filled in as they arrive. */
export function watchSceneChunk(page) {
  const paths = new Set();
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script") return;
    const body = await response.text().catch(() => "");
    if (body.includes("WebGLRenderer")) paths.add(new URL(response.url()).pathname);
  });
  return paths;
}

/**
 * When the page's load event ran, the first idle callback after it, and when the scene chunk and the
 * first globe texture were requested (ms from navigation start; null when absent).
 */
export function mountOrder(page, sceneChunks) {
  return page.evaluate((chunks) => {
    const load = performance.getEntriesByType("navigation")[0]?.loadEventStart ?? null;
    const resources = performance.getEntriesByType("resource");
    const chunk = resources.filter((e) => chunks.includes(new URL(e.name).pathname)).map((e) => e.startTime)[0] ?? null;
    const textures = resources.filter((e) => e.name.includes("/textures/earth/")).map((e) => e.startTime);
    // The idle callback that started the globe: the last one before the chunk's request.
    const idle = load === null ? null : window.__mobile.idle.filter((t) => t >= load && (chunk === null || t <= chunk)).at(-1) ?? null;
    const round = (t) => (t === null ? null : Math.round(t));
    return { load: round(load), idle: round(idle), chunk: round(chunk), textures: textures.length ? Math.round(Math.min(...textures)) : null };
  }, [...sceneChunks]);
}

const linear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (r, g, b) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(p * values.length))];

/**
 * WCAG contrast of the hero statement's filled words (opacity 1) over what is behind them, at fill
 * positions of the statement's scroll window (start 0.8 → end 0.4 of the viewport, as ScrollFillText).
 * For each word, every pixel of its box is modelled as the word's colour composited over the background
 * captured with the words made transparent (their halo stays: it is part of what is behind them); the
 * word scores the 10th percentile of those ratios. The 2D starfield is hidden (it twinkles).
 * Returns, per fill, the worst filled word, the words and the globe's filter.
 */
export async function statementContrast(page, { fills = [0, 0.5, 1] } = {}) {
  const stars = await page.addStyleTag({ content: "#home canvas:not(.hero-mobile-globe canvas) { visibility: hidden !important; }" });
  try {
    const geo = await page.evaluate(() => {
      const target = document.querySelector("#home p.display").parentElement.getBoundingClientRect();
      return { top: target.top + scrollY, height: target.height, vh: innerHeight };
    });
    const start = geo.top - 0.8 * geo.vh, end = geo.top + geo.height - 0.4 * geo.vh;
    const states = [];
    for (const fill of fills) {
      const y = Math.max(0, Math.round(start + fill * (end - start)));
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
      await page.waitForTimeout(500);
      const view = await page.evaluate(() => {
        const p = document.querySelector("#home p.display").getBoundingClientRect();
        const globe = document.querySelector("#home .hero-mobile-globe");
        return {
          p: { x: p.left, y: p.top, w: p.width, h: p.height },
          filter: globe ? getComputedStyle(globe).filter : null,
          words: [...document.querySelectorAll("#home p.display [data-scroll-word]")].map((el) => {
            const r = el.getBoundingClientRect(), style = getComputedStyle(el);
            return { text: el.textContent, x: r.left, y: r.top, w: r.width, h: r.height, opacity: Number(style.opacity), rgb: style.color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number) };
          }),
        };
      });
      const width = await page.evaluate(() => innerWidth);
      const clip = { x: Math.max(0, Math.floor(view.p.x - 4)), y: Math.max(0, Math.floor(view.p.y - 4)), width: Math.min(width, Math.ceil(view.p.w + 8)), height: Math.ceil(view.p.h + 8) };
      const hide = await page.addStyleTag({ content: "#home p.display [data-scroll-word] { color: transparent !important; }" });
      const { data, info } = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      await hide.evaluate((el) => el.remove());
      const scale = info.width / clip.width;
      const scored = view.words.filter((word) => word.opacity >= 0.99).map((word) => {
        const [r, g, b] = word.rgb, ratios = [];
        const x0 = Math.max(0, Math.floor((word.x - clip.x) * scale)), x1 = Math.min(info.width, Math.ceil((word.x + word.w - clip.x) * scale));
        const y0 = Math.max(0, Math.floor((word.y - clip.y) * scale)), y1 = Math.min(info.height, Math.ceil((word.y + word.h - clip.y) * scale));
        for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
          const i = (py * info.width + px) * 3;
          ratios.push(ratio(luminance(r, g, b), luminance(data[i], data[i + 1], data[i + 2])));
        }
        return { text: word.text, p10: Math.round(percentile(ratios, 0.1) * 100) / 100 };
      });
      states.push({ fill, scrollY: y, filter: view.filter, filled: scored.length, words: view.words.length, worstP10: scored.length ? Math.min(...scored.map((w) => w.p10)) : null, worst: scored.length ? scored.reduce((a, b) => (b.p10 < a.p10 ? b : a)).text : null });
    }
    return states;
  } finally {
    await stars.evaluate((el) => el.remove());
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }
}

async function phone(browser, { viewport = { width: 390, height: 844 }, gpu = CAPABLE_DESKTOP, ...options } = {}) {
  const context = await browser.newContext({ viewport, ...options });
  await context.addInitScript(fakeGpu, gpu);
  await context.addInitScript(mobileProbe);
  const page = await context.newPage();
  const errors = [], textures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.url().includes("/textures/earth/")) textures.push(new URL(request.url()).pathname); });
  return { context, page, errors, textures, scene: watchSceneChunk(page) };
}

/**
 * A reload far below the hero (the browser restores the scroll position before DOMContentLoaded) loads no
 * part of the globe: no scene chunk, no texture, not even a test WebGL context. Scrolled back to the top,
 * the globe mounts and fetches its five maps once.
 */
export async function deepReloadCheck(browser, base) {
  const { context, page, errors, textures, scene } = await phone(browser);
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(300);
    scene.clear();
    textures.length = 0;
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3000); // past the idle callback's 2 s timeout
    const deep = await page.evaluate(() => ({ scrollY: Math.round(scrollY), heroBottom: Math.round(document.getElementById("home").getBoundingClientRect().bottom), contexts: window.__mobile.webgl.length, globe: document.querySelectorAll("#home .hero-mobile-globe").length }));
    assert.ok(deep.heroBottom < 0, `deep reload: the page reopens below the hero (precondition: ${JSON.stringify(deep)})`);
    assert.deepEqual({ sceneChunk: [...scene], textures, contexts: deep.contexts, globe: deep.globe, errors }, { sceneChunk: [], textures: [], contexts: 0, globe: 0, errors: [] }, `deep reload: a phone that reloads below the hero loads none of the globe (${JSON.stringify(deep)})`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForSelector('#home .hero-mobile-globe[data-globe="ready"]', { timeout: 45000 });
    assert.deepEqual({ sceneChunk: scene.size, textures: textures.length, errors }, { sceneChunk: 1, textures: 5, errors: [] }, "deep reload: back at the top, the globe mounts and fetches its five maps once");
    return deep;
  } finally {
    await context.close();
  }
}

/**
 * A touch whose node is removed before the finger lifts: the touchend goes to that detached node only and
 * never reaches the window. The gate also listens on the touched node, so the globe still mounts about
 * INPUT_QUIET_MS after the release, not after its stale-touch fallback.
 */
export async function detachedTouchCheck(browser, base, { quietMs }) {
  const { context, page, errors, scene } = await phone(browser, { hasTouch: true, isMobile: true });
  try {
    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector("#home:not(.hero-reserve)", { state: "attached", timeout: 30000 }); // hydrated
    await page.evaluate(() => {
      const node = document.createElement("div");
      node.id = "detached-touch";
      node.style.cssText = "position:fixed;left:0;top:300px;width:100%;height:120px;z-index:999";
      document.body.append(node);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 360 }] });
    await page.evaluate(() => document.getElementById("detached-touch").remove());
    await page.waitForTimeout(1500);
    const held = { sceneChunk: [...scene], globe: await page.locator("#home .hero-mobile-globe").count() };
    const releasedAt = await page.evaluate(() => performance.now());
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await page.waitForSelector('#home .hero-mobile-globe[data-globe="ready"]', { timeout: 45000 });
    const order = await mountOrder(page, scene);
    const facts = { held, releasedAt: Math.round(releasedAt), ...order, afterRelease: order.chunk - Math.round(releasedAt), errors };
    assert.deepEqual(held, { sceneChunk: [], globe: 0 }, `detached touch: no globe while the touch is held (${JSON.stringify(facts)})`);
    assert.ok(order.chunk >= releasedAt + quietMs && order.chunk < releasedAt + quietMs + 2000 && errors.length === 0, `detached touch: the release on the removed node is heard, and the globe mounts ${quietMs} ms after it (${JSON.stringify(facts)})`);
    return facts;
  } finally {
    await context.close();
  }
}

/**
 * A touch held from before the page's load event: the globe's mount waits until the touch has ended and
 * INPUT_QUIET_MS more have passed, so its script evaluation never lands on a tap or a swipe. The galaxy
 * is held back a little so the touch starts after hydration and before load.
 */
export async function touchHoldCheck(browser, base, { quietMs, holdMs = 2500 }) {
  const { context, page, errors, scene } = await phone(browser, { hasTouch: true, isMobile: true });
  try {
    await page.route("**/images/galaxy.webp", async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue().catch(() => {}); });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#home:not(.hero-reserve)", { state: "attached", timeout: 30000 }); // hydrated
    const cdp = await context.newCDPSession(page);
    const point = { x: 195, y: 330 }; // the headline
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    const startedBeforeLoad = await page.evaluate(() => document.readyState !== "complete");
    await page.waitForFunction(() => document.readyState === "complete", null, { timeout: 30000 });
    await page.waitForTimeout(holdMs);
    const held = { sceneChunk: [...scene], globe: await page.locator("#home .hero-mobile-globe").count() };
    const releasedAt = await page.evaluate(() => performance.now());
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await page.waitForSelector('#home .hero-mobile-globe[data-globe="ready"]', { timeout: 45000 });
    const order = await mountOrder(page, scene);
    const facts = { startedBeforeLoad, held, releasedAt: Math.round(releasedAt), ...order, errors };
    assert.ok(startedBeforeLoad, `touch hold: the touch starts before the load event (precondition: ${JSON.stringify(facts)})`);
    assert.deepEqual(held, { sceneChunk: [], globe: 0 }, `touch hold: no globe while a touch is held (${JSON.stringify(facts)})`);
    assert.ok(order.chunk >= releasedAt + quietMs && errors.length === 0, `touch hold: the globe mounts ${quietMs} ms after the touch ends (${JSON.stringify(facts)})`);
    return facts;
  } finally {
    await context.close();
  }
}
