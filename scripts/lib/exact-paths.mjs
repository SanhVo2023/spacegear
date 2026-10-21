// Exact-case file lookups. Windows finds `Photo.webp` when asked for `photo.webp`; Cloudflare (and
// Linux) do not, so a path that only exists in another letter case works locally and 404s once
// deployed. These helpers compare names against the real directory listing instead.
import fs from "node:fs";
import path from "node:path";

const segments = (rel) => rel.replaceAll("\\", "/").split("/").filter(Boolean);

/** True when `rel` (forward slashes) names a file or folder below `root` with exactly this letter case. */
export function existsExact(root, rel) {
  let dir = root;
  for (const segment of segments(rel)) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      return false;
    }
    if (!names.includes(segment)) return false;
    dir = path.join(dir, segment);
  }
  return true;
}

/** Every file below `root`, by its exact relative path (forward slashes), plus a lowercase lookup. */
export function exactIndex(root) {
  const files = new Set();
  const lower = new Map();
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${rel}/`);
      else {
        files.add(rel);
        lower.set(rel.toLowerCase(), rel);
      }
    }
  };
  if (fs.existsSync(root)) walk(root, "");
  return { has: (rel) => files.has(rel), inOtherCase: (rel) => (files.has(rel) ? undefined : lower.get(rel.toLowerCase())) };
}

/** A local asset path in a page, payload or chunk: not part of a longer URL or name. */
export const LOCAL_REF = /(?<![\w.:/%-])\/(?:[\w-][\w.-]*\/)*[\w-][\w.-]*\.(?:webp|png|jpe?g|avif|gif|svg|ico|glb|wasm|woff2?)(?![\w.-])/gi;

/**
 * Paths that pages, RSC payloads and chunks below `root` name in another letter case than the
 * file that ships (`/images/Faq.webp` for images/faq.webp). Top-level folders in `skip` are not
 * read (the vendored CMS).
 */
export function wrongCaseReferences(root, { skip = [] } = {}) {
  const index = exactIndex(root);
  const problems = new Set();
  const scan = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!(prefix === "" && skip.includes(entry.name))) scan(file, `${rel}/`);
      } else if (/\.(?:html|txt|js)$/.test(entry.name)) {
        for (const [ref] of fs.readFileSync(file, "utf8").matchAll(LOCAL_REF)) {
          const shipped = index.inOtherCase(ref.slice(1));
          if (shipped) problems.add(`${ref} in ${rel}: the file that ships is /${shipped}; the letter case must match (Cloudflare is case-sensitive)`);
        }
      }
    }
  };
  if (fs.existsSync(root)) scan(root, "");
  return [...problems].sort();
}
