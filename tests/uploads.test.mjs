// CMS uploads (public/uploads/): the -640/-1280 WebP variant step, the rules for what may sit
// in the folder and ship, the content image checks and the contentImage() srcset helper.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import sharp from "sharp";
import { buildUploadVariants, variantFile, WIDTHS } from "../scripts/build-upload-variants.mjs";
import { imageReferenceProblems, missingImageFiles, referencedImages } from "../scripts/lib/content-assets.mjs";
import { RASTER, UPLOAD_EXTENSIONS, UPLOAD_PATH, VARIANT, shipUploads, uploadProblems } from "../scripts/lib/uploads.mjs";

const { contentImage, UPLOAD_WIDTHS } = await import("../src/lib/content-images.ts");
const { IMAGE } = await import("../src/lib/content-schema.ts");

// libvips keeps recently used files open, which blocks deleting them on Windows.
sharp.cache(false);
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-uploads-"));
const remove = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
const solid = (width, height, background = "#fa6e43") => sharp({ create: { width, height, channels: 3, background } });
const meta = (file) => sharp(file).metadata();
const listAll = (dir) => fs.readdirSync(dir, { recursive: true }).map((name) => name.replaceAll("\\", "/")).sort();

/** A PNG chunk with its CRC, for hand-made headers. */
function pngChunk(type, data = Buffer.alloc(0)) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
}
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** A small PNG whose header claims width x height pixels: a decompression bomb's shape. */
function pngHeaderClaiming(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(Buffer.alloc(1024))), pngChunk("IEND")]);
}
/** Creates a file symlink, or returns false where the OS does not allow it (Windows without developer mode). */
function trySymlink(target, link) {
  try {
    fs.symlinkSync(target, link, "file");
    return true;
  } catch (error) {
    if (error.code === "EPERM") return false;
    throw error;
  }
}

test("each upload gets WebP variants at 640 and 1280 px, never wider than the original", async () => {
  const dir = tempDir();
  try {
    await solid(2000, 1000).jpeg().toFile(path.join(dir, "wide.jpg"));
    await solid(900, 900).png().toFile(path.join(dir, "small.png"));
    const result = await buildUploadVariants(dir);
    assert.deepEqual(result.errors, []);
    assert.equal(result.written.length, 4);
    const width = async (file) => (await meta(path.join(dir, file))).width;
    assert.equal(await width("wide-640.webp"), 640);
    assert.equal(await width("wide-1280.webp"), 1280);
    assert.equal(await width("small-640.webp"), 640);
    assert.equal(await width("small-1280.webp"), 900, "no upscaling");
    assert.equal((await meta(path.join(dir, "wide-1280.webp"))).format, "webp");
    assert.deepEqual(listAll(dir), ["small-1280.webp", "small-640.webp", "small.png", "wide-1280.webp", "wide-640.webp", "wide.jpg"], "no temporary file is left behind");
  } finally { remove(dir); }
});

test("a second run skips up-to-date variants and rewrites only those older than their original", async () => {
  const dir = tempDir();
  try {
    const original = path.join(dir, "photo.webp");
    await solid(1600, 900).webp().toFile(original);
    await buildUploadVariants(dir);
    const again = await buildUploadVariants(dir);
    assert.deepEqual([again.written.length, again.upToDate.length], [0, 2]);
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(original, later, later);
    const touched = await buildUploadVariants(dir);
    assert.deepEqual([touched.written.length, touched.upToDate.length], [2, 0]);
  } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
});

test("a variant carries its original's modification time, so an original replaced by an older file is rebuilt too", async () => {
  const dir = tempDir();
  try {
    const original = path.join(dir, "photo.jpg");
    await solid(1600, 900).jpeg().toFile(original);
    await buildUploadVariants(dir);
    const source = fs.statSync(original).mtimeMs;
    for (const width of WIDTHS) assert.ok(Math.abs(fs.statSync(variantFile(original, width)).mtimeMs - source) < 1, `${width}: stamped with the original's time`);
    // The editor copies in a different photo that keeps an older modification time (cp -p, unzip).
    await solid(700, 700, "#123456").jpeg().toFile(original);
    const older = new Date(source - 60_000);
    fs.utimesSync(original, older, older);
    const replaced = await buildUploadVariants(dir);
    assert.deepEqual([replaced.written.length, replaced.upToDate.length], [2, 0]);
    assert.equal((await meta(variantFile(original, 1280))).width, 700, "the variant shows the new photo");
  } finally { remove(dir); }
});

