// How Cloudflare applies `_headers`, so a check can name the headers each path gets without a
// server. It mirrors wrangler 4.151's parser (parseHeaders and constructHeaders in
// node_modules/wrangler/wrangler-dist/cli.js) and the asset worker's attachCustomHeaders
// (node_modules/miniflare/dist/src/workers/assets/assets.worker.js), which the preview runs too:
// - Lines are trimmed, so indentation means nothing. Blank lines and lines that start with # are
//   skipped. A line that starts with / opens a rule; "Name: value" sets a header (the name is
//   lowercased, and a name repeated in one rule is joined with ", "); "! Name" removes one. A rule
//   with nothing in it is dropped. A path that appears twice keeps the first rule's place and the
//   last rule's headers (a JS object keyed by path).
// - Every rule whose path matches applies, in file order: "*" matches anything, nothing included
//   ("/admin/*" matches "/admin/" but not "/admin"), and ":name" one path segment. Within a rule,
//   removals run first. The first rule to set a header replaces the asset's own value; a later rule
//   appends to it with ", ", so two Content-Security-Policy values would make a browser enforce both.
// Rules for another host ("https://…") are not simulated: they are reported as invalid instead.
import fs from "node:fs";
import path from "node:path";

/** /uploads/*: an upload opened on its own is a sandboxed document that runs nothing (controller amendment). */
export const UPLOADS_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
export const ADMIN_ROBOTS = "noindex, nofollow";
const CSP = "content-security-policy";
const MAX_LINE_LENGTH = 2000;
const MAX_RULES = 100;

