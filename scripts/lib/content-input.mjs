// Reads one language's content files into the shape buildContent() takes, plus <dir>/site.json, for
// scripts/check-content.mjs and the tests. `dir` is "content" (English) or "content/vi" (Vietnamese).
// Loaded under --experimental-strip-types or tsx (it imports the TypeScript content model).
import fs from "node:fs";
import path from "node:path";
import { COLLECTIONS, listEntries } from "../build-content-index.mjs";

const { SINGLETON_FILES } = await import("../../src/lib/content-model.ts");

/** Reads one JSON file. A syntax error names the file, so a broken save is easy to find. */
export function readJson(file) {
  const source = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new SyntaxError(`${file}: ${error.message}`, { cause: error });
  }
}

export function readContentInput(root = ".", dir = "content") {
  const input = Object.fromEntries(Object.entries(SINGLETON_FILES).map(([name, file]) => [name, readJson(path.join(root, file.replace(/^content\//, `${dir}/`)))]));
  input.collections = Object.fromEntries(COLLECTIONS.map((collection) => [
    collection,
    listEntries(root, collection, dir).map((file) => ({ file, data: readJson(path.join(root, dir, collection, file)) })),
  ]));
  return input;
}

/** readContentInput plus the language's Site identity file. */
export function readLocaleFiles(root = ".", dir = "content") {
  return { ...readContentInput(root, dir), site: readJson(path.join(root, dir, "site.json")) };
}
