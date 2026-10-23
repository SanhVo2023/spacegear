import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { RELEASE_KEYS, loadReleaseEnv, parseReleaseEnv, withReleaseDefaults } from "../scripts/lib/release-env.mjs";

test("release.env holds exactly the public production values", () => {
  assert.deepEqual(loadReleaseEnv(), {
    NEXT_PUBLIC_SITE_URL: "https://spacegear.tech",
    NEXT_PUBLIC_CONTACT_EMAIL: "admin@spacegear.tech",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAFg-V2bSRNV87fkb",
    POLICIES_APPROVED: "true",
  });
  assert.deepEqual(Object.keys(loadReleaseEnv()).sort(), [...RELEASE_KEYS].sort());
});

test("the parser skips comments and blank lines, accepts CRLF and keeps values literally", () => {
  const text = "# comment\r\n\r\n  NEXT_PUBLIC_SITE_URL=https://example.test/a=b  \r\nPOLICIES_APPROVED=\r\n";
  assert.deepEqual(parseReleaseEnv(text), { NEXT_PUBLIC_SITE_URL: "https://example.test/a=b", POLICIES_APPROVED: "" });
});

test("the parser refuses what it does not understand, naming the line", () => {
  const cases = [
    ["NEXT_PUBLIC_SITE_URL https://x.test", /release\.env line 1: expected KEY=VALUE/],
    ["TURNSTILE_SECRET_KEY=abc", /line 1: TURNSTILE_SECRET_KEY is not a public build value .*secrets are Worker secrets/],
    ["GITHUB_CLIENT_SECRET=abc", /GITHUB_CLIENT_SECRET is not a public build value/],
    ["POLICIES_APPROVED=true\nPOLICIES_APPROVED=false", /line 2: POLICIES_APPROVED is set twice/],
    ['NEXT_PUBLIC_CONTACT_EMAIL="admin@spacegear.tech"', /is quoted/],
    ["POLICIES_APPROVED=true # approved", /has a space in its value/],
    ["export POLICIES_APPROVED=true", /expected KEY=VALUE/],
  ];
  for (const [text, expected] of cases) assert.throws(() => parseReleaseEnv(text), expected, text);
});

test("a value set in the environment wins; an unset or empty one takes the release.env default", () => {
  const defaults = { NEXT_PUBLIC_SITE_URL: "https://spacegear.tech", NEXT_PUBLIC_CONTACT_EMAIL: "admin@spacegear.tech", POLICIES_APPROVED: "true" };
  const { env, sources } = withReleaseDefaults({ NEXT_PUBLIC_SITE_URL: "https://staging.test", NEXT_PUBLIC_CONTACT_EMAIL: "", PATH: "/bin" }, defaults);
  assert.deepEqual(env, { NEXT_PUBLIC_SITE_URL: "https://staging.test", NEXT_PUBLIC_CONTACT_EMAIL: "admin@spacegear.tech", POLICIES_APPROVED: "true", PATH: "/bin" });
  assert.deepEqual(sources, { NEXT_PUBLIC_SITE_URL: "environment", NEXT_PUBLIC_CONTACT_EMAIL: "release.env", POLICIES_APPROVED: "release.env" });
});

test("only the production build reads release.env, and Next.js never loads it", () => {
  // Next.js loads .env, .env.local, .env.production and .env.development files into every build,
  // which would turn preview builds (npm run build:cf) into production-looking ones.
  assert.doesNotMatch("release.env", /^\.env/);
  assert.match(fs.readFileSync("scripts/build-production.mjs", "utf8"), /withReleaseDefaults\(process\.env,loadReleaseEnv\(\)\)/);
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  for (const name of ["build", "build:cf", "preview:cf"]) assert.doesNotMatch(pkg.scripts[name], /release|build-production/, `${name} does not read release.env`);
  // Packaging copies from explicit allowlists only, so release.env never ships in dist/.
  assert.doesNotMatch(fs.readFileSync("scripts/package-site.mjs", "utf8"), /release\.env/);
});
