import { test } from "node:test";
import assert from "node:assert/strict";

const { parseLegalMarkdown } = await import("../src/lib/legal-markdown.ts");
const { legalSections } = await import("../src/lib/legal.ts");

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

test("anything beyond headings and plain paragraphs is rejected", () => {
  for (const source of [
    "Intro before any heading.\n\n## Heading\n\nText.",
    "# Title\n\nText.",
    "## Heading\n\n### Sub\n\nText.",
    "## Heading\n\nText with **bold**.",
    "## Heading\n\nA [link](https://example.com).",
    "## Heading\n\n- a list item",
    "## Heading\n\n1. a numbered item",
    "## Heading\n\n<script>alert(1)</script>",
    "## Heading\n\nText &amp; more.",
    "## Heading\n\nText\n## Not a heading inside a paragraph",
    "## Empty section",
    "",
  ]) assert.throws(() => parseLegalMarkdown(source, "bad.md"), /Invalid legal page/, JSON.stringify(source));
});
