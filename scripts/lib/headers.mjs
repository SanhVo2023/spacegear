// How Cloudflare applies `_headers`, so a check can name the headers each path gets without a
// server. It mirrors wrangler 4.151.2's parser (parseHeaders, validateUrl, extractPathname and
// constructHeaders in node_modules/wrangler/wrangler-dist/cli.js) and the asset worker's
// attachCustomHeaders (node_modules/miniflare/dist/src/workers/assets/assets.worker.js), which the
// preview runs too. tests/headers.test.mjs runs that code itself (tests/helpers/wrangler-headers.mjs)
// and compares it with this module on a corpus of edge cases.
// - Lines are trimmed, so indentation means nothing. Blank lines and lines that start with # are
//   skipped, and so is a line over 2,000 characters. A line that starts with / (or scheme://) opens
//   a rule. Its path is normalised as a URL path ("/a/../b/*" is "/b/*", "?…" and "#…" are dropped,
//   other characters are percent-encoded); a path that is not / or https://host/, that has a port,
//   two "*" or "*" with ":splat" is refused, and the header lines after it are skipped until the
//   next path. "Name: value" sets a header (the name is lowercased; a name repeated in one rule is
//   joined with ", "); "! Name" removes one. A rule with nothing in it is dropped; at most 100 rules.
//   A path that appears twice keeps the first rule's place and the last rule's headers.
// - Every rule whose path matches applies, in file order: "*" matches anything, nothing included
//   ("/admin/*" matches "/admin/" but not "/admin"), and ":name" one path segment; ":name" and
//   ":splat" in a header value are replaced by what they matched. A rule whose pattern does not
//   compile (a placeholder name used twice) never applies. Within a rule, removals run first. The
//   first rule to set a header replaces the asset's own value; a later rule appends to it with ", ",
//   so two Content-Security-Policy values would make a browser enforce both.
// - A rule for one host ("https://host/path") applies only on that host, which these checks cannot
//   know, so headersFor never applies one and headerProblems reports it.
import fs from "node:fs";
import path from "node:path";

/** /uploads/*: an upload opened on its own is a sandboxed document that runs nothing (controller amendment). */
export const UPLOADS_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
/**
 * The three font files the vendored Sveltia bundle's @font-face rules load (tests/admin.test.mjs
 * reads them from the bundle). font-src names each file exactly: a source with a path and no
 * trailing slash matches that path only, and ":" and "@" are valid path characters in a CSP source.
 */
export const ADMIN_FONTS = [
  "https://cdn.jsdelivr.net/fontsource/fonts/material-symbols-outlined:vf@5.3.8/latin-wght-normal.woff2",
  "https://cdn.jsdelivr.net/fontsource/fonts/noto-mono@5.3.0/latin-400-normal.woff2",
  "https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3:vf@5.3.0/latin-wght-normal.woff2",
];
/**
 * What the GitHub backend of the vendored bundle loads from GitHub, and nothing more (README.md,
 * "Editing from GitHub"): connect-src for the REST and GraphQL API (which also serves file contents,
 * as blobs) and for the status check on the sign-in screen; img-src for the editors' avatars.
 */
export const ADMIN_GITHUB_CONNECT = ["https://api.github.com", "https://www.githubstatus.com"];
export const ADMIN_GITHUB_IMAGES = ["https://avatars.githubusercontent.com"];
/** /admin/*: the vendored CMS only (README.md, "The admin Content-Security-Policy"). public/_headers must carry exactly this. */
export const ADMIN_CSP = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${ADMIN_GITHUB_IMAGES.join(" ")}; font-src 'self' ${ADMIN_FONTS.join(" ")}; connect-src 'self' blob: data: ${ADMIN_GITHUB_CONNECT.join(" ")}; media-src 'self' blob:; frame-src blob:; manifest-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
const CSP = "content-security-policy";
/** Exactly these values, each sent once, on every /admin/ path; every other header of /* must reach it unchanged. */
export const ADMIN_HEADERS = { [CSP]: ADMIN_CSP, "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff", "x-frame-options": "DENY" };
/** The same for every /uploads/ path. */
export const UPLOADS_HEADERS = { [CSP]: UPLOADS_CSP, "x-content-type-options": "nosniff", "x-frame-options": "DENY" };
/** The Labs feeds (Part 3), one per language: RSS, not the generic XML type the asset would get from its extension. */
export const FEEDS = ["/labs/rss.xml", "/vi/labs/rss.xml"];
export const FEED_HEADERS = { "content-type": "application/rss+xml; charset=utf-8" };
const PINNED_NAMES = new Map([[ADMIN_CSP, "ADMIN_CSP (scripts/lib/headers.mjs)"], [UPLOADS_CSP, "UPLOADS_CSP (scripts/lib/headers.mjs)"]]);

