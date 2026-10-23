// release.env: the public production build values, committed so that a production build (locally or
// in Cloudflare Workers Builds) needs no hand-typed variables. scripts/build-production.mjs reads it
// as defaults: a variable that is set, and not empty, in the build environment wins.
// The format is deliberately small: one KEY=VALUE per line; blank lines and lines starting with #
// are skipped; no quotes, no spaces, no comments after a value, no expansion. Only the public keys in
// RELEASE_KEYS are accepted, so a secret cannot end up in the repository by way of this file.
import fs from "node:fs";

export const RELEASE_ENV_FILE = "release.env";
/** The values release.env may hold: all of them are public, in the live pages. */
export const RELEASE_KEYS = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_CONTACT_EMAIL", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "POLICIES_APPROVED"];

/** release.env text as { KEY: value }. Throws with the file name and line on anything it does not accept. */
export function parseReleaseEnv(text, file = RELEASE_ENV_FILE) {
  const values = {};
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const where = `${file} line ${index + 1}`;
    if (!line || line.startsWith("#")) return;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) throw new Error(`${where}: expected KEY=VALUE`);
    const [, key, value] = match;
    if (!RELEASE_KEYS.includes(key)) throw new Error(`${where}: ${key} is not a public build value (${RELEASE_KEYS.join(", ")}); secrets are Worker secrets, never in ${file}`);
    if (Object.hasOwn(values, key)) throw new Error(`${where}: ${key} is set twice`);
    if (/^["']/.test(value)) throw new Error(`${where}: ${key} is quoted; write the value without quotes`);
    if (/\s/.test(value)) throw new Error(`${where}: ${key} has a space in its value (a comment after the value is not supported)`);
    values[key] = value;
  });
  return values;
}

/** `env` with each default filled in where `env` has no value (unset or empty). */
export function withReleaseDefaults(env, defaults) {
  const merged = { ...env };
  const sources = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (merged[key] === undefined || merged[key] === "") {
      merged[key] = value;
      sources[key] = "release.env";
    } else sources[key] = "environment";
  }
  return { env: merged, sources };
}

/** Reads and parses release.env (from the working directory unless `file` says otherwise). */
export function loadReleaseEnv(file = RELEASE_ENV_FILE) {
  return parseReleaseEnv(fs.readFileSync(file, "utf8"), file);
}
