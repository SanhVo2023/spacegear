// Task 10: how Cloudflare applies public/_headers (scripts/lib/headers.mjs), and what the CMS rules
// in it must give each path.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UPLOADS_CSP, headerProblems, headersFor, parseHeaders, sitePaths } from "../scripts/lib/headers.mjs";

const HEADERS = fs.readFileSync("public/_headers", "utf8");
// What package-site writes for a preview: X-Robots-Tag inside the existing /* rule.
const PREVIEW = HEADERS.replace(/^\/\*(\r?\n)/m, (rule, eol) => `${rule}  X-Robots-Tag: noindex, nofollow${eol}`);
const CSP = "content-security-policy";
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-headers-"));

test("the header reader follows wrangler's _headers parser", () => {
  const { rules, invalid } = parseHeaders([
    "# a comment",
    "/*",
    "  X-One: a",
    "X-Two: b: c",
    "  x-one: again",
    "",
    "/empty/*",
    "/admin/*",
    "  ! X-One",
    "  X-Robots-Tag: noindex",
    "  no colon here",
    "Path: before",
    "/*",
    "  X-Three: replaced in place",
  ].join("\r\n"));
  assert.deepEqual(rules.map((rule) => rule.path), ["/*", "/admin/*"], "a rule with nothing in it is dropped; a repeated path replaces the earlier rule in place");
  assert.deepEqual(rules[0].set, { "x-three": "replaced in place" });
  assert.deepEqual(rules[1], { path: "/admin/*", set: { "x-robots-tag": "noindex", path: "before" }, unset: ["X-One"] });
  assert.deepEqual(invalid.map(({ line, message }) => [line, message]), [
    [7, "No headers specified"],
    [11, "Expected a colon-separated header pair (e.g. name: value)"],
    [13, "/* appears twice; Cloudflare keeps only the last one"],
  ]);
  const first = parseHeaders("/*\n  X-One: a\nX-Two: b: c\n  x-one: again\n").rules[0];
  assert.deepEqual(first.set, { "x-one": "a, again", "x-two": "b: c" }, "names are lowercased, a repeated name is joined with a comma, indentation does not matter");
});

test("every matching rule applies in file order, as in Cloudflare's asset worker", () => {
  const { rules } = parseHeaders("/*\n  A: site\n  B: site\n/x/*\n  ! A\n  A: x\n  B: x\n/x/:name/deep\n  C: placeholder\n");
  assert.deepEqual(headersFor(rules, "/"), { a: "site", b: "site" });
  assert.deepEqual(headersFor(rules, "/x/"), { a: "x", b: "site, x" }, "a removed header is set again once; a header set by two rules is joined, so a browser would enforce both CSPs");
  assert.deepEqual(headersFor(rules, "/x"), { a: "site", b: "site" }, "/x/* needs the slash");
  assert.deepEqual(headersFor(rules, "/x/one/deep"), { a: "x", b: "site, x", c: "placeholder" });
  assert.deepEqual(headersFor(rules, "/x/one/two/deep").c, undefined, "a placeholder is one segment");
  assert.deepEqual(headersFor(rules, "/y/", { b: "asset" }), { a: "site", b: "site" }, "the first rule to set a header replaces the asset's own value");
});

