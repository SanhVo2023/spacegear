// Proves that a change did not alter what the exported pages render. `save` writes a normalized
// copy of every dist/**/*.html; `compare` normalizes the current dist/ the same way and reports
// any page that differs.
//
// Format 3 normalizes a page into two parts:
//  1. The HTML with only the inline RSC payload scripts (self.__next_f.push([1,"…"])) removed.
//     Every other <script> stays: JSON-LD, the RSC bootstrap, the noModule polyfill, chunk tags.
//  2. The React tree of the RSC payload, resolved from row 0 with every outlined row put back in
//     place, so neither row ids nor where React splits the payload into rows can change the result.
//     - References: $<hex>, $L<hex> (lazy) and $@<hex> (promise), $W<hex> (Set) and $Q<hex> (Map),
//       each with an optional :key:key path. React's Flight server writes a value it has already
//       sent as a path from the row it was first written in, and names the parts of an element
//       ["$", type, key, props, owner] by "type", "key", "props" and "_owner"; a path that walks
//       through another reference follows that reference (and its own path) first.
//     - A reference is a cycle only when its row and path lead to a value that contains the place
//       being resolved; it is then written as {"$cycle": <levels up>}. Any other reference, also
//       one into the same row, is resolved from the row's raw value.
//     - Client references keep their module id and export name, and the async flag. Turbopack's
//       ids shift whenever the module set changes, so `compare` lists a page that differs only in
//       ids with each change; `--explain-client-ids <dist of the saved build>` passes it when each
//       changed id keeps its export and place and has byte-identical factory code, and
//       `--loose-client-ids` ignores the ids (and warns), for a first look.
//     - The layout's async chunk elements (["$","script","script-N",{src,async,nonce}] with exactly
//       those props) are dropped, so a different number of chunks compares equal.
//     - The id-less hint rows are sorted, so their order in the stream does not matter.
// Then the masks below remove what changes between builds of the same source: the build ID (the
// page's own "b" value), hashed chunk and media names, runs of chunk <script>/<link> tags, and CRLF
// line endings. tests/html-snapshot.test.mjs plants changes that must and must not compare equal.
// `save` replaces the snapshot folder, so it only accepts a folder inside this worktree's
// artifacts/; it writes a `.format` marker, and `compare` refuses a folder in another format.
//   node scripts/html-snapshot.mjs save artifacts/html-baseline
//   node scripts/html-snapshot.mjs compare artifacts/html-baseline [--explain-client-ids <dist> | --loose-client-ids]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FORMAT = 3;
const PUSH = /<script>self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)<\/script>/g;
const ROW_TAGS = new Set(["I", "HL", "HC", "E", "W", "D"]);
const CHUNK_SRC = /^\/_next\/static\/chunks\/[\w.~-]+\.js$/;
const REFERENCE = /^\$([LW@Q]?)([0-9a-f]+)((?::[^:]*)*)$/;
// Kept as they are: "$" (element), "$$…" (escaped text), "$S…" (symbol), "$D…" (date), "$n…" (bigint).
const KEPT = /^\$(?:$|\$|S|D|n)/;
const OTHER_REFERENCE = /^\$[A-Za-z@][0-9a-f]+(?::|$)/;
// How React names the parts of an element array in a path (react-server-dom-turbopack, renderModelDestructive).
const ELEMENT_KEYS = { type: "1", key: "2", props: "3", _owner: "4" };
const WRAPPERS = { W: "$Set", Q: "$Map", "@": "$promise" };
const MAX_DEPTH = 64;
// No exported page comes near this; a graph that repeats itself (a doubling DAG) fails fast instead.
const MAX_NODES = 1_000_000;

