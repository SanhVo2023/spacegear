// Browser checks for the motion system (src/components/fx). scripts/browser-check.mjs runs them inside its
// desktop profile and a touch context. Run them alone (faster while building an effect) with the preview's
// base URL, which is required (no default port):
//   node scripts/fx-checks.mjs http://127.0.0.1:8791
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Section titles that editors can change in the CMS (content/sections.json), read once so the checks follow
// an edit instead of hard-coding the copy (browser-check.mjs reads content/home.json the same way).
const SECTION_COPY = JSON.parse(readFileSync(new URL("../content/sections.json", import.meta.url), "utf8"));
// What We Measure's chart figures (content/measure.json), for the donut check.
const MEASURE_COPY = JSON.parse(readFileSync(new URL("../content/measure.json", import.meta.url), "utf8"));

/** Page instrumentation, installed before any page script: counts animation frames and view transitions, and
 *  records the window's scroll positions (a scroll the browser animates fires dozens of scroll events). */
function instrument() {
  window.__fx = { raf: 0, vt: 0, scrolls: [] };
  window.addEventListener("scroll", () => window.__fx.scrolls.push(Math.round(window.scrollY)), { passive: true });
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

/** Waits (up to 3 s) until no view transition runs. A route change commits inside the page curtain
 *  (PageTransition.tsx), and React runs the new page's passive effects only once the curtain has finished. */
export function transitionsDone(page) {
  return page.waitForFunction(() => !document.getAnimations().some((a) => a.effect?.pseudoElement?.startsWith("::view-transition")), null, { timeout: 3000 });
}

/** Animation frames requested during `ms` of idle time. */
export async function idleFrames(page, ms = 300) {
  const before = await page.evaluate(() => window.__fx.raf);
  await page.waitForTimeout(ms);
  return (await page.evaluate(() => window.__fx.raf)) - before;
}

/**
 * The scrolls the browser makes on its own, from the home page parked on #pricing: a reload, a client-side
 * route change (the nav's About link) and Back to the home page. For each it returns where the page landed
 * and how many scroll events reported a position on the way there. A scroll the browser animates fires
 * dozens; an instant one fires at most a couple (a first restore can be clamped while the page grows).
 * Needs `instrument`.
 */
export async function restorations(page) {
  const passed = (from, to) => page.evaluate(([a, b]) => window.__fx.scrolls.filter((y) => y > Math.min(a, b) + 4 && y < Math.max(a, b) - 4).length, [from, to]);
  await jumpTo(page, await sectionTop(page, "pricing"));
  await page.waitForTimeout(500);
  const held = await page.evaluate(() => window.scrollY);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1500);
  const reload = { held, landed: await page.evaluate(() => window.scrollY), between: await passed(0, held) };
  await page.evaluate(() => { window.__fx.scrolls = []; });
  await page.locator('header a[href="/about/"]').first().click();
  await page.waitForURL("**/about/");
  await page.waitForTimeout(1500);
  const away = { from: reload.landed, landed: await page.evaluate(() => window.scrollY), between: await passed(0, reload.landed) };
  await page.evaluate(() => { window.__fx.scrolls = []; });
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/");
  await page.waitForTimeout(2000);
  const back = { held: reload.landed, landed: await page.evaluate(() => window.scrollY), between: await passed(0, reload.landed) };
  return { reload, away, back };
}

/** Asserts that the restorations() run landed every scroll at once, where it belongs. */
function assertRestorations(label, { reload, away, back }) {
  const facts = JSON.stringify({ reload, away, back });
  assert.ok(Math.abs(reload.landed - reload.held) <= 8 && reload.between <= 2, `${label}: a reload far down the page restores its position at once (${facts})`);
  assert.ok(away.landed <= 1 && away.between <= 2, `${label}: a route change opens the next page at its top at once (${facts})`);
  assert.ok(Math.abs(back.landed - back.held) <= 8 && back.between <= 2, `${label}: Back restores the position at once, not gliding from the top (${facts})`);
}

/** Waits (up to 3 s) until no CSS transition or animation runs on the element or an ancestor: a Reveal that
 *  is still rising moves the element's box under a pointer placed from an earlier boundingBox(). */
export function settle(locator) {
  return locator.evaluate((el) => new Promise((resolve) => {
    const start = performance.now();
    const busy = () => document.getAnimations().some((a) => a.playState === "running" && a.effect?.target instanceof Element && a.effect.target.contains(el));
    const tick = () => (!busy() || performance.now() - start > 3000 ? resolve() : setTimeout(tick, 50));
    tick();
  }));
}

/** Translation (m41, m42) and scale (a) of an element's computed transform. */
export function matrixOf(locator) {
  return locator.evaluate((el) => {
    const transform = getComputedStyle(el).transform;
    const m = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    return { a: m.a, m41: m.m41, m42: m.m42, is2D: m.is2D };
  });
}

/** Starts recording, in the page, every pointer point (coalesced ones included) and, once per frame, where the
 *  cursor's dot and ring sit in that frame. A ResizeObserver callback reads them: it runs after every animation-frame
 *  callback, once style and layout are done, just before paint, so it reads what the frame paints. */
export function probeCursor(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    const dot = root.querySelector(".fx-cursor-dot-pos");
    const ring = root.querySelector(".fx-cursor-ring");
    const at = (el) => {
      const transform = getComputedStyle(el).transform;
      const m = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
      return [m.m41, m.m42];
    };
    const log = { points: [], frames: [] };
    const onMove = (event) => {
      const merged = event.getCoalescedEvents?.() ?? [];
      for (const p of merged.length ? merged : [event]) log.points.push({ t: p.timeStamp, x: p.clientX, y: p.clientY });
    };
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none";
    document.body.append(probe);
    let frameTime = 0;
    let running = true;
    const observer = new ResizeObserver(() => {
      if (frameTime) log.frames.push({ t: frameTime, ready: performance.now(), dot: at(dot), ring: at(ring) });
    });
    observer.observe(probe);
    const tick = (time) => {
      if (!running) return;
      frameTime = time;
      probe.style.height = probe.style.height === "2px" ? "1px" : "2px"; // a resize every frame wakes the observer
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove, { capture: true, passive: true });
    window.__cursorProbe = () => {
      running = false;
      observer.disconnect();
      probe.remove();
      window.removeEventListener("pointermove", onMove, { capture: true });
      return log;
    };
  });
}

/** Stops probeCursor and returns its log. */
export function stopProbe(page) {
  return page.evaluate(() => window.__cursorProbe());
}

/** Moves the mouse from `from` to `to` in `steps` integer moves, at most one every `every` ms: x rises at every
 *  step (so each position names one move), and y rides a gentle wave. Each move waits until the page has taken
 *  it, which in Chromium is about one frame, so a glide advances about one step per frame. */
export async function glide(page, from, to, { steps = 200, every = 8, wave = 60 } = {}) {
  let next = performance.now();
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    next += every;
    while (performance.now() < next) await new Promise((resolve) => setImmediate(resolve));
    await page.mouse.move(Math.round(from.x + (to.x - from.x) * f), Math.round(from.y + (to.y - from.y) * f + wave * Math.sin(f * Math.PI * 2)));
  }
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : NaN;
};

/** Reads a probeCursor log taken over a glide.
 *  - For each move: `late` counts the frames that started after the move and still did not show it (0 means
 *    painted in the first frame after the event); `ms` is the time until the frame that shows it was ready.
 *  - `long`: frames longer than 25 ms while the pointer moved.
 *  - `ringSettle`: the ms after the last move until the ring rests on the pointer (within 0.5 px) for good. */
export function cursorTiming({ points, frames }) {
  const byX = new Map(points.map((p, i) => [p.x, i]));
  const shown = frames.map((f) => {
    const i = byX.get(f.dot[0]);
    return i !== undefined && Math.abs(points[i].y - f.dot[1]) < 0.01 ? i : -1;
  });
  const late = [];
  const ms = [];
  let cover = 0;
  for (let i = 0; i < points.length; i++) {
    while (cover < frames.length && shown[cover] < i) cover++;
    if (cover === frames.length) break;
    late.push(frames.slice(0, cover).filter((f) => f.t > points[i].t).length);
    ms.push(frames[cover].ready - points[i].t);
  }
  const end = points.at(-1);
  const steps = frames.slice(1).map((f, i) => ({ t: f.t, step: f.t - frames[i].t })).filter((f) => f.t >= points[0].t && f.t <= end.t + 50);
  const off = frames.findLastIndex((f) => Math.hypot(f.ring[0] - end.x, f.ring[1] - end.y) > 0.5 || f.dot[0] !== end.x || f.dot[1] !== end.y);
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    moves: points.length,
    painted: late.length,
    lateFrames: { p50: percentile(late, 0.5), p95: percentile(late, 0.95), max: Math.max(...late) },
    ms: { p50: r1(percentile(ms, 0.5)), p95: r1(percentile(ms, 0.95)), max: r1(Math.max(...ms)) },
    frames: steps.length,
    long: steps.filter((f) => f.step > 25).length,
    longest: r1(Math.max(0, ...steps.map((f) => f.step))),
    ringSettle: off + 1 < frames.length ? r1(frames[off + 1].ready - end.t) : Infinity,
  };
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
      // Footer wordmark letters out of their rest position. The drawn <Wordmark> (brand kit) always renders its
      // nine [data-letter] glyphs, so the effect shows only as a letter that is lowered, hidden or leaning.
      letters: [...document.querySelectorAll("[data-letter]")].filter((el) => {
        const style = getComputedStyle(el);
        return style.transform !== "none" || style.translate !== "none" || parseFloat(style.opacity) < 0.99;
      }).length,
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

/** Runs every desktop check in one tab of `context` (or, with `only`, the ones whose names match it: the
 *  run-alone block's FX_ONLY; browser-check.mjs never passes it, so the full gate always runs every check);
 *  returns results the touch checks compare against. */
export async function checkFxDesktop({ context, base, report, only = null }) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(instrument);
  const ctx = { base, deepLinkTop: null };
  for (const [name, check] of DESKTOP_CHECKS) {
    if (only && !only.test(name)) continue;
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
  await page.addInitScript(instrument);
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

desktop("Lenis smooths the wheel, then requests no frames once idle", async (page) => {
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("lenis")), true, "desktop: Lenis is active");
  // Start below the hero (its globe stops rendering offscreen), with the pointer in the empty left gutter.
  await jumpTo(page, await sectionTop(page, "pricing"));
  await page.mouse.move(6, 500);
  await page.waitForTimeout(800);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(80);
  const mid = await page.evaluate(() => ({ y: window.scrollY, smooth: document.documentElement.classList.contains("lenis-smooth") }));
  assert.equal(mid.smooth, true, "desktop: a wheel scroll glides (lenis-smooth)");
  await page.waitForTimeout(1600);
  const y1 = await page.evaluate(() => window.scrollY);
  assert.ok(y1 - y0 > 600 && y1 - y0 <= 701, `desktop: the glide covers the wheel delta (moved ${y1 - y0}px)`);
  assert.ok(mid.y < y1, "desktop: the glide is still under way 80 ms after the wheel");
  const frames = await idleFrames(page);
  assert.ok(frames <= 2, `desktop: no animation frames once the glide ends (${frames} in 300 ms)`);
});

