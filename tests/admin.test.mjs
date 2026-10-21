import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { SVELTIA, extractVendored, untar, verifyVendored } from "../scripts/vendor-sveltia.mjs";

test("the vendored Sveltia CMS is byte for byte the pinned release", () => {
  assert.deepEqual(verifyVendored("."), []);
  const lock = JSON.parse(fs.readFileSync("scripts/sveltia-cms.lock.json", "utf8"));
  assert.equal(lock.version, SVELTIA.version);
  assert.equal(SVELTIA.version, "0.230.1", "the pin is at least 14 days old (published 2026-10-07)");
  assert.ok("sveltia-cms.js" in lock.files, "the browser bundle");
  assert.ok(Object.keys(lock.files).some((file) => file.startsWith("chunks/")), "the lazy chunks it imports next to itself");
  assert.ok(!Object.keys(lock.files).some((file) => file.endsWith(".map")), "no source maps");
  const bundle = fs.readFileSync("public/admin/sveltia/sveltia-cms.js", "utf8");
  assert.ok(bundle.includes(`name:\`@sveltia/cms\`,version:\`${SVELTIA.version}\``), "the bundle itself says it is the pinned version");
  assert.doesNotMatch(bundle, /sourceMappingURL/, "no pointer to a source map that is not shipped");
});

/** A one-file ustar archive, gzipped: just enough to drive the vendor script's reader. */
function tarball(name, body, { pax = false } = {}) {
  const header = (fileName, size, type) => {
    const block = Buffer.alloc(512);
    block.write(fileName.slice(0, 100), 0, "utf8");
    block.write("0000644\0", 100, "latin1");
    block.write(`${size.toString(8).padStart(11, "0")}\0`, 124, "latin1");
    block.write(type, 156, "latin1");
    block.write("ustar\0" + "00", 257, "latin1");
    block.fill(" ", 148, 156);
    const sum = block.reduce((total, byte) => total + byte, 0);
    block.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "latin1");
    return block;
  };
  const pad = (data) => Buffer.concat([data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
  const parts = [];
  if (pax) {
    const record = `path=${name}\n`;
    const line = `${record.length + 3} ${record}`;
    parts.push(header("PaxHeader", Buffer.byteLength(line), "x"), pad(Buffer.from(line)));
  }
  parts.push(header(pax ? "short-name" : name, body.length, "0"), pad(body), Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(parts));
}

test("the vendor script reads ustar and pax names, and refuses a tarball whose bytes are not the pinned release", () => {
  const body = Buffer.from("console.log(1);\n//# sourceMappingURL=sveltia-cms.js.map\n");
  assert.deepEqual([...untar(zlib.gunzipSync(tarball("package/dist/sveltia-cms.js", body)))].map(([name, data]) => [name, data.toString()]), [["package/dist/sveltia-cms.js", body.toString()]]);
  const long = `package/dist/chunks/${"x".repeat(120)}.js`;
  assert.deepEqual([...untar(zlib.gunzipSync(tarball(long, body, { pax: true })))].map(([name]) => name), [long], "a pax path record names the next file");
  assert.throws(() => extractVendored(tarball("package/dist/sveltia-cms.js", body)), /^Error: Integrity mismatch for @sveltia\/cms@0\.230\.1: expected sha512-/);
});

test("the site stylesheet does not take class names from the vendored CMS", () => {
  // Tailwind's source detection would otherwise add utilities named in the 2 MB bundle to the site CSS.
  assert.match(fs.readFileSync("src/app/globals.css", "utf8"), /^@source not "\.\.\/\.\.\/public\/admin";\r?$/m);
});

test("the admin page loads only the vendored bundle and is never indexed", () => {
  const html = fs.readFileSync("public/admin/index.html", "utf8");
  assert.deepEqual([...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]), ['<script src="/admin/sveltia/sveltia-cms.js">'], "one external script, no inline code");
  assert.match(html, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.match(html, /<link rel="cms-config-url" type="application\/yaml" href="\/admin\/config\.yml" \/>/);
  assert.doesNotMatch(html, /https?:\/\//, "no third-party address in the page");
});
