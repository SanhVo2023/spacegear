// Writes responsive WebP variants of every image the CMS uploads to public/uploads/, into a cache
// outside public/ (scripts/lib/uploads.mjs, CACHE_DIR):
//   public/uploads/team/photo.jpg -> .cache/upload-variants/files/team/photo.jpg.w640.webp and …w1280.webp
// package-site ships them next to the originals (/uploads/team/photo.jpg.w640.webp), and
// src/lib/content-images.ts turns an upload into a srcset of them. No upload can have such a name,
// so the uploads folder reserves nothing and the editor's files are never touched.
// - A variant is never wider than its original. EXIF orientation is applied, colours are converted
//   to sRGB, and metadata (camera, GPS, ICC profile) is dropped.
// - Idempotent by content: the cache manifest records each original's SHA-1, and a variant is
//   rebuilt when the hash (or the encoding, RECIPE) changes, whatever the modification times say.
//   Cache files that belong to no current upload are deleted (the cache is ours), and so are
//   temporary files left by an interrupted run.
// - Animated WebP variants keep every frame. GIFs get no variants and ship as they are. Animated
//   PNG and AVIF sequences are refused, because sharp would keep only their first frame.
// - An image larger than MAX_INPUT_PIXELS, counted from its header before anything is decoded
//   (a decompression bomb claims a huge size), or one that cannot be decoded, is listed as a
//   problem; the other uploads still get their variants, and the command exits 1.
// - Links and hard links are refused and never followed. Names the site cannot show (capitals,
//   spaces, other characters, Windows device names) get no variants; check-content asks for them
//   to be renamed.
//   node scripts/build-upload-variants.mjs
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pathsFromRoot } from "./lib/project-path.mjs";
import { CACHE_DIR, LINK_PROBLEM, RASTER, RECIPE, UPLOADS_DIR, UPLOAD_PATH, WIDTHS, cachedVariant, flattenedAnimation, hardLinkProblem, hashFile, isRegularFile, listUploads, readManifest, variantFile } from "./lib/uploads.mjs";

export { CACHE_DIR, RASTER, UPLOADS_DIR, VARIANT, WIDTHS, cachedVariant, variantFile, variantFiles } from "./lib/uploads.mjs";
/** The project folder (the parent of scripts/), wherever the command runs from. */
export const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** sharp's own default (16383 x 16383 px, also WebP's largest size), set explicitly. An animation counts every frame. */
export const MAX_INPUT_PIXELS = 268_402_689;
const TIMEOUT_SECONDS = 120;

const megapixels = (pixels) => `${(pixels / 1e6).toFixed(1)} MP`;
const TEMPORARY = /^\..+\.\d+\.tmp$/;
/** A problem with one upload, reported with its file name. */
class UploadError extends Error {}

let sharpModule;
async function loadSharp() {
  if (!sharpModule) {
    sharpModule = (await import("sharp")).default;
    sharpModule.cache(false); // do not keep uploads open (Windows locks open files)
  }
  return sharpModule;
}

/**
 * Writes one variant through a temporary dotfile next to it, renamed into place once complete, so
 * a failed run never leaves a partial variant. Whatever else sits at `out` (a folder, a link) is
 * removed first: the cache is ours. sharp refuses to decode more than `maxPixels`.
 */
export async function writeVariant(original, out, width, { animated = false, maxPixels = MAX_INPUT_PIXELS } = {}) {
  const sharp = await loadSharp();
  await fsp.mkdir(path.dirname(out), { recursive: true });
  const temp = path.join(path.dirname(out), `.${path.basename(out)}.${process.pid}.tmp`);
  try {
    await sharp(original, { animated, autoOrient: true, limitInputPixels: maxPixels })
      .resize({ width, withoutEnlargement: true })
      .toColourspace("srgb")
      .webp({ quality: 80 })
      .timeout({ seconds: TIMEOUT_SECONDS })
      .toFile(temp);
    if (!isRegularFile(out)) await fsp.rm(out, { recursive: true, force: true });
    await fsp.rename(temp, out);
  } catch (error) {
    await fsp.rm(temp, { force: true });
    throw error;
  }
}

/**
 * Reads the header only: the size, and whether the image is an animated WebP (the one animation
 * that gets variants; several pages in an AVIF are a collection of images, of which the first is used).
 */
async function inspect(original, maxPixels) {
  const animation = flattenedAnimation(original);
  if (animation) throw new UploadError(`is an animated ${animation}; its variants would be still images: upload an animated WebP or a GIF instead`);
  const sharp = await loadSharp();
  const { format, width, height, pages = 1 } = await sharp(original, { limitInputPixels: false }).metadata();
  if (!width || !height) throw new Error("no image size in its header");
  const frames = format === "webp" ? pages : 1;
  const pixels = width * height * frames;
  if (pixels > maxPixels) throw new UploadError(`${megapixels(pixels)} (${width} x ${height} px${frames > 1 ? `, ${frames} frames` : ""}) is over the ${megapixels(maxPixels)} limit for uploads; resize it before uploading`);
  return { animated: frames > 1 };
}