desktop("keyboard scrolling wins over a glide in progress", async (page) => {
  await jumpTo(page, await sectionTop(page, "process"));
  await page.mouse.move(6, 500);
  await page.waitForTimeout(600);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(60);
  await page.keyboard.press("End");
  await page.waitForTimeout(1800);
  const gap = await page.evaluate(() => document.documentElement.scrollHeight - (window.scrollY + innerHeight));
  assert.ok(gap < 4, `desktop: End during a glide reaches the end of the page (${gap}px short)`);
});

desktop("a deep link to #pricing lands at the anchor offset with Lenis on", async (page, ctx) => {
  await page.goto("about:blank");
  await page.goto(new URL("/#pricing", ctx.base).href, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const landing = await page.evaluate(() => ({ lenis: document.documentElement.classList.contains("lenis"), top: document.getElementById("pricing").getBoundingClientRect().top }));
  assert.equal(landing.lenis, true, "desktop deep link: Lenis is active (precondition)");
  assert.ok(Math.abs(landing.top) < 200, `desktop deep link: #pricing lands at the top (${landing.top}px)`);
  ctx.deepLinkTop = landing.top;
});

desktop("a hash link clicked mid-glide lands on its anchor", async (page, ctx) => {
  assert.equal(typeof ctx.deepLinkTop, "number", "desktop: the deep-link result is available (precondition)");
  await page.mouse.move(6, 500);
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(60);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("lenis-smooth")), true, "desktop: a glide is under way (precondition)");
  await page.locator('header a[href="/#pricing"]').first().click();
  await page.waitForTimeout(2500);
  const top = await page.evaluate(() => document.getElementById("pricing").getBoundingClientRect().top);
  assert.ok(Math.abs(top - ctx.deepLinkTop) <= 4, `desktop: the nav's Engagements link, clicked mid-glide, lands #pricing where a deep link does (${top}px, deep link ${ctx.deepLinkTop}px)`);
});

desktop("the skip link still moves focus into main", async (page) => {
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.matches(".skip-link")), true, "desktop: the first Tab focuses the skip link (precondition)");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.keyboard.press("Tab");
  const after = await page.evaluate(() => ({ hash: location.hash, inMain: Boolean(document.activeElement?.closest("main")) }));
  assert.deepEqual(after, { hash: "#main", inMain: true }, "desktop: after the skip link, the next Tab lands inside main");
});

desktop("a wheel during the intro ends it, then glides", async (page, ctx) => {
  const intro = await page.context().newPage(); // a new tab is a new session: the intro plays
  const introErrors = [];
  intro.on("pageerror", (error) => introErrors.push(error.message));
  try {
    // Hold the textures so the intro is still loading when the wheel turns.
    await intro.route("**/textures/earth/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.continue().catch(() => {});
    });
    await intro.goto(ctx.base, { waitUntil: "domcontentloaded" });
    await intro.waitForFunction(() => document.documentElement.classList.contains("lenis"), null, { timeout: 15000 });
    assert.equal(await intro.evaluate(() => document.documentElement.dataset.intro), "play", "desktop: the intro is still loading (precondition)");
    await intro.mouse.move(6, 500);
    await intro.mouse.wheel(0, 900);
    await intro.waitForTimeout(1500);
    const after = await intro.evaluate(() => ({ intro: document.documentElement.dataset.intro, y: window.scrollY }));
    assert.equal(after.intro, "done", "desktop: a wheel ends the intro");
    assert.ok(after.y > 600, `desktop: the wheel that ended the intro still scrolls the page (${after.y}px)`);
    assert.deepEqual(introErrors, [], "desktop intro tab: no page errors");
  } finally {
    await intro.close();
  }
});

desktop("reloads, route changes and Back land at once", async (page) => {
  assertRestorations("desktop", await restorations(page));
});

desktop("the CMS admin page carries none of the site's effects", async (page, ctx) => {
  const html = await (await page.request.get(new URL("/admin/", ctx.base).href)).text();
  assert.ok(/sveltia/i.test(html), "admin: the page is the CMS (precondition)");
  assert.equal(/\/_next\/|data-fx|lenis/.test(html), false, "admin: no Next runtime, so no FxLayer, Lenis, cursor or grain");
});

touch("a deep link to #pricing lands at the same offset without Lenis", async (page, ctx) => {
  assert.equal(typeof ctx.desktop?.deepLinkTop, "number", "touch: the desktop deep-link result is available (precondition)");
  await page.goto("about:blank");
  await page.goto(new URL("/#pricing", ctx.base).href, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => document.getElementById("pricing").getBoundingClientRect().top);
  assert.ok(Math.abs(top - ctx.desktop.deepLinkTop) <= 4, `deep link: ${top}px without Lenis, ${ctx.desktop.deepLinkTop}px with it`);
});

touch("reloads, route changes and Back land at once without Lenis", async (page, ctx) => {
  await page.goto("about:blank");
  await page.goto(ctx.base, { waitUntil: "load" });
  await page.waitForTimeout(500);
  assertRestorations("touch", await restorations(page));
});

desktop("the cursor follows the mouse, steps aside for the keyboard and over text fields", async (page) => {
  await page.mouse.move(640, 420);
  await page.mouse.move(660, 430, { steps: 3 });
  await page.waitForTimeout(200);
  const shown = await page.evaluate(() => ({
    state: document.querySelector("[data-fx-cursor-root]")?.dataset.state ?? "missing",
    native: getComputedStyle(document.body).cursor,
  }));
  assert.ok(!["hidden", "missing"].includes(shown.state), `desktop: the custom cursor appears with the mouse (${shown.state})`);
  assert.equal(shown.native, "none", "desktop: the native cursor is replaced");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(350);
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    const root = document.querySelector("[data-fx-cursor-root]");
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const style = getComputedStyle(el);
    return {
      state: root.dataset.state,
      dot: parseFloat(getComputedStyle(root.querySelector(".fx-cursor-dot")).opacity),
      disc: parseFloat(getComputedStyle(root.querySelector(".fx-cursor-disc")).opacity),
      outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2,
      onTop: Boolean(hit && (hit === el || el.contains(hit))),
      native: getComputedStyle(document.body).cursor,
    };
  });
  assert.deepEqual(focus, { state: "hidden", dot: 0, disc: 0, outline: true, onTop: true, native: "auto" }, "desktop: keyboard focus hides the custom cursor and keeps the focus ring visible");
  await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  await page.getByLabel("Your name").hover();
  await page.waitForTimeout(250);
  const overField = await page.evaluate(() => ({
    state: document.querySelector("[data-fx-cursor-root]").dataset.state,
    cursor: getComputedStyle(document.querySelector('input[aria-label="Your name"]')).cursor,
  }));
  assert.equal(overField.state, "text", "desktop: the custom cursor steps aside over a text field");
  assert.notEqual(overField.cursor, "none", "desktop: the native caret shows over a text field");
});

desktop("the cursor shows the data-cursor label", async (page) => {
  await jumpTo(page, await sectionTop(page, "work"));
  await page.waitForTimeout(900);
  await page.locator('#work [data-cursor="View"]').first().hover();
  await page.waitForTimeout(300);
  // The label fades in over 0.2 s; give a frame held up by the tiles' first image decode time to land.
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector("[data-fx-cursor-root] .fx-cursor-label")).opacity) > 0.99, null, { timeout: 2000 }).catch(() => {});
  const labelled = await page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    const label = root.querySelector(".fx-cursor-label");
    return { state: root.dataset.state, text: label.textContent, opacity: parseFloat(getComputedStyle(label).opacity) };
  });
  assert.deepEqual({ state: labelled.state, text: labelled.text }, { state: "label", text: "View" }, "desktop: a What We Do tile labels the cursor");
  assert.ok(labelled.opacity > 0.99, "desktop: the label is visible");
});

desktop("the cursor never takes a pointer event, and the live globe labels it Drag", async (page) => {
  // The globe wrapper carries data-cursor="Drag" while the live globe shows (Part 1).
  await page.waitForSelector('#home .hero-scene[data-cursor="Drag"]', { timeout: 45000 });
  const spot = await page.evaluate(() => {
    for (let x = innerWidth - 120; x > innerWidth / 2; x -= 40) {
      for (let y = 240; y < innerHeight - 160; y += 60) {
        if (document.elementFromPoint(x, y)?.closest(".hero-scene")) return { x, y };
      }
    }
    return null;
  });
  assert.ok(spot, "desktop: part of the live globe is open to the pointer (precondition)");
  await page.mouse.move(spot.x - 30, spot.y);
  await page.mouse.move(spot.x, spot.y, { steps: 3 });
  await page.waitForTimeout(300);
  const over = await page.evaluate(({ x, y }) => {
    const root = document.querySelector("[data-fx-cursor-root]");
    const parts = [root, ...root.querySelectorAll("*")];
    const hit = document.elementFromPoint(x, y);
    return {
      state: root.dataset.state,
      label: root.querySelector(".fx-cursor-label").textContent,
      clickThrough: parts.every((el) => getComputedStyle(el).pointerEvents === "none"),
      hitsGlobe: Boolean(hit?.closest(".hero-scene")),
      hidden: root.getAttribute("aria-hidden"),
    };
  }, spot);
  assert.deepEqual(over, { state: "label", label: "Drag", clickThrough: true, hitsGlobe: true, hidden: "true" }, "desktop: over the live globe the cursor reads Drag, passes every pointer event to the globe and stays hidden from assistive technology");
});

/** Blend modes other than normal anywhere in the cursor. */
function cursorBlends(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    return [root, ...root.querySelectorAll("*")].map((el) => getComputedStyle(el).mixBlendMode).filter((mode) => mode !== "normal");
  });
}

