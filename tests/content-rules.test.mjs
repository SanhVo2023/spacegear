// Rules check-content reports for how editors use the CMS and what the site promises about its
// copy (scripts/lib/content-rules.mjs). The unit tests change the frozen sample content
// (tests/helpers/content.mjs), so editors' changes to the live copy never break them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import { DISCIPLINE_WORDS, contentRuleProblems, countProblems, illustrativeProblems, linkProblems, readsLikePerson, stageNumberProblems, stockImageProblems, teamProblems } from "../scripts/lib/content-rules.mjs";
import { copySampleContent, sampleInput } from "./helpers/content.mjs";
import { projectTempDir, removeProjectTemp } from "./helpers/project-temp.mjs";

const content = await import("../src/lib/content.ts");
const { getPublishedRoutes } = await import("../src/lib/site.ts");
const { buildContent } = await import("../src/lib/content-model.ts");
const routes = getPublishedRoutes().map((route) => route.path);
/** The sample content as the site loads it, after `change` edits its files. */
const sample = (change = () => {}) => {
  const input = sampleInput();
  change(input);
  return buildContent(input);
};
const entry = (input, collection, file) => input.collections[collection].find((item) => item.file === file).data;

test("the committed content and the sample pass every content rule", () => {
  assert.deepEqual(contentRuleProblems(content, routes), []);
  assert.deepEqual(contentRuleProblems(sample(), routes), []);
});

test("engagement stage numbers follow the list order", () => {
  const { ENGAGEMENTS } = sample();
  const swapped = [ENGAGEMENTS[1], ENGAGEMENTS[0], ENGAGEMENTS[2]];
  assert.deepEqual(stageNumberProblems(swapped), [
    `content/engagements: "${ENGAGEMENTS[1].name}" is number 1 in the list but its stage number is "02"; keep stage numbers in list order (01, 02, 03…): set it to "01"`,
    `content/engagements: "${ENGAGEMENTS[0].name}" is number 2 in the list but its stage number is "01"; keep stage numbers in list order (01, 02, 03…): set it to "02"`,
  ]);
  const config = load(fs.readFileSync("public/admin/config.yml", "utf8"));
  const field = config.collections.find((collection) => collection.name === "engagements").fields.find((item) => item.name === "stageNo");
  assert.match(field.hint, /Keep stage numbers in list order/, "the CMS field says so too");
});

test("displayed counts match the data", () => {
  const edited = sample((input) => {
    input.work.lineup.count = "4/5";
    input.servicesPanel.panel.count = "6/6";
    input.home.stats[0].value = "04";
    input.home.stats[1].sub = "Plan, build, run";
    input.work.assessment.badge = "01/04";
    input.servicesPanel.pillars.pop();
  });
  const slugs = edited.SERVICES.map((service) => service.slug);
  const names = edited.ENGAGEMENTS.map((engagement) => engagement.short).join(", ");
  assert.deepEqual(countProblems(edited), [
    'content/home.json: stats[0].value is "04", but the site has 5 services: set it to "05"',
    `content/home.json: stats[1].sub is "Plan, build, run", but it names the engagements it counts, in list order: set it to ${JSON.stringify(names)} (letter case is free)`,
    'content/work.json: lineup.count is "4/5", but the site has 5 services: set it to "5/5"',
    'content/services-panel.json: panel.count is "6/6", but the site has 5 services: set it to "5/5"',
    'content/work.json: assessment.badge is "01/04", but the assessment is the first of 3 engagements: set it to "01/03"',
    `content/services-panel.json: pillars: list every service once (${slugs.join(", ")}); now ${edited.PILLARS.map((pillar) => pillar.slug).join(", ")}`,
  ]);
  assert.deepEqual(countProblems(sample((input) => { input.home.stats[1].sub = input.home.stats[1].sub.toUpperCase(); })), [], "letter case is free");
});

