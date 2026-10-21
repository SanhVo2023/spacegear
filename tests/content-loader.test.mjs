import { test } from "node:test";
import assert from "node:assert/strict";
import { readContentInput, readJson } from "./helpers/content.mjs";

const { buildContent } = await import("../src/lib/content-model.ts");
const { ContentError } = await import("../src/lib/content-schema.ts");

const fresh = () => readContentInput(".");
const issuesOf = (input) => {
  try {
    buildContent(input);
  } catch (error) {
    if (error instanceof ContentError) return error.issues;
    throw error;
  }
  return [];
};
const entry = (input, collection, file) => input.collections[collection].find((item) => item.file === file).data;

test("the committed content passes validation", () => {
  assert.deepEqual(issuesOf(fresh()), []);
});

test("buildContent reproduces every pre-CMS export from the files in content/", () => {
  const { values } = readJson("tests/fixtures/content-v1.json");
  const built = buildContent(fresh());
  assert.equal(Object.keys(built).length, 20);
  for (const [name, value] of Object.entries(built)) assert.equal(JSON.stringify(value), JSON.stringify(values[name]), name);
});

test("collection entries are ordered by their order field, not by file name", () => {
  const input = fresh();
  entry(input, "faqs", "what-we-do.json").order = 99;
  const { FAQS } = buildContent(input);
  assert.equal(FAQS.at(-1).question, "What does spacegear.tech do?");
  assert.ok(!("order" in FAQS[0]), "the CMS-only order field is not exported");
});

test("two entries cannot share an order number", () => {
  const input = fresh();
  entry(input, "faqs", "where-to-start.json").order = entry(input, "faqs", "what-we-do.json").order;
  assert.ok(issuesOf(input).some((issue) => /^content\/faqs\/.+: order \d+ is already used by/.test(issue)));
});

test("a service file must be named after its slug", () => {
  const input = fresh();
  input.collections.services[0] = { ...input.collections.services[0], file: "renamed.json" };
  assert.ok(issuesOf(input).some((issue) => issue.startsWith("content/services/renamed.json: rename the file to")));
});

test("tiles and pillars can only point at existing services", () => {
  const input = fresh();
  input.work.tiles[0].slug = "no-such-service";
  input.servicesPanel.pillars[0].slug = "no-such-service";
  const issues = issuesOf(input);
  assert.ok(issues.some((issue) => issue.startsWith('content/work.json: tiles[0].slug: "no-such-service" is not one of: ')));
  assert.ok(issues.some((issue) => issue.startsWith('content/services-panel.json: pillars[0].slug: "no-such-service" is not one of: ')));
});

test("service art and pillar summaries are derived from the service entry", () => {
  const input = fresh();
  const applied = entry(input, "services", "applied-ai.json");
  applied.image = "/images/suite/scale-matrix.webp";
  applied.summary = "A changed summary.";
  const { WORK, PILLARS } = buildContent(input);
  assert.equal(WORK.featured.img, "/images/suite/scale-matrix.webp");
  assert.equal(PILLARS.find((pillar) => pillar.slug === "applied-ai").desc, "A changed summary.");
});

test("unknown fields, empty required fields and over-long text are reported with their file", () => {
  const input = fresh();
  input.home.extra = "x";
  input.home.cta.label = "";
  input.sections.work.heading = "x".repeat(141);
  assert.deepEqual(issuesOf(input).sort(), [
    "content/home.json: cta.label: required",
    "content/home.json: extra: unknown field (remove it, or add it to src/lib/content-model.ts and public/admin/config.yml)",
    "content/sections.json: work.heading: 141 characters, the limit is 140",
  ]);
});

test("testimonials render only with permission confirmed", () => {
  const input = fresh();
  const quote = { img: "/uploads/client.webp", name: "Ada Client", role: "COO", company: "Example Ltd", quote: "They helped.", order: 1 };
  input.collections.testimonials = [
    { file: "a.json", data: { ...quote, permissionConfirmed: false } },
    { file: "b.json", data: { ...quote, name: "Bo Client", permissionConfirmed: true, order: 2 } },
  ];
  const { TESTIMONIALS } = buildContent(input);
  assert.deepEqual(TESTIMONIALS.map((item) => [item.name, item.permissionConfirmed]), [["Bo Client", true]]);
});

test("the founder card stays empty until it has real details", () => {
  const input = fresh();
  assert.equal(buildContent(input).FOUNDER, null);
  input.team.founder = { name: "", role: "", img: "", imgAlt: "", links: [], bio: "" };
  assert.equal(buildContent(input).FOUNDER, null, "an untouched CMS group counts as empty");
  input.team.founder = { name: "Real Name", role: "Founder", img: "/uploads/founder.webp", imgAlt: "Portrait", links: [], bio: "Bio." };
  assert.equal(buildContent(input).FOUNDER.name, "Real Name");
});

test("role cards cannot link to profiles", () => {
  const input = fresh();
  entry(input, "team-roles", "product-and-delivery.json").links = [{ label: "LinkedIn", href: "https://linkedin.com/in/x" }];
  assert.ok(issuesOf(input).some((issue) => issue.startsWith("content/team-roles/product-and-delivery.json: links: 1 item, the limit is 0")));
});