test("dotfiles are ignored, stale variants are reported and colliding names are refused", async () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, ".gitkeep"), "");
    fs.writeFileSync(path.join(dir, ".sveltia-tmp-123"), "partial");
    await solid(800, 600).webp().toFile(path.join(dir, "gone-640.webp"));
    const stale = await buildUploadVariants(dir);
    assert.deepEqual([stale.originals, stale.written.length, stale.stale.map((file) => path.basename(file))], [0, 0, ["gone-640.webp"]]);
    await solid(800, 600).jpeg().toFile(path.join(dir, "team.jpg"));
    await solid(800, 600).png().toFile(path.join(dir, "team.png"));
    const clash = await buildUploadVariants(dir);
    assert.equal(clash.errors.length, 1);
    assert.match(clash.errors[0], /share a name/);
    assert.equal(fs.existsSync(path.join(dir, "team-640.webp")), false, "nothing is written while names collide");
  } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
});

test("an upload named like a variant is never an original, never processed and never deleted", async () => {
  const dir = tempDir();
  try {
    const upload = path.join(dir, "banner-1280.webp");
    await solid(300, 200).webp().toFile(upload);
    const before = fs.readFileSync(upload);
    const result = await buildUploadVariants(dir);
    assert.deepEqual([result.originals, result.written, result.errors], [0, [], []]);
    assert.deepEqual(result.stale, [upload], "reported, so the editor can rename or delete it");
    assert.deepEqual(fs.readFileSync(upload), before, "left exactly as it was");
    assert.deepEqual(listAll(dir), ["banner-1280.webp"], "no banner-1280-640.webp and the like");
  } finally { remove(dir); }
});

test("a missing uploads folder is not an error", async () => {
  const result = await buildUploadVariants(path.join(os.tmpdir(), "spacegear-no-such-folder"));
  assert.deepEqual([result.originals, result.errors], [0, []]);
});

test("EXIF orientation is applied, so a rotated phone photo is not sideways", async () => {
  const dir = tempDir();
  try {
    // Stored 1600 x 800, displayed 800 x 1600 (orientation 6: rotate 90 degrees clockwise).
    await solid(1600, 800).jpeg().withMetadata({ orientation: 6 }).toFile(path.join(dir, "phone.jpg"));
    const result = await buildUploadVariants(dir);
    assert.deepEqual(result.errors, []);
    const small = await meta(path.join(dir, "phone-640.webp"));
    assert.deepEqual([small.width, small.height, small.orientation], [640, 1280, undefined]);
    const large = await meta(path.join(dir, "phone-1280.webp"));
    assert.deepEqual([large.width, large.height], [800, 1600], "upright, and never wider than the displayed original");
  } finally { remove(dir); }
});

test("colours are converted to sRGB (Display P3 and CMYK originals) and no profile is kept", async () => {
  const dir = tempDir();
  try {
    const colour = { r: 200, g: 100, b: 50 };
    await sharp({ create: { width: 64, height: 64, channels: 3, background: colour } }).withIccProfile("p3").png().toFile(path.join(dir, "wide-gamut.png"));
    const stored = await sharp(path.join(dir, "wide-gamut.png"), { ignoreIcc: true }).raw().toBuffer();
    assert.ok(Math.abs(stored[0] - colour.r) > 5, "the original stores P3 numbers, not sRGB ones");
    await sharp({ create: { width: 64, height: 64, channels: 3, background: colour } }).toColourspace("cmyk").jpeg().toFile(path.join(dir, "print.jpg"));
    assert.equal((await meta(path.join(dir, "print.jpg"))).space, "cmyk");
    assert.deepEqual((await buildUploadVariants(dir)).errors, []);
    // P3 converts back almost exactly; CMYK round trips lose a little more.
    for (const [name, tolerance] of [["wide-gamut-640.webp", 4], ["print-640.webp", 18]]) {
      const file = path.join(dir, name);
      const info = await meta(file);
      assert.deepEqual([info.space, info.icc, info.channels], ["srgb", undefined, 3], name);
      const [r, g, b] = await sharp(file, { ignoreIcc: true }).raw().toBuffer();
      for (const [got, want] of [[r, colour.r], [g, colour.g], [b, colour.b]]) assert.ok(Math.abs(got - want) <= tolerance, `${name}: ${[r, g, b]} is close to ${Object.values(colour)}`);
    }
  } finally { remove(dir); }
});

