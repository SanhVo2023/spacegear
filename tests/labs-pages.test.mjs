import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { labsArticles, labsArticle, labsRoutes, formatDate, READING_RATE, readingMinutes } = await import("../src/lib/labs.ts");
const { blogPostingData } = await import("../src/lib/seo.ts");
const { imageSizeOf, siteImageSize } = await import("../src/lib/image-size.ts");
const meta = await import("../src/views/metadata.ts");
const { default: nextConfig } = await import("../next.config.ts");

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-labs-pages-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}
const md = (title, body, extra = {}) => `---\ntitle: ${JSON.stringify(title)}\nsummary: ${JSON.stringify(extra.summary ?? "A short summary of the article.")}\ncover: ${extra.cover ?? "/uploads/cover.jpg"}\ncoverAlt: ${JSON.stringify(title ? "A cover" : "")}\ndate: ${extra.date ?? "2026-10-20"}\nupdated: ""\nauthor: "Lan Nguyen"\n---\n\n${body}\n`;
const blankEnglish = `---\ntitle: ""\nsummary: ""\ncover: /uploads/cover.jpg\ncoverAlt: ""\ndate: 2026-10-21\nupdated: ""\nauthor: "Lan Nguyen"\n---\n`;

test("articles per language with their versions, reading time and rendered body; routes only for languages that have articles", () => {
  const root = project({
    "content/articles/both.md": md("Both languages", "## Start\n\n" + "word ".repeat(450)),
    "content/vi/articles/both.md": md("Cả hai ngôn ngữ", "## Mở đầu\n\nNội dung."),
    "content/articles/english.md": md("English only", "## Only\n\nText.", { date: "2026-10-22" }),
    "content/articles/vietnamese.md": blankEnglish,
    "content/vi/articles/vietnamese.md": md("Chỉ tiếng Việt", "## Riêng\n\nNội dung.", { date: "2026-10-21" }),
  });
  try {
    assert.deepEqual(labsArticles("en", root).map((a) => a.slug), ["english", "both"]);
    assert.deepEqual(labsArticles("vi", root).map((a) => a.slug), ["vietnamese", "both"]);
    const both = labsArticle("en", "both", root);
    assert.deepEqual(both.languages, { en: "/labs/both/", vi: "/vi/labs/both/" });
    assert.equal(both.path, "/labs/both/");
    assert.equal(both.readingMinutes, 2);
    assert.match(both.html, /<h2 id="start">/);
    assert.deepEqual(labsArticle("vi", "vietnamese", root).languages, { vi: "/vi/labs/vietnamese/" });
    assert.equal(labsArticle("en", "vietnamese", root), undefined);
    const routes = labsRoutes(root).map((r) => [r.path, r.kind, r.locale, r.alternates]);
    assert.deepEqual(routes[0], ["/labs/", "labs", "en", { en: "/labs/", vi: "/vi/labs/" }]);
    assert.ok(routes.some(([p, , , alt]) => p === "/labs/english/" && JSON.stringify(alt) === JSON.stringify({ en: "/labs/english/" })));
    assert.equal(routes.length, 6);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  const empty = project({ "content/articles/x.md": md("English only", "Text.") });
  try { assert.deepEqual(labsRoutes(empty).map((r) => r.locale), ["en", "en"], "no Vietnamese Labs pages without a Vietnamese article"); } finally { fs.rmSync(empty, { recursive: true, force: true }); }
});

test("reading time: English words at 220 a minute, Vietnamese syllables at 320, so a translation reads about as long", () => {
  assert.deepEqual(READING_RATE, { en: 220, vi: 320 });
  // A draft measured 1,746 English words and 2,544 Vietnamese syllables: 8 minutes in both languages.
  assert.equal(readingMinutes(1746, "en"), 8);
  assert.equal(readingMinutes(2544, "vi"), 8);
  assert.equal(readingMinutes(3, "en"), 1, "never 0 minutes");
  const root = project({
    "content/articles/both.md": md("Both", "word ".repeat(660)),
    "content/vi/articles/both.md": md("Cả hai", "chữ ".repeat(960)),
  });
  try {
    assert.equal(labsArticle("en", "both", root).readingMinutes, 3);
    assert.equal(labsArticle("vi", "both", root).readingMinutes, 3, "960 syllables at 320 a minute, not 220");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("BlogPosting: headline, description, author Person, dates, image, language, publisher", () => {
  const root = project({ "content/articles/both.md": md("Both languages", "Text."), "content/vi/articles/both.md": md("Cả hai", "Nội dung.") });
  try {
    const data = blogPostingData(labsArticle("vi", "both", root));
    assert.deepEqual(data, {
      "@context": "https://schema.org", "@type": "BlogPosting", "@id": "https://spacegear.tech/vi/labs/both/#article", mainEntityOfPage: "https://spacegear.tech/vi/labs/both/", url: "https://spacegear.tech/vi/labs/both/",
      headline: "Cả hai", description: "A short summary of the article.", inLanguage: "vi", author: { "@type": "Person", name: "Lan Nguyen" },
      datePublished: "2026-10-20", dateModified: "2026-10-20", image: "https://spacegear.tech/uploads/cover.jpg.w1280.webp", publisher: { "@id": "https://spacegear.tech/#organization" },
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("dates read naturally in each language", () => {
  assert.equal(formatDate("2026-10-23", "en"), "October 23, 2026");
  assert.equal(formatDate("2026-10-23", "vi"), "23 tháng 10, 2026");
});

// Images of every format the site accepts, made by sharp; the header reader must give the size sharp reports after
// orientation (what the browser shows and what the upload variants keep).
const sharp = (await import("sharp")).default;
sharp.cache(false);
const canvas = (width, height, channels = 3) => sharp({ create: { width, height, channels, background: channels === 4 ? { r: 250, g: 110, b: 67, alpha: 0.5 } : "#fa6e43" } });

test("image sizes come from the file header: PNG, JPEG (EXIF orientation), GIF, WebP (lossy, lossless, extended), AVIF, SVG", async () => {
  const samples = {
    png: await canvas(321, 123).png().toBuffer(),
    jpeg: await canvas(640, 360).jpeg().toBuffer(),
    progressive: await canvas(333, 222).jpeg({ progressive: true }).toBuffer(),
    rotated: await canvas(400, 300).jpeg().withMetadata({ orientation: 6 }).toBuffer(),
    gif: await canvas(77, 55).gif().toBuffer(),
    lossy: await canvas(1000, 563).webp().toBuffer(),
    lossless: await canvas(129, 65).webp({ lossless: true }).toBuffer(),
    alpha: await canvas(301, 201, 4).webp().toBuffer(),
    exif: await canvas(260, 140).webp().withMetadata({ orientation: 1 }).toBuffer(),
    avif: await canvas(320, 180).avif().toBuffer(),
  };
  for (const [name, bytes] of Object.entries(samples)) {
    const { width, height, autoOrient } = await sharp(bytes).metadata();
    assert.deepEqual(imageSizeOf(bytes), autoOrient ?? { width, height }, name);
  }
  assert.deepEqual(imageSizeOf(samples.rotated), { width: 300, height: 400 }, "orientation 6 turns the picture a quarter");
  const svg = (attributes) => Buffer.from(`<?xml version="1.0"?>\n<!-- art -->\n<svg xmlns="http://www.w3.org/2000/svg" ${attributes}><rect stroke-width="3"/></svg>`);
  assert.deepEqual(imageSizeOf(svg('width="120" height="80px"')), { width: 120, height: 80 });
  assert.deepEqual(imageSizeOf(svg('viewBox="0 0 1600 900"')), { width: 1600, height: 900 });
  assert.deepEqual(imageSizeOf(svg('width="100%" viewBox="0 0 40 30"')), { width: 40, height: 30 }, "a relative width falls back to the viewBox");
  assert.equal(imageSizeOf(svg('width="100%"')), undefined);
  for (const broken of [Buffer.alloc(0), Buffer.from("not an image"), samples.png.subarray(0, 20), samples.jpeg.subarray(0, 40), samples.avif.subarray(0, 60)]) assert.equal(imageSizeOf(broken), undefined);
});

test("article images and covers get their width and height, so nothing moves when they load", async () => {
  const root = project({
    "content/articles/pictures.md": md("Pictures", "## Diagram\n\n![The flow](/uploads/flow.png)\n\n![Missing](/uploads/missing.png)", { cover: "/uploads/cover.jpg" }),
  });
  try {
    fs.mkdirSync(path.join(root, "public", "uploads"), { recursive: true });
    await canvas(1600, 900).png().toFile(path.join(root, "public", "uploads", "flow.png"));
    await canvas(2400, 1260).jpeg().toFile(path.join(root, "public", "uploads", "cover.jpg"));
    assert.deepEqual(siteImageSize("/uploads/flow.png", root), { width: 1600, height: 900 });
    assert.equal(siteImageSize("/uploads/../../secret.png", root), undefined, "only files under public/uploads and public/images");
    const article = labsArticle("en", "pictures", root);
    assert.match(article.html, /<img src="\/uploads\/flow\.png\.w1280\.webp" [^>]*alt="The flow" width="1600" height="900" loading="lazy" decoding="async">/);
    assert.match(article.html, /<img src="\/uploads\/missing\.png\.w1280\.webp" [^>]*alt="Missing" loading="lazy" decoding="async">/, "an unreadable image keeps no size (check-content refuses it)");
    assert.deepEqual(article.coverSize, { width: 2400, height: 1260 });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the Labs index: the section's copy as its description, its feed linked, a WebPage node on both pages", () => {
  for (const locale of ["en", "vi"]) {
    const index = meta.labsIndexMetadata(locale);
    assert.ok(index.description.length > 50, `${locale}: a description long enough for a search snippet`);
    assert.deepEqual(index.alternates.types?.["application/rss+xml"]?.map((feed) => feed.url), [`https://spacegear.tech${locale === "vi" ? "/vi" : ""}/labs/rss.xml`]);
  }
  assert.equal(meta.aboutMetadata("en").alternates.types, undefined, "only the Labs pages link the feed");
  for (const view of ["LabsIndexView", "LabsArticleView"]) assert.match(fs.readFileSync(`src/views/${view}.tsx`, "utf8"), /webPageData\(/, `${view} renders its WebPage node`);
  assert.match(fs.readFileSync("src/views/LabsArticleView.tsx", "utf8"), /blogPostingData\(/);
});

test("the Labs routes exist only for languages with articles (pageExtensions), and the route files are twins", () => {
  assert.deepEqual(nextConfig.pageExtensions, ["tsx", "ts", "jsx", "js"], "no article is committed, so no Labs route");
  for (const page of ["labs/page", "labs/[slug]/page"]) {
    const english = fs.readFileSync(`src/app/(en)/${page}.en-labs.tsx`, "utf8");
    assert.equal(fs.readFileSync(`src/app/(vi)/vi/${page}.vi-labs.tsx`, "utf8"), english.replaceAll('"en"', '"vi"').replace("English has", "Vietnamese has").replace("en-labs", "vi-labs"), page);
  }
});
