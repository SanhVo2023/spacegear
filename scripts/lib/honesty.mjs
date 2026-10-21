// Claims public copy must never make: invented prices, the original site's metrics, press or
// partnerships, clients and scale, results, offices, experience, ratings, awards and
// certifications, delivery timelines, and the old identity. Shared by tests/content.test.mjs and
// scripts/check-content.mjs, which run it on each loaded export and on every file under content/
// (JSON and Markdown alike), so a CMS edit cannot slip one in, even in a field the site does not
// render.
//
// What is scanned:
//   - A Markdown file as written. A JSON file as its decoded string values, one field at a time,
//     so neither an escaped "$" (\u{24} in JSON's four-digit form) nor an escaped line break
//     (\n, \t) hides a claim. Object keys
//     are not scanned: every content schema has fixed field names and refuses unknown ones.
//   - Figure groups as they read on the page: for every object with a value, unit, label or score,
//     "<value><unit> <score> <label> <scoreLabel> <sub> <title> <note> <tag>", so a figure split
//     over fields ({ value: "98", unit: "%", label: "Client satisfaction" }) is still one claim.
//   - Text is folded first: NFKC (a fullwidth ＄４９９ becomes $499), then every format character
//     (\p{Cf}: zero-width, bidi, soft hyphen) and the combining grapheme joiner are removed.
// Scopes (`where` is a content file or an export name, `field` the path inside it):
//   - the sample dashboard (content/measure.json, MEASURE) may show percentages and k/M figures,
//     in its figure fields only (FIGURE_FIELD); its ticker, labels and calls to action may not;
//   - the legal pages may state periods ("for 2 years", "within 90 days") and name their
//     processors (AWS); founding years, decades, delivery promises and partner tiers stay refused.
// Every pattern is linear: no unbounded quantifier can restart inside a run it already scanned
// (tests/content.test.mjs times them on long pathological input).
// Known gaps: Vietnamese phrasing (the site is English-only), look-alike letters (Cyrillic "Ѕ")
// and non-ASCII digits (Arabic-Indic "٤٩٩"), HTML entities such as &#36; (React prints them as
// text), and a literal backslash-u sequence written as text.
import fs from "node:fs";
import path from "node:path";

const LEGAL = (where) => where.startsWith("content/legal/");
// The figure fields of the illustrative dashboard (content/measure.json), and the figure groups built from them.
const FIGURE_FIELD = /^(?:workflow\.center|workflow\.segments\[\d+\](?:\.value)?|stages\[\d+\]\.detail|accuracy(?:\.value|\.unit)?|throughput\.legend\[\d+\](?:\.value)?|readiness(?:\.score|\.bars\[\d+\](?:\.v)?)?|coverage(?:\.value|\.progress)?)$/;
const MEASURE_FIGURE = (where, field) => (where === "content/measure.json" || where === "MEASURE") && FIGURE_FIELD.test(field);
const SPELLED = "two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand";

