// One-off check that the CMS migration changed no copy. It is not part of `npm test`, because
// every deliberate copy edit makes it fail: that is the CMS doing its job, not a regression.
// It compares what the site loads today with the copy frozen before the migration:
//   - every export of src/lib/content.ts, key order included (tests/fixtures/content-v1.json,
//     "values"), and buildContent() run on the files read from content/ without the generated
//     index, which must give the same exports; serviceBySlug finds every service;
//   - the site name, description and social profiles ("site"; the routes stay in npm test,
//     because no CMS edit can change them);
//   - the privacy and terms text: the exact headings, one paragraph per section and the full
//     text (tests/fixtures/legal-v1.json, taken from the pages' JSX before the text moved).
// Run it when a change must leave the copy alone and no copy has been edited since the fixture
// was taken, for example at a merge. --refresh rewrites the fixture from the current content,
// to take a new reference point (README.md, "The migration check").
//   node scripts/check-migration.mjs [--refresh]
import fs from "node:fs";
import path from "node:path";
import { register } from "tsx/esm/api";
import { COLLECTIONS, ROOT, listEntries } from "./build-content-index.mjs";

// src/lib/site.ts imports "./content" without an extension, which only tsx resolves.
register();
const { LEGAL_PAGES, legalSections } = await import("../src/lib/legal.ts");
const { SINGLETON_FILES, buildContent } = await import("../src/lib/content-model.ts");
const content = await import("../src/lib/content.ts");
const { SITE, getPublishedRoutes } = await import("../src/lib/site.ts");

