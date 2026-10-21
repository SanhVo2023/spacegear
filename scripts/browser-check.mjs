import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { build } from "esbuild";
import sharp from "sharp";
import { launchBrowser } from "./browser-runtime.mjs";
import { canvasShot, dragTurn } from "./globe-drag.mjs";
const base = process.argv[2] || "http://127.0.0.1:8787";
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
assert.ok(routes.length > 0, "sitemap lists routes");
// The preview must serve the shipped security headers, so every check below runs under the real CSP.
const homeHeaders = (await fetch(`${base}/`)).headers;
assert.ok((homeHeaders.get("content-security-policy") || "").includes("connect-src"), "/ serves the Content-Security-Policy (with connect-src)");
assert.ok(homeHeaders.has("x-content-type-options"), "/ serves X-Content-Type-Options");
// Intro timing, read from the source so the checks follow a retune: the load cap and the reveal
// (intro-store.ts) and the delay of the pure-CSS failsafe (globals.css).
const introSource = await fs.readFile(new URL("../src/components/globe/intro-store.ts", import.meta.url), "utf8");
const introConstant = name => Number(introSource.match(new RegExp(`export const ${name} = (\\d+);`))?.[1]);
const INTRO = { loadCap: introConstant("INTRO_LOAD_CAP_MS"), extraCap: introConstant("INTRO_EXTRA_CAP_MS"), reveal: introConstant("INTRO_REVEAL_MS") };
const failsafeRule = (await fs.readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")).match(/animation: intro-failsafe 0s linear (\d+(?:\.\d+)?)s forwards/);
INTRO.failsafe = failsafeRule ? Number(failsafeRule[1]) * 1000 : NaN;
const browser = await launchBrowser();
const report = { testedAt: new Date().toISOString(), base, browser: browser.version(), profiles: [], interactions: [] };
await fs.mkdir("artifacts", { recursive: true });

// The hero headline: every word in its own mask, risen into place and unclipped; the plain text.
const heroWords = page => page.evaluate(() => {
  const h1 = document.querySelector("#home h1");
  const words = [...h1.querySelectorAll(".hero-word")];
  const inPlace = el => ["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(getComputedStyle(el).transform);
  const clipped = el => {
    const word = el.getBoundingClientRect(), mask = el.parentElement.getBoundingClientRect();
    return word.top < mask.top - 0.5 || word.bottom > mask.bottom + 0.5 || word.left < mask.left - 0.5 || word.right > mask.right + 0.5;
  };
  return {
    text: h1.textContent.replace(/\s+/g, " ").trim(),
    count: words.length,
    masked: words.every(el => el.parentElement.classList.contains("hero-word-mask")),
    unsettled: words.filter(el => !inPlace(el)).map(el => el.textContent),
    clipped: words.filter(clipped).map(el => el.textContent),
  };
});
// Chrome's own accessibility tree for the page's h1: its name and the roles exposed inside it.
async function headingTree(context, page) {
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send("Accessibility.enable");
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const byId = new Map(nodes.map(node => [node.nodeId, node]));
    const heading = nodes.find(node => node.role?.value === "heading" && node.properties?.some(p => p.name === "level" && p.value.value === 1));
    const roles = new Set();
    const walk = node => {
      for (const id of node.childIds ?? []) {
        const child = byId.get(id);
        if (!child) continue;
        if (!child.ignored) roles.add(child.role?.value);
        if (child.role?.value !== "StaticText") walk(child);
      }
    };
    if (heading) walk(heading);
    return { name: heading?.name?.value ?? null, roles: [...roles] };
  } finally {
    await cdp.detach();
  }
}
// The intro overlay's computed state and the time since navigation start.
const overlayState = page => page.evaluate(() => {
  const overlay = document.querySelector(".intro-overlay");
  const style = overlay ? getComputedStyle(overlay) : {};
  return { t: Math.round(performance.now()), intro: document.documentElement.dataset.intro ?? null, overlay: Boolean(overlay), display: style.display, visibility: style.visibility, opacity: style.opacity };
});
// Hero copy under #home that is transparent, displaced or blurred (the intro's held state).
const heldCopy = page => page.evaluate(() => [...document.querySelectorAll("#home [data-reveal]")].filter(el => {
  for (let n = el; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.99) return true;
  const style = getComputedStyle(el);
  // Motion ends the entrance on blur(0px); the CSS end states use none.
  return !["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(style.transform) || !["none", "blur(0px)"].includes(style.filter);
}).map(el => el.textContent.trim().slice(0, 40)));

// Scrolls the page down and back up in steps (so in-view and lazy content gets
// its chance to appear), then returns the start of every rendered text that is
// still transparent through its own or an ancestor's opacity.
async function hiddenText(page) {
  for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 700) {
    await page.evaluate(y => window.scrollTo(0, y), y);
    await page.waitForTimeout(30);
  }
  for (let y = await page.evaluate(() => window.scrollY); y > 0; y -= 700) {
    await page.evaluate(y => window.scrollTo(0, y), y);
    await page.waitForTimeout(30);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const textBearing = [...document.querySelectorAll("main *")].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    return [...new Set([...document.querySelectorAll("main h1, main h2, main h3, main p"), ...textBearing])]
      // Dimmed disabled controls are a state, not hidden content.
      .filter(el => !el.closest("[data-hover-reveal], :disabled") && el.getClientRects().length > 0)
      .filter(el => { for (let n = el; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.99) return true; return false; })
      .map(el => el.textContent.trim().replace(/\s+/g, " ").slice(0, 60));
  });
}

