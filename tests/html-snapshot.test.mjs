import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { FORMAT, normalize, withoutClientIds } from "../scripts/html-snapshot.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/html-snapshot.mjs", import.meta.url));

/** React 19.2's own Flight server (Next's compiled copy), to see what it really writes. */
function flightServer() {
  const require = createRequire(import.meta.url);
  const compiled = fileURLToPath(new URL("../node_modules/next/dist/compiled/", import.meta.url));
  const map = {
    react: path.join(compiled, "react/cjs/react.react-server.production.js"),
    "react-dom": path.join(compiled, "react-dom/cjs/react-dom.react-server.production.js"),
  };
  map["next/dist/compiled/react"] = map.react;
  map["next/dist/compiled/react-dom"] = map["react-dom"];
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) { return map[request] ?? resolveFilename.call(this, request, ...rest); };
  try {
    const React = require("react");
    const { renderToPipeableStream } = require(path.join(compiled, "react-server-dom-turbopack/cjs/react-server-dom-turbopack-server.node.production.js"));
    const flight = (model) => new Promise((done) => {
      let out = "";
      renderToPipeableStream(model, {}).pipe(new Writable({ write(chunk, _, next) { out += chunk.toString(); next(); }, final(next) { done(out); next(); } }));
    });
    return { h: React.createElement, flight };
  } finally { Module._resolveFilename = resolveFilename; }
}
/** A page whose only payload is `stream`. */
const rscPage = (stream) => `<!DOCTYPE html><html><body><script>self.__next_f.push([1,${JSON.stringify(stream)}])</script></body></html>`;
const treeOf = (html) => { const text = normalize(html); return JSON.parse(text.slice(text.indexOf("</html>") + 7)).tree; };

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

test("the snapshot format is 3", () => {
  assert.equal(FORMAT, 3);
});

test("a page compares equal to itself however the payload is split into push scripts", () => {
  assert.equal(normalize(page(base({ split: 1 }))), normalize(page(base({ split: 5 }))));
});