/** `_headers` text as `{ rules: [{ path, set, unset }], invalid: [{ line, message }] }`, as Cloudflare reads it. */
export function parseHeaders(text) {
  const rules = [];
  const invalid = [];
  const byPath = new Map();
  let rule = null;
  let ruleLine = 0;
  const close = () => {
    if (!rule || rule.host) return void (rule = null);
    if (!Object.keys(rule.set).length && !rule.unset.length) invalid.push({ line: ruleLine, message: "No headers specified" });
    else if (byPath.has(rule.path)) {
      invalid.push({ line: ruleLine, message: `${rule.path} appears twice; Cloudflare keeps only the last one` });
      Object.assign(byPath.get(rule.path), { set: rule.set, unset: rule.unset });
    } else {
      byPath.set(rule.path, rule);
      rules.push(rule);
    }
    rule = null;
  };
  for (const [index, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    const number = index + 1;
    if (!line || line.startsWith("#")) continue;
    if (line.length > MAX_LINE_LENGTH) {
      invalid.push({ line: number, message: `longer than ${MAX_LINE_LENGTH} characters, so Cloudflare ignores it` });
      continue;
    }
    if (/^[^\s]+:\/\//.test(line)) {
      close();
      invalid.push({ line: number, message: "a rule for another host, which this check does not simulate" });
      rule = { path: line, set: {}, unset: [], host: true };
      ruleLine = number;
      continue;
    }
    if (line.startsWith("/")) {
      close();
      if (rules.length >= MAX_RULES) {
        invalid.push({ line: number, message: `more than ${MAX_RULES} rules; Cloudflare skips the rest of the file` });
        break;
      }
      rule = { path: line, set: {}, unset: [] };
      ruleLine = number;
      continue;
    }
    if (!line.includes(":")) {
      if (rule && line.startsWith("! ")) rule.unset.push(line.slice(2));
      else invalid.push({ line: number, message: rule ? "Expected a colon-separated header pair (e.g. name: value)" : "Expected a path beginning with at least one forward-slash" });
      continue;
    }
    const [rawName, ...rawValue] = line.split(":");
    const name = rawName.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (!name || name.includes(" ") || !value || !rule) {
      invalid.push({ line: number, message: !rule ? "a header before any path" : !value ? "No header value specified" : "Header name cannot include spaces" });
      continue;
    }
    rule.set[name] = rule.set[name] ? `${rule.set[name]}, ${value}` : value;
  }
  close();
  return { rules, invalid: invalid.sort((a, b) => a.line - b.line) };
}

const escape = (part) => part.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
/** The asset worker's rule pattern: "*" is any text, ":name" one segment, anchored at both ends. */
const ruleRegExp = (rulePath) => new RegExp(`^${rulePath.split("*").map(escape).join(".*").replace(/:[A-Za-z]\w*/g, "[^/]+")}$`);

/** True when the rule path applies to `pathname`. */
export const ruleMatches = (rulePath, pathname) => ruleRegExp(rulePath).test(pathname);

/**
 * The custom headers a response for `pathname` ends up with (lowercased names), starting from the
 * asset's own `base` headers.
 */
export function headersFor(rules, pathname, base = {}) {
  const headers = new Map(Object.entries(base).map(([name, value]) => [name.toLowerCase(), value]));
  const setByRule = new Set();
  for (const rule of rules) {
    if (!ruleMatches(rule.path, pathname)) continue;
    for (const name of rule.unset) headers.delete(name.toLowerCase());
    for (const [name, value] of Object.entries(rule.set)) {
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

const directives = (csp) => new Map(csp.split(";").map((part) => part.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...values]) => [name, values.join(" ")]));
/** Paths checked even when nothing ships there (no upload yet), or that sit next to a CMS prefix. */
const PROBES = ["/", "/privacy/", "/_next/static/chunks/probe.js", "/admin/", "/admin/config.yml", "/admin", "/administrator/", "/uploads/probe.webp", "/uploads/folder/probe.jpg.w640.webp", "/uploads", "/uploadsx/"];

/**
 * What is wrong with `_headers` for the CMS (controller amendments, Task 10): `/admin/*` and
 * `/uploads/*` must come after `/*` and replace its CSP with their own, `/admin/` must be noindex
 * and its CSP must not load code or data from elsewhere, uploads must be sandboxed and never
 * sniffed, and every other path in `paths` (URL paths, see sitePaths) must get exactly the site CSP
 * of the `/*` rule, whatever that is. `nosniff` must reach every path.
 */
export function headerProblems(text, paths = []) {
  const { rules, invalid } = parseHeaders(text);
  const problems = invalid.map(({ line, message }) => `_headers line ${line}: ${message}`);
  const at = (rulePath) => rules.findIndex((rule) => rule.path === rulePath);
  const site = rules[at("/*")]?.set[CSP];
  if (!site) return [...problems, "_headers has no /* rule with a Content-Security-Policy"];
  for (const rulePath of ["/admin/*", "/uploads/*"]) {
    if (at(rulePath) < 0) problems.push(`_headers has no ${rulePath} rule`);
    else if (at(rulePath) < at("/*")) problems.push(`${rulePath} comes before /*, so the site CSP would not be removed`);
  }
  const admin = rules[at("/admin/*")]?.set[CSP];
  if (admin) {
    const policy = directives(admin);
    if (policy.get("script-src") !== "'self'") problems.push(`the /admin/* CSP must keep script-src to 'self' (the vendored bundle only), not "${policy.get("script-src")}"`);
    if (policy.get("connect-src") !== "'self' blob: data:") problems.push(`the /admin/* CSP must keep connect-src to 'self' blob: data: until the GitHub setup, not "${policy.get("connect-src")}"`);
    for (const [name, value] of [["object-src", "'none'"], ["frame-ancestors", "'none'"], ["base-uri", "'self'"]]) if (policy.get(name) !== value) problems.push(`the /admin/* CSP must set ${name} ${value}`);
    if (/unpkg\.com|'unsafe-eval'|(?:^|\s)\*(?:\s|$)|(?:^|\s)https:(?:\s|$)/.test([...policy.values()].join(" "))) problems.push("the /admin/* CSP allows CDN code, eval or a wildcard");
    if (admin === site) problems.push("the /admin/* CSP is the site CSP");
  }
  // The same fault on many paths is one problem: "<paths> get(s) <header> <value>, not <expected>".
  const faults = new Map();
  for (const pathname of [...new Set([...PROBES, ...paths])].sort()) {
    const headers = headersFor(rules, pathname);
    const wrong = (name, expected, what = `, not "${expected}"`) => {
      if (headers[name] === expected) return;
      const fault = `${name.replace(/(^|-)([a-z])/g, (_, dash, letter) => dash + letter.toUpperCase())} ${headers[name] === undefined ? "nothing" : `"${headers[name]}"`}${what}`;
      faults.set(fault, [...(faults.get(fault) ?? []), pathname]);
    };
    if (pathname.startsWith("/admin/")) {
      if (admin) wrong(CSP, admin, ", not the /admin/* policy alone");
      wrong("x-robots-tag", ADMIN_ROBOTS);
    } else if (pathname.startsWith("/uploads/")) wrong(CSP, UPLOADS_CSP, ", not the /uploads/* sandbox policy");
    else wrong(CSP, site, " instead of exactly the site policy (/*)");
    wrong("x-content-type-options", "nosniff");
  }
  for (const [fault, where] of faults) {
    const named = where.length > 3 ? `${where.slice(0, 3).join(", ")} and ${where.length - 3} more paths` : where.join(", ");
    problems.push(`${named} ${where.length === 1 ? "gets" : "get"} ${fault}`);
  }
  return problems;
}
