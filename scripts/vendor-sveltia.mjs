// Vendors a pinned Sveltia CMS release into public/admin/sveltia/ so /admin/ never loads CMS
// code from a CDN. It downloads the npm tarball, checks its sha512 integrity against the pin
// below, and extracts the browser bundle (dist/sveltia-cms.js), the lazy chunks it imports
// relative to its own URL (dist/chunks/**) and the MIT licence. Source maps stay out (check-export
// rejects *.map files), so the trailing sourceMappingURL comments are dropped as well.
// From the same tarball it also keeps the release's configuration schema (schema/sveltia-cms.json)
// as scripts/sveltia-cms.schema.json, for scripts/check-sveltia-config.mjs; it never ships.
// Two trust roots: the tarball's integrity, and the sha256 of every vendored file and of the
// schema, all pinned in SVELTIA below. The lock (scripts/sveltia-cms.lock.json) must repeat the
// pinned hashes, so new vendored bytes need a visible edit here as well as a new lock.
//   node scripts/vendor-sveltia.mjs          download and rewrite the vendored files + lock
//   node scripts/vendor-sveltia.mjs --check  verify the vendored files against the pin and lock (offline)
// To upgrade: set version, tarball and integrity from `npm view @sveltia/cms@<v> dist.tarball dist.integrity`
// (a release at least 14 days old), empty `files` and `schema`, run the script, check what it
// extracted, then pin the hashes it wrote to the lock. Then follow README.md, "Upgrading Sveltia".
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SVELTIA = {
  name: "@sveltia/cms",
  version: "0.230.1",
  tarball: "https://registry.npmjs.org/@sveltia/cms/-/cms-0.230.1.tgz",
  integrity: "sha512-2iTmW3txB2ocqzEO6b/hkr9Txbw+AFMfmmmqarY3B0WrG5eikwXwYwFWB5CGoQMz1JT5RvcVnKINAWBcVfVRMg==",
  /** sha256 of each vendored file, after its sourceMappingURL comment is removed. */
  files: {
    "LICENSE.txt": "dcbe3c626d85741f6fabefed0b34d07a2e92c032f63aa21c0279062363859c32",
    "chunks/react-dom.js": "9b5ffe4f9241b1885d9da326f3401e9727d628bfbecb0cb32b027cda25d5bfeb",
    "sveltia-cms.js": "d3eff7b0ba761ee1d06e9f581304075a575757de4cbd7ec1179b95873f6f4fc7",
  },
  /**
   * sha256 of the release's own configuration schema (schema/sveltia-cms.json in the tarball).
   * It is kept in scripts/ (SCHEMA_FILE) for scripts/check-sveltia-config.mjs and never ships:
   * /admin/ serves SVELTIA.files only (scripts/lib/admin.mjs).
   */
  schema: "59a82ee742c6e6ecf862412272b8da30b81f505b8f2091cc71ce27681fb9c778",
};
export const TARGET = "public/admin/sveltia";
export const LOCK = "scripts/sveltia-cms.lock.json";
export const SCHEMA_FILE = "scripts/sveltia-cms.schema.json";
const SCHEMA_ENTRY = "package/schema/sveltia-cms.json";
/** The project folder (the parent of scripts/), wherever the command runs from. */
export const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** The unpacked tarball may not exceed this (0.230.1 unpacks to 41.8 MiB): a gzip bomb stops here. */
export const MAX_UNPACKED = 64 << 20;
const WANTED = /^package\/(?:dist\/sveltia-cms\.js|dist\/chunks\/.+\.js|LICENSE\.txt)$/;
/** A vendored path: folders and file names of letters, digits, _, . and - only, never "." or "..". */
const SAFE_PATH = /^(?:(?!\.\.?\/)[\w.-]+\/)*(?!\.\.?$)[\w.-]+$/;

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
const sameHashes = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** Minimal ustar reader (with pax `path` records): every entry as { name, type, body }, in order. */
export function untarEntries(buffer) {
  const entries = [];
  let offset = 0;
  let paxPath = null;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) => header.subarray(start, start + length).toString("utf8").replace(/\0[\s\S]*$/, "");
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1) || "0";
    const prefix = field(345, 155);
    let name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const body = buffer.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") { paxPath = body.toString("utf8").match(/^\d+ path=(.+)$/m)?.[1] ?? null; continue; }
    if (type === "g") continue;
    if (paxPath) { name = paxPath; paxPath = null; }
    entries.push({ name, type, body: Buffer.from(body) });
  }
  return entries;
}

