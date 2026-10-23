// What Sveltia CMS names an upload, with public/admin/config.yml, against the names the build
// accepts (UPLOAD_PATH). This runs the vendored bundle's own naming code (tests/helpers/sveltia-names.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { load } from "js-yaml";
import { BUNDLE, PENDING_UPLOAD, loadSveltiaNames } from "./helpers/sveltia-names.mjs";
import { UPLOAD_PATH } from "../scripts/lib/uploads.mjs";

const config = load(fs.readFileSync("public/admin/config.yml", "utf8"));
const english = loadSveltiaNames();
const turkish = loadSveltiaNames({ locale: "tr" });
const name = (original, options) => english.uploadName(config, original, options);

test("everyday names become lowercase ASCII names that the build accepts, as WebP unless they are GIF or WebP", () => {
  const cases = {
    "Banner 1280.png": "banner-1280.webp",
    "Ảnh đẹp.JPG": "anh-dep.webp",
    "Đà Lạt.jpeg": "da-lat.webp",
    "résumé (final).webp": "resume-final.webp",
    "IMG_0042.JPG": "img_0042.webp",
    "Straße Ølsen.png": "strasse-olsen.webp",
    "chart.avif": "chart.webp",
    "loading spinner.gif": "loading-spinner.gif",
    "my photo (1).webp": "my-photo-1.webp",
    "a.b.c.png": "a-b-c.webp",
  };
  for (const [original, expected] of Object.entries(cases)) {
    assert.equal(name(original), expected, original);
    assert.ok(UPLOAD_PATH.test(expected), `${expected} is a name the build accepts`);
  }
  // A name with no letters the slug rules can keep becomes a random 12-character id.
  for (const original of ["日本語.png", "😀.jpg", "Ｆｕｌｌ.png"]) assert.match(name(original), /^[0-9a-f]{12}\.webp$/, original);
  assert.equal(name(`${"x".repeat(80)}.png`), `${"x".repeat(60)}.webp`, "names are cut to 60 characters");
});

test("a name that is already taken gets a number, so an upload never replaces another file by accident", () => {
  assert.equal(name("Photo.jpg", { taken: ["photo.webp"] }), "photo-1.webp");
  assert.equal(name("photo.webp", { taken: ["photo.webp", "photo-1.webp"] }), "photo-2.webp");
});

test("the names the CMS lets through that the build refuses: ~ is kept, and a Turkish browser writes a dotless ı", () => {
  assert.equal(name("scan~2.jpg"), "scan~2.webp");
  assert.equal(UPLOAD_PATH.test("scan~2.webp"), false);
  assert.equal(turkish.uploadName(config, "IMG_0042.JPG"), "ımg_0042.webp");
  assert.equal(UPLOAD_PATH.test("ımg_0042.webp"), false);
  assert.equal(turkish.uploadName(config, "photo.jpg"), "photo.webp", "only a capital I changes");
});

test("a Windows device name cannot be uploaded at all: Sveltia empties it and then fails to name the file", () => {
  // The error comes from the vm context, so it is matched by name, not by class.
  for (const original of ["con.png", "COM1.jpg", "nul.webp"]) assert.throws(() => name(original), { name: "TypeError" }, original);
  assert.equal(name("console.png"), "console.webp", "a longer name that starts like one is fine");
});

/** Every image field's pattern in the configuration ([source, message]), aliases resolved by the YAML loader. */
function imagePatterns(node, found = []) {
  if (Array.isArray(node)) for (const item of node) imagePatterns(item, found);
  else if (node && typeof node === "object") {
    if (node.widget === "image") found.push(node.pattern);
    for (const value of Object.values(node)) imagePatterns(value, found);
  }
  return found;
}

// While an upload is pending, Sveltia 0.230.1 tests an image field's pattern against the name the media library
// gave the new file (ZQ: files[blobURL].file.name, set by K2 after AY renamed and re-encoded it), with no
// /uploads/ folder yet. The field must accept that name exactly when the build accepts it under /uploads/.
test("while an upload is pending, every image field accepts the new file's name exactly when the build accepts it", () => {
  const bundle = fs.readFileSync(BUNDLE, "utf8");
  for (const code of PENDING_UPLOAD) assert.equal(bundle.split(code).length - 1, 1, `the bundle still tests a pending upload's name: ${code}`);
  const patterns = imagePatterns(config.collections);
  assert.equal(patterns.length, 8, "the image fields");
  const originals = [
    "photo.jpg", "team-photo.webp", "Team Photo.JPG", "IMG_0042.JPG", "Ảnh đẹp.JPG", "Banner 1280.png", "résumé (final).webp", "chart.avif",
    "loading spinner.gif", "a.b.c.png", "console.png", "logo.svg", "Logo.SVG", "scan~2.jpg", "notes.txt",
  ];
  for (const original of originals) {
    const uploaded = name(original);
    for (const pattern of patterns) assert.equal(english.fieldAccepts(pattern, uploaded), UPLOAD_PATH.test(uploaded), `${original} (uploaded as ${uploaded})`);
  }
  // Everyday names pass while the upload is pending; an SVG and a ~ are refused before anything is saved.
  for (const original of ["photo.jpg", "team-photo.webp", "Team Photo.JPG", "IMG_0042.JPG", "Ảnh đẹp.JPG", "loading spinner.gif"]) {
    for (const pattern of patterns) assert.ok(english.fieldAccepts(pattern, name(original)), `${original} can be uploaded into an image field`);
  }
  for (const original of ["logo.svg", "Logo.SVG", "scan~2.jpg"]) {
    for (const pattern of patterns) assert.equal(english.fieldAccepts(pattern, name(original)), false, `${original} is refused in an image field`);
  }
  // A Turkish browser's dotless ı is refused while the upload is pending, too.
  for (const pattern of patterns) assert.equal(turkish.fieldAccepts(pattern, turkish.uploadName(config, "IMG_0042.JPG")), false);
});

test("entry file names follow the same slug rules", () => {
  assert.equal(english.slug(config, "Do you work with existing AI vendors?"), "do-you-work-with-existing-ai-vendors");
  assert.equal(english.slug(config, "Tư vấn chuyển đổi số"), "tu-van-chuyen-doi-so");
});
