// Claims public copy must never make: invented prices, the original site's metrics, press or
// partnerships, scale, offices, experience or multipliers, and the old identity. Shared by
// tests/content.test.mjs and scripts/check-content.mjs, which run it on the loaded content and
// on every file under content/ (JSON and Markdown alike), so a CMS edit cannot slip one in.
import fs from "node:fs";
import path from "node:path";

export const FORBIDDEN = [
  [/\$\s?\d/, "a price"],
  [/97\.8|31\.2|84\.7/, "an original platform metric"],
  [/TechCrunch|\bAWS\b/, "an unverified press or partnership claim"],
  [/Enterprise Clients|Active Users|API Calls/i, "an unverified scale claim"],
  [/Platform®|Platform B\.V\.|Platform Labs|plat—form/, "the old brand"],
  [/Book a Demo/i, "the old call to action"],
  [/®/, "a registered-trademark sign (use ™ until the mark is registered)"],
  [/Amsterdam|New York|Dubai|Keizersgracht/, "an office location"],
  [/\b\d+(?:\.\d+)?\s?[MKB]\+/, "a scale figure"],
  [/[€£¥]|\b(?:USD|EUR|GBP|VND)\b|per (?:month|year|seat)|\/\s?(?:mo|yr)\b/i, "a price"],
  [/\b\d[\d,]*\+(?!\d)/, "a scale figure"],
  [/\b\d+\s?(?:\+\s?)?years?\b/i, "an experience claim"],
  [/\b\d+x\b/i, "a multiplier claim"],
];

/** Every forbidden claim in `text`, as "<what> (<match>)". */
export function findForbidden(text) {
  return FORBIDDEN.flatMap(([pattern, what]) => {
    const hit = text.match(pattern);
    return hit ? [`${what} ("${hit[0]}")`] : [];
  });
}

/** Every editable content file (JSON or Markdown) under <root>/content, dotfiles excluded. */
export function contentFiles(root = ".") {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:json|md)$/.test(entry.name) ? [full] : [];
  });
  const dir = path.join(root, "content");
  return fs.existsSync(dir) ? walk(dir).sort() : [];
}

/** Scans the raw text of every content file, so fields the site does not render are checked too. */
export function scanContentTree(root = ".") {
  return contentFiles(root).flatMap((file) => {
    const name = path.relative(root, file).replaceAll("\\", "/");
    return findForbidden(fs.readFileSync(file, "utf8")).map((problem) => `${name}: ${problem}`);
  });
}