/** Splits the decoded RSC stream into rows (id → row) and the id-less hint rows, in order. */
export function decodeRows(stream) {
  const rows = new Map();
  const hints = [];
  const id = /([0-9a-f]*):/y;
  const textHead = /T([0-9a-f]+),/y;
  let at = 0;
  while (at < stream.length) {
    id.lastIndex = at;
    const head = id.exec(stream);
    if (!head) throw new Error(`unparsed RSC row at ${at}: ${JSON.stringify(stream.slice(at, at + 60))}`);
    at = id.lastIndex;
    let row;
    textHead.lastIndex = at;
    const text = textHead.exec(stream);
    if (text) {
      // Text rows carry their UTF-8 byte length and no line break.
      const bytes = parseInt(text[1], 16);
      const start = textHead.lastIndex;
      const value = Buffer.from(stream.slice(start, start + bytes), "utf8").subarray(0, bytes).toString("utf8");
      if (Buffer.byteLength(value, "utf8") !== bytes) throw new Error(`RSC text row ${head[1]} is shorter than ${bytes} bytes`);
      row = { kind: "text", value };
      at = start + value.length;
    } else {
      const end = stream.indexOf("\n", at);
      const line = stream.slice(at, end === -1 ? stream.length : end);
      at = end === -1 ? stream.length : end + 1;
      const tag = /^[A-Z]{1,2}(?=[[{"])/.exec(line)?.[0];
      if (tag !== undefined) {
        if (!ROW_TAGS.has(tag)) throw new Error(`unknown RSC row tag "${tag}" in row ${head[1] || "(hint)"}`);
        const value = JSON.parse(line.slice(tag.length));
        if (tag === "I") {
          if (!Array.isArray(value) || typeof value[2] !== "string") throw new Error(`unreadable client reference in row ${head[1]}`);
          row = { kind: "client", value: { $client: value[2], $module: value[0], async: value[3] === 1 } };
        } else row = { kind: "tagged", value: { $row: tag, value } };
      } else row = { kind: "json", value: JSON.parse(line) };
    }
    if (head[1] === "") hints.push(row.value);
    else rows.set(head[1], row);
  }
  return { rows, hints };
}

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isElement = (value) => Array.isArray(value) && value[0] === "$";
/** A layout async chunk element, exactly as Next writes it. */
const isChunkScript = (value) => Array.isArray(value) && value.length === 4 && value[0] === "$" && value[1] === "script"
  && typeof value[2] === "string" && /^script-\d+$/.test(value[2]) && isRecord(value[3])
  && Object.keys(value[3]).length === 3 && typeof value[3].src === "string" && CHUNK_SRC.test(value[3].src)
  && value[3].async === true && value[3].nonce === "$undefined";
const parseReference = (text) => {
  const match = REFERENCE.exec(text);
  return match && { kind: match[1], row: match[2], keys: match[3].split(":").slice(1) };
};

/** The React tree from row 0 with every reference resolved in place (see the header). */
export function resolveTree(rows) {
  const rowOf = (text, rowId) => {
    const row = rows.get(rowId);
    if (!row) throw new Error(`RSC reference "${text}" points at a missing row`);
    return row;
  };
  /**
   * The raw value a reference points at, and where it is: the row and the key path inside that row's
   * raw value. A path that walks through another reference continues from that reference's target.
   */
  const locate = (text, reference, depth = 0) => {
    if (depth > MAX_DEPTH) throw new Error(`RSC reference "${text}" goes through more than ${MAX_DEPTH} references`);
    const row = rowOf(text, reference.row);
    let at = { row: reference.row, path: [], kind: row.kind, target: row.value };
    for (const key of reference.keys) {
      const inner = typeof at.target === "string" && at.kind === "json" ? parseReference(at.target) : null;
      if (inner) {
        // A lazy value ($L) is the row itself; a path cannot index into a Set, a Map or a promise.
        if (inner.kind && inner.kind !== "L") throw new Error(`RSC reference "${text}" walks through "${at.target}" (${WRAPPERS[inner.kind]})`);
        at = locate(at.target, inner, depth + 1);
      }
      if (at.kind !== "json") throw new Error(`RSC reference "${text}" walks into a ${at.kind} row`);
      const step = isElement(at.target) && Object.hasOwn(ELEMENT_KEYS, key) ? ELEMENT_KEYS[key] : key;
      if (at.target === null || typeof at.target !== "object" || !Object.hasOwn(at.target, step)) throw new Error(`RSC reference "${text}" does not resolve`);
      at = { ...at, path: [...at.path, step], target: at.target[step] };
    }
    return at;
  };
  // One frame per reference being resolved: its row and the key path of the value being visited.
  const frames = [];
  /** How many levels up from the value being resolved the value at (row, keys) sits, or -1 if it is not above it. */
  const levelsUp = (row, keys) => {
    let levels = 0;
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i];
      if (frame.row === row && keys.length <= frame.path.length && keys.every((key, k) => frame.path[k] === key)) return levels + frame.path.length - keys.length;
      levels += frame.path.length - frame.start;
    }
    return -1;
  };
  const resolveString = (value) => {
    if (!value.startsWith("$") || KEPT.test(value)) return value;
    const reference = parseReference(value);
    if (!reference) {
      if (OTHER_REFERENCE.test(value)) throw new Error(`unknown RSC reference "${value}"`);
      return value;
    }
    const at = locate(value, reference);
    let resolved;
    const up = levelsUp(at.row, at.path);
    if (up >= 0) resolved = { $cycle: up };
    else if (at.kind !== "json") resolved = at.target; // Text, client and tagged rows hold no references.
    else {
      frames.push({ row: at.row, path: [...at.path], start: at.path.length });
      resolved = resolve(at.target);
      frames.pop();
    }
    const wrapper = WRAPPERS[reference.kind];
    return wrapper ? { [wrapper]: resolved } : resolved;
  };
  let nodes = 0;
  const resolve = (value) => {
    if (++nodes > MAX_NODES) throw new Error(`the RSC tree resolves to more than ${MAX_NODES} values: its references repeat themselves far beyond any real page`);
    if (typeof value === "string") return resolveString(value);
    const frame = frames.at(-1);
    const child = (key, item) => {
      frame.path.push(key);
      const out = resolve(item);
      frame.path.pop();
      return out;
    };
    if (Array.isArray(value)) return value.map((item, index) => child(String(index), item)).filter((item) => !isChunkScript(item));
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, child(key, item)]));
    return value;
  };
  if (!rows.has("0")) return null;
  frames.push({ row: "0", path: [], start: 0 });
  return resolve(rows.get("0").value);
}

