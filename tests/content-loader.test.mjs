import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  const moved = entry(input, "faqs", "what-we-do.json");
  assert.notEqual(buildContent(input).FAQS.at(-1).question, moved.question, "the entry does not start last");
  moved.order = 99;
  const { FAQS } = buildContent(input);
  assert.equal(FAQS.at(-1).question, moved.question);
  assert.ok(!("order" in FAQS[0]), "the CMS-only order field is not exported");
});

test("two entries cannot share an order number", () => {
  const input = fresh();
  entry(input, "faqs", "where-to-start.json").order = entry(input, "faqs", "what-we-do.json").order;
  assert.ok(issuesOf(input).some((issue) => /^content\/faqs\/.+: order \d+ is already used by/.test(issue)));
});

test("a missing or fractional order is reported once per entry, never as a shared number", () => {
  const input = fresh();
  delete entry(input, "faqs", "what-we-do.json").order;
  delete entry(input, "faqs", "where-to-start.json").order;
  entry(input, "faqs", "existing-systems.json").order = 2.5;
  entry(input, "faqs", "data-readiness.json").order = 2.5;
  const issues = issuesOf(input);
  assert.ok(issues.includes("content/faqs/what-we-do.json: order: missing"));
  assert.ok(issues.includes("content/faqs/where-to-start.json: order: missing"));
  assert.ok(issues.includes("content/faqs/data-readiness.json: order: expected a whole number"));
  assert.deepEqual(issues.filter((issue) => issue.includes("already used")), []);
});

test("a file that is not valid JSON is reported with its path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-json-"));
  const file = path.join(dir, "broken.json");
  try {
    fs.writeFileSync(file, "{ \"question\": ");
    assert.throws(() => readJson(file), (error) => error instanceof SyntaxError && error.message.startsWith(`${file}: `));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a service file must be named after its slug", () => {
  const input = fresh();
  input.collections.services[0] = { ...input.collections.services[0], file: "renamed.json" };
  assert.ok(issuesOf(input).some((issue) => issue.startsWith("content/services/renamed.json: rename the file to")));
});

test("a service slug that breaks the slug rule gets no rename advice and is not offered to tiles", () => {
  const input = fresh();
  entry(input, "services", "applied-ai.json").slug = "Applied AI";
  const issues = issuesOf(input);
  assert.ok(issues.includes("content/services/applied-ai.json: slug: use lowercase letters, digits and single hyphens"));
  assert.deepEqual(issues.filter((issue) => issue.includes("rename the file")), []);
  assert.ok(issues.some((issue) => issue.startsWith('content/work.json: featured.slug: "applied-ai" is not one of: ')), "references to the old slug fail");
  assert.deepEqual(issues.filter((issue) => / is not one of: .*Applied AI/.test(issue)), []);

  const unnamed = fresh();
  delete entry(unnamed, "services", "applied-ai.json").slug;
  const missing = issuesOf(unnamed);
  assert.ok(missing.includes("content/services/applied-ai.json: slug: missing"));
  assert.deepEqual(missing.filter((issue) => /rename the file|undefined/.test(issue)), [], "a missing slug is not read as \"undefined\"");
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

test("FAQ questions, engagement names and article slugs are unique, naming the file and the duplicate", () => {
  const input = fresh();
  const question = entry(input, "faqs", "what-we-do.json").question;
  entry(input, "faqs", "where-to-start.json").question = question;
  const name = entry(input, "engagements", "assess.json").name;
  entry(input, "engagements", "build.json").name = name;
  const article = { slug: "first-note", author: "Ada Writer", title: "A first note", sub: "What we learned.", img: "/uploads/note.webp", href: "/insights/first-note/", order: 1 };
  input.collections.articles = [
    { file: "first-note.json", data: article },
    { file: "second-note.json", data: { ...article, title: "A second note", order: 2 } },
  ];
  assert.deepEqual(issuesOf(input).sort(), [
    'content/articles/second-note.json: slug "first-note" is already used by first-note.json; give every entry its own slug',
    `content/engagements/build.json: name ${JSON.stringify(name)} is already used by assess.json; give every entry its own name`,
    `content/faqs/where-to-start.json: question ${JSON.stringify(question)} is already used by what-we-do.json; give every entry its own question`,
  ]);
});

test("deliverables and outcomes never repeat an item within one entry (they are React keys)", () => {
  const input = fresh();
  const applied = entry(input, "services", "applied-ai.json");
  applied.deliverables[2] = applied.deliverables[0];
  const build = entry(input, "engagements", "build.json");
  build.deliverables[3] = build.deliverables[1];
  build.outcomes[1] = build.outcomes[0];
  assert.deepEqual(issuesOf(input).sort(), [
    `content/engagements/build.json: deliverables[3]: ${JSON.stringify(build.deliverables[1])} repeats deliverables[1]; make every item different`,
    `content/engagements/build.json: outcomes[1]: ${JSON.stringify(build.outcomes[0])} repeats outcomes[0]; make every item different`,
    `content/services/applied-ai.json: deliverables[2]: ${JSON.stringify(applied.deliverables[0])} repeats deliverables[0]; make every item different`,
  ]);
});

test("exactly one engagement is featured", () => {
  const input = fresh();
  for (const file of ["assess.json", "build.json", "improve.json"]) entry(input, "engagements", file).featured = false;
  assert.deepEqual(issuesOf(input), ["content/engagements: no engagement is featured; set featured on exactly one"]);
  entry(input, "engagements", "assess.json").featured = true;
  entry(input, "engagements", "improve.json").featured = true;
  assert.deepEqual(issuesOf(input), ["content/engagements/improve.json: featured is already set on assess.json; set featured on exactly one engagement"]);
});

test("a broken featured value is reported once, without also saying that none is featured", () => {
  const input = fresh();
  for (const file of ["assess.json", "build.json", "improve.json"]) entry(input, "engagements", file).featured = false;
  entry(input, "engagements", "build.json").featured = "yes";
  assert.deepEqual(issuesOf(input), ["content/engagements/build.json: featured: expected true or false"]);
  delete entry(input, "engagements", "build.json").featured;
  assert.deepEqual(issuesOf(input), ["content/engagements/build.json: featured: missing"]);
});

test("work tiles point at different services (Work.tsx keys tiles by slug)", () => {
  const input = fresh();
  const slug = input.work.tiles[0].slug;
  input.work.tiles[2].slug = slug;
  assert.deepEqual(issuesOf(input), [`content/work.json: tiles[2].slug: ${JSON.stringify(slug)} repeats tiles[0].slug; make every item different`]);
});

test("testimonials differ by name or company (the carousel keys them by both)", () => {
  const input = fresh();
  const quote = { img: "/uploads/client.webp", name: "Ada Client", role: "COO", company: "Example Ltd", quote: "They helped.", permissionConfirmed: true };
  input.collections.testimonials = [
    { file: "a.json", data: { ...quote, order: 1 } },
    { file: "b.json", data: { ...quote, quote: "They helped again.", order: 2 } },
    { file: "c.json", data: { ...quote, company: "Other Ltd", order: 3 } },
    { file: "d.json", data: { ...quote, name: "Bo Client", order: 4 } },
  ];
  assert.deepEqual(issuesOf(input), [
    'content/testimonials/b.json: name "Ada Client" and company "Example Ltd" are already used by a.json; give every entry its own combination of name and company',
  ]);
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
