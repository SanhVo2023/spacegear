// check-content's upload checks added with the CMS (Task 9): location data in image metadata, and
// rename advice that says what to change. scripts/lib/uploads.mjs holds the rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import sharp from "sharp";
import { UPLOAD_PATH, exifHasGps, locationProblems, rawProfileBytes, renameAdvice, suggestedUploadName, uploadProblems, xmpHasGps } from "../scripts/lib/uploads.mjs";
import { projectTempDir, removeProjectTemp } from "./helpers/project-temp.mjs";

sharp.cache(false);
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-upload-checks-"));
const remove = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
const solid = () => sharp({ create: { width: 32, height: 32, channels: 3, background: "#336699" } });
const GPS_EXIF = { IFD0: { Make: "Phone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "10/1 46/1 3000/100", GPSLongitudeRef: "E", GPSLongitude: "106/1 41/1 0/1" } };
const xmpPacket = (description) => `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${description}</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
const GPS_XMP = xmpPacket('<rdf:Description rdf:about="" xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="10,46.5N" exif:GPSLongitude="106,41.0E"/>');
const PLAIN_XMP = xmpPacket('<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Banner</dc:title></rdf:Description>');

/** A hand-made TIFF block: IFD0 with the given tags, and a GPS IFD with `gpsTags` when given. */
function tiff({ bigEndian = false, gpsTags = null, prefix = true } = {}) {
  const ifd = (entries) => {
    const block = Buffer.alloc(2 + entries.length * 12 + 4);
    const u16 = (value, at) => (bigEndian ? block.writeUInt16BE(value, at) : block.writeUInt16LE(value, at));
    const u32 = (value, at) => (bigEndian ? block.writeUInt32BE(value, at) : block.writeUInt32LE(value, at));
    u16(entries.length, 0);
    entries.forEach(([tag, type, value], index) => {
      u16(tag, 2 + index * 12);
      u16(type, 4 + index * 12);
      u32(1, 6 + index * 12);
      u32(value, 10 + index * 12);
    });
    return block;
  };
  const header = Buffer.from(bigEndian ? [0x4d, 0x4d, 0, 42, 0, 0, 0, 8] : [0x49, 0x49, 42, 0, 8, 0, 0, 0]);
  const ifd0Entries = [[0x010f, 2, 0]]; // Make (value not read)
  if (gpsTags) ifd0Entries.push([0x8825, 4, 8 + 2 + 2 * 12 + 4]);
  const parts = [header, ifd(ifd0Entries)];
  if (gpsTags) parts.push(ifd(gpsTags.map((tag) => [tag, 1, 0])));
  const body = Buffer.concat(parts);
  return prefix ? Buffer.concat([Buffer.from("Exif\0\0", "latin1"), body]) : body;
}

/** Inserts an XMP application extension ("XMP DataXMP") before a GIF's trailer, as Photoshop and exiftool write it. */
function gifWithXmp(gif, xmp) {
  const magic = Buffer.from([0x01, ...Array.from({ length: 256 }, (_, index) => 0xff - index), 0x00]);
  const extension = Buffer.concat([Buffer.from([0x21, 0xff, 0x0b]), Buffer.from("XMP DataXMP", "latin1"), Buffer.from(xmp, "utf8"), magic]);
  assert.equal(gif.at(-1), 0x3b, "a GIF ends with its trailer");
  return Buffer.concat([gif.subarray(0, -1), extension, Buffer.from([0x3b])]);
}

test("EXIF location data is found in the GPS section, in either byte order; a version-only GPS section is not location data", async () => {
  const fromSharp = (await sharp(await solid().withExif(GPS_EXIF).webp().toBuffer()).metadata()).exif;
  assert.equal(exifHasGps(fromSharp), true);
  assert.equal(exifHasGps((await sharp(await solid().withExif({ IFD0: { Make: "Phone" } }).webp().toBuffer()).metadata()).exif), false);
  assert.equal(exifHasGps(tiff({ gpsTags: [0x0000, 0x0002] })), true, "version and latitude");
  assert.equal(exifHasGps(tiff({ gpsTags: [0x0002], bigEndian: true })), true, "big-endian (Motorola) order");
  assert.equal(exifHasGps(tiff({ gpsTags: [0x0002], prefix: false })), true, "a bare TIFF block, as PNG stores it");
  assert.equal(exifHasGps(tiff({ gpsTags: [0x0000] })), false, "only the GPS version");
  assert.equal(exifHasGps(tiff()), false, "no GPS section");
  for (const damaged of [Buffer.from("Exif\0\0II", "latin1"), Buffer.from("not exif at all"), tiff({ gpsTags: [0x0002] }).subarray(0, 30)]) assert.equal(exifHasGps(damaged), null, "unreadable");
});

test("XMP location data is any exif:GPS… property except the version, under whatever prefix the exif namespace has", () => {
  assert.equal(xmpHasGps(GPS_XMP), true);
  assert.equal(xmpHasGps(xmpPacket('<rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/"><exif:GPSLongitude>106,41.0E</exif:GPSLongitude></rdf:Description>')), true, "element form");
  assert.equal(xmpHasGps(xmpPacket('<rdf:Description xmlns:e="http://ns.adobe.com/exif/1.0/" e:GPSAltitude="12/1"/>')), true, "another prefix");
  assert.equal(xmpHasGps(xmpPacket('<rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSVersionID="2.3.0.0"/>')), false, "the version alone");
  assert.equal(xmpHasGps(xmpPacket('<rdf:Description xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" photoshop:City="Hanoi" myexif:GPSLatitude="1"/>')), false, "no exif GPS property");
  assert.equal(xmpHasGps(PLAIN_XMP), false);
});

test("uploads that carry location data are refused in every format; clean ones, dotfiles and non-images are left to the other checks", async () => {
  const dir = tempDir();
  try {
    fs.mkdirSync(path.join(dir, "team"));
    await solid().withExif(GPS_EXIF).webp().toFile(path.join(dir, "phone.webp"));
    await solid().withXmp(GPS_XMP).jpeg().toFile(path.join(dir, "team", "xmp.jpg"));
    await solid().withExif(GPS_EXIF).png().toFile(path.join(dir, "exif.png"));
    await solid().withXmp(GPS_XMP).avif().toFile(path.join(dir, "xmp.avif"));
    fs.writeFileSync(path.join(dir, "xmp.gif"), gifWithXmp(await solid().gif().toBuffer(), GPS_XMP));
    await solid().withExif(GPS_EXIF).webp().toFile(path.join(dir, "Badly Named.webp"));
    // Clean: no metadata, metadata without location, a GIF with plain XMP, a hidden file, a fake.
    await solid().webp().toFile(path.join(dir, "clean.webp"));
    await solid().withExif({ IFD0: { Make: "Phone" } }).withXmp(PLAIN_XMP).jpeg().toFile(path.join(dir, "camera.jpg"));
    fs.writeFileSync(path.join(dir, "plain.gif"), gifWithXmp(await solid().gif().toBuffer(), PLAIN_XMP));
    await solid().withExif(GPS_EXIF).webp().toFile(path.join(dir, ".hidden.webp"));
    fs.writeFileSync(path.join(dir, "fake.webp"), "<!doctype html>");
    fs.writeFileSync(path.join(dir, "notes.txt"), "exif:GPSLatitude");
    const advice = "which would be published with the image: re-export it without location data and upload it again";
    assert.deepEqual(await locationProblems(dir), [
      `public/uploads/Badly Named.webp: contains location data (GPS in its EXIF metadata), ${advice}`,
      `public/uploads/exif.png: contains location data (GPS in its EXIF metadata), ${advice}`,
      `public/uploads/phone.webp: contains location data (GPS in its EXIF metadata), ${advice}`,
      `public/uploads/team/xmp.jpg: contains location data (GPS in its XMP metadata), ${advice}`,
      `public/uploads/xmp.avif: contains location data (GPS in its XMP metadata), ${advice}`,
      `public/uploads/xmp.gif: contains location data (GPS in its XMP metadata), ${advice}`,
    ]);
    assert.deepEqual(await locationProblems(path.join(dir, "no-such-folder")), [], "a missing folder is fine");
  } finally { remove(dir); }
});

/** ImageMagick's raw profile text: "\n<name>\n<length>\n<hex, 72 per line>\n". */
const rawProfile = (name, block) => `\n${name}\n${String(block.length).padStart(8)}\n${block.toString("hex").match(/.{1,72}/g).join("\n")}\n`;
/** A PNG with one more chunk right after IHDR. */
function pngWithChunk(png, type, data) {
  const at = 8 + 25;
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([png.subarray(0, at), length, body, crc, png.subarray(at)]);
}
/** A zTXt chunk, as ImageMagick writes its profiles by default. */
const zTXt = (keyword, text) => Buffer.concat([Buffer.from(`${keyword}\0\0`, "latin1"), zlib.deflateSync(Buffer.from(text, "latin1"))]);

test("ImageMagick's raw profile text chunks in a PNG are read too (convert photo.jpg photo.png keeps the EXIF there)", async () => {
  const gpsExif = (await sharp(await solid().withExif(GPS_EXIF).jpeg().toBuffer()).metadata()).exif;
  const plainExif = (await sharp(await solid().withExif({ IFD0: { Make: "Phone" } }).jpeg().toBuffer()).metadata()).exif;
  assert.deepEqual(rawProfileBytes(rawProfile("exif", gpsExif)), gpsExif);
  assert.equal(rawProfileBytes("\nexif\n      10\n00ff\n"), null, "the hex is shorter than the stated length");
  assert.equal(rawProfileBytes("a comment"), null);
  const png = await solid().png().toBuffer();
  const dir = tempDir();
  try {
    const files = {
      "exif-ztxt.png": pngWithChunk(png, "zTXt", zTXt("Raw profile type exif", rawProfile("exif", gpsExif))),
      "exif-text.png": pngWithChunk(png, "tEXt", Buffer.from(`Raw profile type exif\0${rawProfile("exif", gpsExif)}`, "latin1")),
      "xmp-ztxt.png": pngWithChunk(png, "zTXt", zTXt("Raw profile type xmp", rawProfile("xmp", Buffer.from(GPS_XMP)))),
      "app1-xmp.png": pngWithChunk(png, "zTXt", zTXt("Raw profile type APP1", rawProfile("APP1", Buffer.concat([Buffer.from("http://ns.adobe.com/xap/1.0/\0", "latin1"), Buffer.from(GPS_XMP)])))),
      "damaged.png": pngWithChunk(png, "zTXt", zTXt("Raw profile type exif", "\nexif\n     999\n4578\n")),
      "camera.png": pngWithChunk(png, "zTXt", zTXt("Raw profile type exif", rawProfile("exif", plainExif))),
      "comment.png": pngWithChunk(png, "tEXt", Buffer.from("Comment\0exif:GPSLatitude in a plain comment", "latin1")),
    };
    for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), bytes);
    const advice = "which would be published with the image: re-export it without location data and upload it again";
    assert.deepEqual(await locationProblems(dir, { label: "u" }), [
      `u/app1-xmp.png: contains location data (GPS in its XMP metadata), ${advice}`,
      "u/damaged.png: has metadata that cannot be read, so it may hide location data: re-export it without metadata and upload it again",
      `u/exif-text.png: contains location data (GPS in its EXIF metadata), ${advice}`,
      `u/exif-ztxt.png: contains location data (GPS in its EXIF metadata), ${advice}`,
      `u/xmp-ztxt.png: contains location data (GPS in its XMP metadata), ${advice}`,
    ]);
  } finally { remove(dir); }
});

test("an image whose metadata cannot be read is refused, because it may hide location data", async () => {
  const dir = tempDir();
  try {
    const webp = await solid().webp().toBuffer();
    fs.writeFileSync(path.join(dir, "broken.webp"), webp.subarray(0, 20));
    assert.deepEqual(await locationProblems(dir, { label: "uploads" }), [
      "uploads/broken.webp: cannot be read as an image, so it may hide location data: export it again and upload it again",
    ]);
  } finally { remove(dir); }
});

test("the rename advice suggests a name the build accepts and says what is wrong with the old one", () => {
  const rule = "upload names use lowercase letters, digits, - and _ only, in folders too, with a lowercase extension, and are not a Windows device name such as con or nul";
  assert.equal(renameAdvice("scan~2.webp"), `rename it, for example to scan-2.webp: ${rule} (not allowed here: "~")`);
  assert.equal(renameAdvice("ımg_0042.webp"), `rename it, for example to img_0042.webp: ${rule} (not allowed here: "ı", the dotless i that a Turkish-language browser writes for I)`);
  assert.equal(renameAdvice("Hero Shot.WEBP"), `rename it, for example to hero-shot.webp: ${rule} (not allowed here: capital letters, spaces)`);
  assert.equal(renameAdvice("con.webp"), `rename it, for example to con-1.webp: ${rule} (not allowed here: "con", a Windows device name)`);
  assert.equal(renameAdvice("team/a.jpg.w640.webp"), `rename it, for example to team/a-jpg-w640.webp: ${rule} (not allowed here: "." before the extension)`);
  assert.equal(renameAdvice("rtl\u{202E}gpj.png"), `rename it, for example to rtl-gpj.png: ${rule} (not allowed here: U+202E)`);
  const odd = ["a..b.jpg", "Photo.JPG", "with space.png", "café.jpg", "x[shrink=8].jpg", "rtl\u{202E}gpj.png", "con.webp", "nul.png", "aux.gif", "com1.jpg", "lpt9.avif", "prn.jpeg", "con/a.webp", "Team/Con/x.png", "~.png", "ıı.gif", "日本.webp", "İstanbul.jpg"];
  for (const rel of odd) {
    assert.equal(UPLOAD_PATH.test(rel), false, `${rel} is refused`);
    assert.ok(UPLOAD_PATH.test(suggestedUploadName(rel)), `${rel} -> ${suggestedUploadName(rel)} is accepted`);
  }
});

test("uploadProblems gives the rename advice for a name the build refuses", () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, "scan~2.gif"), "GIF89a");
    assert.deepEqual(uploadProblems(dir), [`public/uploads/scan~2.gif: ${renameAdvice("scan~2.gif")}`]);
  } finally { remove(dir); }
});

test("check-content lists an upload with location data next to the other problems (temporary project)", async () => {
  const root = projectTempDir("check-gps-");
  try {
    for (const dir of ["content", "src/lib", "scripts/lib", "public/images"]) fs.cpSync(dir, path.join(root, dir), { recursive: true });
    for (const file of ["scripts/check-content.mjs", "scripts/build-content-index.mjs"]) fs.copyFileSync(file, path.join(root, file));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    fs.mkdirSync(path.join(root, "public", "uploads"));
    await solid().withExif(GPS_EXIF).webp().toFile(path.join(root, "public", "uploads", "phone.webp"));
    await solid().webp().toFile(path.join(root, "public", "uploads", "scan~2.webp"));
    const env = { ...process.env, SITE_MODE: "preview", NEXT_PUBLIC_SHOW_SAMPLES: "" };
    const result = spawnSync(process.execPath, ["--experimental-strip-types", path.join(root, "scripts", "check-content.mjs")], { cwd: path.join(root, "src"), encoding: "utf8", env });
    assert.equal(result.status, 1, result.stdout);
    const listed = result.stderr.split(/\r?\n/).filter((line) => line.startsWith("  - ")).map((line) => line.slice(4));
    assert.deepEqual(listed, [
      `public/uploads/scan~2.webp: ${renameAdvice("scan~2.webp")}`,
      "public/uploads/phone.webp: contains location data (GPS in its EXIF metadata), which would be published with the image: re-export it without location data and upload it again",
    ]);
  } finally { removeProjectTemp(root); }
});
