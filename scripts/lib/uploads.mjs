// The rules for CMS uploads (public/uploads/). The variant step (scripts/build-upload-variants.mjs),
// check-content, package-site and check-export all use them:
// - Only images can be uploaded: .webp, .png, .jpg, .jpeg, .avif and .gif. An SVG served from the
//   site's origin is an active document, so it is refused like any other file.
// - Names use lowercase letters, digits, - and _ (folders too), with a lowercase extension. The
//   content schema's image rule (IMAGE in src/lib/content-schema.ts) accepts nothing else, so a
//   file with any other name could never be shown. tests/uploads.test.mjs checks that they agree.
// - Dotfiles and dot-folders (.gitkeep, the CMS's .sveltia-tmp-* files) are ignored: never
//   processed, checked or shipped.
// - Links (symbolic links, junctions) are refused anywhere in the folder and never followed:
//   `next build` follows them when it copies public/ to out/.
// - WebP, PNG, JPEG and AVIF uploads get -640 and -1280 WebP variants, so those names are
//   reserved. GIFs ship as they are, so an animation keeps playing.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export const WIDTHS = [640, 1280];
/** The only file types that may be uploaded, and the only ones that ship. */
export const UPLOAD_EXTENSIONS = ["webp", "png", "jpg", "jpeg", "avif", "gif"];
/** Uploads that get variants. */
export const RASTER = /\.(?:jpe?g|png|webp|avif)$/i;
/** Generated variant names, reserved: content may not point at one. */
export const VARIANT = /-(?:640|1280)\.webp$/i;
/** A path below uploads/ that the site can show, and so may ship. */
export const UPLOAD_PATH = /^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif)$/;
export const LINK_PROBLEM = "is a link (symbolic link or junction); uploads must be regular files: remove it and upload the file itself";

const stem = (file) => file.replace(/\.[^./\\]+$/, "");
export const variantFile = (original, width) => `${stem(original)}-${width}.webp`;
export const variantFiles = (original) => WIDTHS.map((width) => variantFile(original, width));

const byRel = (a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);

/**
 * Everything in an uploads folder, without following links: `files` (regular files), `links` and
 * `others` (pipes, devices), each as `{ file, rel }`, with `rel` relative to the folder and using
 * forward slashes. Dot entries are skipped, except links. Returns null when the folder does not
 * exist. When the folder itself is a link (or not a folder), it is the only entry, with rel "".
 */
export function listUploads(dir) {
  let stat;
  try {
    stat = fs.lstatSync(dir);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  const listing = { files: [], links: [], others: [] };
  if (stat.isSymbolicLink()) listing.links.push({ file: dir, rel: "" });
  else if (!stat.isDirectory()) listing.others.push({ file: dir, rel: "" });
  else {
    const walk = (folder, prefix) => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        const rel = prefix + entry.name;
        if (entry.isSymbolicLink()) listing.links.push({ file, rel });
        else if (entry.name.startsWith(".")) continue;
        else if (entry.isDirectory()) walk(file, `${rel}/`);
        else if (entry.isFile()) listing.files.push({ file, rel });
        else listing.others.push({ file, rel });
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
 * What check-content reports in an uploads folder: links, anything that is not a regular file,
 * files that are not images (SVG included), names the site cannot show, and files whose bytes
 * are not the image type their extension says. Sorted; dotfiles are exempt.
 */
export function uploadProblems(dir, label = "public/uploads") {
  const listing = listUploads(dir);
  if (!listing) return [];
  const at = (rel) => (rel ? `${label}/${rel}` : label);
  const problems = [];
  for (const { rel } of listing.links) problems.push(`${at(rel)}: ${LINK_PROBLEM}`);
  for (const { rel } of listing.others) problems.push(`${at(rel)}: is not a regular file or folder: remove it`);
  for (const { file, rel } of listing.files) {
    const extension = path.extname(rel).slice(1).toLowerCase();
    if (!UPLOAD_EXTENSIONS.includes(extension)) problems.push(`${at(rel)}: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it`);
    else if (!UPLOAD_PATH.test(rel)) problems.push(`${at(rel)}: rename it: upload names use lowercase letters, digits, - and _ only, in folders too, with a lowercase extension`);
    else if (!SIGNATURES[extension].matches(readHead(file))) problems.push(`${at(rel)}: is not a real ${SIGNATURES[extension].name} image: export it again, or fix its extension`);
  }
  return problems.sort();
}

/**
 * Copies the uploads that may ship (regular files with an UPLOAD_PATH name, generated variants
 * included) from `from` to `to`, which is emptied first so a deleted upload never lingers. Never a
 * dotfile, a link, an SVG or any other file. Returns the copied paths, relative to `to`.
 */
export async function shipUploads(from, to) {
  await fsp.rm(to, { recursive: true, force: true });
  const listing = listUploads(from);
  if (!listing) return [];
  const shipped = listing.files.map(({ rel }) => rel).filter((rel) => UPLOAD_PATH.test(rel));
  for (const rel of shipped) {
    const dest = path.join(to, rel);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(path.join(from, rel), dest);
  }
  return shipped;
}