const CONTENT_FIXTURE = "tests/fixtures/content-v1.json";
const LEGAL_FIXTURE = "tests/fixtures/legal-v1.json";
const MAX_PER_CHECK = 5;
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const writeJson = (file, value) => fs.writeFileSync(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`);
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const show = (value) => {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 90 ? `${text.slice(0, 89)}…` : text;
};
const items = (count) => `${count} ${count === 1 ? "item" : "items"}`;
const siteIdentity = () => ({ name: SITE.name, description: SITE.description, socialProfiles: SITE.socialProfiles });

/** Two texts from just before the first character where they differ (counted in code points). */
function textChange(before, now, at) {
  const [a, b] = [[...before], [...now]];
  let first = 0;
  while (first < a.length && a[first] === b[first]) first++;
  const start = Math.max(0, first - 30);
  const cut = (chars) => JSON.stringify(`${start > 0 ? "…" : ""}${chars.slice(start, first + 50).join("")}${chars.length > first + 50 ? "…" : ""}`);
  return `${at}, from character ${first + 1}: ${cut(a)} before, ${cut(b)} now`;
}

/**
 * Where `now` differs from `before`, as "<path>: <before> before, <now> now", at most
 * MAX_PER_CHECK places. Key order counts, as it did when the fixture was taken. List positions
 * start at 0, as in check-content's messages.
 */
function differences(before, now, at, out = []) {
  if (out.length >= MAX_PER_CHECK || JSON.stringify(before) === JSON.stringify(now)) return out;
  if (Array.isArray(before) && Array.isArray(now)) {
    if (before.length !== now.length) out.push(`${at}: ${items(before.length)} before, ${items(now.length)} now`);
    for (let index = 0; index < Math.max(before.length, now.length); index++) {
      if (index >= before.length) out.push(`${at}[${index}]: missing before, ${show(now[index])} now`);
      else if (index >= now.length) out.push(`${at}[${index}]: ${show(before[index])} before, missing now`);
      else differences(before[index], now[index], `${at}[${index}]`, out);
    }
  } else if (typeof before === "string" && typeof now === "string") {
    out.push(textChange(before, now, at));
  } else if (isRecord(before) && isRecord(now)) {
    const keysBefore = Object.keys(before);
    const keysNow = Object.keys(now);
    for (const key of keysBefore.filter((name) => !Object.hasOwn(now, name))) out.push(`${at}.${key}: ${show(before[key])} before, missing now`);
    for (const key of keysNow.filter((name) => !Object.hasOwn(before, name))) out.push(`${at}.${key}: missing before, ${show(now[key])} now`);
    const shared = keysBefore.filter((name) => Object.hasOwn(now, name));
    if (shared.join() !== keysNow.filter((name) => Object.hasOwn(before, name)).join()) out.push(`${at}: keys in another order (${shared.join(", ")} before)`);
    for (const key of shared) differences(before[key], now[key], `${at}.${key}`, out);
  } else out.push(`${at}: ${show(before)} before, ${show(now)} now`);
  return out.slice(0, MAX_PER_CHECK);
}

/** content/ as buildContent() takes it, read from disk (as tests/helpers/content.mjs does). */
function contentInput() {
  const input = Object.fromEntries(Object.entries(SINGLETON_FILES).map(([name, file]) => [name, readJson(file)]));
  input.collections = Object.fromEntries(COLLECTIONS.map((collection) => [
    collection,
    listEntries(ROOT, collection).map((file) => ({ file, data: readJson(`content/${collection}/${file}`) })),
  ]));
  return input;
}

if (process.argv.includes("--refresh")) {
  // The same form as the original fixture: names sorted, functions left out.
  const values = Object.fromEntries(Object.entries(content).filter(([, value]) => typeof value !== "function").sort(([a], [b]) => (a < b ? -1 : 1)));
  writeJson(CONTENT_FIXTURE, { exports: Object.keys(content).sort(), values, site: { ...siteIdentity(), routes: getPublishedRoutes() } });
  writeJson(LEGAL_FIXTURE, {
    about: "The privacy and terms sections that scripts/check-migration.mjs compares with content/legal/, refreshed from it with --refresh (README.md, \"The migration check\"). The first version was the pre-CMS JSX of src/app/privacy/page.tsx and src/app/terms/page.tsx at f1224a3^.",
    pages: Object.fromEntries(LEGAL_PAGES.map((page) => [page, legalSections(page, ROOT)])),
  });
  console.log(`Refreshed ${CONTENT_FIXTURE} and ${LEGAL_FIXTURE} from the current content. Review git diff tests/fixtures, then commit it with the reason.`);
}

const fixture = readJson(CONTENT_FIXTURE);
const legal = readJson(LEGAL_FIXTURE).pages;
const problems = [];
const check = (what, before, now, at) => {
  const found = differences(before, now, at);
  if (found.length) problems.push(`${what}:`, ...found.map((line) => `    ${line}`));
};

for (const [name, value] of Object.entries(fixture.values)) check(`src/lib/content.ts export ${name} differs from the frozen copy`, value, content[name], name);
// The same loader on the files themselves: a stale index or a file the index misses shows here.
const built = buildContent(contentInput());
for (const [name, value] of Object.entries(built)) check(`buildContent() on the files in content/ differs from the ${name} export`, content[name], value, name);
for (const service of fixture.values.SERVICES) {
  let found;
  try { found = content.serviceBySlug(service.slug); } catch (error) { found = `throws ${error.message}`; }
  check(`serviceBySlug("${service.slug}") differs from that service in SERVICES`, content.SERVICES.find((item) => item.slug === service.slug) ?? "no such service", found, "service");
}
const { routes, ...identity } = fixture.site;
check("the site identity (content/site.json) differs from the frozen copy", identity, siteIdentity(), "SITE");
for (const page of LEGAL_PAGES) {
  const before = legal[page];
  const now = legalSections(page, ROOT);
  check(`content/legal/${page}.md has other headings than before`, before.map((section) => section.heading), now.map((section) => section.heading), "headings");
  // One plain paragraph per section in the pre-CMS copy.
  const counts = (sections) => Object.fromEntries(sections.map((section) => [section.heading, section.paragraphs.length]));
  check(`content/legal/${page}.md has other paragraph counts than before`, counts(before), counts(now), "paragraphs");
  check(`content/legal/${page}.md text differs from the frozen copy`, before, now, page);
}

if (problems.length) {
  console.error([
    "Migration check failed: the content differs from the copy frozen in tests/fixtures/ (the pre-CMS copy, unless the fixture was refreshed).",
    ...problems.map((line) => (line.startsWith("    ") ? line : `  - ${line}`)),
    "This is expected after a deliberate copy edit. README.md, \"The migration check\", says when to run this check and how to refresh the fixture.",
  ].join("\n"));
  process.exitCode = 1;
} else {
  const sections = LEGAL_PAGES.map((page) => `${legal[page].length} ${page}`).join(" and ");
  console.log(`Migration check passed: the ${Object.keys(fixture.values).length} content exports (${Object.keys(built).length} of them also built from the files in content/), serviceBySlug, the site identity and the legal text (${sections} sections) equal the copy frozen in tests/fixtures/. npm test checks the ${routes.length} routes.`);
}