desktop("the cursor dot is painted in the first frame after each move, over the globe, and never blends", async (page) => {
  await page.waitForSelector('#home .hero-scene[data-cursor="Drag"]', { timeout: 45000 }); // the live globe renders under the path
  await page.mouse.move(700, 480);
  await page.mouse.move(710, 480, { steps: 2 });
  await page.waitForTimeout(400);
  await probeCursor(page);
  await glide(page, { x: 720, y: 480 }, { x: 1320, y: 480 }, { steps: 200 });
  await page.waitForTimeout(400);
  const timing = cursorTiming(await stopProbe(page));
  const facts = JSON.stringify(timing);
  assert.ok(timing.painted >= 190, `desktop: the probe saw the dot reach the glide's moves (${facts})`);
  assert.ok(timing.lateFrames.p95 === 0 && timing.lateFrames.max <= 1, `desktop: the dot is painted in the first frame after each move, at worst one frame later (${facts})`);
  /** The cursor's state, whether its dot and ring carry an outline, and which layers are promoted. */
  const look = () => page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    const style = (selector) => getComputedStyle(root.querySelector(selector));
    return {
      state: root.dataset.state,
      dotOutline: style(".fx-cursor-dot").boxShadow !== "none",
      ringOutline: style(".fx-cursor-disc").boxShadow !== "none",
      promoted: [style(".fx-cursor-dot-pos").willChange, style(".fx-cursor-ring").willChange, getComputedStyle(root).willChange],
    };
  });
  const promoted = ["transform", "transform", "auto"];
  assert.deepEqual(await cursorBlends(page), [], "desktop: over the globe (Drag) the cursor does not blend");
  assert.deepEqual(await look(), { state: "label", dotOutline: true, ringOutline: false, promoted }, "desktop: over the globe the orange label disc keeps its plain look, and only the moving layers are promoted");
  const link = await page.locator('header a[href="/about/"]').first().boundingBox();
  await page.mouse.move(link.x + link.width / 2, link.y + link.height / 2, { steps: 4 });
  await page.waitForTimeout(300);
  assert.deepEqual(await look(), { state: "hover", dotOutline: true, ringOutline: true, promoted }, "desktop: over a nav link the white dot and ring carry a dark outline");
  assert.deepEqual(await cursorBlends(page), [], "desktop: over a link the cursor does not blend");
});

desktop("the cursor ring settles on the pointer within 150 ms of a stop, snaps across long jumps, then requests no frames", async (page) => {
  await jumpTo(page, await sectionTop(page, "pricing"));
  await page.mouse.move(6, 420);
  await page.waitForTimeout(800);
  await probeCursor(page);
  await glide(page, { x: 20, y: 420 }, { x: 620, y: 420 }, { steps: 100, wave: 40 }); // about 6 px a frame: 360 px/s
  await page.waitForTimeout(500);
  const timing = cursorTiming(await stopProbe(page));
  assert.ok(timing.ringSettle <= 150, `desktop: the ring rests on the pointer within 150 ms of a stop (${JSON.stringify(timing)})`);
  await probeCursor(page);
  await page.mouse.move(1100, 700); // one 530 px jump
  await page.waitForTimeout(300);
  const jump = await stopProbe(page);
  const landed = jump.frames.find((f) => f.dot[0] === 1100 && f.dot[1] === 700);
  assert.deepEqual(landed?.ring, [1100, 700], "desktop: after a jump of more than 300 px the ring is on the pointer in the same frame as the dot");
  await page.waitForTimeout(600);
  const frames = await idleFrames(page);
  assert.ok(frames <= 2, `desktop: a resting cursor requests no frames (${frames} in 300 ms)`);
});

desktop("magnetic CTAs lean toward the pointer and nudge their arrow", async (page) => {
  const cta = page.locator("#process a[data-magnetic]").first();
  await cta.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await settle(cta);
  const box = await cta.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2, { steps: 5 });
  await page.waitForTimeout(600);
  const pulled = await matrixOf(cta);
  assert.ok(pulled.m41 > 1 && pulled.m41 <= 10.5, `desktop: the CTA leans toward the pointer, at most 10 px (${pulled.m41}px)`);
  const nudge = await cta.locator("[data-magnetic-glyph]").evaluate((el) => parseFloat(getComputedStyle(el).translate));
  assert.ok(nudge > 1, `desktop: the arrow glyph nudges further (${nudge}px)`);
  await page.mouse.move(6, 500, { steps: 4 });
  await page.waitForTimeout(900);
  assert.ok(Math.abs((await matrixOf(cta)).m41) < 0.5, "desktop: the CTA springs back when the pointer leaves");
  const frames = await idleFrames(page);
  assert.ok(frames <= 2, `desktop: the settled spring requests no frames (${frames} in 300 ms)`);
  // Still a plain link: its name is its visible text, and keyboard focus shows the global focus ring.
  const text = (await cta.textContent()).trim();
  assert.ok(await page.locator("#process").getByRole("link", { name: text, exact: true }).count() >= 1, `desktop: the magnetic CTA keeps its accessible name ("${text}")`);
  await page.keyboard.press("Shift");
  await cta.focus();
  const ring = await cta.evaluate((el) => ({ visible: el.matches(":focus-visible"), outline: getComputedStyle(el).outlineStyle !== "none" && parseFloat(getComputedStyle(el).outlineWidth) >= 2 }));
  assert.deepEqual(ring, { visible: true, outline: true }, "desktop: keyboard focus on the magnetic CTA shows the focus ring");
});

desktop("a magnetic CTA measures itself again after a glide under a resting pointer", async (page) => {
  const cta = page.locator("#process a[data-magnetic]").first();
  await jumpTo(page, await cta.evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 450));
  await page.waitForTimeout(600);
  await settle(cta);
  const box = await cta.boundingBox();
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(at.x - 80, at.y - 80);
  await page.mouse.move(at.x, at.y, { steps: 6 });
  await page.waitForTimeout(800);
  // A short wheel glide moves the button 14 px up under the still pointer; the next move must pull toward
  // the pointer from where the button is now (0.35 × 14 ≈ 4.9 px down), not from where it was (no pull).
  await page.mouse.wheel(0, 14);
  await page.waitForTimeout(1500);
  await page.mouse.move(at.x + 1, at.y);
  await page.waitForTimeout(900);
  const pull = await matrixOf(cta);
  assert.ok(pull.m42 > 2.5 && pull.m42 <= 10.5, `desktop: after the glide the CTA leans toward the pointer from its new place (${pull.m42}px down)`);
  await page.mouse.move(6, 500, { steps: 4 });
  await page.waitForTimeout(900);
});

desktop("What We Do tiles tilt toward the pointer under a spotlight", async (page) => {
  await jumpTo(page, await sectionTop(page, "work"));
  await page.waitForTimeout(900);
  const card = page.locator("#work [data-tilt]").first();
  await settle(card);
  // Layout boxes (offsets ignore transforms) of the tile and the whole bento.
  // (Tilt sits in the item's ScrollDepth layer, inside its AppearItem, inside the bento.)
  const layout = () => card.evaluate((el) => [el, (el.closest("[data-depth]") ?? el).parentElement.parentElement].map((node) => [node.offsetLeft, node.offsetTop, node.offsetWidth, node.offsetHeight].join()).join("|"));
  const rest = await card.evaluate((el) => getComputedStyle(el).transform);
  const restLayout = await layout();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2, { steps: 6 });
  await page.waitForTimeout(700);
  const tilted = await card.evaluate((el, at) => ({
    transform: getComputedStyle(el).transform,
    spot: parseFloat(getComputedStyle(el.querySelector(":scope > .fx-spotlight")).opacity),
    // The pointer still reaches the tile's link through the spotlight layer.
    hitsLink: document.elementFromPoint(at.x, at.y)?.closest("a") === el.querySelector("a"),
  }), { x: box.x + box.width * 0.85, y: box.y + box.height * 0.2 });
  assert.match(tilted.transform, /^matrix3d\(/, "desktop: the tile tilts in 3D");
  assert.notEqual(tilted.transform, rest, "desktop: the tilt follows the pointer");
  assert.ok(tilted.spot > 0.99, "desktop: the spotlight shows under the pointer");
  assert.equal(tilted.hitsLink, true, "desktop: the spotlight never takes the pointer from the tile's link");
  assert.equal(await layout(), restLayout, "desktop: tilting moves no layout box");
});

desktop("the cursor dot stays under the pointer while it morphs, and a click navigation re-reads its target", async (page) => {
  /** Centre of the dot's rendered box, and the cursor's state. */
  const dot = () => page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    const r = root.querySelector(".fx-cursor-dot").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, state: root.dataset.state };
  });
  const link = page.locator('header a[href="/about/"]').first();
  const box = await link.boundingBox();
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(at.x, at.y + 160, { steps: 3 }); // below the nav: an idle cursor at full size
  await page.waitForTimeout(400);
  await page.mouse.move(at.x, at.y, { steps: 2 });
  await page.waitForTimeout(40); // mid-morph: the dot is shrinking
  const shrinking = await dot();
  assert.equal(shrinking.state, "hover", "desktop: over a link the cursor morphs (precondition)");
  assert.ok(Math.hypot(shrinking.x - at.x, shrinking.y - at.y) <= 6, `desktop: the shrinking dot stays under the pointer (${Math.round(shrinking.x)},${Math.round(shrinking.y)} vs ${Math.round(at.x)},${Math.round(at.y)})`);
  // Clicking a labelled tile swaps the page under a still pointer: the cursor re-reads what is under it
  // instead of keeping the tile's "View".
  await jumpTo(page, await sectionTop(page, "work"));
  const tile = page.locator('#work [data-cursor="View"]').first();
  await settle(tile);
  const tileBox = await tile.boundingBox();
  const spot = { x: tileBox.x + tileBox.width * 0.3, y: tileBox.y + tileBox.height * 0.3 };
  await page.mouse.move(spot.x, spot.y, { steps: 3 });
  await page.waitForTimeout(300);
  assert.equal((await dot()).state, "label", "desktop: over the tile the cursor reads View (precondition)");
  const href = await tile.getAttribute("href");
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForURL((url) => url.pathname === href);
  await transitionsDone(page);
  await page.waitForTimeout(300);
  const under = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    if (el?.closest("[data-cursor]")) return `label:${el.closest("[data-cursor]").dataset.cursor}`;
    return el?.closest('a[href], button, summary, label, [role="button"], [role="switch"], [role="marquee"]') ? "hover" : "idle";
  }, spot);
  const after = await page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    return root.dataset.state === "label" ? `label:${root.querySelector(".fx-cursor-label").textContent}` : root.dataset.state;
  });
  assert.equal(after, under, "desktop: after a click navigation the cursor matches what is now under the pointer");
});

desktop("forced colours keep the system cursor and draw the rail in system colours", async (page) => {
  try {
    await page.emulateMedia({ forcedColors: "active" });
    await page.waitForTimeout(200);
    await page.mouse.move(700, 400);
    await page.mouse.move(720, 420, { steps: 3 });
    await page.waitForTimeout(200);
    const state = await page.evaluate(() => ({ cursor: Boolean(document.querySelector("[data-fx-cursor-root]")), flag: document.documentElement.hasAttribute("data-fx-cursor"), native: getComputedStyle(document.body).cursor }));
    assert.deepEqual(state, { cursor: false, flag: false, native: "auto" }, "desktop: in forced colours the custom cursor unmounts and the native cursor shows");
    // Forced colours turn backgrounds into Canvas: the rail's dots, track and fill keep system colours instead.
    const rail = await page.evaluate(() => {
      const canvas = getComputedStyle(document.body).backgroundColor;
      const drawn = (el) => Boolean(el) && getComputedStyle(el).backgroundColor !== canvas;
      return {
        dots: [...document.querySelectorAll("[data-fx-rail] .fx-rail-dot")].every(drawn),
        track: drawn(document.querySelector("[data-fx-rail] .fx-rail-track")),
        fill: drawn(document.querySelector("[data-fx-rail] .fx-rail-fill")),
      };
    });
    assert.deepEqual(rail, { dots: true, track: true, fill: true }, "desktop: in forced colours the rail's dots, track and fill stay visible");
  } finally {
    await page.emulateMedia({ forcedColors: "none" });
  }
});