const PERSON_ADVICE = "reads like a person's name, and team cards describe a discipline. If it is a discipline, write it in sentence case (such as \"Brand storytelling\") or with \"&\" (such as \"Brand & Story\"); a maintainer can also add its word to DISCIPLINE_WORDS in scripts/lib/content-rules.mjs. A real person goes in the founder card (content/team.json)";
// The reviewer's probes (scratchpad/t11-review/person-rule-proposal.mjs).
const DISCIPLINE_NAMES = ["Adoption & Support", "AI & Data Engineering", "Integration & Automation", "Product & Delivery", "Strategy & Discovery", "Product Design",
  "Data Engineering", "Cloud Infrastructure", "Machine Learning", "Applied AI", "Quality Assurance", "Change Management", "Security Engineering",
  "Service Design", "Data Science", "Platform Engineering", "Technical Writing", "User Research", "Mobile Development", "Data engineering", "Ada"];
const PERSON_NAMES = ["Ada Lovelace", "John Smith", "Maria Garcia", "J. Smith", "Dr Smith", "Anna-Lena Berg", "Nguyễn Văn An", "Lê Minh", "Ada Lovelace Byron", "Ludwig van Beethoven"];

test("team cards describe disciplines, not people", () => {
  const edited = sample((input) => {
    entry(input, "team-roles", "product-and-delivery.json").name = "Ada Lovelace";
    entry(input, "team-roles", "adoption-and-support.json").img = "/images/team/team-1.webp";
  });
  const support = edited.TEAM_ROLES.find((role) => role.img === "/images/team/team-1.webp").name;
  assert.deepEqual(teamProblems(edited), [
    `content/team-roles: "Ada Lovelace" ${PERSON_ADVICE}`,
    `content/team-roles: ${JSON.stringify(support)} uses a stock portrait (/images/team/team-1.webp); use a discipline image instead`,
  ]);
  assert.deepEqual(teamProblems(sample((input) => { entry(input, "team-roles", "product-and-delivery.json").name = "Data Engineering"; })), [], "a discipline word passes");
});

test("a team-card name is refused only when it has the shape of a person's name", () => {
  assert.equal(DISCIPLINE_NAMES.length, 21);
  assert.equal(PERSON_NAMES.length, 10);
  assert.deepEqual(DISCIPLINE_NAMES.filter(readsLikePerson), [], "discipline names pass");
  assert.deepEqual(PERSON_NAMES.filter((name) => !readsLikePerson(name)), [], "person names are refused");
  const live = content.TEAM_ROLES.map((role) => role.name);
  assert.deepEqual(live.filter(readsLikePerson), [], `today's ${live.length} live names pass`);
  assert.deepEqual(sample().TEAM_ROLES.map((role) => role.name).filter(readsLikePerson), [], "and the sample's");
  // The two fixes the message offers an editor, and the maintainer's.
  assert.equal(readsLikePerson("Brand Storytelling"), true, "two capitalised name words with no discipline word");
  assert.equal(readsLikePerson("Brand storytelling"), false, "sentence case");
  assert.equal(readsLikePerson("Brand & Story"), false, "with &");
  assert.ok(DISCIPLINE_WORDS.has("engineering") && [...DISCIPLINE_WORDS].every((word) => word === word.toLowerCase()), "DISCIPLINE_WORDS holds lowercase words");
});

test("the sample dashboard is labelled illustrative, in its section and on every card", () => {
  const edited = sample((input) => {
    input.sections.analytics.description = "A look at how a pilot can be measured.";
    input.measure.stagesFooter = "Time per case";
    input.measure.coverage.tag = "Coverage";
  });
  // The sample's coverage card is labelled by its tag alone ("Example evaluation set").
  assert.deepEqual(illustrativeProblems(edited), [
    'content/sections.json: analytics.description must say that the figures are illustrative and not client results (both words "illustrative" and "not client results"), because the dashboard shows sample data',
    "content/measure.json: coverage must call itself illustrative, an example or a sample in one of its texts",
    'content/measure.json: stagesFooter must say "illustrative"',
  ]);
  assert.deepEqual(illustrativeProblems(sample((input) => { input.sections.analytics.description = "Illustrative figures, not client results."; })), []);
});

test("testimonials use their own photos, not the original site's stock art", () => {
  const edited = sample((input) => {
    input.collections.testimonials = [{ file: "a.json", data: { img: "/images/reviews/review-1.webp", name: "Ada Client", role: "COO", company: "Example Ltd", quote: "They helped.", permissionConfirmed: true, order: 1 } }];
  });
  assert.deepEqual(stockImageProblems(edited), [
    "content/testimonials: the testimonial by \"Ada Client\" uses a stock portrait (/images/reviews/review-1.webp); use the client's own approved photo",
  ]);
});