test("animated GIFs ship as they are (no variants); animated WebP variants keep every frame", async () => {
  const dir = tempDir();
  try {
    const frames = await Promise.all(["#ff0000", "#00ff00", "#0000ff"].map((colour) => solid(1600, 900, colour).raw().toBuffer()));
    const animation = () => sharp(Buffer.concat(frames), { raw: { width: 1600, height: 2700, channels: 3, pageHeight: 900 } });
    await animation().gif({ loop: 0, delay: [100, 100, 100] }).toFile(path.join(dir, "loop.gif"));
    await animation().webp({ loop: 0, delay: [100, 100, 100] }).toFile(path.join(dir, "spin.webp"));
    const result = await buildUploadVariants(dir);
    assert.deepEqual([result.errors, result.originals, result.stale], [[], 1, []]);
    assert.deepEqual(listAll(dir), ["loop.gif", "spin-1280.webp", "spin-640.webp", "spin.webp"], "the GIF gets no variants");
    for (const [name, width] of [["spin-640.webp", 640], ["spin-1280.webp", 1280]]) {
      const info = await meta(path.join(dir, name));
      assert.deepEqual([info.pages, info.width, info.pageHeight ?? info.height], [3, width, (width * 900) / 1600], name);
    }
    assert.deepEqual(contentImage("/uploads/loop.gif"), { src: "/uploads/loop.gif" }, "and renders from the original");
    // Every frame counts towards the size limit.
    for (const width of WIDTHS) fs.rmSync(variantFile(path.join(dir, "spin.webp"), width));
    const limited = await buildUploadVariants(dir, { maxPixels: 2_000_000 });
    assert.match(limited.errors.join("\n"), /spin\.webp: 4\.3 MP \(1600 x 900 px, 3 frames\) is over the 2\.0 MP limit/);
  } finally { remove(dir); }
});

test("animated PNG and AVIF sequences are refused: their variants would be still images", async () => {
  const dir = tempDir();
  try {
    const png = await solid(400, 300).png().toBuffer();
    const actl = Buffer.alloc(8);
    actl.writeUInt32BE(2, 0); // frames
    fs.writeFileSync(path.join(dir, "blink.png"), Buffer.concat([png.subarray(0, 33), pngChunk("acTL", actl), png.subarray(33)]));
    const ftyp = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypavis\0\0\0\0avismsf1", "latin1")]);
    fs.writeFileSync(path.join(dir, "clip.avif"), Buffer.concat([ftyp, Buffer.alloc(64)]));
    const result = await buildUploadVariants(dir);
    assert.equal(result.errors.length, 2, result.errors.join("\n"));
    assert.match(result.errors.find((error) => error.includes("blink.png")), /animated PNG.*upload an animated WebP or a GIF/);
    assert.match(result.errors.find((error) => error.includes("clip.avif")), /animated AVIF.*upload an animated WebP or a GIF/);
    assert.deepEqual(listAll(dir), ["blink.png", "clip.avif"]);
  } finally { remove(dir); }
});

