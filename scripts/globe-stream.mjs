// The 4k streaming check (used by browser-check.mjs and the scratch capture scripts).
//
// The 4k rule reads the GPU's renderer string, and headless Chromium renders WebGL with whatever the
// machine offers: its real GPU through ANGLE where it can (the owner's machine: an AMD Radeon iGPU on
// D3D11), SwiftShader (software) elsewhere. `fakeGpu` fixes what a page reports, so the checks behave
// the same everywhere: a capable desktop (a hardware GPU's debug renderer string and 8 GB of device
// memory) or a software renderer. maxTextureSize and the rendering itself stay real.
// `textureProbe` records, from the page's own WebGL2 calls, every texture allocation (with its exact
// size in GPU memory), upload and deletion with the animation frame it ran in, and which globe tier
// (2048 or 4096 wide 2:1 maps) each frame's draw calls had bound. It also logs idle callbacks and long
// tasks. `streamSummary` turns a probe dump into the numbers the checks assert, and `streamingCheck`
// is the browser check itself.
import assert from "node:assert/strict";
import sharp from "sharp";
import { canvasShot } from "./globe-drag.mjs";

export const CAPABLE_GPU = "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)";
export const SOFTWARE_GPU = "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)";
export const CAPABLE_DESKTOP = { renderer: CAPABLE_GPU, deviceMemory: 8 };
export const SOFTWARE_RENDERER = { renderer: SOFTWARE_GPU };

/**
 * Init script (runs in the page): WEBGL_debug_renderer_info reports `renderer`, and navigator.deviceMemory
 * reports `deviceMemory` when one is given. window.__realRenderer() still reads the real renderer.
 */
export function fakeGpu({ renderer, deviceMemory }) {
  const UNMASKED_RENDERER_WEBGL = 0x9246;
  for (const proto of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
    if (!proto) continue;
    const getParameter = proto.getParameter;
    proto.getParameter = function (name) { return name === UNMASKED_RENDERER_WEBGL ? renderer : getParameter.call(this, name); };
    if (proto === window.WebGL2RenderingContext?.prototype) {
      window.__realRenderer = () => {
        const gl = document.createElement("canvas").getContext("webgl2");
        if (!gl) return null;
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        const name = String(getParameter.call(gl, info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return name;
      };
    }
  }
  if (deviceMemory !== undefined) Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => deviceMemory });
}

