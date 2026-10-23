// Task 10: how Cloudflare applies public/_headers (scripts/lib/headers.mjs), checked against
// wrangler's and the asset worker's own code (tests/helpers/wrangler-headers.mjs), and what the CMS
// rules must give each path.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ADMIN_CSP, ADMIN_HEADERS, UPLOADS_CSP, UPLOADS_HEADERS, headerProblems, headersFor, parseHeaders, sitePaths } from "../scripts/lib/headers.mjs";
import { wranglerHeaders, workerHeaders } from "./helpers/wrangler-headers.mjs";

const HEADERS = fs.readFileSync("public/_headers", "utf8");
// What package-site writes for a preview: X-Robots-Tag inside the existing /* rule.
const PREVIEW = HEADERS.replace(/^\/\*(\r?\n)/m, (rule, eol) => `${rule}  X-Robots-Tag: noindex, nofollow${eol}`);
const CSP = "content-security-policy";
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-headers-"));
/** The reader's rules in wrangler's constructHeaders form: { path: { set?, unset? } }. */
const asConfigured = (rules) => Object.fromEntries(rules.map(({ path: rulePath, set, unset }) => [rulePath, { ...(Object.keys(set).length ? { set } : {}), ...(unset.length ? { unset } : {}) }]));

const EDGES = [
  "# comment",
  "X-Before: a header before any path",
  "/a/*/b/*",
  "  X: two wildcards",
  "  X-Skipped: skipped until the next path",
  "/c/:splat/*",
  "  X: wildcard and :splat",
  "http://example.org/",
  "  Y: not https",
  "/ok",
  "  Z: 1",
  "  no colon",
  "  ! Unset-Me",
  "  Bad Name: v",
  "  Empty:",
  "  : no name",
  "https://h.example:8080/x",
  "  Q: a port",
  "https://h.example/a/../b/*",
  "  R: host rule",
  "/a b/../c/*?query#hash",
  "  S: normalized",
  "/empty",
  "/:a/:a/*",
  "  D: a placeholder name twice",
  "/ünï/*",
  "  U: encoded",
  "/%41dmin/*",
  "  P: percent",
  "/ok",
  "  Z: 2",
  "/x//y/*",
  "  W: double slash",
  "/long/*",
  `  X-Long: ${"x".repeat(2001)}`,
  "  X-Short: kept",
  "/ph/:name/deep",
  "  C: placeholder :name",
  "/s/*",
  "  X-S: got :splat",
].join("\r\n");
const MANY = Array.from({ length: 102 }, (_, index) => `/r${index}/*\n  X-N: ${index}`).join("\n");
const SYNTH = "/*\n  X-A: site\n  Cache-Control: from-site-rule\n/order/*\n  X-A: order\n/both/*\n  ! x-a\n  X-A: both\n  x-a: again\n/dup/*\n  X-B: first\n/rm/*\n  ! X-A\n/dup/*\n  X-B: last\n/after/*\n  X-D: d1\n/after/x/*\n  ! X-D\n/after/x/y/*\n  X-D: d3\n";
const CORPUS = { "public/_headers": HEADERS, preview: PREVIEW, edges: EDGES, "102 rules": MANY, synthetic: SYNTH };
const PATHS = ["/", "/ok", "/ok/", "/c/x", "/b/x", "/a/b/x", "/x/y/z", "/x//y/z", "/ünï/q", "/%41dmin/x", "/Admin/x", "/q/q/x", "/ph/a/deep", "/ph/a/b/deep", "/ph/a/deep/more", "/s/one/two", "/long/x", "/r5/x", "/r101/x",
  "/order/x", "/both/x", "/dup/x", "/rm/x", "/after/x/y/z", "/after/x/z", "/after/q",
  "/admin", "/admin/", "/admin/config.yml", "/administrator/", "/uploads", "/uploads/", "/uploads/x.webp", "/_next/static/chunks/a.js", "/api/contact"];

test("the reader agrees with wrangler's own _headers parser", () => {
  for (const [name, text] of Object.entries(CORPUS)) {
    const mine = parseHeaders(text);
    const real = wranglerHeaders(text);
    assert.deepEqual(asConfigured(mine.rules), real.rules, `${name}: the same rules, in the same order`);
    assert.deepEqual(Object.keys(asConfigured(mine.rules)), Object.keys(real.rules), `${name}: rule order`);
    assert.deepEqual(mine.invalid.map(({ message }) => message), real.invalid, `${name}: the same lines refused, with wrangler's messages`);
  }
  assert.ok(wranglerHeaders(EDGES).invalid.length >= 8 && Object.keys(wranglerHeaders(EDGES).rules).includes("/c/*"), "the corpus exercises refused paths and normalisation");
});