/** Removes what differs between two builds of the same source (see the header). */
function mask(text) {
  return text
    .replace(/\/_next\/static\/(chunks|media)\/[\w.~-]+?(\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico))(?=[\\"'\s)?#,])/g, "/_next/static/$1/HASH$2")
    .replace(/(?:<script src="\/_next\/static\/chunks\/HASH\.js" async=""><\/script>)+/g, "<script CHUNKS></script>")
    .replace(/(?:<link rel="preload" as="script" fetchPriority="low" href="\/_next\/static\/chunks\/HASH\.js"\/>)+/g, "<link CHUNKS/>");
}

/** The format-3 form of one exported page. */
export function normalize(html) {
  const source = html.replace(/\r\n/g, "\n");
  // Join the payload before any masking, so text-row byte lengths still match.
  const stream = [...source.matchAll(PUSH)].map((match) => JSON.parse(match[1])).join("");
  const { rows, hints } = decodeRows(stream);
  // The build ID is the "b" field of the page's root row.
  const root = rows.get("0")?.value;
  const buildId = isRecord(root) && typeof root.b === "string" ? root.b : "";
  // Sorted by their masked form, so neither stream order nor chunk names decide the order.
  const sorted = hints.map((hint) => [mask(JSON.stringify(hint)), hint]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, hint]) => hint);
  let out = `${source.replace(PUSH, "")}\n${JSON.stringify({ tree: resolveTree(rows), hints: sorted }, null, 1)}\n`;
  if (buildId) out = out.replaceAll(buildId, "BUILD_ID");
  return mask(out);
}

/** A normalized page without client module ids (for `compare --loose-client-ids`). */
export const withoutClientIds = (text) => text.replace(/^[ ]*"\$module": [^\n]*\n/gm, "");

const CLIENT = /"\$client": ("(?:[^"\\]|\\.)*"),\n[ ]*"\$module": ([^,\n]+),/g;
/**
 * The client module ids that differ between two normalized pages that are identical apart from
 * those ids, in page order: [{ name, from, to, line }] (line of the client in the new page).
 */
export function changedClientIds(before, after) {
  const read = (text) => [...text.matchAll(CLIENT)].map((match) => ({ name: JSON.parse(match[1]), id: JSON.parse(match[2]), line: text.slice(0, match.index).split("\n").length }));
  const next = read(after);
  return read(before).flatMap((client, index) => (next[index] && next[index].id !== client.id ? [{ name: client.name, from: client.id, to: next[index].id, line: next[index].line }] : []));
}