// Screenshot of the hero globe's canvas alone (the copy, scrim and hint layers hidden), cropped to a
// region given in fractions of the canvas, downsampled to 96×64 RGB.
async function globeCapture(page, region = { x: 0.55, y: 0.2, w: 0.4, h: 0.6 }) {
  const png = await canvasShot(page);
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
// Mean colour of a capture, per channel.
function meanRgb(data) {
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 3) for (let k = 0; k < 3; k++) sum[k] += data[i + k];
  return sum.map(value => Math.round(value / (data.length / 3)));
}
// Captures a region every 300 ms until two captures in a row agree within 2 luma levels: the rig,
// sun and camera have eased into place, however fast the renderer is.
async function settledStats(page, region, timeout = 30000) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  let previous = pixelStats(await globeCapture(page, region));
  for (const start = Date.now(); Date.now() - start < timeout;) {
    await page.waitForTimeout(300);
    const next = pixelStats(await globeCapture(page, region));
    if (Math.abs(next.mean - previous.mean) <= 2) return next;
    previous = next;
  }
  throw new Error(`the hero globe did not settle within ${timeout} ms (${JSON.stringify(previous)})`);
}

// Records CSP violations and blocked-texture errors on every page and route a context opens.
// Each page pushes its securitypolicyviolation events to window.__csp and reports them through a
// binding, so events survive navigation; the console catches what the browser itself logs (also without JS).
const CSP_ERROR = /Couldn't load texture|violates the following Content Security Policy/;
async function watchCsp(context) {
  const problems = [];
  const where = page => { try { return new URL(page.url()).pathname; } catch { return "(no page)"; } };
  await context.exposeBinding("__cspReport", ({ page }, entry) => problems.push(`${where(page)} securitypolicyviolation ${entry}`));
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", e => {
      const entry = `${e.effectiveDirective || e.violatedDirective} blocked ${e.blockedURI || "(inline)"}`;
      window.__csp.push(entry);
      window.__cspReport?.(entry);
    });
    // Counts decoded image bitmaps; the globe's texture loader decodes its WebP maps this way.
    window.__bitmaps = [];
    const decode = window.createImageBitmap;
    if (decode) window.createImageBitmap = (...args) => decode.apply(window, args).then(bitmap => { window.__bitmaps.push({ w: bitmap.width, h: bitmap.height }); return bitmap; });
  });
  context.on("console", message => { if (CSP_ERROR.test(message.text())) problems.push(`${where(message.page())} console.${message.type()} ${message.text().slice(0, 200)}`); });
  return problems;
}

