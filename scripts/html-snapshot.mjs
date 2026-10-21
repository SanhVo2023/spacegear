// Proves that a change did not alter what the exported pages render. `save` writes a normalized
// copy of every dist/**/*.html; `compare` normalizes the current dist/ the same way and reports
// any page that differs.
//
// Format 2 normalizes a page into two parts:
//  1. The HTML with only the inline RSC payload scripts (self.__next_f.push([1,"…"])) removed.
//     Every other <script> stays: JSON-LD, the RSC bootstrap, the noModule polyfill, chunk tags.
//  2. The React tree of the RSC payload, resolved from row 0 with every outlined row put back in
//     place, so neither row ids nor where React splits the payload into rows can change the result.
//     Client references are reduced to their export name and async flag. The layout's async chunk
//     elements (["$","script","script-N",{src,async,nonce}] with exactly those props) are dropped,
//     so a different number of chunks compares equal.
// Then the masks below remove what changes between builds of the same source: the build ID,
// hashed chunk and media names, runs of chunk <script>/<link> tags, and CRLF line endings.
// tests/html-snapshot.test.mjs plants changes that must and must not compare equal.
// `save` replaces the snapshot folder, so it only accepts a folder inside this worktree's
// artifacts/; it writes a `.format` marker, and `compare` refuses a folder in another format.
//   node scripts/html-snapshot.mjs save artifacts/html-baseline
//   node scripts/html-snapshot.mjs compare artifacts/html-baseline
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FORMAT = 2;
const PUSH = /<script>self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)<\/script>/g;
const ROW_TAGS = new Set(["I", "HL", "HC", "E", "W", "D"]);
const CHUNK_SRC = /^\/_next\/static\/chunks\/[\w.~-]+\.js$/;
// $<hex>, $L<hex> (lazy), $@<hex> (promise), $W<hex> (Set), $Q<hex> (Map), each with an optional :key:key path.
const REFERENCE = /^\$([LW@Q]?)([0-9a-f]+)((?::[^:]*)*)$/;
// Kept as they are: "$" (element), "$$…" (escaped text), "$S…" (symbol), "$D…" (date), "$n…" (bigint).
const KEPT = /^\$(?:$|\$|S|D|n)/;
const OTHER_REFERENCE = /^\$[A-Za-z@][0-9a-f]+(?::|$)/;

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
          row = { kind: "client", value: { $client: value[2], async: value[3] === 1 } };
        } else row = { kind: "tagged", value: { $row: tag, value } };
      } else row = { kind: "json", value: JSON.parse(line) };
    }
    if (head[1] === "") hints.push(row.value);
    else rows.set(head[1], row);
  }
  return { rows, hints };
}

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** A layout async chunk element, exactly as Next writes it. */
const isChunkScript = (value) => Array.isArray(value) && value.length === 4 && value[0] === "$" && value[1] === "script"
  && typeof value[2] === "string" && /^script-\d+$/.test(value[2]) && isRecord(value[3])
  && Object.keys(value[3]).length === 3 && typeof value[3].src === "string" && CHUNK_SRC.test(value[3].src)
  && value[3].async === true && value[3].nonce === "$undefined";

