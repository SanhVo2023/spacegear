import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findForbidden, textsOf } from "../scripts/lib/honesty.mjs";

const { dictionary, format, formatParts } = await import("../src/lib/i18n/dictionary.ts");
const { en } = await import("../src/lib/i18n/en.ts");
const { vi } = await import("../src/lib/i18n/vi.ts");

/** Every leaf path ("nav.home", "about.principles[2]") with its value. */
function leaves(value, at = "", out = new Map()) {
  if (typeof value === "string") out.set(at, value);
  else if (Array.isArray(value)) value.forEach((item, index) => leaves(item, `${at}[${index}]`, out));
  else for (const [key, child] of Object.entries(value)) leaves(child, at ? `${at}.${key}` : key, out);
  return out;
}

test("Vietnamese has exactly the English keys, lists of the same length, and no empty string", () => {
  const [english, vietnamese] = [leaves(en), leaves(vi)];
  assert.deepEqual([...vietnamese.keys()], [...english.keys()]);
  for (const [key, text] of english) assert.ok(text.trim().length > 0, `en ${key} is empty`);
  // A punctuation slot may be empty where Vietnamese does not use that mark: hero.afterSecond is the comma
  // before "and" in "plan, build, and scale", and Vietnamese writes "hoạch định, xây dựng và mở rộng".
  const punctuationOnly = (text) => !/[\p{L}\p{N}]/u.test(text);
  for (const [key, text] of vietnamese) assert.ok(text.trim().length > 0 || punctuationOnly(english.get(key)), `vi ${key} is empty`);
  assert.equal(vi.hero.afterSecond, "", "no comma before và");
});

test("every placeholder of a string is in its translation", () => {
  const english = leaves(en);
  for (const [key, text] of leaves(vi)) {
    const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(names(text), names(english.get(key)), key);
  }
});

test("dictionary() picks the language and format() fills placeholders", () => {
  assert.equal(dictionary("en"), en);
  assert.equal(dictionary("vi"), vi);
  assert.equal(format("Step {n}", { n: 3 }), "Step 3");
  assert.equal(format("© {year} spacegear.tech.", { year: 2026 }), "© 2026 spacegear.tech.");
  assert.equal(format("{missing} stays", {}), "{missing} stays");
  assert.deepEqual(formatParts("Role {i} of {n}", { i: 1, n: 5 }), ["Role ", 1, " of ", 5]);
  assert.deepEqual(formatParts("© {year} spacegear.tech. All rights reserved.", { year: 2026 }), ["© ", 2026, " spacegear.tech. All rights reserved."]);
});

test("the UI strings make no unverified claim in either language", () => {
  for (const [locale, strings] of [["en", en], ["vi", vi]]) {
    for (const [field, text] of textsOf(strings)) assert.deepEqual(findForbidden(text, `src/lib/i18n/${locale}.ts`, field), [], `${locale} ${field}: ${text}`);
  }
});

test("TypeScript refuses a Vietnamese dictionary with a missing or an extra key", () => {
  const source = fs.readFileSync("src/lib/i18n/vi.ts", "utf8");
  assert.match(source, /export const vi: Dictionary = \{/, "vi is annotated, so a missing key fails typecheck and an extra key fails as an excess property");
});
