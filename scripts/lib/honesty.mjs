// Claims public copy must never make: invented prices, the original site's metrics, press or
// partnerships, clients and scale, results, offices, experience, ratings and awards, delivery
// timelines, and the old identity. Shared by tests/content.test.mjs and scripts/check-content.mjs,
// which run it on each loaded export and on every file under content/ (JSON and Markdown alike),
// so a CMS edit cannot slip one in.
// Text is folded first (NFKC turns a fullwidth ＄４９９ into $499; soft hyphens and zero-width
// characters are dropped), and JSON files are scanned raw and decoded, so neither a look-alike
// character nor a $ escape hides a claim.
// Some rules are scoped. `where` is a content file ("content/legal/terms.md") or an export name
// ("MEASURE"):
//   - the illustrative dashboard (content/measure.json, MEASURE) may show percentages and k/M figures;
//   - the legal pages may state retention periods ("for 2 years") and name their processors (AWS).
import fs from "node:fs";
import path from "node:path";

const LEGAL = (where) => where.startsWith("content/legal/");
const MEASURE = (where) => where === "content/measure.json" || where === "MEASURE";

/** [pattern, what, { skip }]: `skip(where)` is true where the rule does not apply. */
export const FORBIDDEN = [
  [/\$\s?\d/, "a price"],
  [/97\.8|31\.2|84\.7/, "an original platform metric"],
  [/TechCrunch/, "an unverified press or partnership claim"],
  [/\bAWS\b/, "an unverified press or partnership claim", { skip: LEGAL }],
  [/Enterprise Clients|Active Users|API Calls/i, "an unverified scale claim"],
  [/Platform®|Platform B\.V\.|Platform Labs|plat—form/, "the old brand"],
  [/Book a Demo/i, "the old call to action"],
  [/®/, "a registered-trademark sign (use ™ until the mark is registered)"],
  [/Amsterdam|New York|Dubai|Keizersgracht/, "an office location"],
  [/\b\d+(?:\.\d+)?\s?[MKB]\+/, "a scale figure"],
  [/[€£¥]|\b(?:USD|EUR|GBP|VND)\b|per (?:month|year|seat)|\/\s?(?:mo|yr)\b/i, "a price"],
  [/\b\d[\d,]*\+(?!\d)/, "a scale figure"],
  [/\b\d+\s?(?:\+\s?)?years?\b/i, "an experience claim", { skip: LEGAL }],
  [/\b\d+x\b/i, "a multiplier claim"],
  // Added after the Task 6 review (scratchpad/review-p3t6/proposal.mjs).
  // \b only knows ASCII letters, so "đồng" is bounded with Unicode lookarounds.
  [/[€£¥₫₹₩₽₺₦₱฿]|\b(?:SGD|AUD|CHF|JPY|CNY|INR)\b|\b(?:dollars?|euros?|pounds?|bucks)\b|(?<![\p{L}\p{N}])đồng(?![\p{L}\p{N}])/iu, "a price"],
  [/\bper (?:hour|day|project|user|sprint)\b|\b(?:hourly|daily|day) rates?\b|\b(?:price[sd]?|pricing|fees?|costs?|rates?)\s*(?:from|of|start(?:s|ing)? (?:at|from)|:)\s*\d|\bstarting (?:at|from)\s*\d|\d\s*\/\s*(?:month|year|hr|hour|day|user|seat)\b/i, "a price"],
  [/\b\d+(?:[.,]\d+)?\s?[kKmMbB]\b/, "a price or scale figure", { skip: MEASURE }],
  [/\b\d[\d,.]*\s*\+?\s*(?:(?:happy|satisfied|enterprise|global)\s+)?(?:clients?|customers?|companies|businesses|brands|teams|users|projects|countries|partners|employees|engineers|experts)\b|\b(?:hundreds|thousands|dozens|millions)\s+of\b/i, "a client or scale claim"],
  [/\d\s?%|\bper ?cent\b/i, "a result figure", { skip: MEASURE }],
  [/\b\d+(?:\.\d+)?\s?(?:x\b|×)|\b(?:two|three|four|five|ten)(?:fold| times)\b|\b(?:doubled|tripled|quadrupled)\b/i, "a multiplier claim"],
  [/\b(?:since|founded(?:\s+in)?|est\.?|established(?:\s+in)?)\s+(?:19|20)\d{2}\b|\bdecades?\b|\b\d+\s?yrs?\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s+years?\b/i, "an experience claim", { skip: LEGAL }],
  [/\boffices?\s+(?:in|across|around)\b|\bheadquarter(?:s|ed)\b|\bHQ\b|\bbased (?:in|out of) (?!part\b)|\bour\s+[A-Z]\w+\s+(?:office|studio)\b/i, "an office location"],
  [/\b(?:as seen (?:in|on)|featured (?:in|on|by)|in the press|press coverage)\b|\b(?:Forbes|Wired|Bloomberg|Reuters|Gartner|Forrester|VentureBeat|Clutch)\b/, "an unverified press claim"],
  [/\b(?:Google|Microsoft|Amazon|Salesforce|HubSpot|SAP|Oracle|OpenAI|Anthropic|NVIDIA|IBM)\s+(?:Cloud\s+)?(?:\w+\s+)?[Pp]artner\b|\b(?:certified|official|premier|gold|silver)\s+partner\b/i, "an unverified partnership claim"],
  [/\baward[- ]winning\b|\bwinner of\b|\brated\s+\d|\b\d\.\d\s?\/\s?(?:5|10)\b|\bout of (?:5|five|10)\b|\b(?:\d|five)[- ]star\b|#\s?1\b|\bnumber one\b|\btop[- ]rated\b/i, "an unverified rating or award"],
  [/\b(?:in|within|under)\s+(?:just\s+|only\s+)?\d+\s?(?:days?|weeks?|months?|hours?)\b|\b\d+\s?(?:-|–|to)\s?\d+\s?(?:days?|weeks?|months?)\b/i, "a delivery timeline", { skip: LEGAL }],
];

/** NFKC, then soft hyphens and zero-width characters removed: what a reader sees, in plain characters. */
export const fold = (text) => text.normalize("NFKC").replace(/[­​-‍⁠﻿]/g, "");

/** Every forbidden claim in `text`, as "<what> (<match>)". `where` names the file or export, for scoped rules. */
export function findForbidden(text, where = "") {
  const folded = fold(text);
  return FORBIDDEN.flatMap(([pattern, what, scope]) => {
    if (scope?.skip(where)) return [];
    const hit = folded.match(pattern);
    return hit ? [`${what} ("${hit[0]}")`] : [];
  });
}

/** Scans each exported value (functions excluded) on its own, as "<export>: <what> (<match>)". */
export function scanExports(content) {
  return Object.entries(content)
    .filter(([, value]) => typeof value !== "function")
    .flatMap(([name, value]) => findForbidden(JSON.stringify(value), name).map((problem) => `${name}: ${problem}`));
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

/** The text scanned for one file: a JSON file raw and decoded, so an escape such as $ cannot hide a "$". */
export function scannedText(name, source) {
  if (!name.endsWith(".json")) return source;
  try {
    return `${source}\n${JSON.stringify(JSON.parse(source))}`;
  } catch {
    return source; // The loader reports the syntax error.
  }
}

/** Scans the raw text of every content file, so fields the site does not render are checked too. */
export function scanContentTree(root = ".") {
  return contentFiles(root).flatMap((file) => {
    const name = path.relative(root, file).replaceAll("\\", "/");
    return findForbidden(scannedText(name, fs.readFileSync(file, "utf8")), name).map((problem) => `${name}: ${problem}`);
  });
}
