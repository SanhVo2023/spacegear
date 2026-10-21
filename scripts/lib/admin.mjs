// What /admin/ ships: the editor page, the CMS configuration and the Sveltia CMS files pinned in
// scripts/vendor-sveltia.mjs (SVELTIA.files), nothing else. package-site copies exactly these from
// public/admin/ (not from out/: next build follows links when it copies public/, so a linked file
// would reach out/ as a regular one), and check-export checks dist/admin/ again.
// - Links (symbolic links, junctions) and hard links are refused anywhere in the folder, dot-named
//   ones included, and never followed; so are pipes and other special files.
// - Any file that is not one of ADMIN_FILES is refused: /admin/ runs under its own, looser CSP, so
//   nothing may be added to it unnoticed. In public/admin/, dotfiles are skipped (never shipped); in
//   a shipped copy they are refused.
// - The vendored files must have the pinned sha256 hashes; a shipped page or configuration must
//   equal the committed one; the page must stay noindex and free of inline scripts.
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SVELTIA } from "../vendor-sveltia.mjs";
import { listUploads } from "./uploads.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const ADMIN_DIR = path.join(ROOT, "public", "admin");
/** Every file /admin/ ships, relative to it. */
export const ADMIN_FILES = ["config.yml", "index.html", ...Object.keys(SVELTIA.files).map((file) => `sveltia/${file}`)].sort();

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
const slashes = (file) => file.replaceAll("\\", "/");

/**
 * What is wrong with an /admin/ folder (see the header). `reference` is the folder the page and the
 * configuration must equal: give it for a shipped copy (check-export), where hidden files are
 * refused too. Problems are sorted, each starting with `label` and the file.
 */
export function adminProblems(dir, { label = slashes(path.relative(process.cwd(), dir)) || ".", reference = null } = {}) {
  const shipped = reference !== null;
  const listing = listUploads(dir, { dotted: shipped });
  const at = (rel) => (rel ? `${label}/${rel}` : label);
  if (!listing) return [`${label}: is missing`];
  const self = [...listing.links, ...listing.others].find(({ rel }) => rel === "");
  if (self) return [`${label}: is ${listing.links.includes(self) ? "a link (symbolic link or junction)" : "not a folder"}; /admin/ must be a real folder`];
  const problems = [];
  for (const { rel } of listing.links) problems.push(`${at(rel)}: is a link (symbolic link or junction); /admin/ ships regular files only`);
  for (const { rel, nlink } of listing.hardLinks) problems.push(`${at(rel)}: is one file with ${nlink} names (hard links); /admin/ ships files of their own: copy it instead of linking it`);
  for (const { rel } of listing.others) problems.push(`${at(rel)}: is not a regular file`);
  const files = new Set();
  for (const { rel } of listing.files) {
    if (rel.split("/").some((segment) => segment.startsWith("."))) problems.push(`${at(rel)}: is hidden (a dotfile or inside a dot-folder), and nothing hidden may ship: remove it`);
    else if (!ADMIN_FILES.includes(rel)) problems.push(`${at(rel)}: is not part of /admin/ (only ${ADMIN_FILES.join(", ")} ship): remove it`);
    else files.add(rel);
  }
  const blocked = new Set([...listing.links, ...listing.hardLinks, ...listing.others].map(({ rel }) => rel));
  for (const rel of ADMIN_FILES) {
    if (blocked.has(rel)) continue;
    if (!files.has(rel)) {
      problems.push(`${at(rel)}: is missing`);
      continue;
    }
    const data = fs.readFileSync(path.join(dir, rel));
    if (rel.startsWith("sveltia/")) {
      if (sha256(data) !== SVELTIA.files[rel.slice("sveltia/".length)]) problems.push(`${at(rel)}: differs from the pinned ${SVELTIA.name}@${SVELTIA.version} (SVELTIA.files in scripts/vendor-sveltia.mjs)`);
      continue;
    }
    if (shipped) {
      const committed = fs.readFileSync(path.join(reference, rel));
      if (!data.equals(committed)) problems.push(`${at(rel)}: differs from ${slashes(path.join(reference, rel))}`);
    }
    if (rel === "index.html") {
      const html = data.toString("utf8");
      if (!/<meta name="robots" content="noindex/.test(html)) problems.push(`${at(rel)}: must carry a robots noindex meta tag`);
      if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) problems.push(`${at(rel)}: must not use inline scripts (its CSP allows script-src 'self' only)`);
    }
  }
  return problems.sort();
}

/**
 * Packages /admin/: refuses `from` when adminProblems lists anything (nothing is copied then),
 * otherwise empties `to`, so a removed file never lingers, and copies exactly ADMIN_FILES.
 * Returns them.
 */
export async function shipAdmin(from = ADMIN_DIR, to, { label } = {}) {
  const problems = adminProblems(from, label ? { label } : {});
  if (problems.length) throw new Error(`Refusing to ship /admin/:\n${problems.join("\n")}`);
  await fsp.rm(to, { recursive: true, force: true });
  for (const rel of ADMIN_FILES) {
    const dest = path.join(to, rel);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(path.join(from, rel), dest);
  }
  return [...ADMIN_FILES];
}
