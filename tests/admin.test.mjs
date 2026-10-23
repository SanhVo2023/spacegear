import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { LOCK, MAX_UNPACKED, SCHEMA_FILE, SVELTIA, TARGET, extractSchema, extractVendored, untar, verifyVendored, writeVendored } from "../scripts/vendor-sveltia.mjs";
import { ADMIN_FILES } from "../scripts/lib/admin.mjs";
import { ADMIN_CSP, ADMIN_FONTS, ADMIN_GITHUB_CONNECT, ADMIN_GITHUB_IMAGES } from "../scripts/lib/headers.mjs";

test("the vendored Sveltia CMS is byte for byte the pinned release", () => {
  assert.deepEqual(verifyVendored("."), []);
  const lock = JSON.parse(fs.readFileSync("scripts/sveltia-cms.lock.json", "utf8"));
  assert.equal(lock.version, SVELTIA.version);
  assert.equal(SVELTIA.version, "0.230.1", "the pin is at least 14 days old (published 2026-10-07)");
  assert.deepEqual(lock.files, SVELTIA.files, "the lock repeats the hashes pinned in the script");
  assert.ok("sveltia-cms.js" in lock.files, "the browser bundle");
  assert.ok(Object.keys(lock.files).some((file) => file.startsWith("chunks/")), "the lazy chunks it imports next to itself");
  assert.ok(!Object.keys(lock.files).some((file) => file.endsWith(".map")), "no source maps");
  const bundle = fs.readFileSync("public/admin/sveltia/sveltia-cms.js", "utf8");
  assert.ok(bundle.includes(`name:\`@sveltia/cms\`,version:\`${SVELTIA.version}\``), "the bundle itself says it is the pinned version");
  assert.doesNotMatch(bundle, /sourceMappingURL/, "no pointer to a source map that is not shipped");
  assert.equal(lock.schema, SVELTIA.schema, "the lock repeats the pinned schema hash");
  assert.match(SVELTIA.schema, /^[0-9a-f]{64}$/);
  assert.ok(!ADMIN_FILES.some((file) => file.includes("schema")), "the schema never ships in /admin/");
});

/** A gzipped ustar archive of `entries` ({ name, body, type = "0", pax }): enough to drive the vendor script's reader. */
function tarball(entries) {
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
  for (const { name, body = Buffer.alloc(0), type = "0", pax = false } of entries) {
    if (pax) {
      const record = `path=${name}\n`;
      const line = `${record.length + 3} ${record}`;
      parts.push(header("PaxHeader", Buffer.byteLength(line), "x"), pad(Buffer.from(line)));
    }
    parts.push(header(pax ? "short-name" : name, body.length, type), pad(body));
  }
  parts.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(parts));
}
/** A pin that trusts exactly these tarball bytes, with `files` to compare the extraction against. */
const pinFor = (tgz, files = {}) => ({ ...SVELTIA, integrity: `sha512-${crypto.createHash("sha512").update(tgz).digest("base64")}`, files });
const BUNDLE = { name: "package/dist/sveltia-cms.js", body: Buffer.from("console.log(1);\n//# sourceMappingURL=sveltia-cms.js.map\n") };
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-vendor-"));

test("the vendor script reads ustar and pax names, and refuses a tarball whose bytes are not the pinned release", () => {
  assert.deepEqual([...untar(zlib.gunzipSync(tarball([BUNDLE])))].map(([name, data]) => [name, data.toString()]), [[BUNDLE.name, BUNDLE.body.toString()]]);
  const long = `package/dist/chunks/${"x".repeat(120)}.js`;
  assert.deepEqual([...untar(zlib.gunzipSync(tarball([{ name: long, body: BUNDLE.body, pax: true }])))].map(([name]) => name), [long], "a pax path record names the next file");
  assert.throws(() => extractVendored(tarball([BUNDLE])), /^Error: Integrity mismatch for @sveltia\/cms@0\.230\.1: expected sha512-/);
});

test("extraction keeps the wanted files without source maps, and their hashes must be the pinned ones", () => {
  const tgz = tarball([BUNDLE, { name: "package/dist/chunks/react-dom.js", body: Buffer.from("x\n//# sourceMappingURL=react-dom.js.map") }, { name: "package/dist/sveltia-cms.js.map", body: Buffer.from("{}") }, { name: "package/README.md", body: Buffer.from("#") }]);
  const files = extractVendored(tgz, pinFor(tgz));
  assert.deepEqual([...files].map(([name, data]) => [name, data.toString()]), [["chunks/react-dom.js", "x\n"], ["sveltia-cms.js", "console.log(1);\n"]]);
  const hashes = Object.fromEntries([...files].map(([name, data]) => [name, crypto.createHash("sha256").update(data).digest("hex")]));
  assert.equal(extractVendored(tgz, pinFor(tgz, hashes)).size, 2, "the pinned hashes match");
  assert.throws(() => extractVendored(tgz, pinFor(tgz, { ...hashes, "sveltia-cms.js": "0".repeat(64) })), /differ from the hashes pinned in scripts\/vendor-sveltia\.mjs/);
  assert.throws(() => extractVendored(tgz, pinFor(tgz, { "sveltia-cms.js": hashes["sveltia-cms.js"] })), /differ from the hashes pinned/, "a file the pin does not list");
});