const MAX_LINE_LENGTH = 2000;
const MAX_RULES = 100;
const LINE_IS_PROBABLY_A_PATH = /^([^\s]+:\/\/|^\/)/;
const URL_REGEX = /^https:\/\/+(?<host>[^/]+)\/?(?<path>.*)/;
const HOST_WITH_PORT_REGEX = /.*:\d+$/;
const isHostRule = (rulePath) => rulePath.startsWith("https://");

/** wrangler's extractPathname: the path as a URL would have it, without search or hash. */
function extractPathname(pathname = "/") {
  return new URL(`//${pathname.startsWith("/") ? pathname : `/${pathname}`}`, "relative://").pathname;
}

/** wrangler's validateUrl(token, false, true) for a rule path: [path] or [undefined, message]. */
function validatePath(token) {
  const host = URL_REGEX.exec(token);
  if (host?.groups?.host) {
    if (HOST_WITH_PORT_REGEX.test(host.groups.host)) return [undefined, `Specifying ports is not supported. Skipping absolute URL ${token}.`];
    return [`https://${host.groups.host}${extractPathname(host.groups.path)}`];
  }
  if (token.startsWith("/")) {
    try {
      return [extractPathname(token)];
    } catch {
      return [undefined, `Error parsing URL segment ${token}. Skipping.`];
    }
  }
  return [undefined, 'URLs should either be relative (e.g. begin with a forward-slash), or use HTTPS (e.g. begin with "https://").'];
}

/** wrangler's validateNoMultipleWildcards. */
function wildcardProblem(rulePath) {
  const wildcards = (rulePath.match(/\*/g) ?? []).length;
  if (wildcards > 1) return `Only one wildcard is allowed per rule. Use a named placeholder (e.g. :project) instead. Skipping ${rulePath}.`;
  if (wildcards > 0 && /:splat(?!\w)/.test(rulePath)) return `Cannot combine a wildcard * with a :splat placeholder because wildcards are converted to :splat at runtime. Skipping ${rulePath}.`;
  return undefined;
}

/**
 * `_headers` text as Cloudflare reads it: `rules` ([{ path, set, unset }], one per path, in order),
 * `invalid` (the lines wrangler refuses, with its messages, in its order: Cloudflare ignores them)
 * and `notes` (a repeated path: valid, but most likely a mistake).
 */
