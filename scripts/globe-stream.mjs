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
  };
}

/**
 * The 4k streaming check on a page that reports a capable desktop (1440×1000, first visit, so the
 * intro plays). `watchCsp` and `heroLogScript` are browser-check.mjs's; `revealEndMs` is how long the
 * globe's own reveal runs after the overlay starts to lift. Every wait polls. Returns the summary and a
 * report line.
 */
export async function streamingCheck(browser, base, { watchCsp, heroLogScript, revealEndMs, viewport = { width: 1440, height: 1000 } }) {
  const context = await browser.newContext({ viewport });
  try {
    const cspProblems = await watchCsp(context);
    const page = await context.newPage(), problems = [];
    page.on("pageerror", error => problems.push(`pageerror ${error.message.slice(0, 300)}`));
    // Errors, and three's texture and renderer warnings (an upload from a released bitmap, for one).
    // R3F's own THREE.Clock deprecation notice is not about textures.
    page.on("console", message => {
      if (message.type() === "error" || (message.type() === "warning" && /THREE\.WebGL|texture/i.test(message.text()))) problems.push(`console.${message.type()} ${message.text().slice(0, 300)}`);
    });
    await page.addInitScript(fakeGpu, CAPABLE_DESKTOP);
    await page.addInitScript(textureProbe);
    await page.addInitScript(heroLogScript);
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('#home .hero-scene[data-globe="ready"]', { timeout: 45000 });
    assert.equal(await page.locator("#home .hero-scene").getAttribute("data-globe-tier"), "2k", "capable desktop: the 2k tier is on screen first");
    try {
      await page.waitForFunction(() => document.querySelector("#home .hero-scene")?.dataset.globeTier === "4k", null, { timeout: 60000 });
    } catch {
      throw new Error(`capable desktop: the 4k tier never came on screen (${JSON.stringify({ ...streamSummary(await readStream(page)), problems })})`);
    }
    // A few more frames, so a 2k map that was still referenced would show up at draw time.
    const swapFrame = await page.evaluate(() => window.__texProbe.frame);
    await page.waitForFunction(frame => window.__texProbe.frame >= frame + 3, swapFrame, { timeout: 20000, polling: "raf" });
    const stream = { ...streamSummary(await readStream(page)), realRenderer: await page.evaluate(() => window.__realRenderer?.() ?? null) };
    const facts = JSON.stringify({ intro: stream.intro, firstRequest4k: stream.firstRequest4k, lastUpload2k: stream.lastUpload2k, idle: stream.idleBeforeStream, uploads4k: stream.uploads4k });
    assert.equal(stream.requests4k.length, 5, `capable desktop: the five 4k maps are fetched once each (${JSON.stringify(stream.requests4k)})`);
    assert.ok(stream.intro.done !== null && stream.firstRequest4k >= stream.intro.done && stream.firstRequest4k >= stream.intro.ready, `capable desktop: the 4k maps are requested only after the intro is done and the first frame is on screen (${facts})`);
    assert.ok(stream.firstRequest4k >= stream.intro.reveal + revealEndMs, `capable desktop: the 4k stream waits for the globe's reveal and flare to end (${revealEndMs} ms after the lift; ${facts})`);
    assert.ok(stream.lastUpload2k !== null && stream.firstRequest4k > stream.lastUpload2k, `capable desktop: the 4k stream starts after the 2k uploads (${facts})`);
    assert.ok(stream.idleBeforeStream, `capable desktop: the 4k stream starts from an idle callback (${facts})`);
    assert.equal(stream.uploads4k.length, 5, `capable desktop: each 4k map is uploaded once (${facts})`);
    assert.equal(stream.uploadFrames4k, 5, `capable desktop: the 4k maps upload one per frame (${facts})`);
    assert.equal(await page.locator("#home .hero-scene").getAttribute("data-globe-tier"), "4k", "capable desktop: the hero reports the 4k tier");
    assert.deepEqual(
      { live4k: stream.live4k, live2k: stream.live2k, deleted2k: stream.deleted2k, reallocated2k: stream.allocated2kAfterStream },
      { live4k: 5, live2k: 0, deleted2k: 5, reallocated2k: 0 },
      "capable desktop: after the swap the 2k maps are freed and only the 4k maps remain",
    );
    assert.ok(stream.mixedFrames === 0 && stream.last2kFrame < stream.first4kFrame, `capable desktop: the maps swap together, so no frame mixes the 2k and 4k sets (${JSON.stringify({ mixed: stream.mixedFrames, last2k: stream.last2kFrame, first4k: stream.first4kFrame })})`);
    assert.deepEqual(problems, [], "capable desktop: no console or page errors while streaming");
    assert.deepEqual(cspProblems, [], "capable desktop: the 4k maps stream without CSP violations");
    const numbers = { intro: stream.intro, firstRequest4k: Math.round(stream.firstRequest4k), bytes4k: stream.bytes4k, uploads4k: stream.uploads4k, memory: stream.memory, longestTaskDuringStream: stream.longestTaskDuringStream, longTasksDuringStream: stream.longTasksDuringStream };
    return {
      summary: stream,
      line: `capable desktop (reported as ${CAPABLE_GPU}; rendered by ${stream.realRenderer}) streams the 4k set after the intro and idle, one upload per frame, then frees the 2k set: ${JSON.stringify(numbers)}`,
    };
  } finally {
    await context.close();
  }
}
