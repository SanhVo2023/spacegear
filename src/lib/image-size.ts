// The size a browser shows an image at, read from the file's header: PNG, JPEG (after its EXIF orientation), GIF,
// WebP, AVIF (after its rotation) and SVG (width and height, or the viewBox). The Labs pages give every article image
// and cover its width and height from here, so the browser keeps the image's space before the file arrives and
// nothing below it moves (no layout shift). An upload renders from its WebP variants, which keep the original's
// proportions (scripts/build-upload-variants.mjs applies the orientation and only scales), so the original's size
// stands for them. Synchronous and dependency-free (the pages render at build time), erasable TypeScript
// (scripts/check-content.mjs loads it under --experimental-strip-types). Server and build only.
import fs from "node:fs";
import path from "node:path";

export type ImageSize = { width: number; height: number };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// JPEG start-of-frame markers (baseline, extended, progressive, lossless, arithmetic); C4, C8 and CC are not frames.
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
type Box = { type: string; start: number; end: number };

const sized = (width: number, height: number): ImageSize | undefined => (width > 0 && height > 0 ? { width, height } : undefined);
const turned = (size: ImageSize | undefined, quarter: boolean) => (size && quarter ? { width: size.height, height: size.width } : size);
const ascii = (bytes: Buffer, start: number, end: number) => bytes.toString("latin1", start, end);

function png(bytes: Buffer) {
  // IHDR is always the first chunk: the width and height are its first two numbers.
  return ascii(bytes, 12, 16) === "IHDR" ? sized(bytes.readUInt32BE(16), bytes.readUInt32BE(20)) : undefined;
}

function gif(bytes: Buffer) {
  return sized(bytes.readUInt16LE(6), bytes.readUInt16LE(8));
}

function webp(bytes: Buffer) {
  const chunk = ascii(bytes, 12, 16);
  if (chunk === "VP8 ") return sized(bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff);
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return sized((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X") return sized(bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1);
  return undefined;
}

/** The EXIF orientation (1 to 8) in a JPEG's APP1 TIFF data; 5 to 8 turn the picture a quarter. */
function orientation(bytes: Buffer, start: number, end: number): number {
  const little = ascii(bytes, start, start + 2) === "II";
  const u16 = (at: number) => (little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at));
  const ifd = start + (little ? bytes.readUInt32LE(start + 4) : bytes.readUInt32BE(start + 4));
  if (ifd + 2 > end) return 1;
  for (let entry = ifd + 2, left = u16(ifd); left > 0 && entry + 12 <= end; left--, entry += 12) {
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return 1;
}

function jpeg(bytes: Buffer) {
  let quarter = false;
  for (let at = 2; at + 9 < bytes.length; ) {
    if (bytes[at] !== 0xff) return undefined;
    const marker = bytes[at + 1];
    if (marker === 0xff) { at += 1; continue; } // a fill byte
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; } // no length
    if (marker === 0xd9 || marker === 0xda) return undefined; // the image or its scan before any frame header
    const length = bytes.readUInt16BE(at + 2);
    if (marker === 0xe1 && ascii(bytes, at + 4, at + 10) === "Exif\0\0") quarter = orientation(bytes, at + 10, at + 2 + length) >= 5;
    if (SOF.has(marker)) return turned(sized(bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)), quarter);
    at += 2 + length;
  }
  return undefined;
}

/** The boxes of an ISO-BMFF range (AVIF), in order. */
function boxes(bytes: Buffer, start: number, end: number): Box[] {
  const list: Box[] = [];
  for (let at = start; at + 8 <= end; ) {
    let length = bytes.readUInt32BE(at);
    let header = 8;
    if (length === 1) { length = Number(bytes.readBigUInt64BE(at + 8)); header = 16; }
    else if (length === 0) length = end - at;
    if (length < header || at + length > end) break;
    list.push({ type: ascii(bytes, at + 4, at + 8), start: at + header, end: at + length });
    at += length;
  }
  return list;
}
const find = (list: Box[], type: string) => list.find((box) => box.type === type);