desktop("native scrollend still reaches the page with Lenis on", async (page) => {
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("lenis")), true, "desktop: Lenis is active (precondition)");
  // With Lenis stopped (a scroll lock), a native scroll leaves it idle: the case its own handler swallowed.
  const heard = await page.evaluate(() => new Promise((resolve) => {
    let count = 0;
    document.addEventListener("scrollend", () => count++);
    document.documentElement.setAttribute("data-scroll-lock", "");
    setTimeout(() => {
      window.scrollBy({ top: 400, behavior: "instant" });
      setTimeout(() => {
        document.documentElement.removeAttribute("data-scroll-lock");
        resolve(count);
      }, 800);
    }, 100);
  }));
  assert.ok(heard >= 1, `desktop: a native scroll's scrollend reaches document listeners (${heard})`);
});

desktop("split titles keep their full accessible name and rise in as they enter", async (page) => {
  await scrollPass(page);
  const titles = await page.evaluate(() => [...document.querySelectorAll("h2[data-split-title]")].map((heading) => ({
    label: heading.getAttribute("aria-label"),
    chars: [...heading.querySelectorAll("[data-split-char]")].map((char) => char.textContent).join(""),
    hidden: heading.children.length > 0 && [...heading.children].every((child) => child.getAttribute("aria-hidden") === "true"),
    risen: heading.hasAttribute("data-in"),
  })));
  assert.ok(titles.length >= 7, `desktop: every home section title is split (${titles.length})`);
  for (const [i, title] of titles.entries()) {
    assert.equal(title.chars, title.label.replace(/\s+/g, ""), `desktop: "${title.label}" keeps every character`);
    assert.ok(title.hidden, `desktop: "${title.label}" hides its split spans from assistive technology`);
    assert.ok(title.risen, `desktop: "${title.label}" rose in when it entered the viewport`);
    assert.ok(await page.getByRole("heading", { level: 2, name: title.label, exact: true }).count() >= 1, `desktop: "${title.label}" is the heading's accessible name`);
    // The accessibility tree holds one heading named by the whole title, with no word or letter under it.
    const tree = await page.locator("h2[data-split-title]").nth(i).ariaSnapshot();
    assert.equal(tree, `- heading ${JSON.stringify(title.label)} [level=2]`, `desktop: "${title.label}" reads as one heading, no fragments`);
  }
});

desktop("split titles break into the same lines as the plain title", async (page) => {
  await page.waitForFunction(() => document.querySelector("h2[data-split-title] [data-split-char]"), null, { timeout: 10000 });
  // A hidden copy of each title, built like the server markup (whole words), at the same width.
  const lines = await page.evaluate(() => [...document.querySelectorAll("h2[data-split-title]")].map((heading) => {
    const copy = heading.cloneNode(false);
    copy.removeAttribute("data-split-title");
    copy.setAttribute("aria-hidden", "true");
    Object.assign(copy.style, { position: "absolute", visibility: "hidden", left: "0", top: "0", width: `${heading.getBoundingClientRect().width}px` });
    for (const word of heading.getAttribute("aria-label").split(" ")) {
      const outer = document.createElement("span");
      outer.className = heading.firstElementChild.className;
      outer.append(Object.assign(document.createElement("span"), { textContent: word }));
      copy.append(outer);
    }
    heading.parentElement.append(copy);
    const plain = copy.offsetHeight;
    copy.remove();
    return { label: heading.getAttribute("aria-label"), split: heading.offsetHeight, plain };
  }));
  for (const title of lines) assert.equal(title.split, title.plain, `desktop: "${title.label}" keeps its height and line breaks once split`);
});

desktop("the progress rail is keyboard-reachable and tracks the section in view", async (page) => {
  // The rail lists every home section after the hero, in page order (Testimonials and Labs only when they render).
  const listed = await page.evaluate(() => ({
    rail: [...document.querySelectorAll("[data-fx-rail] a")].map((a) => a.getAttribute("href")),
    sections: [...document.querySelectorAll("main section[id]:not(#home)")].map((s) => `#${s.id}`),
  }));
  assert.deepEqual(listed.rail, listed.sections, "desktop: the rail links every home section after the hero, in order");
  const idle = await page.evaluate(() => {
    const rail = document.querySelector("[data-fx-rail]");
    return { idle: rail.hasAttribute("data-idle"), opacity: parseFloat(getComputedStyle(rail).opacity), events: getComputedStyle(rail).pointerEvents };
  });
  assert.deepEqual(idle, { idle: true, opacity: 0, events: "none" }, "desktop: over the hero the rail is faded out and click-through");
  await page.locator("header").getByRole("link", { name: "Discuss a project" }).focus();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(450);
  const first = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el?.closest("[data-fx-rail]")) return null;
    let opacity = 1;
    for (let node = el; node; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity);
    const r = el.getBoundingClientRect();
    return {
      href: el.getAttribute("href"),
      name: el.textContent.trim(),
      outline: getComputedStyle(el).outlineStyle !== "none",
      inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
      opacity,
      labelOpacity: parseFloat(getComputedStyle(el.querySelector(".fx-rail-label")).opacity),
    };
  });
  assert.ok(first, "desktop: Tab from the header reaches the progress rail");
  assert.deepEqual({ href: first.href, name: first.name, outline: first.outline, inView: first.inView }, { href: "#work", name: SECTION_COPY.work.title, outline: true, inView: true }, "desktop: the first rail link is focused, named and in view");
  assert.ok(first.opacity >= 0.99 && first.labelOpacity >= 0.99, "desktop: the focused rail link and its label are visible");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const work = document.getElementById("work");
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) + parseFloat(getComputedStyle(work).scrollMarginTop);
    return Math.abs(work.getBoundingClientRect().top - offset) < 4;
  }, null, { timeout: 4000 });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.querySelector('[data-fx-rail] a[aria-current="location"]')?.getAttribute("href")), "#work", "desktop: the rail marks the section in view");
  // Past the hero, without focus, the rail stays shown and its fill has grown with the page.
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(450);
  const shown = await page.evaluate(() => {
    const rail = document.querySelector("[data-fx-rail]");
    return { idle: rail.hasAttribute("data-idle"), opacity: parseFloat(getComputedStyle(rail).opacity), fill: new DOMMatrixReadOnly(getComputedStyle(rail.querySelector(".fx-rail-fill")).transform).d };
  });
  assert.ok(!shown.idle && shown.opacity >= 0.99 && shown.fill > 0, `desktop: past the hero the rail shows and its fill tracks the page (${JSON.stringify(shown)})`);
});

desktop("the nav pill slides, buttons sweep, links underline and fields glow", async (page, ctx) => {
  // Every layout shift from here on, input or not, with the elements it moved: hovering the nav and the
  // buttons must move no box.
  await page.evaluate(() => {
    window.__fxShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__fxShifts.push({ value: entry.value, moved: (entry.sources ?? []).map((source) => `${source.node?.nodeName ?? "?"}.${source.node?.className ?? ""}`) });
    }).observe({ type: "layout-shift" });
  });
  const shifts = () => page.evaluate(() => window.__fxShifts.slice());
  const pill = () => page.evaluate(() => document.querySelector("[data-nav-pill]")?.closest("a")?.getAttribute("href") ?? null);
  assert.equal(await pill(), "/", "desktop: the pill sits on the current page link");
  assert.equal(await page.evaluate(() => document.querySelector('header a[aria-current="page"]')?.getAttribute("href")), "/", "desktop: the current page link is marked");
  await page.locator("header").getByRole("link", { name: "About", exact: true }).hover();
  await page.waitForTimeout(500);
  assert.equal(await pill(), "/about/", "desktop: the pill follows the hovered link");
  await page.locator("header").getByRole("link", { name: "Discuss a project" }).hover();
  await page.waitForTimeout(500);
  await page.mouse.move(700, 600, { steps: 4 });
  await page.waitForTimeout(500);
  assert.equal(await pill(), "/", "desktop: the pill returns to the current page link");
  assert.deepEqual(await shifts(), [], "desktop: hovering the nav links and the header CTA shifts no layout");
  const button = page.locator("#process a.fx-sweep").first();
  await button.scrollIntoViewIfNeeded();
  // Let the section's entrance settle first: its step cards count up their outputs (1.1 s), which can nudge a line.
  await page.waitForTimeout(1400);
  await settle(button);
  const beforeButton = (await shifts()).length;
  await button.hover();
  await page.waitForTimeout(650);
  assert.equal(await button.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el, "::before").transform).a), 1, "desktop: the button fill sweeps in on hover");
  assert.deepEqual((await shifts()).slice(beforeButton), [], "desktop: a hovered button shifts no layout");
  await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  const link = page.locator("#contact nav li a").first();
  await link.hover();
  await page.waitForTimeout(550);
  assert.equal(await link.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el, "::after").transform).a), 1, "desktop: the link underline draws in on hover");
  const field = page.getByLabel("Your name");
  await field.focus();
  await page.waitForTimeout(450);
  assert.match(await field.evaluate((el) => getComputedStyle(el).boxShadow), /rgba\(250, 110, 67/, "desktop: a focused field glows");
  // Inner pages: the pill and aria-current sit on the page's own link; under /services/ on the Services trigger.
  await fresh(page, ctx.base, "/about/");
  assert.deepEqual(await page.evaluate(() => ({ pill: document.querySelector("[data-nav-pill]")?.closest("a")?.getAttribute("href") ?? null, current: document.querySelector('header a[aria-current="page"]')?.getAttribute("href") ?? null })), { pill: "/about/", current: "/about/" }, "desktop: on /about/ the pill and aria-current sit on About");
  const service = await page.evaluate(() => document.querySelector('header li.group ul a[href^="/services/"]')?.getAttribute("href"));
  await fresh(page, ctx.base, service);
  assert.deepEqual(await page.evaluate(() => ({ pill: document.querySelector("[data-nav-pill]")?.closest("a")?.getAttribute("href") ?? null, current: [...document.querySelectorAll("header [aria-current]")].map((a) => `${a.getAttribute("href")}=${a.getAttribute("aria-current")}`) })), { pill: "/services/", current: ["/services/=true"] }, `desktop: on ${service} the pill sits on Services, marked as the current section, not the current page`);
});