/** The regular files of a tar archive: Map<name, Buffer>. */
export function untar(buffer) {
  return new Map(untarEntries(buffer).filter(({ type }) => type === "0").map(({ name, body }) => [name, body]));
}

/** Drops a trailing sourceMappingURL comment. Works on the bytes (latin1 maps each byte to one character), so nothing else changes. */
function withoutSourceMap(body) {
  return Buffer.from(body.toString("latin1").replace(/\n?\/\/# sourceMappingURL=\S+\s*$/, "\n"), "latin1");
}

/** The tar archive inside `tgz`, once its integrity is the pin's and it unpacks to at most MAX_UNPACKED. */
function unpackVerified(tgz, pin) {
  const integrity = `sha512-${crypto.createHash("sha512").update(tgz).digest("base64")}`;
  if (integrity !== pin.integrity) throw new Error(`Integrity mismatch for ${pin.name}@${pin.version}: expected ${pin.integrity}, got ${integrity}`);
  try {
    return zlib.gunzipSync(tgz, { maxOutputLength: MAX_UNPACKED });
  } catch (error) {
    if (error?.code === "ERR_BUFFER_TOO_LARGE" || error instanceof RangeError) throw new Error(`${pin.name}@${pin.version} unpacks to more than ${MAX_UNPACKED >> 20} MiB; raise MAX_UNPACKED only after checking the release`, { cause: error });
    throw error;
  }
}

/**
 * The release's configuration schema (schema/sveltia-cms.json) from the same verified tarball:
 * exactly one regular file, with the pinned sha256 when the pin has one.
 */
export function extractSchema(tgz, pin = SVELTIA) {
  const found = untarEntries(unpackVerified(tgz, pin)).filter(({ name }) => name === SCHEMA_ENTRY);
  if (found.length !== 1 || found[0].type !== "0") throw new Error(`The tarball must hold ${SCHEMA_ENTRY} once, as a regular file (found ${found.length})`);
  const hash = sha256(found[0].body);
  if (pin.schema && hash !== pin.schema) throw new Error(`The extracted ${SCHEMA_ENTRY} differs from the hash pinned in scripts/vendor-sveltia.mjs (SVELTIA.schema): ${hash}`);
  return found[0].body;
}

/**
 * Picks the vendored files out of the tarball and strips their sourceMappingURL comments. Refuses
 * a tarball whose integrity is not the pin's, that unpacks to more than MAX_UNPACKED, whose wanted
 * names are unsafe, not regular files or repeated, or whose files do not have the pinned hashes
 * (when the pin lists any). `pin` is SVELTIA; tests pass their own.
 */
export function extractVendored(tgz, pin = SVELTIA) {
  const tar = unpackVerified(tgz, pin);
  const out = new Map();
  for (const { name, type, body } of untarEntries(tar)) {
    if (!WANTED.test(name)) continue;
    const relative = name.replace(/^package\/(?:dist\/)?/, "");
    if (!SAFE_PATH.test(relative)) throw new Error(`Refusing ${name}: vendored names use letters, digits, _, . and - only, with no "." or ".." folders`);
    if (type !== "0") throw new Error(`Refusing ${name}: it is not a regular file (tar type ${JSON.stringify(type)})`);
    if (out.has(relative)) throw new Error(`Refusing ${name}: it appears twice in the tarball`);
    out.set(relative, relative.endsWith(".js") ? withoutSourceMap(body) : body);
  }
  if (!out.has("sveltia-cms.js")) throw new Error("The tarball has no dist/sveltia-cms.js");
  const sorted = new Map([...out].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const hashes = Object.fromEntries([...sorted].map(([relative, data]) => [relative, sha256(data)]));
  if (pin.files && Object.keys(pin.files).length && !sameHashes(hashes, pin.files)) {
    throw new Error(`The extracted files differ from the hashes pinned in scripts/vendor-sveltia.mjs (SVELTIA.files):\n${JSON.stringify(hashes, null, 2)}`);
  }
  return sorted;
}

/** `relative` below `base`, refused when it would land outside it. */
function inside(base, relative) {
  const file = path.resolve(base, relative);
  if (!SAFE_PATH.test(relative) || !file.startsWith(path.resolve(base) + path.sep)) throw new Error(`Refusing ${relative}: it is not a path inside ${base}`);
  return file;
}

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).replaceAll("\\", "/")];
  });
}

