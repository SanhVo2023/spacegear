import { test } from "node:test";
import assert from "node:assert/strict";
import { readContentInput, readLocaleFiles } from "../scripts/lib/content-input.mjs";
import { renderIndex } from "../scripts/build-content-index.mjs";

const { getContent, serviceFor, HOME, SERVICES, CONTENT_DIRS } = await import("../src/lib/content.ts");
const { buildContent, contentSchemas } = await import("../src/lib/content-model.ts");
const { contentParityProblems } = await import("../src/lib/content-parity.ts");
const { legalSections } = await import("../src/lib/legal.ts");

test("getContent('en') is the English exports; getContent('vi') has the same names, shapes and links", () => {
  assert.equal(getContent("en").HOME, HOME);
  assert.equal(getContent("en").SERVICES, SERVICES);
  const vi = getContent("vi");
  assert.deepEqual(Object.keys(vi), Object.keys(getContent("en")));
  assert.deepEqual(vi.SERVICES.map((service) => service.slug), SERVICES.map((service) => service.slug));
  assert.notEqual(vi.HOME.headline.lead, HOME.headline.lead, "the Vietnamese copy is loaded");
  assert.equal(vi.HOME.cta.href, HOME.cta.href, "links stay site paths; pages localize them");
  assert.equal(serviceFor("vi", "applied-ai").slug, "applied-ai");
  assert.deepEqual(CONTENT_DIRS, { en: "content", vi: "content/vi" });
});

test("the hero takes the Vietnamese verbs and tail (limits 12 and 32)", () => {
  const { home } = contentSchemas([]).singletons;
  assert.equal(home.meta.shape.headline.meta.shape.verbs.meta.item.meta.max, 12);
  assert.equal(home.meta.shape.headline.meta.shape.tail.meta.max, 32);
});

test("a Vietnamese problem names its file under content/vi/", () => {
  const input = readContentInput(".", "content/vi");
  input.home.headline.tail = "x".repeat(40);
  input.collections.faqs[0].data.order = input.collections.faqs[1].data.order;
  assert.throws(() => buildContent(input, "content/vi"), (error) => {
    assert.ok(error.issues.includes("content/vi/home.json: headline.tail: 40 characters, the limit is 32"), error.issues.join("\n"));
    assert.ok(error.issues.some((issue) => issue.startsWith(`content/vi/faqs/${input.collections.faqs[1].file}: order`)), error.issues.join("\n"));
    return true;
  });
});

test("the committed Vietnamese copy mirrors the English one", () => {
  assert.deepEqual(contentParityProblems(readLocaleFiles(".", "content"), readLocaleFiles(".", "content/vi")), []);
  for (const page of ["privacy", "terms"]) assert.equal(legalSections(page, ".", "vi").length, legalSections(page, ".", "en").length, page);
});

test("parity refuses a changed link, image, number, flag or figure, a different list length, and a missing or extra entry", () => {
  const en = readLocaleFiles(".", "content");
  const vi = structuredClone(readLocaleFiles(".", "content/vi"));
  vi.home.cta.href = "/vi/contact/";
  vi.faqCard.img = "/images/galaxy.webp";
  vi.measure.workflow.segments[0].value = 61;
  vi.home.stats[0].value = "06";
  vi.measure.workflow.center = "61%";
  vi.process.steps[0].outputs.pop();
  vi.collections.faqs.pop();
  vi.collections.faqs.push({ file: "zz-extra.json", data: {} });
  const problems = contentParityProblems(en, vi);
  for (const expected of [
    'content/vi/home.json: cta.href is "/vi/contact/", but it must stay "/contact/" as in content/home.json (links are the same in both languages)',
    "content/vi/faq-card.json: img is",
    "content/vi/measure.json: workflow.segments[0].value is 61",
    'content/vi/home.json: stats[0].value is "06", but it must stay "05"',
    'content/vi/measure.json: workflow.center is "61%"',
    "content/vi/process.json: steps[0].outputs has",
    "missing; every English entry needs its Vietnamese version",
    "content/vi/faqs/zz-extra.json: has no English entry",
  ]) assert.ok(problems.some((problem) => problem.startsWith(expected) || problem.includes(expected)), `${expected}\n${problems.join("\n")}`);
});

test("the entry index lists both languages", () => {
  const index = renderIndex(".");
  assert.match(index, /import vi_services_0 from "\.\.\/\.\.\/content\/vi\/services\/ai-strategy\.json" with \{ type: "json" \};/);
  assert.match(index, /export const COLLECTION_FILES_VI: Record<CollectionName, CollectionFile\[\]> = \{/);
});