test("different outlining, other row ids and an extra chunk script compare equal", () => {
  const reference = normalize(page(base()));
  const inlined = page({
    rows: [
      '1:"$Sreact.fragment"',
      '5:I[123,["/_next/static/chunks/cc33.js"],"default"]',
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
    "text that looks like a client row in the markup": page(base({ markupClass: "I[42, x" })),
  };
  for (const [what, html] of Object.entries(changed)) assert.notEqual(normalize(html), reference, what);
  assert.notEqual(normalize(page(base({ markupClass: "I[42, x" }))), normalize(page(base({ markupClass: "I[43, x" }))), "markup is not masked as a client row");
});

test("hint rows compare in any order", () => {
  const hints = [':HL["/_next/static/chunks/aa.css","style"]', ':HL["/_next/static/media/bb.woff2","font",{"crossOrigin":""}]'];
  const rows = (list) => base({ rows: ['1:"$Sreact.fragment"', ...list, '0:{"P":null,"b":"Bld123","f":[]}'] });
  assert.equal(normalize(page(rows(hints))), normalize(page(rows([...hints].reverse()))));
  assert.notEqual(normalize(page(rows(hints))), normalize(page(rows([hints[0]]))), "a missing hint still differs");
});

test("client references keep their module id: swapping two \"default\" components is caught", () => {
  const two = (first, second, uses = ["$L2", "$L5"]) => page(base({ rows: [
    '1:"$Sreact.fragment"',
    `2:I[${first},["/_next/static/chunks/aa11.js"],"default"]`,
    `5:I[${second},["/_next/static/chunks/bb22.js"],"default"]`,
    `0:{"P":null,"b":"Bld123","f":[["$","${uses[0]}",null,{"title":"How It Works"}],["$","${uses[1]}",null,{}]]}`,
  ] }));
  const reference = normalize(two(18140, 96199));
  const idsSwapped = normalize(two(96199, 18140));
  const typesSwapped = normalize(two(18140, 96199, ["$L5", "$L2"]));
  assert.notEqual(idsSwapped, reference, "module ids swapped between the two rows");
  assert.notEqual(typesSwapped, reference, "element types swapped");
  assert.match(reference, /"\$module": 18140/);
  assert.equal(withoutClientIds(idsSwapped), withoutClientIds(reference), "--loose-client-ids ignores the ids");
  assert.doesNotMatch(withoutClientIds(reference), /\$module/);
});

test("React's own dedupe of a repeated prop resolves to the same value as writing it twice", async () => {
  const { h, flight } = flightServer();
  const shared = { items: ["Assess", "Build", "Improve"], label: "Engagements" };
  const tree = (second) => h("main", null, h("section", { data: shared }, "first"), h("aside", { data: second }, "second"));
  const deduped = await flight(tree(shared));
  assert.match(deduped, /"\$0:props:children:0:props:data"/, "React writes the repeated prop as a path through element props");
  const twice = await flight(tree({ items: [...shared.items], label: shared.label }));
  assert.doesNotMatch(twice, /:props:/);
  assert.equal(normalize(rscPage(deduped)), normalize(rscPage(twice)));
  const other = await flight(tree({ ...shared, label: "Other" }));
  assert.notEqual(normalize(rscPage(deduped)), normalize(rscPage(other)));
});

test("references into the same row resolve from the raw row; only a containing value is a cycle", () => {
  const list = (target) => rscPage(`0:["$","ul",null,{"children":[["$","li",null,{"children":"A"}],"$0:props:children:${target}",["$","li",null,{"children":"C"}]]}]\n`);
  const inline = rscPage('0:["$","ul",null,{"children":[["$","li",null,{"children":"A"}],["$","li",null,{"children":"A"}],["$","li",null,{"children":"C"}]]}]\n');
  assert.equal(normalize(list(0)), normalize(inline), "a reference to children[0] is children[0]");
  assert.notEqual(normalize(list(0)), normalize(list(2)), "references to children[0] and children[2] differ");
  assert.deepEqual(treeOf(rscPage('0:["$","div",null,{"self":"$0:props","row":"$0"}]\n'))[3], { self: { $cycle: 1 }, row: { $cycle: 2 } });
});

test("a reference graph that resolves to more than a million values fails fast", () => {
  const hex = (n) => n.toString(16);
  // Each row holds two references to the next, so the tree doubles at every level.
  const dag = (levels) => rscPage([...Array.from({ length: levels }, (_, i) => `${hex(i + 1)}:["$${hex(i + 2)}","$${hex(i + 2)}"]\n`), `${hex(levels + 1)}:"leaf"\n`, '0:{"x":"$1"}\n'].join(""));
  assert.doesNotThrow(() => normalize(dag(10)));
  const start = performance.now();
  assert.throws(() => normalize(dag(22)), /resolves to more than 1000000 values/);
  assert.ok(performance.now() - start < 5000, `took ${(performance.now() - start).toFixed(0)} ms`);
});

test("a path through another reference follows that reference and its own path; it cannot index a Set", () => {
  const html = rscPage('1:{"a":{"b":"x"}}\n2:["$","p",null,{"children":"lazy"}]\n0:{"inner":"$1:a","outer":"$0:inner:b","viaLazy":"$0:el:props:children","el":"$L2"}\n');
  assert.deepEqual(treeOf(html), { inner: { b: "x" }, outer: "x", viaLazy: "lazy", el: ["$", "p", null, { children: "lazy" }] });
  assert.throws(() => normalize(rscPage('6:["a"]\n0:{"x":"$W6","y":"$0:x:0"}\n')), /walks through "\$W6" \(\$Set\)/);
  assert.throws(() => normalize(rscPage('0:{"x":"$0:missing"}\n')), /"\$0:missing" does not resolve/);
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
    '0:{"P":null,"b":"Bld123","c":["",""],"f":[{"plain":"$6","path":"$3:props:children","set":"$W6","map":"$Q7","promise":"$@6","node":"$8"}]}',
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

    // The build ID comes from each page's own "b" value: a stale .next/BUILD_ID does not matter.
    fs.mkdirSync(path.join(root, ".next"));
    fs.writeFileSync(path.join(root, ".next", "BUILD_ID"), "Hello");
    let result = run("save", snap);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(root, snap, ".format"), "utf8").trim(), "3");
    fs.writeFileSync(path.join(root, ".next", "BUILD_ID"), "Other");
    result = run("compare", snap);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Rendered HTML identical to artifacts[\\/]snap: 2 pages\./);

    // Only the client module id changes: refused with the changed ids listed, unless
    // --loose-client-ids (which warns) or --explain-client-ids finds the same factory code.
    fs.writeFileSync(path.join(root, "dist", "index.html"), page(base({ rows: base().rows.map((row) => row.replace("2:I[123,", "2:I[124,")) })));
    result = run("compare", snap);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /index\.html: only client module ids changed:\n {4}"default" 123 → 124 \(line \d+\)/);
    result = run("compare", snap, "--loose-client-ids");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Warning: --loose-client-ids ignores client module ids/);
    assert.match(result.stdout, /identical to artifacts[\\/]snap: 2 pages \(client module ids ignored\)\./);
    assert.equal(run("save", snap, "--loose-client-ids").status, 2, "the flag is for compare only");

    const chunk = (dir, id, body) => {
      fs.mkdirSync(path.join(root, dir, "_next", "static", "chunks"), { recursive: true });
      fs.writeFileSync(path.join(root, dir, "_next", "static", "chunks", "a1.js"), `(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,${id},e=>{"use strict";${body}},777,(e,t)=>{other()}]);`);
    };
    chunk("old-dist", 123, 'e.s(["default",0,function(){return"Pricing"}])');
    chunk("dist", 124, 'e.s(["default",0,function(){return"Pricing"}])');
    result = run("compare", snap, "--explain-client-ids", "old-dist");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /identical to artifacts[\\/]snap: 2 pages \(1 client module id changed; each has the same export, place and factory code\)\./);
    chunk("dist", 124, 'e.s(["default",0,function(){return"Contact"}])');
    result = run("compare", snap, "--explain-client-ids", "old-dist");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /"default" 123 → 124 \(line \d+\): the factory code differs/);
    fs.rmSync(path.join(root, "dist", "_next"), { recursive: true });
    result = run("compare", snap, "--explain-client-ids", "old-dist");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /"default" 123 → 124 \(line \d+\): module 124 not found in dist/);
    assert.equal(run("compare", snap, "--explain-client-ids").status, 2, "the option needs the other build's dist folder");

    fs.writeFileSync(path.join(root, "dist", "terms", "index.html"), page(base({ markupClass: "p-9" })));
    result = run("compare", snap, "--loose-client-ids");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /changed page: terms\/index\.html/);

    for (const [marker, found] of [["2\n", "2"], ["1\n", "1"], [null, "1"]]) {
      if (marker === null) fs.rmSync(path.join(root, snap, ".format"));
      else fs.writeFileSync(path.join(root, snap, ".format"), marker);
      result = run("compare", snap);
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`saved in format ${found}; this script compares format 3`), `marker ${JSON.stringify(marker)}`);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
