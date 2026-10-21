// Checks the site copy before every build (`npm run build` runs it; it also runs on its own:
// node --experimental-strip-types scripts/check-content.mjs). Every check runs, and every
// problem is printed in one list that names the file, the field or line, and the fix; then the
// script exits 1. Paths resolve from the project folder (ROOT), wherever the command runs.
import fs from "node:fs";
import path from "node:path";
import { validatePublication } from "../src/lib/publication.ts";
import { parseContent } from "../src/lib/content-schema.ts";
import { siteSchema } from "../src/lib/content-model.ts";
import { LEGAL_PAGES, legalSections } from "../src/lib/legal.ts";
import { INDEX_FILE, ROOT, readIndex, renderIndex } from "./build-content-index.mjs";
import { scanContentTree, scanExports } from "./lib/honesty.mjs";
const mode = process.argv.includes("--production") ? "production" : process.env.SITE_MODE || "preview";
const errors = [];
// Node names a broken JSON import (or a missing entry) by its absolute path: print it from ROOT.
// Windows paths are case-insensitive, so the match is too.
const projectPath = new RegExp(`${ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\s'":]*)`, process.platform === "win32" ? "gi" : "g");
const fromRoot = (message) => message.replace(projectPath, (_, rest) => rest.replaceAll("\\", "/"));
/** Errors that describe the content (a file to fix), not a bug in the code. */
const isContentError = (error) => error instanceof SyntaxError || ["ERR_MODULE_NOT_FOUND", "ENOENT"].includes(error?.code);
/**
 * Runs one check. A content error adds its list of problems (ContentError, LegalPageError) or its
 * message (broken JSON, missing file); anything else is a bug in the code and keeps its stack.
 */
async function attempt(run) {
  try {
    return await run();
  } catch (error) {
    if (Array.isArray(error?.issues)) errors.push(...error.issues);
    else if (isContentError(error)) errors.push(fromRoot(error.message));
    else errors.push(error instanceof Error && error.stack ? error.stack : String(error));
    return undefined;
  }
}
const readJson = (file) => {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  try { return JSON.parse(source); } catch (error) { throw new SyntaxError(`${file}: ${error.message}`, { cause: error }); }
};
// The CMS writes content/; the build regenerates the entry index first, so a stale index means
// this script ran on its own: `npm run content:index` fixes it.
await attempt(() => { if (readIndex() !== renderIndex()) errors.push(`${INDEX_FILE} is out of date: run npm run content:index`); });
// Loading the module validates every content file and lists all problems at once. src/lib/site.ts
// validates content/site.json the same way when the site builds.
const content = await attempt(() => import("../src/lib/content.ts"));
await attempt(() => parseContent(siteSchema, readJson("content/site.json"), "content/site.json"));
for (const page of LEGAL_PAGES) await attempt(() => legalSections(page, ROOT));
let routes = [];
if (content) {
  const { SERVICES, CASE_STUDIES } = content;
  routes = ["/", "/services/", ...SERVICES.map((s) => `/services/${s.slug}/`), ...["about", "approach", "contact", "privacy", "terms"].map((s) => `/${s}/`)];
  errors.push(...validatePublication({ mode, origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8787", contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL, policiesApproved: process.env.POLICIES_APPROVED === "true" }, routes));
  for (const service of SERVICES) {
    if (!service.summary || !service.buyerProblem || !service.deliverables.length || !service.faqs.length) errors.push(`incomplete service: ${service.slug}`);
  }
  if (CASE_STUDIES.some((study) => study.published && !study.approved)) errors.push("unverified published case study");
  // Honesty (scripts/lib/honesty.mjs): no invented prices, clients, results, offices, press or
  // timelines in any loaded export (each scanned on its own, for the scoped rules)...
  for (const problem of scanExports(content)) errors.push(`forbidden claim in export ${problem}`);
}
// ...or in any file under content/, including fields the site does not render.
await attempt(() => { for (const problem of scanContentTree(ROOT)) errors.push(`forbidden claim in ${problem}`); });
// `next build` always inlines NODE_ENV=production; sample mode exists only under `next dev`.
if (process.env.NEXT_PUBLIC_SHOW_SAMPLES === "true") errors.push("sample sections are only available under `next dev`; unset NEXT_PUBLIC_SHOW_SAMPLES to build");
if (errors.length) {
  console.error(`Content check failed. Fix these problems:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
  process.exitCode = 1;
} else console.log(`Content valid: ${routes.length} routes; ${mode} mode.`);
