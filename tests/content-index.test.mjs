import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { COLLECTIONS, INDEX_FILE, readIndex, renderIndex } from "../scripts/build-content-index.mjs";

const { COLLECTION_NAMES } = await import("../src/lib/content-model.ts");

test("the committed content index lists every entry file (run npm run content:index if not)", () => {
  assert.equal(readIndex("."), renderIndex("."), `${INDEX_FILE} is stale`);
});

test("the index covers exactly the model's folder collections", () => {
  assert.deepEqual(COLLECTIONS, [...COLLECTION_NAMES]);
});

test("the index skips dotfiles and non-JSON files, sorts by name and refuses unsafe names", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-index-"));
  try {
    const faqs = path.join(root, "content", "faqs");
    fs.mkdirSync(faqs, { recursive: true });
    for (const name of ["b.json", "a.json", ".gitkeep", "notes.txt"]) fs.writeFileSync(path.join(faqs, name), "{}");
    const index = renderIndex(root);
    assert.match(index, /import faqs_0 from "\.\.\/\.\.\/content\/faqs\/a\.json" with \{ type: "json" \};\nimport faqs_1 from "\.\.\/\.\.\/content\/faqs\/b\.json"/);
    assert.doesNotMatch(index, /gitkeep|notes/);
    assert.match(index, /"services": \[\],/, "a missing collection folder is an empty list");
    fs.writeFileSync(path.join(faqs, "Bad Name.json"), "{}");
    assert.throws(() => renderIndex(root), /Rename content\/faqs\/Bad Name\.json/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