/** Init script (runs in the page): see the header. The dump is `window.__texProbe`. */
export function textureProbe() {
  const now = () => performance.now();
  const probe = { frame: 0, frameTime: -1, textures: {}, uploads: [], deletes: [], frames: [], idle: [], longTasks: [] };
  window.__texProbe = probe;
  // Every rAF callback of one frame gets the same timestamp: a new timestamp is a new frame.
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (callback) {
    return raf.call(window, (time) => {
      if (time !== probe.frameTime) { probe.frameTime = time; probe.frame += 1; }
      callback(time);
    });
  };
  const ric = window.requestIdleCallback;
  if (ric) window.requestIdleCallback = function (callback, options) {
    return ric.call(window, (deadline) => { probe.idle.push({ t: now(), didTimeout: deadline.didTimeout }); callback(deadline); }, options);
  };
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) probe.longTasks.push({ t: Math.round(e.startTime), ms: Math.round(e.duration) }); }).observe({ type: "longtask", buffered: true });
  } catch { /* no long-task timing */ }
  const proto = window.WebGL2RenderingContext?.prototype;
  if (!proto) return;
  const ids = new WeakMap();
  let nextId = 1;
  const idOf = (texture) => {
    if (!texture) return 0;
    let id = ids.get(texture);
    if (!id) ids.set(texture, (id = nextId++));
    return id;
  };
  // Bound 2D textures per unit, per context.
  const contexts = new WeakMap();
  const stateOf = (gl) => {
    let state = contexts.get(gl);
    if (!state) contexts.set(gl, (state = { unit: 0, bound: [] }));
    return state;
  };
  // Bytes per texel: R8, RG8, RGB8, SRGB8, RGBA8, SRGB8_ALPHA8 (anything else counts as 4).
  const BYTES = { 0x8229: 1, 0x822b: 2, 0x8051: 3, 0x8c41: 3, 0x8058: 4, 0x8c43: 4 };
  const activeTexture = proto.activeTexture;
  proto.activeTexture = function (unit) {
    stateOf(this).unit = unit - this.TEXTURE0;
    return activeTexture.call(this, unit);
  };
  const bindTexture = proto.bindTexture;
  proto.bindTexture = function (target, texture) {
    if (target === this.TEXTURE_2D) {
      const state = stateOf(this);
      state.bound[state.unit] = idOf(texture);
    }
    return bindTexture.call(this, target, texture);
  };
  const texStorage2D = proto.texStorage2D;
  proto.texStorage2D = function (target, levels, format, width, height) {
    if (target === this.TEXTURE_2D) {
      const state = stateOf(this);
      const id = state.bound[state.unit];
      let bytes = 0;
      for (let level = 0; level < levels; level++) bytes += Math.max(1, width >> level) * Math.max(1, height >> level) * (BYTES[format] ?? 4);
      probe.textures[id] = { id, width, height, format, levels, bytes, frame: probe.frame, t: now(), deletedFrame: null, deletedT: null };
    }
    return texStorage2D.call(this, target, levels, format, width, height);
  };
  const texSubImage2D = proto.texSubImage2D;
  proto.texSubImage2D = function (target, level, ...rest) {
    const state = stateOf(this);
    const id = state.bound[state.unit];
    const start = now();
    const result = texSubImage2D.call(this, target, level, ...rest);
    if (target === this.TEXTURE_2D && level === 0) probe.uploads.push({ id, frame: probe.frame, t: start, ms: now() - start, mipmapMs: 0 });
    return result;
  };
  const generateMipmap = proto.generateMipmap;
  proto.generateMipmap = function (target) {
    const state = stateOf(this);
    const start = now();
    const result = generateMipmap.call(this, target);
    const last = probe.uploads.at(-1);
    if (target === this.TEXTURE_2D && last && last.id === state.bound[state.unit]) last.mipmapMs = now() - start;
    return result;
  };
  const deleteTexture = proto.deleteTexture;
  proto.deleteTexture = function (texture) {
    const id = idOf(texture);
    const known = probe.textures[id];
    if (known) { known.deletedFrame = probe.frame; known.deletedT = now(); }
    probe.deletes.push({ id, frame: probe.frame, t: now() });
    // Deleting a texture unbinds it from this context's units.
    const state = stateOf(this);
    state.bound = state.bound.map((bound) => (bound === id ? 0 : bound));
    return deleteTexture.call(this, texture);
  };
  const tierOf = (id) => {
    const t = probe.textures[id];
    if (!t || t.deletedT !== null || t.width !== 2 * t.height) return null;
    return t.width === 4096 ? "4k" : t.width === 2048 ? "2k" : null;
  };
  for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced", "drawRangeElements"]) {
    const draw = proto[name];
    if (!draw) continue;
    proto[name] = function (...args) {
      const tiers = new Set(stateOf(this).bound.map(tierOf).filter(Boolean));
      if (tiers.size) {
        let entry = probe.frames.at(-1);
        if (!entry || entry.frame !== probe.frame) probe.frames.push((entry = { frame: probe.frame, t: Math.round(now()), tiers: [], mixed: false }));
        for (const tier of tiers) if (!entry.tiers.includes(tier)) entry.tiers.push(tier);
        if (tiers.size > 1) entry.mixed = true;
      }
      return draw.apply(this, args);
    };
  }
}

/** Reads the probe, the texture requests' resource timing and the hero log from the page. */
export function readStream(page) {
  return page.evaluate(() => ({
    probe: window.__texProbe,
    log: window.__heroLog ?? [],
    resources: performance.getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/textures/earth/"))
      .map((entry) => ({ url: new URL(entry.name).pathname, start: entry.startTime, end: entry.responseEnd, bytes: entry.encodedBodySize })),
  }));
}

/**
 * The long task that runs the first 4k upload (the day map, sRGB RGBA) may take this long; every other task
 * during the stream stays under the spec's 100 ms. Measured here: 49–65 ms warm, up to 82 ms cold. A
 * first upload 120 ms slower than that measures 146–150 ms, so 150 would let it through.
 */
export const FIRST_UPLOAD_ALLOWANCE_MS = 120;

