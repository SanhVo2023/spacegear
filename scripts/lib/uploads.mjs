// The rules for CMS uploads (public/uploads/) and their generated variants. The variant step
// (scripts/build-upload-variants.mjs), check-content, package-site and check-export all use them.
// - Only images can be uploaded: .webp, .png, .jpg, .jpeg, .avif and .gif. An SVG served from the
//   site's origin is an active document, so it is refused like any other file.
// - Names use lowercase letters, digits, - and _ (folders too), with a lowercase extension, and no
//   segment may be a Windows device name (con, prn, aux, nul, com0-9, lpt0-9): Git for Windows
//   cannot check those out. The content schema's image rule (IMAGE in src/lib/content-schema.ts)
//   accepts the same names; tests/uploads.test.mjs checks that they agree.
// - Dotfiles and dot-folders (.gitkeep, the CMS's .sveltia-tmp-* files) are ignored: never
//   processed, checked or shipped.
// - Links (symbolic links, junctions) and hard links are refused anywhere in the folder and never
//   followed: `next build` follows links when it copies public/ to out/.
// - WebP, PNG, JPEG and AVIF uploads get 640 and 1280 px WebP variants. They are build output,
//   kept outside public/ in CACHE_DIR (so neither next build nor the CMS media library sees them)
//   and named after the whole original name: photo.jpg -> photo.jpg.w640.webp and
//   photo.jpg.w1280.webp. No upload can have such a name (a dot in the stem), so nothing is
//   reserved and nothing can collide. package-site ships them next to the originals, under
//   /uploads/. A manifest records each original's content hash; a variant is current only while
//   the hash matches. GIFs get no variants and ship as they are, so an animation keeps playing.
// - No upload may carry location data (GPS in its EXIF or XMP metadata): originals ship as they
//   are. The CMS re-encodes JPEG, PNG, AVIF and HEIC uploads, which drops metadata, but keeps GIF
//   and WebP as they are (so animations survive), and a file can also be added outside the CMS.
// - A name the site cannot show gets rename advice with a suggested name (renameAdvice).
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const UPLOADS_DIR = path.join(ROOT, "public", "uploads");
/** Generated variants and their manifest: build output (.gitignore), never under public/. */
export const CACHE_DIR = path.join(ROOT, ".cache", "upload-variants");

export const WIDTHS = [640, 1280];
/** The only file types that may be uploaded, and the only ones that ship. */
export const UPLOAD_EXTENSIONS = ["webp", "png", "jpg", "jpeg", "avif", "gif"];
/** Uploads that get variants. */
export const RASTER = /\.(?:jpe?g|png|webp|avif)$/i;
const DEVICE = String.raw`(?!(?:[a-z0-9_-]+\/)*(?:con|prn|aux|nul|com\d|lpt\d)[./])`;
const NAMES = String.raw`(?:[a-z0-9_-]+\/)*[a-z0-9_-]+`;
/** A path below uploads/ that the site can show, and so may ship. */
export const UPLOAD_PATH = new RegExp(String.raw`^${DEVICE}${NAMES}\.(?:webp|png|jpe?g|avif|gif)$`);
/** A path below images/ (site images, which may also be SVG). */
export const SITE_IMAGE_PATH = new RegExp(String.raw`^${DEVICE}${NAMES}\.(?:webp|png|jpe?g|avif|gif|svg)$`);
/** A generated variant's name. Content may not point at one. */
export const VARIANT = /\.w(?:640|1280)\.webp$/i;
/** An /uploads/ path in a page, payload or chunk: not part of a longer URL or name. */
export const UPLOAD_REF = /(?<![\w.:/%-])\/uploads\/[\w./-]+\.(?:webp|png|jpe?g|avif|gif|svg)(?![\w.-])/gi;
/** Changes whenever the encoding (or the manifest's form) changes, so every variant is rebuilt. */
export const RECIPE = "webp quality 80, sRGB, EXIF orientation applied, widths 640 and 1280, variant hashes, v2";

export const variantFile = (original, width) => `${original}.w${width}.webp`;
export const variantFiles = (original) => WIDTHS.map((width) => variantFile(original, width));
/** Where the variant of an upload (`rel` below uploads/) is kept. */
export const cachedVariant = (cacheDir, rel, width) => path.join(cacheDir, "files", ...variantFile(rel, width).split("/"));
/** The upload a variant name belongs to (`team/a.jpg` for `team/a.jpg.w640.webp`), or null. */
export function variantOriginal(rel) {
  const match = /^(.+)\.w(?:640|1280)\.webp$/.exec(rel);
  return match && UPLOAD_PATH.test(match[1]) && RASTER.test(match[1]) ? match[1] : null;
}

