// Browser checks for the CMS (showcase Part 3, Task 10), run by scripts/browser-check.mjs against
// the running preview:
// 1. Headers. Every sitemap route serves exactly the site CSP; /admin/ and its files serve the admin
//    CSP alone and X-Robots-Tag "noindex, nofollow" once; anything under /uploads/ serves the sandbox
//    CSP and nosniff once. Every response must also carry exactly the security headers that
//    scripts/lib/headers.mjs computes from dist/_headers, so the simulation check-export relies on is
//    held against the real asset worker.
// 2. The uploads sandbox in Chromium. An upload is fixture bytes served under /uploads/ with the
//    headers the preview sends there (nothing is planted in public/ or dist/): a site page shows it
//    with <img>; opened on its own it is a sandboxed image document; an HTML/PNG polyglot, also
//    served as HTML, and an SVG with a script run nothing, while the same polyglot without those
//    headers does run (so the probe can see a script run). The preview's own 404 page, which has
//    scripts, runs none of them under /uploads/.
// 3. /admin/. The vendored Sveltia CMS boots under its CSP with no page error and loads code only
//    from /admin/sveltia/ (byte-identical to the pins in scripts/vendor-sveltia.mjs). Exactly two
//    optional requests may be blocked, matched by their whole URL (Task 9 review): the update check
//    on unpkg.com and the GitHub status check on the github-backend sign-in screen (inside try/catch
//    in 0.230.1; no setting turns it off). Then "Work with Local Repository" opens a copy of content/
//    and public/images/ (an Origin Private File System folder stands in for the native folder
//    picker; nothing on disk is written): the eight collections from config.yml are listed and the
//    icons render with the Material Symbols font from jsDelivr, not as words.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOADS_CSP, headersFor, parseHeaders, sitePaths } from "./lib/headers.mjs";
import { SVELTIA } from "./vendor-sveltia.mjs";

