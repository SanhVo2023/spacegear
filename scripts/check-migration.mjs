// One-off check that the CMS migration changed no copy. It is not part of `npm test`, because
// every deliberate copy edit makes it fail: that is the CMS doing its job, not a regression.
// It compares what the site loads today with the copy frozen in tests/fixtures/:
//   - every export of src/lib/content.ts, key order included (content-v1.json, "values"), and
//     buildContent() run on the files read from content/ without the generated index, which must
//     give the same exports; serviceBySlug finds every service;
//   - the site name, description and social profiles ("site"; the export names and the routes
//     stay in npm test, because no CMS edit can change them);
//   - the privacy and terms text: the headings, the paragraphs per section and the full text
//     (legal-v1.json, taken from the pages' JSX before the text moved);
//   - every JSON file under content/, as parsed values (content-files-v1.json), so content that
//     the site does not show, such as a testimonial without permission, is compared too.
// Run it when a change must leave the copy alone and no copy has been edited since the fixture
// was taken, for example at a merge (README.md, "The migration check").
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { register } from "tsx/esm/api";
import { COLLECTIONS, ROOT, listEntries } from "./build-content-index.mjs";
import { pathsFromRoot } from "./lib/project-path.mjs";

const HELP = `Usage: node scripts/check-migration.mjs [--refresh | --refresh-structure | --help]

Compares the content with the copy frozen in tests/fixtures/ (README.md, "The migration check").
After a deliberate copy edit it is expected to fail.

  --refresh            take the current copy as the new reference point: rewrite the values in
                       tests/fixtures/content-v1.json, legal-v1.json and content-files-v1.json.
                       The export names and the routes, which npm test checks, are kept.
  --refresh-structure  the same, and also take the export names and the routes from the code,
                       after a deliberate change to them.

In the messages, character positions count from 1, and list positions count from 0:
FAQS[0] is the first question, and "from character 1" is the first character.`;

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(HELP);
  process.exit(0);
}
const unknown = args.filter((arg) => !["--refresh", "--refresh-structure"].includes(arg));
if (unknown.length) {
  console.error(`Unknown option ${unknown.join(" ")}.\n\n${HELP}`);
  process.exit(2);
}
const refreshStructure = args.includes("--refresh-structure");
const refresh = refreshStructure || args.includes("--refresh");

const CONTENT_FIXTURE = "tests/fixtures/content-v1.json";
const LEGAL_FIXTURE = "tests/fixtures/legal-v1.json";
const FILES_FIXTURE = "tests/fixtures/content-files-v1.json";
const MAX_PER_CHECK = 5;
const fromRoot = pathsFromRoot(ROOT);

function stop(lines) {
  console.error(lines.join("\n"));
  process.exit(1);
}

/** A frozen copy, or a clear stop when it is missing or broken. */
function readFixture(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) stop([`Migration check stopped: ${file} is missing. It holds the frozen copy that the check compares with; restore it from Git (git checkout -- ${file}).`]);
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    return stop([`Migration check stopped: ${file} is not valid JSON (${error.message}); restore it from Git (git checkout -- ${file}).`]);
  }
}

/**
 * Runs `load`. Content that does not load (a ContentError or LegalPageError with its issues, a
 * broken or missing content file) stops the check with the problems, as check-content prints them;
 * any other error is a bug and keeps its stack.
 */
