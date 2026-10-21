import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FORMAT, normalize } from "../scripts/html-snapshot.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/html-snapshot.mjs", import.meta.url));

// A tiny exported page: head chunk scripts, a noModule polyfill, JSON-LD, the RSC bootstrap and the
// RSC payload split over push scripts, the way `next build` writes it.
const push = (text) => `<script>self.__next_f.push([1,${JSON.stringify(text)}])</script>`;
const chunkScript = (n, src) => `["$","script","script-${n}",{"src":"/_next/static/chunks/${src}.js","async":true,"nonce":"$undefined"}]`;
const NAV = '["$","nav",null,{"aria-label":"Pages","children":"Pages"}]';
const LD = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"spacegear.tech"}</script>';
const BOOT = "<script>(self.__next_f=self.__next_f||[]).push([0])</script>";
const POLYFILL = '<script src="/_next/static/chunks/0cz1d0mv5g_q7.js" noModule=""></script>';

function page({ rows, markupClass = "p-6", ld = LD, boot = BOOT, polyfill = POLYFILL, headChunks = ["aa11", "bb22"], split = 2 } = {}) {
  const stream = rows.map((row) => `${row}\n`).join("");
  const parts = [];
  for (let i = 0; i < stream.length; i += Math.ceil(stream.length / split)) parts.push(stream.slice(i, i + Math.ceil(stream.length / split)));
  const head = headChunks.map((name) => `<script src="/_next/static/chunks/${name}.js" async=""></script>`).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>${head}${polyfill}</head><body><main><p class="${markupClass}">Hello</p></main>${ld}${boot}${parts.map(push).join("")}</body></html>`;
}

// Row 0 renders <html><body> with a client component (row 2) and the nav, outlined in row 3.
const base = (overrides = {}) => ({
  rows: [
    '1:"$Sreact.fragment"',
    '2:I[123,["/_next/static/chunks/aa11.js","/_next/static/chunks/bb22.js"],"default"]',
    ':HL["/_next/static/chunks/3mpkychnvfin5.css","style"]',
    `0:{"P":null,"b":"Bld123","c":["",""],"f":[[["$","$1","c",{"children":[[${chunkScript(0, "aa11")}],["$","html",null,{"children":["$","body",null,{"children":["$L3",["$","$L2",null,{}]]}]}]]}]]]}`,
    `3:${NAV}`,
  ],
  ...overrides,
});

test("the snapshot format is 2", () => {
  assert.equal(FORMAT, 2);
});

test("a page compares equal to itself however the payload is split into push scripts", () => {
  assert.equal(normalize(page(base({ split: 1 }))), normalize(page(base({ split: 5 }))));
});

test("different outlining, other row ids and an extra chunk script compare equal", () => {
  const reference = normalize(page(base()));
  const inlined = page({
    rows: [
      '1:"$Sreact.fragment"',
      '5:I[456,["/_next/static/chunks/cc33.js"],"default"]',
      ':HL["/_next/static/chunks/3mpkychnvfin5.css","style"]',
      `0:{"P":null,"b":"Bld999","c":["",""],"f":[[["$","$1","c",{"children":[[${chunkScript(0, "cc33")},${chunkScript(1, "dd44")}],["$","html",null,{"children":["$","body",null,{"children":[${NAV},["$","$L5",null,{}]]}]}]]}]]]}`,
    ],
    headChunks: ["cc33", "dd44", "ee55"],
  });
  assert.equal(normalize(inlined), reference);
});

test("a change to RSC text, markup, HTML-only JSON-LD or a bootstrap script compares different", () => {
  const reference = normalize(page(base()));
  const changed = {
    "RSC text": page(base({ rows: base().rows.map((row) => row.replace('"children":"Pages"', '"children":"Pagez"')) })),
    "markup attribute": page(base({ markupClass: "p-7" })),
    "JSON-LD in the HTML only": page(base({ ld: LD.replace("Organization", "Organizatio") })),
    "removed noModule script": page(base({ polyfill: "" })),
    "removed RSC bootstrap script": page(base({ boot: "" })),
    "client export name": page(base({ rows: base().rows.map((row) => row.replace('"default"]', '"Other"]')) })),
    "client component turned async": page(base({ rows: base().rows.map((row) => row.replace('"default"]', '"default",1]')) })),
    "hint": page(base({ rows: base().rows.map((row) => row.replace('"style"]', '"font"]')) })),
    "chunk script that is not a plain async chunk": page(base({ rows: base().rows.map((row) => row.replace('"async":true', '"async":false')) })),
  };
  for (const [what, html] of Object.entries(changed)) assert.notEqual(normalize(html), reference, what);
});

test("text rows decode by UTF-8 byte length, so multibyte text and the row after it survive", () => {
  const text = "Ünïcødé — 😀 café, 中文";
  const bytes = Buffer.byteLength(text, "utf8").toString(16);
  const outlined = page(base({ rows: [
    '1:"$Sreact.fragment"',
    `4:T${bytes},${text}5:["$","p",null,{"children":"after"}]`,
    `0:{"P":null,"b":"Bld123","c":["",""],"f":[["$","html",null,{"children":["$","body",null,{"children":["$4","$L5"]}]}]]}`,
  ] }));
  const inline = page(base({ rows: [
    '1:"$Sreact.fragment"',
    `0:{"P":null,"b":"Bld123","c":["",""],"f":[["$","html",null,{"children":["$","body",null,{"children":[${JSON.stringify(text)},["$","p",null,{"children":"after"}]]}]}]]}`,
  ] }));
  const result = normalize(outlined);
  assert.ok(result.includes(JSON.stringify(text)), "the text is decoded whole");
  assert.ok(result.includes('"after"'), "the next row is read from the right place");
  assert.equal(result, normalize(inline), "a text row and the same text inline are equal");
});

test("plain, path, Set, Map and promise references resolve; cycles are marked; kept forms stay", () => {
  const html = page(base({ rows: [
    '1:"$Sreact.fragment"',
    '6:["a","b"]',
    '7:[["k","v"]]',
    '8:{"self":"$8","date":"$D2026-10-21T00:00:00.000Z","big":"$n12","dollar":"$$5","missing":"$undefined"}',
    `3:${NAV}`,
    '0:{"P":null,"b":"Bld123","c":["",""],"f":[{"plain":"$6","path":"$3:3:children","set":"$W6","map":"$Q7","promise":"$@6","node":"$8"}]}',
  ] }));
  const tree = JSON.parse(normalize(html).slice(normalize(html).indexOf("</html>") + 7)).tree;
  assert.deepEqual(tree.f[0], {
    plain: ["a", "b"],
    path: "Pages",
    set: { $Set: ["a", "b"] },
    map: { $Map: [["k", "v"]] },
    promise: { $promise: ["a", "b"] },
    node: { self: { $cycle: 1 }, date: "$D2026-10-21T00:00:00.000Z", big: "$n12", dollar: "$$5", missing: "$undefined" },
  });
});

test("an unknown reference form, a missing row or an unknown row tag throws", () => {
  const withRow0 = (row0, extra = []) => page(base({ rows: ['1:"$Sreact.fragment"', ...extra, `0:${row0}`] }));
  assert.throws(() => normalize(withRow0('{"x":"$Z5"}')), /unknown RSC reference "\$Z5"/);
  assert.throws(() => normalize(withRow0('{"x":"$L9"}')), /RSC reference "\$L9" points at a missing row/);
  assert.throws(() => normalize(withRow0('{"x":1}', ['9:X["?"]'])), /unknown RSC row tag "X"/);
});

test("save writes the format marker and compare refuses a folder saved in another format", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-snapshot-"));
  try {
    fs.mkdirSync(path.join(root, "scripts"));
    fs.mkdirSync(path.join(root, "dist", "terms"), { recursive: true });
    fs.mkdirSync(path.join(root, "artifacts"));
    fs.copyFileSync(SCRIPT, path.join(root, "scripts", "html-snapshot.mjs"));
    fs.writeFileSync(path.join(root, "dist", "index.html"), page(base()));
    fs.writeFileSync(path.join(root, "dist", "terms", "index.html"), page(base({ markupClass: "p-8" })));
    const run = (...args) => spawnSync(process.execPath, [path.join("scripts", "html-snapshot.mjs"), ...args], { cwd: root, encoding: "utf8" });
    const snap = path.join("artifacts", "snap");

    let result = run("save", snap);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(root, snap, ".format"), "utf8").trim(), "2");
    result = run("compare", snap);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Rendered HTML identical to artifacts[\\/]snap: 2 pages\./);

    fs.writeFileSync(path.join(root, "dist", "terms", "index.html"), page(base({ markupClass: "p-9" })));
    result = run("compare", snap);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /changed page: terms\/index\.html/);

    fs.writeFileSync(path.join(root, snap, ".format"), "1\n");
    result = run("compare", snap);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /saved in format 1; this script compares format 2/);
    fs.rmSync(path.join(root, snap, ".format"));
    result = run("compare", snap);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /saved in format 1; this script compares format 2/, "a folder without a marker is format 1");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