const MIB = 1024 * 1024;
const mib = (bytes) => Math.round((bytes / MIB) * 10) / 10;

/** The numbers the 4k checks assert and report, from a `readStream` dump. */
export function streamSummary({ probe, log, resources }) {
  const at = (attr, value) => log.find((entry) => entry.attr === attr && entry.value === value)?.t ?? null;
  const textures = Object.values(probe.textures);
  const globe = (width) => textures.filter((t) => t.width === width && t.height * 2 === width);
  const four = globe(4096), two = globe(2048);
  const uploadsOf = (set) => probe.uploads.filter((upload) => set.some((t) => t.id === upload.id));
  const uploads4k = uploadsOf(four), uploads2k = uploadsOf(two);
  const requests4k = resources.filter((r) => r.url.includes("/textures/earth/4k/"));
  const firstRequest4k = requests4k.length ? Math.min(...requests4k.map((r) => r.start)) : null;
  const first4kFrame = probe.frames.find((f) => f.tiers.includes("4k")) ?? null;
  const last2kFrame = probe.frames.findLast((f) => f.tiers.includes("2k")) ?? null;
  const live = (time) => textures.filter((t) => t.t <= time && (t.deletedT === null || t.deletedT > time));
  const liveBytes = (time) => live(time).reduce((sum, t) => sum + t.bytes, 0);
  const firstAlloc4k = four.length ? Math.min(...four.map((t) => t.t)) : null;
  const events = [...textures.map((t) => t.t), ...textures.filter((t) => t.deletedT !== null).map((t) => t.deletedT)].sort((a, b) => a - b);
  const swap = at("data-globe-tier", "4k");
  const streamEnd = swap ?? Infinity;
  const longDuringStream = firstRequest4k === null ? [] : probe.longTasks.filter((task) => task.t + task.ms >= firstRequest4k && task.t <= streamEnd + 500);
  // The first 4k upload (the day map, sRGB RGBA) is the slow one on a cold GPU: 48–74 ms on the
  // integrated GPU here. The long task it runs in is told apart from the rest (start times are rounded
  // to the millisecond, hence the 1 ms of slack).
  const firstUpload4k = uploads4k.length ? uploads4k.reduce((first, upload) => (upload.t < first.t ? upload : first)) : null;
  const atFirstUpload = (task) => firstUpload4k !== null && task.t <= firstUpload4k.t + firstUpload4k.ms + 1 && task.t + task.ms >= firstUpload4k.t - 1;
  const readyAt = at("data-globe", "ready");
  const doneAt = at("data-intro", "done");
  const gate = Math.max(readyAt ?? 0, doneAt ?? 0);
  return {
    intro: { play: at("data-intro", "play"), reveal: at("data-intro", "reveal"), done: doneAt, ready: readyAt, swap },
    requests4k,
    bytes4k: requests4k.reduce((sum, r) => sum + r.bytes, 0),
    firstRequest4k,
    lastUpload2k: uploads2k.length ? Math.max(...uploads2k.map((u) => u.t)) : null,
    idleBeforeStream: firstRequest4k === null ? null : probe.idle.find((idle) => idle.t >= gate && idle.t <= firstRequest4k) ?? null,
    allocations4k: four.map((t) => ({ format: t.format, levels: t.levels, mib: mib(t.bytes) })),
    uploads4k: uploads4k.map((u) => ({ frame: u.frame, ms: Math.round(u.ms), mipmapMs: Math.round(u.mipmapMs) })),
    uploadFrames4k: new Set(uploads4k.map((u) => u.frame)).size,
    live2k: two.filter((t) => t.deletedT === null).length,
    deleted2k: two.filter((t) => t.deletedT !== null).length,
    allocated2kAfterStream: firstAlloc4k === null ? 0 : two.filter((t) => t.t > firstAlloc4k).length,
    live4k: four.filter((t) => t.deletedT === null).length,
    mixedFrames: probe.frames.filter((f) => f.mixed).length,
    first4kFrame: first4kFrame?.frame ?? null,
    last2kFrame: last2kFrame?.frame ?? null,
    frames: probe.frame,
    memory: {
      beforeStreamMiB: firstAlloc4k === null ? null : mib(liveBytes(firstAlloc4k - 0.001)),
      peakMiB: mib(Math.max(0, ...events.map(liveBytes))),
      afterSwapMiB: mib(liveBytes(Infinity)),
      globe2kMiB: mib(two.reduce((sum, t) => sum + t.bytes, 0)),
      globe4kMiB: mib(four.reduce((sum, t) => sum + t.bytes, 0)),
    },
    longestTaskDuringStream: Math.max(0, ...longDuringStream.map((task) => task.ms)),
    longTasksDuringStream: longDuringStream.map((task) => task.ms),
    firstUpload4kMs: firstUpload4k === null ? null : Math.round(firstUpload4k.ms),
    /** The long task that ran the first 4k upload, in ms (null when it stayed under 50 ms). */
    firstUploadLongTask: longDuringStream.filter(atFirstUpload).map((task) => task.ms)[0] ?? null,
    otherLongTasksDuringStream: longDuringStream.filter((task) => !atFirstUpload(task)).map((task) => task.ms),
  };
}

