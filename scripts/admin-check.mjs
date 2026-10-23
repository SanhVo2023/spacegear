// Browser checks for the CMS (showcase Part 3, Task 10), run by scripts/browser-check.mjs against
// the running preview:
// 1. Headers. Every sitemap route serves exactly the site CSP; /admin/ and its files serve exactly
//    ADMIN_HEADERS and anything under /uploads/ exactly UPLOADS_HEADERS (scripts/lib/headers.mjs),
//    each once, plus the site's other security headers. Every response must also carry exactly the
//    security headers that
//    scripts/lib/headers.mjs computes from dist/_headers, so the simulation check-export relies on is
//    held against the real asset worker.
// 2. The uploads sandbox in Chromium. An upload is fixture bytes served under /uploads/ with the
//    headers the preview sends there (nothing is planted in public/ or dist/): a site page shows it
//    with <img>; opened on its own it is a sandboxed image document; an HTML/PNG polyglot, also
//    served as HTML, and an SVG with a script run nothing, while the same polyglot without those
//    headers does run (so the probe can see a script run). The preview's own 404 page, which has
//    scripts, runs none of them under /uploads/.
// 3. /admin/. The vendored Sveltia CMS boots under its CSP with no page error and loads code only
//    from /admin/sveltia/ (byte-identical to the pins in scripts/vendor-sveltia.mjs). Exactly one
//    optional request may be blocked, matched by its whole URL (Task 9 review): the update check on
//    unpkg.com (inside try/catch in 0.230.1). The GitHub status check that the github backend makes
//    on the sign-in screen must be allowed now (the admin CSP names www.githubstatus.com for GitHub
//    sign-in); it is answered from a fixture, so the check needs no network for it. Nothing else
//    may come from GitHub: the local workflow never calls the API.
//    Then "Work with Local Repository" opens a copy of content/
//    and public/images/ (an Origin Private File System folder stands in for the native folder
//    picker; nothing on disk is written): the eight collections from config.yml are listed and the
//    icons render with the Material Symbols font, not as words. Every font face the bundle declares
//    must load, and the font requests must be exactly ADMIN_FONTS. Fonts are served from a cache in
//    artifacts/cms-fonts/ (filled from jsDelivr on first use), so the check does not depend on the
//    network once the cache exists; the CSP is enforced before a request reaches that route, so a
//    font the admin CSP blocks still fails the check.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ADMIN_FILES } from "./lib/admin.mjs";
import { ADMIN_CSP, ADMIN_FONTS, ADMIN_HEADERS, UPLOADS_CSP, UPLOADS_HEADERS, headersFor, parseHeaders, sitePaths } from "./lib/headers.mjs";
import { SVELTIA } from "./vendor-sveltia.mjs";

const CSP = "content-security-policy";
const SECURITY_HEADERS = [CSP, "x-robots-tag", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"];
const TOLERATED = ["connect-src blocked https://unpkg.com/@sveltia/cms/package.json"];
const GITHUB_STATUS = "https://www.githubstatus.com/api/v2/status.json";
const COLLECTIONS = ["Site and sections", "Services", "Engagements", "Questions & Answers", "Team disciplines", "Testimonials", "Articles", "Legal pages"];
const PROBE = "/uploads/__browser-check";
const FONT_CACHE = "artifacts/cms-fonts";
const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

/** Records securitypolicyviolation events of every page in `context` as "<directive> blocked <url>". */
async function violations(context) {
  const seen = [];
  await context.exposeBinding("__cmsCsp", ({ page }, entry) => seen.push({ path: new URL(page.url()).pathname, entry }));
  await context.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => window.__cmsCsp?.(`${e.effectiveDirective || e.violatedDirective} blocked ${e.blockedURI || "(inline)"}`)));
  return seen;
}