test("the reader's details: invalid paths skip their headers, paths are normalised, a repeated path is noted", () => {
  const { rules, invalid, notes } = parseHeaders(EDGES);
  assert.deepEqual(rules.map((rule) => rule.path), ["/ok", "https://h.example/b/*", "/c/*", "/:a/:a/*", "/%C3%BCn%C3%AF/*", "/%41dmin/*", "/x//y/*", "/long/*", "/ph/:name/deep", "/s/*"]);
  assert.deepEqual(rules[0], { path: "/ok", set: { z: "2" }, unset: [] }, "the last /ok rule's headers, in the first one's place");
  assert.deepEqual(rules.find((rule) => rule.path === "/long/*").set, { "x-short": "kept" }, "a line over 2,000 characters is dropped");
  assert.ok(!rules.some((rule) => "x-skipped" in rule.set), "after a refused path, its headers are skipped");
  assert.deepEqual(invalid.find(({ message }) => message.startsWith("Only one wildcard")).line, 3);
  assert.deepEqual(notes.map(({ line, message }) => [line, message]), [[30, "/ok appears twice; Cloudflare keeps only the last one"]]);
  const first = parseHeaders("/*\n  X-One: a\nX-Two: b: c\n  x-one: again\n").rules[0];
  assert.deepEqual(first.set, { "x-one": "a, again", "x-two": "b: c" }, "names are lowercased, a repeated name is joined with a comma, indentation does not matter");
});

test("headersFor gives exactly what the asset worker attaches, on every path of the corpus", () => {
  for (const [name, text] of Object.entries(CORPUS)) {
    const { rules } = parseHeaders(text);
    const { configuration } = wranglerHeaders(text);
    for (const raw of PATHS) {
      const pathname = new URL(raw, "https://example.com").pathname;
      assert.deepEqual(headersFor(rules, pathname), workerHeaders(configuration, pathname), `${name} ${pathname}`);
    }
  }
});

test("every matching rule applies in file order, as in Cloudflare's asset worker", () => {
  const { rules } = parseHeaders("/*\n  A: site\n  B: site\n/x/*\n  ! A\n  A: x\n  B: x\n/x/:name/deep\n  C: placeholder\n");
  assert.deepEqual(headersFor(rules, "/"), { a: "site", b: "site" });
  assert.deepEqual(headersFor(rules, "/x/"), { a: "x", b: "site, x" }, "a removed header is set again once; a header set by two rules is joined, so a browser would enforce both CSPs");
  assert.deepEqual(headersFor(rules, "/x"), { a: "site", b: "site" }, "/x/* needs the slash");
  assert.deepEqual(headersFor(rules, "/x/one/deep"), { a: "x", b: "site, x", c: "placeholder" });
  assert.equal(headersFor(rules, "/x/one/two/deep").c, undefined, "a placeholder is one segment");
  assert.equal(headersFor(rules, "/x/one/deep/more").c, undefined, "a rule is anchored at both ends");
  assert.deepEqual(headersFor(rules, "/y/", { b: "asset" }), { a: "site", b: "site" }, "the first rule to set a header replaces the asset's own value");
});