const SCENE = "#home .hero-scene";
const tierOf = (page) => page.locator(SCENE).getAttribute("data-globe-tier");
const uploads4kSoFar = (page) => page.evaluate(() => window.__texProbe.uploads.filter((u) => window.__texProbe.textures[u.id]?.width === 4096).length);
const firstRequestSeen = (page) => page.waitForFunction(() => performance.getEntriesByType("resource").some((e) => e.name.includes("/textures/earth/4k/")), null, { timeout: 30000, polling: "raf" });
const scrollHeroAway = (page) => page.evaluate(() => window.scrollTo({ top: document.getElementById("home").offsetHeight + 400, behavior: "instant" }));
const scrollHeroBack = (page) => page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
/** Waits until the hero canvas has drawn nothing for 400 ms (its frame loop stopped off screen). */
async function framesStopped(page, label) {
  const stopped = await page.waitForFunction(() => {
    const last = window.__texProbe.frames.at(-1);
    return Boolean(last) && performance.now() - last.t > 400;
  }, null, { timeout: 5000, polling: 50 }).then(() => true, () => false);
  assert.ok(stopped, `${label}: the hero canvas stops drawing once the hero is off screen`);
}
/** Resolves once the hero canvas has drawn `count` more frames. */
async function framesDrawn(page, count) {
  const start = await page.evaluate(() => window.__texProbe.frames.length);
  await page.waitForFunction((n) => window.__texProbe.frames.length >= n, start + count, { timeout: 10000, polling: 20 });
}

/** Mean luma of the globe's part of the hero canvas (the copy layers hidden), 0–255. */
export async function globeLuma(page, region = { x: 0.55, y: 0.2, w: 0.4, h: 0.6 }) {
  const png = await canvasShot(page);
  const image = sharp(png);
  const { width, height } = await image.metadata();
  const data = await image
    .extract({ left: Math.round(width * region.x), top: Math.round(height * region.y), width: Math.round(width * region.w), height: Math.round(height * region.h) })
    .removeAlpha().resize(96, 64, { fit: "fill" }).raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < data.length; i += 3) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  return Math.round((sum / (data.length / 3)) * 10) / 10;
}

