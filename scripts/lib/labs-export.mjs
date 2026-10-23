// The Labs pages in an export (Labs Task 6, Part 3). /labs/ and /vi/labs/ exist only for a language that has a
// published article (next.config.ts adds that language's route extensions from labsLocales()).
// - package-site ships out/labs/ as a whole when it exists (its pages and its feed); /vi/labs/ ships inside vi/.
//   labsPages() names the pages for their 301s.
// - check-export compares dist/ with the published articles (publishedArticles() in src/lib/labs-files.ts).
//   labsLocales() never throws: if reading the articles failed while next.config.ts loaded, it answered [] and the
//   build exported no Labs page at all. Only this comparison turns that silent loss into a failed build.
// Dependency-free, so tests and both scripts can load it. A language's hreflang code is its locale (HTML_LANG,
// tests/labs-export.test.mjs).
import fs from "node:fs";
import path from "node:path";

/** Where each language's Labs pages are, in out/ and in dist/. */
export const LABS_DIRS = { en: "labs", vi: "vi/labs" };
const NAMES = { en: "English", vi: "Vietnamese" };
const route = (page) => `/${page}/`;
const isFile = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;

/**
 * The Labs pages a folder holds: each language's index ("labs") and its articles ("labs/<slug>"), each a folder with
 * an index.html. Next's segment folders (__next.!KGVuKQ and the like) have none, so they are not pages.
 */
export function labsPages(root) {
  return Object.values(LABS_DIRS).flatMap((dir) => {
    const full = path.join(root, dir);
    if (!fs.statSync(full, { throwIfNoEntry: false })?.isDirectory()) return [];
    const articles = fs.readdirSync(full, { withFileTypes: true }).filter((entry) => entry.isDirectory() && isFile(path.join(full, entry.name, "index.html"))).map((entry) => `${dir}/${entry.name}`);
    return [...(isFile(path.join(full, "index.html")) ? [dir] : []), ...articles.sort()];
  });
}

/** The versions of a Labs page that exist, as hreflang → path, x-default being the English one. */
function versions(paths) {
  return { ...paths, ...(paths.en ? { "x-default": paths.en } : {}) };
}
const sorted = (object) => JSON.stringify(Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : 1))));

/**
 * What is wrong with the Labs pages, feeds and sitemap entries in an export, given each language's published
 * articles ({ slug, file }, newest first). Each page: one H1, a canonical to itself, its language. Each index: its
 * RSS 2.0 feed with one item per article. The sitemap: each Labs page exactly once, naming exactly the versions that
 * exist (x-default only with an English one), and no other Labs page.
 */
export function labsExportProblems(root, published) {
  const problems = [];
  const present = labsPages(root);
  const expected = new Map();
  const languages = Object.keys(LABS_DIRS);
  const indexes = languages.filter((locale) => published[locale].length > 0);
  const index = versions(Object.fromEntries(indexes.map((locale) => [locale, route(LABS_DIRS[locale])])));
  for (const locale of languages) {
    const dir = LABS_DIRS[locale], name = NAMES[locale], articles = published[locale];
    const pages = present.filter((page) => page === dir || page.startsWith(`${dir}/`));
    if (articles.length) expected.set(route(dir), index);
    for (const { slug } of articles) expected.set(route(`${dir}/${slug}`), versions(Object.fromEntries(languages.filter((other) => published[other].some((item) => item.slug === slug)).map((other) => [other, route(`${LABS_DIRS[other]}/${slug}`)]))));
    if (articles.length && !pages.includes(dir)) problems.push(`Missing Labs page ${route(dir)}: ${name} has ${articles.length} published article${articles.length === 1 ? "" : "s"}, so its Labs index must ship`);
    for (const { slug, file } of articles) if (!pages.includes(`${dir}/${slug}`)) problems.push(`Missing Labs page ${route(`${dir}/${slug}`)}: ${file} is published, so its page must ship`);
    for (const page of pages) {
      if (page === dir && !articles.length) problems.push(`Unexpected Labs page ${route(page)}: ${name} has no published article, so no ${name} Labs page may ship`);
      const slug = page.slice(dir.length + 1);
      if (page !== dir && !articles.some((item) => item.slug === slug)) problems.push(`Unexpected Labs page ${route(page)}: no ${name} article "${slug}" is published`);
    }
    for (const page of pages) {
      const html = fs.readFileSync(path.join(root, page, "index.html"), "utf8");
      const h1 = (html.match(/<h1(?:\s|>)/g) || []).length;
      if (h1 !== 1) problems.push(`H1 count: ${route(page)} has ${h1}`);
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
      if (!canonical || !URL.canParse(canonical) || new URL(canonical).pathname !== route(page)) problems.push(`No canonical to itself: ${route(page)}`);
      if (!html.includes(`<html lang="${locale}"`)) problems.push(`html lang is not ${locale}: ${route(page)}`);
    }
    const feedFile = path.join(root, dir, "rss.xml");
    const hasIndex = pages.includes(dir), hasFeed = isFile(feedFile);
    if (!articles.length) {
      if (hasFeed) problems.push(`Unexpected Labs feed /${dir}/rss.xml: ${name} has no published article`);
      continue;
    }
    if (hasIndex !== hasFeed) problems.push(`${dir}: the index and rss.xml ship together (index ${hasIndex}, feed ${hasFeed})`);
    if (!hasFeed) continue;
    const feed = fs.readFileSync(feedFile, "utf8");
    if (!feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>') || !feed.includes('<rss version="2.0"')) problems.push(`/${dir}/rss.xml is not an RSS 2.0 document`);
    const items = (feed.match(/<item>/g) || []).length;
    if (items !== articles.length) problems.push(`/${dir}/rss.xml has ${items} item${items === 1 ? "" : "s"} for ${articles.length} published article${articles.length === 1 ? "" : "s"}`);
  }
  const sitemapFile = path.join(root, "sitemap.xml");
  if (!isFile(sitemapFile)) return [...problems, "Missing sitemap.xml"];
  const seen = new Set();
  for (const entry of fs.readFileSync(sitemapFile, "utf8").split("<url>").slice(1)) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const where = loc && URL.canParse(loc) ? new URL(loc).pathname : "";
    if (!/^\/(?:vi\/)?labs\//.test(where)) continue;
    if (seen.has(where)) { problems.push(`Sitemap lists ${where} more than once`); continue; }
    seen.add(where);
    if (!expected.has(where)) { problems.push(`Sitemap lists ${where}, which is not a published Labs page`); continue; }
    const named = Object.fromEntries([...entry.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(([, lang, href]) => [lang, URL.canParse(href) ? new URL(href).pathname : href]));
    if (sorted(named) !== sorted(expected.get(where))) problems.push(`Sitemap entry ${where} names ${sorted(named)}; expected ${sorted(expected.get(where))} (the versions that exist, x-default only with an English one)`);
  }
  for (const where of expected.keys()) if (!seen.has(where)) problems.push(`Missing sitemap entry for ${where}`);
  return problems;
}