export function parseHeaders(text) {
  const lines = text.split("\n");
  const parsed = [];
  const invalid = [];
  let rule;
  let skipUntilNextPath = false;
  const close = () => {
    if (!rule) return;
    if (Object.keys(rule.set).length || rule.unset.length) parsed.push(rule);
    else invalid.push({ line: rule.line, message: "No headers specified" });
  };
  for (let index = 0; index < lines.length; index++) {
    const line = (lines[index] || "").trim();
    const number = index + 1;
    if (!line || line.startsWith("#")) continue;
    if (line.length > MAX_LINE_LENGTH) {
      invalid.push({ line: number, message: `Ignoring line ${number} as it exceeds the maximum allowed length of ${MAX_LINE_LENGTH}.` });
      continue;
    }
    if (LINE_IS_PROBABLY_A_PATH.test(line)) {
      skipUntilNextPath = false;
      if (parsed.length >= MAX_RULES) {
        invalid.push({ line: number, message: `Maximum number of rules supported is ${MAX_RULES}. Skipping remaining ${lines.length - index} lines of file.` });
        break;
      }
      close();
      rule = undefined;
      const [rulePath, pathProblem] = validatePath(line);
      const problem = pathProblem ?? wildcardProblem(rulePath);
      if (problem) {
        invalid.push({ line: number, message: problem });
        skipUntilNextPath = true;
        continue;
      }
      rule = { path: rulePath, line: number, set: {}, unset: [] };
      continue;
    }
    if (skipUntilNextPath) continue;
    if (!line.includes(":")) {
      if (!rule) invalid.push({ line: number, message: "Expected a path beginning with at least one forward-slash" });
      else if (line.startsWith("! ")) rule.unset.push(line.replace("! ", ""));
      else invalid.push({ line: number, message: "Expected a colon-separated header pair (e.g. name: value)" });
      continue;
    }
    const [rawName, ...rawValue] = line.split(":");
    const name = (rawName || "").trim().toLowerCase();
    const value = rawValue.join(":").trim();
    const problem = name.includes(" ") ? "Header name cannot include spaces" : name === "" ? "No header name specified" : value === "" ? "No header value specified" : !rule ? `Path should come before header (${name}: ${value})` : null;
    if (problem) {
      invalid.push({ line: number, message: problem });
      continue;
    }
    rule.set[name] = rule.set[name] ? `${rule.set[name]}, ${value}` : value;
  }
  close();
  // constructHeaders keys the rules by path: a repeated path keeps its first place and its last headers.
  const rules = [];
  const notes = [];
  const byPath = new Map();
  for (const { path: rulePath, line, set, unset } of parsed) {
    if (byPath.has(rulePath)) {
      notes.push({ line, message: `${rulePath} appears twice; Cloudflare keeps only the last one` });
      Object.assign(byPath.get(rulePath), { set, unset });
    } else {
      const entry = { path: rulePath, set, unset };
      byPath.set(rulePath, entry);
      rules.push(entry);
    }
  }
  return { rules, invalid, notes };
}

const escape = (part) => part.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
const compiled = new Map();
/** The asset worker's generateRuleRegExp: "*" is (?<splat>.*), ":name" (?<name>[^/]+), anchored; null when it does not compile. */
function ruleRegExp(rulePath) {
  if (!compiled.has(rulePath)) {
    let source = rulePath.split("*").map(escape).join("(?<splat>.*)");
    for (const [placeholder, name] of source.matchAll(/:([A-Za-z]\w*)/g)) source = source.split(placeholder).join(`(?<${name}>[^/]+)`);
    let regExp = null;
    try {
      regExp = new RegExp(`^${source}$`);
    } catch {
      regExp = null;
    }
    compiled.set(rulePath, regExp);
  }
  return compiled.get(rulePath);
}

/** What a rule's pattern captured for `pathname`, or null when it does not apply there. */
function ruleMatch(rule, pathname) {
  if (isHostRule(rule.path)) return null;
  const match = ruleRegExp(rule.path)?.exec(pathname);
  return match ? match.groups ?? {} : null;
}

/** True when the rule applies to `pathname` (on any host: rules for one host never do). */
export const ruleMatches = (rulePath, pathname) => ruleMatch({ path: rulePath }, pathname) !== null;

/**
 * The custom headers a response for `pathname` ends up with (lowercased names), starting from the
 * asset's own `base` headers.
 */
export function headersFor(rules, pathname, base = {}) {
  const headers = new Map(Object.entries(base).map(([name, value]) => [name.toLowerCase(), value]));
  const setByRule = new Set();
  for (const rule of rules) {
    const groups = ruleMatch(rule, pathname);
    if (!groups) continue;
    for (const name of rule.unset) headers.delete(name.toLowerCase());
    for (const [name, raw] of Object.entries(rule.set)) {
      let value = raw;
      for (const [group, captured] of Object.entries(groups)) value = value.replaceAll(`:${group}`, captured);
      headers.set(name, setByRule.has(name) && headers.has(name) ? `${headers.get(name)}, ${value}` : value);
      setByRule.add(name);
    }
  }
  return Object.fromEntries(headers);
}

