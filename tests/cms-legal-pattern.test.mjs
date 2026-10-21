// The legal pages' CMS pattern (LEGAL_BODY_PATTERN, used by public/admin/config.yml) must accept
// exactly the bodies the legal parser accepts. Otherwise the CMS saves a page that then fails the
// build, or refuses one that would build. Seeded random bodies cover both directions.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { load } from "js-yaml";
import { loadSveltiaNames } from "./helpers/sveltia-names.mjs";

const { LEGAL_BODY_PATTERN, parseLegalMarkdown } = await import("../src/lib/legal-markdown.ts");
const config = load(fs.readFileSync("public/admin/config.yml", "utf8"));
const pattern = config.collections.find((collection) => collection.name === "legal").files[0].fields[0].pattern;
const sveltia = loadSveltiaNames();

const parserAccepts = (body) => {
  try {
    parseLegalMarkdown(body, "probe.md");
    return true;
  } catch {
    return false;
  }
};
// Sveltia's own code: the pattern string is compiled without flags and tested on the trimmed value.
const cmsAccepts = (body) => sveltia.fieldAccepts(pattern, body);

/** Seeded bodies: mostly clean pages with one or two lines of each kind the parser refuses. */
function bodies(count, seed, { dirty = 0.08, clean = 0.55 } = {}) {
  let state = seed;
  const random = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (items) => items[Math.floor(random() * items.length)];
  const words = ["Data", "we", "keep", "your", "email", "for", "30", "days", "Cloudflare", "Inc.", "and", "or", "item #2", "e-mail", "a/b", "(see below)", "\"quoted\"", "it's", "50%", "x=y", "#tag", "1.5", "—", "Ünïcode", "~tilde", "=eq", "+plus", "-dash", "100", "q?", "2026."];
  const special = ["*", "_", "`", "<", ">", "[", "]", "\\", "|", "~~", "&amp;", "&#36;", "#", "##", "~", "&", ";"];
  const sentence = (risky) => `${Array.from({ length: 1 + Math.floor(random() * 6) }, () => (risky && random() < dirty ? pick(special) : pick(words))).join(" ")}.`;
  const kinds = [
    () => `## ${sentence(false).slice(0, -1)}`,
    () => `## ${sentence(true).slice(0, -1)}`,
    () => `##${pick(["", " ", "\t", "  "])}`,
    () => `##${pick(words)}`,
    () => `### ${pick(words)}`,
    () => `# ${pick(words)}`,
    () => "## Heading ##",
    () => `## Section #${Math.floor(random() * 9)}`,
    () => sentence(false),
    () => sentence(true),
    () => `${pick(["-", "+", "*"])} ${pick(words)}`,
    () => `${1 + Math.floor(random() * 9)}${pick([".", ")"])} ${pick(words)}`,
    () => pick(["---", "===", "-", "=", "- - -"]),
    () => `> ${pick(words)}`,
    () => pick(["```", "~~~"]),
    () => `${pick(["  ", "\t", " "])}${sentence(false)}`,
    () => `${pick(["  ", " "])}## ${pick(words)}`,
  ];
  return Array.from({ length: count }, () => {
    const lines = random() < 0.85 ? [`## ${sentence(false).slice(0, -1)}`, ""] : [];
    for (let line = 1 + Math.floor(random() * 7); line > 0; line--) {
      lines.push(random() < clean ? sentence(false) : pick(kinds)());
      if (random() < 0.7) lines.push(random() < 0.8 ? "" : "   ");
    }
    const body = lines.join("\n") + (random() < 0.5 ? "\n" : "");
    return random() < 0.2 ? body.replace(/\n/g, "\r\n") : body;
  });
}

test("the config's legal pattern is LEGAL_BODY_PATTERN, and Sveltia compiles it without flags", () => {
  assert.equal(pattern[0], LEGAL_BODY_PATTERN, "public/admin/config.yml carries the pattern built in src/lib/legal-markdown.ts");
  const compiled = sveltia.compilePattern(pattern[0]);
  assert.deepEqual([compiled.source, compiled.flags], [new RegExp(LEGAL_BODY_PATTERN).source, ""]);
  for (const words of [/lists/, /other heading levels/, /every heading some text below it/, /Start with a line "## Heading"/]) assert.match(pattern[1], words, "the message says what to fix in plain words");
});

test("the CMS and the parser agree on every body, in both directions", () => {
  const samples = [...bodies(400, 7), ...bodies(200, 1234, { dirty: 0.02, clean: 0.7 }), ...bodies(200, 99, { dirty: 0.2, clean: 0.4 }), ...bodies(200, 2024, { dirty: 0, clean: 0.92 })];
  // Today's pages and the cases a first review found the CMS let through.
  for (const page of ["content/legal/privacy.md", "content/legal/terms.md"]) samples.push(fs.readFileSync(page, "utf8"));
  samples.push(
    "## A\n\nText.\n\n- item", "## A\n\nText.\n\n1. item", "## Section #2\n\nText.", "## Heading ##\n\nText.", "## A\n\nText.\n\n##\n\nMore.",
    "## A\n\n## B\n\nText.", "## A\n\nText.\n\n### Detail\n\nMore.", "## A\n\nText.\n##B", "## A\n\nText.\n\n---", "## A\n\nThe policy changed in\n2026. It applies.",
    "## A\r\n\r\nText.\r\n", "## A\n\nText.\n\n## B\n\n   \n", "## A\n\nText.\n\n  ## B\n\n  More.", "## A\n\nText.\n\n## B",
  );
  const disagree = { cmsOnly: [], parserOnly: [] };
  let accepted = 0;
  for (const body of samples) {
    const cms = cmsAccepts(body);
    const parser = parserAccepts(body);
    if (cms && !parser) disagree.cmsOnly.push(body);
    if (parser && !cms) disagree.parserOnly.push(body);
    if (cms && parser) accepted++;
  }
  assert.deepEqual(disagree, { cmsOnly: [], parserOnly: [] }, "saved by the CMS but refused by the build (cmsOnly), or the other way round (parserOnly)");
  assert.ok(accepted > 150 && samples.length - accepted > 150, `the samples cover both outcomes (${accepted} of ${samples.length} accepted)`);
});

test("the pattern also agrees with the parser when compiled with the u flag", () => {
  const unicode = new RegExp(LEGAL_BODY_PATTERN, "u");
  for (const body of bodies(300, 4242)) assert.equal(unicode.test(body.trim()), parserAccepts(body), JSON.stringify(body));
});

test("the pattern runs in linear time on large hostile bodies", () => {
  const plain = new RegExp(LEGAL_BODY_PATTERN);
  const shapes = [
    `## A\n${"\n".repeat(200_000)}`,
    `## A\n\nx${" ".repeat(200_000)}`,
    `## A\n\n${"a\n".repeat(100_000)}`,
    `##\t${"\t".repeat(200_000)}x`,
    `## A\n\n${"1".repeat(200_000)}`,
    `## A\n\n${"-".repeat(200_000)} x`,
    `## A\n\n${"## B\n".repeat(40_000)}`,
    `## ${"a ".repeat(100_000)}\n\nText.`,
    `## A\n\n${"x\n   \n".repeat(40_000)}`,
  ];
  for (const body of shapes) {
    const start = performance.now();
    plain.test(body);
    const took = performance.now() - start;
    assert.ok(took < 250, `${took.toFixed(1)} ms for a ${body.length}-character body starting ${JSON.stringify(body.slice(0, 12))}`);
  }
});