test("the pinned CMS policies", () => {
  const directives = Object.fromEntries(ADMIN_CSP.split(";").map((part) => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));
  assert.deepEqual(directives["script-src"], ["'self'"]);
  assert.deepEqual(directives["connect-src"], ["'self'", "blob:", "data:", "https://api.github.com", "https://www.githubstatus.com"]);
  assert.deepEqual(directives["img-src"], ["'self'", "data:", "blob:", "https://avatars.githubusercontent.com"]);
  assert.deepEqual(directives["font-src"].slice(1).map((url) => url.replace(/^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\//, "")), ["material-symbols-outlined:vf@5.3.8/latin-wght-normal.woff2", "noto-mono@5.3.0/latin-400-normal.woff2", "source-sans-3:vf@5.3.0/latin-wght-normal.woff2"], "three exact font files, not a folder");
  assert.deepEqual(ADMIN_HEADERS, { [CSP]: ADMIN_CSP, "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff", "x-frame-options": "DENY" });
  assert.deepEqual(UPLOADS_HEADERS, { [CSP]: UPLOADS_CSP, "x-content-type-options": "nosniff", "x-frame-options": "DENY" });
});

test("/admin/ and /uploads/ get exactly their pinned headers; every other path keeps exactly the site CSP", () => {
  for (const text of [HEADERS, PREVIEW]) {
    const { rules, invalid } = parseHeaders(text);
    assert.deepEqual(invalid, []);
    const site = rules.find((rule) => rule.path === "/*").set;
    assert.equal(rules.find((rule) => rule.path === "/admin/*").set[CSP], ADMIN_CSP, "public/_headers carries ADMIN_CSP");
    for (const pathname of ["/", "/privacy/", "/services/applied-ai/", "/404.html", "/_next/static/chunks/x.js", "/images/faq-team.webp", "/administrator/", "/admin", "/uploads", "/api/contact"]) {
      assert.equal(headersFor(rules, pathname)[CSP], site[CSP], `${pathname}: exactly the site CSP`);
      assert.equal(headersFor(rules, pathname)["x-content-type-options"], "nosniff", `${pathname}: nosniff`);
    }
    for (const pathname of ["/admin/", "/admin/index.html", "/admin/config.yml", "/admin/sveltia/sveltia-cms.js", "/admin/sveltia/chunks/react-dom.js"]) {
      assert.deepEqual(headersFor(rules, pathname), { ...site, ...ADMIN_HEADERS }, `${pathname}: the admin headers, each once, and the site's other headers`);
    }
    for (const pathname of ["/uploads/x.webp", "/uploads/team/photo.jpg", "/uploads/team/photo.jpg.w640.webp", "/uploads/"]) {
      assert.deepEqual(headersFor(rules, pathname), { ...site, ...UPLOADS_HEADERS }, `${pathname}: the uploads headers, each once, and the site's other headers`);
    }
    assert.equal(headersFor(rules, "/_next/static/chunks/x.js")["cache-control"], "public, max-age=31536000, immutable");
  }
});

test("the header check names a CMS header that leaks, goes missing, loosens or comes too early", () => {
  assert.deepEqual(headerProblems(PREVIEW, ["/", "/admin/", "/uploads/x.webp"]), []);
  assert.deepEqual(headerProblems(HEADERS, ["/", "/admin/", "/uploads/x.webp"]), [], "production (no X-Robots-Tag on /*)");
  // The checkout may use CRLF (core.autocrlf), so a swap never spans a line break.
  const swap = (from, to) => { const text = PREVIEW.replace(from, to); assert.notEqual(text, PREVIEW, String(from)); return text; };
  const ADMIN_WRONG = /^\/admin\/, \/admin\/config\.yml get Content-Security-Policy ".+", not ADMIN_CSP \(scripts\/lib\/headers\.mjs\)$/;
  const cases = [
    ["a site path's CSP widened", `${PREVIEW}\n/privacy/*\n  Content-Security-Policy: img-src *\n`, /^\/privacy\/ gets Content-Security-Policy ".*, img-src \*" instead of exactly the site policy \(\/\*\)$/],
    ["the admin rule renamed", swap(/^\/admin\/\*(?=\r?$)/m, "/admin/"), /^_headers has no \/admin\/\* rule$/],
    ["the admin CSP line deleted", swap(/^ {2}Content-Security-Policy: default-src 'self'; script-src 'self';.*\r?\n/m, ""), /^\/admin\/, \/admin\/config\.yml get Content-Security-Policy nothing, not ADMIN_CSP \(scripts\/lib\/headers\.mjs\)$/],
    ["admin form-action dropped", swap(/base-uri 'self'; form-action 'self'; frame-ancestors 'none'(?=\r?\n {2}X-Robots-Tag)/, "base-uri 'self'; frame-ancestors 'none'"), ADMIN_WRONG],
    ["admin worker-src blob: added", swap("manifest-src 'self' blob:;", "manifest-src 'self' blob:; worker-src blob:;"), ADMIN_WRONG],
    ["admin font-src widened to jsDelivr", swap(/font-src 'self' https:[^;]*;/, "font-src 'self' https://cdn.jsdelivr.net;"), ADMIN_WRONG],
    ["admin default-src widened", swap("Content-Security-Policy: default-src 'self'; script-src 'self';", "Content-Security-Policy: default-src 'self' https://cdn.jsdelivr.net; script-src 'self';"), ADMIN_WRONG],
    ["admin connect-src for unpkg", swap("connect-src 'self' blob: data:", "connect-src 'self' blob: data: https://unpkg.com"), ADMIN_WRONG],
    ["admin X-Robots-Tag doubled", swap("! X-Robots-Tag", "# ! X-Robots-Tag"), /^\/admin\/, \/admin\/config\.yml get X-Robots-Tag "noindex, nofollow, noindex, nofollow", not "noindex, nofollow"$/],
    ["admin X-Frame-Options dropped", swap("  ! X-Robots-Tag", "  ! X-Robots-Tag\n  ! X-Frame-Options"), /^\/admin\/, \/admin\/config\.yml get X-Frame-Options nothing, not "DENY"$/],
    ["uploads sandbox loosened", swap("style-src 'unsafe-inline'; sandbox", "style-src 'unsafe-inline'; sandbox allow-scripts"), /^\/uploads\/folder\/probe\.jpg\.w640\.webp, \/uploads\/probe\.webp, \/uploads\/x\.webp get Content-Security-Policy "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox allow-scripts", not UPLOADS_CSP \(scripts\/lib\/headers\.mjs\)$/],
    ["uploads nosniff doubled", swap("! X-Content-Type-Options", "# ! X-Content-Type-Options"), /^\/uploads\/folder\/probe\.jpg\.w640\.webp, \/uploads\/probe\.webp, \/uploads\/x\.webp get X-Content-Type-Options "nosniff, nosniff", not "nosniff"$/],
    ["uploads X-Frame-Options dropped", swap("  ! X-Content-Type-Options", "  ! X-Content-Type-Options\n  ! X-Frame-Options"), /^\/uploads\/folder\/probe\.jpg\.w640\.webp, \/uploads\/probe\.webp, \/uploads\/x\.webp get X-Frame-Options nothing, not "DENY"$/],
    ["uploads Referrer-Policy dropped", swap("  ! X-Content-Type-Options", "  ! X-Content-Type-Options\n  ! Referrer-Policy"), /^\/uploads\/.* get Referrer-Policy nothing, not "strict-origin-when-cross-origin"$/],
    ["no /* CSP", `${PREVIEW.replace(/^\/\*\r?\n/m, "/x/*\n")}`, /^_headers has no \/\* rule with a Content-Security-Policy$/],
    ["admin rule before /*", `/admin/*\n  X: y\n${PREVIEW}`, /^\/admin\/\* comes before \/\*, so the site CSP would not be removed$/],
    ["a stray line", `${PREVIEW}\n  stray line\n`, /^_headers line \d+: Expected a colon-separated header pair \(e\.g\. name: value\)\. Cloudflare ignores it\.$/],
    ["a rule with two wildcards", `${PREVIEW}\n/admin/*/x/*\n  X-Frame-Options: SAMEORIGIN\n`, /^_headers line \d+: Only one wildcard is allowed per rule\..* Cloudflare ignores it\.$/],
    ["a rule for one host", `${PREVIEW}\nhttps://spacegear.tech/admin/*\n  X-Frame-Options: SAMEORIGIN\n`, /^_headers rule https:\/\/spacegear\.tech\/admin\/\* applies to one host only, which this check does not simulate$/],
    ["a rule the worker cannot compile", `${PREVIEW}\n/:a/:a/*\n  X-A: 1\n`, /^_headers rule \/:a\/:a\/\* cannot be compiled by Cloudflare's asset worker \(a placeholder name used twice\?\), so it never applies$/],
    ["a repeated path", `${PREVIEW}\n/api/*\n  X-A: 1\n`, /^_headers line \d+: \/api\/\* appears twice; Cloudflare keeps only the last one$/],
  ];
  for (const [name, text, expected] of cases) {
    const problems = headerProblems(text, ["/", "/admin/", "/uploads/x.webp", "/privacy/"]);
    assert.ok(problems.some((problem) => expected.test(problem)), `${name}: ${expected}\n${problems.join("\n")}`);
  }
  const many = headerProblems(`${PREVIEW}\n/_next/*\n  Content-Security-Policy: img-src *\n`, ["/_next/a.js", "/_next/b.js", "/_next/c.js", "/_next/d.js", "/_next/e.js"]);
  assert.deepEqual(many.map((problem) => problem.replace(/"[^"]*"/, '"…"')), ['/_next/a.js, /_next/b.js, /_next/c.js and 3 more paths get Content-Security-Policy "…" instead of exactly the site policy (/*)'], "the same fault on many paths is one problem");
});

test("sitePaths lists every shipped file as a URL path, and each folder page by its folder", () => {
  const root = tempDir();
  try {
    for (const rel of ["index.html", "privacy/index.html", "_next/static/chunks/a.js", "admin/index.html", "admin/sveltia/sveltia-cms.js", "_headers"]) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), "x");
    }
    assert.deepEqual(sitePaths(root), ["/", "/_headers", "/_next/static/chunks/a.js", "/admin/", "/admin/index.html", "/admin/sveltia/sveltia-cms.js", "/index.html", "/privacy/", "/privacy/index.html"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