async function checkHeaders(base, routes) {
  const { rules, invalid } = parseHeaders(await fs.readFile("dist/_headers", "utf8"));
  assert.deepEqual(invalid, [], "dist/_headers: every line is one Cloudflare reads");
  const siteHeaders = rules.find((rule) => rule.path === "/*")?.set ?? {};
  const site = siteHeaders[CSP];
  assert.ok(site && site !== ADMIN_CSP, "dist/_headers defines the site CSP, and it is not the admin CSP");
  const exactly = (response, pathname, pinned, what) => {
    const expected = { ...Object.fromEntries(SECURITY_HEADERS.filter((name) => siteHeaders[name]).map((name) => [name, siteHeaders[name]])), ...pinned };
    for (const name of SECURITY_HEADERS) assert.equal(response.headers.get(name) ?? undefined, expected[name], `${pathname}: ${name} is ${what} (scripts/lib/headers.mjs), sent once`);
  };
  const served = async (pathname, status) => {
    const response = await fetch(new URL(pathname, base), { redirect: "manual" });
    if (status) assert.equal(response.status, status, `${pathname}: status`);
    const expected = headersFor(rules, pathname);
    for (const name of SECURITY_HEADERS) assert.equal(response.headers.get(name) ?? undefined, expected[name], `${pathname}: ${name} is what dist/_headers gives it (scripts/lib/headers.mjs)`);
    return response;
  };
  const home = await (await served("/", 200)).text();
  const chunk = home.match(/\/_next\/static\/chunks\/[\w.-]+\.js/)?.[0];
  assert.ok(chunk, "the home page loads a chunk");
  for (const route of [...routes, chunk]) assert.equal((await served(route, 200)).headers.get(CSP), site, `${route}: exactly the site CSP`);
  // Next to the CMS prefixes: a 404 and the redirect to /admin/ keep the site CSP.
  assert.equal((await served("/administrator/", 404)).headers.get(CSP), site, "/administrator/: exactly the site CSP");
  const bare = await served("/admin");
  assert.ok(bare.status >= 300 && bare.status < 400 && new URL(bare.headers.get("location"), base).pathname === "/admin/", "/admin redirects to /admin/");
  assert.equal(bare.headers.get(CSP), site, "/admin (the redirect): exactly the site CSP");
  assert.equal((await fetch(new URL(chunk, base))).headers.get("cache-control"), "public, max-age=31536000, immutable", `${chunk}: immutable`);
  const files = sitePaths("dist").filter((pathname) => pathname.startsWith("/admin/") && !pathname.endsWith("/index.html"));
  assert.equal(files.length, ADMIN_FILES.length, `dist/admin/ ships ADMIN_FILES, the page served as /admin/ (${files.join(", ")})`);
  for (const pathname of files) {
    const response = await served(pathname, 200);
    exactly(response, pathname, ADMIN_HEADERS, "ADMIN_HEADERS");
    if (pathname.startsWith("/admin/sveltia/")) assert.equal(sha256(Buffer.from(await response.arrayBuffer())), SVELTIA.files[pathname.slice("/admin/sveltia/".length)], `${pathname}: the pinned bytes`);
    if (pathname === "/admin/") assert.match(await response.text(), /<meta name="robots" content="noindex/, "/admin/ is noindex in its HTML");
  }
  const uploads = [`${PROBE}/missing.webp`, ...sitePaths("dist").filter((pathname) => pathname.startsWith("/uploads/"))];
  for (const pathname of uploads) {
    const response = await served(pathname, pathname.startsWith(PROBE) ? 404 : 200);
    exactly(response, pathname, UPLOADS_HEADERS, "UPLOADS_HEADERS");
  }
  const probe = await fetch(new URL(`${PROBE}/missing.webp`, base));
  const uploadHeaders = Object.fromEntries(SECURITY_HEADERS.filter((name) => probe.headers.has(name)).map((name) => [name, probe.headers.get(name)]));
  return { site, uploadHeaders, line: `headers: ${routes.length} routes and a chunk serve exactly the site CSP; ${files.length} /admin/ files exactly ADMIN_HEADERS; ${uploads.length} /uploads/ path(s) exactly UPLOADS_HEADERS; all as dist/_headers gives them` };
}

async function checkUploadsSandbox(browser, base, uploadHeaders) {
  const { default: sharp } = await import("sharp");
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#fa6e43" } }).png().toBuffer();
  const payload = `<html><body><p>polyglot</p><script>document.documentElement.setAttribute("data-ran","script");document.title="script ran"</script><img src="x" onerror="document.documentElement.setAttribute('data-ran','handler')"></body></html>`;
  const polyglot = Buffer.concat([png, Buffer.from(payload)]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><script>document.documentElement.setAttribute("data-ran","script")</script><rect width="40" height="30" fill="#fa6e43"/></svg>`;
  const fixtures = {
    [`${PROBE}/photo.png`]: { body: png, type: "image/png", headers: uploadHeaders },
    [`${PROBE}/polyglot.png`]: { body: polyglot, type: "image/png", headers: uploadHeaders },
    [`${PROBE}/polyglot-served-as-html.png`]: { body: polyglot, type: "text/html; charset=utf-8", headers: uploadHeaders },
    [`${PROBE}/drawing.svg`]: { body: Buffer.from(svg), type: "image/svg+xml", headers: uploadHeaders },
    "/__browser-check/polyglot-without-upload-headers.html": { body: polyglot, type: "text/html; charset=utf-8", headers: {} },
  };
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  try {
    const seen = await violations(context);
    for (const [pathname, { body, type, headers }] of Object.entries(fixtures)) {
      await context.route(new URL(pathname, base).href, (route) => route.fulfill({ status: 200, body, headers: { ...headers, "content-type": type } }));
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("/privacy/", base).href, { waitUntil: "load" });
    // Only after React has hydrated <main>: a node added during hydration is a hydration mismatch
    // (React error 418), as on a cold preview. React gives an element its fiber key when it
    // completes that element, right after popHydrationState has checked the element's children
    // (react-dom-client, completeWork), so once <main> carries the key, appending to it is safe.
    await page.waitForFunction(() => {
      const main = document.querySelector("main");
      return Boolean(main) && Object.keys(main).some((key) => key.startsWith("__reactFiber$"));
    }, null, { timeout: 15000 });
    const shown = await page.evaluate(async (src) => {
      const img = document.createElement("img");
      img.alt = "";
      img.src = src;
      document.querySelector("main").append(img);
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    }, `${PROBE}/photo.png`);
    assert.deepEqual(shown, [40, 30], "a site page shows an upload with <img> under the site CSP");
    assert.deepEqual(seen, [], "the site page's CSP allows the upload");
    const opened = async (pathname) => {
      const response = await page.goto(new URL(pathname, base).href, { waitUntil: "load" });
      await page.waitForTimeout(200);
      return { csp: response.headers()[CSP], ...(await page.evaluate(() => ({ type: document.contentType, origin: window.origin, ran: document.documentElement.getAttribute("data-ran"), title: document.title, image: document.images[0]?.naturalWidth ?? null }))) };
    };
    const photo = await opened(`${PROBE}/photo.png`);
    assert.deepEqual([photo.csp, photo.type, photo.origin, photo.image], [UPLOADS_CSP, "image/png", "null", 40], "an upload opened on its own: sandbox CSP, an opaque origin, and the image still shows");
    const runs = {};
    for (const pathname of [`${PROBE}/polyglot.png`, `${PROBE}/polyglot-served-as-html.png`, `${PROBE}/drawing.svg`, `${PROBE}/missing.webp`]) {
      const result = await opened(pathname);
      runs[pathname] = result;
      assert.equal(result.csp, UPLOADS_CSP, `${pathname}: sandbox CSP`);
      assert.equal(result.origin, "null", `${pathname}: sandboxed (opaque origin)`);
      assert.equal(result.ran, null, `${pathname}: no script or event handler runs`);
    }
    assert.equal(runs[`${PROBE}/polyglot-served-as-html.png`].type, "text/html", "the polyglot served as HTML is parsed as HTML (its script is there, and blocked)");
    const missing = await page.evaluate(() => ({ scripts: document.scripts.length, nextRan: "__next_f" in window }));
    assert.ok(missing.scripts > 0 && !missing.nextRan, `${PROBE}/missing.webp: the preview's 404 page has ${missing.scripts} scripts and runs none of them under /uploads/`);
    const control = await opened("/__browser-check/polyglot-without-upload-headers.html");
    assert.notEqual(control.ran, null, "control: without the /uploads/* headers the same polyglot's script runs, so the probe can see a script run");
    assert.deepEqual(errors, [], "no page errors");
    return `uploads sandbox: a site <img> shows an upload (40x30); opened on its own it is a sandboxed image document; an HTML/PNG polyglot (as image/png and as text/html), an SVG with a script and the 404 page with ${missing.scripts} scripts run nothing under /uploads/ (control without those headers: ran "${control.ran}")`;
  } finally {
    await context.close();
  }
}

/** content/ and public/images/ as [path, base64] pairs, for the stand-in repository folder. */
async function repositoryFiles() {
  const files = [];
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(rel);
      else if (entry.isFile()) files.push(rel);
    }
  };
  await walk("content");
  await walk("public/images");
  return files;
}

