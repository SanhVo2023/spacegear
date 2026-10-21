// Reads content/ from disk into the shape buildContent() takes, so tests can validate a
// modified copy of the content without touching the real tree.
import fs from "node:fs";
import path from "node:path";
import { COLLECTIONS, listEntries } from "../../scripts/build-content-index.mjs";

const { SINGLETON_FILES } = await import("../../src/lib/content-model.ts");

export const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

export function readContentInput(root = ".") {
  const input = Object.fromEntries(Object.entries(SINGLETON_FILES).map(([name, file]) => [name, readJson(path.join(root, file))]));
  input.collections = Object.fromEntries(COLLECTIONS.map((collection) => [
    collection,
    listEntries(root, collection).map((file) => ({ file, data: readJson(path.join(root, "content", collection, file)) })),
  ]));
  return input;
}

/** The exported values (not functions) of a content module or a buildContent() result, as one string. */
export const publicText = (content) => JSON.stringify(Object.entries(content).filter(([, value]) => typeof value !== "function").map(([, value]) => value));