test("a huge or decompression-bomb image is a content error, not a crash", async () => {
  const dir = tempDir();
  try {
    // 900 megapixels claimed by a 1 KB file: refused from its header, before anything is decoded.
    fs.writeFileSync(path.join(dir, "bomb.png"), pngHeaderClaiming(30_000, 30_000));
    await solid(1200, 1000).jpeg().toFile(path.join(dir, "fine.jpg"));
    const result = await buildUploadVariants(dir);
    assert.equal(result.errors.length, 1, result.errors.join("\n"));
    assert.match(result.errors[0], /bomb\.png: 900\.0 MP \(30000 x 30000 px\) is over the 268\.4 MP limit for uploads; resize it before uploading/);
    assert.equal(result.written.length, 2, "the other upload still gets its variants");
    // The limit can be lowered (tests, small machines); sharp enforces it while decoding too.
    // Up-to-date variants are not looked at again, so remove them first.
    for (const width of WIDTHS) fs.rmSync(variantFile(path.join(dir, "fine.jpg"), width));
    const lowered = await buildUploadVariants(dir, { maxPixels: 1_000_000 });
    assert.ok(lowered.errors.some((error) => /fine\.jpg: 1\.2 MP \(1200 x 1000 px\) is over the 1\.0 MP limit/.test(error)), lowered.errors.join("\n"));
  } finally { remove(dir); }
});

test("a file that is not a readable image is a content error; the other uploads still get variants", async () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, "page.jpg"), "<!doctype html><script>alert(1)</script>");
    fs.writeFileSync(path.join(dir, "cut.png"), (await solid(800, 600).png().toBuffer()).subarray(0, 200));
    await solid(800, 600).webp().toFile(path.join(dir, "ok.webp"));
    const result = await buildUploadVariants(dir);
    assert.equal(result.errors.length, 2, result.errors.join("\n"));
    for (const name of ["page.jpg", "cut.png"]) assert.match(result.errors.find((error) => error.includes(name)), /cannot be read as an image \(.+\); export it again as WebP, PNG, JPEG or AVIF/);
    assert.deepEqual(listAll(dir), ["cut.png", "ok-1280.webp", "ok-640.webp", "ok.webp", "page.jpg"], "no partial or temporary variant is left");
  } finally { remove(dir); }
});

test("links in the uploads folder are refused and never followed", async () => {
  const root = tempDir();
  try {
    const outside = path.join(root, "outside");
    const uploads = path.join(root, "uploads");
    fs.mkdirSync(outside);
    fs.mkdirSync(uploads);
    await solid(800, 600).jpeg().toFile(path.join(outside, "secret.jpg"));
    // A directory junction (Windows) or symlink (elsewhere) to a folder outside uploads/.
    fs.symlinkSync(outside, path.join(uploads, "linked"), "junction");
    fs.symlinkSync(outside, path.join(uploads, ".hidden-link"), "junction");
    const fileLink = trySymlink(path.join(outside, "secret.jpg"), path.join(uploads, "photo.jpg"));
    const result = await buildUploadVariants(uploads);
    const expected = ["linked", ".hidden-link", ...(fileLink ? ["photo.jpg"] : [])];
    assert.equal(result.errors.length, expected.length, result.errors.join("\n"));
    for (const name of expected) assert.ok(result.errors.some((error) => error.includes(path.join(uploads, name)) && /is a link/.test(error)), `${name}\n${result.errors.join("\n")}`);
    assert.deepEqual(result.written, []);
    assert.deepEqual(fs.readdirSync(outside), ["secret.jpg"], "nothing is written through the link");
    // The uploads folder itself may not be a link either.
    fs.symlinkSync(outside, path.join(root, "uploads-link"), "junction");
    const linkedFolder = await buildUploadVariants(path.join(root, "uploads-link"));
    assert.match(linkedFolder.errors.join("\n"), /uploads-link: is a link/);
    assert.deepEqual(fs.readdirSync(outside), ["secret.jpg"]);
  } finally { remove(root); }
});

test("odd names (dots, spaces, capitals, non-ASCII) are left alone and nothing is written outside the folder", async () => {
  const root = tempDir();
  try {
    const uploads = path.join(root, "uploads");
    fs.mkdirSync(uploads);
    const names = ["a..b.jpg", "Photo.JPG", "with space.png", "café.jpg", "x[shrink=8].jpg", "rtl‮gpj.png", "..jpg"];
    for (const name of names) await solid(700, 500).jpeg().toFile(path.join(uploads, name));
    const result = await buildUploadVariants(uploads);
    assert.deepEqual([result.originals, result.written, result.errors], [0, [], []], "the site cannot reference these names, so they get no variants");
    assert.deepEqual(listAll(uploads), [...names].sort());
    assert.deepEqual(fs.readdirSync(root), ["uploads"]);
    // check-content then asks for each one to be renamed (the dotfile is exempt).
    const problems = uploadProblems(uploads);
    for (const name of names.filter((n) => !n.startsWith("."))) assert.ok(problems.some((problem) => problem.startsWith(`public/uploads/${name}: rename it`)), `${name}\n${problems.join("\n")}`);
    assert.equal(problems.length, names.length - 1);
  } finally { remove(root); }
});

