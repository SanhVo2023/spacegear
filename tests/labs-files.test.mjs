import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanContentTree } from "../scripts/lib/honesty.mjs";
import { copySampleContent } from "./helpers/content.mjs";
import { projectTempDir, removeProjectTemp } from "./helpers/project-temp.mjs";

const { readArticleFiles, labsProblems, publishedArticles, labsLocales } = await import("../src/lib/labs-files.ts");

/** A temporary project holding only the given article files ({ "content/articles/a.md": text }). */
function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-labs-"));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}
const article = ({ title = "Measuring a document workflow", summary = "How we agree on the measures before we build.", cover = "/images/suite/neural-net.webp", coverAlt = "A neural network diagram", date = "2026-10-20", updated = "", author = "Lan Nguyen", body = "## Why measure\n\nA pilot needs a baseline." } = {}) =>
  `---\ntitle: ${JSON.stringify(title)}\nsummary: ${JSON.stringify(summary)}\ncover: ${cover}\ncoverAlt: ${JSON.stringify(coverAlt)}\ndate: ${date}\nupdated: ${JSON.stringify(updated)}\nauthor: ${JSON.stringify(author)}\n---\n\n${body}\n`;
const blank = (fields = {}) => article({ title: "", summary: "", coverAlt: "", body: "", ...fields });