/** Every file below `root` as the URL path that serves it, plus "/dir/" for each "dir/index.html". */
export function sitePaths(root) {
  const paths = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${rel}/`);
      else {
        paths.push(`/${rel}`);
        if (entry.name === "index.html") paths.push(`/${prefix}`);
      }
    }
  };
  walk(root, "");
  return paths.sort();
}

/** Paths checked even when nothing ships there (no upload yet), or that sit next to a CMS prefix. */
const PROBES = ["/", "/privacy/", "/_next/static/chunks/probe.js", "/admin/", "/admin/config.yml", "/admin", "/administrator/", "/uploads/probe.webp", "/uploads/folder/probe.jpg.w640.webp", "/uploads", "/uploadsx/", ...FEEDS, "/labs/", "/labs/rss.xml/"];
const headerName = (name) => name.replace(/(^|-)([a-z])/g, (_, dash, letter) => dash + letter.toUpperCase());

/**
 * What is wrong with `_headers` for the CMS (Task 10 and its review): every line must be one
 * Cloudflare reads; no rule may be for one host only or fail to compile; `/admin/*` and `/uploads/*`
 * must come after `/*`; every `/admin/` path must get exactly ADMIN_HEADERS and every `/uploads/` path
 * exactly UPLOADS_HEADERS, each once, plus every other header `/*` sets, unchanged; and every other
 * path in `paths` (URL paths, see sitePaths) must get exactly the site CSP of the `/*` rule, whatever
 * that is, and nosniff. The two Labs feeds (FEEDS) get FEED_HEADERS, and no other path a Content-Type.
 */
export function headerProblems(text, paths = []) {
  const { rules, invalid, notes } = parseHeaders(text);
  const problems = [
    ...invalid.map(({ line, message }) => `_headers line ${line}: ${message.replace(/\.?$/, ".")} Cloudflare ignores it.`),
    ...notes.map(({ line, message }) => `_headers line ${line}: ${message}`),
  ];
  for (const rule of rules) {
    if (isHostRule(rule.path)) problems.push(`_headers rule ${rule.path} applies to one host only, which this check does not simulate`);
    else if (!ruleRegExp(rule.path)) problems.push(`_headers rule ${rule.path} cannot be compiled by Cloudflare's asset worker (a placeholder name used twice?), so it never applies`);
  }
  const at = (rulePath) => rules.findIndex((rule) => rule.path === rulePath);
  const site = rules[at("/*")]?.set ?? {};
  if (!site[CSP]) return [...problems, "_headers has no /* rule with a Content-Security-Policy"];
  for (const rulePath of ["/admin/*", "/uploads/*"]) {
    if (at(rulePath) < 0) problems.push(`_headers has no ${rulePath} rule`);
    else if (at(rulePath) < at("/*")) problems.push(`${rulePath} comes before /*, so the site CSP would not be removed`);
  }
  // The same fault on many paths is one problem: "<paths> get(s) <header> <value>, not <expected>".
  const faults = new Map();
  for (const pathname of [...new Set([...PROBES, ...paths])].sort()) {
    const headers = headersFor(rules, pathname);
    const want = (expected, mismatch = (name) => `, not ${PINNED_NAMES.get(expected[name]) ?? `"${expected[name]}"`}`) => {
      for (const name of Object.keys(expected)) {
        if (headers[name] === expected[name]) continue;
        const fault = `${headerName(name)} ${headers[name] === undefined ? "nothing" : `"${headers[name]}"`}${mismatch(name)}`;
        faults.set(fault, [...(faults.get(fault) ?? []), pathname]);
      }
    };
    if (pathname.startsWith("/admin/")) want({ ...site, ...ADMIN_HEADERS });
    else if (pathname.startsWith("/uploads/")) want({ ...site, ...UPLOADS_HEADERS });
    else {
      want({ [CSP]: site[CSP] }, () => " instead of exactly the site policy (/*)");
      want({ "x-content-type-options": "nosniff" });
    }
    if (FEEDS.includes(pathname)) want(FEED_HEADERS);
    else want({ "content-type": undefined }, () => ", not the asset's own type");
  }
  for (const [fault, where] of faults) {
    const named = where.length > 3 ? `${where.slice(0, 3).join(", ")} and ${where.length - 3} more paths` : where.join(", ");
    problems.push(`${named} ${where.length === 1 ? "gets" : "get"} ${fault}`);
  }
  return problems;
}
