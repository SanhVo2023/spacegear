import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { handleLocale, prefersVietnamese, cookieLocale, countryOf, TEST_COUNTRY_HEADER } = await import("../worker/locale.ts");

// The pages the asset store has, for the twin checks.
const PAGES = new Set(["/", "/about/", "/contact/", "/vi/", "/vi/about/", "/vi/contact/", "/labs/only-english/"]);
const ASSETS = { fetch: async (request) => new Response(null, { status: PAGES.has(new URL(request.url).pathname) ? 200 : 404 }) };
const PRODUCTION = { ASSETS, SITE_ORIGIN: "https://spacegear.tech", LOCALE_TEST_HEADER: "false" };
const PREVIEW = { ASSETS, SITE_ORIGIN: "http://localhost:8787", LOCALE_TEST_HEADER: "true" };
function navigation(path, { headers = {}, cf, method = "GET" } = {}) {
  const request = new Request(new URL(path, "https://spacegear.tech"), { method, headers });
  if (cf) Object.defineProperty(request, "cf", { value: cf });
  return request;
}

test("a first visit from Vietnam goes to the Vietnamese twin, query kept, never cached, no cookie", async () => {
  const response = await handleLocale(navigation("/about/?utm_source=google&utm_medium=organic", { cf: { country: "VN" } }), PRODUCTION);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/vi/about/?utm_source=google&utm_medium=organic");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("vary"), "Cookie, Accept-Language");
  assert.equal(response.headers.get("set-cookie"), null);
  const head = await handleLocale(navigation("/", { cf: { country: "VN" }, method: "HEAD" }), PRODUCTION);
  assert.equal(head.headers.get("location"), "/vi/");
  const bare = await handleLocale(navigation("/contact", { cf: { country: "VN" } }), PRODUCTION);
  assert.equal(bare.headers.get("location"), "/vi/contact/", "the twin gets its trailing slash");
});

test("only a first Accept-Language entry of vi or vi-* counts", async () => {
  assert.ok(prefersVietnamese("vi") && prefersVietnamese("vi-VN,vi;q=0.9,en;q=0.8") && prefersVietnamese(" VI-vn ;q=1"));
  for (const header of ["en-US,en;q=0.9,vi;q=0.8", "*", "", null, "vietnamese", "fr-VI"]) assert.equal(prefersVietnamese(header), false, String(header));
  const response = await handleLocale(navigation("/about/", { headers: { "accept-language": "vi-VN,vi;q=0.9" }, cf: { country: "US" } }), PRODUCTION);
  assert.equal(response.headers.get("location"), "/vi/about/");
});

test("no redirect with a cookie, from another country, for other methods, without a twin, on shared or Vietnamese paths", async () => {
  const vn = { country: "VN" };
  const cases = [
    navigation("/about/", { cf: vn, headers: { cookie: "a=1; sg_lang=en" } }),
    navigation("/about/", { cf: vn, headers: { cookie: "sg_lang=vi" } }),
    navigation("/about/", { cf: { country: "SG" }, headers: { "accept-language": "en-GB" } }),
    navigation("/about/", { cf: vn, method: "POST" }),
    navigation("/labs/only-english/", { cf: vn }),
    navigation("/no-such-page/", { cf: vn }),
    navigation("/vi", { cf: vn }),
    navigation("/admin", { cf: vn }),
    navigation("/api/contact", { cf: vn }),
    navigation("/sitemap.xml", { cf: vn }),
  ];
  for (const request of cases) assert.equal(await handleLocale(request, PRODUCTION), null, `${request.method} ${new URL(request.url).pathname} ${request.headers.get("cookie") ?? ""}`);
  assert.equal(cookieLocale("x=1; sg_lang=vi; y=2"), "vi");
  assert.equal(cookieLocale("sg_lang=fr"), undefined);
  assert.equal(cookieLocale(null), undefined);
});