test("links point at pages of this site, with or without a query or fragment, or at full addresses", () => {
  const edited = sample((input) => {
    input.home.corner.href = "/blog/";
    input.engagementsPanel.footer.href = "/#pricing";
    input.faqCard.href = "https://example.org/faq";
    input.team.cta.href = "/about/#team";
    input.process.cta.href = "/contact/?service=applied-ai";
    input.measure.cta.href = "/blog/?page=2";
    input.work.assessment.href = "/nope/#top";
  });
  const advice = "is not a page of this site; use a page such as /contact/ or /#faq, or a full https:// address";
  assert.deepEqual(linkProblems(edited, routes), [
    `link in export HOME.corner.href: "/blog/" ${advice}`,
    `link in export WORK.assessment.href: "/nope/#top" ${advice}`,
    `link in export MEASURE.cta.href: "/blog/?page=2" ${advice}`,
  ]);
});

test("check-content lists every rule's problems and changes no file (temporary project)", () => {
  const root = projectTempDir("check-rules-");
  try {
    for (const dir of ["src/lib", "scripts/lib", "public/images"]) fs.cpSync(dir, path.join(root, dir), { recursive: true });
    for (const file of ["scripts/check-content.mjs", "scripts/build-content-index.mjs"]) fs.copyFileSync(file, path.join(root, file));
    copySampleContent(root);
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    const edit = (file, change) => {
      const full = path.join(root, file);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      change(data);
      fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`);
      return fs.readFileSync(full, "utf8");
    };
    // What dragging the last engagement to the top does: the CMS renumbers order 1, 2, 3.
    const files = fs.readdirSync(path.join(root, "content", "engagements")).filter((name) => name.endsWith(".json"))
      .map((name) => ({ name, data: JSON.parse(fs.readFileSync(path.join(root, "content", "engagements", name), "utf8")) }))
      .sort((a, b) => a.data.order - b.data.order);
    const dragged = [files.at(-1), ...files.slice(0, -1)];
    const before = {};
    dragged.forEach(({ name }, index) => { before[name] = edit(`content/engagements/${name}`, (data) => { data.order = index + 1; }); });
    // Edits the site's promises do not allow.
    const role = fs.readdirSync(path.join(root, "content", "team-roles")).find((name) => name.endsWith(".json"));
    before[`team-roles/${role}`] = edit(`content/team-roles/${role}`, (data) => { data.name = "Ada Lovelace"; });
    edit("content/work.json", (work) => { work.lineup.count = "4/5"; });
    edit("content/sections.json", (sections) => { sections.analytics.description = "A look at how a pilot can be measured."; });

    const env = { ...process.env, SITE_MODE: "preview", NEXT_PUBLIC_SHOW_SAMPLES: "" };
    const result = spawnSync(process.execPath, ["--experimental-strip-types", path.join(root, "scripts", "check-content.mjs")], { cwd: path.join(root, "src"), encoding: "utf8", env });
    assert.equal(result.status, 1, result.stdout);
    const listed = result.stderr.split(/\r?\n/).filter((line) => line.startsWith("  - ")).map((line) => line.slice(4));
    assert.deepEqual(listed.filter((line) => line.includes("stage number")).map((line) => line.replace(/: set it to .*$/, "")), dragged.map(({ data }, index) =>
      `content/engagements: ${JSON.stringify(data.name)} is number ${index + 1} in the list but its stage number is ${JSON.stringify(data.stageNo)}; keep stage numbers in list order (01, 02, 03…)`));
    for (const problem of [
      'content/work.json: lineup.count is "4/5", but the site has 5 services: set it to "5/5"',
      `content/team-roles: "Ada Lovelace" ${PERSON_ADVICE}`,
      'content/sections.json: analytics.description must say that the figures are illustrative and not client results (both words "illustrative" and "not client results"), because the dashboard shows sample data',
    ]) assert.ok(listed.includes(problem), `${problem}\n${result.stderr}`);
    for (const { name } of dragged) assert.equal(fs.readFileSync(path.join(root, "content", "engagements", name), "utf8"), before[name], `${name} is left as it was`);
    assert.equal(fs.readFileSync(path.join(root, "content", "team-roles", role), "utf8"), before[`team-roles/${role}`]);
  } finally { removeProjectTemp(root); }
});
