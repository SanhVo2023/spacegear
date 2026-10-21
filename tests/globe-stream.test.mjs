import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import * as THREE from "three";

// The browser APIs the loader decodes with, stubbed for Node. Each fake bitmap records close(), and the
// decoder records how many decoded bitmaps were still open (not yet uploaded and released) when it started.
const open = new Set();
class FakeBitmap {
  constructor() { this.width = 4; this.height = 4; this.closed = false; open.add(this); }
  close() { this.closed = true; open.delete(this); }
}
const decodes = [];
globalThis.ImageBitmap = FakeBitmap;
globalThis.createImageBitmap = async (blob) => {
  decodes.push({ size: blob.size, openAtStart: open.size });
  await new Promise((resolve) => setTimeout(resolve, 20));
  return new FakeBitmap();
};
const { releaseSource, streamTextureSet } = await import("../src/components/globe/textures.ts");

// Records which images were attached to a disposed texture.
const disposedImages = new Set();
const dispose = THREE.Texture.prototype.dispose;
THREE.Texture.prototype.dispose = function () { disposedImages.add(this.image); return dispose.call(this); };

/** A local server: `routes` maps a path to a handler (request, response); every request is counted. */
async function serve(routes) {
  const hits = new Map();
  const closed = new Set();
  const server = http.createServer((request, response) => {
    hits.set(request.url, (hits.get(request.url) ?? 0) + 1);
    response.on("close", () => { if (!response.writableFinished) closed.add(request.url); });
    const route = routes[request.url];
    if (route) return route(request, response);
    response.statusCode = 404;
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    url: (path) => `${base}${path}`,
    hits,
    /** Paths whose response was cut off before it finished (an aborted download). */
    closed,
    stop() { server.closeAllConnections(); server.close(); },
  };
}
const body = (bytes, fill) => (request, response) => response.end(Buffer.alloc(bytes, fill));
const entry = (server, key, path, kind = "mask") => ({ key, url: server.url(path), bytes: 64, kind });
/** An uploader like EarthScene's frame loop: uploads (here: releases) a map a tick later. */
const uploader = (uploaded = []) => async (texture) => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  uploaded.push(texture);
  releaseSource(texture);
};

test("the stream decodes one map at a time, each after the previous one was uploaded, and returns the set", { timeout: 10_000 }, async () => {
  const server = await serve({ "/day.webp": body(61, 1), "/night.webp": body(62, 2), "/clouds.webp": body(63, 3) });
  try {
    decodes.length = 0;
    const uploaded = [];
    const set = await streamTextureSet(
      [entry(server, "day", "/day.webp", "color"), entry(server, "night", "/night.webp"), entry(server, "clouds", "/clouds.webp")],
      { signal: new AbortController().signal, upload: uploader(uploaded) },
    );
    assert.deepEqual(Object.keys(set), ["day", "night", "clouds"]);
    assert.deepEqual(uploaded, [set.day, set.night, set.clouds], "maps are uploaded in order, once each");
    assert.deepEqual(decodes.map((d) => d.size), [61, 62, 63], "maps are decoded in order");
    assert.deepEqual(decodes.map((d) => d.openAtStart), [0, 0, 0], "no decoded map is waiting for its upload when the next decode starts");
    assert.equal(set.day.colorSpace, THREE.SRGBColorSpace, "the stream makes textures like the first set's");
    assert.equal(set.night.format, THREE.RedFormat);
    assert.equal(set.night.anisotropy, 8);
    assert.equal(set.night.minFilter, THREE.LinearMipmapLinearFilter);
    assert.ok(Object.values(set).every((texture) => !disposedImages.has(texture.image)), "a streamed set is not disposed");
  } finally {
    server.stop();
  }
});