test("/admin/ and /uploads/ get their own policies; every other path keeps exactly the site CSP", () => {
  for (const text of [HEADERS, PREVIEW]) {
    const { rules, invalid } = parseHeaders(text);
    assert.deepEqual(invalid, []);
    const site = rules.find((rule) => rule.path === "/*").set[CSP];
    const admin = rules.find((rule) => rule.path === "/admin/*").set[CSP];
    for (const pathname of ["/", "/privacy/", "/services/applied-ai/", "/404.html", "/_next/static/chunks/x.js", "/images/faq-team.webp", "/administrator/", "/admin", "/uploads", "/api/contact"]) {
      assert.equal(headersFor(rules, pathname)[CSP], site, `${pathname}: exactly the site CSP`);
      assert.equal(headersFor(rules, pathname)["x-content-type-options"], "nosniff", `${pathname}: nosniff`);
    }
    for (const pathname of ["/admin/", "/admin/index.html", "/admin/config.yml", "/admin/sveltia/sveltia-cms.js", "/admin/sveltia/chunks/react-dom.js"]) {
      const headers = headersFor(rules, pathname);
      assert.equal(headers[CSP], admin, `${pathname}: the admin CSP alone`);
      assert.equal(headers["x-robots-tag"], "noindex, nofollow", `${pathname}: noindex once, also when the preview adds it to /*`);
      assert.equal(headers["x-frame-options"], "DENY");
    }
    for (const pathname of ["/uploads/x.webp", "/uploads/team/photo.jpg", "/uploads/team/photo.jpg.w640.webp", "/uploads/"]) {
      const headers = headersFor(rules, pathname);
      assert.equal(headers[CSP], UPLOADS_CSP, `${pathname}: the sandbox CSP alone`);
      assert.equal(headers["x-content-type-options"], "nosniff", `${pathname}: nosniff once`);
      assert.equal(headers["x-frame-options"], "DENY");
    }
    assert.equal(headersFor(rules, "/_next/static/chunks/x.js")["cache-control"], "public, max-age=31536000, immutable");
  }
});

test("the header check names a CMS policy that leaks, goes missing or comes too early", () => {
  assert.deepEqual(headerProblems(PREVIEW, ["/", "/admin/", "/uploads/x.webp"]), []);
  // The checkout may use CRLF (core.autocrlf), so a swap never spans a line break.
  const swap = (from, to) => { const text = PREVIEW.replace(from, to); assert.notEqual(text, PREVIEW, String(from)); return text; };
  const cases = [
    [`${PREVIEW}\n/privacy/*\n  Content-Security-Policy: img-src *\n`, /^\/privacy\/ gets Content-Security-Policy ".*, img-src \*" instead of exactly the site policy \(\/\*\)$/],
    [swap(/^\/admin\/\*(?=\r?$)/m, "/admin/"),/_headers has no \/admin\/\* rule/],
    [swap("! X-Robots-Tag", "# ! X-Robots-Tag"), /^\/admin\/, \/admin\/config\.yml get X-Robots-Tag "noindex, nofollow, noindex, nofollow", not "noindex, nofollow"$/],
    [swap("style-src 'unsafe-inline'; sandbox", "style-src 'unsafe-inline'; sandbox allow-scripts"), /^\/uploads\/folder\/probe\.jpg\.w640\.webp, \/uploads\/probe\.webp, \/uploads\/x\.webp get Content-Security-Policy "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox allow-scripts", not the \/uploads\/\* sandbox policy/],
    [swap("! X-Content-Type-Options", "# ! X-Content-Type-Options"), /^\/uploads\/folder\/probe\.jpg\.w640\.webp, \/uploads\/probe\.webp, \/uploads\/x\.webp get X-Content-Type-Options "nosniff, nosniff", not "nosniff"$/],
    [swap("connect-src 'self' blob: data:", "connect-src 'self' blob: data: https://unpkg.com"), /the \/admin\/\* CSP must keep connect-src to 'self' blob: data:/],
    [swap("script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' https://cdn", "script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' https://cdn"), /the \/admin\/\* CSP must keep script-src to 'self'/],
    [`${PREVIEW.replace(/^\/\*\r?\n/m, "/x/*\n")}`, /_headers has no \/\* rule with a Content-Security-Policy/],
    [`/admin/*\n  X: y\n${PREVIEW}`, /^\/admin\/\* comes before \/\*, so the site CSP would not be removed$/m],
    [`${PREVIEW}\n  stray line\n`, /^_headers line \d+: Expected a colon-separated header pair/],
  ];
  for (const [text, expected] of cases) {
    const problems = headerProblems(text, ["/", "/admin/", "/uploads/x.webp", "/privacy/"]);
    assert.ok(problems.some((problem) => expected.test(problem)), `${expected}\n${problems.join("\n")}`);
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
