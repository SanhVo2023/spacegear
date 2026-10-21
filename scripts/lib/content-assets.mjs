// Every local image the loaded content references, the references to refuse, and the files
// missing from public/ (for a CMS upload, its generated -640/-1280 WebP variants count too). Any
// string that starts with /images/ or /uploads/ counts, in any field, links included. Used by
// scripts/check-content.mjs.
import fs from "node:fs";
import path from "node:path";
import { RASTER, VARIANT, variantFiles } from "./uploads.mjs";

const LOCAL_IMAGE = /^\/(?:images|uploads)\//;

export function referencedImages(values) {
  const found = new Set();
  const walk = (value) => {
    if (typeof value === "string") {
      if (LOCAL_IMAGE.test(value)) found.add(value);
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(values);
  return [...found].sort();
}

// \w is ASCII here (no u flag): letters, digits and _.
const PLAIN_SEGMENT = /^[\w-][\w.-]*$/;
/** Plain names only: no "..", no dotfile, no empty segment, backslash, %, ? or other character. */
const isPlainPath = (src) => src.split("/").slice(1).every((segment) => PLAIN_SEGMENT.test(segment));
const isVariant = (src) => src.startsWith("/uploads/") && VARIANT.test(src);

function problemWith(src) {
  if (!isPlainPath(src)) return `${JSON.stringify(src)} is not a plain image path under /images/ or /uploads/ (letters, digits, -, _ and dots; no "..", dotfiles or other characters)`;
  if (isVariant(src)) return `${src} is a generated variant (names ending in -640.webp or -1280.webp are reserved): point at the original upload`;
  return "";
}

/**
 * Local image references to refuse, each with where it is (`FAQ_CARD.img: …`): a path that is not
 * a plain file path, so it could leave /images/ or /uploads/, or a generated variant. The content
 * schema refuses both in image fields; this also covers links and every other field.
 */
export function imageReferenceProblems(values) {
  const problems = [];
  const walk = (value, at) => {
    if (typeof value === "string") {
      const problem = LOCAL_IMAGE.test(value) ? problemWith(value) : "";
      if (problem) problems.push(`${at}: ${problem}`);
    } else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${at}[${index}]`));
    else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) walk(item, at ? `${at}.${key}` : key);
  };
  walk(values, "");
  return problems;
}

export function missingImageFiles(values, publicDir = "public") {
  const missing = [];
  for (const src of referencedImages(values)) {
    if (problemWith(src)) continue; // imageReferenceProblems names it; it is not looked up on disk
    const file = path.join(publicDir, src);
    if (!fs.existsSync(file)) {
      missing.push(src);
      continue;
    }
    if (src.startsWith("/uploads/") && RASTER.test(src)) {
      for (const variant of variantFiles(file)) {
        if (!fs.existsSync(variant)) missing.push(`/${path.relative(publicDir, variant).replaceAll("\\", "/")} (run npm run uploads:variants)`);
      }
    }
  }
  return missing;
}