/** The React tree from row 0 with every reference resolved in place; cycles become {$cycle: depth}. */
export function resolveTree(rows) {
  const stack = [];
  const rowOf = (reference, rowId) => {
    const row = rows.get(rowId);
    if (!row) throw new Error(`RSC reference "${reference}" points at a missing row`);
    return row;
  };
  const resolveString = (value) => {
    if (!value.startsWith("$") || KEPT.test(value)) return value;
    const reference = REFERENCE.exec(value);
    if (!reference) {
      if (OTHER_REFERENCE.test(value)) throw new Error(`unknown RSC reference "${value}"`);
      return value;
    }
    const [, kind, rowId, keyPath] = reference;
    if (stack.includes(rowId)) return { $cycle: stack.length - stack.lastIndexOf(rowId) };
    stack.push(rowId);
    let target = rowOf(value, rowId).value;
    for (const key of keyPath.split(":").slice(1)) {
      // A path may run through another outlined row.
      while (typeof target === "string" && REFERENCE.test(target)) target = rowOf(target, REFERENCE.exec(target)[2]).value;
      if (target === null || typeof target !== "object" || !Object.hasOwn(target, key)) throw new Error(`RSC reference "${value}" does not resolve`);
      target = target[key];
    }
    const resolved = resolve(target);
    stack.pop();
    if (kind === "W") return { $Set: resolved };
    if (kind === "Q") return { $Map: resolved };
    if (kind === "@") return { $promise: resolved };
    return resolved;
  };
  const resolve = (value) => {
    if (typeof value === "string") return resolveString(value);
    if (Array.isArray(value)) return value.map(resolve).filter((item) => !isChunkScript(item));
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolve(child)]));
    return value;
  };
  return rows.has("0") ? resolve(rows.get("0").value) : null;
}

/** Removes what differs between two builds of the same source (see the header). */
function mask(text) {
  return text
    .replace(/\/_next\/static\/(chunks|media)\/[\w.~-]+?(\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico))(?=[\\"'\s)?#,])/g, "/_next/static/$1/HASH$2")
    .replace(/\bI\[\d+,/g, "I[ID,")
    .replace(/(?:\\"\/_next\/static\/chunks\/HASH\.js\\",?)+/g, '\\"CHUNKS\\",')
    .replace(/(?:<script src="\/_next\/static\/chunks\/HASH\.js" async=""><\/script>)+/g, "<script CHUNKS></script>")
    .replace(/(?:<link rel="preload" as="script" fetchPriority="low" href="\/_next\/static\/chunks\/HASH\.js"\/>)+/g, "<link CHUNKS/>");
}

/**
 * The format-2 form of one exported page. `buildId` defaults to the ID the page names in its RSC
 * payload ("b":"<id>").
 */
export function normalize(html, buildId = "") {
  const source = html.replace(/\r\n/g, "\n");
  // Join the payload before any masking, so text-row byte lengths still match.
  const stream = [...source.matchAll(PUSH)].map((match) => JSON.parse(match[1])).join("");
  const id = buildId || stream.match(/"b":"([^"]+)"/)?.[1] || "";
  const { rows, hints } = decodeRows(stream);
  let out = `${source.replace(PUSH, "")}\n${JSON.stringify({ tree: resolveTree(rows), hints }, null, 1)}\n`;
  if (id) out = out.replaceAll(id, "BUILD_ID");
  return mask(out);
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
  const [mode, dir] = process.argv.slice(2);
  if (!["save", "compare"].includes(mode) || !dir) {
    console.error("Usage: node scripts/html-snapshot.mjs save|compare <snapshot-dir>");
    process.exit(2);
  }
  const root = "dist";
  const artifacts = fileURLToPath(new URL("../artifacts", import.meta.url));
  const buildId = fs.existsSync(".next/BUILD_ID") ? fs.readFileSync(".next/BUILD_ID", "utf8").trim() : "";
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
    const pages = current.map((file) => [file, normalize(fs.readFileSync(path.join(root, file), "utf8"), buildId)]);
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
  const problems = [];
  for (const file of saved) {
    if (!current.includes(file)) {
      problems.push(`missing page: ${file}`);
      continue;
    }
    const before = fs.readFileSync(path.join(dir, file), "utf8");
    const after = normalize(fs.readFileSync(path.join(root, file), "utf8"), buildId);
    if (before === after) continue;
    let at = 0;
    while (before[at] === after[at]) at++;
    const context = (text) => JSON.stringify(text.slice(Math.max(0, at - 80), at + 120));
    problems.push(`changed page: ${file} at character ${at}\n  before: ${context(before)}\n  after:  ${context(after)}`);
  }
  const added = current.filter((file) => !saved.includes(file));
  if (added.length) console.log(`New pages (not in the snapshot): ${added.join(", ")}`);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
  } else console.log(`Rendered HTML identical to ${dir}: ${saved.length} pages.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