test("reads both languages; the slug is the file name; dates stay text", () => {
  const root = project({ "content/articles/measuring.md": article(), "content/vi/articles/measuring.md": article({ title: "Đo lường một quy trình hồ sơ", summary: "Cách hai bên thống nhất chỉ số trước khi xây dựng.", coverAlt: "Sơ đồ mạng nơ-ron", body: "## Vì sao cần đo\n\nMột dự án thí điểm cần mốc cơ sở." }) });
  try {
    const { files, issues } = readArticleFiles(root);
    assert.deepEqual(issues, []);
    assert.deepEqual(files.map((f) => [f.locale, f.slug, f.filled, f.data.date, f.data.updated]), [["en", "measuring", true, "2026-10-20", null], ["vi", "measuring", true, "2026-10-20", null]]);
    assert.equal(files[0].data.body, "## Why measure\n\nA pilot needs a baseline.");
    assert.deepEqual(labsProblems(files), []);
    assert.deepEqual(labsLocales(root), ["en", "vi"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a Windows checkout (CRLF line ends, a byte order mark) reads the same; dotfiles such as .gitkeep are skipped", () => {
  const root = project({ "content/articles/.gitkeep": "", "content/articles/crlf.md": `\u{FEFF}${article({ updated: "2026-10-22" }).replaceAll("\n", "\r\n")}` });
  try {
    const { files, issues } = readArticleFiles(root);
    assert.deepEqual(issues, []);
    assert.deepEqual(files.map((f) => [f.slug, f.data.title, f.data.updated]), [["crlf", "Measuring a document workflow", "2026-10-22"]]);
    assert.equal(files[0].data.body, "## Why measure\r\n\r\nA pilot needs a baseline.");
    assert.deepEqual(labsProblems(files), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("an article may exist in one language: English only, or Vietnamese only (the CMS keeps an empty English file)", () => {
  const english = project({ "content/articles/only-en.md": article() });
  const vietnamese = project({ "content/articles/only-vi.md": blank(), "content/vi/articles/only-vi.md": article({ title: "Chỉ có tiếng Việt", summary: "Một bài viết chỉ có bản tiếng Việt.", coverAlt: "Sơ đồ", body: "## Mở đầu\n\nNội dung." }) });
  try {
    assert.deepEqual(labsLocales(english), ["en"]);
    assert.deepEqual(labsLocales(vietnamese), ["vi"]);
    const { files } = readArticleFiles(vietnamese);
    assert.deepEqual(labsProblems(files), []);
    assert.deepEqual(publishedArticles(files, "en"), []);
    assert.deepEqual(publishedArticles(files, "vi").map((f) => f.slug), ["only-vi"]);
  } finally { for (const root of [english, vietnamese]) fs.rmSync(root, { recursive: true, force: true }); }
});

test("no articles at all means no Labs language", () => {
  const root = project({});
  const kept = project({ "content/articles/.gitkeep": "", "content/vi/articles/.gitkeep": "" });
  try {
    assert.deepEqual(labsLocales(root), []);
    assert.deepEqual(labsLocales(kept), []);
  } finally { for (const dir of [root, kept]) fs.rmSync(dir, { recursive: true, force: true }); }
});

test("newest first, then by slug", () => {
  const root = project({ "content/articles/b.md": article({ date: "2026-09-01" }), "content/articles/a.md": article({ date: "2026-10-01" }), "content/articles/c.md": article({ date: "2026-10-01" }) });
  try { assert.deepEqual(publishedArticles(readArticleFiles(root).files, "en").map((f) => f.slug), ["a", "c", "b"]); } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("refuses half-filled languages, empty articles, a missing English file, shared fields that differ, bad dates, stock covers and bad names", () => {
  const root = project({
    "content/articles/half.md": article({ summary: "" }),
    "content/articles/empty.md": blank(),
    "content/vi/articles/vi-off.md": blank(),
    "content/articles/vi-off.md": article(),
    "content/vi/articles/no-english.md": article({ title: "Không có bản tiếng Anh" }),
    "content/articles/shared.md": article(),
    "content/vi/articles/shared.md": article({ title: "Chia sẻ", author: "Someone Else", date: "2026-10-21" }),
    "content/articles/dates.md": article({ date: "2026-02-30", updated: "2026-01-01" }),
    "content/articles/stock.md": article({ cover: "/images/labs/ethical-ai.webp" }),
    "content/articles/portrait.md": article({ cover: "/images/reviews/review-1.webp" }),
    "content/articles/Bad Name.md": article(),
    "content/articles/nul.md": article(),
    "content/articles/zz-probe-x.md": article(),
    "content/articles/folder.md/inside.md": article(),
  });
  try {
    const { files, issues } = readArticleFiles(root);
    const problems = [...issues, ...labsProblems(files, { production: true })];
    for (const expected of [
      "content/articles/half.md: summary is empty",
      "content/articles/empty.md: has no text in either language",
      "content/vi/articles/vi-off.md: has no Vietnamese text",
      "content/articles/no-english.md is missing",
      'content/vi/articles/shared.md: author is "Someone Else", but it must stay "Lan Nguyen"',
      'content/vi/articles/shared.md: date is "2026-10-21", but it must stay "2026-10-20"',
      "content/articles/dates.md: date 2026-02-30 is not a real date",
      "content/articles/dates.md: updated (2026-01-01) is before the publication date",
      "content/articles/stock.md: cover uses the original site's stock art",
      "content/articles/portrait.md: cover uses the original site's stock art",
      "content/articles/Bad Name.md: Labs articles are Markdown files named after their slug",
      "content/articles/nul.md: Labs articles are Markdown files named after their slug",
      "content/articles/zz-probe-x.md: zz-probe- articles are test fixtures and never ship",
      "content/articles/folder.md: Labs articles are Markdown files",
    ]) assert.ok(problems.some((problem) => problem.startsWith(expected)), `${expected}\n${problems.join("\n")}`);
    // Outside production the probe articles are allowed (the browser checks publish them on a preview build).
    assert.ok(!labsProblems(files).some((problem) => problem.includes("zz-probe-")));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("front matter is checked by the schema: unknown fields, missing fields, lengths, image paths", () => {
  const root = project({
    "content/articles/x.md": article({ cover: "/uploads/Photo.JPG" }).replace("author:", "extra: 1\nauthor:"),
    "content/articles/long.md": article({ summary: "s".repeat(201) }),
    "content/articles/untitled.md": article().replace(/^title: .*\n/m, ""),
    "content/articles/no-front-matter.md": "## Just text\n",
  });
  try {
    const { files, issues } = readArticleFiles(root);
    for (const expected of [
      "content/articles/x.md: cover: use a lowercase file name",
      "content/articles/x.md: extra: unknown field",
      "content/articles/long.md: summary: 201 characters, the limit is 200",
      "content/articles/untitled.md: title: missing",
      "content/articles/no-front-matter.md: start the file with its front matter",
    ]) assert.ok(issues.some((issue) => issue.startsWith(expected)), `${expected}\n${issues.join("\n")}`);
    // A file without a title is not published, even when the title key itself is missing.
    assert.equal(files.find((f) => f.slug === "untitled").filled, false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the honesty scan covers article front matter and bodies in both languages", () => {
  const root = project({
    "content/articles/claims.md": article({ summary: "Trusted by 200 clients." }),
    "content/vi/articles/claims.md": article({ title: "Tuyên bố", body: "## Kết quả\n\nTăng 30% doanh thu cho khách hàng." }),
  });
  try {
    const problems = scanContentTree(root);
    assert.ok(problems.some((problem) => problem.startsWith("content/articles/claims.md: a client or scale claim")), problems.join("\n"));
    assert.ok(problems.some((problem) => problem.startsWith("content/vi/articles/claims.md: a result figure")), problems.join("\n"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// scripts/check-content.mjs on a temporary copy of what it reads, as in tests/content.test.mjs (inside the
// repository, so js-yaml resolves from node_modules).
test("check-content checks the articles: front matter, the language rules, covers on disk and the honesty scan", () => {
  const root = projectTempDir("check-labs-");
  try {
    for (const dir of ["src/lib", "scripts/lib", "public/images"]) fs.cpSync(dir, path.join(root, dir), { recursive: true });
    for (const file of ["scripts/check-content.mjs", "scripts/build-content-index.mjs"]) fs.copyFileSync(file, path.join(root, file));
    copySampleContent(root);
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
    const env = { ...process.env, SITE_MODE: "preview", NEXT_PUBLIC_SHOW_SAMPLES: "" };
    const run = () => spawnSync(process.execPath, ["--experimental-strip-types", path.join(root, "scripts", "check-content.mjs")], { cwd: path.join(root, "src"), encoding: "utf8", env });
    const listed = (result) => result.stderr.split(/\r?\n/).filter((line) => line.startsWith("  - ")).map((line) => line.slice(4));

    write("content/articles/measuring.md", article());
    write("content/vi/articles/measuring.md", article({ title: "Đo lường một quy trình hồ sơ", summary: "Cách hai bên thống nhất chỉ số trước khi xây dựng.", coverAlt: "Sơ đồ mạng nơ-ron", body: "## Vì sao cần đo\n\nMột dự án thí điểm cần mốc cơ sở." }));
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Content valid: 12 routes; preview mode\./);

    write("content/articles/missing-cover.md", article({ cover: "/uploads/labs/missing-cover/cover.webp" }));
    write("content/vi/articles/measuring.md", article({ title: "Đo lường", summary: "Tóm tắt.", coverAlt: "Sơ đồ", author: "Someone Else", body: "## Kết quả\n\nTăng 30% doanh thu." }));
    write("content/articles/Draft.md", article());
    result = run();
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /^\s+at /m, "no stack trace");
    for (const expected of [
      'content/vi/articles/measuring.md: author is "Someone Else", but it must stay "Lan Nguyen"',
      "content/articles/Draft.md: Labs articles are Markdown files named after their slug",
      "missing image: public/uploads/labs/missing-cover/cover.webp",
      "forbidden claim in content/vi/articles/measuring.md: a result figure",
    ]) assert.ok(listed(result).some((problem) => problem.startsWith(expected)), `${expected}\n${result.stderr}`);
  } finally { removeProjectTemp(root); }
});