async function loading(load) {
  try {
    return await load();
  } catch (error) {
    const message = error instanceof Error ? fromRoot(error.message) : String(error);
    const contentFile = (error instanceof SyntaxError || ["ERR_MODULE_NOT_FOUND", "ENOENT"].includes(error?.code)) && /(?:^|[\s'"])content\//.test(message);
    const issues = Array.isArray(error?.issues) ? error.issues : contentFile ? [message] : null;
    if (!issues) throw error;
    return stop([
      "Migration check stopped: the content does not load, so it cannot be compared. Fix these problems first (node --experimental-strip-types scripts/check-content.mjs lists them all):",
      ...issues.map((issue) => `  - ${fromRoot(issue)}`),
    ]);
  }
}

// src/lib/site.ts imports "./content" without an extension, which only tsx resolves.
register();
const { LEGAL_PAGES, legalSections } = await import("../src/lib/legal.ts");
const { SINGLETON_FILES, buildContent } = await import("../src/lib/content-model.ts");
const readJson = (file) => {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  try { return JSON.parse(source); } catch (error) { throw new SyntaxError(`${file}: ${error.message}`, { cause: error }); }
};
// Every content file is parsed before the loader imports it: tsx reports a broken JSON import
// with a stack only, outside any catch.
const filesNow = await loading(() => contentFiles());
const content = await loading(() => import("../src/lib/content.ts"));
const { SITE, getPublishedRoutes } = await loading(() => import("../src/lib/site.ts"));
const writeJson = (file, value) => fs.writeFileSync(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`);
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const show = (value) => {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 90 ? `${text.slice(0, 89)}…` : text;
};
const items = (count) => `${count} ${count === 1 ? "item" : "items"}`;
const siteIdentity = () => ({ name: SITE.name, description: SITE.description, socialProfiles: SITE.socialProfiles });
/** `value` with every object's keys sorted, to compare values whatever order a file keeps them in. */
const sortKeys = (value) => (Array.isArray(value) ? value.map(sortKeys) : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])])) : value);

/** Two texts from just before the first character where they differ (counted in code points, from 1). */
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

/** Every JSON file under content/ (dotfiles excluded), parsed, by its path from the project folder. */
function contentFiles() {
  const out = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name.startsWith(".")) continue;
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".json")) out[rel] = readJson(rel);
    }
  };
  walk("content");
  return out;
}

const values = () => Object.fromEntries(Object.entries(content).filter(([, value]) => typeof value !== "function").sort(([a], [b]) => (a < b ? -1 : 1)));
const legalNow = await loading(() => Object.fromEntries(LEGAL_PAGES.map((page) => [page, legalSections(page, ROOT)])));
const built = await loading(() => buildContent(contentInput()));

if (refresh) {
  let dirty = "";
  try { dirty = execFileSync("git", ["status", "--porcelain", "--", "tests/fixtures"], { cwd: ROOT, encoding: "utf8" }).trimEnd(); } catch { dirty = ""; }
  if (dirty) console.warn(`Warning: tests/fixtures/ already has uncommitted changes, which the refresh may overwrite:\n${dirty}\n`);
  const old = readFixture(CONTENT_FIXTURE);
  const oldLegal = readFixture(LEGAL_FIXTURE);
  const oldFiles = readFixture(FILES_FIXTURE);
  const next = {
    exports: refreshStructure ? Object.keys(content).sort() : old.exports,
    values: values(),
    site: { ...siteIdentity(), routes: refreshStructure ? getPublishedRoutes() : old.site.routes },
  };
  const changed = [];
  const names = [...new Set([...Object.keys(old.values), ...Object.keys(next.values)])].sort();
  const exportsChanged = names.filter((name) => JSON.stringify(old.values[name]) !== JSON.stringify(next.values[name]));
  if (exportsChanged.length) changed.push(`the values of ${exportsChanged.join(", ")}`);
  const { routes: oldRoutes, ...oldIdentity } = old.site;
  if (!isDeepStrictEqual(oldIdentity, siteIdentity())) changed.push("the site identity");
  if (refreshStructure && JSON.stringify(old.exports) !== JSON.stringify(next.exports)) changed.push("the export names");
  if (refreshStructure && JSON.stringify(oldRoutes) !== JSON.stringify(next.site.routes)) changed.push("the routes");
  const legalChanged = LEGAL_PAGES.filter((page) => JSON.stringify(oldLegal.pages?.[page]) !== JSON.stringify(legalNow[page]));
  if (legalChanged.length) changed.push(`the ${legalChanged.join(" and ")} text`);
  const filePaths = [...new Set([...Object.keys(oldFiles.files ?? {}), ...Object.keys(filesNow)])].sort();
  const filesChanged = filePaths.filter((file) => !isDeepStrictEqual(sortKeys(oldFiles.files?.[file]), sortKeys(filesNow[file])));
  if (filesChanged.length) changed.push(`${filesChanged.length} content ${filesChanged.length === 1 ? "file" : "files"} (${filesChanged.join(", ")})`);
  writeJson(CONTENT_FIXTURE, next);
  writeJson(LEGAL_FIXTURE, {
    about: legalChanged.length
      ? "The privacy and terms sections that scripts/check-migration.mjs compares with content/legal/, refreshed from it with --refresh (README.md, \"The migration check\"). The first version was the pre-CMS JSX of src/app/privacy/page.tsx and src/app/terms/page.tsx at f1224a3^."
      : oldLegal.about,
    pages: legalNow,
  });
  writeJson(FILES_FIXTURE, { about: oldFiles.about, files: filesNow });
  console.log(changed.length
    ? `Refreshed tests/fixtures/ from the current content. Changed: ${changed.join("; ")}.`
    : "Refreshed tests/fixtures/ from the current content: nothing changed.");
  if (!refreshStructure && (JSON.stringify(Object.keys(content).sort()) !== JSON.stringify(old.exports) || JSON.stringify(getPublishedRoutes()) !== JSON.stringify(oldRoutes))) {
    console.log("The export names or the routes in the code differ from the fixture. They were kept; npm test reports them. After a deliberate change, run --refresh-structure.");
  }
  console.log("Review git diff tests/fixtures, then commit it on its own, with the reason in the message.\n");
}

const fixture = readFixture(CONTENT_FIXTURE);
const legal = readFixture(LEGAL_FIXTURE).pages;
const frozenFiles = readFixture(FILES_FIXTURE).files;
const problems = [];
const check = (what, before, now, at) => {
  const found = differences(before, now, at);
  if (found.length) problems.push(`${what}:`, ...found.map((line) => `    ${line}`));
};

for (const [name, value] of Object.entries(fixture.values)) check(`src/lib/content.ts export ${name} differs from the frozen copy`, value, content[name], name);
// The same loader on the files themselves: a stale index or a file the index misses shows here.
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
  const now = legalNow[page];
  check(`content/legal/${page}.md has other headings than before`, before.map((section) => section.heading), now.map((section) => section.heading), "headings");
  // One plain paragraph per section in the pre-CMS copy.
  const counts = (sections) => Object.fromEntries(sections.map((section) => [section.heading, section.paragraphs.length]));
  check(`content/legal/${page}.md has other paragraph counts than before`, counts(before), counts(now), "paragraphs");
  check(`content/legal/${page}.md text differs from the frozen copy`, before, now, page);
}
// Every file, including what the exports leave out. Key order is free here: the files are compared as values.
const changedFiles = [];
for (const file of [...new Set([...Object.keys(frozenFiles), ...Object.keys(filesNow)])].sort()) {
  if (!(file in filesNow)) changedFiles.push(`    ${file}: removed`);
  else if (!(file in frozenFiles)) changedFiles.push(`    ${file}: a new file`);
  else {
    const found = differences(sortKeys(frozenFiles[file]), sortKeys(filesNow[file]), "", []).slice(0, 2);
    for (const line of found) changedFiles.push(`    ${file}: ${line.replace(/^\.?/, "")}`);
  }
}
if (changedFiles.length) problems.push("the files in content/ differ from the frozen copy (this includes content the site does not show):", ...changedFiles);

if (problems.length) {
  console.error([
    "Migration check failed: the content differs from the copy frozen in tests/fixtures/ (the pre-CMS copy, unless the fixture was refreshed).",
    ...problems.map((line) => (line.startsWith("    ") ? line : `  - ${line}`)),
    "Character positions count from 1, list positions from 0 (FAQS[0] is the first question).",
    "This is expected after a deliberate copy edit. README.md, \"The migration check\", says when to run this check and how to refresh the fixture.",
  ].join("\n"));
  process.exitCode = 1;
} else {
  const sections = LEGAL_PAGES.map((page) => `${legal[page].length} ${page}`).join(" and ");
  console.log(`Migration check passed: the ${Object.keys(fixture.values).length} content exports (${Object.keys(built).length} of them also built from the files in content/), serviceBySlug, the site identity, the legal text (${sections} sections) and the ${Object.keys(filesNow).length} JSON files in content/ equal the copy frozen in tests/fixtures/. npm test checks the ${routes.length} routes.`);
}
