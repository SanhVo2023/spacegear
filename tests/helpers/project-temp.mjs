// A temporary project folder inside this repository (artifacts/ is gitignored), for tests that run
// a copy of a script: packages such as sharp then resolve from this repository's node_modules,
// which a folder in the system temp directory cannot see. Remove it with removeProjectTemp().
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = fileURLToPath(new URL("../../artifacts/test-projects/", import.meta.url));

export function projectTempDir(prefix = "project-") {
  fs.mkdirSync(BASE, { recursive: true });
  return fs.mkdtempSync(path.join(BASE, prefix));
}

export function removeProjectTemp(dir) {
  if (!path.resolve(dir).startsWith(path.resolve(BASE))) throw new Error(`${dir} is not a temporary project`);
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
}