/** Curtain animations (PageTransition.tsx) in `state`, or in any state. They exist only while a transition runs. */
const curtains = (page, state) => page.evaluate((s) => document.getAnimations().filter((a) => a.animationName === "fx-curtain" && (!s || a.playState === s)).length, state);
const waitForCurtain = (page) => page.waitForFunction(() => document.getAnimations().some((a) => a.animationName === "fx-curtain"), null, { timeout: 3000 });
/** Scroll events since the last reset that reported a position strictly between `from` and `to` (a glide). */
const scrollsBetween = (page, from, to) => page.evaluate(([a, b]) => window.__fx.scrolls.filter((y) => y > Math.min(a, b) + 4 && y < Math.max(a, b) - 4).length, [from, to]);
/** Lenis's state classes on <html>: "lenis" alone when it is idle and running. */
const lenisClasses = (page) => page.evaluate(() => [...document.documentElement.classList].filter((name) => name.startsWith("lenis")).sort().join(" "));

desktop("a route change plays the orange curtain under the nav and the cursor", async (page) => {
  assert.equal(await page.evaluate(() => window.__fx.vt), 0, "desktop: the first load starts no view transition");
  const about = page.locator("header").getByRole("link", { name: "About", exact: true });
  const box = await about.boundingBox();
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(at.x, at.y + 120);
  await page.mouse.move(at.x, at.y, { steps: 3 });
  await page.mouse.down();
  await page.mouse.up();
  await waitForCurtain(page);
  // While the curtain runs, the nav and the cursor are lifted above it: named only now, so the nav keeps its
  // backdrop blur the rest of the time. (A named element takes no pointer events while it is captured.)
  const during = await page.evaluate(() => ({
    nav: getComputedStyle(document.querySelector("body > header")).viewTransitionName,
    cursor: getComputedStyle(document.querySelector("[data-fx-cursor-root]")).viewTransitionName,
  }));
  assert.deepEqual(during, { nav: "fx-nav", cursor: "fx-cursor" }, "desktop: during the curtain the nav and the cursor ride above it");
  await page.waitForURL("**/about/");
  assert.ok(await page.evaluate(() => window.__fx.vt) >= 1, "desktop: navigation starts a view transition");
  await transitionsDone(page);
  assert.equal(await curtains(page, "running"), 0, "desktop: the curtain finishes");
  assert.ok(await page.locator("h1").isVisible(), "desktop: the new page shows after the curtain");
  const after = await page.evaluate(({ x, y }) => ({
    nav: getComputedStyle(document.querySelector("body > header")).viewTransitionName,
    hit: document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href") ?? null,
    pills: [...document.querySelectorAll("[data-nav-pill]")].map((el) => el.closest("a")?.getAttribute("href") ?? null),
    cursors: document.querySelectorAll("[data-fx-cursor-root]").length,
    y: window.scrollY,
  }), at);
  assert.deepEqual(after, { nav: "none", hit: "/about/", pills: ["/about/"], cursors: 1, y: 0 }, "desktop: after the curtain the nav is plain and clickable again, one pill sits on About, one cursor, and the page opens at its top");
  assert.equal(await lenisClasses(page), "lenis", "desktop: smooth scrolling survives the navigation, idle and not stopped");
});

desktop("a route change mid-glide opens the next page at its top, and Lenis glides again there", async (page) => {
  await jumpTo(page, await sectionTop(page, "process"));
  await page.mouse.move(6, 500);
  await page.waitForTimeout(600);
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(60);
  assert.equal(await lenisClasses(page), "lenis lenis-scrolling lenis-smooth", "desktop: a glide is under way (precondition)");
  // A navigation no press or key started (a router.push): only the route change itself can end the glide.
  await page.evaluate(() => { window.__fx.scrolls = []; document.querySelector('header a[href="/about/"]').click(); });
  await waitForCurtain(page);
  // The pill slides along the nav to About; the scroll reset under it must not send it flying from below.
  const pillDrift = await page.evaluate(() => new Promise((resolve) => {
    const nav = document.querySelector("body > header nav").getBoundingClientRect();
    let worst = 0;
    const until = performance.now() + 700;
    const sample = () => {
      const pill = document.querySelector("[data-nav-pill]")?.getBoundingClientRect();
      if (pill) worst = Math.max(worst, nav.top - pill.top, pill.bottom - nav.bottom);
      if (performance.now() < until) requestAnimationFrame(sample);
      else resolve(Math.round(worst));
    };
    sample();
  }));
  assert.ok(pillDrift <= 2, `desktop: the nav pill stays inside the nav through a route change from far down the page (${pillDrift}px outside)`);
  await page.waitForURL("**/about/");
  await page.waitForTimeout(1500);
  const landed = await page.evaluate(() => window.scrollY);
  assert.ok(landed <= 1, `desktop: the next page opens at its top, not where the old glide was heading (${landed}px)`);
  assert.equal(await lenisClasses(page), "lenis", "desktop: no glide or stop is left over");
  await page.mouse.move(6, 600);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(80);
  assert.equal(await lenisClasses(page), "lenis lenis-scrolling lenis-smooth", "desktop: the wheel glides on the new page");
  await page.waitForTimeout(1400);
  const moved = await page.evaluate(() => window.scrollY);
  assert.ok(moved > 300 && moved <= 401, `desktop: the glide on the new page covers the wheel delta (${moved}px)`);
});

desktop("a hash route lands on its anchor, a route within one section gets the curtain too, and Back restores", async (page, ctx) => {
  assert.equal(typeof ctx.deepLinkTop, "number", "desktop: the deep-link result is available (precondition)");
  // A same-page hash link only scrolls: no curtain.
  const vt0 = await page.evaluate(() => window.__fx.vt);
  await page.locator('header a[href="/#pricing"]').first().click();
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => window.__fx.vt), vt0, "desktop: a same-page hash link plays no transition");
  // /about/ → /#pricing: the curtain, then #pricing exactly where a deep link puts it, without a glide.
  await page.locator('header a[href="/about/"]').first().click();
  await page.waitForURL("**/about/");
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__fx.scrolls = []; });
  const vt1 = await page.evaluate(() => window.__fx.vt);
  await page.locator('header a[href="/#pricing"]').first().click();
  await waitForCurtain(page);
  await page.waitForURL((url) => url.pathname === "/" && url.hash === "#pricing");
  await page.waitForTimeout(1500);
  const hashed = await page.evaluate(() => ({ top: document.getElementById("pricing").getBoundingClientRect().top, y: Math.round(window.scrollY) }));
  assert.ok(await page.evaluate(() => window.__fx.vt) > vt1, "desktop: /about/ → /#pricing plays the curtain");
  assert.ok(Math.abs(hashed.top - ctx.deepLinkTop) <= 4, `desktop: /#pricing from /about/ lands where a deep link does (${hashed.top}px, deep link ${ctx.deepLinkTop}px)`);
  assert.ok(await scrollsBetween(page, 0, hashed.y) <= 2, "desktop: the hash target is reached at once, not by a glide from the top");
  assert.equal(await lenisClasses(page), "lenis", "desktop: Lenis is idle after the hash route");
  // /services/ → /services/<slug>/ shares the first segment: the pathname key still remounts the page.
  await fresh(page, ctx.base, "/services/");
  await jumpTo(page, 600);
  await page.waitForTimeout(400);
  const held = await page.evaluate(() => window.scrollY);
  // A service link already in view, clicked where it is (a locator click could scroll the page first).
  const target = await page.evaluate(() => {
    for (const a of document.querySelectorAll('main a[href^="/services/"]:not([href="/services/"])')) {
      const r = a.getBoundingClientRect();
      if (r.top > 120 && r.bottom < innerHeight - 40 && r.width > 0) return { href: a.getAttribute("href"), x: r.left + Math.min(r.width / 2, 40), y: r.top + r.height / 2 };
    }
    return null;
  });
  assert.ok(target, "desktop: a service link is in view on /services/ (precondition)");
  const href = target.href;
  const vt2 = await page.evaluate(() => window.__fx.vt);
  await page.mouse.move(target.x, target.y, { steps: 2 });
  await page.mouse.down();
  await page.mouse.up();
  await waitForCurtain(page);
  await page.waitForURL((url) => url.pathname === href);
  await page.waitForTimeout(1200);
  assert.ok(await page.evaluate(() => window.__fx.vt) > vt2, `desktop: /services/ → ${href} plays the curtain`);
  assert.equal(await page.evaluate(() => window.scrollY), 0, `desktop: ${href} opens at its top`);
  await page.evaluate(() => { window.__fx.scrolls = []; });
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/services/");
  await page.waitForTimeout(2000);
  const back = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(back - held) <= 8 && (await scrollsBetween(page, 0, held)) <= 2, `desktop: Back to /services/ restores ${held}px at once (${back}px)`);
  assert.equal(await curtains(page, "running"), 0, "desktop: no curtain is left running after Back");
  assert.equal(await lenisClasses(page), "lenis", "desktop: Lenis is idle after Back");
});

desktop("without the View Transitions API the route change is instant", async (page) => {
  await page.evaluate(() => { delete Document.prototype.startViewTransition; });
  await page.locator("header").getByRole("link", { name: "About", exact: true }).click();
  await page.waitForURL("**/about/");
  await page.locator("h1").waitFor({ state: "visible", timeout: 2000 });
  assert.equal(await curtains(page), 0, "desktop: no curtain without the API");
  assert.equal(await page.evaluate(() => window.scrollY), 0, "desktop: the page still opens at its top");
});

desktop("under reduced motion the route change is instant", async (page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-fx"));
    await page.locator("header").getByRole("link", { name: "About", exact: true }).click();
    await page.waitForURL("**/about/");
    await page.waitForTimeout(60);
    assert.equal(await curtains(page, "running"), 0, "reduced motion: the curtain does not play");
    assert.ok(await page.locator("h1").isVisible(), "reduced motion: the new page shows at once");
  } finally {
    await page.emulateMedia({ reducedMotion: null });
  }
});

desktop("depth and parallax layers are promoted only once they near the viewport", async (page) => {
  const promoted = () => page.evaluate(() => [...document.querySelectorAll("[data-depth], [data-parallax] > *")].filter((el) => getComputedStyle(el).willChange.includes("transform")).length);
  assert.equal(await promoted(), 0, "desktop: over the hero no depth or parallax layer is promoted");
  await jumpTo(page, (await sectionTop(page, "work")) - 400);
  await page.waitForTimeout(400);
  const near = await promoted();
  assert.ok(near >= 6, `desktop: nearing What We Do promotes its layers ahead of the screen (${near})`);
  await jumpTo(page, 0);
  await page.waitForTimeout(400);
  assert.equal(await promoted(), near, "desktop: they stay promoted, so leaving them never re-rasters their images");
});

