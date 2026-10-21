import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COLLECTIONS, INDEX_FILE, readIndex, renderIndex } from "../scripts/build-content-index.mjs";

const { COLLECTION_NAMES } = await import("../src/lib/content-model.ts");
const SCRIPT = fileURLToPath(new URL("../scripts/build-content-index.mjs", import.meta.url));

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
    fs.rmSync(path.join(faqs, "Bad Name.json"));
    fs.writeFileSync(path.join(faqs, "c.JSON"), "{}");
    assert.throws(() => renderIndex(root), /Rename content\/faqs\/c\.JSON/, "an upper-case extension is refused, not skipped");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the command finds the project from its own location, flags a stale index and refuses bad names without a stack trace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-index-cli-"));
  try {
    const script = path.join(root, "scripts", "build-content-index.mjs");
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.copyFileSync(SCRIPT, script);
    fs.cpSync("content", path.join(root, "content"), { recursive: true });
    fs.mkdirSync(path.join(root, "src", "lib"), { recursive: true });
    fs.copyFileSync(INDEX_FILE, path.join(root, INDEX_FILE));
    // Run from a folder that has no content/, so a cwd-relative script would see an empty project.
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: path.join(root, "src"), encoding: "utf8" });

    let result = run("--check");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Content index is up to date\./);

    fs.writeFileSync(path.join(root, "content", "faqs", "zz-new.json"), "{}");
    result = run("--check");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /src\/lib\/content-index\.generated\.ts is out of date\. Run: npm run content:index/);

    result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Wrote src\/lib\/content-index\.generated\.ts\./);
    assert.match(fs.readFileSync(path.join(root, INDEX_FILE), "utf8"), /content\/faqs\/zz-new\.json/);

    fs.writeFileSync(path.join(root, "content", "faqs", "Bad Name.json"), "{}");
    result = run();
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), "Rename content/faqs/Bad Name.json: entry file names use lowercase letters, digits, - and _ only.");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