test("?lang= stores the choice for a year and redirects to the clean page in that language", async () => {
  const toVi = await handleLocale(navigation("/about/?lang=vi&utm_source=x"), PRODUCTION);
  assert.equal(toVi.status, 302);
  assert.equal(toVi.headers.get("location"), "/vi/about/?utm_source=x");
  assert.equal(toVi.headers.get("set-cookie"), "sg_lang=vi; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
  assert.equal(toVi.headers.get("cache-control"), "no-store");
  const toEn = await handleLocale(navigation("/about/?lang=en", { cf: { country: "VN" } }), PRODUCTION);
  assert.equal(toEn.headers.get("location"), "/about/");
  assert.equal(toEn.headers.get("set-cookie"), "sg_lang=en; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
  const noTwin = await handleLocale(navigation("/labs/only-english/?lang=vi"), PRODUCTION);
  assert.equal(noTwin.headers.get("location"), "/vi/", "a page without a twin falls back to the language's home page");
  assert.equal(await handleLocale(navigation("/about/?lang=fr"), PRODUCTION), null, "an unknown language is ignored");
});

test("the preview ignores request.cf and reads the test header, only on a localhost origin", async () => {
  assert.equal(await handleLocale(navigation("/about/", { cf: { country: "VN" } }), PREVIEW), null, "the cached cf.json says VN; the preview ignores it");
  const header = await handleLocale(navigation("/about/", { headers: { [TEST_COUNTRY_HEADER]: "vn" } }), PREVIEW);
  assert.equal(header.headers.get("location"), "/vi/about/");
  assert.equal(await handleLocale(navigation("/about/", { headers: { [TEST_COUNTRY_HEADER]: "VN" }, cf: { country: "US" } }), PRODUCTION), null, "production never reads the header");
  assert.equal(countryOf(navigation("/", { headers: { [TEST_COUNTRY_HEADER]: "VN" } }), { SITE_ORIGIN: "https://spacegear.tech", LOCALE_TEST_HEADER: "true" }), undefined, "the flag alone is not enough off localhost");
});

test("the language cookie is Secure everywhere but a plain-http loopback preview", async () => {
  const local = await handleLocale(new Request("http://127.0.0.1:8792/about/?lang=vi"), PREVIEW);
  assert.equal(local.headers.get("location"), "/vi/about/");
  assert.equal(local.headers.get("set-cookie"), "sg_lang=vi; Path=/; Max-Age=31536000; SameSite=Lax", "a browser may drop a Secure cookie on http://127.0.0.1");
  const plain = await handleLocale(new Request("http://spacegear.tech/about/?lang=vi"), PRODUCTION);
  assert.match(plain.headers.get("set-cookie"), /; Secure$/, "any other host keeps Secure, even over http");
});

test("wrangler.jsonc sends only HTML navigations to the Worker, and only the preview honours the test header", () => {
  const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
  const rules = config.assets.run_worker_first;
  // The asset router's matcher (miniflare router.worker.js, rules-engine): negative rules first, "*" is ".*", anchored.
  const glob = (rule) => new RegExp(`^${rule.split("*").map((part) => part.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join(".*")}$`);
  const toWorker = (path) => !rules.filter((rule) => rule.startsWith("!")).some((rule) => glob(rule.slice(1)).test(path)) && rules.filter((rule) => !rule.startsWith("!")).some((rule) => glob(rule).test(path));
  for (const path of ["/", "/about/", "/services/applied-ai/", "/contact", "/vi", "/api/contact", "/api/auth/callback", "/labs/a-post/"]) assert.ok(toWorker(path), `${path} runs the Worker first`);
  for (const path of ["/vi/", "/vi/about/", "/_next/static/chunks/a.js", "/images/galaxy.webp", "/textures/earth/2k/day.webp", "/uploads/a.jpg", "/admin/", "/admin/config.yml", "/sitemap.xml", "/robots.txt", "/favicon.ico", "/manifest.webmanifest", "/labs/rss.xml", "/vi/labs/rss.xml", "/llms.txt", "/404.html"]) assert.ok(!toWorker(path), `${path} goes straight to assets`);
  assert.equal(config.vars.LOCALE_TEST_HEADER, "true");
  assert.equal(config.env.production.vars.LOCALE_TEST_HEADER, "false");
});
