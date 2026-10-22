// Validates public/admin/config.yml against the vendored Sveltia CMS release's own JSON schema
// (scripts/sveltia-cms.schema.json, from the same verified tarball as the bundle, pinned by sha256 in
// SVELTIA.schema in scripts/vendor-sveltia.mjs), offline, with ajv 6 (the schema is draft-07).
// npm test runs it (tests/cms-config.test.mjs). After a Sveltia upgrade it lists what the new
// release no longer accepts. Paths resolve from the project folder, wherever the command runs.
//   node scripts/check-sveltia-config.mjs [config.yml]
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { load } from "js-yaml";
import { SCHEMA_FILE, SVELTIA } from "./vendor-sveltia.mjs";

const require = createRequire(import.meta.url);
const Ajv = require("ajv");
/** The project folder (the parent of scripts/). */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const CONFIG = "public/admin/config.yml";
const MAX_PROBLEMS = 40;

/** The pinned schema, parsed. Throws when the file is missing or its bytes are not the pinned ones. */
export function loadSchema(root = ROOT, pin = SVELTIA) {
  const file = path.join(root, SCHEMA_FILE);
  if (!fs.existsSync(file)) throw new Error(`${SCHEMA_FILE} is missing; run npm run cms:vendor`);
  const bytes = fs.readFileSync(file);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (hash !== pin.schema) throw new Error(`${SCHEMA_FILE} is not the schema pinned for ${pin.name}@${pin.version} (SVELTIA.schema); run npm run cms:vendor`);
  return JSON.parse(bytes.toString("utf8"));
}

/**
 * What the schema refuses in `config`, as "<JSON pointer> <message>" lines, deepest first (anyOf
 * branches report many errors, and the deepest ones name the field). Empty when it is valid.
 */
export function configProblems(config, schema) {
  const ajv = new Ajv({ allErrors: true, format: "full", jsonPointers: true });
  const validate = ajv.compile(schema);
  if (validate(config)) return [];
  const errors = [...validate.errors].sort((a, b) => b.dataPath.length - a.dataPath.length);
  const lines = errors.map((error) => `${error.dataPath || "/"} ${error.message}${error.params?.additionalProperty ? ` (${error.params.additionalProperty})` : ""}`);
  return [...new Set(lines)].slice(0, MAX_PROBLEMS);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, CONFIG);
  const shown = path.relative(ROOT, file).replaceAll("\\", "/");
  try {
    const problems = configProblems(load(fs.readFileSync(file, "utf8")), loadSchema());
    if (problems.length) {
      console.error(`${shown} is not valid for ${SVELTIA.name}@${SVELTIA.version} (${SCHEMA_FILE}):\n${problems.map((problem) => `  ${problem}`).join("\n")}`);
      process.exitCode = 1;
    } else console.log(`${shown} is valid for ${SVELTIA.name}@${SVELTIA.version} (${SCHEMA_FILE}, ajv ${require("ajv/package.json").version}).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
