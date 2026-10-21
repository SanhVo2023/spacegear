import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FORBIDDEN, contentFiles, findForbidden, scanContentTree } from "../scripts/lib/honesty.mjs";
import { publicText, readContentInput } from "./helpers/content.mjs";

const content = await import("../src/lib/content.ts");
const { buildContent } = await import("../src/lib/content-model.ts");

const PUBLIC_KEYS = ["HOME", "SECTIONS", "WORK", "PILLARS", "CORE_PANEL", "PROCESS_STEPS", "PROCESS_CTA", "APPROACH_STEPS", "MEASURE", "ENGAGEMENTS", "ENGAGEMENTS_FOOTER", "FAQS", "FAQ_CARD", "TEAM", "TEAM_ROLES", "FOUNDER", "TESTIMONIALS", "ARTICLES", "FOOTER", "SERVICES", "serviceBySlug"];

test("every public content export exists", () => {
  for (const key of PUBLIC_KEYS) assert.ok(key in content, `${key} is exported`);
});

test("public content makes no unverified claims", () => {
  const text = publicText(content);
  for (const [pattern, what] of FORBIDDEN) assert.doesNotMatch(text, pattern, `content contains ${what}`);
});

test("no file under content/ makes an unverified claim, including fields the site does not render", () => {
  const files = contentFiles(".").map((file) => file.replaceAll("\\", "/"));
  for (const file of ["content/home.json", "content/faqs/what-we-do.json", "content/legal/privacy.md", "content/legal/terms.md"]) assert.ok(files.includes(file), `the scan covers ${file}`);
  assert.deepEqual(scanContentTree("."), []);
});

test("a price written into a content entry fails both scans (temporary copy, real tree untouched)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-honesty-"));
  const planted = "content/faqs/zz-planted-price.json";
  try {
    fs.cpSync("content", path.join(root, "content"), { recursive: true });
    const entry = { question: "What does it cost?", answer: "Packages start at $499 per month.", order: 99 };
    fs.writeFileSync(path.join(root, planted), JSON.stringify(entry, null, 2));
    assert.ok(scanContentTree(root).some((problem) => problem.startsWith(`${planted}: a price`)), "the file scan flags it");
    const built = buildContent(readContentInput(root));
    assert.ok(findForbidden(publicText(built)).some((problem) => problem.startsWith("a price")), "the loaded-content scan flags it");
    assert.equal(fs.existsSync(planted), false, "the real content tree is untouched");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a price written into a legal page fails the file scan (temporary copy)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-honesty-"));
  try {
    fs.cpSync("content", path.join(root, "content"), { recursive: true });
    fs.appendFileSync(path.join(root, "content/legal/terms.md"), "\n## Fees\n\nProjects cost from 900 EUR.\n");
    assert.ok(scanContentTree(root).some((problem) => problem.startsWith("content/legal/terms.md: a price")));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// scripts/check-content.mjs runs before every build. It is run here on a temporary copy of the
// files it needs, from a folder without content/, so it must find the project from its own location.
test("check-content passes the committed content and lists every problem by file, field and fix, without a stack trace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-check-"));
  try {
    for (const dir of ["content", "src/lib", "scripts/lib"]) fs.cpSync(dir, path.join(root, dir), { recursive: true });
    for (const file of ["scripts/check-content.mjs", "scripts/build-content-index.mjs"]) fs.copyFileSync(file, path.join(root, file));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    const env = { ...process.env, SITE_MODE: "preview", NEXT_PUBLIC_SHOW_SAMPLES: "" };
    const run = () => spawnSync(process.execPath, ["--experimental-strip-types", path.join(root, "scripts", "check-content.mjs")], { cwd: path.join(root, "src"), encoding: "utf8", env });
    const listed = (result) => result.stderr.split(/\r?\n/).filter((line) => line.startsWith("  - ")).map((line) => line.slice(4));
    const edit = (file, change) => {
      const full = path.join(root, file);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      change(data);
      fs.writeFileSync(full, JSON.stringify(data, null, 2));
    };

    let result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Content valid: 12 routes; preview mode\./);

    // A price in loaded copy: both scans name it.
    edit("content/faqs/what-we-do.json", (faq) => { faq.answer = "Packages start at $499 per month."; });
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^Content check failed\. Fix these problems:$/m);
    for (const problem of ['content contains a price ("$4")', 'forbidden claim in content/faqs/what-we-do.json: a price ("$4")']) {
      assert.ok(listed(result).includes(problem), `${problem}\n${result.stderr}`);
    }

    // Problems in several files are listed together, each with its file and fix.
    edit("content/home.json", (home) => { home.cta.label = ""; });
    edit("content/site.json", (site) => { site.socialProfiles = ["http://example.com/profile"]; });
    fs.writeFileSync(path.join(root, "content/faqs/zz-new.json"), JSON.stringify({ question: "A new question?", answer: "A new answer.", order: 98 }));
    const terms = path.join(root, "content/legal/terms.md");
    fs.appendFileSync(terms, "\n## Contact\n\nWrite to legal_team@example.com.\n");
    const termsLine = fs.readFileSync(terms, "utf8").split("\n").length - 1;
    result = run();
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /^\s+at /m, "no stack trace");
    for (const problem of [
      "src/lib/content-index.generated.ts is out of date: run npm run content:index",
      "content/home.json: cta.label: required",
      "content/site.json: socialProfiles[0]: use a full https:// profile address",
      `content/legal/terms.md, line ${termsLine}: "_" in "…ite to legal_team@example…": write the text without * _ \` < > [ ] \\ | ~~ or &…;`,
      'forbidden claim in content/faqs/what-we-do.json: a price ("$4")',
    ]) assert.ok(listed(result).includes(problem), `${problem}\n${result.stderr}`);

    // A file that is not valid JSON is named from the project folder.
    fs.writeFileSync(path.join(root, "content/faqs/who-we-work-with.json"), '{ "question": ');
    result = run();
    assert.equal(result.status, 1);
    assert.ok(listed(result).some((problem) => problem.startsWith("content/faqs/who-we-work-with.json: ")), result.stderr);
    assert.doesNotMatch(result.stderr, /^\s+at /m, "no stack trace");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("hero copy keeps the original four-line headline rhythm", () => {
  const { HOME } = content;
  assert.equal(HOME.headline.verbs.length, 3);
  assert.deepEqual(HOME.headline.verbs, ["plan", "build", "scale"]);
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
  const art = (slug) => content.serviceBySlug(slug).image;
  for (const item of [...content.WORK.tiles, ...content.PILLARS]) assert.equal(item.img, art(item.slug), `${item.slug} uses its service image`);
  assert.equal(content.WORK.featured.img, art(content.WORK.featured.href.split("/")[2]), "featured tile uses its service image");
});