/** Deletes every entry below `dir` that `keep(rel)` refuses, without following links; then empty folders. */
function prune(dir, keep, prefix = "") {
  const removed = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      removed.push(...prune(full, keep, `${rel}/`));
      if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    } else if (!(entry.isFile() && keep(rel))) {
      fs.rmSync(full, { force: true });
      removed.push(rel);
    }
  }
  return removed;
}

function writeManifest(cacheDir, manifest) {
  const file = path.join(cacheDir, "manifest.json");
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.renameSync(temp, file);
}

/**
 * Brings the variant cache up to date with an uploads folder. `cacheDir` is required for any
 * folder other than public/uploads/, so a test can never prune the project's own cache.
 * Returns `{ originals, written, upToDate, removed, errors }`; written and upToDate list cache
 * paths, removed lists paths below the cache's files/ folder.
 */
export async function buildUploadVariants(dir = UPLOADS_DIR, options = {}) {
  if (!options.cacheDir && path.resolve(dir) !== UPLOADS_DIR) throw new Error("buildUploadVariants: pass a cacheDir for an uploads folder other than public/uploads/");
  const { cacheDir = CACHE_DIR, maxPixels = MAX_INPUT_PIXELS } = options;
  const result = { originals: 0, written: [], upToDate: [], removed: [], errors: [] };
  const cache = fs.lstatSync(cacheDir, { throwIfNoEntry: false });
  if (cache && (cache.isSymbolicLink() || !cache.isDirectory())) {
    result.errors.push(`${cacheDir}: the variant cache must be a folder, not a link or a file: remove it (it is rebuilt)`);
    return result;
  }
  const files = path.join(cacheDir, "files");
  // Temporary files of an interrupted run are deleted first.
  if (cache) for (const name of fs.readdirSync(cacheDir)) if (/^manifest\.json\.\d+\.tmp$/.test(name)) fs.rmSync(path.join(cacheDir, name), { force: true });
  if (fs.existsSync(files)) result.removed.push(...prune(files, (rel) => !TEMPORARY.test(path.posix.basename(rel))));
  const listing = listUploads(dir) ?? { files: [], links: [], hardLinks: [], others: [] };
  for (const { file } of listing.links) result.errors.push(`${file}: ${LINK_PROBLEM}`);
  for (const { file, nlink } of listing.hardLinks) result.errors.push(`${file}: ${hardLinkProblem(nlink)}`);
  for (const { file } of listing.others) result.errors.push(`${file}: is not a regular file or folder: remove it`);
  const originals = listing.files.filter(({ rel }) => UPLOAD_PATH.test(rel) && RASTER.test(rel));
  result.originals = originals.length;
  if (result.errors.length || (!originals.length && !cache)) return result;
  const manifest = readManifest(cacheDir);
  const next = { recipe: RECIPE, uploads: {} };
  const current = new Set();
  for (const { file: original, rel } of originals) {
    const sha1 = hashFile(original);
    const known = Object.hasOwn(manifest.uploads, rel) && manifest.uploads[rel].sha1 === sha1;
    const pending = [];
    for (const width of WIDTHS) {
      const out = cachedVariant(cacheDir, rel, width);
      if (known && isRegularFile(out)) result.upToDate.push(out);
      else pending.push([width, out]);
    }
    try {
      if (pending.length) {
        const decode = { ...(await inspect(original, maxPixels)), maxPixels };
        for (const [width, out] of pending) {
          await writeVariant(original, out, width, decode);
          result.written.push(out);
        }
      }
    } catch (error) {
      if (error instanceof UploadError) result.errors.push(`${original}: ${error.message}`);
      else if (typeof error?.code === "string") result.errors.push(`${original}: could not write its variants (${error.message})`);
      else result.errors.push(`${original}: cannot be read as an image (${error?.message ?? error}); export it again as WebP, PNG, JPEG or AVIF`);
      continue; // its old variants, if any, are pruned below
    }
    next.uploads[rel] = { sha1, size: fs.statSync(original).size };
    for (const width of WIDTHS) current.add(variantFile(rel, width));
  }
  fs.mkdirSync(files, { recursive: true });
  result.removed.push(...prune(files, (rel) => current.has(rel)));
  writeManifest(cacheDir, next);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const show = pathsFromRoot(ROOT);
  const result = await buildUploadVariants();
  if (result.errors.length) {
    console.error(`Upload variants failed. Fix these problems:\n${result.errors.map((error) => `  - ${show(error)}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`Upload variants: ${result.originals} originals, ${result.written.length} written, ${result.upToDate.length} up to date, ${result.removed.length} removed.`);
  }
}