/** Errors, and three's texture and renderer warnings; R3F's own THREE.Clock deprecation notice is not about textures. */
function watchProblems(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror ${error.message.slice(0, 300)}`));
  page.on("console", (message) => {
    if (message.type() === "error" || (message.type() === "warning" && /THREE\.WebGL|texture/i.test(message.text()))) problems.push(`console.${message.type()} ${message.text().slice(0, 300)}`);
  });
  return problems;
}

/**
 * An intro visit (the page's first load in its tab): the 2k set first, then the 4k stream after the
 * intro, its reveal and an idle callback, one upload per frame, a swap without a mixed frame, no 2k
 * texture left alive, and no long task over 100 ms while it streams (the spec's rule after the intro),
 * apart from the first upload's on a cold GPU, which gets FIRST_UPLOAD_ALLOWANCE_MS.
 */
export async function introVisit(page, { revealEndMs }) {
  await page.waitForSelector(`${SCENE}[data-globe="ready"]`, { timeout: 45000 });
  assert.equal(await tierOf(page), "2k", "capable desktop: the 2k tier is on screen first");
  try {
    await page.waitForFunction((scene) => document.querySelector(scene)?.dataset.globeTier === "4k", SCENE, { timeout: 60000 });
  } catch {
    throw new Error(`capable desktop: the 4k tier never came on screen (${JSON.stringify(streamSummary(await readStream(page)))})`);
  }
  // A few more frames, so a 2k map that was still referenced would show up at draw time.
  await framesDrawn(page, 3);
  const stream = streamSummary(await readStream(page));
  const facts = JSON.stringify({ intro: stream.intro, firstRequest4k: stream.firstRequest4k, lastUpload2k: stream.lastUpload2k, idle: stream.idleBeforeStream, uploads4k: stream.uploads4k });
  assert.ok(stream.intro.play !== null, `capable desktop: the intro plays (precondition; ${facts})`);
  assert.equal(stream.requests4k.length, 5, `capable desktop: the five 4k maps are fetched once each (${JSON.stringify(stream.requests4k)})`);
  assert.ok(stream.intro.done !== null && stream.firstRequest4k >= stream.intro.done && stream.firstRequest4k >= stream.intro.ready, `capable desktop: the 4k maps are requested only after the intro is done and the first frame is on screen (${facts})`);
  assert.ok(stream.firstRequest4k >= stream.intro.reveal + revealEndMs, `capable desktop: the 4k stream waits for the globe's reveal and flare to end (${revealEndMs} ms after the lift; ${facts})`);
  assert.ok(stream.lastUpload2k !== null && stream.firstRequest4k > stream.lastUpload2k, `capable desktop: the 4k stream starts after the 2k uploads (${facts})`);
  assert.ok(stream.idleBeforeStream, `capable desktop: the 4k stream starts from an idle callback (${facts})`);
  assert.equal(stream.uploads4k.length, 5, `capable desktop: each 4k map is uploaded once (${facts})`);
  assert.equal(stream.uploadFrames4k, 5, `capable desktop: the 4k maps upload one per frame (${facts})`);
  assert.equal(await tierOf(page), "4k", "capable desktop: the hero reports the 4k tier");
  assert.deepEqual(
    { live4k: stream.live4k, live2k: stream.live2k, deleted2k: stream.deleted2k, reallocated2k: stream.allocated2kAfterStream },
    { live4k: 5, live2k: 0, deleted2k: 5, reallocated2k: 0 },
    "capable desktop: after the swap the 2k maps are freed and only the 4k maps remain",
  );
  assert.ok(stream.mixedFrames === 0 && stream.last2kFrame < stream.first4kFrame, `capable desktop: the maps swap together, so no frame mixes the 2k and 4k sets (${JSON.stringify({ mixed: stream.mixedFrames, last2k: stream.last2kFrame, first4k: stream.first4kFrame })})`);
  // The spec's rule after the intro is no long task over 100 ms. The one exception is the task that runs
  // the first 4k upload on a cold GPU (the day map), which gets FIRST_UPLOAD_ALLOWANCE_MS; its length is reported.
  const longTasks = JSON.stringify({ firstUpload: stream.firstUploadLongTask, firstUploadMs: stream.firstUpload4kMs, others: stream.otherLongTasksDuringStream });
  assert.ok(stream.otherLongTasksDuringStream.every((ms) => ms < 100), `capable desktop: no long task over 100 ms while the 4k set streams, apart from the first upload (${longTasks} ms)`);
  assert.ok(!(stream.firstUploadLongTask >= FIRST_UPLOAD_ALLOWANCE_MS), `capable desktop: the first 4k upload (the day map, on a cold GPU) runs in a task under ${FIRST_UPLOAD_ALLOWANCE_MS} ms (${longTasks} ms)`);
  return stream;
}

/**
 * The hero scrolled away and back after an intro visit: the globe stays lit. R3F restarts its clock
 * whenever the frame loop pauses and resumes, so a reveal timed on that clock would replay from black.
 * Right after the return the rig and the sun may still be easing back into place, so that capture only
 * has to be half as bright (a replayed reveal is black); 1.2 s later it is as lit as before, within 20 %.
 */
