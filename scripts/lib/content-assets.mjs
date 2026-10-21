// Every local image the loaded content references, the references to refuse, and the files
// missing from public/ (for a CMS upload, its generated variants in the variant cache count too).
// Any string that starts with /images/ or /uploads/ counts, in any field, links included. Files
// are looked up with their exact letter case, as Cloudflare serves them. Used by
// scripts/check-content.mjs.
import path from "node:path";
import { existsExact } from "./exact-paths.mjs";
import { CACHE_DIR, RASTER, SITE_IMAGE_PATH, UPLOAD_PATH, VARIANT, variantFiles } from "./uploads.mjs";

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

const NAME_RULE = "lowercase letters, digits, - and _ only, in folders too, and not a Windows device name such as con or nul";

function problemWith(src) {
  if (src.startsWith("/uploads/")) {
    const rel = src.slice("/uploads/".length);
    if (VARIANT.test(rel)) return `${src} is a generated variant: point at the original upload`;
    if (!UPLOAD_PATH.test(rel)) return `${JSON.stringify(src)} is not an upload the site can serve: use ${NAME_RULE}, ending in .webp, .png, .jpg, .jpeg, .avif or .gif`;
  } else if (!SITE_IMAGE_PATH.test(src.slice("/images/".length))) {
    return `${JSON.stringify(src)} is not a site image the site can serve: use ${NAME_RULE}, ending in .webp, .png, .jpg, .jpeg, .avif, .gif or .svg`;
  }
  return "";
}

/**
 * Local image references to refuse, each with where it is (`FAQ_CARD.img: …`): a path the upload
 * or site-image name rules refuse (so also "..", %, capitals, device names), or a generated
 * variant. The content schema refuses them in image fields; this also covers links and every
 * other field.
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

/**
 * Referenced images that are not in `publicDir` with exactly that name (`/images/x.webp`), and
 * the generated variants of referenced uploads that are not in the cache
 * (`/uploads/a.webp.w1280.webp (run npm run uploads:variants)`).
 */
export function missingImageFiles(values, publicDir = "public", cacheDir = CACHE_DIR) {
  const missing = [];
  for (const src of referencedImages(values)) {
    if (problemWith(src)) continue; // imageReferenceProblems names it; it is not looked up on disk
    if (!existsExact(publicDir, src)) {
      missing.push(src);
      continue;
    }
    if (src.startsWith("/uploads/") && RASTER.test(src)) {
      for (const variant of variantFiles(src.slice("/uploads/".length))) {
        if (!existsExact(path.join(cacheDir, "files"), variant)) missing.push(`/uploads/${variant} (run npm run uploads:variants)`);
      }
    }
  }
  return missing;
}
