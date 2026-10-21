import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { INLINE_SYNTAX, LegalPageError, parseLegalMarkdown } = await import("../src/lib/legal-markdown.ts");
const { legalSections } = await import("../src/lib/legal.ts");

/** The problems parseLegalMarkdown reports for `source` (none if it parses). */
const problemsOf = (source, file = "x.md") => {
  try {
    parseLegalMarkdown(source, file);
  } catch (error) {
    if (error instanceof LegalPageError) return error.issues;
    throw error;
  }
  return [];
};
const TEXT_HINT = "write the text without * _ ` < > [ ] \\ | ~~ or &…;";
const HEADING_HINT = "write the heading without # * _ ` < > [ ] \\ | ~~ or &…;";

test("the privacy page keeps its five sections", () => {
  assert.deepEqual(legalSections("privacy").map((section) => section.heading), [
    "Information you provide", "How it is used", "Storage and service providers", "Retention and access", "Website measurement",
  ]);
});

test("the terms page keeps its four sections", () => {
  assert.deepEqual(legalSections("terms").map((section) => section.heading), [
    "Website content", "Engagements", "Appropriate use", "Third-party material",
  ]);
});

test("every legal section has one plain paragraph today", () => {
  for (const page of ["privacy", "terms"]) for (const section of legalSections(page)) assert.equal(section.paragraphs.length, 1, `${page}: ${section.heading}`);
});

test("soft line breaks join with one space; CRLF and an empty front matter block are accepted", () => {
  const sections = parseLegalMarkdown("---\r\n---\r\n## Heading\r\n\r\nFirst line\r\nsecond line.\r\n\r\nNext paragraph.\r\n", "x.md");
  assert.deepEqual(sections, [{ heading: "Heading", paragraphs: ["First line second line.", "Next paragraph."] }]);
});

test("a \"## \" line starts a new section even without a blank line before it", () => {
  assert.deepEqual(parseLegalMarkdown("## One\n\nText\n## Two\nMore text.\n  ## Three\n\nLast.", "x.md"), [
    { heading: "One", paragraphs: ["Text"] },
    { heading: "Two", paragraphs: ["More text."] },
    { heading: "Three", paragraphs: ["Last."] },
  ]);
});

test("anything beyond headings and plain paragraphs is rejected", () => {
  for (const source of [
    "Intro before any heading.\n\n## Heading\n\nText.",
    "# Title\n\nText.",
    "## Heading\n\n### Sub\n\nText.",
    "## Heading\n\nText\n### Sub inside a paragraph",
    "## Heading\n\nText with **bold**.",
    "## Heading\n\nText with _emphasis_.",
    "## Heading\n\nText with ~~strikethrough~~.",
    "## Heading\n\nA [link](https://example.com).",
    "## Heading\n\nText with `code`.",
    "## Heading\n\nA | table | row",
    "## Heading\n\nAn escaped \\* star.",
    "## Heading\n\n- a list item",
    "## Heading\n\n+ a list item",
    "## Heading\n\n* a list item",
    "## Heading\n\n1. a numbered item",
    "## Heading\n\n2) a numbered item",
    "## Heading\n\n> a quote",
    "## Heading\n\n```\ncode\n```",
    "## Heading\n\n~~~\ncode\n~~~",
    "## Heading\n\nA setext heading\n===",
    "## Heading\n\nA setext heading\n---",
    "## Heading\n\nA setext heading\n-",
    "## Heading\n\n<script>alert(1)</script>",
    "## Heading\n\nText &amp; more.",
    "## Heading\n\nText &#60; more.",
    "## Heading\n\nText &#x3C; more.",
    "## **B**\n\nText.",
    "## Heading #2\n\nText.",
    "##NoSpace\n\nText.",
    "## \n\nText.",
    "##\n\nText.",
    "## Empty section",
    "",
  ]) assert.throws(() => parseLegalMarkdown(source, "bad.md"), /Invalid legal page/, JSON.stringify(source));
});

test("each problem names the file, the line and the offending character in context, and every problem is listed", () => {
  const source = [
    "## Website content", // 1
    "", // 2
    "Plain text.", // 3
    "", // 4
    "## Contact", // 5
    "", // 6
    "Write to legal_team@example.com today.", // 7
    "Second <b>line</b>.", // 8
    "", // 9
    "## ", // 10
    "", // 11
    "Text.", // 12
  ].join("\n");
  assert.deepEqual(problemsOf(source, "content/legal/terms.md"), [
    `content/legal/terms.md, line 7: "_" in "…ite to legal_team@example…": ${TEXT_HINT}`,
    `content/legal/terms.md, line 8: "<" in "Second <b>line</b>.": ${TEXT_HINT}`,
    `content/legal/terms.md, line 8: ">" in "Second <b>line</b>.": ${TEXT_HINT}`,
    "content/legal/terms.md, line 10: the heading is empty",
  ]);
  assert.throws(() => parseLegalMarkdown(source, "content/legal/terms.md"), (error) =>
    error.message.startsWith("Invalid legal page:\n  - content/legal/terms.md, line 7: "));
});

test("line numbers count front matter and leading blank lines", () => {
  assert.deepEqual(problemsOf("---\ntitle: Terms\n---\n\n\n## Heading\n\nText with `code`."), [
    `x.md, line 8: "\`" in "Text with \`code\`.": ${TEXT_HINT}`,
  ]);
});

test("heading, block and placement problems say what to change", () => {
  assert.deepEqual(problemsOf("## **B**\n\nText."), [`x.md, line 1: "*" in "**B**": ${HEADING_HINT}`]);
  assert.deepEqual(problemsOf("## Heading #2\n\nText."), [`x.md, line 1: "#" in "Heading #2": ${HEADING_HINT}`]);
  assert.deepEqual(problemsOf("##\n\nText."), ["x.md, line 1: the heading is empty"]);
  assert.deepEqual(problemsOf("##NoSpace\n\nText."), [
    'x.md, line 1: only "## " headings and plain paragraphs are supported ("##NoSpace")',
    'x.md, line 1: start the page with a "## " heading',
  ]);
  assert.deepEqual(problemsOf("## Heading\n\n> a quote"), ['x.md, line 3: only "## " headings and plain paragraphs are supported ("> a quote")']);
  assert.deepEqual(problemsOf("## A\n\nText.\n\n## B"), ['x.md, line 5: the section "B" has no text']);
  assert.deepEqual(problemsOf(""), ["x.md: no sections found"]);
});

test("INLINE_SYNTAX is exported for the CMS config mirror and matches each inline construct", () => {
  assert.ok(INLINE_SYNTAX instanceof RegExp);
  assert.equal(INLINE_SYNTAX.flags, "", "usable inside a CMS pattern as is");
  for (const text of ["*", "_", "`", "<", ">", "[", "]", "\\", "|", "~~", "&amp;", "&#60;"]) assert.match(text, INLINE_SYNTAX, text);
  for (const text of ["Plain text, with punctuation: (a) - b; 90 days.", "A ~ tilde", "A & B"]) assert.doesNotMatch(text, INLINE_SYNTAX, text);
});

test("legalSections reads from the given project folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-legal-"));
  try {
    fs.mkdirSync(path.join(root, "content", "legal"), { recursive: true });
    fs.writeFileSync(path.join(root, "content", "legal", "terms.md"), "## Only\n\nOne section.\n");
    assert.deepEqual(legalSections("terms", root), [{ heading: "Only", paragraphs: ["One section."] }]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