export async function checkResumeLit(page) {
  const before = await globeLuma(page);
  await scrollHeroAway(page);
  await framesStopped(page, "capable desktop");
  await scrollHeroBack(page);
  await framesDrawn(page, 4);
  const rightAfter = await globeLuma(page);
  await page.waitForTimeout(1200);
  const later = await globeLuma(page);
  const luma = { before, rightAfter, later };
  assert.ok(rightAfter >= before * 0.5 && later >= before * 0.8, `capable desktop: the globe stays lit when the hero comes back on screen (luma ${JSON.stringify(luma)})`);
  return luma;
}

/** A scene that fails after the swap (a lost context) drops back to the poster and never claims the 4k tier. */
export async function checkLossResetsTier(page) {
  await page.evaluate((scene) => document.querySelector(`${scene} canvas`).getContext("webgl2").getExtension("WEBGL_lose_context").loseContext(), SCENE);
  await page.waitForFunction((scene) => document.querySelector(scene)?.dataset.globe === "failed", SCENE, { timeout: 10000, polling: 50 });
  assert.equal(await tierOf(page), "2k", "capable desktop: a scene that fails after the swap no longer reports the 4k tier");
}

/**
 * A repeat visit (a reload in the same tab: no intro). The stream waits out the canvas's fade-in over the
 * poster and the copy's entrance (`settleMs` after the first frame), and pauses while the hero is off
 * screen: scrolled away just after the 4k requests, no map uploads; back on screen, the swap completes
 * without fetching anything twice.
 */
export async function repeatVisit(page, { settleMs }) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(`${SCENE}[data-globe="ready"]`, { timeout: 45000 });
  assert.equal(await tierOf(page), "2k", "repeat visit: the 2k tier is on screen first");
  await firstRequestSeen(page);
  const early = streamSummary(await readStream(page));
  const timing = JSON.stringify({ intro: early.intro, firstRequest4k: early.firstRequest4k });
  assert.equal(early.intro.play, null, `repeat visit: no intro (precondition; ${timing})`);
  // The ready attribute lands a moment after the frame that announced it, and the wait is counted from
  // that frame: 200 ms of slack covers the commit. A stream that skips the wait starts about 10 ms
  // after the attribute, so it still fails.
  assert.ok(early.firstRequest4k >= early.intro.ready + settleMs - 200,`repeat visit: the 4k stream waits ${settleMs} ms after the first frame, past the canvas fade-in and the copy's entrance (${timing})`);
  await scrollHeroAway(page);
  await framesStopped(page, "repeat visit");
  const away = await uploads4kSoFar(page);
  await page.waitForTimeout(1500); // the whole stream takes about 0.6 s when it is not paused
  const stillAway = { uploads: await uploads4kSoFar(page), tier: await tierOf(page) };
  assert.ok(away < 5, `repeat visit: the stream is still under way when the hero leaves the screen (precondition; ${away} uploads)`);
  assert.deepEqual(stillAway, { uploads: away, tier: "2k" }, "repeat visit: no 4k map uploads while the hero is off screen");
  await scrollHeroBack(page);
  await page.waitForFunction((scene) => document.querySelector(scene)?.dataset.globeTier === "4k", SCENE, { timeout: 30000, polling: 50 });
  await framesDrawn(page, 3);
  const stream = streamSummary(await readStream(page));
  assert.deepEqual(
    { requests: stream.requests4k.length, uploads: stream.uploads4k.length, uploadFrames: stream.uploadFrames4k, mixed: stream.mixedFrames, live2k: stream.live2k, live4k: stream.live4k },
    { requests: 5, uploads: 5, uploadFrames: 5, mixed: 0, live2k: 0, live4k: 5 },
    "repeat visit: back on screen the stream resumes, one upload per frame, and swaps without fetching anything twice",
  );
  assert.ok(stream.idleBeforeStream, "repeat visit: the 4k stream starts from an idle callback");
  return { ...stream, pausedAt: away };
}

/**
 * A 4k map that fails (404) mid-stream: its response is held until the probe has seen a 4k map
 * uploaded, so the failure always lands after some maps were made. The maps already made are freed, the
 * 2k set stays on screen, nothing is fetched again (watched for `watchMs` from the failure: a retry
 * would go through a new idle callback, which fires within STREAM_IDLE_TIMEOUT_MS), and nothing throws.
 */