/**
 * Serves the CMS fonts cache-first from FONT_CACHE (one file per URL, named by its sha256): a font
 * that is not cached yet is fetched once from jsDelivr and stored. Records every font URL requested
 * and, in `failures`, each one that could be neither read from the cache nor fetched.
 */
async function serveFonts(context, requested, failures) {
  const isWoff2 = (body) => body?.subarray(0, 4).toString("latin1") === "wOF2";
  await context.route("https://cdn.jsdelivr.net/fontsource/fonts/**", async (route) => {
    const url = route.request().url();
    const file = path.join(FONT_CACHE, `${sha256(url)}.woff2`);
    let body = await fs.readFile(file).catch(() => null);
    let from = "cache";
    if (!isWoff2(body)) {
      from = "network";
      try {
        const response = await route.fetch();
        if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
        body = await response.body();
        if (!isWoff2(body)) throw new Error("the response is not a WOFF2 font");
        await fs.mkdir(FONT_CACHE, { recursive: true });
        await fs.writeFile(`${file}.${process.pid}.tmp`, body);
        await fs.rename(`${file}.${process.pid}.tmp`, file);
      } catch (error) {
        failures.push(`${url}: ${error.message}`);
        requested.push({ url, from: "failed" });
        return route.abort("internetdisconnected");
      }
    }
    requested.push({ url, from });
    return route.fulfill({ status: 200, contentType: "font/woff2", headers: { "access-control-allow-origin": "*" }, body });
  });
}

