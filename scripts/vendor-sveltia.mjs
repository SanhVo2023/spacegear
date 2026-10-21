// Vendors a pinned Sveltia CMS release into public/admin/sveltia/ so /admin/ never loads CMS
// code from a CDN. It downloads the npm tarball, checks its sha512 integrity against the pin
// below, and extracts the browser bundle (dist/sveltia-cms.js), the lazy chunks it imports
// relative to its own URL (dist/chunks/**) and the MIT licence. Source maps stay out (check-export
// rejects *.map files), so the trailing sourceMappingURL comments are dropped as well.
//   node scripts/vendor-sveltia.mjs          download and rewrite the vendored files + lock
//   node scripts/vendor-sveltia.mjs --check  verify the vendored files against the lock (offline)
// To upgrade: set version, tarball and integrity from `npm view @sveltia/cms@<v> dist.tarball dist.integrity`
// (a release at least 14 days old), then follow README.md, "Editing content".
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
};
export const TARGET = "public/admin/sveltia";
export const LOCK = "scripts/sveltia-cms.lock.json";
/** The project folder (the parent of scripts/), wherever the command runs from. */
export const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WANTED = /^package\/(?:dist\/sveltia-cms\.js|dist\/chunks\/.+\.js|LICENSE\.txt)$/;

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

/** Minimal ustar reader (with pax `path` records): returns Map<name, Buffer> of regular files. */
export function untar(buffer) {
  const files = new Map();
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
    if (type === "0") files.set(name, Buffer.from(body));
  }
  return files;
}

/** Drops a trailing sourceMappingURL comment. Works on the bytes (latin1 maps each byte to one character), so nothing else changes. */
function withoutSourceMap(body) {
  return Buffer.from(body.toString("latin1").replace(/\n?\/\/# sourceMappingURL=\S+\s*$/, "\n"), "latin1");
}

/** Picks the vendored files out of the tarball and strips their sourceMappingURL comments. */
export function extractVendored(tgz) {
  const integrity = `sha512-${crypto.createHash("sha512").update(tgz).digest("base64")}`;
  if (integrity !== SVELTIA.integrity) throw new Error(`Integrity mismatch for ${SVELTIA.name}@${SVELTIA.version}: expected ${SVELTIA.integrity}, got ${integrity}`);
  const out = new Map();
  for (const [name, body] of untar(zlib.gunzipSync(tgz))) {
    if (!WANTED.test(name)) continue;
    const relative = name.replace(/^package\/(?:dist\/)?/, "");
    out.set(relative, relative.endsWith(".js") ? withoutSourceMap(body) : body);
  }
  if (!out.has("sveltia-cms.js")) throw new Error("The tarball has no dist/sveltia-cms.js");
  return new Map([...out].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).replaceAll("\\", "/")];
  });
}

/** Offline check used by `npm test`: the vendored files are exactly the locked release. */
export function verifyVendored(root = ROOT) {
  const lockFile = path.join(root, LOCK);
  if (!fs.existsSync(lockFile)) return [`${LOCK} is missing; run npm run cms:vendor`];
  const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
  const problems = [];
  if (lock.version !== SVELTIA.version || lock.integrity !== SVELTIA.integrity) problems.push(`${LOCK} does not match the pin in scripts/vendor-sveltia.mjs; run npm run cms:vendor`);
  for (const [relative, hash] of Object.entries(lock.files)) {
    const file = path.join(root, TARGET, relative);
    if (!fs.existsSync(file)) problems.push(`missing ${TARGET}/${relative}`);
    else if (sha256(fs.readFileSync(file)) !== hash) problems.push(`${TARGET}/${relative} differs from the vendored release`);
  }
  for (const relative of listFiles(path.join(root, TARGET))) if (!(relative in lock.files)) problems.push(`unexpected file ${TARGET}/${relative}`);
  return problems;
}

async function vendor(root = ROOT) {
  const response = await fetch(SVELTIA.tarball);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${SVELTIA.tarball}`);
  const files = extractVendored(Buffer.from(await response.arrayBuffer()));
  const target = path.join(root, TARGET);
  fs.rmSync(target, { recursive: true, force: true });
  const hashes = {};
  for (const [relative, data] of files) {
    const file = path.join(target, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    hashes[relative] = sha256(data);
  }
  fs.writeFileSync(path.join(root, LOCK), `${JSON.stringify({ ...SVELTIA, files: hashes }, null, 2)}\n`);
  console.log(`Vendored ${SVELTIA.name}@${SVELTIA.version}: ${files.size} files in ${TARGET}/.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes("--check")) {
    const problems = verifyVendored();
    if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
    else console.log(`Vendored ${SVELTIA.name}@${SVELTIA.version} matches ${LOCK}.`);
  } else await vendor();
}