let sharpModule;
/** sharp, loaded only when an image has to be read (and set not to keep files open: Windows locks them). */
export async function loadSharp() {
  if (!sharpModule) {
    sharpModule = (await import("sharp")).default;
    sharpModule.cache(false);
  }
  return sharpModule;
}

const DEVICE_NAME = /^(?:con|prn|aux|nul|com\d|lpt\d)$/;
const NAME_RULE = "upload names use lowercase letters, digits, - and _ only, in folders too, with a lowercase extension, and are not a Windows device name such as con or nul";

/** A folder or file stem cut down to the upload rules: accents dropped, lowercase, other characters as "-". */
function cleanName(part) {
  const cleaned = part.normalize("NFKD").replace(/\p{M}/gu, "").replace(/ı/g, "i").toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (!cleaned) return "image";
  return DEVICE_NAME.test(cleaned) ? `${cleaned}-1` : cleaned;
}

/** A name close to `rel` (below uploads/, with an image extension) that UPLOAD_PATH accepts. */
export function suggestedUploadName(rel) {
  const folders = rel.split("/");
  const file = folders.pop();
  const dot = file.lastIndexOf(".");
  return [...folders.map(cleanName), `${cleanName(file.slice(0, dot))}.${file.slice(dot + 1).toLowerCase()}`].join("/");
}

/** What in `rel` breaks the name rules, in words an editor can act on. */
function nameFaults(rel) {
  const faults = new Set();
  const others = new Set();
  const segments = rel.split("/");
  segments.forEach((segment, index) => {
    const dot = index === segments.length - 1 ? segment.lastIndexOf(".") : -1;
    const stem = dot > 0 ? segment.slice(0, dot) : segment;
    if (/[A-Z]/.test(dot > 0 ? segment.slice(dot + 1) : "")) faults.add("capital letters");
    const device = stem.split(".")[0].toLowerCase();
    if (DEVICE_NAME.test(device)) others.add(`"${device}", a Windows device name`);
    for (const char of stem) {
      if (/[a-z0-9_-]/.test(char)) continue;
      if (/[A-Z]/.test(char)) faults.add("capital letters");
      else if (char === " ") faults.add("spaces");
      else if (char === ".") others.add('"." before the extension');
      else if (char === "ı") others.add('"ı", the dotless i that a Turkish-language browser writes for I');
      else if (/[\p{C}\p{Z}]/u.test(char)) others.add(`U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`);
      else others.add(`"${char}"`);
    }
  });
  return [...faults, ...others];
}

/** The advice for an upload name UPLOAD_PATH refuses: a suggested name, the rule, and what to change. */
export function renameAdvice(rel) {
  const faults = nameFaults(rel);
  return `rename it, for example to ${suggestedUploadName(rel)}: ${NAME_RULE}${faults.length ? ` (not allowed here: ${faults.join(", ")})` : ""}`;
}

export const LINK_PROBLEM = "is a link (symbolic link or junction); uploads must be regular files: remove it and upload the file itself";
export const hardLinkProblem = (nlink) => `is one file with ${nlink} names (hard links); uploads must be files of their own: copy it instead of linking it`;

const byRel = (a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);

/**
 * Everything in an uploads folder, without following links: `files` (regular files), `links`,
 * `hardLinks` (regular files with more than one name, with `nlink`) and `others` (pipes,
 * devices), each as `{ file, rel }`, with `rel` relative to the folder and using forward slashes.
 * Dot entries are skipped, except links, unless `dotted` is set. Returns null when the folder does
 * not exist. When the folder itself is a link (or not a folder), it is the only entry, with rel "".
 */
export function listUploads(dir, { dotted = false } = {}) {
  let stat;
  try {
    stat = fs.lstatSync(dir);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  const listing = { files: [], links: [], hardLinks: [], others: [] };
  if (stat.isSymbolicLink()) listing.links.push({ file: dir, rel: "" });
  else if (!stat.isDirectory()) listing.others.push({ file: dir, rel: "" });
  else {
    const walk = (folder, prefix) => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        const rel = prefix + entry.name;
        if (entry.isSymbolicLink()) listing.links.push({ file, rel });
        else if (entry.name.startsWith(".") && !dotted) continue;
        else if (entry.isDirectory()) walk(file, `${rel}/`);
        else if (entry.isFile()) {
          const { nlink } = fs.lstatSync(file);
          if (nlink > 1) listing.hardLinks.push({ file, rel, nlink });
          else listing.files.push({ file, rel });
        } else listing.others.push({ file, rel });
      }
    };
    walk(dir, "");
  }
  for (const list of Object.values(listing)) list.sort(byRel);
  return listing;
}

