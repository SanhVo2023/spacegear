import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import * as THREE from "three";

// The browser APIs the loader decodes with, stubbed for Node. Each fake bitmap records close().
class FakeBitmap {
  constructor() { this.width = 4; this.height = 4; this.closed = false; }
  close() { this.closed = true; }
}
const decoded = [];
const SLOW_DECODE_BYTES = 65;
globalThis.ImageBitmap = FakeBitmap;
globalThis.createImageBitmap = async (blob) => {
  // A 65-byte file decodes slowly, so it is still decoding when another map fails.
  if (blob.size === SLOW_DECODE_BYTES) await new Promise((resolve) => setTimeout(resolve, 300));
  const bitmap = new FakeBitmap();
  decoded.push(bitmap);
  return bitmap;
};
// THREE.FileLoader reports byte progress with ProgressEvent, which Node lacks.
globalThis.ProgressEvent ??= class ProgressEvent extends Event { constructor(type, init = {}) { super(type); Object.assign(this, init); } };

const { disposeTextureSet, loadTextureSet } = await import("../src/components/globe/textures.ts");

// Records which images were attached to a disposed texture.
const disposedImages = new Set();
const dispose = THREE.Texture.prototype.dispose;
THREE.Texture.prototype.dispose = function () { disposedImages.add(this.image); return dispose.call(this); };

test("disposing a set closes every decoded bitmap and frees every texture", () => {
  const set = { day: new THREE.Texture(new FakeBitmap()), clouds: new THREE.Texture(new FakeBitmap()) };
  disposeTextureSet(set);
  for (const [key, texture] of Object.entries(set)) {
    assert.equal(texture.image.closed, true, `${key}: bitmap closed`);
    assert.ok(disposedImages.has(texture.image), `${key}: texture disposed`);
  }
});

test("a failed set aborts the manager's downloads, frees every map that loaded and rethrows the first error", async () => {
  const server = http.createServer((request, response) => {
    if (request.url === "/ok.webp") return response.end(Buffer.alloc(64, 1));
    // Downloads at once but is still decoding when the failure arrives.
    if (request.url === "/late.webp") return response.end(Buffer.alloc(SLOW_DECODE_BYTES, 2));
    // Fails after the first map has loaded and decoded.
    setTimeout(() => { response.statusCode = 404; response.end(); }, 100);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const manager = new THREE.LoadingManager();
  let aborts = 0;
  const abort = manager.abort;
  manager.abort = function () { aborts += 1; return abort.call(this); };
  try {
    const before = decoded.length;
    await assert.rejects(
      loadTextureSet(
        [
          { key: "ok", url: `${base}/ok.webp`, bytes: 64, kind: "color" },
          { key: "late", url: `${base}/late.webp`, bytes: SLOW_DECODE_BYTES, kind: "mask" },
          { key: "missing", url: `${base}/missing.webp`, bytes: 64, kind: "mask" },
        ],
        { manager },
      ),
      /responded with 404/,
    );
    assert.equal(aborts, 1, "the other downloads are aborted through the manager");
    const loaded = decoded.slice(before);
    assert.equal(loaded.length, 2, "the loader waited for the map that was still decoding");
    assert.ok(loaded.every((bitmap) => bitmap.closed), "every decoded bitmap is closed");
    assert.ok(loaded.every((bitmap) => disposedImages.has(bitmap)), "every texture is disposed");
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
