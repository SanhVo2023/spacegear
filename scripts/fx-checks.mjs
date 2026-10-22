// Browser checks for the motion system (src/components/fx). scripts/browser-check.mjs runs them inside its
// desktop profile and a touch context. Run them alone (faster while building an effect) with the preview's
// base URL, which is required (no default port):
//   node scripts/fx-checks.mjs http://127.0.0.1:8791
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

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
