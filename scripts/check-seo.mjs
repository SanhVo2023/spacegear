import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { launchBrowser } from "./browser-runtime.mjs";

/** A TypeScript module: native under --experimental-strip-types, else through tsx (npm run check:seo is plain node). */
async function importTs(path) {
  const url = new URL(path, import.meta.url).href;
  try {
    return await import(url);
  } catch (error) {
    if (error?.code !== "ERR_UNKNOWN_FILE_EXTENSION") throw error;
    const { tsImport } = await import("tsx/esm/api");
    return tsImport(url, import.meta.url);
  }
}
const base = process.argv[2] || "http://127.0.0.1:8787";
const production = process.argv.includes("--production");
const canonicalOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://spacegear.tech";
const sitemapResponse = await fetch(`${base}/sitemap.xml`);
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
// Labs (Part 3): /labs/... and /vi/labs/... exist only for a language with a published article. The sitemap holds the
// 24 core pages plus exactly the Labs index and articles this checkout publishes (src/lib/labs.ts), per language.
const LABS = /^\/(?:vi\/)?labs\//;
const core = routes.filter(route => !LABS.test(route));
assert.equal(core.length, 24, "core sitemap route count (12 pages in English and Vietnamese)");
const { labsRoutes } = await importTs("../src/lib/labs.ts");
const published = labsRoutes().map(route => route.path);
assert.deepEqual(routes.filter(route => LABS.test(route)).sort(), [...published].sort(), "the sitemap lists exactly the published Labs pages");
assert.equal(new Set(routes).size, routes.length);
const browser = await launchBrowser();
const page = await browser.newPage({ javaScriptEnabled: false });
const titles = new Set(), descriptions = new Set(), links = new Set(), assets = new Set(), report = [];
// Both languages: every English page has a Vietnamese twin under /vi/, and each names the other (hreflang).
const LOCALE_OF = route => route === "/vi/" || route.startsWith("/vi/") ? "vi" : "en";
const versions = new Map();
try {
  for (const route of routes) {
    const response = await page.goto(new URL(route, base).href);
    assert.equal(response.status(), 200, route);
    const data = await page.evaluate(() => ({
      title: document.title,
      descriptions: [...document.querySelectorAll('meta[name="description"]')].map(el => el.content),
      canonicals: [...document.querySelectorAll('link[rel="canonical"]')].map(el => el.href),
      robots: document.querySelector('meta[name="robots"]')?.content || "",
      h1: [...document.querySelectorAll("h1")].map(el => el.textContent),
      text: document.querySelector("main")?.innerText || "",
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map(el => JSON.parse(el.textContent)),
      links: [...document.querySelectorAll('a[href]')].map(el => el.getAttribute("href")),
      images: [...document.images].map(el => ({ src: el.getAttribute("src"), alt: el.getAttribute("alt") })),
      og: document.querySelector('meta[property="og:image"]')?.content,
      lang: document.documentElement.lang,
      hreflang: Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(el => [el.hreflang, el.href])),
      hreflangCount: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
      ogLocale: [...document.querySelectorAll('meta[property="og:locale"]')].map(el => el.content),
      ogAlternate: [...document.querySelectorAll('meta[property="og:locale:alternate"]')].map(el => el.content),
      robotsCount: document.querySelectorAll('meta[name="robots"]').length,
    }));
    assert.equal(data.h1.length, 1, `${route}: one H1`);
    assert.ok(await page.locator("h1").isVisible(), `${route}: visible without JavaScript`);
    assert.equal(data.canonicals.length, 1, `${route}: one canonical`);
    assert.equal(data.canonicals[0], new URL(route, canonicalOrigin).href);
    assert.equal(data.descriptions.length, 1);
    // An article's description is its summary, which check-content keeps at 50 characters or more (src/lib/labs-files.ts).
    assert.ok(data.descriptions[0].length >= 50, `${route}: a description of at least 50 characters`);
    assert.ok(!titles.has(data.title), `${route}: distinct title`);
    assert.ok(!descriptions.has(data.descriptions[0]), `${route}: distinct description`);
    titles.add(data.title); descriptions.add(data.descriptions[0]);
    assert.ok(data.jsonLd.length > 0);
    assert.ok(!/numberOfEmployees|aggregateRating|reviewCount/.test(JSON.stringify(data.jsonLd)));
    assert.ok(!/hello@platform\.nl|Platform B\.V\.|Book a Demo|Trusted by 1,000/i.test(data.text));
    assert.equal(data.robots.includes("noindex"), !production, `${route}: publication mode`);
    assert.equal((response.headers()["x-robots-tag"] || "").includes("noindex"), !production, `${route}: HTTP publication mode`);
    // The language switch (?lang=) is followed with its query: the Worker sends it to the page's twin, or to the
    // language's home when a Labs article has no twin, so its bare path may not exist.
    for (const href of data.links) if (href?.startsWith("/") && !href.startsWith("//")) { const url = new URL(href, base); links.add(/[?&]lang=(?:en|vi)\b/.test(url.search) ? url.pathname + url.search : url.pathname); }
    for (const image of data.images) { assert.notEqual(image.alt, null, `${route}: image alt`); assets.add(image.src); }
    assert.ok(data.og); assets.add(new URL(data.og).pathname);
    assert.equal(data.robotsCount, 1, `${route}: one robots meta tag`);
    const locale = LOCALE_OF(route);
    const english = locale === "vi" ? route.replace(/^\/vi\//, "/") : route;
    const vietnamese = locale === "vi" ? route : `/vi${route}`;
    // A core page has both versions; a Labs page names only the versions that exist, and x-default only when one
    // of them is English.
    const isLabs = LABS.test(route);
    assert.equal(data.lang, locale, `${route}: <html lang="${locale}">`);
    assert.equal(data.hreflangCount, Object.keys(data.hreflang).length, `${route}: one hreflang link per language`);
    if (!isLabs) assert.deepEqual(data.hreflang, { en: new URL(english, canonicalOrigin).href, vi: new URL(vietnamese, canonicalOrigin).href, "x-default": new URL(english, canonicalOrigin).href }, `${route}: hreflang names both versions and x-default (English)`);
    else for (const [language, href] of Object.entries(data.hreflang)) if (language !== "x-default") assert.equal(href, new URL(language === "vi" ? vietnamese : english, canonicalOrigin).href, `${route}: hreflang ${language} is the ${language} address of this article`);
    assert.equal(data.hreflang[locale], data.canonicals[0], `${route}: its own hreflang is its canonical`);
    if (data.hreflang.en) assert.equal(data.hreflang["x-default"], data.hreflang.en, `${route}: x-default is the English version`);
    else assert.equal(data.hreflang["x-default"], undefined, `${route}: no x-default without an English version`);
    versions.set(route, JSON.stringify(data.hreflang));
    assert.deepEqual(data.ogLocale, [locale === "vi" ? "vi_VN" : "en_US"], `${route}: og:locale`);
    const others = Object.keys(data.hreflang).filter(language => language !== locale && language !== "x-default");
    assert.deepEqual(data.ogAlternate, others.map(language => (language === "vi" ? "vi_VN" : "en_US")), `${route}: og:locale:alternate names the other version${isLabs ? ", when there is one" : ""}`);
    const graph = data.jsonLd.flatMap(block => block["@graph"] ?? [block]);
    const organization = graph.find(node => node["@type"] === "Organization");
    assert.ok(organization && organization.name === "spacegear" && organization.alternateName === "spacegear.tech" && organization.telephone === "+84386749799" && organization.address?.addressCountry === "VN" && !organization.address.postalCode, `${route}: Organization "spacegear" with the owner's address and phone`);
    assert.equal(organization.address.addressLocality, locale === "vi" ? "Thành phố Hồ Chí Minh" : "Ho Chi Minh City", `${route}: the address in the page's language`);
    const website = graph.find(node => node["@type"] === "WebSite");
    assert.equal(website?.inLanguage, locale, `${route}: WebSite inLanguage`);
    assert.equal(website.url, new URL(locale === "vi" ? "/vi/" : "/", canonicalOrigin).href, `${route}: WebSite of its language`);
    const webPage = graph.find(node => node["@type"] === "WebPage");
    assert.ok(webPage && webPage.url === data.canonicals[0] && webPage.inLanguage === locale && webPage.name === data.title && webPage.isPartOf?.["@id"] === website["@id"], `${route}: WebPage with its canonical, title and language, inside its WebSite`);
    report.push({ route, title: data.title, status: response.status(), schemaBlocks: data.jsonLd.length });
  }
  // Every version a page names is in the sitemap and names the same versions back.
  for (const [route, links] of versions) {
    for (const href of Object.values(JSON.parse(links))) {
      const twin = new URL(href).pathname;
      assert.ok(versions.has(twin), `${route}: its version ${twin} is in the sitemap`);
      assert.equal(versions.get(twin), links, `${route} and ${twin} name each other the same way`);
    }
  }
  // The sitemap lists every page with its alternates (xhtml:link): exactly the versions its page names, so both
  // languages and x-default for a core page.
  for (const entry of sitemap.split("<url>").slice(1)) {
    const where = new URL(entry.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "/", canonicalOrigin).pathname;
    const alternates = Object.fromEntries([...entry.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(m => [m[1], m[2]]));
    if (!LABS.test(where)) assert.deepEqual(Object.keys(alternates).sort(), ["en", "vi", "x-default"], `sitemap alternates for ${where}`);
    assert.deepEqual(alternates, JSON.parse(versions.get(where)), `sitemap alternates for ${where} are its page's hreflang links`);
  }
  // >>> CMS (showcase Part 3): /admin/ is for editors only: never in the sitemap, never linked, always noindex.
  // robots.txt does not disallow it on purpose: a crawler must fetch /admin/ to see its noindex.
  assert.ok(!routes.some(route => route.startsWith("/admin")), "the sitemap must not list /admin/");
  assert.ok(![...links].some(link => link.startsWith("/admin")), "no page may link to /admin/");
  const admin = await fetch(new URL("/admin/", base));
  assert.equal(admin.status, 200, "/admin/ is served");
  assert.equal(admin.headers.get("x-robots-tag"), "noindex, nofollow", "/admin/ sends X-Robots-Tag: noindex, nofollow (once) in every publication mode");
  assert.match(await admin.text(), /<meta name="robots" content="noindex/, "/admin/ carries a robots noindex meta tag");
  // <<< CMS
  for (const path of [...links, ...assets]) assert.equal((await fetch(new URL(path, base))).status, 200, `broken resource ${path}`);
  // Unknown /labs/* returns 404, and so do the Labs index and feed of a language without articles.
  for (const index of ["/labs/", "/vi/labs/"]) if (!routes.includes(index)) assert.equal((await fetch(new URL(index, base))).status, 404, `${index} does not exist without articles in its language`);
  for (const [index, feed] of [["/labs/", "/labs/rss.xml"], ["/vi/labs/", "/vi/labs/rss.xml"]]) {
    const response = await fetch(new URL(feed, base));
    assert.equal(response.status, routes.includes(index) ? 200 : 404, `${feed} exists exactly when ${index} does`);
    if (response.ok) assert.equal(response.headers.get("content-type"), "application/rss+xml; charset=utf-8", `${feed} is served as RSS (public/_headers)`);
  }
  const llms = await fetch(new URL("/llms.txt", base));
  assert.equal(llms.status, 200, "/llms.txt is served");
  const llmsText = await llms.text();
  for (const route of routes) if (/\/labs\/[^/]+\/$/.test(route) || route === "/" || route === "/vi/") assert.ok(llmsText.includes(`](${new URL(route, canonicalOrigin).href})`), `/llms.txt lists ${route}`);
  for (const route of ["/unknown-page/", "/vi/unknown-page/", "/labs/no-such-article/", "/vi/labs/no-such-article/", "/labs/old-demo/", "/vi/labs/old-demo/", "/work/old-demo/", "/api/unknown"]) {
    const response = await fetch(new URL(route, base));
    assert.equal(response.status, 404, `missing route ${route}`);
    if (route.startsWith("/api/")) continue;
    // The one bilingual 404: Next's own noindex is its only robots tag, and it names no canonical or language versions.
    const html = await response.text();
    assert.deepEqual([...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map(m => m[1]), ["noindex"], `${route}: one robots tag (noindex)`);
    assert.ok(!/<link rel="(?:canonical|alternate)"/.test(html), `${route}: no canonical or hreflang on the 404`);
  }
  const redirect = await fetch(`${base}/services`, { redirect: "manual" });
  assert.ok([301, 308].includes(redirect.status));
  assert.equal(new URL(redirect.headers.get("location"), base).pathname, "/services/");
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  assert.equal(/^Disallow: \/$/m.test(robots), !production);
  assert.ok(robots.includes(`${canonicalOrigin}/sitemap.xml`));
  await fs.mkdir("artifacts", { recursive: true });
  await fs.writeFile("artifacts/seo-report.json", JSON.stringify({ testedAt: new Date().toISOString(), base, mode: production ? "production" : "preview", routes: report, links: links.size, assets: assets.size }, null, 2));
  const labs = report.filter(({ route }) => LABS.test(route)).length;
  console.log(`SEO crawl passed: ${report.length} pages in English and Vietnamese (${core.length} core, ${labs} Labs), hreflang both ways, ${links.size} internal paths, ${assets.size} images, no-JS content, feeds and llms.txt, 404s (unknown /labs/* included) and canonical redirect.`);
} finally { await browser.close(); }