/** Offline check used by `npm test`: the vendored files and the lock are exactly the pinned release. */
export function verifyVendored(root = ROOT, pin = SVELTIA) {
  const lockFile = path.join(root, LOCK);
  if (!fs.existsSync(lockFile)) return [`${LOCK} is missing; run npm run cms:vendor`];
  const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
  const problems = [];
  if (lock.version !== pin.version || lock.integrity !== pin.integrity) problems.push(`${LOCK} does not match the pin in scripts/vendor-sveltia.mjs; run npm run cms:vendor`);
  if (!sameHashes(lock.files ?? {}, pin.files)) problems.push(`${LOCK} lists other files or hashes than SVELTIA.files in scripts/vendor-sveltia.mjs; new vendored bytes need both pins changed`);
  const target = path.join(root, TARGET);
  for (const [relative, hash] of Object.entries(pin.files)) {
    let file;
    try {
      file = inside(target, relative);
    } catch (error) {
      problems.push(error.message);
      continue;
    }
    if (!fs.existsSync(file)) problems.push(`missing ${TARGET}/${relative}`);
    else if (sha256(fs.readFileSync(file)) !== hash) problems.push(`${TARGET}/${relative} differs from the vendored release`);
  }
  for (const relative of listFiles(target)) if (!Object.hasOwn(pin.files, relative)) problems.push(`unexpected file ${TARGET}/${relative}`);
  if (pin.schema) {
    if (lock.schema !== pin.schema) problems.push(`${LOCK} lists another schema hash than SVELTIA.schema in scripts/vendor-sveltia.mjs; a new schema needs both pins changed`);
    const schema = path.join(root, SCHEMA_FILE);
    if (!fs.existsSync(schema)) problems.push(`missing ${SCHEMA_FILE}; run npm run cms:vendor`);
    else if (sha256(fs.readFileSync(schema)) !== pin.schema) problems.push(`${SCHEMA_FILE} differs from the vendored release's schema`);
  }
  return problems;
}

/**
 * Replaces the vendored folder with `files` (from extractVendored), writes the schema (from
 * extractSchema) when one is given, and writes the lock.
 */
export function writeVendored(files, root = ROOT, pin = SVELTIA, schema = null) {
  const target = path.join(root, TARGET);
  const paths = [...files.keys()].map((relative) => [relative, inside(target, relative)]);
  fs.rmSync(target, { recursive: true, force: true });
  const hashes = {};
  for (const [relative, file] of paths) {
    const data = files.get(relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    hashes[relative] = sha256(data);
  }
  fs.mkdirSync(path.dirname(path.join(root, LOCK)), { recursive: true });
  const lock = { name: pin.name, version: pin.version, tarball: pin.tarball, integrity: pin.integrity, files: hashes };
  if (schema) {
    fs.writeFileSync(path.join(root, SCHEMA_FILE), schema);
    lock.schema = sha256(schema);
  }
  fs.writeFileSync(path.join(root, LOCK), `${JSON.stringify(lock, null, 2)}\n`);
  return hashes;
}

async function vendor() {
  const response = await fetch(SVELTIA.tarball);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${SVELTIA.tarball}`);
  const tgz = Buffer.from(await response.arrayBuffer());
  const files = extractVendored(tgz);
  const schema = extractSchema(tgz);
  writeVendored(files, ROOT, SVELTIA, schema);
  console.log(`Vendored ${SVELTIA.name}@${SVELTIA.version}: ${files.size} files in ${TARGET}/, and its configuration schema in ${SCHEMA_FILE} (sha256 ${sha256(schema)}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes("--check")) {
    const problems = verifyVendored();
    if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
    else console.log(`Vendored ${SVELTIA.name}@${SVELTIA.version} matches ${LOCK} and the pinned hashes.`);
  } else await vendor();
}