test("process steps count real outputs instead of invented timings", () => {
  for (const step of [...content.PROCESS_STEPS, ...content.APPROACH_STEPS]) {
    assert.ok(step.outputs.length >= 1, step.step);
    for (const key of Object.keys(step)) assert.ok(["step", "name", "desc", "outputs"].includes(key), `${step.step} has unexpected key ${key}`);
  }
});

test("engagements carry no prices and exactly one starting point", () => {
  for (const engagement of content.ENGAGEMENTS) {
    for (const key of Object.keys(engagement)) assert.ok(["name", "short", "img", "stage", "stageNo", "deliverables", "outcomes", "featured"].includes(key), `${engagement.name} has unexpected key ${key}`);
    assert.ok(engagement.deliverables.length >= 3 && engagement.outcomes.length >= 3, engagement.name);
  }
  assert.equal(content.ENGAGEMENTS.filter((engagement) => engagement.featured).length, 1);
});

test("the team section shows roles, not invented people", () => {
  for (const role of content.TEAM_ROLES) {
    assert.doesNotMatch(role.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/, `${role.name} looks like a person's name`);
    assert.doesNotMatch(role.img, /images\/team\//, "role cards must not use the stock portraits");
    assert.equal(role.links.length, 0, `${role.name} must not link to invented profiles`);
  }
  if (content.FOUNDER) assert.ok(content.FOUNDER.name && content.FOUNDER.img && content.FOUNDER.bio, "founder card needs a real name, photo and bio");
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

test("every illustrative card says so", () => {
  for (const key of ["workflow", "accuracy", "throughput", "readiness", "coverage"]) {
    assert.match(JSON.stringify(content.MEASURE[key]), /illustrative|example|sample/i, `MEASURE.${key} is labelled`);
  }
  assert.match(content.MEASURE.stagesFooter, /illustrative/i);
});

test("displayed counts match the data", () => {
  const n = content.SERVICES.length;
  const pad = (v) => String(v).padStart(2, "0");
  assert.equal(content.HOME.stats[0].value, pad(n));
  assert.equal(content.HOME.stats[1].value, pad(content.ENGAGEMENTS.length));
  assert.equal(content.HOME.stats[1].sub.toLowerCase(), content.ENGAGEMENTS.map((e) => e.short.toLowerCase()).join(", "), "the second hero stat names the engagements it counts");
  assert.equal(content.WORK.lineup.count, `${n}/${n}`);
  assert.equal(content.CORE_PANEL.count, `${n}/${n}`);
  assert.equal(content.PILLARS.length, n);
  assert.equal(content.WORK.assessment.badge, `01/${pad(content.ENGAGEMENTS.length)}`);
});

test("internal links point at real pages", () => {
  const hrefs = [];
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (key === "href" && typeof child === "string") hrefs.push(child);
        else walk(child);
      }
    }
  };
  for (const value of Object.values(content)) if (typeof value !== "function") walk(value);
  const allowed = new Set(["/", "/services/", "/approach/", "/about/", "/contact/", "/privacy/", "/terms/"]);
  for (const service of content.SERVICES) allowed.add(`/services/${service.slug}/`);
  for (const id of Object.keys(content.SECTIONS)) allowed.add(`/#${id}`);
  assert.ok(hrefs.length > 0, "found hrefs");
  for (const href of hrefs) assert.ok(allowed.has(href) || /^https?:\/\//.test(href), `${href} is not a real page`);
});