function avif(bytes: Buffer) {
  const meta = find(boxes(bytes, 0, bytes.length), "meta");
  if (!meta) return undefined;
  const inside = boxes(bytes, meta.start + 4, meta.end); // meta is a full box: version and flags first
  const pitm = find(inside, "pitm");
  const primary = pitm && (bytes[pitm.start] === 0 ? bytes.readUInt16BE(pitm.start + 4) : bytes.readUInt32BE(pitm.start + 4));
  const iprp = find(inside, "iprp");
  const ipco = iprp && find(boxes(bytes, iprp.start, iprp.end), "ipco");
  if (!iprp || !ipco) return undefined;
  const properties = boxes(bytes, ipco.start, ipco.end);
  // ipma lists each item's properties (1-based indexes into ipco): the primary item's are the picture's.
  let own: Box[] = properties;
  const ipma = find(boxes(bytes, iprp.start, iprp.end), "ipma");
  if (ipma && primary !== undefined) {
    const version = bytes[ipma.start];
    const wide = (bytes.readUIntBE(ipma.start + 1, 3) & 1) === 1;
    let at = ipma.start + 8; // after version, flags and the entry count
    for (let entries = bytes.readUInt32BE(ipma.start + 4); entries > 0; entries--) {
      const item = version < 1 ? bytes.readUInt16BE(at) : bytes.readUInt32BE(at);
      at += version < 1 ? 2 : 4;
      const indexes: number[] = [];
      for (let count = bytes[at++]; count > 0; count--) {
        indexes.push(wide ? bytes.readUInt16BE(at) & 0x7fff : bytes[at] & 0x7f);
        at += wide ? 2 : 1;
      }
      if (item === primary) own = indexes.map((index) => properties[index - 1]).filter(Boolean);
    }
  }
  const ispe = find(own, "ispe");
  const irot = find(own, "irot");
  if (!ispe) return undefined;
  return turned(sized(bytes.readUInt32BE(ispe.start + 4), bytes.readUInt32BE(ispe.start + 8)), irot ? (bytes[irot.start] & 1) === 1 : false);
}

function svg(text: string) {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return undefined;
  const attribute = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`).exec(tag)?.[1];
  const pixels = (value: string | undefined) => (value && /^\s*\d+(?:\.\d+)?\s*(?:px)?\s*$/.test(value) ? parseFloat(value) : 0);
  const width = pixels(attribute("width"));
  const height = pixels(attribute("height"));
  if (width && height) return sized(Math.round(width), Math.round(height));
  const box = (attribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  return box.length === 4 && box.every(Number.isFinite) ? sized(Math.round(box[2]), Math.round(box[3])) : undefined;
}

/** An image's displayed size from its bytes, or undefined when the format is unknown or the header is cut short. */
export function imageSizeOf(bytes: Buffer): ImageSize | undefined {
  try {
    if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return png(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(bytes);
    const head = ascii(bytes, 0, 16);
    if (head.startsWith("GIF87a") || head.startsWith("GIF89a")) return gif(bytes);
    if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return webp(bytes);
    if (head.slice(4, 8) === "ftyp") return avif(bytes);
    const text = bytes.toString("utf8");
    return /<svg\b/i.test(text) ? svg(text) : undefined;
  } catch {
    return undefined; // a header cut short reads past the end
  }
}

/** A site image's size by its path (/uploads/… or /images/…, a file in public/), or undefined. */
export function siteImageSize(src: string, root: string = process.cwd()): ImageSize | undefined {
  if (!/^\/(?:uploads|images)\/[\w./-]+$/.test(src) || src.split("/").includes("..")) return undefined;
  try {
    return imageSizeOf(fs.readFileSync(path.join(root, "public", ...src.slice(1).split("/"))));
  } catch {
    return undefined;
  }
}
