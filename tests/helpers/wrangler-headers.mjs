// The real Cloudflare code for `_headers`, taken from node_modules and run in a vm: wrangler's parser
// (parseHeaders, validateUrl, constructHeaders in wrangler/wrangler-dist/cli.js) and the asset
// worker's attachCustomHeaders (miniflare/dist/src/workers/assets/assets.worker.js). Tests compare
// scripts/lib/headers.mjs with it. Both packages are pinned exactly in package.json; after an upgrade
// that moves this code, the slices below fail with a message naming what to look at again.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

// Resolved like an import, so a copy of the project inside this one finds the same packages.
const require = createRequire(import.meta.url);
const CLI = path.join(path.dirname(require.resolve("wrangler/package.json")), "wrangler-dist", "cli.js");
const WORKER = path.join(path.dirname(require.resolve("miniflare/package.json")), "dist", "src", "workers", "assets", "assets.worker.js");

function slice(file, text, start, end, { includeEnd = true } = {}) {
  const from = text.indexOf(start);
  const to = from < 0 ? -1 : text.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`${file} no longer has ${JSON.stringify(start)} … ${JSON.stringify(end)}: check scripts/lib/headers.mjs against the new code, then update tests/helpers/wrangler-headers.mjs`);
  return text.slice(from, includeEnd ? to + end.length : to);
}

function load() {
  const cli = fs.readFileSync(CLI, "utf8");
  const worker = fs.readFileSync(WORKER, "utf8");
  const source = [
    "var __name = (fn) => fn;",
    "var REDIRECTS_VERSION, HEADERS_VERSION, PERMITTED_STATUS_CODES, HEADER_SEPARATOR, MAX_LINE_LENGTH, MAX_HEADER_RULES, MAX_DYNAMIC_REDIRECT_RULES, MAX_STATIC_REDIRECT_RULES, UNSET_OPERATOR, SPLAT_REGEX, PLACEHOLDER_REGEX, MAX_ROUTES_RULES, MAX_ROUTES_RULE_LENGTH;",
    slice(CLI, cli, "REDIRECTS_VERSION = 1;", "MAX_ROUTES_RULE_LENGTH = 100;"),
    "var extractPathname, URL_REGEX, HOST_WITH_PORT_REGEX, PATH_REGEX, validateUrl;",
    slice(CLI, cli, "extractPathname = /* @__PURE__ */ __name(", '}, "validateUrl");'),
    "var LINE_IS_PROBABLY_A_PATH;",
    slice(CLI, cli, "LINE_IS_PROBABLY_A_PATH = new RegExp(", ");"),
    slice(CLI, cli, "function parseHeaders(input2, {", "\nvar LINE_IS_PROBABLY_A_PATH;", { includeEnd: false }),
    "var path29 = { relative: (a, b) => b };",
    slice(CLI, cli, "function constructHeaders({", "\nvar init_constructConfiguration", { includeEnd: false }),
    `${slice(WORKER, worker, "var ESCAPE_REGEX_CHARACTERS", ", staticRedirectsMatcher = ", { includeEnd: false })};`,
    slice(WORKER, worker, "function attachCustomHeaders(", "\n}\n"),
    "({ parseHeaders, constructHeaders, attachCustomHeaders })",
  ].join("\n");
  return vm.runInNewContext(source, { URL, process: { cwd: () => "" } });
}

let real;
/** Wrangler's own reading of `text`: `{ rules (constructHeaders' object), invalid: messages in order }`. */
export function wranglerHeaders(text) {
  real ??= load();
  const parsed = real.parseHeaders(text);
  const configuration = real.constructHeaders({ headers: parsed, logger: { log() {}, warn() {} } });
  // A JSON copy: objects made in the vm have another Object.prototype, which strict deepEqual refuses.
  const plain = JSON.parse(JSON.stringify({ configuration, invalid: parsed.invalid.map(({ message }) => message) }));
  return { configuration: plain.configuration, rules: plain.configuration.headers?.rules ?? {}, invalid: plain.invalid };
}

/** The headers the asset worker attaches to an empty response for `pathname`, under `configuration`. */
export function workerHeaders(configuration, pathname) {
  real ??= load();
  const span = { addLogs() {}, setTags() {} };
  const response = real.attachCustomHeaders(new Request(`https://example.com${pathname}`), new Response(null), configuration, { JAEGER: { enterSpan: (_name, fn) => fn(span) } });
  return Object.fromEntries(response.headers);
}