test("only images may sit in public/uploads/: SVG, HTML, other files, links and fakes are listed for check-content", async () => {
  const root = tempDir();
  try {
    const uploads = path.join(root, "uploads");
    fs.mkdirSync(path.join(uploads, "team"), { recursive: true });
    fs.mkdirSync(path.join(uploads, ".cache"));
    await solid(64, 64).webp().toFile(path.join(uploads, "team", "photo.webp"));
    await solid(64, 64).webp().toFile(path.join(uploads, "team", "photo-640.webp"));
    await solid(64, 64).png().toFile(path.join(uploads, "chart.png"));
    await solid(64, 64).jpeg().toFile(path.join(uploads, "a.jpg"));
    await solid(64, 64).jpeg().toFile(path.join(uploads, "b.jpeg"));
    await solid(64, 64).avif().toFile(path.join(uploads, "c.avif"));
    await solid(64, 64).gif().toFile(path.join(uploads, "d.gif"));
    fs.writeFileSync(path.join(uploads, ".gitkeep"), "");
    fs.writeFileSync(path.join(uploads, ".sveltia-tmp-1"), "partial");
    fs.writeFileSync(path.join(uploads, ".cache", "x.html"), "<p>hidden</p>");
    fs.writeFileSync(path.join(uploads, "logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    fs.writeFileSync(path.join(uploads, "page.html"), "<!doctype html>");
    fs.writeFileSync(path.join(uploads, "notes.txt"), "hello");
    fs.writeFileSync(path.join(uploads, "fake.gif"), "<!doctype html><script>alert(1)</script>");
    fs.copyFileSync(path.join(uploads, "a.jpg"), path.join(uploads, "jpeg-inside.png"));
    fs.mkdirSync(path.join(root, "elsewhere"));
    fs.symlinkSync(path.join(root, "elsewhere"), path.join(uploads, "linked"), "junction");
    const problems = uploadProblems(uploads);
    const expected = [
      "public/uploads/fake.gif: is not a real GIF image: export it again, or fix its extension",
      "public/uploads/jpeg-inside.png: is not a real PNG image: export it again, or fix its extension",
      "public/uploads/linked: is a link (symbolic link or junction); uploads must be regular files: remove it and upload the file itself",
      "public/uploads/logo.svg: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it",
      "public/uploads/notes.txt: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it",
      "public/uploads/page.html: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it",
    ];
    assert.deepEqual(problems, expected);
    assert.deepEqual(uploadProblems(path.join(root, "no-such-folder")), [], "a missing folder is fine");
  } finally { remove(root); }
});

test("package-site ships only regular images from public/uploads/ (variants included), never SVG, HTML, dotfiles or links", async () => {
  const root = tempDir();
  try {
    const uploads = path.join(root, "public", "uploads");
    const target = path.join(root, "dist", "uploads");
    fs.mkdirSync(path.join(uploads, "team"), { recursive: true });
    fs.mkdirSync(path.join(uploads, "Bad Folder"));
    fs.mkdirSync(path.join(root, "outside"));
    await solid(64, 64).webp().toFile(path.join(uploads, "team", "photo.webp"));
    await solid(64, 64).webp().toFile(path.join(uploads, "team", "photo-640.webp"));
    await solid(64, 64).gif().toFile(path.join(uploads, "loop.gif"));
    await solid(64, 64).jpeg().toFile(path.join(uploads, "Bad Folder", "x.jpg"));
    await solid(64, 64).jpeg().toFile(path.join(root, "outside", "secret.jpg"));
    for (const name of ["logo.svg", "page.html", ".gitkeep", ".sveltia-tmp-1", "Upper.JPG"]) fs.writeFileSync(path.join(uploads, name), "x");
    fs.symlinkSync(path.join(root, "outside"), path.join(uploads, "linked"), "junction");
    trySymlink(path.join(root, "outside", "secret.jpg"), path.join(uploads, "secret.jpg"));
    // A file left from an earlier package (an upload deleted since) does not linger.
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "deleted.webp"), "old");
    const shipped = await shipUploads(uploads, target);
    assert.deepEqual(shipped, ["loop.gif", "team/photo-640.webp", "team/photo.webp"]);
    assert.deepEqual(listAll(target), ["loop.gif", "team", "team/photo-640.webp", "team/photo.webp"]);
    assert.deepEqual(await shipUploads(path.join(root, "public", "none"), path.join(root, "dist", "none")), [], "no uploads folder, nothing shipped");
  } finally { remove(root); }
});

