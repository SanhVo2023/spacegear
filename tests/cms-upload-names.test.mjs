// What Sveltia CMS names an upload, with public/admin/config.yml, against the names the build
// accepts (UPLOAD_PATH). This runs the vendored bundle's own naming code (tests/helpers/sveltia-names.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { load } from "js-yaml";
import { loadSveltiaNames } from "./helpers/sveltia-names.mjs";
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

test("entry file names follow the same slug rules", () => {
  assert.equal(english.slug(config, "Do you work with existing AI vendors?"), "do-you-work-with-existing-ai-vendors");
  assert.equal(english.slug(config, "Tư vấn chuyển đổi số"), "tu-van-chuyen-doi-so");
});