/**
 * The /admin/ boot check. `csp` is the policy the page must be served with (a probe that plants a
 * different policy passes its own, to see the font checks fail on it).
 */
export async function checkAdmin(browser, base, { csp = ADMIN_CSP } = {}) {
  const repo = await repositoryFiles();
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
  try {
    const seen = await violations(context);
    const fonts = [], fontFailures = [];
    await serveFonts(context, fonts, fontFailures);
    // The sign-in screen's GitHub status check, answered as githubstatus.com does (CORS-readable JSON).
    // The CSP is enforced before a request reaches a route, so a policy that blocks it still fails.
    const statusChecks = [];
    await context.route(GITHUB_STATUS, (route) => {
      statusChecks.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ status: { indicator: "none", description: "All Systems Operational" } }) });
    });
    // The native folder picker cannot be automated: the stand-in returns the page's Origin Private
    // File System, filled with a copy of the repository files the CMS edits (served from disk to
    // this context only).
    await context.route(new URL("/__browser-check/repo/**", base).href, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/list")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(repo) });
      const rel = url.searchParams.get("path");
      if (!repo.includes(rel)) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: "application/octet-stream", body: await fs.readFile(path.resolve(rel)) });
    });
    await context.addInitScript(() => {
      window.showDirectoryPicker = async () => {
        const root = await navigator.storage.getDirectory();
        if (!window.__repoSeeded) {
          for await (const [name] of root.entries()) await root.removeEntry(name, { recursive: true });
          await root.getDirectoryHandle(".git", { create: true });
          for (const rel of await (await fetch("/__browser-check/repo/list")).json()) {
            const parts = rel.split("/");
            let dir = root;
            for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
            const writable = await (await dir.getFileHandle(parts.at(-1), { create: true })).createWritable();
            await writable.write(await (await fetch(`/__browser-check/repo/file?path=${encodeURIComponent(rel)}`)).arrayBuffer());
            await writable.close();
          }
          window.__repoSeeded = true;
        }
        return root;
      };
    });
    const page = await context.newPage();
    const pageErrors = [], scripts = [], external = [], cspConsole = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => { if (request.resourceType() === "script") scripts.push(request.url()); });
    page.on("response", (response) => {
      const url = response.url();
      if (!url.startsWith(`${base}/`) && !/^(?:data|blob):/.test(url)) external.push(`${response.request().resourceType()} ${url}`);
    });
    // A source the browser cannot parse is dropped with a console message, not a violation event.
    page.on("console", (message) => { if (/Content Security Policy/.test(message.text()) && /invalid|ignored|unrecognized/i.test(message.text())) cspConsole.push(message.text().slice(0, 300)); });
    const response = await page.goto(`${base}/admin/`, { waitUntil: "load" });
    assert.equal(response.headers()[CSP], csp, "/admin/: the admin CSP");
    assert.equal(response.headers()["x-robots-tag"], "noindex, nofollow", "/admin/: X-Robots-Tag noindex");
    const local = page.getByRole("button", { name: "Work with Local Repository" });
    await local.waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    assert.ok((await page.locator('meta[name="robots"]').evaluateAll((nodes) => nodes.map((node) => node.content))).includes("noindex, nofollow"), "/admin/: robots meta noindex, nofollow");
    await page.screenshot({ path: "artifacts/admin.png" });
    await local.click();
    await page.getByText(COLLECTIONS[0], { exact: true }).first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    const listed = await page.getByRole("navigation").first().innerText();
    assert.deepEqual(COLLECTIONS.filter((name) => !listed.includes(name)), [], `/admin/: config.yml's collections are listed (${listed.replace(/\s+/g, " ").slice(0, 300)})`);
    // Every face the bundle declares is loaded now, also one this screen does not use (Noto Mono).
    const icons = await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.allSettled([...document.fonts].map((face) => face.load()));
      const faces = [...document.fonts].map((face) => `${face.family} ${face.status}`);
      const glyphs = [...document.querySelectorAll("body *")]
        .filter((el) => /Material Symbols/.test(getComputedStyle(el).fontFamily) && !el.children.length && el.textContent.trim() && el.getClientRects().length)
        .map((el) => ({ name: el.textContent.trim(), width: Math.round(el.getBoundingClientRect().width), size: parseFloat(getComputedStyle(el).fontSize) }));
      return { faces, glyphs };
    });
    assert.deepEqual(fontFailures, [], `/admin/: the CMS fonts are neither in ${FONT_CACHE}/ nor reachable on jsDelivr (run the check once with network access, or copy ${FONT_CACHE}/ from another checkout)`);
    assert.ok(icons.faces.length >= 3 && icons.faces.every((face) => / loaded$/.test(face)), `/admin/: every font face the bundle declares loads under the admin CSP (${icons.faces.join(", ")}); a font the CSP blocks shows here as "error"`);
    const requested = [...new Set(fonts.map(({ url }) => url))].sort();
    assert.deepEqual(requested, [...ADMIN_FONTS].sort(), "/admin/: the CMS requests exactly the three pinned font files (ADMIN_FONTS)");
    assert.ok(icons.glyphs.length >= 8, `/admin/: icons are on screen (${icons.glyphs.length})`);
    const words = icons.glyphs.filter((icon) => icon.width > icon.size * 1.5);
    assert.deepEqual(words, [], "/admin/: icons render as glyphs, not as their names");
    await page.screenshot({ path: "artifacts/admin-collections.png" });
    const blocked = seen.map(({ entry }) => entry);
    assert.deepEqual(blocked.filter((entry) => !TOLERATED.includes(entry)), [], "/admin/: nothing but the update check is blocked by the admin CSP");
    assert.ok(statusChecks.length > 0, "/admin/: the sign-in screen's GitHub status check is made, and the admin CSP lets it through");
    assert.deepEqual(cspConsole, [], "/admin/: the browser accepts every source in the admin CSP");
    assert.deepEqual(pageErrors, [], "/admin/: no page errors");
    assert.ok(scripts.length > 0 && scripts.every((url) => url.startsWith(`${base}/admin/sveltia/`)), `/admin/: code only from /admin/sveltia/ (${scripts.join(", ")})`);
    assert.deepEqual(external.filter((entry) => !ADMIN_FONTS.some((url) => entry === `font ${url}`) && entry !== `fetch ${GITHUB_STATUS}`), [], "/admin/: nothing from another origin but the three font files and the GitHub status check (the local workflow never calls the GitHub API)");
    const sources = [...new Set(fonts.map(({ from }) => from))].join(" and ");
    return `/admin/: Sveltia CMS ${SVELTIA.version} boots under its own CSP (code from /admin/sveltia/ only: ${scripts.map((url) => url.slice(base.length)).join(", ")}), lists the ${COLLECTIONS.length} collections, loads its ${icons.faces.length} font faces from exactly the ${requested.length} pinned files (from the ${sources}: ${requested.map((url) => url.slice(url.indexOf("/fonts/") + 7)).join(", ")}) and draws ${icons.glyphs.length} icons with the icon font; GitHub status check allowed (${statusChecks.length}x, fixture); blocked by design: ${blocked.length ? [...new Set(blocked)].map((entry) => entry.replace(/^connect-src blocked /, "")).join(", ") : "none"}`;
  } finally {
    await context.close();
  }
}

/** Runs the three checks; returns lines for the browser report. */
export async function cmsChecks(browser, base, routes) {
  const headers = await checkHeaders(base, routes);
  return [headers.line, await checkUploadsSandbox(browser, base, headers.uploadHeaders), await checkAdmin(browser, base)];
}
