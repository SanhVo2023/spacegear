import { test } from "node:test";
import assert from "node:assert/strict";

const content = await import("../src/lib/content.ts");

const PUBLIC_KEYS = ["HOME", "SECTIONS", "WORK", "PILLARS", "CORE_PANEL", "PROCESS_STEPS", "PROCESS_CTA", "APPROACH_STEPS", "MEASURE", "ENGAGEMENTS", "ENGAGEMENTS_FOOTER", "FAQS", "FAQ_CARD", "TEAM", "TEAM_ROLES", "FOUNDER", "TESTIMONIALS", "ARTICLES", "FOOTER", "SERVICES"];
const FORBIDDEN = [
  [/\$\s?\d/, "a price"],
  [/97\.8|31\.2|84\.7/, "an original platform metric"],
  [/TechCrunch|\bAWS\b/, "an unverified press or partnership claim"],
  [/Enterprise Clients|Active Users|Deployments|API Calls/i, "an unverified scale claim"],
  [/Platform®|Platform B\.V\.|Platform Labs|plat—form/, "the old brand"],
  [/Book a Demo/i, "the old call to action"],
  [/®/, "a registered-trademark sign (use ™ until the mark is registered)"],
  [/Amsterdam|New York|Dubai|Keizersgracht/, "an office location"],
  [/\b\d+(?:\.\d+)?\s?[MKB]\+/, "a scale figure"],
];

test("every public content export exists", () => {
  for (const key of PUBLIC_KEYS) assert.ok(key in content, `${key} is exported`);
});

test("public content makes no unverified claims", () => {
  const text = JSON.stringify(PUBLIC_KEYS.map((key) => content[key]));
  for (const [pattern, what] of FORBIDDEN) assert.doesNotMatch(text, pattern, `content contains ${what}`);
});

test("hero copy keeps the original four-line headline rhythm", () => {
  const { HOME } = content;
  assert.equal(HOME.headline.verbs.length, 3);
  assert.ok(HOME.headline.verbs.every((verb) => verb.length <= 6), "hero verbs must stay short");
  assert.equal(HOME.stats.length, 2);
  assert.equal(HOME.cta.label, "Discuss a project");
  assert.ok(HOME.pitch.text.length <= 48, "pitch line fits on one line like the original");
});

test("every section header has a title, a three-digit index, a heading and a description", () => {
  for (const [id, copy] of Object.entries(content.SECTIONS)) {
    for (const field of ["title", "index", "heading", "description"]) assert.ok(copy[field], `${id}.${field}`);
    assert.match(copy.index, /^\d{3}$/, `${id}.index`);
  }
});

test("illustrative measures are labelled as such", () => {
  assert.equal(content.MEASURE.illustrative, true);
  assert.match(content.SECTIONS.analytics.description, /illustrative/i);
  assert.match(content.SECTIONS.analytics.description, /not client results/i);
});

test("work tiles and service pillars point at real service pages", () => {
  const slugs = new Set(content.SERVICES.map((service) => service.slug));
  assert.equal(content.WORK.tiles.length, 4);
  for (const tile of content.WORK.tiles) assert.ok(slugs.has(tile.slug), tile.slug);
  assert.deepEqual(content.PILLARS.map((pillar) => pillar.slug).sort(), [...slugs].sort(), "one pillar per service");
});

test("process steps count real outputs instead of invented timings", () => {
  for (const step of [...content.PROCESS_STEPS, ...content.APPROACH_STEPS]) {
    assert.ok(step.outputs.length >= 1, step.step);
    assert.equal("metric" in step, false, `${step.step} has no timing metric`);
  }
});

test("engagements carry no prices and exactly one starting point", () => {
  for (const engagement of content.ENGAGEMENTS) {
    assert.equal("price" in engagement, false, engagement.name);
    assert.ok(engagement.deliverables.length >= 3 && engagement.outcomes.length >= 3, engagement.name);
  }
  assert.equal(content.ENGAGEMENTS.filter((engagement) => engagement.featured).length, 1);
});

test("the team section shows roles, not invented people", () => {
  for (const role of content.TEAM_ROLES) {
    assert.doesNotMatch(role.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/, `${role.name} looks like a person's name`);
    assert.doesNotMatch(role.img, /images\/team\//, "role cards must not use the stock portraits");
  }
});

test("testimonials and articles only hold publishable entries", () => {
  for (const item of content.TESTIMONIALS) {
    assert.equal(item.permissionConfirmed, true);
    assert.ok(item.name && item.company && item.quote && item.img);
    assert.doesNotMatch(item.img, /images\/reviews\//, "use the client's own approved photo");
  }
  for (const article of content.ARTICLES) {
    assert.ok(article.href && article.title && article.author);
    assert.doesNotMatch(article.img, /images\/labs\//, "use the article's own image");
  }
});

test("sample preview data is not part of public content", () => {
  for (const key of Object.keys(content)) assert.doesNotMatch(key, /SAMPLE/);
});
