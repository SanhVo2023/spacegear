// Removes single-line rules from src/app/legacy.css as Codex markup is replaced.
// Arguments starting with "." match any rule whose selector contains that text
// (".hero-" removes .hero-copy, .orbital-hero .hero-stage, …). Arguments
// starting with "=" match a whole selector exactly ("=body", "=h1,h2,h3").
// Usage: node scripts/prune-legacy-css.mjs .site-header .nav-shell "=h2"
import fs from "node:fs/promises";

const file = "src/app/legacy.css";
const targets = process.argv.slice(2);
if (!targets.length) throw new Error("Pass at least one selector target.");
const squash = (text) => text.replace(/\s+/g, "");
const matches = (selector) => targets.some((target) =>
  target.startsWith("=") ? squash(selector) === squash(target.slice(1)) : selector.includes(target));

const kept = [];
const removed = [];
for (const line of (await fs.readFile(file, "utf8")).split("\n")) {
  const rule = line.match(/^\s*([^{}@]+?)\s*\{[^{}]*\}\s*$/);
  if (rule && matches(rule[1])) removed.push(line.trim());
  else kept.push(line);
}
await fs.writeFile(file, kept.join("\n"));
console.log(`Removed ${removed.length} rule(s) from ${file}:\n${removed.join("\n")}`);