test("the upload rules agree with the schema's image rule and with contentImage()", () => {
  const samples = ["a.webp", "team/a-b_c.png", "a.jpg", "a.jpeg", "a.avif", "a.gif", "a.svg", "a-640.webp", "a-1280.webp", "a-640.png", "A.webp", "a.WEBP", "a.b.webp", "a b.webp", "café.webp", "../a.webp", "team/../a.webp", ".a.webp", "a.html", "Team/a.webp"];
  for (const sample of samples) assert.equal(IMAGE.test(`/uploads/${sample}`), UPLOAD_PATH.test(sample) && !VARIANT.test(sample), sample);
  assert.deepEqual(UPLOAD_EXTENSIONS, ["webp", "png", "jpg", "jpeg", "avif", "gif"]);
  // contentImage() renders an upload from variants exactly when the variant step writes them.
  for (const extension of UPLOAD_EXTENSIONS) assert.equal("srcSet" in contentImage(`/uploads/a.${extension}`), RASTER.test(`a.${extension}`), extension);
});

test("contentImage builds a srcset from the same variant names the script writes", () => {
  assert.deepEqual([...UPLOAD_WIDTHS], WIDTHS);
  const props = contentImage("/uploads/team/photo.jpg");
  assert.deepEqual(props, {
    src: "/uploads/team/photo-1280.webp",
    srcSet: "/uploads/team/photo-640.webp 640w, /uploads/team/photo-1280.webp 1280w",
    sizes: "(min-width: 1024px) 50vw, 100vw",
  });
  for (const width of WIDTHS) assert.ok(props.srcSet.includes(variantFile("/uploads/team/photo.jpg", width)));
});

test("site images, SVG and GIF render unchanged (src only)", () => {
  for (const src of ["/images/suite/neural-net.webp", "/uploads/logo.svg", "/uploads/loop.gif"]) assert.deepEqual(contentImage(src), { src });
});