function readHead(file, length = 256) {
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(length);
    return buffer.subarray(0, fs.readSync(fd, buffer, 0, length, 0));
  } finally {
    fs.closeSync(fd);
  }
}

/** The SHA-1 of a file's bytes, read in 1 MiB pieces. */
export function hashFile(file) {
  const hash = crypto.createHash("sha1");
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(1 << 20);
    for (let read; (read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0;) hash.update(buffer.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

export const isRegularFile = (file) => {
  try {
    return fs.lstatSync(file).isFile();
  } catch {
    return false;
  }
};

/**
 * True when `rel` (forward slashes) below `base` is a regular file reached through real folders
 * only: no segment on the way is a link, so a link inside the cache can never lead elsewhere.
 */
export function isRealFile(base, rel) {
  const segments = rel.split("/");
  let current = base;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink()) return false;
    if (index < segments.length - 1 ? !stat.isDirectory() : !stat.isFile()) return false;
  }
  return true;
}

/** The size and SHA-1 of a file, as the manifest records them. */
export const fingerprint = (file) => ({ size: fs.statSync(file).size, sha1: hashFile(file) });

/**
 * The cache manifest:
 * `{ recipe, uploads: { "<rel>": { sha1, size, variants: { "640": { sha1, size }, "1280": … } } } }`.
 * A missing, unreadable or outdated manifest (another RECIPE), or one that is not a regular file
 * (a link is never followed), counts as empty, so every variant is rebuilt.
 */
export function readManifest(cacheDir) {
  try {
    if (isRealFile(cacheDir, "manifest.json")) {
      const manifest = JSON.parse(fs.readFileSync(path.join(cacheDir, "manifest.json"), "utf8"));
      if (manifest?.recipe === RECIPE && manifest.uploads && typeof manifest.uploads === "object") return manifest;
    }
  } catch {
    // rebuilt below
  }
  return { recipe: RECIPE, uploads: {} };
}

/**
 * True when the cached variant of `rel` at `width` is exactly the file the manifest entry records
 * (same size and SHA-1), reached through real folders only. A truncated or replaced variant is not.
 */
export function isRecordedVariant(cacheDir, rel, width, entry) {
  const recorded = entry?.variants?.[width];
  const variant = `files/${variantFile(rel, width)}`;
  if (!recorded || !isRealFile(cacheDir, variant)) return false;
  const file = path.join(cacheDir, ...variant.split("/"));
  return fs.statSync(file).size === recorded.size && hashFile(file) === recorded.sha1;
}

/**
 * The cached variants of one upload, when the manifest says they were made from these exact
 * bytes and they are still the files it recorded; else null.
 */
export function currentVariants(cacheDir, rel, file, manifest = readManifest(cacheDir)) {
  const entry = Object.hasOwn(manifest.uploads, rel) ? manifest.uploads[rel] : undefined;
  if (!entry || entry.sha1 !== hashFile(file)) return null;
  if (!WIDTHS.every((width) => isRecordedVariant(cacheDir, rel, width, entry))) return null;
  return WIDTHS.map((width) => cachedVariant(cacheDir, rel, width));
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** The brands of an ISO media file's leading ftyp box (AVIF), or [] when there is none. */
function ftypBrands(head) {
  if (head.length < 16 || head.toString("latin1", 4, 8) !== "ftyp") return [];
  const end = Math.min(head.readUInt32BE(0), head.length);
  const brands = [head.toString("latin1", 8, 12)];
  for (let offset = 16; offset + 4 <= end; offset += 4) brands.push(head.toString("latin1", offset, offset + 4));
  return brands;
}
const JPEG = { name: "JPEG", matches: (head) => head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff };
const SIGNATURES = {
  webp: { name: "WebP", matches: (head) => head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP" },
  png: { name: "PNG", matches: (head) => head.subarray(0, 8).equals(PNG_SIGNATURE) },
  jpg: JPEG,
  jpeg: JPEG,
  avif: { name: "AVIF", matches: (head) => ftypBrands(head).some((brand) => brand === "avif" || brand === "avis") },
  gif: { name: "GIF", matches: (head) => /^GIF8[79]a/.test(head.toString("latin1", 0, 6)) },
};

/** True when a PNG has an animation control chunk (APNG) before its image data. */
function isAnimatedPng(file) {
  const fd = fs.openSync(file, "r");
  try {
    const header = Buffer.alloc(8);
    let offset = PNG_SIGNATURE.length;
    for (let chunk = 0; chunk < 10_000; chunk++) {
      if (fs.readSync(fd, header, 0, 8, offset) < 8) return false;
      const type = header.toString("latin1", 4, 8);
      if (type === "acTL") return true;
      if (type === "IDAT" || type === "IEND") return false;
      offset += 12 + header.readUInt32BE(0);
    }
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * "PNG" or "AVIF" for an animation that sharp reads as its first frame only (an animated PNG, an
 * AVIF image sequence); otherwise null. Animated WebP and GIF are read whole.
 */
export function flattenedAnimation(file) {
  const head = readHead(file);
  if (head.subarray(0, 8).equals(PNG_SIGNATURE)) return isAnimatedPng(file) ? "PNG" : null;
  return ftypBrands(head).includes("avis") ? "AVIF" : null;
}

/**
 * What may not sit in an uploads folder: links and hard links, anything that is not a regular
 * file, files that are not images (SVG included), names the site cannot show, and files whose
 * bytes are not the image type their extension says. Sorted. In public/uploads/, dotfiles and
 * dot-folders are exempt (they never ship). With `variants: true` (a packaged dist/uploads/), nothing
 * hidden may be there at all, and generated variants are accepted when they are WebP and their
 * original is there too.
 */
export function uploadProblems(dir, { label = "public/uploads", variants = false } = {}) {
  const listing = listUploads(dir, { dotted: variants });
  if (!listing) return [];
  const at = (rel) => (rel ? `${label}/${rel}` : label);
  const names = new Set(listing.files.map(({ rel }) => rel));
  const problems = [];
  for (const { rel } of listing.links) problems.push(`${at(rel)}: ${LINK_PROBLEM}`);
  for (const { rel, nlink } of listing.hardLinks) problems.push(`${at(rel)}: ${hardLinkProblem(nlink)}`);
  for (const { rel } of listing.others) problems.push(`${at(rel)}: is not a regular file or folder: remove it`);
  for (const { file, rel } of listing.files) {
    const original = variants ? variantOriginal(rel) : null;
    const extension = path.extname(rel).slice(1).toLowerCase();
    if (rel.split("/").some((segment) => segment.startsWith("."))) problems.push(`${at(rel)}: is hidden (a dotfile or inside a dot-folder), and nothing hidden may ship: remove it`);
    else if (original) {
      if (!names.has(original)) problems.push(`${at(rel)}: is a variant of ${original}, which is not there`);
      else if (!SIGNATURES.webp.matches(readHead(file))) problems.push(`${at(rel)}: is not a real WebP image`);
    } else if (!UPLOAD_EXTENSIONS.includes(extension)) problems.push(`${at(rel)}: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it`);
    else if (!UPLOAD_PATH.test(rel)) problems.push(`${at(rel)}: ${renameAdvice(rel)}`);
    else if (!SIGNATURES[extension].matches(readHead(file))) problems.push(`${at(rel)}: is not a real ${SIGNATURES[extension].name} image: export it again, or fix its extension`);
  }
  return problems.sort();
}

const GPS_IFD_POINTER = 0x8825;
const GPS_VERSION_ID = 0x0000;

/**
 * Whether an EXIF block has location data: a GPS section with any tag but its version. The block
 * is what sharp's metadata() returns: "Exif\0\0" and a TIFF header, or (PNG) the TIFF header alone.
 * Returns true, false, or null when the block cannot be read.
 */
export function exifHasGps(exif) {
  const tiff = exif.subarray(0, 6).toString("latin1") === "Exif\0\0" ? exif.subarray(6) : exif;
  if (tiff.length < 8) return null;
  const order = tiff.toString("latin1", 0, 2);
  if (order !== "II" && order !== "MM") return null;
  const little = order === "II";
  const u16 = (at) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  if (u16(2) !== 42) return null;
  /** The tags of the IFD at `offset` (each with its 4-byte value), or null when it does not fit. */
  const entries = (offset) => {
    if (offset + 2 > tiff.length) return null;
    const count = u16(offset);
    if (offset + 2 + count * 12 > tiff.length) return null;
    return Array.from({ length: count }, (_, index) => ({ tag: u16(offset + 2 + index * 12), value: u32(offset + 10 + index * 12) }));
  };
  const ifd0 = entries(u32(4));
  if (!ifd0) return null;
  const pointer = ifd0.find(({ tag }) => tag === GPS_IFD_POINTER);
  if (!pointer) return false;
  const gps = entries(pointer.value);
  return gps === null ? null : gps.some(({ tag }) => tag !== GPS_VERSION_ID);
}

const EXIF_NAMESPACE = /xmlns:([\w.-]+)\s*=\s*["']http:\/\/ns\.adobe\.com\/exif\/1\.0\/["']/g;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** Whether XMP text has location data: an exif:GPS… property other than GPSVersionID, under any prefix bound to the EXIF namespace. */
export function xmpHasGps(xmp) {
  const prefixes = new Set(["exif", ...[...xmp.matchAll(EXIF_NAMESPACE)].map(([, prefix]) => prefix)]);
  return [...prefixes].some((prefix) => new RegExp(String.raw`(?<![\w.:-])${escapeRegExp(prefix)}:GPS(?!VersionID\b)\w+`).test(xmp));
}

/**
 * Uploads that carry location data, which would ship with them: GPS in the EXIF or XMP metadata
 * that sharp reads (WebP, PNG, JPEG, AVIF), or in the XMP packet of a GIF, which sharp does not
 * read and which sits in the file as plain text. Only files that are what their extension says
 * are read (uploadProblems lists the others); dotfiles are skipped, as they never ship. An image
 * whose metadata cannot be read is listed too, since it could hide location data. Sorted.
 */
export async function locationProblems(dir, { label = "public/uploads" } = {}) {
  const listing = listUploads(dir);
  if (!listing) return [];
  const problems = [];
  const found = (rel, where) => problems.push(`${label}/${rel}: contains location data (GPS in its ${where} metadata), which would be published with the image: re-export it without location data and upload it again`);
  for (const { file, rel } of listing.files) {
    const extension = path.extname(rel).slice(1).toLowerCase();
    if (!UPLOAD_EXTENSIONS.includes(extension) || !SIGNATURES[extension].matches(readHead(file))) continue;
    // Read into memory: sharp cannot open long paths on Windows.
    const bytes = fs.readFileSync(file);
    if (extension === "gif") {
      if (xmpHasGps(bytes.toString("latin1"))) found(rel, "XMP");
      continue;
    }
    let metadata;
    try {
      metadata = await (await loadSharp())(bytes, { limitInputPixels: false }).metadata();
    } catch {
      problems.push(`${label}/${rel}: cannot be read as an image, so it may hide location data: export it again and upload it again`);
      continue;
    }
    const exif = metadata.exif ? exifHasGps(metadata.exif) : false;
    if (exif === null) problems.push(`${label}/${rel}: has EXIF metadata that cannot be read, so it may hide location data: re-export it without metadata and upload it again`);
    else if (exif) found(rel, "EXIF");
    else if (metadata.xmp && xmpHasGps(metadata.xmp.toString("utf8"))) found(rel, "XMP");
  }
  return problems.sort();
}

/**
 * Packages the uploads: empties `to`, so a deleted upload never lingers, then copies every regular
 * file of `from` with an UPLOAD_PATH name, and next to each the cached variants that were made
 * from its current bytes. Never a dotfile, a link, a hard link, an SVG or any other file. Returns
 * the copied paths, relative to `to`.
 */
export async function shipUploads(from, to, cacheDir = CACHE_DIR) {
  await fsp.rm(to, { recursive: true, force: true });
  const listing = listUploads(from);
  if (!listing) return [];
  const manifest = readManifest(cacheDir);
  const shipped = [];
  const copy = async (source, rel) => {
    const dest = path.join(to, rel);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(source, dest);
    shipped.push(rel);
  };
  for (const { file, rel } of listing.files) {
    if (!UPLOAD_PATH.test(rel)) continue;
    await copy(file, rel);
    if (!RASTER.test(rel)) continue;
    const cached = currentVariants(cacheDir, rel, file, manifest) ?? [];
    for (const [index, source] of cached.entries()) await copy(source, variantFile(rel, WIDTHS[index]));
  }
  return shipped.sort();
}
