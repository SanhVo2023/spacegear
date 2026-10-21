// Proves that a change did not alter what the exported pages render. `save` writes a normalized
// copy of every dist/**/*.html; `compare` normalizes the current dist/ the same way and reports
// any page that differs. Normalizing removes what changes between builds of the same source:
// the build ID, hashed chunk and media names, module ids, the number of chunks a page loads and
// where the inline RSC payload is split into script tags.
//   node scripts/html-snapshot.mjs save artifacts/html-baseline
//   node scripts/html-snapshot.mjs compare artifacts/html-baseline
import fs from "node:fs";
import path from "node:path";

const [mode, dir] = process.argv.slice(2);
if (!["save", "compare"].includes(mode) || !dir) {
  console.error("Usage: node scripts/html-snapshot.mjs save|compare <snapshot-dir>");
  process.exit(2);
}
const root = "dist";
const buildId = fs.existsSync(".next/BUILD_ID") ? fs.readFileSync(".next/BUILD_ID", "utf8").trim() : "";

function normalize(html) {
  let out = buildId ? html.replaceAll(buildId, "BUILD_ID") : html;
  out = out
    .replace(/"\]\)<\/script><script>self\.__next_f\.push\(\[1,"/g, "")
    .replace(/\/_next\/static\/(chunks|media)\/[\w.~-]+?(\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico))(?=[\\"'\s)?#,])/g, "/_next/static/$1/HASH$2")
    .replace(/\bI\[\d+,/g, "I[ID,")
    .replace(/(?:\\"\/_next\/static\/chunks\/HASH\.js\\",?)+/g, '\\"CHUNKS\\",')
    .replace(/(?:<script src="\/_next\/static\/chunks\/HASH\.js" async=""><\/script>)+/g, "<script CHUNKS></script>")
    .replace(/(?:<link rel="preload" as="script" fetchPriority="low" href="\/_next\/static\/chunks\/HASH\.js"\/>)+/g, "<link CHUNKS/>");
  return out;
}

function htmlFiles(base) {
  const walk = (current) => fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".html") ? [path.relative(base, full).replaceAll("\\", "/")] : [];
  });
  return fs.existsSync(base) ? walk(base).sort() : [];
}

const current = htmlFiles(root);
if (!current.length) {
  console.error("dist/ has no HTML files; build first.");
  process.exit(1);
}
if (mode === "save") {
  fs.rmSync(dir, { recursive: true, force: true });
  for (const file of current) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, normalize(fs.readFileSync(path.join(root, file), "utf8")));
  }
  console.log(`Saved ${current.length} normalized pages to ${dir}.`);
} else {
  const saved = htmlFiles(dir);
  const problems = [];
  for (const file of saved) {
    if (!current.includes(file)) {
      problems.push(`missing page: ${file}`);
      continue;
    }
    const before = fs.readFileSync(path.join(dir, file), "utf8");
    const after = normalize(fs.readFileSync(path.join(root, file), "utf8"));
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
