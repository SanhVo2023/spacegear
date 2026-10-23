// Labs Task 6 (Part 3): the sitemap lists the Labs pages with the language versions that exist, package-site ships
// them, and check-export compares what was exported with the published articles (scripts/lib/labs-export.mjs).
// labsLocales() answers [] rather than throw, so a build that lost its Labs routes would otherwise pass in silence.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LABS_DIRS, labsExportProblems, labsPages } from "../scripts/lib/labs-export.mjs";

const { default: sitemap } = await import("../src/app/sitemap.ts");
const { HTML_LANG, LOCALES } = await import("../src/lib/i18n/locales.ts");

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-labs-export-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}
const remove = (root) => fs.rmSync(root, { recursive: true, force: true });
const md = (title, body, date = "2026-10-20") => `---\ntitle: ${JSON.stringify(title)}\nsummary: ${JSON.stringify(title ? "A short summary of the article." : "")}\ncover: /uploads/cover.jpg\ncoverAlt: ${JSON.stringify(title ? "A cover" : "")}\ndate: ${date}\nupdated: ""\nauthor: "Lan Nguyen"\n---\n\n${body}\n`;
const ARTICLES = {
  "content/articles/both.md": md("Both languages", "## Start\n\nText."),
  "content/vi/articles/both.md": md("Cả hai ngôn ngữ", "## Mở đầu\n\nNội dung."),
  "content/articles/english.md": md("English only", "## Only\n\nText.", "2026-10-22"),
  "content/articles/vietnamese.md": md("", "", "2026-10-21"),
  "content/vi/articles/vietnamese.md": md("Chỉ tiếng Việt", "## Riêng\n\nNội dung.", "2026-10-21"),
};
const pathsOf = (languages) => Object.fromEntries(Object.entries(languages).map(([lang, href]) => [lang, new URL(href).pathname]));

// sitemap() reads the articles of the folder it runs in (labsRoutes()), so each case runs in its own project folder.
test("the sitemap lists every Labs page with only the language versions that exist, x-default only with an English one", () => {
  const empty = project({ "content/articles/.gitkeep": "", "content/vi/articles/.gitkeep": "" });
  const root = project(ARTICLES);
  const cwd = process.cwd();
  try {
    process.chdir(empty);
    const core = sitemap();
    assert.equal(core.length, 24, "no article, so the 24 core pages only");
    assert.ok(!core.some((entry) => entry.url.includes("/labs/")));
    process.chdir(root);
    const entries = sitemap();
    assert.deepEqual(entries.slice(0, 24), core, "the core pages come first, unchanged");
    const labs = Object.fromEntries(entries.slice(24).map((entry) => [new URL(entry.url).pathname, pathsOf(entry.alternates.languages)]));
    const index = { en: "/labs/", vi: "/vi/labs/", "x-default": "/labs/" };
    const both = { en: "/labs/both/", vi: "/vi/labs/both/", "x-default": "/labs/both/" };
    assert.deepEqual(labs, {
      "/labs/": index, "/labs/english/": { en: "/labs/english/", "x-default": "/labs/english/" }, "/labs/both/": both,
      "/vi/labs/": index, "/vi/labs/vietnamese/": { vi: "/vi/labs/vietnamese/" }, "/vi/labs/both/": both,
    });
    assert.equal(entries.length, 30);
  } finally { process.chdir(cwd); remove(empty); remove(root); }
});

test("the Labs folders are the languages' own (hreflang codes are the locales)", () => {
  assert.deepEqual(Object.keys(LABS_DIRS), [...LOCALES]);
  for (const locale of LOCALES) assert.equal(HTML_LANG[locale], locale);
  assert.deepEqual(LABS_DIRS, { en: "labs", vi: "vi/labs" });
});

test("labsPages: each language's index and its article folders, never Next's __next segment folders", () => {
  const root = project({
    "labs/index.html": "x", "labs/rss.xml": "x", "labs/__next.!KGVuKQ/labs.txt": "x", "labs/b/index.html": "x", "labs/a/index.html": "x",
    "labs/a/__next.!KGVuKQ/labs/a.txt": "x", "labs/no-page/index.txt": "x", "vi/labs/index.html": "x", "vi/labs/a/index.html": "x", "vi/labs/__next.!KHZpKQ/x.txt": "x",
  });
  const empty = project({ "index.html": "x", "vi/index.html": "x" });
  try {
    assert.deepEqual(labsPages(root), ["labs", "labs/a", "labs/b", "vi/labs", "vi/labs/a"]);
    assert.deepEqual(labsPages(empty), [], "no article, no Labs folder");
  } finally { remove(root); remove(empty); }
});