const CSP = "content-security-policy";
const SECURITY_HEADERS = [CSP, "x-robots-tag", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"];
const TOLERATED = ["connect-src blocked https://unpkg.com/@sveltia/cms/package.json", "connect-src blocked https://www.githubstatus.com/api/v2/status.json"];
const COLLECTIONS = ["Site and sections", "Services", "Engagements", "Questions & Answers", "Team disciplines", "Testimonials", "Articles", "Legal pages"];
const PROBE = "/uploads/__browser-check";
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
  const site = rules.find((rule) => rule.path === "/*")?.set[CSP];
  const admin = rules.find((rule) => rule.path === "/admin/*")?.set[CSP];
  assert.ok(site && admin && site !== admin, "dist/_headers defines the site CSP and a separate /admin/* CSP");
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
  assert.equal(files.length, 5, `dist/admin/ ships the page (served as /admin/), config.yml and three Sveltia files (${files.join(", ")})`);
  for (const pathname of files) {
    const response = await served(pathname, 200);
    assert.equal(response.headers.get(CSP), admin, `${pathname}: the admin CSP alone, instead of the site's`);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow", `${pathname}: noindex over HTTP, once`);
    if (pathname.startsWith("/admin/sveltia/")) assert.equal(sha256(Buffer.from(await response.arrayBuffer())), SVELTIA.files[pathname.slice("/admin/sveltia/".length)], `${pathname}: the pinned bytes`);
    if (pathname === "/admin/") assert.match(await response.text(), /<meta name="robots" content="noindex/, "/admin/ is noindex in its HTML");
  }
  const uploads = [`${PROBE}/missing.webp`, ...sitePaths("dist").filter((pathname) => pathname.startsWith("/uploads/"))];
  for (const pathname of uploads) {
    const response = await served(pathname, pathname.startsWith(PROBE) ? 404 : 200);
    assert.equal(response.headers.get(CSP), UPLOADS_CSP, `${pathname}: the sandbox CSP alone`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${pathname}: nosniff, once`);
  }
  const probe = await fetch(new URL(`${PROBE}/missing.webp`, base));
  const uploadHeaders = Object.fromEntries(SECURITY_HEADERS.filter((name) => probe.headers.has(name)).map((name) => [name, probe.headers.get(name)]));
  return { site, admin, uploadHeaders, line: `headers: ${routes.length} routes and a chunk serve exactly the site CSP; ${files.length} /admin/ files the admin CSP and noindex; ${uploads.length} /uploads/ path(s) the sandbox CSP and nosniff; all as dist/_headers gives them` };
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

async function checkAdmin(browser, base, adminCsp) {
  const repo = await repositoryFiles();
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
  try {
    const seen = await violations(context);
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
    const pageErrors = [], scripts = [], external = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => { if (request.resourceType() === "script") scripts.push(request.url()); });
    page.on("response", (response) => {
      const url = response.url();
      if (!url.startsWith(`${base}/`) && !/^(?:data|blob):/.test(url)) external.push(`${response.request().resourceType()} ${url}`);
    });
    const response = await page.goto(`${base}/admin/`, { waitUntil: "load" });
    assert.equal(response.headers()[CSP], adminCsp, "/admin/: the admin CSP");
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
    const icons = await page.evaluate(async () => {
      await document.fonts.ready;
      const faces = [...document.fonts].filter((face) => /Material Symbols/.test(face.family)).map((face) => `${face.family} ${face.status}`);
      const glyphs = [...document.querySelectorAll("body *")]
        .filter((el) => /Material Symbols/.test(getComputedStyle(el).fontFamily) && !el.children.length && el.textContent.trim() && el.getClientRects().length)
        .map((el) => ({ name: el.textContent.trim(), width: Math.round(el.getBoundingClientRect().width), size: parseFloat(getComputedStyle(el).fontSize) }));
      return { faces, glyphs };
    });
    assert.ok(icons.faces.some((face) => / loaded$/.test(face)), `/admin/: the Material Symbols icon font loads from jsDelivr under the admin CSP (${icons.faces.join(", ") || "no such font face"}); a failure here may also mean jsDelivr is unreachable`);
    assert.ok(icons.glyphs.length >= 8, `/admin/: icons are on screen (${icons.glyphs.length})`);
    const words = icons.glyphs.filter((icon) => icon.width > icon.size * 1.5);
    assert.deepEqual(words, [], "/admin/: icons render as glyphs, not as their names");
    await page.screenshot({ path: "artifacts/admin-collections.png" });
    const blocked = seen.map(({ entry }) => entry);
    assert.deepEqual(blocked.filter((entry) => !TOLERATED.includes(entry)), [], "/admin/: nothing but the two optional requests is blocked by the admin CSP");
    assert.deepEqual(pageErrors, [], "/admin/: no page errors");
    assert.ok(scripts.length > 0 && scripts.every((url) => url.startsWith(`${base}/admin/sveltia/`)), `/admin/: code only from /admin/sveltia/ (${scripts.join(", ")})`);
    assert.deepEqual(external.filter((entry) => !entry.startsWith("font https://cdn.jsdelivr.net/fontsource/")), [], "/admin/: nothing from another origin but Fontsource fonts");
    return `/admin/: Sveltia CMS ${SVELTIA.version} boots under its own CSP (code from /admin/sveltia/ only: ${scripts.map((url) => url.slice(base.length)).join(", ")}), lists the ${COLLECTIONS.length} collections and draws ${icons.glyphs.length} icons with the icon font; blocked by design: ${blocked.length ? [...new Set(blocked)].map((entry) => entry.replace(/^connect-src blocked /, "")).join(", ") : "none"}`;
  } finally {
    await context.close();
  }
}

/** Runs the three checks; returns lines for the browser report. */
export async function cmsChecks(browser, base, routes) {
  const headers = await checkHeaders(base, routes);
  return [headers.line, await checkUploadsSandbox(browser, base, headers.uploadHeaders), await checkAdmin(browser, base, headers.admin)];
}
