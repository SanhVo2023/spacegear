// Reads content/ from disk into the shape buildContent() takes, so tests can validate a
// modified copy of the content without touching the real tree.
//
// Tests that change entries by name or position use the frozen sample project
// (tests/fixtures/sample-project/content/, a copy of content/ as it was when the CMS landed), not
// the live content/: editors add, delete, rename and reorder live entries, and that must never
// break npm test. The sample is never refreshed; change it only together with the tests that use it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COLLECTIONS, INDEX_FILE, listEntries, renderIndex } from "../../scripts/build-content-index.mjs";

const { SINGLETON_FILES } = await import("../../src/lib/content-model.ts");

/** The frozen sample project: its content/ folder is laid out like the real one. */
export const SAMPLE_ROOT = fileURLToPath(new URL("../fixtures/sample-project/", import.meta.url));

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

/** The sample content, ready for buildContent(). */
export const sampleInput = () => readContentInput(SAMPLE_ROOT);

/**
 * Copies the sample content into <root>/content and writes the entry index that matches it into
 * <root>/src/lib, for a temporary project. Call it after copying src/lib, which holds the live index.
 */
export function copySampleContent(root) {
  fs.cpSync(path.join(SAMPLE_ROOT, "content"), path.join(root, "content"), { recursive: true });
  fs.mkdirSync(path.join(root, path.dirname(INDEX_FILE)), { recursive: true });
  fs.writeFileSync(path.join(root, INDEX_FILE), renderIndex(root));
}