export async function failedStream(page, { watchMs }) {
  assert.ok(watchMs > 0, `failed stream: the retry watch is set (${watchMs} ms)`);
  const failing = "**/textures/earth/4k/clouds.webp";
  let failedAt = null;
  await page.route(failing, async (route) => {
    await page.waitForFunction(() => window.__texProbe.uploads.some((u) => window.__texProbe.textures[u.id]?.width === 4096), null, { timeout: 30000, polling: 20 }).catch(() => {});
    failedAt = Date.now();
    await route.fulfill({ status: 404, body: "" }).catch(() => {});
  });
  const requested = [];
  const onRequest = (request) => { if (request.url().includes("/textures/earth/4k/")) requested.push(new URL(request.url()).pathname); };
  const errors = [];
  const onError = (error) => errors.push(`pageerror ${error.message.slice(0, 300)}`);
  const onConsole = (message) => {
    if (message.type() === "error" && !/status of 404/.test(message.text())) errors.push(`console.error ${message.text().slice(0, 300)}`);
  };
  page.on("request", onRequest);
  page.on("pageerror", onError);
  page.on("console", onConsole);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await firstRequestSeen(page);
    // The failure has landed once some 4k map was made and every 4k map made is freed again.
    await page.waitForFunction(() => {
      const made = Object.values(window.__texProbe.textures).filter((t) => t.width === 4096);
      return made.length > 0 && made.every((t) => t.deletedT !== null);
    }, null, { timeout: 30000, polling: 50 });
    assert.ok(failedAt !== null, "failed stream: the held map failed (precondition)");
    await page.waitForTimeout(Math.max(0, failedAt + watchMs - Date.now()));
    const stream = streamSummary(await readStream(page));
    const counts = Object.fromEntries([...new Set(requested)].map((url) => [url.split("/").pop(), requested.filter((r) => r === url).length]));
    const facts = JSON.stringify({ counts, uploads4k: stream.uploads4k.length, live4k: stream.live4k, live2k: stream.live2k });
    assert.ok(stream.uploads4k.length > 0, `failed stream: some 4k maps were uploaded before the failure (precondition; ${facts})`);
    assert.deepEqual(
      { tier: await tierOf(page), globe: await page.locator(SCENE).getAttribute("data-globe"), live4k: stream.live4k, live2k: stream.live2k },
      { tier: "2k", globe: "ready", live4k: 0, live2k: 5 },
      `failed stream: the 2k set stays on screen and every 4k map is freed (${facts})`,
    );
    assert.ok(Object.keys(counts).length === 5 && Object.values(counts).every((count) => count === 1), `failed stream: each 4k map is requested once, with no retry within ${watchMs} ms of the failure (${facts})`);
    assert.deepEqual(errors, [], "failed stream: no page errors (the 404 itself is expected)");
    return { counts, uploads4k: stream.uploads4k.length, freed: stream.live4k === 0 };
  } finally {
    page.off("request", onRequest);
    page.off("pageerror", onError);
    page.off("console", onConsole);
    await page.unroute(failing);
  }
}

/**
 * A tablet in landscape (1024×768, touch, a coarse pointer) that reports a capable GPU and 8 GB of memory:
 * the cinematic hero shows with its 2k set, but the 4k set never streams, because canStream4k needs a fine
 * pointer. A repeat view in the session (no intro), so a stream would start STREAM_SETTLE_SECONDS after
 * the first frame plus an idle callback: the page is watched for `watchMs` after the first frame.
 */
export async function coarseLandscapeCheck(browser, base, { watchMs }) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  try {
    await context.addInitScript(fakeGpu, CAPABLE_DESKTOP);
    await context.addInitScript(() => sessionStorage.setItem("spacegear:intro-seen", "1"));
    const page = await context.newPage();
    const problems = watchProblems(page);
    const textures = [];
    page.on("request", (request) => { if (request.url().includes("/textures/earth/")) textures.push(new URL(request.url()).pathname); });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    const pointer = await page.evaluate(() => ({ width: innerWidth, fine: matchMedia("(pointer: fine) and (hover: hover)").matches, coarse: matchMedia("(pointer: coarse)").matches }));
    assert.deepEqual(pointer, { width: 1024, fine: false, coarse: true }, "tablet landscape: a 1024 px touch screen with a coarse pointer (precondition)");
    await page.waitForSelector(`${SCENE}[data-globe="ready"]`, { timeout: 45000 });
    await page.waitForTimeout(watchMs);
    const facts = { tier: await tierOf(page), textures2k: textures.filter((url) => url.includes("/2k/")).length, textures4k: textures.filter((url) => url.includes("/4k/")), problems };
    assert.deepEqual(facts, { tier: "2k", textures2k: 5, textures4k: [], problems: [] }, `tablet landscape (reported as ${CAPABLE_GPU}, 8 GB): the cinematic hero keeps its 2k set and never streams 4k on a coarse pointer (watched ${watchMs} ms)`);
    return { ...facts, watchMs };
  } finally {
    await context.close();
  }
}

