import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, HTML_LANG, OG_LOCALE, isLocale, localeOfPath, stripLocale, isSharedPath, localizedHref, switchHref, alternatePaths } = await import("../src/lib/i18n/locales.ts");
const { LocaleProvider, useLocale, useNotFoundPage } = await import("../src/components/LocaleProvider.tsx");

test("two languages, English by default", () => {
  assert.deepEqual([...LOCALES], ["en", "vi"]);
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(LOCALE_COOKIE, "sg_lang");
  assert.deepEqual(HTML_LANG, { en: "en", vi: "vi" });
  assert.deepEqual(OG_LOCALE, { en: "en_US", vi: "vi_VN" });
  assert.ok(isLocale("vi") && isLocale("en"));
  for (const value of ["fr", "VI", "", undefined, null, 1]) assert.equal(isLocale(value), false, String(value));
});

test("a path is Vietnamese only under /vi", () => {
  for (const path of ["/vi", "/vi/", "/vi/about/", "/vi/services/applied-ai/"]) assert.equal(localeOfPath(path), "vi", path);
  for (const path of ["/", "/about/", "/video/", "/vietnam/", "/services/"]) assert.equal(localeOfPath(path), "en", path);
  assert.equal(stripLocale("/vi"), "/");
  assert.equal(stripLocale("/vi/"), "/");
  assert.equal(stripLocale("/vi/services/applied-ai/"), "/services/applied-ai/");
  assert.equal(stripLocale("/about/"), "/about/");
});

test("localizedHref moves site links into a language and leaves everything else alone", () => {
  const cases = [
    ["/", "vi", "/vi/"], ["/about/", "vi", "/vi/about/"], ["/#pricing", "vi", "/vi/#pricing"],
    ["/contact/?service=applied-ai", "vi", "/vi/contact/?service=applied-ai"], ["/vi/about/", "en", "/about/"],
    ["/vi/about/", "vi", "/vi/about/"], ["/about/", "en", "/about/"], ["/labs/rss.xml", "vi", "/vi/labs/rss.xml"],
    ["https://github.com/x", "vi", "https://github.com/x"], ["#top", "vi", "#top"], ["mailto:a@b.co", "vi", "mailto:a@b.co"],
    ["tel:+84386749799", "vi", "tel:+84386749799"], ["//evil.example/", "vi", "//evil.example/"],
    ["/images/a.webp", "vi", "/images/a.webp"], ["/uploads/a.jpg", "vi", "/uploads/a.jpg"], ["/_next/static/x.js", "vi", "/_next/static/x.js"],
    ["/admin/", "vi", "/admin/"], ["/api/contact", "vi", "/api/contact"], ["/sitemap.xml", "vi", "/sitemap.xml"], ["/llms.txt", "vi", "/llms.txt"],
  ];
  for (const [href, locale, expected] of cases) assert.equal(localizedHref(href, locale), expected, `${href} in ${locale}`);
  for (const path of ["/images/a.webp", "/textures/earth/2k/day.webp", "/seo/og.png", "/favicon.ico", "/robots.txt"]) assert.ok(isSharedPath(path), path);
  for (const path of ["/", "/about/", "/labs/rss.xml", "/vi/"]) assert.ok(!isSharedPath(path), path);
});

test("the switch always links the English path with ?lang=", () => {
  assert.equal(switchHref("/about/", "vi"), "/about/?lang=vi");
  assert.equal(switchHref("/vi/about/", "en"), "/about/?lang=en");
  assert.equal(switchHref("/vi", "en"), "/?lang=en");
  assert.equal(switchHref("/services/applied-ai", "vi"), "/services/applied-ai/?lang=vi");
  assert.deepEqual(alternatePaths("/vi/about/"), { en: "/about/", vi: "/vi/about/" });
});

test("useLocale reads the provider, English and not the 404 by default", () => {
  const Probe = () => React.createElement("span", null, `${useLocale()}:${useNotFoundPage()}`);
  assert.equal(renderToStaticMarkup(React.createElement(Probe)), "<span>en:false</span>");
  assert.equal(renderToStaticMarkup(React.createElement(LocaleProvider, { locale: "vi" }, React.createElement(Probe))), "<span>vi:false</span>");
  assert.equal(renderToStaticMarkup(React.createElement(LocaleProvider, { locale: "en", notFound: true }, React.createElement(Probe))), "<span>en:true</span>");
});
