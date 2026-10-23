import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
// Google Fonts subsets (fonts.googleapis.com/css2, Chrome user agent): Inter v20 = "Version 4.001;git-66647c0bb",
// JetBrains Mono v24 = "Version 2.211". The latin files are the ones the site has shipped since the rebuild.
const FILES = {
  "src/app/fonts/inter-latin.woff2": "c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4",
  "src/app/fonts/inter-vietnamese.woff2": "5c66f9e07e90c6d4ac4922cc68d60de26c17b1858e677fb5e603fce3952b3ff2",
  "src/app/fonts/jetbrains-mono-latin.woff2": "1e06740a02a443fb7f3eeda8fcaa685a0f6c620e3f01e6666e847295469ce3ad",
  "src/app/fonts/jetbrains-mono-vietnamese.woff2": "2288795da89dd97e648954b96e22b4501bd85dfc453264460b252f888b582ca2",
};
const RANGE = "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB";

test("the self-hosted font files are the pinned Google Fonts subsets", () => {
  for (const [file, hash] of Object.entries(FILES)) assert.equal(sha256(file), hash, file);
});

test("each family is one name for its latin and Vietnamese faces; only the Vietnamese faces carry a unicode-range", () => {
  const source = fs.readFileSync("src/app/fonts/fonts.ts", "utf8");
  const calls = [...source.matchAll(/localFont\(\{([\s\S]*?)\}\);/g)].map((match) => match[1]);
  const faces = calls.map((body) => ({
    file: body.match(/src: "\.\/([^"]+)"/)?.[1],
    family: body.match(/prop: "font-family", value: "([^"]+)"/)?.[1],
    range: body.match(/prop: "unicode-range", value: "([^"]+)"/)?.[1] ?? null,
    preload: !/preload: false/.test(body),
    fallback: !/adjustFontFallback: false/.test(body),
  }));
  assert.deepEqual(faces, [
    { file: "inter-latin.woff2", family: "SG Inter", range: null, preload: true, fallback: false },
    { file: "inter-vietnamese.woff2", family: "SG Inter", range: RANGE, preload: false, fallback: false },
    { file: "jetbrains-mono-latin.woff2", family: "SG Mono", range: null, preload: false, fallback: false },
    { file: "jetbrains-mono-vietnamese.woff2", family: "SG Mono", range: RANGE, preload: false, fallback: false },
  ]);
});

test("fonts.css sets the family variables and the metric-adjusted fallbacks next/font computed for these files", () => {
  const css = fs.readFileSync("src/app/fonts/fonts.css", "utf8");
  assert.match(css, /--font-inter: "SG Inter", "SG Inter Fallback";/);
  assert.match(css, /--font-code: "SG Mono", "SG Mono Fallback";/);
  assert.match(css, /font-family: "SG Inter Fallback"; src: local\("Arial"\); ascent-override: 89\.79%; descent-override: 22\.36%; line-gap-override: 0%; size-adjust: 107\.89%;/);
  assert.match(css, /font-family: "SG Mono Fallback"; src: local\("Arial"\); ascent-override: 77\.57%; descent-override: 22\.82%; line-gap-override: 0%; size-adjust: 131\.49%;/);
});

test("only src/app/fonts/fonts.ts loads fonts, and a root module imports it", () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
  const sources = walk("src").filter((file) => /\.tsx?$/.test(file)).map((file) => [file.replaceAll("\\", "/"), fs.readFileSync(file, "utf8")]);
  assert.deepEqual(sources.filter(([, text]) => text.includes("next/font")).map(([file]) => file), ["src/app/fonts/fonts.ts"]);
  assert.ok(sources.some(([, text]) => /import "(?:\.\/fonts|@\/app\/fonts)\/fonts";/.test(text)), "a layout or the site shell imports the fonts module");
});

test("the font licence names every shipped font file", () => {
  const licence = fs.readFileSync("public/licenses/fonts.txt", "utf8");
  for (const file of Object.keys(FILES)) assert.ok(licence.includes(path.basename(file)), path.basename(file));
});