test("an abort stops the downloads, frees every map made so far and rejects; nothing is uploaded after it", { timeout: 10_000 }, async () => {
  let cloudsArrived;
  const arrived = new Promise((resolve) => { cloudsArrived = resolve; });
  const server = await serve({
    "/day.webp": body(64, 1),
    // Never finishes: the abort must cut it off.
    "/clouds.webp": (request, response) => { response.write(Buffer.alloc(8)); cloudsArrived(); },
  });
  try {
    const controller = new AbortController();
    const uploaded = [];
    // Aborts once the day map is uploaded and the clouds download is under way.
    const upload = async (texture) => {
      await uploader(uploaded)(texture);
      arrived.then(() => controller.abort());
    };
    await assert.rejects(
      streamTextureSet([entry(server, "day", "/day.webp", "color"), entry(server, "clouds", "/clouds.webp")], { signal: controller.signal, upload }),
      (error) => error.name === "AbortError",
    );
    assert.equal(uploaded.length, 1, "only the map that arrived before the abort was uploaded");
    assert.ok(uploaded[0].image.closed && disposedImages.has(uploaded[0].image), "the uploaded map is freed");
    // The server sees the cut-off connection a moment later; poll for it.
    for (const deadline = Date.now() + 5000; !server.closed.has("/clouds.webp") && Date.now() < deadline;) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(server.closed.has("/clouds.webp"), "the unfinished download is aborted");
  } finally {
    server.stop();
  }
});

test("an abort while a map waits for its upload frees that map", { timeout: 10_000 }, async () => {
  const server = await serve({ "/day.webp": body(64, 1) });
  try {
    const controller = new AbortController();
    let waiting = null;
    const upload = (texture) => {
      waiting = texture;
      setTimeout(() => controller.abort(), 20);
      return new Promise(() => {}); // the frame never comes (the hero is off screen, then unmounts)
    };
    await assert.rejects(streamTextureSet([entry(server, "day", "/day.webp", "color")], { signal: controller.signal, upload }), (error) => error.name === "AbortError");
    assert.ok(waiting && waiting.image.closed && disposedImages.has(waiting.image), "the waiting map is freed");
  } finally {
    server.stop();
  }
});

test("a map that fails part-way frees the maps already made, rethrows and is never retried", { timeout: 10_000 }, async () => {
  // The night map fails only once the day map has been uploaded and the clouds map requested, so the
  // failure always lands part-way.
  let dayUploaded, cloudsRequested;
  const afterDay = new Promise((resolve) => { dayUploaded = resolve; });
  const afterClouds = new Promise((resolve) => { cloudsRequested = resolve; });
  const server = await serve({
    "/day.webp": body(64, 1),
    "/night.webp": (request, response) => Promise.all([afterDay, afterClouds]).then(() => { response.statusCode = 404; response.end(); }),
    "/clouds.webp": (request, response) => { cloudsRequested(); body(64, 3)(request, response); },
  });
  try {
    const uploaded = [];
    const upload = async (texture) => {
      await uploader(uploaded)(texture);
      dayUploaded();
    };
    await assert.rejects(
      streamTextureSet(
        [entry(server, "day", "/day.webp", "color"), entry(server, "night", "/night.webp"), entry(server, "clouds", "/clouds.webp")],
        { signal: new AbortController().signal, upload },
      ),
      /responded with 404/,
    );
    assert.equal(uploaded.length, 1, "the maps after the failed one are never uploaded");
    assert.ok(uploaded[0].image.closed && disposedImages.has(uploaded[0].image), "the map uploaded before the failure is freed");
    assert.deepEqual([...server.hits.keys()].sort(), ["/clouds.webp", "/day.webp", "/night.webp"]);
    assert.ok([...server.hits.values()].every((count) => count === 1), `each map is requested once (${JSON.stringify([...server.hits])})`);
  } finally {
    server.stop();
  }
});

test("a signal that has already aborted fetches nothing", { timeout: 10_000 }, async () => {
  const server = await serve({ "/day.webp": body(64, 1) });
  try {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(streamTextureSet([entry(server, "day", "/day.webp", "color")], { signal: controller.signal, upload: uploader() }), (error) => error.name === "AbortError");
    assert.equal(server.hits.size, 0);
  } finally {
    server.stop();
  }
});