/** [pattern, what, { skip }]: `skip(where, field)` is true where the rule does not apply. */
export const FORBIDDEN = [
  // Prices.
  [/\$\s?\d/, "a price"],
  // \b only knows ASCII letters, so "đồng" is bounded with Unicode lookarounds.
  [/[€£¥₫₹₩₽₺₦₱฿]|\b(?:USD|EUR|GBP|VND|SGD|AUD|CHF|JPY|CNY|INR)\b|\b(?:dollars?|euros?|pounds?|bucks)\b|(?<![\p{L}\p{N}])đồng(?![\p{L}\p{N}])/iu, "a price"],
  // A number with a rate ("499 per month", "49 a month", "49/mo"); "one team per project" is not a price.
  [/(?<![\w.,])\d[\d,.]{0,12}\s{0,3}(?:(?:per|a|an)\s{1,3}|\/\s{0,3})(?:month|year|yr|mo|hour|hr|day|week|project|user|seat|sprint)s?\b/i, "a price"],
  [/\b(?:hourly|daily|day) rates?\b|\b(?:price[sd]?|pricing|fees?|costs?|rates?)\s{0,3}(?:from|of|start(?:s|ing)?\s(?:at|from)|:)\s{0,3}\d|\bstarting (?:at|from)\s{0,3}\d/i, "a price"],
  [/(?<![\w.,])\d{1,6}(?:[.,]\d{1,3})?\s?[kKmMbB]\b(?!\s?(?:display|screen|monitor|video|resolution|TV|UHD|HDR)\b)/, "a price or scale figure", { skip: MEASURE_FIGURE }],
  // The original site and the old identity.
  [/97\.8|31\.2|84\.7/, "an original platform metric"],
  [/Platform®|Platform B\.V\.|Platform Labs|plat—form/, "the old brand"],
  [/Book a Demo/i, "the old call to action"],
  [/®/, "a registered-trademark sign (use ™ until the mark is registered)"],
  // Clients, scale and results.
  [/Enterprise Clients|Active Users|API Calls/i, "an unverified scale claim"],
  [/(?<![\w.,])\d{1,6}(?:\.\d{1,3})?\s?[MKB]\+/, "a scale figure"],
  [/(?<![\w.,])\d[\d,]{0,15}\+(?!\d)/, "a scale figure"],
  [/(?<![\w.,])\d[\d,.]{0,15}\s{0,3}(?:\+\s{0,3})?(?:(?:happy|satisfied|enterprise|global)\s{1,3})?(?:clients?|customers?|companies|businesses|brands|teams|users|projects|countries|partners|employees|engineers|experts)\b|\b(?:hundreds|thousands|dozens|millions)\s{1,3}of\s{1,3}(?:(?:happy|satisfied|enterprise|global|our)\s{1,3})?(?:clients?|customers?|users?|compan(?:y|ies)|businesses|brands|organi[sz]ations|people)\b/i, "a client or scale claim"],
  [new RegExp(`\\b(?:${SPELLED})(?:[- ](?:${SPELLED}|one)){0,3}\\s{1,3}(?:(?:happy|satisfied|enterprise|global)\\s{1,3})?(?:clients|customers|companies|businesses|brands|engineers|developers|experts|employees|specialists|consultants)\\b|\\bteam of\\s{1,3}(?:\\d{1,4}|${SPELLED})\\s{1,3}(?:engineers|developers|experts|people|specialists|consultants)\\b`, "i"), "a client or scale claim"],
  [/\bFortune\s?(?:50|100|500|1000)\b/, "an unverified client claim"],
  [/\b(?:clients?|customers?|users?)\s{1,3}(?:satisfaction|retention|served|helped|onboarded|reached|saved)\b|\bsatisfaction\s{1,3}(?:rate|score)\b/i, "a client result claim"],
  // "You own 100% of the code" states ownership, not a result.
  [/(?<![\w.,])(?!100\s?%\s{1,3}of\s{1,3}(?:the|your)\s{1,3}(?:code|source code|IP|intellectual property|work|deliverables|rights)\b)\d[\d.,]{0,6}\s?%|\bper ?cent\b/i, "a result figure", { skip: MEASURE_FIGURE }],
  [/(?<![\w.,])\d{1,6}(?:\.\d{1,3})?\s?(?:x\b|×)|\b(?:two|three|four|five|ten)(?:fold| times)\b|\b(?:doubled|tripled|quadrupled)\b/i, "a multiplier claim"],
  // Press, partners, ratings, awards and certifications.
  [/TechCrunch/, "an unverified press or partnership claim"],
  [/\bAWS\b/, "an unverified press or partnership claim", { skip: LEGAL }],
  [/\b(?:[Aa]s [Ss]een (?:in|on)|[Ff]eatured (?:in|on|by)|[Ii]n the press|[Pp]ress coverage)\b|\b(?:Forbes|Wired|Bloomberg|Reuters|Gartner|Forrester|VentureBeat|Clutch)\b/, "an unverified press claim"],
  [/\b(?:Google|Microsoft|Amazon|AWS|Salesforce|HubSpot|SAP|Oracle|OpenAI|Anthropic|NVIDIA|IBM|Cloudflare)\s{1,3}(?:\w{1,20}\s{1,3}){0,2}?partner\b|\b(?:certified|official|premier|preferred|gold|silver|platinum|advanced|select|registered)\s{1,3}(?:tier\s{1,3})?partner\b/i, "an unverified partnership claim"],
  [/\baward[- ]winning\b|\bwinner of\b|\brated\s{1,3}\d|\b\d\.\d\s?\/\s?(?:5|10)\b|\bout of (?:5|five|10)\b|\b(?:\d|five|four)[- ]star\b|(?:#\s?1|\bnumber one)\s{1,3}(?:\w{1,20}\s{1,3}){0,2}?(?:agency|agencies|consultancy|consultancies|firm|company|provider|studio|choice|partner|developer|team)\b|\btop[- ]rated\b/i, "an unverified rating or award"],
  [/[★☆]|(?<![\w.,])\d(?:\.\d)?\s?stars?\b/i, "an unverified rating or award"],
  [/\bISO\s?\d{4,5}(?:[:-]\d{4})?\s{1,3}(?:certified|certification|compliant|accredited)\b|\bSOC\s?[123]\s{1,3}(?:Type\s{1,3}(?:II|I|1|2)\b|certified|compliant|report|audited)|\b(?:certified|accredited)\s{1,3}(?:ISO|SOC)\b/i, "an unverified certification"],
  // Offices.
  [/Amsterdam|New York|Dubai|Keizersgracht/, "an office location"],
  [/\boffices?\s{1,3}(?:in|across|around)\b|\bheadquarter(?:s|ed)\b|\bHQ\s{1,3}(?:in|at)\b|\b(?:our|global|regional)\s{1,3}HQ\b|\bbased (?:in|out of) (?!part\b)|\bour\s{1,3}[A-Z]\w{0,30}\s{1,3}(?:office|studio)\b/i, "an office location"],
  // Experience. The legal pages state periods ("for 2 years"); founding years and decades are refused everywhere.
  [/\b(?:since|founded(?:\s{1,3}in)?|est\.?|established(?:\s{1,3}in)?)\s{1,3}(?:19|20)\d{2}\b|\bsince the (?:19|20)\d0s\b|\bdecades?\b(?![- ]old\b)/i, "an experience claim"],
  [new RegExp(`(?<![\\w.,])\\d{1,4}\\s?(?:\\+\\s?)?(?:years?|yrs?)\\b|\\b(?:one|${SPELLED})\\s{1,3}years?\\b`, "i"), "an experience claim", { skip: LEGAL }],
  // Delivery timelines. A promise to deliver is refused everywhere; other periods are allowed on the legal pages.
  [new RegExp(`\\b(?:deliver(?:s|ed|y)?|ship(?:s|ped)?|launch(?:es|ed)?|go(?:es)? live|complete[sd]?|built)\\b[^.!?\\n]{0,40}?\\b(?:in|within|under)\\s{1,3}(?:just\\s{1,3}|only\\s{1,3})?(?:\\d{1,3}|a|one|${SPELLED})\\s{0,3}(?:hours?|days?|weeks?|months?)\\b`, "i"), "a delivery timeline"],
  [/(?<![\w.,])\d{1,3}\s?-?\s?(?:h|hrs?|hours?|days?|weeks?)\s{1,3}turnaround\b/i, "a delivery timeline"],
  [/\b(?:in|within|under)\s{1,3}(?:just\s{1,3}|only\s{1,3})?\d{1,3}\s?(?:days?|weeks?|months?|hours?)\b|(?<![\w.,])\d{1,3}\s?(?:-|–|to)\s?\d{1,3}\s?(?:days?|weeks?|months?)\b/i, "a delivery timeline", { skip: LEGAL }],
];

/** NFKC, then format characters (\p{Cf}) and the combining grapheme joiner removed: what a reader sees, in plain characters. */
export const fold = (text) => text.normalize("NFKC").replace(/[\p{Cf}\u{34F}]/gu, "");

/** Every forbidden claim in `text`, as "<what> (<match>)". `where` and `field` place it, for scoped rules. */
export function findForbidden(text, where = "", field = "") {
  const folded = fold(text);
  return FORBIDDEN.flatMap(([pattern, what, scope]) => {
    if (scope?.skip(where, field)) return [];
    const hit = folded.match(pattern);
    // JSON quoting shows a line break or a tab inside the match as \n or \t.
    return hit ? [`${what} (${JSON.stringify(hit[0])})`] : [];
  });
}

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const FIGURE_PARTS = ["value", "unit", "score", "label", "scoreLabel", "sub", "title", "note", "tag"];

/**
 * Every text to scan in a content value, as [field, text]: each string, and each figure group as
 * it reads on the page (the group's own field). Numbers count only inside a figure group.
 */
export function textsOf(value, field = "", out = []) {
  if (typeof value === "string") out.push([field, value]);
  else if (Array.isArray(value)) value.forEach((item, index) => textsOf(item, `${field}[${index}]`, out));
  else if (isRecord(value)) {
    if (["value", "unit", "label", "score"].some((key) => Object.hasOwn(value, key))) {
      const part = (key) => (typeof value[key] === "string" || typeof value[key] === "number" ? String(value[key]) : "");
      const [amount, unit, ...rest] = FIGURE_PARTS.map(part);
      out.push([field, [`${amount}${unit}`, ...rest].filter(Boolean).join(" ")]);
    }
    for (const [key, child] of Object.entries(value)) textsOf(child, field ? `${field}.${key}` : key, out);
  }
  return out;
}

/** The problems in [field, text] pairs. A problem already found in a group is not repeated for its fields. */
function findIn(texts, where) {
  const found = [];
  const inside = (field, group) => group === "" || field === group || field.startsWith(`${group}.`) || field.startsWith(`${group}[`);
  for (const [field, text] of texts) {
    for (const problem of findForbidden(text, where, field)) {
      if (!found.some((earlier) => earlier.problem === problem && inside(field, earlier.field))) found.push({ field, problem });
    }
  }
  return found;
}

/** Scans each exported value (functions excluded) on its own, as "<export><field>: <what> (<match>)". */
export function scanExports(content) {
  return Object.entries(content)
    .filter(([, value]) => typeof value !== "function")
    .flatMap(([name, value]) => findIn(textsOf(value), name).map(({ field, problem }) => `${name}${field && !field.startsWith("[") ? "." : ""}${field}: ${problem}`));
}

/**
 * The problems in one content file, as "<field>: <what> (<match>)" (or "<what> (<match>)" for a
 * Markdown file). A JSON file that does not parse is left to the loader, which reports it.
 */
export function scanFile(name, source) {
  let texts = [["", source]];
  if (name.endsWith(".json")) {
    try {
      texts = textsOf(JSON.parse(source));
    } catch {
      return [];
    }
  }
  return findIn(texts, name).map(({ field, problem }) => (field ? `${field}: ${problem}` : problem));
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

/** Scans every content file, so fields the site does not render are checked too. */
export function scanContentTree(root = ".") {
  return contentFiles(root).flatMap((file) => {
    const name = path.relative(root, file).replaceAll("\\", "/");
    return scanFile(name, fs.readFileSync(file, "utf8")).map((problem) => `${name}: ${problem}`);
  });
}
