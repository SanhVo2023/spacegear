import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findForbidden } from "../scripts/lib/honesty.mjs";

const { rssFeed, llmsText } = await import("../src/lib/labs-feed.ts");
const { getPublishedRoutes } = await import("../src/lib/site.ts");
const { LocaleProvider } = await import("../src/components/LocaleProvider.tsx");
const { default: Labs, hasLabs } = await import("../src/components/sections/Labs.tsx");

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-feed-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}
const md = (title, date, extra = {}) => `---\ntitle: ${JSON.stringify(title)}\nsummary: ${JSON.stringify(extra.summary ?? "Notes & <tips> for a pilot.")}\ncover: /images/suite/neural-net.webp\ncoverAlt: "A diagram"\ndate: ${date}\nupdated: ${JSON.stringify(extra.updated ?? "")}\nauthor: "Lan Nguyen"\n---\n\n## Start\n\nText.\n`;
const blankEnglish = (date) => `---\ntitle: ""\nsummary: ""\ncover: /images/suite/neural-net.webp\ncoverAlt: ""\ndate: ${date}\nupdated: ""\nauthor: "Lan Nguyen"\n---\n`;

test("RSS 2.0 per language: channel, self link, newest first, escaped text", () => {
  const root = project({ "content/articles/a.md": md("First & best", "2026-10-01"), "content/articles/b.md": md("Second", "2026-10-15") });
  try {
    const xml = rssFeed("en", root);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">'));
    assert.match(xml, /<atom:link href="https:\/\/spacegear\.tech\/labs\/rss\.xml" rel="self" type="application\/rss\+xml"\/>/);
    assert.match(xml, /<language>en<\/language>/);
    assert.ok(xml.indexOf("<title>Second</title>") < xml.indexOf("<title>First &amp; best</title>"), "newest first");
    assert.match(xml, /<description>Notes &amp; &lt;tips&gt; for a pilot\.<\/description>/);
    assert.match(xml, /<pubDate>Thu, 15 Oct 2026 00:00:00 GMT<\/pubDate>/);
    assert.match(xml, /<guid isPermaLink="true">https:\/\/spacegear\.tech\/labs\/b\/<\/guid>/);
    assert.match(xml, /<dc:creator>Lan Nguyen<\/dc:creator>/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("RSS per language holds only that language's published articles, with absolute links and the latest change as lastBuildDate", () => {
  const root = project({
    "content/articles/both.md": md("Both", "2026-10-02", { updated: "2026-10-20" }),
    "content/vi/articles/both.md": md("Cả hai", "2026-10-02", { updated: "2026-10-20" }),
    "content/articles/english.md": md("English only", "2026-10-10"),
    "content/articles/vietnamese.md": blankEnglish("2026-10-12"),
    "content/vi/articles/vietnamese.md": md("Chỉ tiếng Việt", "2026-10-12", { summary: "Ghi chú \"thực tế\" <b>đậm</b> ]]> và 'trích dẫn'." }),
  });
  try {
    const en = rssFeed("en", root);
    const vi = rssFeed("vi", root);
    const items = (xml) => [...xml.matchAll(/<item><title>([^<]*)<\/title><link>([^<]*)<\/link>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(items(en), [["English only", "https://spacegear.tech/labs/english/"], ["Both", "https://spacegear.tech/labs/both/"]]);
    assert.deepEqual(items(vi), [["Chỉ tiếng Việt", "https://spacegear.tech/vi/labs/vietnamese/"], ["Cả hai", "https://spacegear.tech/vi/labs/both/"]]);
    assert.match(vi, /<atom:link href="https:\/\/spacegear\.tech\/vi\/labs\/rss\.xml" rel="self" type="application\/rss\+xml"\/>/);
    assert.match(vi, /<link>https:\/\/spacegear\.tech\/vi\/labs\/<\/link>/);
    assert.match(vi, /<language>vi<\/language>/);
    assert.match(vi, /<title>spacegear Labs · spacegear\.tech<\/title>/);
    // The newest article is from the 12th, but "Both" changed on the 20th.
    assert.match(en, /<lastBuildDate>Tue, 20 Oct 2026 00:00:00 GMT<\/lastBuildDate>/);
    assert.match(vi, /<description>Ghi chú &quot;thực tế&quot; &lt;b&gt;đậm&lt;\/b&gt; \]\]&gt; và &apos;trích dẫn&apos;\.<\/description>/);
    for (const xml of [en, vi]) {
      assert.doesNotMatch(xml, /<b>|<h2|<p>/, "no article HTML in the feed");
      for (const [, link] of items(xml)) assert.ok(link.startsWith("https://"), link);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("RSS: a language without articles is an empty channel (the route does not exist then)", () => {
  const root = project({ "content/articles/a.md": md("Only English", "2026-10-01") });
  try {
    const vi = rssFeed("vi", root);
    assert.doesNotMatch(vi, /<item>|<lastBuildDate>/);
    assert.match(vi, /<\/channel>\n<\/rss>\n$/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("llms.txt names the key pages in both languages and every article, and makes no claim", () => {
  const root = project({ "content/vi/articles/a.md": md("Bài viết", "2026-10-01"), "content/articles/a.md": blankEnglish("2026-10-01") });
  try {
    const text = llmsText(root);
    assert.match(text, /^# spacegear\.tech\n\n> /);
    for (const url of ["https://spacegear.tech/", "https://spacegear.tech/services/applied-ai/", "https://spacegear.tech/contact/", "https://spacegear.tech/vi/", "https://spacegear.tech/vi/contact/", "https://spacegear.tech/vi/labs/a/"]) assert.ok(text.includes(`](${url})`), url);
    assert.doesNotMatch(text, /\]\(https:\/\/spacegear\.tech\/labs\//, "no English Labs entries without English articles");
    assert.deepEqual(findForbidden(text, "llms.txt"), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("llms.txt is generated from the published routes: every page, the Labs index, its feed and its articles, once each", () => {
  const root = project({
    "content/articles/both.md": md("Both [draft] notes", "2026-10-02"),
    "content/vi/articles/both.md": md("Cả hai", "2026-10-02"),
    "content/articles/english.md": md("English only", "2026-10-10"),
  });
  try {
    const text = llmsText(root);
    const links = [...text.matchAll(/^- \[(?:[^\]\\]|\\.)+\]\((https:\/\/spacegear\.tech\/[^)]*)\)/gm)].map((m) => m[1]);
    const expected = [
      ...getPublishedRoutes().map((route) => route.path),
      "/labs/", "/labs/rss.xml", "/labs/english/", "/labs/both/",
      "/vi/labs/", "/vi/labs/rss.xml", "/vi/labs/both/",
    ].map((p) => `https://spacegear.tech${p}`);
    assert.deepEqual([...links].sort(), [...expected].sort(), "exactly the published pages, feeds and articles");
    assert.equal(new Set(links).size, links.length, "each once");
    // llmstxt.org: an H1, a blockquote, then H2 sections of Markdown links; the English sections come first.
    assert.deepEqual([...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]), ["Pages in English", "Labs in English", "Pages in Vietnamese", "Labs in Vietnamese"]);
    assert.ok(text.indexOf("](https://spacegear.tech/vi/)") > text.indexOf("](https://spacegear.tech/terms/)"));
    assert.ok(text.includes("- [Both \\[draft\\] notes](https://spacegear.tech/labs/both/): Notes & <tips> for a pilot."), "link text escaped; one line per entry");
    assert.doesNotMatch(text, /\]\(\/|\]\(http:/, "absolute https links only");
    for (const line of text.split("\n").filter((l) => l.startsWith("- "))) assert.match(line, /^- \[[^\n]+\]\(https:\/\/spacegear\.tech\/[^)\s]*\)(?:: \S.*)?$/, line);
    assert.deepEqual(findForbidden(text, "llms.txt"), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// The home section reads the site's own content/ (process.cwd()), so these tests run it inside a scratch project.
function inProject(files, run) {
  const root = project(files);
  const cwd = process.cwd();
  process.chdir(root);
  try { return run(); } finally { process.chdir(cwd); fs.rmSync(root, { recursive: true, force: true }); }
}
// A card title (LabsCard), not the section header's own h3 line.
const CARD_TITLE = /<h3 class="mt-4 [^"]*">([^<]*)<\/h3>/g;
const renderLabs = (locale) => renderToStaticMarkup(React.createElement(LocaleProvider, { locale }, React.createElement(Labs, { locale })));

test("home Labs section: the three newest articles in the page's language, h3 cards and a link to all of them", () => {
  inProject({
    "content/articles/one.md": md("One", "2026-10-01"),
    "content/articles/two.md": md("Two", "2026-10-02"),
    "content/articles/three.md": md("Three", "2026-10-03"),
    "content/articles/four.md": md("Four", "2026-10-04"),
    "content/articles/viet.md": blankEnglish("2026-10-05"),
    "content/vi/articles/viet.md": md("Bài tiếng Việt", "2026-10-05"),
  }, () => {
    const en = renderLabs("en");
    assert.match(en, /<section id="labs"/);
    const desktop = en.slice(0, en.indexOf("sm:hidden"));
    const titles = [...desktop.matchAll(CARD_TITLE)].map((m) => m[1]);
    assert.deepEqual(titles, ["Four", "Three", "Two"], "newest three, newest first");
    assert.doesNotMatch(en, />One</);
    assert.doesNotMatch(en, /Bài tiếng Việt/);
    assert.match(en, /href="\/labs\/four\/?"/);
    assert.match(en, /href="\/labs\/?"[^>]*>All articles/);
    const vi = renderLabs("vi");
    assert.deepEqual([...vi.slice(0, vi.indexOf("sm:hidden")).matchAll(CARD_TITLE)].map((m) => m[1]), ["Bài tiếng Việt"]);
    assert.match(vi, /href="\/vi\/labs\/viet\/?"/);
    assert.match(vi, /href="\/vi\/labs\/?"[^>]*>Tất cả bài viết/);
    assert.doesNotMatch(vi, /href="\/labs\//, "every link is localized");
    assert.ok(hasLabs("en") && hasLabs("vi"));
  });
});

test("home Labs section: hidden in a language without articles, and the rail agrees", () => {
  inProject({ "content/articles/viet.md": blankEnglish("2026-10-05"), "content/vi/articles/viet.md": md("Bài tiếng Việt", "2026-10-05") }, () => {
    assert.equal(renderLabs("en"), "");
    assert.equal(hasLabs("en"), false);
    assert.notEqual(renderLabs("vi"), "");
    assert.equal(hasLabs("vi"), true);
  });
  inProject({}, () => {
    for (const locale of ["en", "vi"]) { assert.equal(renderLabs(locale), ""); assert.equal(hasLabs(locale), false); }
  });
});