test("content image checks find missing files and missing variants", () => {
  const dir = tempDir();
  try {
    fs.mkdirSync(path.join(dir, "uploads"));
    fs.writeFileSync(path.join(dir, "uploads", "a.webp"), "");
    fs.writeFileSync(path.join(dir, "uploads", "a-640.webp"), "");
    const values = { card: { img: "/uploads/a.webp" }, list: [{ img: "/images/missing.webp" }], href: "/contact/" };
    assert.deepEqual(referencedImages(values), ["/images/missing.webp", "/uploads/a.webp"]);
    assert.deepEqual(missingImageFiles(values, dir), ["/images/missing.webp", "/uploads/a-1280.webp (run npm run uploads:variants)"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
});

test("content may not point at a generated variant or at a path that leaves /images/ or /uploads/", () => {
  const root = tempDir();
  try {
    const publicDir = path.join(root, "public");
    fs.mkdirSync(path.join(publicDir, "uploads"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    const values = {
      variant: "/uploads/team/photo-640.webp",
      large: { href: "/uploads/photo-1280.webp" },
      up: "/uploads/../../package.json",
      dot: "/images/./faq.webp",
      hidden: "/uploads/.gitkeep",
      back: "/images/..\\..\\package.json",
      encoded: "/uploads/%2e%2e/package.json",
      fine: "/images/faq-team.webp",
    };
    const notPlain = 'is not a plain image path under /images/ or /uploads/ (letters, digits, -, _ and dots; no "..", dotfiles or other characters)';
    const variant = "is a generated variant (names ending in -640.webp or -1280.webp are reserved): point at the original upload";
    assert.deepEqual(imageReferenceProblems(values), [
      `variant: /uploads/team/photo-640.webp ${variant}`,
      `large.href: /uploads/photo-1280.webp ${variant}`,
      `up: "/uploads/../../package.json" ${notPlain}`,
      `dot: "/images/./faq.webp" ${notPlain}`,
      `hidden: "/uploads/.gitkeep" ${notPlain}`,
      `back: "/images/..\\\\..\\\\package.json" ${notPlain}`,
      `encoded: "/uploads/%2e%2e/package.json" ${notPlain}`,
    ]);
    assert.deepEqual(imageReferenceProblems({ list: [{ img: "/uploads/a-640.webp" }] }), [`list[0].img: /uploads/a-640.webp ${variant}`]);
    // Refused paths are not looked up on disk (package.json exists outside public/).
    assert.deepEqual(missingImageFiles(values, publicDir), ["/images/faq-team.webp"]);
  } finally { remove(root); }
});

// check-content runs on a temporary copy of what it reads, as in tests/content.test.mjs.
test("check-content refuses SVG and HTML uploads, variant references and missing variants, and passes a real upload", async () => {
  const root = tempDir();
  try {
    for (const dir of ["content", "src/lib", "scripts/lib", "public/images"]) fs.cpSync(dir, path.join(root, dir), { recursive: true });
    for (const file of ["scripts/check-content.mjs", "scripts/build-content-index.mjs"]) fs.copyFileSync(file, path.join(root, file));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    const env = { ...process.env, SITE_MODE: "preview", NEXT_PUBLIC_SHOW_SAMPLES: "" };
    const run = () => spawnSync(process.execPath, ["--experimental-strip-types", path.join(root, "scripts", "check-content.mjs")], { cwd: path.join(root, "src"), encoding: "utf8", env });
    const listed = (result) => result.stderr.split(/\r?\n/).filter((line) => line.startsWith("  - ")).map((line) => line.slice(4));
    const card = path.join(root, "content", "faq-card.json");
    const setCardImage = (img) => fs.writeFileSync(card, JSON.stringify({ ...JSON.parse(fs.readFileSync("content/faq-card.json", "utf8")), img }, null, 2));
    const uploads = path.join(root, "public", "uploads");
    fs.mkdirSync(path.join(uploads, "team"), { recursive: true });

    // A real upload with its variants, shown by the FAQ card: valid. Dotfiles are exempt.
    await solid(1600, 900).webp().toFile(path.join(uploads, "team", "faq.webp"));
    assert.deepEqual((await buildUploadVariants(uploads)).errors, []);
    fs.writeFileSync(path.join(uploads, ".gitkeep"), "");
    setCardImage("/uploads/team/faq.webp");
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Content valid: 12 routes; preview mode\./);

    // Planted SVG and HTML uploads, and a missing variant.
    fs.writeFileSync(path.join(uploads, "logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    fs.writeFileSync(path.join(uploads, "page.html"), "<!doctype html>");
    fs.rmSync(path.join(uploads, "team", "faq-1280.webp"));
    result = run();
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /^\s+at /m, "no stack trace");
    for (const problem of [
      "public/uploads/logo.svg: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it",
      "public/uploads/page.html: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it",
      "missing image: public/uploads/team/faq-1280.webp (run npm run uploads:variants)",
    ]) assert.ok(listed(result).includes(problem), `${problem}\n${result.stderr}`);

    // Content that points at a variant is refused by the image field.
    setCardImage("/uploads/team/faq-640.webp");
    result = run();
    assert.equal(result.status, 1);
    assert.ok(listed(result).some((problem) => /^content\/faq-card\.json: img: .*not a -640 or -1280 variant/.test(problem)), result.stderr);
  } finally { remove(root); }
});
