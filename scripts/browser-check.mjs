import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { launchBrowser } from "./browser-runtime.mjs";
const base = process.argv[2] || "http://127.0.0.1:8787";
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
assert.ok(routes.length > 0, "sitemap lists routes");
const browser = await launchBrowser();
const report = { testedAt: new Date().toISOString(), base, browser: browser.version(), profiles: [], interactions: [] };
await fs.mkdir("artifacts", { recursive: true });

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
      .filter(el => !el.closest("[data-hover-reveal]") && el.getClientRects().length > 0)
      .filter(el => { for (let n = el; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.99) return true; return false; })
      .map(el => el.textContent.trim().replace(/\s+/g, " ").slice(0, 60));
  });
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
    const page = await context.newPage(), errors = [], requests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => requests.push(request.url()));
    await page.addInitScript(() => {
      window.__audit = { cls: 0, lcp: 0, longTasks: 0, rafRequests: 0 };
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => { window.__audit.rafRequests++; return originalRaf.call(window, callback); };
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__audit.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver(list => { window.__audit.lcp = list.getEntries().at(-1)?.startTime || 0; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver(list => { window.__audit.longTasks += list.getEntries().length; }).observe({ type: "longtask", buffered: true });
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator("h1").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${profile.name}: overflow`);
    const models = requests.filter(url => /\.glb(?:$|\?)/.test(url));
    if (profile.width < 1024 || profile.reducedMotion || profile.javaScriptEnabled === false) assert.equal(models.length, 0, `${profile.name}: no model`);
    if (profile.name === "desktop") assert.equal(models.length, 1, "desktop enhancement loads one model");
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
    const faq = page.locator(".faq-list details").first();
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
    await page.screenshot({ path: `artifacts/${profile.name}.png`, fullPage: false });
    assert.deepEqual(errors, [], `${profile.name}: console errors`);
    const metrics = await page.evaluate(() => ({
      ...window.__audit,
      resourceBytes: performance.getEntriesByType("resource").reduce((sum, entry) => sum + entry.encodedBodySize, 0),
      jsBytes: performance.getEntriesByType("resource").filter(entry => entry.initiatorType === "script").reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    }));
    report.profiles.push({ name: profile.name, models: models.length, ...metrics });
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
  await fallbackPage.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
  });
  await fallbackPage.goto(base, { waitUntil: "networkidle" });
  assert.ok(await fallbackPage.locator("h1").isVisible());
  assert.ok(await fallbackPage.locator(".hero-copy").getByRole("link", { name: /Discuss a project/ }).isVisible());
  assert.ok(await fallbackPage.locator(".hero-backdrop img").isVisible());
  await fallbackPage.close();
  report.interactions.push("failed WebGL retains headline, poster and CTA");

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
  await formPage.goto(`${base}/__form-fixture/`, { waitUntil: "networkidle" });
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
