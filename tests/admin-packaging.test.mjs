// Task 10: how /admin/ is packaged and checked again in dist/ (scripts/lib/admin.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ADMIN_FILES, adminProblems, shipAdmin } from "../scripts/lib/admin.mjs";
import { SVELTIA } from "../scripts/vendor-sveltia.mjs";

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-admin-"));

/** A copy of public/admin/ to plant things in. */
function adminCopy() {
  const root = tempDir();
  fs.cpSync("public/admin", path.join(root, "admin"), { recursive: true });
  return { root, admin: path.join(root, "admin") };
}

test("/admin/ ships exactly its page, its configuration and the pinned Sveltia files", async () => {
  assert.deepEqual(ADMIN_FILES, ["config.yml", "index.html", ...Object.keys(SVELTIA.files).map((file) => `sveltia/${file}`).sort()]);
  assert.equal(ADMIN_FILES.length, 5);
  assert.deepEqual(adminProblems("public/admin"), []);
  const { root, admin } = adminCopy();
  try {
    fs.writeFileSync(path.join(admin, ".DS_Store"), "x");
    const to = path.join(root, "dist", "admin");
    fs.mkdirSync(path.join(to, "old"), { recursive: true });
    fs.writeFileSync(path.join(to, "old", "stale.html"), "x");
    assert.deepEqual(await shipAdmin(admin, to), ADMIN_FILES);
    const shipped = fs.readdirSync(to, { recursive: true }).map((rel) => rel.replaceAll("\\", "/")).filter((rel) => fs.statSync(path.join(to, rel)).isFile()).sort();
    assert.deepEqual(shipped, ADMIN_FILES, "no stale file, no dotfile");
    for (const rel of ADMIN_FILES) assert.ok(fs.readFileSync(path.join(to, rel)).equals(fs.readFileSync(path.join("public/admin", rel))), rel);
    assert.deepEqual(adminProblems(to, { label: "dist/admin", reference: "public/admin" }), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("packaging refuses an /admin/ folder with an unexpected file, a link or a changed vendored byte", async () => {
  const plants = [
    ["an extra page", (admin) => fs.writeFileSync(path.join(admin, "debug.html"), "<script>alert(1)</script>"), /admin\/debug\.html: is not part of \/admin\/ \(only config\.yml, index\.html, sveltia\/LICENSE\.txt, sveltia\/chunks\/react-dom\.js, sveltia\/sveltia-cms\.js ship\): remove it$/],
    ["an extra chunk", (admin) => fs.writeFileSync(path.join(admin, "sveltia", "chunks", "git.js"), "x"), /admin\/sveltia\/chunks\/git\.js: is not part of \/admin\//],
    ["a source map", (admin) => fs.writeFileSync(path.join(admin, "sveltia", "sveltia-cms.js.map"), "{}"), /admin\/sveltia\/sveltia-cms\.js\.map: is not part of \/admin\//],
    ["a changed byte", (admin) => { const file = path.join(admin, "sveltia", "chunks", "react-dom.js"); const data = fs.readFileSync(file); data[100] ^= 1; fs.writeFileSync(file, data); }, /admin\/sveltia\/chunks\/react-dom\.js: differs from the pinned @sveltia\/cms@0\.230\.1 \(SVELTIA\.files in scripts\/vendor-sveltia\.mjs\)$/],
    ["a missing file", (admin) => fs.rmSync(path.join(admin, "sveltia", "LICENSE.txt")), /admin\/sveltia\/LICENSE\.txt: is missing$/],
    ["a linked folder", (admin, root) => { fs.mkdirSync(path.join(root, "elsewhere")); fs.writeFileSync(path.join(root, "elsewhere", "x.js"), "x"); fs.symlinkSync(path.join(root, "elsewhere"), path.join(admin, "extra"), "junction"); }, /admin\/extra: is a link \(symbolic link or junction\); \/admin\/ ships regular files only$/],
    ["a dot-named link", (admin, root) => { fs.mkdirSync(path.join(root, "elsewhere")); fs.symlinkSync(path.join(root, "elsewhere"), path.join(admin, ".hidden"), "junction"); }, /admin\/\.hidden: is a link/],
    ["a hard link", (admin, root) => { fs.rmSync(path.join(admin, "config.yml")); fs.copyFileSync("public/admin/config.yml", path.join(root, "config.yml")); fs.linkSync(path.join(root, "config.yml"), path.join(admin, "config.yml")); }, /admin\/config\.yml: is one file with 2 names \(hard links\)/],
    ["an inline script", (admin) => fs.writeFileSync(path.join(admin, "index.html"), fs.readFileSync(path.join(admin, "index.html"), "utf8").replace("</body>", "<script>alert(1)</script></body>")), /admin\/index\.html: must not use inline scripts/],
    ["no robots meta", (admin) => fs.writeFileSync(path.join(admin, "index.html"), fs.readFileSync(path.join(admin, "index.html"), "utf8").replace(/<meta name="robots"[^>]*>/, "")), /admin\/index\.html: must carry a robots noindex meta tag/],
  ];
  for (const [name, plant, expected] of plants) {
    const { root, admin } = adminCopy();
    try {
      plant(admin, root);
      const to = path.join(root, "dist", "admin");
      await assert.rejects(shipAdmin(admin, to, { label: "public/admin" }), (error) => expected.test(error.message) && /^Refusing to ship \/admin\//.test(error.message), name);
      assert.equal(fs.existsSync(to), false, `${name}: nothing is shipped`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test("a linked folder inside /admin/ is the one problem named, not the files it hides", () => {
  const { root, admin } = adminCopy();
  try {
    fs.renameSync(path.join(admin, "sveltia"), path.join(root, "sveltia-elsewhere"));
    fs.symlinkSync(path.join(root, "sveltia-elsewhere"), path.join(admin, "sveltia"), "junction");
    assert.deepEqual(adminProblems(admin, { label: "public/admin" }), ["public/admin/sveltia: is a link (symbolic link or junction); /admin/ ships regular files only"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a file symlink in /admin/ is refused too", async (t) => {
  const { root, admin } = adminCopy();
  try {
    fs.rmSync(path.join(admin, "config.yml"));
    try {
      fs.symlinkSync(path.resolve("public/admin/config.yml"), path.join(admin, "config.yml"), "file");
    } catch (error) {
      if (error.code === "EPERM") return t.skip("file symlinks need developer mode on Windows");
      throw error;
    }
    assert.match(adminProblems(admin).join("\n"), /admin\/config\.yml: is a link/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("check-export's view of dist/admin/: changed pages and hidden files are refused", () => {
  const { root, admin } = adminCopy();
  try {
    assert.deepEqual(adminProblems(admin, { label: "dist/admin", reference: "public/admin" }), []);
    fs.appendFileSync(path.join(admin, "config.yml"), "\n# planted\n");
    fs.writeFileSync(path.join(admin, ".env"), "SECRET=1");
    fs.mkdirSync(path.join(admin, ".well-known"));
    fs.writeFileSync(path.join(admin, ".well-known", "x.html"), "x");
    const problems = adminProblems(admin, { label: "dist/admin", reference: "public/admin" });
    assert.deepEqual(problems, [
      "dist/admin/.env: is hidden (a dotfile or inside a dot-folder), and nothing hidden may ship: remove it",
      "dist/admin/.well-known/x.html: is hidden (a dotfile or inside a dot-folder), and nothing hidden may ship: remove it",
      "dist/admin/config.yml: differs from public/admin/config.yml",
    ]);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(admin, "sveltia", "sveltia-cms.js"))).digest("hex");
    assert.equal(hash, SVELTIA.files["sveltia-cms.js"], "the vendored bundle is compared with the pin itself");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