/**
 * The factory code of module `id` in a build's chunks, or null. Turbopack lists modules as
 * `…void 0,<id>,e=>{…},<id>,<id>,(e,t,r)=>{…}])` (one factory may serve several ids), so a
 * factory runs from its ids to the next "},<ids>,<arrow>=>{" or the end of the list. A triage
 * aid: both builds are cut the same way.
 */
const chunkCache = new Map();
/** A build's chunk files as [name, text], read once per run. */
function chunksOf(distDir) {
  const dir = path.join(distDir, "_next", "static", "chunks");
  if (!chunkCache.has(dir)) {
    chunkCache.set(dir, fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => file.endsWith(".js")).sort().map((name) => [name, fs.readFileSync(path.join(dir, name), "utf8")]) : []);
  }
  return chunkCache.get(dir);
}

export function moduleFactory(distDir, id) {
  const arrow = String.raw`(?:\([\w$,]*\)|[\w$]+)=>\{`;
  const start = new RegExp(`(?:\\}|void 0),(?:\\d{1,9},){0,32}?${String(id).replace(/[^\w]/g, "\\$&")},(?:\\d{1,9},){0,32}(?=${arrow})`);
  const next = new RegExp(`\\},(?:\\d{1,9},){1,33}${arrow}|\\}\\]\\);?\\s*$`);
  for (const [name, text] of chunksOf(distDir)) {
    const found = start.exec(text);
    if (!found) continue;
    const rest = text.slice(found.index + found[0].length);
    const end = rest.search(next);
    return { chunk: name, code: end < 0 ? rest : rest.slice(0, end) };
  }
  return null;
}

// A number in factory code that names a module: an import (e.i(N), e.r(N), e.A(N) …) or the id
// an export list is registered under (e.s([...], N), which a merged factory does for each of its ids).
const MODULE_REFERENCE = /(?:[\w$]\.[A-Za-z]\(|\],)$/;

/**
 * Whether module `oldId` of the build in `oldDist` is the same module as `newId` in `newDist`.
 * It is when the two factories are identical apart from module ids, and every module id that
 * differs (its own, an import, an export registration) maps one to one to a module that is the
 * same in turn, checked the same way. Returns { ok: true } or { ok: false, reason }.
 */
export function explainModule(oldDist, oldId, newDist, newId) {
  const forward = new Map(); // old id → new id, for every pair being or already explained
  const backward = new Map();
  const visit = (from, to) => {
    if (forward.has(from) || backward.has(to)) {
      if (forward.get(from) === to) return null; // explained, or being explained further up
      return `module ${from} cannot be both ${forward.get(from) ?? `the old ${backward.get(to)}`} and ${to}`;
    }
    forward.set(from, to);
    backward.set(to, from);
    const before = moduleFactory(oldDist, from);
    const after = moduleFactory(newDist, to);
    if (!before) return `module ${from} not found in ${oldDist}`;
    if (!after) return `module ${to} not found in ${newDist}`;
    const a = before.code.split(/(\d+)/);
    const b = after.code.split(/(\d+)/);
    if (a.length !== b.length) return "the factory code differs";
    const uses = [];
    for (let i = 1; i < a.length; i += 2) {
      if (a[i - 1] !== b[i - 1]) return "the factory code differs";
      if (a[i] === b[i]) continue;
      if (!MODULE_REFERENCE.test(a[i - 1])) return "the factory code differs";
      uses.push([a[i], b[i]]);
    }
    if (a.at(-1) !== b.at(-1)) return "the factory code differs";
    for (const [used, now] of uses) {
      const problem = visit(used, now);
      if (problem) return used === from ? problem : `module ${used} → ${now}, which it uses, is not the same: ${problem}`;
    }
    return null;
  };
  const problem = visit(String(oldId), String(newId));
  return problem ? { ok: false, reason: problem } : { ok: true };
}

function htmlFiles(base) {
  const walk = (current) => fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".html") ? [path.relative(base, full).replaceAll("\\", "/")] : [];
  });
  return fs.existsSync(base) ? walk(base).sort() : [];
}