desktop("What We Do images drift inside their frames and leaving cards stack and shrink", async (page) => {
  const read = () => page.evaluate(() => {
    const layer = document.querySelector("#work [data-parallax] > *");
    const depth = document.querySelector("#work [data-depth]");
    if (!layer || !depth) return null;
    const m = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform);
    const frame = layer.parentElement.getBoundingClientRect();
    const image = layer.getBoundingClientRect();
    return {
      parallaxY: m(layer).m42,
      depthScale: m(depth).a,
      // The drifting layer always covers its frame: no gap at the top or the bottom edge.
      covered: image.top <= frame.top + 0.5 && image.bottom >= frame.bottom - 0.5,
    };
  });
  // Layout boxes of the section, its bento items and the next section: transforms only, so none may change.
  const layout = () => page.evaluate(() => [document.getElementById("work"), ...document.querySelectorAll("#work [data-depth]"), document.getElementById("services")].map((el) => [el.offsetTop, el.offsetHeight].join()).join("|"));
  await page.evaluate(() => {
    window.__workShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ((entry.sources ?? []).some((source) => source.node?.closest?.("#work"))) window.__workShifts.push(entry.value);
      }
    }).observe({ type: "layout-shift" });
  });
  const work = await sectionTop(page, "work");
  const rest = await layout();
  await jumpTo(page, work + 200);
  await page.waitForTimeout(500);
  const entering = await read();
  assert.ok(entering, "desktop: the bento has parallax and depth layers");
  await jumpTo(page, work + 900);
  await page.waitForTimeout(500);
  const leaving = await read();
  assert.ok(Math.abs(leaving.parallaxY - entering.parallaxY) > 4, `desktop: the image drifts in its frame (${entering.parallaxY} → ${leaving.parallaxY})`);
  assert.ok(entering.covered && leaving.covered, "desktop: the drifting image always covers its frame");
  assert.ok(leaving.depthScale < 0.99 && leaving.depthScale < entering.depthScale, `desktop: the leaving card shrinks (${entering.depthScale} → ${leaving.depthScale})`);
  // While the last bento row leaves, drifting into the gap above Our Services, it never touches that title.
  const clearance = await page.evaluate(async () => {
    const items = [...document.querySelectorAll("#work [data-depth]")].filter((el) => el.offsetParent);
    const title = document.querySelector("#services h2");
    let worst = Infinity;
    // Step through the range where the last row leaves (its bottom from 80% to 0% of the viewport).
    const lastBottom = () => Math.max(...items.map((el) => el.getBoundingClientRect().bottom));
    window.scrollTo({ top: window.scrollY + lastBottom() - innerHeight * 0.8, behavior: "instant" });
    for (let i = 0; i < 24; i++) {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      worst = Math.min(worst, title.getBoundingClientRect().top - lastBottom());
      window.scrollBy({ top: innerHeight * 0.035, behavior: "instant" });
    }
    return Math.round(worst);
  });
  assert.ok(clearance > 16, `desktop: the drifting last row stays clear of the Our Services title (${clearance}px at the closest)`);
  assert.equal(await layout(), rest, "desktop: the depth stack and the parallax move no layout box (the section keeps its height)");
  assert.deepEqual(await page.evaluate(() => window.__workShifts), [], "desktop: scrolling through What We Do shifts no layout");
});

desktop("a footer link at the end of a page holds the old footer until the curtain covers it", async (page, ctx) => {
  await fresh(page, ctx.base, "/about/");
  await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  const link = page.locator('#contact nav a[href="/services/"]').first();
  await settle(link);
  const box = await link.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
  await page.mouse.down();
  await page.mouse.up();
  await waitForCurtain(page);
  // The footer sits outside the page boundary: without its own held snapshot the new page would show through
  // where the footer was, before the curtain arrives.
  const held = await page.evaluate(() => ({
    old: document.getAnimations().filter((a) => a.effect?.pseudoElement === "::view-transition-old(fx-footer)").map((a) => a.animationName),
    newShown: getComputedStyle(document.documentElement, "::view-transition-new(fx-footer)").display !== "none",
  }));
  assert.deepEqual(held, { old: ["fx-page-hold"], newShown: false }, "desktop: the old footer is held with the old page, and the new one stays hidden");
  await page.waitForURL("**/services/");
  await transitionsDone(page);
  assert.deepEqual(await page.evaluate(() => ({ y: window.scrollY, footer: getComputedStyle(document.querySelector("footer#contact")).viewTransitionName })), { y: 0, footer: "none" }, "desktop: /services/ opens at its top and the footer is plain again");
});

/** Starts recording every layout shift (with or without recent input) that moves a box inside `selector`, with
 *  the boxes it moved; the returned function reads the record. */
async function recordShifts(page, selector) {
  await page.evaluate((scope) => {
    const log = (window.__fxShiftLog ??= {});
    log[scope] = [];
    const element = (node) => (node?.nodeType === 3 ? node.parentElement : node);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const moved = (entry.sources ?? []).map((source) => element(source.node)).filter((el) => el?.closest?.(scope));
        // `input`: within 500 ms of a press, so the shift is expected and stays out of CLS.
        if (moved.length) log[scope].push({ value: +entry.value.toFixed(5), input: entry.hadRecentInput, moved: moved.map((el) => `${el.nodeName}.${String(el.className).slice(0, 48)}`) });
      }
    }).observe({ type: "layout-shift" });
  }, selector);
  return () => page.evaluate((scope) => window.__fxShiftLog[scope].slice(), selector);
}

desktop("Services: an opening column wipes its image in and the dot matrix ripples", async (page) => {
  await jumpTo(page, await sectionTop(page, "services"));
  await page.waitForTimeout(900);
  const column = page.locator('#services a[data-cursor="Open"]').nth(1);
  await column.hover();
  await page.waitForTimeout(1300);
  const opened = await column.evaluate((el) => ({
    active: el.dataset.active,
    wipe: new DOMMatrixReadOnly(getComputedStyle(el.querySelector(".fx-reveal-wipe")).transform).a,
  }));
  assert.deepEqual(opened, { active: "true", wipe: 0 }, "desktop: the opened column's wipe has cleared its image");
  const field = page.locator("#services [data-ripple]").first(); // the desktop core panel (the mobile copy is hidden)
  const box = await field.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  await page.waitForTimeout(80);
  const rippling = await field.evaluate((el) => [...el.querySelectorAll(".dot-pulse")].filter((dot) => dot.getAnimations().some((a) => !(a instanceof CSSAnimation))).length);
  assert.ok(rippling >= 20, `desktop: the dot matrix ripples from the pointer (${rippling} dots)`);
});

