// Writes responsive WebP variants next to every image the CMS uploads to public/uploads/:
//   public/uploads/team-photo.webp -> team-photo-640.webp and team-photo-1280.webp
// A variant is never wider than its original. The step is idempotent by modification time: each
// variant is stamped with its original's time and is rebuilt when the two differ, so an original
// that is edited, or replaced by an older file, gets new variants. Variants are build output
// (.gitignore), so names ending in -640.webp or -1280.webp are reserved for them: such a file is
// never an original, and one with no original is reported, never deleted (it could be an upload).
// src/lib/content-images.ts turns an upload into a srcset of these files; scripts/package-site.mjs
// ships them with the uploads. The rules for the folder are in scripts/lib/uploads.mjs.
// - EXIF orientation is applied, colours are converted to sRGB, and metadata (camera, GPS, ICC
//   profile) is dropped.
// - Animated WebP variants keep every frame. GIFs get no variants and ship as they are. Animated
//   PNG and AVIF sequences are refused, because sharp would keep only their first frame.
// - An image larger than MAX_INPUT_PIXELS, counted from its header before anything is decoded
//   (a decompression bomb claims a huge size), or one that cannot be decoded, is listed as a
//   problem; the other uploads still get their variants, and the command exits 1.
// - Links are refused and never followed. Names the site cannot show (capitals, spaces, other
//   characters) get no variants; check-content asks for them to be renamed.
//   node scripts/build-upload-variants.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pathsFromRoot } from "./lib/project-path.mjs";
import { LINK_PROBLEM, RASTER, UPLOAD_PATH, VARIANT, WIDTHS, flattenedAnimation, listUploads, variantFile, variantFiles } from "./lib/uploads.mjs";

export { RASTER, VARIANT, WIDTHS, variantFile, variantFiles } from "./lib/uploads.mjs";
/** The project folder (the parent of scripts/), wherever the command runs from. */
export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const UPLOADS_DIR = path.join(ROOT, "public", "uploads");
/** sharp's own default (16383 x 16383 px, also WebP's largest size), set explicitly. An animation counts every frame. */
export const MAX_INPUT_PIXELS = 268_402_689;
const TIMEOUT_SECONDS = 120;
export const STALE_NOTE = "no upload has this variant name, so it is neither rebuilt nor deleted. Names ending in -640.webp or -1280.webp are reserved for generated variants: delete it if its original was removed, or rename it if it is an upload";

const megapixels = (pixels) => `${(pixels / 1e6).toFixed(1)} MP`;
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

/** A variant is current when it is a regular file stamped with its original's modification time. */
async function isCurrent(out, source) {
  const existing = await fs.lstat(out).catch(() => null);
  return Boolean(existing?.isFile() && Math.abs(existing.mtimeMs - source.mtimeMs) < 1);
}

/**
 * Writes one variant through a temporary dotfile next to it, renamed into place once complete, so
 * a failed run never leaves a partial variant that would count as current.
 */
async function writeVariant(sharp, original, source, out, width, options) {
  const temp = path.join(path.dirname(out), `.${path.basename(out)}.${process.pid}.tmp`);
  try {
    await sharp(original, { animated: options.animated, autoOrient: true, limitInputPixels: options.maxPixels })
      .resize({ width, withoutEnlargement: true })
      .toColourspace("srgb")
      .webp({ quality: 80 })
      .timeout({ seconds: TIMEOUT_SECONDS })
      .toFile(temp);
    await fs.utimes(temp, source.atime, source.mtime);
    await fs.rename(temp, out);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}

/**
 * Reads the header only: the size, and whether the image is an animated WebP (the one animation
 * that gets variants; several pages in an AVIF are a collection of images, of which the first is used).
 */
async function inspect(sharp, original, maxPixels) {
  const animation = flattenedAnimation(original);
  if (animation) throw new UploadError(`is an animated ${animation}; its variants would be still images: upload an animated WebP or a GIF instead`);
  const { format, width, height, pages = 1 } = await sharp(original, { limitInputPixels: false }).metadata();
  if (!width || !height) throw new Error("no image size in its header");
  const frames = format === "webp" ? pages : 1;
  const pixels = width * height * frames;
  if (pixels > maxPixels) throw new UploadError(`${megapixels(pixels)} (${width} x ${height} px${frames > 1 ? `, ${frames} frames` : ""}) is over the ${megapixels(maxPixels)} limit for uploads; resize it before uploading`);
  return { animated: frames > 1 };
}

export async function buildUploadVariants(dir = UPLOADS_DIR, { maxPixels = MAX_INPUT_PIXELS } = {}) {
  const result = { originals: 0, written: [], upToDate: [], stale: [], errors: [] };
  const listing = listUploads(dir);
  if (!listing) return result;
  for (const { file } of listing.links) result.errors.push(`${file}: ${LINK_PROBLEM}`);
  for (const { file } of listing.others) result.errors.push(`${file}: is not a regular file or folder: remove it`);
  const originals = listing.files.filter(({ rel }) => UPLOAD_PATH.test(rel) && RASTER.test(rel) && !VARIANT.test(rel)).map(({ file }) => file);
  result.originals = originals.length;
  const stems = new Map();
  for (const original of originals) {
    const key = original.replace(/\.[^./\\]+$/, "").toLowerCase();
    if (stems.has(key)) result.errors.push(`${original} and ${stems.get(key)} share a name, so their variants would collide; rename one of them`);
    else stems.set(key, original);
  }
  const expected = new Set(originals.flatMap(variantFiles).map((file) => file.toLowerCase()));
  for (const { file } of listing.files) if (VARIANT.test(file) && !expected.has(file.toLowerCase())) result.stale.push(file);
  if (result.errors.length) return result;
  for (const original of originals) {
    const source = await fs.stat(original);
    const pending = [];
    for (const width of WIDTHS) {
      const out = variantFile(original, width);
      if (await isCurrent(out, source)) result.upToDate.push(out);
      else pending.push([width, out]);
    }
    if (!pending.length) continue;
    try {
      const sharp = await loadSharp();
      const options = { ...(await inspect(sharp, original, maxPixels)), maxPixels };
      for (const [width, out] of pending) {
        await writeVariant(sharp, original, source, out, width, options);
        result.written.push(out);
      }
    } catch (error) {
      if (error instanceof UploadError) result.errors.push(`${original}: ${error.message}`);
      else if (typeof error?.code === "string") result.errors.push(`${original}: could not write its variants (${error.message})`);
      else result.errors.push(`${original}: cannot be read as an image (${error?.message ?? error}); export it again as WebP, PNG, JPEG or AVIF`);
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const show = pathsFromRoot(ROOT);
  const result = await buildUploadVariants();
  for (const file of result.stale) console.warn(show(`Upload variants: ${file}: ${STALE_NOTE}.`));
  if (result.errors.length) {
    console.error(`Upload variants failed. Fix these problems:\n${result.errors.map((error) => `  - ${show(error)}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`Upload variants: ${result.originals} originals, ${result.written.length} written, ${result.upToDate.length} up to date.`);
  }
}
