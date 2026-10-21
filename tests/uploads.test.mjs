// CMS uploads (public/uploads/): the variant step and its cache, the rules for what may sit in the
// folder and ship, the content image checks, exact-case lookups and the contentImage() srcset helper.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import sharp from "sharp";
import { buildUploadVariants, cachedVariant, variantFile, writeVariant, WIDTHS } from "../scripts/build-upload-variants.mjs";
import { imageReferenceProblems, missingImageFiles, referencedImages } from "../scripts/lib/content-assets.mjs";
import { existsExact, LOCAL_REF, wrongCaseReferences } from "../scripts/lib/exact-paths.mjs";
import { RASTER, SITE_IMAGE_PATH, UPLOAD_EXTENSIONS, UPLOAD_PATH, UPLOAD_REF, VARIANT, readManifest, shipUploads, uploadProblems, variantOriginal } from "../scripts/lib/uploads.mjs";

const { contentImage, UPLOAD_WIDTHS } = await import("../src/lib/content-images.ts");
const { IMAGE } = await import("../src/lib/content-schema.ts");

// libvips keeps recently used files open, which blocks deleting them on Windows.
sharp.cache(false);
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-uploads-"));
const remove = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
const solid = (width, height, background = "#fa6e43") => sharp({ create: { width, height, channels: 3, background } });
const meta = (file) => sharp(file).metadata();
/** Every file below a folder (not folders), with forward slashes, sorted; [] when it does not exist. */
function listFiles(dir, prefix = "") {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? listFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`])).sort();
}
/** A temporary project: uploads/ and a variant cache of its own, never the real ones. */
function project() {
  const root = tempDir();
  const uploads = path.join(root, "uploads");
  const cache = path.join(root, "cache");
  fs.mkdirSync(uploads);
  return {
    root,
    uploads,
    cache,
    run: (options = {}) => buildUploadVariants(uploads, { cacheDir: cache, ...options }),
    variant: (rel, width) => cachedVariant(cache, rel, width),
    cached: () => listFiles(path.join(cache, "files")),
  };
}

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

test("each upload gets WebP variants at 640 and 1280 px in the cache, never wider than the original; the uploads folder is not touched", async () => {
  const p = project();
  try {
    await solid(2000, 1000).jpeg().toFile(path.join(p.uploads, "wide.jpg"));
    await solid(900, 900).png().toFile(path.join(p.uploads, "small.png"));
    const result = await p.run();
    assert.deepEqual(result.errors, []);
    assert.equal(result.written.length, 4);
    const width = async (rel, w) => (await meta(p.variant(rel, w))).width;
    assert.equal(await width("wide.jpg", 640), 640);
    assert.equal(await width("wide.jpg", 1280), 1280);
    assert.equal(await width("small.png", 640), 640);
    assert.equal(await width("small.png", 1280), 900, "no upscaling");
    assert.equal((await meta(p.variant("wide.jpg", 1280))).format, "webp");
    assert.deepEqual(listFiles(p.uploads), ["small.png", "wide.jpg"], "nothing is written next to the uploads");
    assert.deepEqual(p.cached(), ["small.png.w1280.webp", "small.png.w640.webp", "wide.jpg.w1280.webp", "wide.jpg.w640.webp"], "no temporary file is left behind");
    const manifest = readManifest(p.cache);
    assert.deepEqual(Object.keys(manifest.uploads), ["small.png", "wide.jpg"]);
    assert.match(manifest.uploads["wide.jpg"].sha1, /^[0-9a-f]{40}$/);
  } finally { remove(p.root); }
});

test("variants follow the original's bytes: a touched file stays current, new bytes with the same modification time are rebuilt", async () => {
  const p = project();
  try {
    const original = path.join(p.uploads, "photo.jpg");
    await solid(1600, 900, "#ff0000").jpeg().toFile(original);
    const zipTime = new Date(Math.floor(Date.now() / 2000) * 2000); // an unzip-style 2-second timestamp
    fs.utimesSync(original, zipTime, zipTime);
    await p.run();
    const again = await p.run();
    assert.deepEqual([again.written.length, again.upToDate.length], [0, 2]);
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(original, later, later);
    const touched = await p.run();
    assert.deepEqual([touched.written.length, touched.upToDate.length], [0, 2], "same bytes, so nothing to rebuild");
    // The reviewer's case: a different photo unzipped again within the same 2-second bucket.
    await solid(1600, 900, "#0000ff").jpeg().toFile(original);
    fs.utimesSync(original, zipTime, zipTime);
    const replaced = await p.run();
    assert.deepEqual([replaced.written.length, replaced.upToDate.length], [2, 0]);
    const [r, , b] = await sharp(p.variant("photo.jpg", 640)).raw().toBuffer();
    assert.ok(b > 200 && r < 40, `the variant shows the new photo (${r}, ${b})`);
    // An older file with other bytes (cp -p) is rebuilt too.
    await solid(700, 700, "#123456").jpeg().toFile(original);
    const older = new Date(zipTime.getTime() - 60_000);
    fs.utimesSync(original, older, older);
    assert.deepEqual((await p.run()).written.length, 2);
    assert.equal((await meta(p.variant("photo.jpg", 1280))).width, 700);
  } finally { remove(p.root); }
});

test("an upload named like a variant is an ordinary upload: never overwritten, and shipped with variants of its own", async () => {
  const p = project();
  try {
    // The reviewer's probe: Sveltia's slugify turns "hero 1280.webp" into hero-1280.webp.
    await solid(2000, 1000, "#ff0000").webp().toFile(path.join(p.uploads, "hero.webp"));
    await solid(1280, 400, "#0000ff").webp().toFile(path.join(p.uploads, "hero-1280.webp"));
    await solid(800, 600).jpeg().toFile(path.join(p.uploads, "team.jpg"));
    await solid(800, 600).png().toFile(path.join(p.uploads, "team.png"));
    fs.writeFileSync(path.join(p.uploads, ".gitkeep"), "");
    fs.writeFileSync(path.join(p.uploads, ".sveltia-tmp-123"), "partial");
    const before = fs.readFileSync(path.join(p.uploads, "hero-1280.webp"));
    const result = await p.run();
    assert.deepEqual([result.errors, result.originals], [[], 4]);
    assert.deepEqual(fs.readFileSync(path.join(p.uploads, "hero-1280.webp")), before, "the editor's file is left exactly as it was");
    assert.deepEqual(p.cached(), [
      "hero-1280.webp.w1280.webp", "hero-1280.webp.w640.webp", "hero.webp.w1280.webp", "hero.webp.w640.webp",
      "team.jpg.w1280.webp", "team.jpg.w640.webp", "team.png.w1280.webp", "team.png.w640.webp",
    ], "team.jpg and team.png do not collide either");
    assert.deepEqual(uploadProblems(p.uploads), []);
    const dist = path.join(p.root, "dist");
    const shipped = await shipUploads(p.uploads, dist, p.cache);
    assert.ok(shipped.includes("hero-1280.webp") && shipped.includes("hero.webp.w1280.webp") && shipped.includes("hero-1280.webp.w1280.webp"), shipped.join(", "));
    assert.deepEqual(fs.readFileSync(path.join(dist, "hero-1280.webp")), before, "and ships it unchanged");
    assert.equal((await meta(path.join(dist, "hero.webp.w1280.webp"))).width, 1280);
  } finally { remove(p.root); }
});

test("the cache is pruned: variants of deleted or failing uploads, foreign files, links and a killed run's temporary files", async () => {
  const p = project();
  try {
    await solid(800, 600).jpeg().toFile(path.join(p.uploads, "keep.jpg"));
    await solid(800, 600).jpeg().toFile(path.join(p.uploads, "gone.jpg"));
    assert.equal((await p.run()).written.length, 4);
    fs.rmSync(path.join(p.uploads, "gone.jpg"));
    const files = path.join(p.cache, "files");
    fs.writeFileSync(path.join(files, "foreign.txt"), "x");
    fs.writeFileSync(path.join(files, ".keep.jpg.w640.webp.4242.tmp"), "killed mid-write");
    fs.writeFileSync(path.join(p.cache, "manifest.json.4242.tmp"), "{");
    const outside = path.join(p.root, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "precious.txt"), "never deleted");
    fs.symlinkSync(outside, path.join(files, "linked"), "junction");
    const result = await p.run();
    assert.deepEqual(result.errors, []);
    assert.deepEqual([...result.removed].sort(), [".keep.jpg.w640.webp.4242.tmp", "foreign.txt", "gone.jpg.w1280.webp", "gone.jpg.w640.webp", "linked"]);
    assert.deepEqual(p.cached(), ["keep.jpg.w1280.webp", "keep.jpg.w640.webp"]);
    assert.deepEqual(fs.readdirSync(p.cache).sort(), ["files", "manifest.json"]);
    assert.deepEqual(fs.readdirSync(outside), ["precious.txt"], "a link in the cache is removed, never followed");
    assert.deepEqual(Object.keys(readManifest(p.cache).uploads), ["keep.jpg"]);
    // A killed run's temporary files go even when the run then stops on a problem.
    fs.writeFileSync(path.join(files, ".keep.jpg.w1280.webp.4243.tmp"), "killed");
    fs.symlinkSync(outside, path.join(p.uploads, "linked"), "junction");
    const refused = await p.run();
    assert.equal(refused.errors.length, 1);
    assert.deepEqual(p.cached(), ["keep.jpg.w1280.webp", "keep.jpg.w640.webp"]);
  } finally { remove(p.root); }
});

test("a folder (or anything but a file) where a cached variant belongs is replaced, never counted as current", async () => {
  const p = project();
  try {
    await solid(800, 600).jpeg().toFile(path.join(p.uploads, "photo.jpg"));
    await p.run();
    const out = p.variant("photo.jpg", 640);
    fs.rmSync(out);
    fs.mkdirSync(out);
    const result = await p.run();
    assert.deepEqual([result.errors, result.written, result.upToDate.length], [[], [out], 1]);
    assert.ok(fs.lstatSync(out).isFile());
  } finally { remove(p.root); }
});

test("a missing uploads folder is not an error, and another folder needs a cache of its own", async () => {
  const root = tempDir();
  try {
    const result = await buildUploadVariants(path.join(root, "no-such-folder"), { cacheDir: path.join(root, "cache") });
    assert.deepEqual([result.originals, result.errors], [0, []]);
    assert.equal(fs.existsSync(path.join(root, "cache")), false, "no cache is created for nothing");
    await assert.rejects(buildUploadVariants(path.join(root, "no-such-folder")), /pass a cacheDir/);
  } finally { remove(root); }
});

test("EXIF orientation is applied, so a rotated phone photo is not sideways", async () => {
  const p = project();
  try {
    // Stored 1600 x 800, displayed 800 x 1600 (orientation 6: rotate 90 degrees clockwise).
    await solid(1600, 800).jpeg().withMetadata({ orientation: 6 }).toFile(path.join(p.uploads, "phone.jpg"));
    const result = await p.run();
    assert.deepEqual(result.errors, []);
    const small = await meta(p.variant("phone.jpg", 640));
    assert.deepEqual([small.width, small.height, small.orientation], [640, 1280, undefined]);
    const large = await meta(p.variant("phone.jpg", 1280));
    assert.deepEqual([large.width, large.height], [800, 1600], "upright, and never wider than the displayed original");
  } finally { remove(p.root); }
});

test("colours are converted to sRGB (Display P3 and CMYK originals) and no profile is kept", async () => {
  const p = project();
  try {
    const colour = { r: 200, g: 100, b: 50 };
    await sharp({ create: { width: 64, height: 64, channels: 3, background: colour } }).withIccProfile("p3").png().toFile(path.join(p.uploads, "wide-gamut.png"));
    const stored = await sharp(path.join(p.uploads, "wide-gamut.png"), { ignoreIcc: true }).raw().toBuffer();
    assert.ok(Math.abs(stored[0] - colour.r) > 5, "the original stores P3 numbers, not sRGB ones");
    await sharp({ create: { width: 64, height: 64, channels: 3, background: colour } }).toColourspace("cmyk").jpeg().toFile(path.join(p.uploads, "print.jpg"));
    assert.equal((await meta(path.join(p.uploads, "print.jpg"))).space, "cmyk");
    assert.deepEqual((await p.run()).errors, []);
    // P3 converts back almost exactly; CMYK round trips lose a little more.
    for (const [rel, tolerance] of [["wide-gamut.png", 4], ["print.jpg", 18]]) {
      const file = p.variant(rel, 640);
      const info = await meta(file);
      assert.deepEqual([info.space, info.icc, info.channels], ["srgb", undefined, 3], rel);
      const [r, g, b] = await sharp(file, { ignoreIcc: true }).raw().toBuffer();
      for (const [got, want] of [[r, colour.r], [g, colour.g], [b, colour.b]]) assert.ok(Math.abs(got - want) <= tolerance, `${rel}: ${[r, g, b]} is close to ${Object.values(colour)}`);
    }
  } finally { remove(p.root); }
});

test("animated GIFs ship as they are (no variants); animated WebP variants keep every frame", async () => {
  const p = project();
  try {
    const frames = await Promise.all(["#ff0000", "#00ff00", "#0000ff"].map((colour) => solid(1600, 900, colour).raw().toBuffer()));
    const animation = () => sharp(Buffer.concat(frames), { raw: { width: 1600, height: 2700, channels: 3, pageHeight: 900 } });
    await animation().gif({ loop: 0, delay: [100, 100, 100] }).toFile(path.join(p.uploads, "loop.gif"));
    await animation().webp({ loop: 0, delay: [100, 100, 100] }).toFile(path.join(p.uploads, "spin.webp"));
    const result = await p.run();
    assert.deepEqual([result.errors, result.originals], [[], 1]);
    assert.deepEqual(p.cached(), ["spin.webp.w1280.webp", "spin.webp.w640.webp"], "the GIF gets no variants");
    for (const width of WIDTHS) {
      const info = await meta(p.variant("spin.webp", width));
      assert.deepEqual([info.pages, info.width, info.pageHeight ?? info.height], [3, width, (width * 900) / 1600], `${width}`);
    }
    assert.deepEqual(contentImage("/uploads/loop.gif"), { src: "/uploads/loop.gif" }, "and renders from the original");
    // Every frame counts towards the size limit.
    for (const width of WIDTHS) fs.rmSync(p.variant("spin.webp", width));
    const limited = await p.run({ maxPixels: 2_000_000 });
    assert.match(limited.errors.join("\n"), /spin\.webp: 4\.3 MP \(1600 x 900 px, 3 frames\) is over the 2\.0 MP limit/);
  } finally { remove(p.root); }
});

test("animated PNG and AVIF sequences are refused: their variants would be still images", async () => {
  const p = project();
  try {
    const png = await solid(400, 300).png().toBuffer();
    const actl = Buffer.alloc(8);
    actl.writeUInt32BE(2, 0); // frames
    fs.writeFileSync(path.join(p.uploads, "blink.png"), Buffer.concat([png.subarray(0, 33), pngChunk("acTL", actl), png.subarray(33)]));
    const ftyp = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypavis\0\0\0\0avismsf1", "latin1")]);
    fs.writeFileSync(path.join(p.uploads, "clip.avif"), Buffer.concat([ftyp, Buffer.alloc(64)]));
    const result = await p.run();
    assert.equal(result.errors.length, 2, result.errors.join("\n"));
    assert.match(result.errors.find((error) => error.includes("blink.png")), /animated PNG.*upload an animated WebP or a GIF/);
    assert.match(result.errors.find((error) => error.includes("clip.avif")), /animated AVIF.*upload an animated WebP or a GIF/);
    assert.deepEqual(p.cached(), []);
  } finally { remove(p.root); }
});

test("a huge or decompression-bomb image is a content error, not a crash", async () => {
  const p = project();
  try {
    // 900 megapixels claimed by a 1 KB file: refused from its header, before anything is decoded.
    fs.writeFileSync(path.join(p.uploads, "bomb.png"), pngHeaderClaiming(30_000, 30_000));
    await solid(1200, 1000).jpeg().toFile(path.join(p.uploads, "fine.jpg"));
    const result = await p.run();
    assert.equal(result.errors.length, 1, result.errors.join("\n"));
    assert.match(result.errors[0], /bomb\.png: 900\.0 MP \(30000 x 30000 px\) is over the 268\.4 MP limit for uploads; resize it before uploading/);
    assert.equal(result.written.length, 2, "the other upload still gets its variants");
    // The limit can be lowered (tests, small machines). Current variants are not looked at again,
    // so remove them first.
    for (const width of WIDTHS) fs.rmSync(p.variant("fine.jpg", width));
    const lowered = await p.run({ maxPixels: 1_000_000 });
    assert.ok(lowered.errors.some((error) => /fine\.jpg: 1\.2 MP \(1200 x 1000 px\) is over the 1\.0 MP limit/.test(error)), lowered.errors.join("\n"));
  } finally { remove(p.root); }
});

test("sharp enforces the pixel limit while decoding too, behind the header check", async () => {
  const root = tempDir();
  try {
    const original = path.join(root, "fine.jpg");
    await solid(1200, 1000).jpeg().toFile(original);
    const out = path.join(root, "out", "fine.jpg.w640.webp");
    await assert.rejects(writeVariant(original, out, 640, { maxPixels: 1_000_000 }), /pixel limit/);
    assert.deepEqual(listFiles(path.join(root, "out")), [], "nothing is left behind");
    await writeVariant(original, out, 640, { maxPixels: 2_000_000 });
    assert.equal((await meta(out)).width, 640);
  } finally { remove(root); }
});

test("a file that is not a readable image is a content error; the other uploads still get variants", async () => {
  const p = project();
  try {
    fs.writeFileSync(path.join(p.uploads, "page.jpg"), "<!doctype html><script>alert(1)</script>");
    fs.writeFileSync(path.join(p.uploads, "cut.png"), (await solid(800, 600).png().toBuffer()).subarray(0, 200));
    await solid(800, 600).webp().toFile(path.join(p.uploads, "ok.webp"));
    const result = await p.run();
    assert.equal(result.errors.length, 2, result.errors.join("\n"));
    for (const name of ["page.jpg", "cut.png"]) assert.match(result.errors.find((error) => error.includes(name)), /cannot be read as an image \(.+\); export it again as WebP, PNG, JPEG or AVIF/);
    assert.deepEqual(p.cached(), ["ok.webp.w1280.webp", "ok.webp.w640.webp"], "no partial or temporary variant is left");
  } finally { remove(p.root); }
});

test("links in the uploads folder are refused and never followed", async () => {
  const p = project();
  try {
    const outside = path.join(p.root, "outside");
    fs.mkdirSync(outside);
    await solid(800, 600).jpeg().toFile(path.join(outside, "secret.jpg"));
    // A directory junction (Windows) or symlink (elsewhere) to a folder outside uploads/.
    fs.symlinkSync(outside, path.join(p.uploads, "linked"), "junction");
    fs.symlinkSync(outside, path.join(p.uploads, ".hidden-link"), "junction");
    const result = await p.run();
    assert.equal(result.errors.length, 2, result.errors.join("\n"));
    for (const name of ["linked", ".hidden-link"]) assert.ok(result.errors.some((error) => error.includes(path.join(p.uploads, name)) && /is a link/.test(error)), `${name}\n${result.errors.join("\n")}`);
    assert.deepEqual([result.written, p.cached()], [[], []]);
    assert.deepEqual(fs.readdirSync(outside), ["secret.jpg"], "nothing is written through the link");
    // The uploads folder itself may not be a link either, and neither may the cache.
    fs.symlinkSync(outside, path.join(p.root, "uploads-link"), "junction");
    const linkedFolder = await buildUploadVariants(path.join(p.root, "uploads-link"), { cacheDir: p.cache });
    assert.match(linkedFolder.errors.join("\n"), /uploads-link: is a link/);
    fs.rmSync(path.join(p.uploads, "linked"));
    fs.rmSync(path.join(p.uploads, ".hidden-link"));
    fs.rmSync(p.cache, { recursive: true, force: true });
    fs.symlinkSync(outside, p.cache, "junction");
    assert.match((await p.run()).errors.join("\n"), /the variant cache must be a folder, not a link/);
    assert.deepEqual(fs.readdirSync(outside), ["secret.jpg"]);
  } finally { remove(p.root); }
});

test("a symbolic link to a file is refused too", async (t) => {
  const p = project();
  try {
    const secret = path.join(p.root, "secret.jpg");
    await solid(800, 600).jpeg().toFile(secret);
    if (!trySymlink(secret, path.join(p.uploads, "photo.jpg"))) return t.skip("file symlinks need developer mode on Windows");
    const result = await p.run();
    assert.match(result.errors.join("\n"), /photo\.jpg: is a link/);
    assert.deepEqual(p.cached(), []);
    assert.deepEqual(await shipUploads(p.uploads, path.join(p.root, "dist"), p.cache), []);
  } finally { remove(p.root); }
});

test("hard links are refused, never processed or shipped", async () => {
  const p = project();
  try {
    const secret = path.join(p.root, "secret.jpg");
    await solid(800, 600).jpeg().toFile(secret);
    fs.linkSync(secret, path.join(p.uploads, "photo.jpg"));
    const result = await p.run();
    assert.deepEqual(result.errors, [`${path.join(p.uploads, "photo.jpg")}: is one file with 2 names (hard links); uploads must be files of their own: copy it instead of linking it`]);
    assert.deepEqual(uploadProblems(p.uploads), ["public/uploads/photo.jpg: is one file with 2 names (hard links); uploads must be files of their own: copy it instead of linking it"]);
    assert.deepEqual(await shipUploads(p.uploads, path.join(p.root, "dist"), p.cache), []);
  } finally { remove(p.root); }
});

test("odd names (dots, spaces, capitals, non-ASCII, Windows device names) are left alone and nothing is written outside the folder", async () => {
  const p = project();
  try {
    const names = ["a..b.jpg", "Photo.JPG", "with space.png", "café.jpg", "x[shrink=8].jpg", "rtl‮gpj.png", "con.webp", "nul.png", "aux.gif", "com1.jpg", "lpt9.avif", "prn.jpeg", "con/a.webp", "..jpg"];
    fs.mkdirSync(path.join(p.uploads, "con"));
    for (const name of names) await solid(700, 500).jpeg().toFile(path.join(p.uploads, name));
    const result = await p.run();
    assert.deepEqual([result.originals, result.written, result.errors], [0, [], []], "the site cannot reference these names, so they get no variants");
    assert.deepEqual(listFiles(p.uploads), [...names].sort());
    assert.deepEqual(fs.readdirSync(p.root), ["uploads"], "no cache either, as there is nothing to cache");
    // check-content then asks for each one to be renamed (the dotfile is exempt).
    const problems = uploadProblems(p.uploads);
    for (const name of names.filter((n) => !n.startsWith("."))) assert.ok(problems.some((problem) => problem.startsWith(`public/uploads/${name}: rename it`)), `${name}\n${problems.join("\n")}`);
    assert.equal(problems.length, names.length - 1);
    assert.deepEqual(await shipUploads(p.uploads, path.join(p.root, "dist"), p.cache), [], "and none of them ships");
  } finally { remove(p.root); }
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
    await solid(64, 64).webp().toFile(path.join(uploads, "a.jpg.w640.webp"));
    fs.mkdirSync(path.join(root, "elsewhere"));
    fs.symlinkSync(path.join(root, "elsewhere"), path.join(uploads, "linked"), "junction");
    const problems = uploadProblems(uploads);
    const rename = "rename it: upload names use lowercase letters, digits, - and _ only, in folders too, with a lowercase extension, and are not a Windows device name such as con or nul";
    const notImage = "only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it";
    assert.deepEqual(problems, [
      `public/uploads/a.jpg.w640.webp: ${rename}`,
      "public/uploads/fake.gif: is not a real GIF image: export it again, or fix its extension",
      "public/uploads/jpeg-inside.png: is not a real PNG image: export it again, or fix its extension",
      "public/uploads/linked: is a link (symbolic link or junction); uploads must be regular files: remove it and upload the file itself",
      `public/uploads/logo.svg: ${notImage}`,
      `public/uploads/notes.txt: ${notImage}`,
      `public/uploads/page.html: ${notImage}`,
    ]);
    assert.deepEqual(uploadProblems(path.join(root, "no-such-folder")), [], "a missing folder is fine");
  } finally { remove(root); }
});

test("package-site ships only regular images from public/uploads/ plus the variants made from their current bytes", async () => {
  const p = project();
  try {
    fs.mkdirSync(path.join(p.uploads, "team"));
    fs.mkdirSync(path.join(p.uploads, "Bad Folder"));
    fs.mkdirSync(path.join(p.root, "outside"));
    await solid(1600, 900).webp().toFile(path.join(p.uploads, "team", "photo.webp"));
    await solid(1600, 900).jpeg().toFile(path.join(p.uploads, "edited.jpg"));
    await solid(64, 64).gif().toFile(path.join(p.uploads, "loop.gif"));
    await solid(64, 64).jpeg().toFile(path.join(p.uploads, "Bad Folder", "x.jpg"));
    await solid(64, 64).jpeg().toFile(path.join(p.root, "outside", "secret.jpg"));
    for (const name of ["logo.svg", "page.html", ".gitkeep", ".sveltia-tmp-1", "Upper.JPG"]) fs.writeFileSync(path.join(p.uploads, name), "x");
    assert.deepEqual((await p.run()).errors, []);
    // A link added after the variant step (which would refuse it) is not shipped either.
    fs.symlinkSync(path.join(p.root, "outside"), path.join(p.uploads, "linked"), "junction");
    // An original edited after the variant step: its variants no longer match, so they do not ship.
    await solid(1600, 900, "#0000ff").jpeg().toFile(path.join(p.uploads, "edited.jpg"));
    // A file left from an earlier package (an upload deleted since) does not linger.
    const target = path.join(p.root, "dist", "uploads");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "deleted.webp"), "old");
    const shipped = await shipUploads(p.uploads, target, p.cache);
    assert.deepEqual(shipped, ["edited.jpg", "loop.gif", "team/photo.webp", "team/photo.webp.w1280.webp", "team/photo.webp.w640.webp"]);
    assert.deepEqual(listFiles(target), shipped);
    assert.deepEqual(uploadProblems(target, { label: "dist/uploads", variants: true }), [], "and what ships passes the shipped-uploads check");
    assert.deepEqual(await shipUploads(path.join(p.root, "none"), path.join(p.root, "dist", "none"), p.cache), [], "no uploads folder, nothing shipped");
  } finally { remove(p.root); }
});

test("check-export's view of dist/uploads/: variants need their original and must be WebP; everything else follows the upload rules", async () => {
  const root = tempDir();
  try {
    const dist = path.join(root, "uploads");
    fs.mkdirSync(path.join(dist, "team"), { recursive: true });
    await solid(64, 64).jpeg().toFile(path.join(dist, "team", "a.jpg"));
    await solid(64, 64).webp().toFile(path.join(dist, "team", "a.jpg.w640.webp"));
    await solid(64, 64).webp().toFile(path.join(dist, "orphan.png.w640.webp"));
    fs.copyFileSync(path.join(dist, "team", "a.jpg"), path.join(dist, "team", "a.jpg.w1280.webp"));
    fs.writeFileSync(path.join(dist, "saved-mid-build.png"), "<!doctype html>");
    fs.writeFileSync(path.join(dist, "x.svg"), "<svg/>");
    assert.deepEqual(uploadProblems(dist, { label: "dist/uploads", variants: true }), [
      "dist/uploads/orphan.png.w640.webp: is a variant of orphan.png, which is not there",
      "dist/uploads/saved-mid-build.png: is not a real PNG image: export it again, or fix its extension",
      "dist/uploads/team/a.jpg.w1280.webp: is not a real WebP image",
      "dist/uploads/x.svg: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it",
    ]);
  } finally { remove(root); }
});

test("the upload rules agree with the schema's image rule and with contentImage()", () => {
  const samples = [
    "a.webp", "team/a-b_c.png", "a.jpg", "a.jpeg", "a.avif", "a.gif", "a.svg", "a-640.webp", "a-1280.webp", "a-640.png",
    "a.jpg.w640.webp", "a.webp.w1280.webp", "A.webp", "a.WEBP", "a.b.webp", "a b.webp", "café.webp", "../a.webp", "team/../a.webp",
    ".a.webp", "a.html", "Team/a.webp", "con.webp", "nul.png", "aux.gif", "prn.jpeg", "com0.jpg", "com9.svg", "lpt1.avif", "lpt9.webp",
    "con/a.webp", "team/con/a.webp", "team/nul.webp", "icon.webp", "con-1.webp", "console/a.png", "com10.jpg", "lpt.webp", "conx/a.webp",
  ];
  for (const sample of samples) {
    assert.equal(IMAGE.test(`/uploads/${sample}`), UPLOAD_PATH.test(sample), `/uploads/${sample}`);
    assert.equal(IMAGE.test(`/images/${sample}`), SITE_IMAGE_PATH.test(sample), `/images/${sample}`);
  }
  assert.deepEqual(UPLOAD_EXTENSIONS, ["webp", "png", "jpg", "jpeg", "avif", "gif"]);
  assert.deepEqual([variantOriginal("team/a.jpg.w640.webp"), variantOriginal("a.gif.w640.webp"), variantOriginal("a-640.webp"), variantOriginal("Con.jpg.w640.webp")], ["team/a.jpg", null, null, null]);
  assert.deepEqual(["a.jpg.w640.webp", "a.png.w1280.webp", "a-640.webp", "a-1280.webp", "a.w320.webp"].map((name) => VARIANT.test(name)), [true, true, false, false, false], "only the generated names are variants");
  // contentImage() renders an upload from variants exactly when the variant step writes them.
  for (const extension of UPLOAD_EXTENSIONS) assert.equal("srcSet" in contentImage(`/uploads/a.${extension}`), RASTER.test(`a.${extension}`), extension);
});

test("upload and local asset references are found whole, never inside another URL or a longer name", () => {
  const html = [
    '<a href="https://client.example/wp-content/uploads/2024/05/case-study.png">case study</a>',
    '<img src="/uploads/a.webpx"> <img src="/uploads/b.jpg" srcset="/uploads/b.jpg.w640.webp 640w, /uploads/b.jpg.w1280.webp 1280w">',
    "<div style=\"background:url(/uploads/team/c.png)\"></div> <img src='/uploads/D.WEBP'> //cdn.example/uploads/e.png /x/uploads/f.png",
  ].join("\n");
  assert.deepEqual([...html.matchAll(UPLOAD_REF)].map(([ref]) => ref), ["/uploads/b.jpg", "/uploads/b.jpg.w640.webp", "/uploads/b.jpg.w1280.webp", "/uploads/team/c.png", "/uploads/D.WEBP"]);
  assert.deepEqual([..."src=\"/images/a.webp\" https://x.example/images/b.webp /images/c.webpx".matchAll(LOCAL_REF)].map(([ref]) => ref), ["/images/a.webp"]);
});

test("files are found with their exact letter case, as Cloudflare serves them", () => {
  const root = tempDir();
  try {
    fs.mkdirSync(path.join(root, "images", "suite"), { recursive: true });
    fs.writeFileSync(path.join(root, "images", "Faq.webp"), "x");
    fs.writeFileSync(path.join(root, "images", "suite", "net.webp"), "x");
    assert.deepEqual([existsExact(root, "/images/Faq.webp"), existsExact(root, "images/faq.webp"), existsExact(root, "Images/suite/net.webp"), existsExact(root, "images/suite/net.webp")], [true, false, false, true]);
    fs.writeFileSync(path.join(root, "index.html"), '<img src="/images/faq.webp"><img src="/images/Faq.webp"><img src="/images/suite/NET.webp"><a href="https://x.example/images/faq.webp">');
    fs.mkdirSync(path.join(root, "admin"));
    fs.writeFileSync(path.join(root, "admin", "cms.js"), '"/images/faq.webp"');
    assert.deepEqual(wrongCaseReferences(root, { skip: ["admin"] }), [
      "/images/faq.webp in index.html: the file that ships is /images/Faq.webp; the letter case must match (Cloudflare is case-sensitive)",
      "/images/suite/NET.webp in index.html: the file that ships is /images/suite/net.webp; the letter case must match (Cloudflare is case-sensitive)",
    ]);
  } finally { remove(root); }
});

test("contentImage builds a srcset from the same variant names the script writes, and keeps the original under next dev", () => {
  assert.deepEqual([...UPLOAD_WIDTHS], WIDTHS);
  const props = contentImage("/uploads/team/photo.jpg");
  assert.deepEqual(props, {
    src: "/uploads/team/photo.jpg.w1280.webp",
    srcSet: "/uploads/team/photo.jpg.w640.webp 640w, /uploads/team/photo.jpg.w1280.webp 1280w",
    sizes: "(min-width: 1024px) 50vw, 100vw",
  });
  for (const width of WIDTHS) assert.ok(props.srcSet.includes(variantFile("/uploads/team/photo.jpg", width)));
  const saved = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    assert.deepEqual(contentImage("/uploads/team/photo.jpg"), { src: "/uploads/team/photo.jpg" }, "next dev serves public/ only, where variants are not");
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
});

test("site images, SVG and GIF render unchanged (src only)", () => {
  for (const src of ["/images/suite/neural-net.webp", "/uploads/logo.svg", "/uploads/loop.gif"]) assert.deepEqual(contentImage(src), { src });
});

test("content image checks find missing files, files in another letter case and missing variants", () => {
  const root = tempDir();
  try {
    const publicDir = path.join(root, "public");
    const cache = path.join(root, "cache");
    fs.mkdirSync(path.join(publicDir, "uploads"), { recursive: true });
    fs.mkdirSync(path.join(publicDir, "images"));
    fs.mkdirSync(path.join(cache, "files"), { recursive: true });
    fs.writeFileSync(path.join(publicDir, "uploads", "a.webp"), "");
    fs.writeFileSync(path.join(cache, "files", "a.webp.w640.webp"), "");
    fs.writeFileSync(path.join(publicDir, "images", "Faq.webp"), "");
    const values = { card: { img: "/uploads/a.webp" }, list: [{ img: "/images/missing.webp" }, { img: "/images/faq.webp" }], href: "/contact/" };
    assert.deepEqual(referencedImages(values), ["/images/faq.webp", "/images/missing.webp", "/uploads/a.webp"]);
    assert.deepEqual(missingImageFiles(values, publicDir, cache), ["/images/faq.webp", "/images/missing.webp", "/uploads/a.webp.w1280.webp (run npm run uploads:variants)"]);
  } finally { remove(root); }
});

test("content may not point at a generated variant, a name the site cannot serve, or a path that leaves /images/ or /uploads/", () => {
  const root = tempDir();
  try {
    const publicDir = path.join(root, "public");
    fs.mkdirSync(path.join(publicDir, "uploads"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    const values = {
      variant: "/uploads/team/photo.jpg.w640.webp",
      large: { href: "/uploads/photo.webp.w1280.webp" },
      upper: "/uploads/Photo.webp",
      device: "/uploads/con.webp",
      site: "/images/Faq-Team.webp",
      up: "/uploads/../../package.json",
      dot: "/images/./faq.webp",
      hidden: "/uploads/.gitkeep",
      back: "/images/..\\..\\package.json",
      encoded: "/uploads/%2e%2e/package.json",
      fine: "/images/faq-team.webp",
      legacyName: "/uploads/photo-1280.webp",
    };
    const upload = "is not an upload the site can serve: use lowercase letters, digits, - and _ only, in folders too, and not a Windows device name such as con or nul, ending in .webp, .png, .jpg, .jpeg, .avif or .gif";
    const site = "is not a site image the site can serve: use lowercase letters, digits, - and _ only, in folders too, and not a Windows device name such as con or nul, ending in .webp, .png, .jpg, .jpeg, .avif, .gif or .svg";
    const variant = "is a generated variant: point at the original upload";
    assert.deepEqual(imageReferenceProblems(values), [
      `variant: /uploads/team/photo.jpg.w640.webp ${variant}`,
      `large.href: /uploads/photo.webp.w1280.webp ${variant}`,
      `upper: "/uploads/Photo.webp" ${upload}`,
      `device: "/uploads/con.webp" ${upload}`,
      `site: "/images/Faq-Team.webp" ${site}`,
      `up: "/uploads/../../package.json" ${upload}`,
      `dot: "/images/./faq.webp" ${site}`,
      `hidden: "/uploads/.gitkeep" ${upload}`,
      `back: "/images/..\\\\..\\\\package.json" ${site}`,
      `encoded: "/uploads/%2e%2e/package.json" ${upload}`,
    ]);
    assert.deepEqual(imageReferenceProblems({ list: [{ img: "/uploads/a.png.w640.webp" }] }), [`list[0].img: /uploads/a.png.w640.webp ${variant}`]);
    // Refused paths are not looked up on disk (package.json exists outside public/).
    assert.deepEqual(missingImageFiles(values, publicDir, path.join(root, "cache")), ["/images/faq-team.webp", "/uploads/photo-1280.webp"]);
  } finally { remove(root); }
});

// check-content runs on a temporary copy of what it reads, as in tests/content.test.mjs.
test("check-content refuses SVG and HTML uploads, variant references and missing variants, and passes real uploads", async () => {
  const root = tempDir();
  try {
    for (const dir of ["content", "src/lib", "scripts/lib", "public/images"]) fs.cpSync(dir, path.join(root, dir), { recursive: true });
    for (const file of ["scripts/check-content.mjs", "scripts/build-content-index.mjs"]) fs.copyFileSync(file, path.join(root, file));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    const env = { ...process.env, SITE_MODE: "preview", NEXT_PUBLIC_SHOW_SAMPLES: "" };
    const run = () => spawnSync(process.execPath, ["--experimental-strip-types", path.join(root, "scripts", "check-content.mjs")], { cwd: path.join(root, "src"), encoding: "utf8", env });
    const listed = (result) => result.stderr.split(/\r?\n/).filter((line) => line.startsWith("  - ")).map((line) => line.slice(4));
    const setImage = (file, img) => fs.writeFileSync(path.join(root, file), JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), img }, null, 2));
    const uploads = path.join(root, "public", "uploads");
    const cache = path.join(root, ".cache", "upload-variants"); // where the copied scripts/lib/uploads.mjs looks
    fs.mkdirSync(path.join(uploads, "team"), { recursive: true });

    // Real uploads with their variants: valid. One is named like the old variants, which is fine now.
    await solid(1600, 900).webp().toFile(path.join(uploads, "team", "faq.webp"));
    await solid(1280, 400).webp().toFile(path.join(uploads, "banner-1280.webp"));
    assert.deepEqual((await buildUploadVariants(uploads, { cacheDir: cache })).errors, []);
    fs.writeFileSync(path.join(uploads, ".gitkeep"), "");
    setImage("content/faq-card.json", "/uploads/team/faq.webp");
    setImage("content/engagements/assess.json", "/uploads/banner-1280.webp");
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Content valid: 12 routes; preview mode\./);

    // Planted SVG and HTML uploads, and a missing variant.
    fs.writeFileSync(path.join(uploads, "logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    fs.writeFileSync(path.join(uploads, "page.html"), "<!doctype html>");
    fs.rmSync(cachedVariant(cache, "team/faq.webp", 1280));
    result = run();
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /^\s+at /m, "no stack trace");
    for (const problem of [
      "public/uploads/logo.svg: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it",
      "public/uploads/page.html: only .webp, .png, .jpg, .jpeg, .avif and .gif images can be uploaded (SVG and other files are refused): remove it",
      "missing image variant: /uploads/team/faq.webp.w1280.webp (run npm run uploads:variants)",
    ]) assert.ok(listed(result).includes(problem), `${problem}\n${result.stderr}`);

    // Content that points at a variant is refused by the image field.
    setImage("content/faq-card.json", "/uploads/team/faq.webp.w640.webp");
    result = run();
    assert.equal(result.status, 1);
    assert.ok(listed(result).some((problem) => /^content\/faq-card\.json: img: use a lowercase file name/.test(problem)), result.stderr);
  } finally { remove(root); }
});