desktop("Services: opening the columns moves no layout box, even with the pointer resting on them through a scroll", async (page) => {
  const shifts = await recordShifts(page, "#services");
  const top = await sectionTop(page, "services");
  await jumpTo(page, top);
  await page.mouse.move(6, 500);
  await page.waitForTimeout(900);
  const columns = page.locator('#services a[data-cursor="Open"]');
  const centre = async (i) => {
    const box = await columns.nth(i).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  for (const i of [1, 3, 0, 2]) {
    const at = await centre(i);
    await page.mouse.move(at.x, at.y, { steps: 4 });
    await page.waitForTimeout(700);
  }
  // A quick sweep back across the columns interrupts each opening half-way.
  const from = await centre(2);
  const to = await centre(0);
  await page.mouse.move(to.x, from.y, { steps: 12 });
  await page.waitForTimeout(900);
  assert.deepEqual(await shifts(), [], "desktop: opening the Services columns, and sweeping across them, shifts no layout");
  // The pointer rests over the columns while a wheel glide carries the section up under it.
  const rest = await centre(2);
  await page.mouse.move(6, rest.y, { steps: 3 });
  await jumpTo(page, top - 500);
  await page.waitForTimeout(400);
  await page.mouse.move(rest.x, rest.y, { steps: 3 });
  for (let k = 0; k < 6; k++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  assert.deepEqual(await shifts(), [], "desktop: a pointer resting on the Services columns through a scroll shifts no layout");
});

desktop("Process: the timeline draws with the scroll, dots ignite and cards lift in turn", async (page) => {
  const read = () => page.evaluate(() => ({
    scale: new DOMMatrixReadOnly(getComputedStyle(document.querySelector("#process [data-timeline]")).transform).a,
    lit: [...document.querySelectorAll("#process [data-timeline-dot]")].map((dot) => parseFloat(getComputedStyle(dot).opacity)),
  }));
  const top = await page.evaluate(() => window.scrollY + document.querySelector("#process [data-timeline]").getBoundingClientRect().top);
  const at = async (dy) => {
    await page.evaluate(({ y, dy }) => window.scrollTo({ top: y - innerHeight * 0.8 + dy, behavior: "instant" }), { y: top, dy });
    await page.waitForTimeout(300);
    return read();
  };
  const start = await at(0);
  const mid = await at(200);
  const end = await at(600);
  const back = await at(200);
  assert.ok(start.scale < 0.05, `desktop: the line starts undrawn (${start.scale})`);
  assert.ok(mid.scale > 0.2 && mid.scale < 0.8, `desktop: the line is part-drawn mid-scroll (${mid.scale})`);
  assert.ok(end.scale > 0.99, `desktop: the line is fully drawn (${end.scale})`);
  assert.ok(Math.abs(back.scale - mid.scale) < 0.02, "desktop: scrolling back retracts the line");
  assert.ok(mid.lit[0] > 0.99 && mid.lit.at(-1) < 0.01, `desktop: dots ignite in order (${mid.lit.join(", ")})`);
  assert.ok(end.lit.every((opacity) => opacity > 0.99), "desktop: every dot is lit at the end");
});

desktop("What We Measure draws in, and the ticker follows the scroll but stops on hover and focus", async (page) => {
  await jumpTo(page, (await sectionTop(page, "analytics")) + 300);
  await page.waitForTimeout(1800);
  const drawn = await page.evaluate(() => ({
    donut: document.querySelector("#analytics .fx-donut")?.hasAttribute("data-in") ?? false,
    dials: document.querySelector("#analytics .fx-dial")?.hasAttribute("data-in") ?? false,
    dash: getComputedStyle(document.querySelector("#analytics .fx-donut circle") ?? document.body).strokeDasharray,
  }));
  assert.ok(drawn.donut && drawn.dials, "desktop: the donut and the dials start drawing in view");
  const first = MEASURE_COPY.workflow.segments[0].value;
  assert.match(drawn.dash, new RegExp(`^${first}(px)?,?\\s+${100 - first}`), `desktop: the first donut segment is fully drawn (${drawn.dash})`);
  const box = page.locator('#analytics [role="marquee"]');
  await box.scrollIntoViewIfNeeded();
  await page.mouse.move(6, 300);
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(150);
  const ticker = () => box.evaluate((el) => {
    const marquee = el.querySelector(".marquee-track").getAnimations()[0];
    return { rate: marquee?.playbackRate, state: marquee?.playState, skew: el.querySelector(".fx-ticker-skew").style.transform };
  });
  const moving = await ticker();
  assert.ok(moving.rate > 1.05, `desktop: the ticker speeds up with the scroll (rate ${moving.rate})`);
  assert.match(moving.skew, /^skewX\(/, "desktop: the ticker leans with the scroll");
  await page.waitForTimeout(2400);
  const rest = await ticker();
  assert.deepEqual({ rate: rest.rate, skew: rest.skew }, { rate: 1, skew: "" }, "desktop: the ticker settles back at rest");
  await box.focus();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(150);
  const focused = await ticker();
  assert.deepEqual({ state: focused.state, skew: focused.skew }, { state: "paused", skew: "" }, "desktop: focus stops the ticker even while the page scrolls (WCAG 2.2.2)");
  await box.hover();
  await page.waitForTimeout(150);
  assert.equal((await ticker()).state, "paused", "desktop: hovering stops the ticker");
});

desktop("What We Measure fills its charts without moving a layout box", async (page) => {
  const shifts = await recordShifts(page, "#analytics");
  const top = await sectionTop(page, "analytics");
  await page.mouse.move(6, 500);
  // A first visit to the section (the bars have not grown yet), stepping through it.
  for (const dy of [-700, -400, -100, 200, 500, 800]) {
    await jumpTo(page, top + dy);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll("#analytics [data-fill-h]")].every((bar) => new DOMMatrixReadOnly(getComputedStyle(bar).transform === "none" ? undefined : getComputedStyle(bar).transform).d > 0.99)), "desktop: every bar has grown to its value (precondition)");
  assert.deepEqual(await shifts(), [], "desktop: the growing bars and charts of What We Measure shift no layout");
});

/**
 * At `viewport`, from the end of /about/, `press`es the footer's Services link and returns: whether the footer
 * sits in the page flow (not the pinned curtain footer), where its top was on screen just before, and where the
 * held old footer (its view-transition group) is drawn 50 ms into the curtain. Restores the viewport after.
 */
async function footerHoldAt(page, base, viewport, press) {
  const restore = page.viewportSize();
  try {
    await page.setViewportSize(viewport);
    await page.goto("about:blank");
    await page.goto(new URL("/about/", base).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-fx-motion"), null, { timeout: 10000 });
    await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    // On a phone the footer is taller than the screen and its links sit above the end of the page.
    const link = page.locator('#contact nav a[href="/services/"]').first();
    await link.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await settle(link);
    const before = await page.evaluate(() => ({
      inFlow: getComputedStyle(document.querySelector("footer#contact").parentElement).position !== "fixed",
      top: Math.round(document.querySelector("footer#contact").getBoundingClientRect().top),
    }));
    await press(link);
    await waitForCurtain(page);
    await page.waitForTimeout(50);
    const held = await page.evaluate(() => {
      const group = getComputedStyle(document.documentElement, "::view-transition-group(fx-footer)");
      return Math.round(new DOMMatrixReadOnly(group.transform === "none" ? undefined : group.transform).m42);
    });
    await page.waitForURL("**/services/");
    await transitionsDone(page);
    return { inFlow: before.inFlow, before: before.top, held };
  } finally {
    await page.setViewportSize(restore);
  }
}

desktop("a footer link on a laptop too short for the pinned footer holds the old footer in place", async (page, ctx) => {
  const hold = await footerHoldAt(page, ctx.base, { width: 1280, height: 600 }, async (link) => {
    const box = await link.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
    await page.mouse.down();
    await page.mouse.up();
  });
  assert.equal(hold.inFlow, true, "desktop 1280×600: the footer is in the page flow (precondition)");
  assert.ok(Math.abs(hold.held - hold.before) <= 2, `desktop 1280×600: the held old footer stays where the footer was until the curtain covers it (${JSON.stringify(hold)})`);
});

touch("a footer link on a phone holds the old footer in place", async (page, ctx) => {
  const hold = await footerHoldAt(page, ctx.base, { width: 390, height: 844 }, (link) => link.tap());
  assert.equal(hold.inFlow, true, "touch 390×844: the footer is in the page flow (precondition)");
  assert.ok(Math.abs(hold.held - hold.before) <= 2, `touch 390×844: the held old footer stays where the footer was until the curtain covers it (${JSON.stringify(hold)})`);
});

touch("a route change from outside the open phone menu shuts the menu before the curtain plays", async (page, ctx) => {
  const restore = page.viewportSize();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("about:blank");
    await page.goto(new URL("/about/", ctx.base).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-fx-motion"), null, { timeout: 10000 });
    await page.locator(".mobile-menu summary").tap();
    assert.equal(await page.evaluate(() => document.querySelector(".mobile-menu").open), true, "touch 390×844: the menu is open (precondition)");
    // The header's home link sits outside the menu, so nothing closes the menu on the press itself (as with a
    // Back or Forward that animates): the route change must, in its own commit.
    await page.locator('header a[aria-label="spacegear home"]').tap();
    await waitForCurtain(page);
    assert.equal(await page.evaluate(() => document.querySelector(".mobile-menu").open), false, "touch 390×844: the menu is shut while the curtain plays, not riding above it");
    await page.waitForURL((url) => url.pathname === "/");
    await transitionsDone(page);
  } finally {
    await page.setViewportSize(restore);
  }
});

// --- Engagements and FAQ (Pricing.tsx, Faq.tsx) ---

desktop("Engagements: rows slide in, the toggle springs and Select pulses once", async (page) => {
  const rows = page.locator("#pricing .fx-rows");
  assert.equal(await rows.count(), 1, "desktop: the engagement rows use the slide-in list");
  const rowState = () => rows.evaluate((el) => ({
    in: el.hasAttribute("data-in"),
    opacity: [...el.children].map((row) => +parseFloat(getComputedStyle(row).opacity).toFixed(3)),
    // Each row's left edge against the list's: the slide is a translate, so a row at rest sits flush.
    offset: [...el.children].map((row) => Math.round(row.getBoundingClientRect().left - el.getBoundingClientRect().left)),
  }));
  const waiting = await rowState();
  assert.ok(!waiting.in && waiting.opacity.every((opacity) => opacity < 0.01), `desktop: the rows wait below the fold, hidden (${JSON.stringify(waiting)})`);
  const shifts = await recordShifts(page, "#pricing");
  await jumpTo(page, (await sectionTop(page, "pricing")) + 200);
  await page.waitForTimeout(1700);
  const shown = await rowState();
  assert.ok(shown.in && shown.opacity.every((opacity) => opacity > 0.99) && shown.offset.every((x) => x === 0), `desktop: every row slid in (${JSON.stringify(shown)})`);
  const toggle = rows.getByRole("switch").first();
  await settle(toggle);
  await toggle.click();
  await page.waitForTimeout(700);
  const knob = await toggle.evaluate((el) => {
    const style = getComputedStyle(el.firstElementChild);
    return { checked: el.getAttribute("aria-checked"), x: new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform).m41, left: style.left };
  });
  assert.ok(knob.checked === "true" && Math.abs(knob.x - 16) < 1 && knob.left === "2px", `desktop: the toggle knob springs across on a transform (${JSON.stringify(knob)})`);
  const pulse = rows.locator(".fx-pulse");
  const pulsing = () => pulse.evaluate((el) => el.getAnimations().filter((a) => a.animationName === "fx-pulse").length);
  await rows.getByRole("button", { name: /^Select/ }).first().click();
  await page.waitForTimeout(100);
  assert.equal(await pulse.count(), 1, "desktop: the selected row pulses");
  assert.equal(await pulsing(), 1, "desktop: the pulse is animating");
  await page.waitForTimeout(1100);
  assert.equal(await pulsing(), 0, "desktop: the pulse plays once");
  await rows.getByRole("button", { name: /^Select / }).first().click(); // the next row (the first is now "Selected")
  await page.waitForTimeout(100);
  assert.equal(await pulse.count(), 1, "desktop: only the newly selected row pulses");
  assert.equal(await pulsing(), 1, "desktop: another row's Select pulses once too");
  await page.waitForTimeout(1100);
  assert.deepEqual((await shifts()).filter((shift) => !shift.input), [], "desktop: the slide-in, the toggle and the pulse shift no layout (CLS 0)");
});

desktop("FAQ: the icon spins as it morphs and the photo drifts in its frame", async (page) => {
  const shifts = await recordShifts(page, "#faq");
  const faq = await sectionTop(page, "faq");
  await jumpTo(page, faq);
  const item = page.locator("#faq .faq-accordion details").nth(1);
  const summary = item.locator("summary");
  await settle(summary);
  const turn = () => item.locator("summary > span[aria-hidden]").evaluate((el) => {
    const transform = getComputedStyle(el).transform;
    return new DOMMatrixReadOnly(transform === "none" ? undefined : transform).a;
  });
  await summary.click();
  await page.waitForTimeout(800);
  const open = await turn();
  assert.ok(open < -0.99, `desktop: the open icon has turned half a turn (${open})`);
  await summary.click();
  await page.waitForTimeout(800);
  const shut = await turn();
  assert.ok(shut > 0.99, `desktop: closing turns the icon back (${shut})`);
  const photo = page.locator("#faq [data-parallax] > *");
  await jumpTo(page, faq - 400);
  await page.waitForTimeout(400);
  const a = (await matrixOf(photo)).m42;
  await jumpTo(page, faq + 150);
  await page.waitForTimeout(400);
  const b = (await matrixOf(photo)).m42;
  assert.ok(Math.abs(b - a) > 3, `desktop: the photo drifts in its frame (${a} → ${b})`);
  const frame = await photo.evaluate((el) => {
    const outer = el.parentElement.getBoundingClientRect(), inner = el.getBoundingClientRect();
    return { covered: inner.top <= outer.top + 0.5 && inner.bottom >= outer.bottom - 0.5, height: Math.round(outer.height) };
  });
  assert.deepEqual(frame, { covered: true, height: 224 }, "desktop: the drifting photo always covers its frame, which keeps its height");
  assert.deepEqual((await shifts()).filter((shift) => !shift.input), [], "desktop: opening and closing a question and the photo drift shift no layout (CLS 0)");
});

// --- Footer wordmark and pills (FooterWordmark.tsx, Footer.tsx) ---

/** The footer wordmark: whether it has risen, and per letter its opacity, rise offset (translate) and lean
 *  (transform); the ™ likewise. */
const wordmarkState = (page) => page.evaluate(() => {
  const mark = document.querySelector(".fx-wordmark");
  const read = (el) => {
    const style = getComputedStyle(el);
    const lean = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
    return { opacity: +parseFloat(style.opacity).toFixed(3), translate: style.translate, lean: [Math.round(lean.m41), Math.round(lean.m42)].join() };
  };
  return { risen: mark.hasAttribute("data-in"), letters: [...mark.querySelectorAll("[data-letter]")].map(read), tm: read(mark.querySelector(".brand-tm")) };
});
const atRest = (part) => part.opacity > 0.99 && ["none", "0px"].includes(part.translate) && part.lean === "0,0";

desktop("the footer wordmark rises as the curtain opens and leans away from the pointer", async (page) => {
  const before = await page.evaluate(() => {
    const mark = document.querySelector(".fx-wordmark");
    return { letters: mark?.querySelectorAll("[data-letter]").length ?? 0, risen: mark?.hasAttribute("data-in") ?? null, name: mark?.querySelector(".sr-only")?.textContent ?? null };
  });
  assert.deepEqual(before, { letters: 9, risen: false, name: "spacegear" }, "desktop: the drawn wordmark waits behind the curtain with its full name");
  const hidden = await wordmarkState(page);
  assert.ok(hidden.letters.every((letter) => letter.opacity < 0.01 && letter.translate !== "none") && hidden.tm.opacity < 0.01, `desktop: the letters wait lowered and hidden, the ™ with them (${JSON.stringify(hidden)})`);
  const shifts = await recordShifts(page, "footer#contact");
  // Half the pinned footer uncovered (from the bottom up): the wordmark near its top is still covered.
  const uncover = (share) => page.evaluate((s) => {
    const footer = document.querySelector("footer#contact");
    window.scrollTo({ top: document.documentElement.scrollHeight - footer.offsetHeight - innerHeight + footer.offsetHeight * s, behavior: "instant" });
    return getComputedStyle(footer.parentElement).position;
  }, share);
  assert.equal(await uncover(0.5), "fixed", "desktop: the footer is pinned behind the content at 1440×1000 (precondition)");
  await page.waitForTimeout(400);
  assert.equal((await wordmarkState(page)).risen, false, "desktop: the letters wait while the curtain has not reached the wordmark");
  await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.waitForTimeout(1700);
  const risen = await wordmarkState(page);
  assert.ok(risen.risen && risen.letters.every(atRest) && atRest(risen.tm), `desktop: the letters rise when the curtain uncovers them, the ™ with them (${JSON.stringify(risen)})`);
  const letter = page.locator(".fx-wordmark [data-letter]").nth(2);
  const box = await letter.boundingBox();
  await page.mouse.move(box.x - 60, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2, { steps: 5 });
  await page.waitForTimeout(700);
  const pushed = (await matrixOf(letter)).m41;
  assert.ok(pushed > 1, `desktop: a letter right of the pointer leans right (${pushed}px)`);
  assert.equal((await wordmarkState(page)).tm.lean, "0,0", "desktop: the ™ never leans");
  // Leaving the footer (into the strip of page above it) lets every letter settle back.
  await page.mouse.move(box.x, 40, { steps: 3 });
  await page.waitForTimeout(700);
  const settled = await wordmarkState(page);
  assert.ok(settled.letters.every(atRest), `desktop: the letters settle once the pointer leaves the footer (${JSON.stringify(settled.letters)})`);
  assert.deepEqual(await shifts(), [], "desktop: the rise and the lean shift no layout in the footer");
  await jumpTo(page, 0);
  await page.waitForTimeout(300);
  assert.equal((await wordmarkState(page)).risen, false, "desktop: the letters sink once the content covers the footer again, so the rise replays");
});

desktop("a footer link keeps the risen wordmark still under the page curtain", async (page, ctx) => {
  await fresh(page, ctx.base, "/about/");
  await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.waitForTimeout(1700);
  assert.equal((await wordmarkState(page)).risen, true, "desktop: the wordmark has risen at the end of /about/ (precondition)");
  // Every change of the risen state, and whether a view transition was running when it happened.
  await page.evaluate(() => {
    const mark = document.querySelector(".fx-wordmark");
    window.__fxWordmark = [];
    new MutationObserver(() => window.__fxWordmark.push({ risen: mark.hasAttribute("data-in"), underCurtain: document.documentElement.matches(":active-view-transition") }))
      .observe(mark, { attributes: true, attributeFilter: ["data-in"] });
  });
  const link = page.locator('#contact nav a[href="/services/"]').first();
  await settle(link);
  const box = await link.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
  await page.mouse.down();
  await page.mouse.up();
  await waitForCurtain(page);
  await page.waitForURL("**/services/");
  await transitionsDone(page);
  await page.waitForTimeout(400);
  // /services/ opens at its top, so the content covers the footer again: the letters sink once, after the curtain.
  assert.deepEqual(await page.evaluate(() => window.__fxWordmark), [{ risen: false, underCurtain: false }], "desktop: the letters keep still under the curtain and sink, out of sight, once it has gone");
});

const SITE_COPY = JSON.parse(readFileSync(new URL("../content/site.json", import.meta.url), "utf8"));
if (SITE_COPY.socialProfiles.length === 0) {
  desktop("the footer's Privacy and Terms pills are magnetic and keep their names", async (page) => {
    await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    const pills = page.locator("#contact a[data-magnetic]");
    assert.deepEqual(await pills.evaluateAll((links) => links.map((a) => [a.getAttribute("href"), a.textContent.trim()])), [["/privacy/", "Privacy"], ["/terms/", "Terms"]], "desktop: both pills are magnetic links with their names");
    const pill = pills.first();
    await settle(pill);
    const box = await pill.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y - 30);
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.75, { steps: 4 }); // inside the rounded corner
    await page.waitForTimeout(500);
    const pull = await matrixOf(pill);
    assert.ok(pull.m41 > 0.5 && pull.m42 > 0.5, `desktop: the Privacy pill leans toward the pointer (${pull.m41}, ${pull.m42})`);
  });
}