function main() {
  const args = process.argv.slice(2);
  const loose = args.includes("--loose-client-ids");
  const explainAt = args.indexOf("--explain-client-ids");
  const explain = explainAt >= 0 ? args[explainAt + 1] : undefined;
  const [mode, dir] = args.filter((arg, index) => arg !== "--loose-client-ids" && (explainAt < 0 || (index !== explainAt && index !== explainAt + 1)));
  const usage = "Usage: node scripts/html-snapshot.mjs save <snapshot-dir> | compare <snapshot-dir> [--loose-client-ids | --explain-client-ids <dist of the saved build>]";
  if (!["save", "compare"].includes(mode) || !dir || ((loose || explainAt >= 0) && mode !== "compare") || (explainAt >= 0 && (!explain || explain.startsWith("--") || loose))) {
    console.error(usage);
    process.exit(2);
  }
  const root = "dist";
  const artifacts = fileURLToPath(new URL("../artifacts", import.meta.url));
  const current = htmlFiles(root);
  if (!current.length) {
    console.error("dist/ has no HTML files; build first.");
    process.exit(1);
  }
  const marker = path.join(dir, ".format");
  if (mode === "save") {
    const inside = path.relative(artifacts, path.resolve(dir));
    if (!inside || inside === ".." || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) {
      console.error(`Refusing to replace ${dir}: save into a folder inside ${artifacts}.`);
      process.exit(2);
    }
    const pages = current.map((file) => [file, normalize(fs.readFileSync(path.join(root, file), "utf8"))]);
    fs.rmSync(dir, { recursive: true, force: true });
    for (const [file, text] of pages) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
    }
    fs.writeFileSync(marker, `${FORMAT}\n`);
    console.log(`Saved ${current.length} normalized pages (format ${FORMAT}) to ${dir}.`);
    return;
  }
  const saved = htmlFiles(dir);
  if (!saved.length) {
    console.error(`${dir} has no saved pages; run save first.`);
    process.exit(1);
  }
  const format = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : "1";
  if (format !== String(FORMAT)) {
    console.error(`${dir} was saved in format ${format}; this script compares format ${FORMAT}. Save it again from the build it records.`);
    process.exit(1);
  }
  if (loose) console.warn("Warning: --loose-client-ids ignores client module ids, so a page that swaps one client component for another goes unnoticed. Use it only to triage a changed module set.");
  const problems = [];
  let explained = 0;
  const describe = ({ name, from, to, line }) => `${JSON.stringify(name)} ${from} → ${to} (line ${line})`;
  for (const file of saved) {
    if (!current.includes(file)) {
      problems.push(`missing page: ${file}`);
      continue;
    }
    const savedText = fs.readFileSync(path.join(dir, file), "utf8");
    const currentText = normalize(fs.readFileSync(path.join(root, file), "utf8"));
    if (savedText === currentText) continue;
    const before = withoutClientIds(savedText);
    const after = withoutClientIds(currentText);
    if (before === after) {
      // Only client module ids changed: the same export at the same place in an identical page.
      if (loose) continue;
      const changes = changedClientIds(savedText, currentText);
      if (explain) {
        const unexplained = changes.flatMap((change) => {
          const result = explainModule(explain, change.from, root, change.to);
          return result.ok ? [] : [`${describe(change)}: ${result.reason}`];
        });
        if (!unexplained.length) { explained += changes.length; continue; }
        problems.push(`${file}: client module ids changed that --explain-client-ids cannot explain:\n${unexplained.map((line) => `    ${line}`).join("\n")}`);
      } else {
        problems.push(`${file}: only client module ids changed:\n${changes.map((change) => `    ${describe(change)}`).join("\n")}\n  Check them with --explain-client-ids <dist of the saved build> (same export, place and factory code).`);
      }
      continue;
    }
    let at = 0;
    while (before[at] === after[at]) at++;
    const context = (text) => JSON.stringify(text.slice(Math.max(0, at - 80), at + 120));
    problems.push(`changed page: ${file} at character ${at}\n  before: ${context(before)}\n  after:  ${context(after)}`);
  }
  const added = current.filter((file) => !saved.includes(file));
  if (added.length) console.log(`New pages (not in the snapshot): ${added.join(", ")}`);
  const note = loose ? " (client module ids ignored)" : explained ? ` (${explained} client module id${explained === 1 ? "" : "s"} changed; each has the same export, place and factory code, module ids aside)` : "";
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
  } else console.log(`Rendered HTML identical to ${dir}: ${saved.length} pages${note}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