/**
 * The 4k streaming checks on one page that reports a capable desktop (1440×1000): an intro visit
 * (then the hero scrolled away and back, then a lost context), a repeat visit that pauses mid-stream,
 * and a repeat visit whose stream fails. `watchCsp` and `heroLogScript` are browser-check.mjs's;
 * `revealEndMs` is how long the globe's own reveal runs after the overlay starts to lift,
 * `settleMs` how long a stream without the reveal waits after the first frame, and `retryWatchMs` how
 * long after a failure the failed stream is watched for a retry. Returns the summary and a report line.
 */
export async function streamingCheck(browser, base, { watchCsp, heroLogScript, revealEndMs, settleMs, retryWatchMs, viewport = { width: 1440, height: 1000 } }) {
  const context = await browser.newContext({ viewport });
  try {
    const cspProblems = await watchCsp(context);
    const page = await context.newPage();
    const problems = watchProblems(page);
    await page.addInitScript(fakeGpu, CAPABLE_DESKTOP);
    await page.addInitScript(textureProbe);
    await page.addInitScript(heroLogScript);
    const timings = {};
    const timed = async (name, step) => {
      const started = Date.now();
      const result = await step();
      timings[name] = Date.now() - started;
      return result;
    };
    const stream = await timed("intro visit", async () => {
      await page.goto(base, { waitUntil: "domcontentloaded" });
      assert.ok(await page.evaluate(() => matchMedia("(pointer: fine) and (hover: hover)").matches), "capable desktop: a mouse, which the 4k rule requires (precondition)");
      return { ...(await introVisit(page, { revealEndMs })), realRenderer: await page.evaluate(() => window.__realRenderer?.() ?? null) };
    });
    const resumeLuma = await timed("scroll away and back", () => checkResumeLit(page));
    assert.deepEqual(problems.splice(0), [], "capable desktop: no console or page errors while streaming");
    await timed("lost context", () => checkLossResetsTier(page));
    problems.splice(0); // the lost context's own messages
    const repeat = await timed("repeat visit, paused mid-stream", () => repeatVisit(page, { settleMs }));
    assert.deepEqual(problems.splice(0), [], "repeat visit: no console or page errors");
    const failed = await timed("repeat visit, failed stream", () => failedStream(page, { watchMs: retryWatchMs }));
    assert.deepEqual(cspProblems, [], "capable desktop: the 4k maps stream without CSP violations");
    const numbers = {
      intro: stream.intro, firstRequest4k: Math.round(stream.firstRequest4k), bytes4k: stream.bytes4k, uploads4k: stream.uploads4k, memory: stream.memory,
      longestTaskDuringStream: stream.longestTaskDuringStream, firstUploadLongTask: stream.firstUploadLongTask, otherLongTasksDuringStream: stream.otherLongTasksDuringStream, resumeLuma,
      repeat: { ready: Math.round(repeat.intro.ready), firstRequest4k: Math.round(repeat.firstRequest4k), pausedAt: repeat.pausedAt, swap: Math.round(repeat.intro.swap) },
      failed, timings,
    };
    return {
      summary: { ...stream, resumeLuma, repeat, failed, timings },
      line: `capable desktop (reported as ${CAPABLE_GPU}; rendered by ${stream.realRenderer}) streams the 4k set after the intro and idle, one upload per frame, then frees the 2k set; it stays lit after a scroll away, pauses off screen and keeps 2k on a failure: ${JSON.stringify(numbers)}`,
    };
  } finally {
    await context.close();
  }
}