test("a wanted name that leaves the folder, is not a regular file or appears twice is refused, never skipped", () => {
  const refused = [
    [[BUNDLE, { name: "package/dist/chunks/../../../../evil.js", body: Buffer.from("x") }], /Refusing package\/dist\/chunks\/\.\.\/.*letters, digits/],
    [[BUNDLE, { name: "package/dist/chunks/a b.js", body: Buffer.from("x") }], /Refusing package\/dist\/chunks\/a b\.js/],
    [[BUNDLE, { name: "package/dist/chunks/./x.js", body: Buffer.from("x") }], /Refusing package\/dist\/chunks\/\.\/x\.js/],
    [[{ name: BUNDLE.name, type: "2" }], /Refusing package\/dist\/sveltia-cms\.js: it is not a regular file \(tar type "2"\)/],
    [[BUNDLE, { name: "package/dist/chunks/react-dom.js", type: "1" }], /not a regular file \(tar type "1"\)/],
    [[BUNDLE, { name: "package/LICENSE.txt", type: "5" }], /not a regular file \(tar type "5"\)/],
    [[BUNDLE, BUNDLE], /appears twice/],
  ];
  for (const [entries, message] of refused) {
    const tgz = tarball(entries);
    assert.throws(() => extractVendored(tgz, pinFor(tgz)), message, entries.map(({ name, type = "0" }) => `${type} ${name}`).join(", "));
  }
});

test("a tarball that unpacks to more than 64 MiB is refused before it is read", () => {
  const bomb = zlib.gzipSync(Buffer.alloc(MAX_UNPACKED + 1));
  assert.ok(bomb.length < 1 << 20, "a small download");
  assert.throws(() => extractVendored(bomb, pinFor(bomb)), /unpacks to more than 64 MiB/);
});

