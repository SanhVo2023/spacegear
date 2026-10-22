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

/** Runs every desktop check in one tab of `context`; returns results the touch checks compare against. */
export async function checkFxDesktop({ context, base, report }) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(instrument);
  const ctx = { base, deepLinkTop: null };
  // FX_ONLY=<regex> runs only the desktop checks whose names match (a faster loop while building one effect;
  // include the checks a precondition needs, such as "deep link"). browser-check.mjs never sets it.
  const only = process.env.FX_ONLY ? new RegExp(process.env.FX_ONLY, "i") : null;
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

desktop("What We Do tiles tilt toward the pointer under a spotlight", async (page) => {
  await jumpTo(page, await sectionTop(page, "work"));
  await page.waitForTimeout(900);
  const card = page.locator("#work [data-tilt]").first();
  await settle(card);
  // Layout boxes (offsets ignore transforms) of the tile and the whole bento.
  const layout = () => card.evaluate((el) => [el, el.parentElement.parentElement].map((node) => [node.offsetLeft, node.offsetTop, node.offsetWidth, node.offsetHeight].join()).join("|"));
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

desktop("forced colours keep the system cursor", async (page) => {
  try {
    await page.emulateMedia({ forcedColors: "active" });
    await page.waitForTimeout(200);
    await page.mouse.move(700, 400);
    await page.mouse.move(720, 420, { steps: 3 });
    await page.waitForTimeout(200);
    const state = await page.evaluate(() => ({ cursor: Boolean(document.querySelector("[data-fx-cursor-root]")), flag: document.documentElement.hasAttribute("data-fx-cursor"), native: getComputedStyle(document.body).cursor }));
    assert.deepEqual(state, { cursor: false, flag: false, native: "auto" }, "desktop: in forced colours the custom cursor unmounts and the native cursor shows");
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