// An export of the ARTICLES fixture as check-export sees it in dist/.
const PUBLISHED = {
  en: [{ slug: "english", file: "content/articles/english.md" }, { slug: "both", file: "content/articles/both.md" }],
  vi: [{ slug: "vietnamese", file: "content/vi/articles/vietnamese.md" }, { slug: "both", file: "content/vi/articles/both.md" }],
};
const ORIGIN = "https://spacegear.tech";
const html = (lang, route, { h1 = 1, canonical = route } = {}) => `<!DOCTYPE html><html lang="${lang}" class="antialiased"><head><link rel="canonical" href="${ORIGIN}${canonical}"/></head><body>${"<h1>Title</h1>".repeat(h1)}</body></html>`;
const feed = (items) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>${"<item><title>x</title></item>".repeat(items)}</channel></rss>\n`;
const entry = (route, languages) => `<url>\n<loc>${ORIGIN}${route}</loc>\n${Object.entries(languages).map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${ORIGIN}${href}" />\n`).join("")}</url>\n`;
const INDEX = { en: "/labs/", vi: "/vi/labs/", "x-default": "/labs/" };
const BOTH = { en: "/labs/both/", vi: "/vi/labs/both/", "x-default": "/labs/both/" };
const CORE = entry("/", { en: "/", vi: "/vi/", "x-default": "/" }) + entry("/vi/", { en: "/", vi: "/vi/", "x-default": "/" });
const LABS_ENTRIES = {
  "/labs/": INDEX, "/labs/english/": { en: "/labs/english/", "x-default": "/labs/english/" }, "/labs/both/": BOTH,
  "/vi/labs/": INDEX, "/vi/labs/vietnamese/": { vi: "/vi/labs/vietnamese/" }, "/vi/labs/both/": BOTH,
};
const sitemapXml = (entries = LABS_ENTRIES, extra = "") => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${CORE}${Object.entries(entries).map(([route, languages]) => entry(route, languages)).join("")}${extra}</urlset>\n`;
function goodExport() {
  return {
    "index.html": html("en", "/"), "vi/index.html": html("vi", "/vi/"),
    "labs/index.html": html("en", "/labs/"), "labs/rss.xml": feed(2), "labs/__next.!KGVuKQ/labs.txt": "x",
    "labs/english/index.html": html("en", "/labs/english/"), "labs/both/index.html": html("en", "/labs/both/"),
    "vi/labs/index.html": html("vi", "/vi/labs/"), "vi/labs/rss.xml": feed(2), "vi/labs/__next.!KHZpKQ/labs.txt": "x",
    "vi/labs/vietnamese/index.html": html("vi", "/vi/labs/vietnamese/"), "vi/labs/both/index.html": html("vi", "/vi/labs/both/"),
    "sitemap.xml": sitemapXml(),
  };
}
const problemsOf = (files, published = PUBLISHED) => {
  const root = project(files);
  try { return labsExportProblems(root, published); } finally { remove(root); }
};

test("check-export: an export that matches the published articles passes, and one with no article has no Labs page at all", () => {
  assert.deepEqual(problemsOf(goodExport()), []);
  assert.deepEqual(problemsOf({ "index.html": html("en", "/"), "sitemap.xml": sitemapXml({}) }, { en: [], vi: [] }), []);
});

test("check-export: published articles whose pages did not export fail (the silent empty labsLocales() case)", () => {
  // next.config.ts read no language (labsLocales() answered []): no Labs route was built, the sitemap lists none.
  assert.deepEqual(problemsOf({ "index.html": html("en", "/"), "sitemap.xml": sitemapXml({}) }), [
    "Missing Labs page /labs/: English has 2 published articles, so its Labs index must ship",
    "Missing Labs page /labs/english/: content/articles/english.md is published, so its page must ship",
    "Missing Labs page /labs/both/: content/articles/both.md is published, so its page must ship",
    "Missing Labs page /vi/labs/: Vietnamese has 2 published articles, so its Labs index must ship",
    "Missing Labs page /vi/labs/vietnamese/: content/vi/articles/vietnamese.md is published, so its page must ship",
    "Missing Labs page /vi/labs/both/: content/vi/articles/both.md is published, so its page must ship",
    "Missing sitemap entry for /labs/",
    "Missing sitemap entry for /labs/english/",
    "Missing sitemap entry for /labs/both/",
    "Missing sitemap entry for /vi/labs/",
    "Missing sitemap entry for /vi/labs/vietnamese/",
    "Missing sitemap entry for /vi/labs/both/",
  ]);
  // One article lost in one language: only it is named.
  const files = goodExport();
  delete files["vi/labs/both/index.html"];
  files["vi/labs/both/index.txt"] = "x";
  assert.deepEqual(problemsOf(files), ["Missing Labs page /vi/labs/both/: content/vi/articles/both.md is published, so its page must ship"]);
});

test("check-export: Labs pages without a published article fail, in a language with none and in one with others", () => {
  const files = goodExport();
  files["labs/old/index.html"] = html("en", "/labs/old/");
  const viEmpty = { en: PUBLISHED.en, vi: [] };
  const viEntries = { "/labs/": { en: "/labs/", "x-default": "/labs/" }, "/labs/english/": LABS_ENTRIES["/labs/english/"], "/labs/both/": { en: "/labs/both/", "x-default": "/labs/both/" } };
  assert.deepEqual(problemsOf({ ...files, "sitemap.xml": sitemapXml(viEntries), "labs/rss.xml": feed(2) }, viEmpty), [
    "Unexpected Labs page /labs/old/: no English article \"old\" is published",
    "Unexpected Labs page /vi/labs/: Vietnamese has no published article, so no Vietnamese Labs page may ship",
    "Unexpected Labs page /vi/labs/both/: no Vietnamese article \"both\" is published",
    "Unexpected Labs page /vi/labs/vietnamese/: no Vietnamese article \"vietnamese\" is published",
    "Unexpected Labs feed /vi/labs/rss.xml: Vietnamese has no published article",
  ]);
});

test("check-export: each Labs page has one H1, its own canonical and its language; each index its RSS 2.0 feed with one item per article", () => {
  const files = goodExport();
  files["labs/english/index.html"] = html("en", "/labs/english/", { h1: 2 });
  files["labs/both/index.html"] = html("en", "/labs/both/", { canonical: "/labs/" });
  files["vi/labs/both/index.html"] = html("en", "/vi/labs/both/");
  files["labs/rss.xml"] = feed(1);
  files["vi/labs/rss.xml"] = "<rss>";
  assert.deepEqual(problemsOf(files), [
    "No canonical to itself: /labs/both/",
    "H1 count: /labs/english/ has 2",
    "/labs/rss.xml has 1 item for 2 published articles",
    "html lang is not vi: /vi/labs/both/",
    "/vi/labs/rss.xml is not an RSS 2.0 document",
    "/vi/labs/rss.xml has 0 items for 2 published articles",
  ]);
  delete files["labs/rss.xml"];
  assert.ok(problemsOf(files).includes("labs: the index and rss.xml ship together (index true, feed false)"));
});

test("check-export: the sitemap lists each Labs page once, with exactly the versions that exist", () => {
  const entries = { ...LABS_ENTRIES };
  entries["/labs/english/"] = { en: "/labs/english/", vi: "/vi/labs/english/", "x-default": "/labs/english/" };
  entries["/vi/labs/vietnamese/"] = { vi: "/vi/labs/vietnamese/", "x-default": "/vi/labs/vietnamese/" };
  entries["/labs/old/"] = { en: "/labs/old/", "x-default": "/labs/old/" };
  const files = { ...goodExport(), "sitemap.xml": sitemapXml(entries, entry("/labs/both/", BOTH)) };
  assert.deepEqual(problemsOf(files), [
    'Sitemap entry /labs/english/ names {"en":"/labs/english/","vi":"/vi/labs/english/","x-default":"/labs/english/"}; expected {"en":"/labs/english/","x-default":"/labs/english/"} (the versions that exist, x-default only with an English one)',
    'Sitemap entry /vi/labs/vietnamese/ names {"vi":"/vi/labs/vietnamese/","x-default":"/vi/labs/vietnamese/"}; expected {"vi":"/vi/labs/vietnamese/"} (the versions that exist, x-default only with an English one)',
    "Sitemap lists /labs/old/, which is not a published Labs page",
    "Sitemap lists /labs/both/ more than once",
  ]);
  const missing = goodExport();
  delete missing["sitemap.xml"];
  assert.deepEqual(problemsOf(missing), ["Missing sitemap.xml"]);
});