test("writing and checking stay inside public/admin/sveltia", () => {
  const root = tempDir();
  try {
    assert.throws(() => writeVendored(new Map([["sveltia-cms.js", Buffer.from("x")], ["../escape.js", Buffer.from("x")]]), root), /Refusing \.\.\/escape\.js: it is not a path inside/);
    assert.deepEqual(fs.readdirSync(root), [], "nothing is written, not even the files before it");
    const hashes = writeVendored(new Map([["sveltia-cms.js", Buffer.from("x")], ["chunks/a.js", Buffer.from("y")]]), root);
    assert.deepEqual(verifyVendored(root, { ...SVELTIA, files: hashes, schema: "" }), []);
    assert.ok(verifyVendored(root, { ...SVELTIA, files: { ...hashes, "../../package.json": "0".repeat(64) } }).some((problem) => /Refusing \.\.\/\.\.\/package\.json/.test(problem)), "a pinned path that leaves the folder is never read");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("new vendored bytes need a visible pin edit: a file and lock changed together still fail", () => {
  const root = tempDir();
  try {
    fs.mkdirSync(path.join(root, "scripts"));
    fs.copyFileSync(LOCK, path.join(root, LOCK));
    fs.copyFileSync(SCHEMA_FILE, path.join(root, SCHEMA_FILE));
    fs.cpSync(TARGET, path.join(root, TARGET), { recursive: true });
    assert.deepEqual(verifyVendored(root), []);
    const chunk = path.join(root, TARGET, "chunks", "react-dom.js");
    fs.appendFileSync(chunk, "\n/* planted */\n");
    const lock = JSON.parse(fs.readFileSync(path.join(root, LOCK), "utf8"));
    lock.files["chunks/react-dom.js"] = crypto.createHash("sha256").update(fs.readFileSync(chunk)).digest("hex");
    fs.writeFileSync(path.join(root, LOCK), `${JSON.stringify(lock, null, 2)}\n`);
    assert.deepEqual(verifyVendored(root), [
      `${LOCK} lists other files or hashes than SVELTIA.files in scripts/vendor-sveltia.mjs; new vendored bytes need both pins changed`,
      `${TARGET}/chunks/react-dom.js differs from the vendored release`,
    ]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the configuration schema comes from the same verified tarball, once, with the pinned hash", () => {
  const schema = { name: "package/schema/sveltia-cms.json", body: Buffer.from('{"$schema":"http://json-schema.org/draft-07/schema#"}') };
  const tgz = tarball([BUNDLE, schema]);
  const hash = crypto.createHash("sha256").update(schema.body).digest("hex");
  assert.equal(extractSchema(tgz, { ...pinFor(tgz), schema: hash }).toString(), schema.body.toString());
  assert.throws(() => extractSchema(tgz, { ...pinFor(tgz), schema: "0".repeat(64) }), /differs from the hash pinned in scripts\/vendor-sveltia\.mjs \(SVELTIA\.schema\)/);
  assert.throws(() => extractSchema(tgz), /^Error: Integrity mismatch/, "only from the pinned tarball");
  const without = tarball([BUNDLE]);
  assert.throws(() => extractSchema(without, pinFor(without)), /must hold package\/schema\/sveltia-cms\.json once/);
  const twice = tarball([BUNDLE, schema, schema]);
  assert.throws(() => extractSchema(twice, pinFor(twice)), /once, as a regular file \(found 2\)/);
  assert.equal(extractVendored(tgz, pinFor(tgz)).size, 1, "the schema is not a vendored /admin/ file");
});

test("a changed schema file, or a lock without its hash, fails the vendor check", () => {
  const root = tempDir();
  try {
    fs.mkdirSync(path.join(root, "scripts"));
    fs.copyFileSync(LOCK, path.join(root, LOCK));
    fs.cpSync(TARGET, path.join(root, TARGET), { recursive: true });
    assert.deepEqual(verifyVendored(root), [`missing ${SCHEMA_FILE}; run npm run cms:vendor`]);
    fs.writeFileSync(path.join(root, SCHEMA_FILE), "{}");
    assert.deepEqual(verifyVendored(root), [`${SCHEMA_FILE} differs from the vendored release's schema`]);
    fs.copyFileSync(SCHEMA_FILE, path.join(root, SCHEMA_FILE));
    const lock = JSON.parse(fs.readFileSync(path.join(root, LOCK), "utf8"));
    delete lock.schema;
    fs.writeFileSync(path.join(root, LOCK), `${JSON.stringify(lock, null, 2)}\n`);
    assert.deepEqual(verifyVendored(root), [`${LOCK} lists another schema hash than SVELTIA.schema in scripts/vendor-sveltia.mjs; a new schema needs both pins changed`]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the site stylesheet does not take class names from the vendored CMS or the editable copy", () => {
  // Tailwind's source detection would otherwise add utilities named in the 2 MB bundle, a CMS edit,
  // the release's configuration schema or the docs to the site CSS. source("..") (relative to
  // src/app/globals.css) limits it to src/, which holds none of them.
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /^@import "tailwindcss" source\("\.\."\);\r?$/m);
  assert.doesNotMatch(css, /^@source\b/m, "no @source line widens the scan beyond src/");
});

test("the admin page loads only the vendored bundle and is never indexed", () => {
  const html = fs.readFileSync("public/admin/index.html", "utf8");
  assert.deepEqual([...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]), ['<script src="/admin/sveltia/sveltia-cms.js">'], "one external script, no inline code");
  assert.match(html, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.match(html, /<link rel="cms-config-url" type="application\/yaml" href="\/admin\/config\.yml" \/>/);
  assert.doesNotMatch(html, /https?:\/\//, "no third-party address in the page");
});

// Mirrors the Cloudflare _headers format: "/path" lines open a rule, "  Name: value" sets, "  ! Name" removes.
function headerRules(text) {
  const rules = new Map();
  let rule = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rule = { set: {}, unset: [] };
      rules.set(line.trim(), rule);
    } else if (line.trim().startsWith("! ")) rule.unset.push(line.trim().slice(2).toLowerCase());
    else {
      const [, name, value] = line.trim().match(/^([^:]+):\s*(.+)$/);
      rule.set[name.trim().toLowerCase()] = value.trim();
    }
  }
  return rules;
}
const directives = (csp) => Object.fromEntries(csp.split(";").map((part) => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));

test("/admin/* swaps the site CSP for its own scoped policy and is noindex", () => {
  const rules = headerRules(fs.readFileSync("public/_headers", "utf8"));
  const paths = [...rules.keys()];
  assert.ok(rules.has("/admin/*") && paths.indexOf("/*") < paths.indexOf("/admin/*"), "the admin rule comes after /* so its removals apply");
  const admin = rules.get("/admin/*");
  assert.deepEqual(admin.unset.sort(), ["content-security-policy", "x-robots-tag"]);
  assert.equal(admin.set["x-robots-tag"], "noindex, nofollow");
  const csp = directives(admin.set["content-security-policy"]);
  assert.deepEqual(csp["script-src"], ["'self'"], "only the vendored bundle: no inline code, no eval, no CDN");
  // Task 10 review: the three font files the vendored bundle names, exactly, rather than a folder.
  const bundleFonts = [...new Set(fs.readFileSync("public/admin/sveltia/sveltia-cms.js", "utf8").match(/https:\/\/cdn\.jsdelivr\.net\/fontsource\/[^"'`\s)]+/g))].sort();
  assert.equal(bundleFonts.length, 3, `the bundle's UI and icon fonts (${bundleFonts.join(", ")})`);
  assert.deepEqual(csp["font-src"], ["'self'", ...bundleFonts], "font-src names exactly the bundle's font files; after a Sveltia upgrade, copy its font URLs into public/_headers and ADMIN_FONTS");
  assert.deepEqual(ADMIN_FONTS, bundleFonts);
  assert.equal(admin.set["content-security-policy"], ADMIN_CSP, "public/_headers carries the pinned ADMIN_CSP (scripts/lib/headers.mjs)");
  assert.deepEqual(csp["connect-src"], ["'self'", "blob:", "data:", "https://api.github.com", "https://www.githubstatus.com"], "the GitHub API and status check, no CDN");
  assert.deepEqual(csp["img-src"], ["'self'", "data:", "blob:", "https://avatars.githubusercontent.com"], "and the editors' GitHub avatars");
  assert.deepEqual(csp["form-action"], ["'self'"], "sign-in runs in a popup, not through a form");
  for (const [name, values] of Object.entries(csp)) assert.ok(!values.some((value) => /unpkg\.com|'unsafe-eval'|^\*$|^https:$/.test(value)), `${name} allows no CDN code, eval or wildcard`);
  assert.deepEqual([csp["object-src"], csp["frame-ancestors"], csp["base-uri"]], [["'none'"], ["'none'"], ["'self'"]]);
});

test("the GitHub origins in the admin CSP are the ones the vendored bundle uses, and no others", () => {
  const bundle = fs.readFileSync("public/admin/sveltia/sveltia-cms.js", "utf8");
  // The github backend's API root (REST at the root, GraphQL at /graphql, file contents as blobs
  // through /repos/…/git/blobs) and its status check, by their exact text in 0.230.1.
  assert.ok(bundle.includes("jR=`https://api.github.com`"), "the default api_root");
  assert.ok(bundle.includes("/repos/${e}/${t}/git/blobs/${n}"), "file contents come from the API as blobs");
  assert.ok(bundle.includes("`https://www.githubstatus.com/api/v2/status.json`"), "the status check");
  assert.ok(bundle.includes("avatarURL:i.avatar_url"), "the signed-in editor's avatar, from GET /user");
  for (const host of ["raw.githubusercontent.com", "uploads.github.com", "objects.githubusercontent.com", "codeload.github.com", "avatars.githubusercontent.com"]) {
    assert.ok(!bundle.includes(host), `the bundle names no ${host} (the avatar host comes from GET /user, not from the bundle)`);
  }
  assert.deepEqual(ADMIN_GITHUB_CONNECT, ["https://api.github.com", "https://www.githubstatus.com"]);
  assert.deepEqual(ADMIN_GITHUB_IMAGES, ["https://avatars.githubusercontent.com"]);
});

test("the site CSP gains nothing from the CMS", () => {
  const site = headerRules(fs.readFileSync("public/_headers", "utf8")).get("/*").set["content-security-policy"];
  assert.doesNotMatch(site, /jsdelivr|unpkg|github|'unsafe-eval'/);
});

test("/uploads/* serves every upload as a sandboxed image that is never sniffed (controller amendment)", () => {
  const rules = headerRules(fs.readFileSync("public/_headers", "utf8"));
  const paths = [...rules.keys()];
  assert.ok(rules.has("/uploads/*") && paths.indexOf("/*") < paths.indexOf("/uploads/*"), "the uploads rule comes after /* so its removals apply");
  const uploads = rules.get("/uploads/*");
  assert.deepEqual(uploads.unset.sort(), ["content-security-policy", "x-content-type-options"], "it replaces the site CSP, and sets nosniff again without doubling it");
  assert.equal(uploads.set["content-security-policy"], "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  assert.equal(uploads.set["x-content-type-options"], "nosniff");
  assert.deepEqual(Object.keys(uploads.set).sort(), ["content-security-policy", "x-content-type-options"]);
});
