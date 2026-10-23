// Reads content/ from disk into the shape buildContent() takes, so tests can validate a
// modified copy of the content without touching the real tree.
//
// Tests that change entries by name or position use the frozen sample project
// (tests/fixtures/sample-project/content/, a copy of content/ as it was when the CMS landed, and its
// content/vi/ mirror as it was when the Vietnamese copy landed, so a temporary project builds both
// languages; both site.json files gained the owner's address and telephone when Site identity
// required them), not the live content/: editors add, delete, rename and reorder live entries, and that
// must never break npm test. The sample is never refreshed; change it only together with the tests
// that use it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { INDEX_FILE, renderIndex } from "../../scripts/build-content-index.mjs";
import { readContentInput } from "../../scripts/lib/content-input.mjs";
export { readJson, readContentInput } from "../../scripts/lib/content-input.mjs";

/** The frozen sample project: its content/ folder is laid out like the real one. */
export const SAMPLE_ROOT = fileURLToPath(new URL("../fixtures/sample-project/", import.meta.url));

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