try {
  for (const profile of [
    { name: "mobile-320", width: 320, height: 740 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 1000 },
    { name: "reduced-motion", width: 1440, height: 1000, reducedMotion: "reduce" },
    { name: "no-javascript", width: 1440, height: 1000, javaScriptEnabled: false },
  ]) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, reducedMotion: profile.reducedMotion, javaScriptEnabled: profile.javaScriptEnabled });
    const cspProblems = await watchCsp(context);
    const page = await context.newPage(), errors = [], requests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => requests.push(request.url()));
    // three.js reports shader compile and link failures as console errors starting with "THREE.".
    const shaderErrors = [];
    page.on("console", message => { if (message.type() === "error" && /THREE\./.test(message.text())) shaderErrors.push(message.text().slice(0, 300)); });
    // React reports a hydration mismatch as a recoverable console error (minified #418, #423, #425 in production).
    const hydrationErrors = [];
    page.on("console", message => { if (message.type() === "error" && /hydrat|error #4(18|23|25)\b/i.test(message.text())) hydrationErrors.push(message.text().slice(0, 300)); });
    await page.addInitScript(() => {
      window.__audit = { cls: 0, lcp: 0, lcpElement: null, longTasks: 0, longestTask: 0, rafRequests: 0 };
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => { window.__audit.rafRequests++; return originalRaf.call(window, callback); };
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__audit.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver(list => {
        const entry = list.getEntries().at(-1);
        window.__audit.lcp = entry?.startTime || 0;
        const el = entry?.element;
        window.__audit.lcpElement = el ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.split(" ")[0]}` : ""} ${entry.url || el.textContent.trim().slice(0, 24)}` : null;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) { window.__audit.longTasks++; window.__audit.longestTask = Math.max(window.__audit.longestTask, Math.round(e.duration)); }
      }).observe({ type: "longtask", buffered: true });
      // Intro and globe state changes with timestamps (data-intro on <html>, data-globe on the hero scene).
      // Observing the document catches the inline gate's change to <html> during parsing.
      window.__heroLog = [];
      new MutationObserver(records => { for (const r of records) window.__heroLog.push({ attr: r.attributeName, value: r.target.getAttribute(r.attributeName), t: performance.now() }); })
        .observe(document, { subtree: true, attributes: true, attributeFilter: ["data-intro", "data-globe"] });
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator("h1").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${profile.name}: overflow`);
    // The intro plays once per session on a first desktop visit and is skipped everywhere else
    // (phones and tablets, reduced motion, no JavaScript).
    const heroLog = async () => (await page.evaluate(() => window.__heroLog)) ?? [];
    const played = log => log.some(entry => entry.attr === "data-intro" && entry.value === "play");
    let introMetrics = null;
    if (profile.name === "desktop") {
      await page.waitForFunction(() => window.__heroLog.some(entry => entry.attr === "data-intro" && entry.value === "done"), null, { timeout: 45000 });
      const log = await heroLog();
      const at = (attr, value) => log.find(entry => entry.attr === attr && entry.value === value);
      const play = at("data-intro", "play"), reveal = at("data-intro", "reveal"), ready = at("data-globe", "ready"), done = at("data-intro", "done");
      const timing = JSON.stringify({ play: play?.t, reveal: reveal?.t, ready: ready?.t, done: done.t });
      assert.ok(play, "desktop: the intro plays on the first visit");
      const firstPaint = await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime);
      assert.ok(play.t <= firstPaint, `desktop: the inline gate starts the intro before first paint (${timing}, first paint ${firstPaint})`);
      assert.ok(reveal && play.t < reveal.t && reveal.t < done.t, `desktop: the intro reveals the page, then ends (${timing})`);
      // Timers and frames get 300 ms of slack. The load cap counts from navigation start, as performance.now() does.
      assert.ok(done.t <= Math.min(ready ? ready.t : Infinity, INTRO.loadCap) + INTRO.extraCap + 300, `desktop: the intro ends within 2.5 s of loading (${timing})`);
      assert.ok(done.t <= INTRO.loadCap + INTRO.reveal + 300, `desktop: the overlay is gone within the load cap plus the reveal, from navigation start (${timing})`);
      assert.equal((await overlayState(page)).display, "none", "desktop: the overlay is removed once the intro is done");
      // Layout and long-task figures for the intro visit, taken before the checks below add their own work.
      introMetrics = { ...(await page.evaluate(() => window.__audit)), timing: JSON.parse(timing) };
      assert.ok(!(introMetrics.cls >= 0.05), `desktop with the intro: cumulative layout shift ${introMetrics.cls}`);
    } else {
      assert.equal(played(await heroLog()), false, `${profile.name}: no intro`);
      assert.equal((await overlayState(page)).display, "none", `${profile.name}: the intro overlay never shows`);
    }
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

      // The sun sweeps with scroll: at the centred beat the visible disc turns to its night side.
      const centre = { x: 0.4, y: 0.3, w: 0.2, h: 0.4 };
      const dayCentre = pixelStats(await globeCapture(page, centre));
      await page.evaluate(() => {
        const home = document.getElementById("home");
        window.scrollTo({ top: window.scrollY + home.getBoundingClientRect().top + (home.offsetHeight - innerHeight) * 0.62, behavior: "instant" });
      });
      const nightCentre = await settledStats(page, centre);
      // The atmosphere ring hugs the lit (left) limb of the centred globe. At 1440×1000 and p 0.62 the
      // globe (radius 1.3, camera z 5.92) has its limb 327 px left of centre and the shell (× 1.08) ends
      // at 354 px: compare the inner ring with open space further out on the same row.
      const ring = meanRgb(await globeCapture(page, { x: 368 / 1440, y: 0.49, w: 22 / 1440, h: 0.02 }));
      const space = meanRgb(await globeCapture(page, { x: 270 / 1440, y: 0.49, w: 22 / 1440, h: 0.02 }));
      const luma = ([r, g, b]) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      assert.ok(luma(ring) > luma(space) + 15 && ring[2] > ring[0], `desktop: a blue atmosphere ring lines the lit limb (ring ${ring}, space ${space})`);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await settledStats(page, centre);
      assert.ok(nightCentre.mean < dayCentre.mean * 0.6, `desktop: the terminator sweeps across the globe with scroll (day ${dayCentre.mean}, night ${nightCentre.mean})`);
      report.interactions.push(`desktop sun sweep turns the centred globe to its night side (centre luma ${dayCentre.mean} → ${nightCentre.mean}); atmosphere ring rgb ${ring} over space ${space}`);

      // Mouse drag spins the globe with inertia and never scrolls the page; touch is left alone.
      const scene = page.locator("#home .hero-scene");
      assert.equal(await scene.getAttribute("data-cursor"), "Drag", "desktop: the globe offers a Drag cursor label");
      assert.equal(await scene.evaluate(el => getComputedStyle(el).touchAction), "auto", "desktop: the globe never blocks touch scrolling");
      assert.ok(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches), "desktop: the test browser reports a fine pointer (drag is fine-pointer only)");
      // A slow, held 8° drag turns the surface the way the pointer moved: left, then right, each
      // measured against an idle sequence with the same timing (scripts/globe-drag.mjs).
      const scrollBefore = await page.evaluate(() => window.scrollY);
      const turn = await dragTurn(page);
      const shifts = `left ${turn.inducedLeft} px, right ${turn.inducedRight} px; idle drift ${turn.idle.shift} px`;
      assert.ok(turn.left.pressed && turn.left.held && turn.right.pressed && turn.right.held, "desktop: pressing on the globe starts a drag that lasts until release");
      assert.equal(await scene.evaluate(el => el.hasAttribute("data-dragging")), false, "desktop: releasing the mouse ends the drag");
      assert.equal(await page.evaluate(() => window.scrollY), scrollBefore, "desktop: dragging the globe does not scroll the page");
      assert.ok(turn.inducedLeft < -60 && turn.inducedRight > 60, `desktop: dragging turns the globe's surface with the pointer (${shifts})`);
      report.interactions.push(`desktop globe drag turns the surface with the pointer without scrolling the page (${shifts})`);

      // A release the page never sees (window blur, a release outside the window) still ends the drag.
      await page.evaluate(() => addEventListener("pointerdown", e => { window.__pointerId = e.pointerId; }, { capture: true }));
      const isDragging = () => scene.evaluate(el => el.hasAttribute("data-dragging"));
      await page.mouse.move(1100, 600);
      await page.mouse.down();
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      assert.equal(await isDragging(), false, "desktop: a window blur ends a drag");
      await page.mouse.up();
      await page.mouse.down();
      assert.equal(await isDragging(), true, "desktop: a press after a missed release starts a new drag");
      await page.evaluate(() => document.querySelector("#home .hero-scene").dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: window.__pointerId, pointerType: "mouse", buttons: 0, clientX: 900, clientY: 600 })));
      assert.equal(await isDragging(), false, "desktop: a move with the button up ends a drag whose release was missed");
      await page.mouse.up();

      // Dragging across the hero copy selects no text.
      const headline = await page.locator("#home h1").boundingBox();
      await page.mouse.move(headline.x + headline.width + 40, headline.y + headline.height / 2);
      await page.mouse.down();
      await page.mouse.move(headline.x + 10, headline.y + headline.height / 2, { steps: 8 });
      await page.mouse.up();
      assert.equal(await page.evaluate(() => String(getSelection())), "", "desktop: dragging the globe across the hero copy selects no text");

      // A click on the globe moves focus like a click anywhere else: a keyboard-opened dropdown closes.
      const services = () => page.evaluate(() => {
        const item = [...document.querySelectorAll("header li.group")].find(li => li.querySelector("a")?.textContent.includes("Services"));
        return { focused: item.contains(document.activeElement), visibility: getComputedStyle(item.querySelector(":scope > div")).visibility };
      });
      await page.mouse.move(1100, 600);
      await page.locator("header a").first().focus();
      for (let i = 0; i < 8 && !(await services()).focused; i++) await page.keyboard.press("Tab");
      await page.waitForTimeout(300);
      assert.deepEqual(await services(), { focused: true, visibility: "visible" }, "desktop: Tab opens the Services dropdown (precondition for the globe click)");
      await page.mouse.click(1100, 600);
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => document.activeElement === document.body), true, "desktop: a click on the globe moves focus off the nav");
      assert.equal((await services()).visibility, "hidden", "desktop: a click on the globe closes a keyboard-opened dropdown");
      report.interactions.push("desktop globe: a missed release ends the drag, a drag selects no text and a click moves focus");

      // A second visit in the same tab skips the intro.
      await page.reload({ waitUntil: "networkidle" });
      await page.locator("h1").waitFor({ state: "visible" });
      assert.equal(played(await heroLog()), false, "desktop: the intro is skipped on the second visit");
      assert.equal((await overlayState(page)).display, "none", "desktop: no overlay on the second visit");
      report.interactions.push(`desktop intro plays once per session, starts before first paint and ends within 2.5 s of loading and within ${INTRO.loadCap + INTRO.reveal} ms of navigation start (${JSON.stringify(introMetrics.timing)})`);

      // Any input ends the intro at once. Tab lands on the skip link, which shows above the overlay with its focus ring.
      const skipPage = await context.newPage(); // a new tab is a new session: the intro plays
      // Hold the textures so the intro is still loading when the key is pressed.
      await skipPage.route("**/textures/earth/**", async route => { await new Promise(resolve => setTimeout(resolve, 3000)); await route.continue().catch(() => {}); });
      await skipPage.goto(base, { waitUntil: "domcontentloaded" });
      await skipPage.waitForSelector("#home .hero-scene", { state: "attached", timeout: 30000 }); // hydrated: the overlay listens for input
      const loading = await overlayState(skipPage);
      assert.ok(loading.intro === "play" && loading.display === "flex", `desktop: the intro is still loading (precondition for the skip check: ${JSON.stringify(loading)})`);
      // The overlay is never read out (the counter is aria-hidden), holds nothing focusable, never takes
      // pointer events and sits outside main.
      assert.deepEqual(await skipPage.evaluate(() => {
        const overlay = document.querySelector(".intro-overlay");
        return { ariaHidden: overlay.getAttribute("aria-hidden"), focusable: overlay.querySelectorAll("a, button, input, select, textarea, [tabindex]").length, pointerEvents: getComputedStyle(overlay).pointerEvents, inMain: Boolean(overlay.closest("main")) };
      }), { ariaHidden: "true", focusable: 0, pointerEvents: "none", inMain: false }, "desktop: the intro overlay is hidden from assistive technology and cannot take focus or clicks");
      await skipPage.keyboard.press("Tab");
      const skipped = await overlayState(skipPage);
      assert.ok(skipped.intro === "done" && skipped.display === "none", `desktop: a key press ends the intro at once (${JSON.stringify(skipped)})`);
      await skipPage.waitForTimeout(300); // the skip link's slide-in
      const skipFocus = await skipPage.evaluate(() => {
        const el = document.activeElement, r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { skipLink: el.matches(".skip-link"), focusVisible: el.matches(":focus-visible"), outline: getComputedStyle(el).outlineStyle, onTop: Boolean(top && (top === el || el.contains(top))) };
      });
      assert.deepEqual(skipFocus, { skipLink: true, focusVisible: true, outline: "solid", onTop: true }, "desktop: Tab during the intro focuses the visible skip link");
      await skipPage.waitForTimeout(1800); // the copy rises once the intro has ended
      assert.deepEqual(await heldCopy(skipPage), [], "desktop: a skipped intro releases the hero copy");
      await skipPage.close();
      report.interactions.push("desktop intro: Tab ends it at once and focuses the visible skip link; the copy is released");

      // Pure-CSS failsafe: when the overlay's script never runs, the overlay hides itself and the held
      // hero copy shows after the failsafe delay.
      assert.ok(INTRO.failsafe > INTRO.loadCap + INTRO.reveal, `the CSS failsafe (${INTRO.failsafe} ms) waits out the load cap plus the reveal`);
      const deadPage = await context.newPage();
      await deadPage.route("**/_next/static/**", route => (route.request().resourceType() === "script" ? route.abort() : route.continue()));
      await deadPage.goto(base, { waitUntil: "load" });
      const stuck = await overlayState(deadPage);
      assert.ok(stuck.intro === "play" && stuck.display === "flex" && stuck.visibility === "visible" && stuck.t < INTRO.failsafe - 500, `failsafe: the overlay covers the page while the scripts are blocked (precondition: ${JSON.stringify(stuck)})`);
      assert.notDeepEqual(await heldCopy(deadPage), [], "failsafe: the hero copy is held while the overlay shows (precondition)");
      await deadPage.waitForFunction(ms => performance.now() > ms, INTRO.failsafe + 300, { timeout: INTRO.failsafe + 10000 });
      const released = await overlayState(deadPage);
      assert.ok(released.intro === "play" && released.visibility === "hidden" && Number(released.opacity) === 0, `failsafe: the overlay hides itself without JavaScript (${JSON.stringify(released)})`);
      assert.deepEqual(await heldCopy(deadPage), [], "failsafe: the hero copy shows without JavaScript");
      assert.deepEqual((await heroWords(deadPage)).unsettled, [], "failsafe: the headline words stand in place without JavaScript");
      await deadPage.close();
      report.interactions.push(`desktop intro failsafe: with the scripts blocked the overlay hides and the copy shows after ${INTRO.failsafe} ms`);
    }
    if (profile.reducedMotion) assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === "running").length), 0);
    if (profile.name === "mobile-390") {
      const menu = page.locator(".mobile-menu");
      await menu.locator("summary").focus(); await page.keyboard.press("Enter");
      assert.equal(await menu.getAttribute("open"), "");
      await page.keyboard.press("Escape");
      assert.equal(await menu.getAttribute("open"), null);
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector(".mobile-menu summary")), true);
      await menu.locator("summary").press("Enter");
      await menu.getByRole("link", { name: "Services", exact: true }).click();
      await page.waitForURL("**/services/");
      assert.equal(await menu.getAttribute("open"), null);
      await page.goto(base, { waitUntil: "networkidle" });
      report.interactions.push("mobile menu keyboard open/Escape/focus and navigation");
    }
    // second item: closed by default (the first opens on load, as in the original)
    const faq = page.locator(".faq-accordion details").nth(1);
    await faq.locator("summary").focus(); await page.keyboard.press("Enter");
    assert.notEqual(await faq.getAttribute("open"), null);
    await page.keyboard.press("Enter");
    for (let y = 0, height = await page.evaluate(() => document.documentElement.scrollHeight); y < height; y += 700) {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await page.waitForTimeout(30);
    }
    if (profile.name === "desktop") {
      await page.waitForTimeout(300);
      const before = await page.evaluate(() => window.__audit.rafRequests);
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => window.__audit.rafRequests);
      assert.ok(after - before <= 2, "offscreen scene must stop requesting frames");
      report.interactions.push("desktop globe stops rendering offscreen");
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    // The headline rises word by word from masks for every visitor; reduced motion and no-JS show the
    // end state from CSS. The accessible name stays the plain sentence, and the copy is not duplicated.
    const words = await heroWords(page);
    assert.ok(words.count > 5 && words.masked && words.count === words.text.split(" ").length, `${profile.name}: each headline word sits in its own mask (${JSON.stringify(words)})`);
    assert.deepEqual(words.unsettled, [], `${profile.name}: the headline words have risen into place`);
    assert.deepEqual(words.clipped, [], `${profile.name}: no headline word is clipped by its mask`);
    assert.ok(!/\s[,.]/.test(words.text), `${profile.name}: the headline reads as a sentence (${words.text})`);
    assert.equal(await page.getByRole("heading", { level: 1, name: words.text, exact: true }).count(), 1, `${profile.name}: the headline's accessible name is the whole sentence`);
    assert.deepEqual(await headingTree(context, page), { name: words.text, roles: ["StaticText"] }, `${profile.name}: Chrome exposes the headline as one heading of plain text, with no group per word`);
    await page.screenshot({ path: `artifacts/${profile.name}.png`, fullPage: false });
    assert.deepEqual(errors, [], `${profile.name}: console errors`);
    assert.deepEqual(hydrationErrors, [], `${profile.name}: React hydrates without a mismatch (the intro gate edits <html> before hydration)`);
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
    report.profiles.push({ name: profile.name, textures: textureRequests.length, ...metrics, ...(introMetrics ? { intro: introMetrics } : {}) });
    if (profile.name === "desktop") {
      // The curtain footer is fixed behind the content; tabbing into it must bring it into view.
      await page.evaluate(() => {
        const items = [...document.querySelectorAll("main a[href], main button:not([disabled]), main summary, main input, main select, main textarea")]
          .filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden");
        items.at(-1).focus();
      });
      await page.keyboard.press("Tab");
      await page.waitForTimeout(100);
      const focus = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { inFooter: false, visible: false };
        const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        return {
          inFooter: Boolean(el.closest("#contact")),
          visible: r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && Boolean(top && (top === el || el.contains(top))),
        };
      });
      assert.equal(focus.inFooter, true, "desktop: keyboard focus in the curtain footer must be visible (focus must enter the footer)");
      assert.equal(focus.visible, true, "desktop: keyboard focus in the curtain footer must be visible");
      report.interactions.push("desktop keyboard focus in the curtain footer is visible");

      // The hero copy fades out mid-scroll but its links stay focusable; focus must bring them back.
      await page.evaluate(() => {
        const home = document.getElementById("home");
        const top = window.scrollY + home.getBoundingClientRect().top;
        window.scrollTo({ top: top + (home.offsetHeight - innerHeight) * 0.6, behavior: "instant" });
      });
      await page.waitForTimeout(150);
      const corner = page.locator('#home a[href="/services/applied-ai/"]');
      assert.ok(await corner.evaluate(el => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; }) < 0.5, "desktop: hero copy fades at mid-scroll (precondition for the focus check)");
      await corner.focus();
      await page.waitForTimeout(150);
      const heroFocus = await page.evaluate(() => {
        const el = document.activeElement, r = el.getBoundingClientRect();
        let opacity = 1;
        for (let n = el; n; n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity);
        return { corner: el.matches('#home a[href="/services/applied-ai/"]'), opacity, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
      });
      assert.ok(heroFocus.corner && heroFocus.opacity >= 0.99 && heroFocus.inView, "desktop: focused hero links must be visible");
      report.interactions.push("desktop keyboard focus on a faded hero link scrolls the copy back into view");

      // The static hero (first paint) reserves the cinematic's height, so a deep link lands on its section.
      const deep = await context.newPage();
      await deep.goto(`${base}/#pricing`, { waitUntil: "load" });
      await deep.waitForTimeout(1500);
      assert.ok(await deep.evaluate(() => Math.abs(document.getElementById("pricing").getBoundingClientRect().top) < 200), "desktop: deep link to #pricing must land on the section");
      await deep.close();
      report.interactions.push("desktop deep link to #pricing lands on the section after hydration");

      // Crossing the 1024 px breakpoint unmounts the scene (R3F force-loses its context 500 ms later)
      // and a return remounts it: the globe must come back rather than stay "failed".
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.setViewportSize({ width: 900, height: profile.height });
      await page.waitForSelector("#home .hero-scene", { state: "detached" });
      await page.waitForTimeout(1200);
      await page.setViewportSize({ width: profile.width, height: profile.height });
      await page.waitForFunction(() => ["ready", "failed"].includes(document.querySelector("#home .hero-scene")?.dataset.globe), null, { timeout: 45000 });
      assert.equal(await page.locator("#home .hero-scene").getAttribute("data-globe"), "ready", "desktop: the globe recovers after the viewport crosses 1024 px and back");
      assert.deepEqual(shaderErrors, [], "desktop /: the remounted globe's shaders compile");
      report.interactions.push("desktop globe remounts and reaches ready after a resize below 1024 px and back");
    }
    // Runs last so the home-page assertions above keep their original timing.
    if (profile.javaScriptEnabled === false || profile.reducedMotion) {
      const sweep = await context.newPage();
      for (const route of routes) {
        await sweep.goto(new URL(route, base).href, { waitUntil: "networkidle" });
        assert.deepEqual(await hiddenText(sweep), [], `${profile.name} ${route}: entrance states must not hide content`);
      }
      await sweep.close();
      report.interactions.push(`${profile.name}: no transparent text on all ${routes.length} routes after a scroll pass`);
    }
    assert.deepEqual(cspProblems, [], `${profile.name}: no CSP violations or texture errors on any visited route`);
    report.interactions.push(`${profile.name}: no CSP violations or texture errors`);
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 720, height: 500 } });
  await page.goto(`${base}/contact/?service=applied-ai`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("select[name=service]").inputValue(), "applied-ai");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "200% text/compact viewport");
  assert.equal(await page.getByRole("button", { name: /Send inquiry/ }).isDisabled(), true, "unconfigured preview cannot send");
  await page.screenshot({ path: "artifacts/contact-compact.png", fullPage: true });
  await page.close();
  report.interactions.push("native FAQ keyboard toggles, contact service selection, compact viewport/text zoom, preview form disabled");

  const KEY = "spacegear:quickstart";
  const hostile = '<img src=x onerror="window.__x=1">';
  const quick = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await quick.goto(base, { waitUntil: "networkidle" });
  await quick.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await quick.waitForTimeout(400);
  await quick.getByLabel("Your name").fill(hostile);
  await quick.getByLabel("Your email").fill("robin@gmail.com");
  await quick.getByRole("button", { name: "Continue to the project brief" }).click();
  await quick.waitForURL("**/contact/");
  await quick.waitForFunction(() => document.querySelector("#name")?.value !== "");
  assert.equal(await quick.locator("#name").inputValue(), hostile, "hostile name arrives verbatim");
  assert.equal(await quick.locator("#email").inputValue(), "robin@gmail.com");
  assert.equal(await quick.evaluate(() => window.__x), undefined, "hostile name is not executed");
  const handed = quick.url();
  assert.ok(!/robin|%40|@/i.test(handed), "quick start keeps the email out of the URL");
  assert.ok(!handed.includes("img") && new URL(handed).search === "" && new URL(handed).hash === "", "no query or hash after hand-off");
  assert.equal(await quick.evaluate((k) => sessionStorage.getItem(k), KEY), null, "hand-off storage consumed");
  await quick.reload({ waitUntil: "networkidle" });
  assert.equal(await quick.locator("#name").inputValue(), "", "reload does not restore the name");
  // Same-page case: the footer on /contact/ must fill the form that is already mounted.
  await quick.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await quick.waitForTimeout(400);
  await quick.getByLabel("Your name").fill("Pat Samepage");
  await quick.getByLabel("Your email").fill("pat@gmail.com");
  await quick.getByRole("button", { name: "Continue to the project brief" }).click();
  await quick.waitForTimeout(800);
  assert.equal(await quick.locator("#name").inputValue(), "Pat Samepage", "same-page hand-off fills name");
  assert.equal(await quick.locator("#email").inputValue(), "pat@gmail.com", "same-page hand-off fills email");
  assert.equal(await quick.evaluate((k) => sessionStorage.getItem(k), KEY), null, "same-page hand-off leaves no storage");
  assert.equal(await quick.evaluate(() => document.activeElement?.id), "message", "message field focused");
  // Empty footer fields must never wipe what the visitor already typed into the mounted form.
  await quick.locator("#name").fill("Typed Visitor");
  await quick.locator("#email").fill("typed@gmail.com");
  await quick.getByLabel("Your name").fill("");
  await quick.getByLabel("Your email").fill("footer@gmail.com");
  await quick.getByRole("button", { name: "Continue to the project brief" }).click();
  await quick.waitForTimeout(400);
  assert.equal(await quick.locator("#name").inputValue(), "Typed Visitor", "empty footer name keeps the typed name");
  assert.equal(await quick.locator("#email").inputValue(), "footer@gmail.com", "non-empty footer email still fills");
  await quick.getByLabel("Your email").fill("");
  await quick.getByRole("button", { name: "Continue to the project brief" }).click();
  await quick.waitForTimeout(400);
  assert.equal(await quick.locator("#email").inputValue(), "footer@gmail.com", "empty footer email keeps the typed email");
  await quick.close();
  report.interactions.push("footer quick start hands name and email to the contact form (also on the contact page) without URL or leftover storage");

  const narrowPage = await browser.newPage({ viewport: { width: 320, height: 740 } });
  for (const route of routes) {
    await narrowPage.goto(new URL(route, base).href, { waitUntil: "networkidle" });
    const clipped = await narrowPage.evaluate(() => [...document.querySelectorAll("main h1, main h2, main p, main label")].filter(el => !el.closest("[data-snap-row]")).flatMap(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      return [...range.getClientRects()].some(rect => rect.right > innerWidth + 1 || rect.left < -1) ? [el.textContent] : [];
    }));
    assert.deepEqual(clipped, [], `${route}: text clipped at 320px`);
  }
  await narrowPage.close();
  report.interactions.push("all 12 routes: actual text bounds fit 320px, including long service headings");

  const fallbackPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const fallbackErrors = [], fallbackDownloads = [];
  fallbackPage.on("pageerror", error => fallbackErrors.push(error.message));
  fallbackPage.on("request", request => { if (/\.glb(?:$|\?)|\/draco\/|\/textures\/earth\//.test(request.url())) fallbackDownloads.push(request.url()); });
  // Every WebGL flavour (webgl, webgl2, experimental-webgl) fails to create a context.
  await fallbackPage.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
  });
  await fallbackPage.goto(base, { waitUntil: "networkidle" });
  await fallbackPage.waitForTimeout(2500); // past the idle-mount timeout
  // A first visit plays the intro; a globe that cannot start ends it, and the copy is released.
  assert.equal((await overlayState(fallbackPage)).intro, "done", "webgl-fallback: the intro ends when the globe cannot start");
  assert.deepEqual(await heldCopy(fallbackPage), [], "webgl-fallback: the hero copy is fully visible");
  assert.ok(await fallbackPage.locator("h1").isVisible());
  assert.ok(await fallbackPage.locator(".hero-copy").getByRole("link", { name: /Discuss a project/ }).isVisible());
  assert.ok(await fallbackPage.locator(".hero-backdrop img").isVisible());
  assert.deepEqual(fallbackErrors, [], "webgl-fallback: no page errors");
  assert.deepEqual(fallbackDownloads, [], "webgl-fallback: no model, decoder or texture download");
  await fallbackPage.close();
  report.interactions.push("failed WebGL retains headline, poster and CTA, without errors or any globe download");

  // Exercise the real form component with isolated verification and endpoint fixtures.
  // No inquiry or email leaves the local test browser.
  const fixture = await build({
    stdin: { contents: 'import React from "react";import {createRoot} from "react-dom/client";import ContactForm from "./src/components/ContactForm.tsx";createRoot(document.getElementById("root")).render(<ContactForm services={[]} siteKey="test-site-key"/>);', resolveDir: process.cwd(), sourcefile: "form-fixture.tsx", loader: "tsx" },
    bundle: true, write: false, format: "esm", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  const formPage = await browser.newPage();
  await formPage.route("**/__form-fixture/", route => route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div><script type="module" src="/__form-fixture.js"></script></body></html>' }));
  await formPage.route("**/__form-fixture.js", route => route.fulfill({ contentType: "application/javascript", body: fixture.outputFiles[0].text }));
  await formPage.route("https://challenges.cloudflare.com/**", route => route.fulfill({ contentType: "application/javascript", body: "window.turnstile={render(el,opts){window.challenge=opts;opts.callback('fixture-token');return 'widget';},reset(){window.challenge.callback('fixture-token');},remove(){}};" }));
  const payloads = []; let phase = "fail";
  await formPage.route("**/api/contact", async route => {
    payloads.push(route.request().postDataJSON());
    if (phase === "network") return route.abort("connectionreset");
    await new Promise(resolve => setTimeout(resolve, 100));
    return route.fulfill({ status: phase === "success" ? 202 : phase === "conflict" ? 409 : 503, contentType: "application/json", body: JSON.stringify({ ok: phase === "success" }) });
  });
  await formPage.addInitScript(() => {
    if (sessionStorage.getItem("fixture-prefilled")) return;
    sessionStorage.setItem("fixture-prefilled", "1");
    sessionStorage.setItem("spacegear:quickstart", JSON.stringify({ name: "Sam Quickstart", email: "sam@gmail.com" }));
  });
  await formPage.goto(`${base}/__form-fixture/`, { waitUntil: "networkidle" });
  await formPage.waitForFunction(() => document.querySelector("#name")?.value === "Sam Quickstart");
  assert.equal(await formPage.locator("#email").inputValue(), "sam@gmail.com", "quick-start email prefilled");
  assert.equal(await formPage.evaluate(() => sessionStorage.getItem("spacegear:quickstart")), null, "quick-start details are used once");
  await formPage.getByLabel("Name", { exact: true }).fill("Alex Example");
  await formPage.getByLabel("Email", { exact: true }).fill("alex@gmail.com");
  await formPage.getByLabel("What would you like to improve?").fill("Connect our documents to the systems we already use.");
  await formPage.evaluate(() => window.challenge["expired-callback"]());
  await formPage.getByRole("button", { name: /Send inquiry/ }).click();
  await formPage.getByText("Please complete the verification, then send your inquiry.").waitFor();
  assert.equal(payloads.length, 0);
  await formPage.evaluate(() => window.challenge.callback("fresh-token"));
  await formPage.getByRole("button", { name: /Send inquiry/ }).click();
  await formPage.getByRole("status").filter({ hasText: "could not be saved" }).waitFor();
  assert.equal(await formPage.locator("#email").inputValue(), "alex@gmail.com");
  phase = "network";
  await formPage.getByRole("button", { name: /Send inquiry/ }).click();
  await formPage.getByRole("status").filter({ hasText: "couldn’t confirm receipt" }).waitFor();
  assert.equal(payloads[0].submissionId, payloads[1].submissionId);
  phase = "success";
  await formPage.getByRole("button", { name: /Send inquiry/ }).click();
  await formPage.getByRole("status").filter({ hasText: "has been received" }).waitFor();
  assert.equal(payloads.length, 3);
  assert.equal(payloads[1].submissionId, payloads[2].submissionId);
  assert.equal(await formPage.locator("#message").inputValue(), "");
  await formPage.waitForFunction(() => document.activeElement?.getAttribute("role") === "status");
  report.interactions.push("actual form: expired challenge, 503, lost response, input retention, stable retry key, success reset and focus");
  await formPage.close();
  await fs.writeFile("artifacts/browser-report.json", JSON.stringify(report, null, 2));
  console.log(`Browser checks passed: ${report.profiles.length} profiles; navigation, no-JS/reduced-motion, responsive layout and form recovery.`);
  console.log("Timing measurements are unthrottled local lab observations, not Lighthouse scores or field Core Web Vitals.");
} finally { await browser.close(); }