// The hero CTA and corner card that editors can change in the CMS (content/home.json), selected as
// browser-check.mjs selects them: the CTA by its link inside the copy block, the corner card outside it.
const HOME_COPY = JSON.parse(readFileSync(new URL("../content/home.json", import.meta.url), "utf8"));
const HERO_CTA = `#home .hero-copy a[href=${JSON.stringify(HOME_COPY.cta.href)}]`;
const HERO_CORNER = `#home a[href=${JSON.stringify(HOME_COPY.corner.href)}]:not(.hero-copy a)`;

/** Waits until this tab's intro (only the first load in a run plays it) has ended and the hero CTA has risen
 *  in: fully opaque and still for two polls, so a pointer placed from its box lands where it rests. */
async function heroCtaAtRest(page) {
  await page.waitForFunction(() => !["play", "reveal"].includes(document.documentElement.dataset.intro), null, { timeout: 15000 });
  let last = "";
  for (let i = 0; i < 50; i++) {
    const now = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      let opacity = 1;
      for (let node = el; node; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity);
      const r = el.getBoundingClientRect();
      return opacity > 0.99 ? `${r.x.toFixed(1)},${r.y.toFixed(1)}` : "";
    }, HERO_CTA);
    if (now && now === last) return;
    last = now;
    await page.waitForTimeout(100);
  }
  throw new Error("desktop: the hero CTA never came to rest (precondition)");
}

/** The cursor's state and label. */
function cursorReads(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    return { state: root.dataset.state, label: root.querySelector(".fx-cursor-label").textContent };
  });
}

desktop("the hero CTA is magnetic over the globe, keeps its name and focus ring, and the globe still reads Drag", async (page) => {
  const cta = page.locator(HERO_CTA);
  assert.equal(await cta.count(), 1, "desktop: one hero CTA (precondition)");
  assert.equal(await cta.getAttribute("data-magnetic"), "", "desktop: the hero CTA is magnetic");
  await heroCtaAtRest(page);
  const box = await cta.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2, { steps: 5 });
  await page.waitForTimeout(600);
  const pulled = await matrixOf(cta);
  assert.ok(pulled.m41 > 1 && pulled.m41 <= 10.5, `desktop: the hero CTA leans toward the pointer, at most 10 px (${pulled.m41}px)`);
  // The CTA lies over the globe's wrapper but outside it: the ring grows for the link, it does not read Drag.
  assert.equal((await cursorReads(page)).state, "hover","desktop: over the hero CTA the cursor shows the link ring, not the globe's label");

  // The live globe beside it (Part 1 labels its wrapper once ready): leaving the CTA for the globe reads Drag
  // and lets the CTA spring back.
  await page.waitForSelector('#home .hero-scene[data-cursor="Drag"]', { timeout: 45000 });
  const spot = await page.evaluate(() => {
    for (let x = innerWidth - 120; x > innerWidth / 2; x -= 40) {
      for (let y = 240; y < innerHeight - 160; y += 60) {
        if (document.elementFromPoint(x, y)?.closest(".hero-scene")) return { x, y };
      }
    }
    return null;
  });
  assert.ok(spot, "desktop: part of the live globe is open to the pointer (precondition)");
  await page.mouse.move(spot.x, spot.y, { steps: 6 });
  await page.waitForTimeout(900);
  assert.deepEqual(await cursorReads(page), { state: "label", label: "Drag" }, "desktop: from the hero CTA onto the globe the cursor reads Drag");
  assert.ok(Math.abs((await matrixOf(cta)).m41) < 0.5, "desktop: the hero CTA springs back when the pointer leaves for the globe");

  // Still a plain link: its name is its visible text (content/home.json), and keyboard focus shows the ring.
  assert.equal(await page.locator("#home").getByRole("link", { name: HOME_COPY.cta.label, exact: true }).count(), 1, `desktop: the magnetic hero CTA keeps its accessible name ("${HOME_COPY.cta.label}")`);
  await page.keyboard.press("Shift");
  await cta.focus();
  const ring = await cta.evaluate((el) => ({ visible: el.matches(":focus-visible"), outline: getComputedStyle(el).outlineStyle !== "none" && parseFloat(getComputedStyle(el).outlineWidth) >= 2 }));
  assert.deepEqual(ring, { visible: true, outline: true }, "desktop: keyboard focus on the magnetic hero CTA shows the focus ring");
});

desktop("Lenis glides through the hero's scroll beats", async (page) => {
  await heroCtaAtRest(page);
  await page.mouse.move(6, 500);
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("lenis-smooth")), true, "desktop: the hero scroll glides");
  await page.waitForTimeout(1600);
  const hero = await page.evaluate((selector) => {
    let opacity = 1;
    for (let node = document.querySelector(selector); node; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity);
    return { y: window.scrollY, copyOpacity: opacity, copyHidden: document.getElementById("home").hasAttribute("data-copy-hidden") };
  }, HERO_CORNER);
  assert.ok(hero.y > 600, `desktop: the glide moved through the hero (${hero.y}px)`);
  assert.ok(hero.copyOpacity < 0.5, `desktop: the hero beat advanced with the glide (copy opacity ${hero.copyOpacity})`);
  assert.equal(hero.copyHidden, true, "desktop: past the copy beat its links stop taking clicks (data-copy-hidden)");
});

// --- Run alone ---

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2];
  if (!base) {
    console.error("usage: node scripts/fx-checks.mjs <base URL of the preview, e.g. http://127.0.0.1:8791>");
    process.exit(2);
  }
  // FX_ONLY=<regex> runs only the desktop checks whose names match (a faster loop while building one effect;
  // include the checks a precondition needs, such as "deep link"). Read here only, so it never narrows the
  // checks browser-check.mjs runs.
  const only = process.env.FX_ONLY ? new RegExp(process.env.FX_ONLY, "i") : null;
  const { launchBrowser } = await import("./browser-runtime.mjs");
  const browser = await launchBrowser();
  const report = { interactions: [] };
  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const desktopResults = await checkFxDesktop({ context: desktopContext, base, report, only });
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
