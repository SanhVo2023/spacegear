// Reads content/ from disk into the shape buildContent() takes, so tests can validate a
// modified copy of the content without touching the real tree.
import fs from "node:fs";
import path from "node:path";
import { COLLECTIONS, listEntries } from "../../scripts/build-content-index.mjs";

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

export function readContentInput(root = ".") {
  const input = Object.fromEntries(Object.entries(SINGLETON_FILES).map(([name, file]) => [name, readJson(path.join(root, file))]));
  input.collections = Object.fromEntries(COLLECTIONS.map((collection) => [
    collection,
    listEntries(root, collection).map((file) => ({ file, data: readJson(path.join(root, "content", collection, file)) })),
  ]));
  return input;
}
