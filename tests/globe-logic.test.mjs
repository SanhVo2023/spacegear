import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import vm from "node:vm";
import { Linter } from "eslint";

const constants = await import("../src/components/globe/constants.ts");
const scroll = await import("../src/components/globe/scroll.ts");
const interaction = await import("../src/components/globe/interaction.ts");
const tiers = await import("../src/components/globe/tiers.ts");
const intro = await import("../src/components/globe/intro-store.ts");
const gate = await import("../src/components/globe/intro-gate.ts");
const manifest = await import("../src/components/globe/texture-manifest.ts");
const globalsCss = await fs.readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearVec = (a, b, eps = 1e-9) => a.every((value, index) => near(value, b[index], eps));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test("the sun sweeps from the opening light to behind the centred globe", () => {
  assert.ok(nearVec(scroll.sunDirectionAt(0), scroll.normalize(constants.SUN_START)));
  assert.ok(nearVec(scroll.sunDirectionAt(1), scroll.normalize(constants.SUN_END)));
  let previousZ = Infinity;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const sun = scroll.sunDirectionAt(p);
    assert.ok(near(Math.hypot(...sun), 1), `unit vector at ${p}`);
    assert.ok(sun[2] <= previousZ + 1e-9, `the sun keeps moving behind the globe at ${p}`);
    previousZ = sun[2];
  }
  assert.ok(scroll.sunDirectionAt(constants.SUN_SWEEP[1])[2] < 0, "behind the globe at the centred beat");
});

test("the rig keeps the three beats' framing on a unit sphere and the camera dollies in", () => {
  const open = scroll.rigAt(0);
  const centred = scroll.rigAt(constants.RIG_RANGE[1]);
  assert.ok(near(open.scale, 3.1) && near(open.x, 2.4), JSON.stringify(open));
  assert.ok(near(centred.scale, 1.3, 1e-9) && near(centred.x, 0, 1e-9), JSON.stringify(centred));
  assert.deepEqual(scroll.rigAt(1), centred);
  assert.equal(scroll.cameraZAt(0), constants.CAMERA_Z);
  assert.ok(near(scroll.cameraZAt(1), 5.75));
  assert.ok(scroll.cameraZAt(0.5) < constants.CAMERA_Z && scroll.cameraZAt(0.5) > 5.75);
});

test("NaN scroll progress reads as the start of the hero", () => {
  assert.equal(scroll.clamp01(Number.NaN), 0);
  assert.equal(scroll.smoothstep(0, 1, Number.NaN), 0);
  assert.equal(scroll.mapClamp(Number.NaN, 0, 1, 5, 7), 5);
  assert.deepEqual(scroll.rigAt(Number.NaN), scroll.rigAt(0));
  assert.equal(scroll.cameraZAt(Number.NaN), constants.CAMERA_Z);
  assert.deepEqual(scroll.sunDirectionAt(Number.NaN), scroll.sunDirectionAt(0));
});

test("opposite directions still slerp through unit vectors at an even pace", () => {
  for (const from of [[1, 0, 0], [0, 1, 0], [0, 0, 1], constants.SUN_END]) {
    const a = scroll.normalize(from);
    const b = a.map((value) => -value);
    assert.ok(nearVec(scroll.slerpDirection(a, b, 0), a), `starts at ${from}`);
    assert.ok(nearVec(scroll.slerpDirection(a, b, 1), b), `ends opposite ${from}`);
    for (const t of [0.25, 0.5, 0.75]) {
      const step = scroll.slerpDirection(a, b, t);
      assert.ok(near(Math.hypot(...step), 1), `unit vector at ${t} from ${from}`);
      assert.ok(near(dot(step, a), Math.cos(t * Math.PI)), `${t * 180}° from ${from}`);
    }
  }
});

test("the tilt spring settles on its target with little overshoot", () => {
  const spring = interaction.createSpring();
  let peak = 0;
  for (let i = 0; i < 120; i++) peak = Math.max(peak, interaction.stepSpring(spring, 0.1, 1 / 60));
  assert.ok(Math.abs(spring.value - 0.1) < 1e-3, `settled within 2 s (${spring.value})`);
  assert.ok(peak < 0.11, `under 10% overshoot (${peak})`);
  const jump = interaction.createSpring();
  interaction.stepSpring(jump, 1, 5);
  assert.ok(Number.isFinite(jump.value) && Math.abs(jump.value) < 2, "a long frame stays stable");
});

test("the spring holds still for a non-finite target", () => {
  const spring = interaction.createSpring(0.5);
  spring.velocity = 0.2;
  for (const target of [Number.NaN, Infinity, -Infinity]) {
    assert.equal(interaction.stepSpring(spring, target, 1 / 60), 0.5, String(target));
  }
  assert.deepEqual(spring, { value: 0.5, velocity: 0.2 });
});

test("dragging spins with the pointer, then coasts and stops", () => {
  const input = interaction.createPointerInput();
  const state = interaction.createDragState();
  input.dragging = true;
  input.dx = 144; // a tenth of a 1440 px viewport
  assert.ok(near(interaction.stepDrag(input, state, 1 / 60, 1440), Math.PI / 10));
  assert.equal(input.dx, 0, "the movement is consumed");
  input.dragging = false;
  let coast = 0;
  for (let i = 0; i < 60 * 6; i++) coast += interaction.stepDrag(input, state, 1 / 60, 1440);
  assert.ok(coast > 0, "inertia carries the spin after release");
  assert.equal(state.velocity, 0, "and stops within six seconds");
});

test("vertical drag pitches within limits and levels out on release", () => {
  const input = interaction.createPointerInput();
  const state = interaction.createDragState();
  input.dragging = true;
  for (let i = 0; i < 30; i++) {
    input.dy = 200;
    interaction.stepDrag(input, state, 1 / 60, 1440);
  }
  assert.equal(state.pitchTarget, constants.MAX_PITCH);
  input.dragging = false;
  for (let i = 0; i < 180; i++) interaction.stepDrag(input, state, 1 / 60, 1440);
  assert.ok(Math.abs(state.pitch.value) < 1e-3, `level again (${state.pitch.value})`);
});

test("a NaN, negative or zero frame time never flings, coasts or speeds up the globe", () => {
  for (const dt of [Number.NaN, -0.1, 0]) {
    const input = interaction.createPointerInput();
    const state = interaction.createDragState();
    input.dragging = true;
    input.dx = 144;
    input.dy = 50;
    assert.ok(near(interaction.stepDrag(input, state, dt, 1440), Math.PI / 10), `a drag still follows the pointer (dt ${dt})`);
    assert.equal(state.velocity, 0, `no fling (dt ${dt})`);
    assert.ok(Number.isFinite(state.pitch.value), `pitch stays finite (dt ${dt})`);
    input.dragging = false;
    state.velocity = 1;
    assert.equal(interaction.stepDrag(input, state, dt, 1440), 0, `no coast (dt ${dt})`);
    assert.equal(state.velocity, 1, `the release velocity neither decays nor grows (dt ${dt})`);
  }
});

test("a very short frame does not inflate the fling", () => {
  const input = interaction.createPointerInput();
  const state = interaction.createDragState();
  input.dragging = true;
  input.dx = 10;
  const spin = interaction.stepDrag(input, state, 1e-6, 1440);
  // The velocity follows the pointer with a 40 ms time constant, so one frame adds at most spin / 0.04.
  assert.ok(state.velocity > 0 && state.velocity <= spin / 0.04 + 1e-9, `velocity ${state.velocity}`);
});

test("a fling is capped at MAX_SPIN in both directions", () => {
  assert.equal(constants.MAX_SPIN, 2 * Math.PI);
  for (const sign of [1, -1]) {
    const input = interaction.createPointerInput();
    const state = interaction.createDragState();
    input.dragging = true;
    for (let i = 0; i < 20; i++) {
      input.dx = sign * 1440; // a whole viewport per frame
      interaction.stepDrag(input, state, 1 / 60, 1440);
      assert.ok(Math.abs(state.velocity) <= constants.MAX_SPIN, `frame ${i}: ${state.velocity}`);
    }
    assert.equal(state.velocity, sign * constants.MAX_SPIN);
    input.dragging = false;
    assert.ok(Math.abs(interaction.stepDrag(input, state, 1 / 60, 1440)) <= constants.MAX_SPIN / 60);
  }
});

test("a NaN pointer delta or viewport width never poisons the spin, fling or pitch", () => {
  for (const [dx, dy, width] of [[Number.NaN, 0, 1440], [10, Number.NaN, 1440], [10, 10, Number.NaN], [Infinity, -Infinity, 1440]]) {
    const label = `dx ${dx}, dy ${dy}, width ${width}`;
    const input = interaction.createPointerInput();
    const state = interaction.createDragState();
    state.velocity = 1;
    input.dragging = true;
    input.dx = dx;
    input.dy = dy;
    assert.ok(Number.isFinite(interaction.stepDrag(input, state, 1 / 60, width)), `finite spin while dragging (${label})`);
    assert.ok(Number.isFinite(state.velocity), `finite velocity (${label})`);
    assert.ok(Number.isFinite(state.pitchTarget) && Number.isFinite(state.pitch.value), `finite pitch (${label})`);
    input.dragging = false;
    input.dx = dx;
    assert.ok(Number.isFinite(interaction.stepDrag(input, state, 1 / 60, width)), `finite spin after release (${label})`);
    assert.ok(Number.isFinite(state.velocity), `finite coast (${label})`);
  }
});

test("a drag that ends without a real release stops without a fling", () => {
  const input = interaction.createPointerInput();
  const state = interaction.createDragState();
  input.dragging = true;
  for (let i = 0; i < 20; i++) {
    input.dx = 15;
    interaction.stepDrag(input, state, 1 / 60, 1440);
  }
  assert.ok(state.velocity > 1, `a fast drag builds a fling (${state.velocity})`);
  // Window blur, a hidden tab or a release outside the window: the hook ends the drag as cancelled.
  input.dragging = false;
  input.cancelled = true;
  input.dx = 15; // the last movement before the drag ended still applies
  assert.ok(near(interaction.stepDrag(input, state, 1 / 60, 1440), (15 * Math.PI) / 1440), "only the pending movement turns the globe");
  assert.equal(state.velocity, 0, "no fling");
  assert.equal(input.cancelled, false, "the cancel is consumed");
  assert.equal(interaction.stepDrag(input, state, 1 / 60, 1440), 0, "and nothing coasts afterwards");
});

test("pointer coordinates are clamped to the unit range and never NaN", () => {
  const cases = [[0.25, 0.25], [-2.4, -1], [3, 1], [Number.NaN, 0], [Infinity, 0], [-Infinity, 0]];
  for (const [value, expected] of cases) assert.equal(interaction.unitOrZero(value), expected, String(value));
  assert.equal(interaction.createPointerInput().cancelled, false);
});

test("movement that lands between the last frame and the release still turns the globe", () => {
  const input = interaction.createPointerInput();
  const state = interaction.createDragState();
  // A whole gesture inside one long frame: pressed, moved and released before the next frame.
  input.dx = 144;
  assert.ok(near(interaction.stepDrag(input, state, 1 / 60, 1440), Math.PI / 10), "the globe follows the pointer to where it was let go");
  assert.equal(input.dx, 0, "the movement is consumed");
  assert.equal(state.velocity, 0, "a movement no frame saw as a drag does not fling");
});

// Pointer moving steadily at `speed` px/s for `seconds`, then held still for `pause` seconds, sampled
// once per frame at `hz`. Returns the fling velocity at the moment of release.
function releaseVelocity(hz, { speed = 900, seconds = 0.4, pause = 0 } = {}) {
  const input = interaction.createPointerInput();
  const state = interaction.createDragState();
  const h = 1 / hz;
  input.dragging = true;
  for (let i = 0, n = Math.round(seconds * hz); i < n; i++) {
    input.dx = speed * h;
    interaction.stepDrag(input, state, h, 1440);
  }
  for (let i = 0, n = Math.round(pause * hz); i < n; i++) interaction.stepDrag(input, state, h, 1440);
  return state.velocity;
}

test("60 Hz and 144 Hz screens fling the globe alike", () => {
  const steady = [releaseVelocity(60), releaseVelocity(144)];
  const expected = (900 * constants.DRAG_RADIANS_PER_VIEWPORT) / 1440;
  assert.ok(steady.every((v) => Math.abs(v / expected - 1) < 0.02), `a steady drag flings at the pointer's speed (${steady}, expected ${expected})`);
  assert.ok(Math.abs(steady[0] / steady[1] - 1) < 0.02, `steady drag: 60 Hz ${steady[0]} vs 144 Hz ${steady[1]}`);
  const paused = [releaseVelocity(60, { pause: 0.05 }), releaseVelocity(144, { pause: 0.05 })];
  assert.ok(paused.every((v) => v > 0 && v < expected), `a pause before release slows the fling (${paused})`);
  assert.ok(Math.abs(paused[0] / paused[1] - 1) < 0.15, `50 ms pause: 60 Hz ${paused[0]} vs 144 Hz ${paused[1]}`);
});

test("the globe holds its opening pose through its fade-in over the poster, then eases into motion", () => {
  const hold = constants.OPENING_HOLD_SECONDS, ease = constants.OPENING_RAMP_SECONDS;
  assert.ok(hold >= 0.6, `the hold lasts the canvas's 0.6 s fade-in (${hold} s)`);
  assert.ok(ease >= 0.5, `the motion eases in, not in one frame (${ease} s)`);
  const css = /\.hero-scene,\s*\.hero-mobile-globe \{ opacity: 0; transition: opacity (\d+(?:\.\d+)?)s/.exec(globalsCss);
  assert.equal(Number(css?.[1]), hold, "the hold matches the fade-in in globals.css");
  const ramp = (now, scene = { announced: true, announcedAt: 10 }) => interaction.openingRamp(scene, now);
  assert.equal(ramp(100, { announced: false, announcedAt: -1 }), 0, "still until the first frame is announced");
  assert.equal(ramp(10), 0, "still at the first frame");
  assert.equal(ramp(10 + hold - 0.01), 0, "still through the fade-in");
  assert.equal(ramp(9), 0, "a clock that reads earlier stays still");
  assert.equal(ramp(Number.NaN), 0, "a broken clock stays still");
  assert.ok(near(ramp(10 + hold + ease / 2), 0.5, 1e-9), "halfway through the ease");
  assert.equal(ramp(10 + hold + ease + 1e-6), 1, "full motion after the ease");
  assert.equal(ramp(1e9), 1);
  // Smooth: rising monotonically, with no step at either end (the first and last 1/60 s move it by < 0.5 %).
  let previous = 0;
  for (let t = 0; t <= ease + 1e-9; t += ease / 200) {
    const value = ramp(10 + hold + t);
    assert.ok(value >= previous - 1e-12, `monotonic at ${t}`);
    previous = value;
  }
  assert.ok(ramp(10 + hold + 1 / 60) < 0.005 && 1 - ramp(10 + hold + ease - 1 / 60) < 0.005, "no step at either end");
});

test("the opening ramp runs on the wall clock in every frame callback that uses it", async () => {
  // R3F's clock restarts whenever the frame loop pauses (EarthScene's seconds()); the ramp must not.
  const scene = await fs.readFile(new URL("../src/components/EarthScene.tsx", import.meta.url), "utf8");
  const backdrop = await fs.readFile(new URL("../src/components/globe/Backdrop.tsx", import.meta.url), "utf8");
  assert.match(scene, /const seconds = \(\) => performance\.now\(\) \/ 1000;/);
  assert.match(scene, /openingRamp\(warm\.current, seconds\(\)\)/);
  assert.match(backdrop, /openingRamp\(settled\.current, performance\.now\(\) \/ 1000\)/);
});

test("the hero mode follows the spec's device table", () => {
  const desktop = { width: 1440, reducedMotion: false, saveData: false, webgl2: true };
  assert.equal(tiers.chooseHeroMode(desktop), "cinematic");
  assert.equal(tiers.chooseHeroMode({ ...desktop, reducedMotion: true }), "poster");
  assert.equal(tiers.chooseHeroMode({ ...desktop, webgl2: false }), "poster");
  assert.equal(tiers.chooseHeroMode({ ...desktop, saveData: true }), "poster");
  const phone = { ...desktop, width: 390 };
  assert.equal(tiers.chooseHeroMode(phone), "mobile-globe");
  assert.equal(tiers.chooseHeroMode({ ...phone, deviceMemory: 4 }), "mobile-globe");
  assert.equal(tiers.chooseHeroMode({ ...desktop, width: 768 }), "mobile-globe");
  assert.equal(tiers.chooseHeroMode({ ...phone, deviceMemory: 2 }), "galaxy");
  assert.equal(tiers.chooseHeroMode({ ...phone, saveData: true }), "galaxy");
  assert.equal(tiers.chooseHeroMode({ ...phone, reducedMotion: true }), "galaxy");
  assert.equal(tiers.chooseHeroMode({ ...phone, webgl2: false }), "galaxy");
  // Slow connections keep the galaxy on phones and tablets, as they skip the intro and the 4k set.
  for (const effectiveType of ["slow-2g", "2g", "3g"]) assert.equal(tiers.chooseHeroMode({ ...phone, effectiveType }), "galaxy", effectiveType);
  assert.equal(tiers.chooseHeroMode({ ...phone, effectiveType: "4g" }), "mobile-globe");
  assert.equal(tiers.chooseHeroMode({ ...desktop, width: 768, effectiveType: "3g" }), "galaxy");
  assert.equal(tiers.chooseHeroMode({ ...desktop, effectiveType: "3g" }), "cinematic", "the desktop table is unchanged");
});

test("the WebGL2 probe (a throwaway context) runs only when nothing else decides the hero mode", () => {
  let probes = 0;
  const probe = () => { probes++; return true; };
  const phone = { width: 390, reducedMotion: false, saveData: false, webgl2: probe };
  const desktop = { ...phone, width: 1440 };
  const decided = [
    [{ ...phone, reducedMotion: true }, "galaxy"],
    [{ ...phone, saveData: true }, "galaxy"],
    [{ ...phone, deviceMemory: 2 }, "galaxy"],
    [{ ...phone, effectiveType: "3g" }, "galaxy"],
    [{ ...desktop, reducedMotion: true }, "poster"],
    [{ ...desktop, saveData: true }, "poster"],
  ];
  for (const [env, mode] of decided) assert.equal(tiers.chooseHeroMode(env), mode);
  assert.equal(probes, 0, "no probe when an earlier rule decides");
  assert.equal(tiers.chooseHeroMode(phone), "mobile-globe");
  assert.equal(tiers.chooseHeroMode(desktop), "cinematic");
  assert.equal(probes, 2, "one probe per undecided call");
  assert.equal(tiers.chooseHeroMode({ ...phone, webgl2: () => false }), "galaxy");
  assert.equal(tiers.chooseHeroMode({ ...desktop, webgl2: () => false }), "poster");
});

test("the device table is a leaf module, so the hero's first-load chunk stays small", async () => {
  const source = await fs.readFile(new URL("../src/components/globe/hero-mode.ts", import.meta.url), "utf8");
  assert.deepEqual(source.match(/^\s*(import|export .* from)\b.*$/gm) ?? [], [], "hero-mode.ts imports nothing");
  const hero = await fs.readFile(new URL("../src/components/sections/OrbitalCinematic.tsx", import.meta.url), "utf8");
  const values = [...hero.matchAll(/^import (?!type\b)([^;]+?) from "@\/components\/globe\/([\w-]+)";/gm)].map((m) => m[2]);
  assert.deepEqual(values.filter((name) => ["tiers", "constants", "texture-manifest", "textures", "materials"].includes(name)), [], `OrbitalCinematic imports no value from the globe's heavier modules (${values})`);
});

test("the 4k set streams only to capable desktops with a hardware GPU", () => {
  const gpu = { viewportWidth: 1440, finePointer: true, saveData: false, maxTextureSize: 16384, renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)" };
  assert.equal(tiers.canStream4k(gpu), true);
  // A touch screen at a desktop width (an iPad in landscape: an Apple GPU, no deviceMemory) keeps 2k.
  assert.equal(tiers.canStream4k({ ...gpu, finePointer: false }), false, "a coarse pointer never streams 4k");
  assert.equal(tiers.canStream4k({ ...gpu, viewportWidth: 1180, finePointer: false, renderer: "Apple GPU" }), false, "an iPad in landscape keeps 2k");
  assert.equal(tiers.canStream4k({ ...gpu, renderer: "Apple GPU" }), true, "a Mac with an Apple GPU streams 4k");
  assert.equal(tiers.canStream4k({ ...gpu, deviceMemory: 8, effectiveType: "4g" }), true);
  assert.equal(tiers.canStream4k({ ...gpu, deviceMemory: 4 }), false);
  assert.equal(tiers.canStream4k({ ...gpu, saveData: true }), false);
  assert.equal(tiers.canStream4k({ ...gpu, effectiveType: "3g" }), false);
  assert.equal(tiers.canStream4k({ ...gpu, maxTextureSize: 2048 }), false);
  assert.equal(tiers.canStream4k({ ...gpu, maxTextureSize: Number.NaN }), false, "an unknown texture limit never streams 4k");
  assert.equal(tiers.canStream4k({ ...gpu, renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)" }), false);
  assert.equal(tiers.canStream4k({ ...gpu, viewportWidth: 800 }), false);
  assert.equal(tiers.GLOBE_MAPS, manifest.GLOBE_MAPS, "the map list is the manifest's own, never restated");
});

test("the 4k stream waits for the intro, the globe's reveal and the canvas fade-in", () => {
  const end = constants.REVEAL_END_SECONDS;
  const settle = constants.STREAM_SETTLE_SECONDS;
  assert.equal(end, constants.REVEAL_DELAY_SECONDS + Math.max(constants.REVEAL_SECONDS, constants.FLARE_SECONDS), "the reveal ends after its delay, fade-up and flare");
  assert.ok(settle >= 1.2, `without the reveal, the stream waits out the canvas's 0.6 s fade-in and the copy's entrance (${settle} s)`);
  const gate = (patch) => tiers.streamMayStart({ phase: "off", played: false, revealElapsed: -1, shownElapsed: 99, ...patch });
  // No intro, or one that ended before the globe was ready: the canvas fades in over the poster first.
  assert.equal(gate({ phase: "off" }), true);
  assert.equal(gate({ phase: "done" }), true);
  assert.equal(gate({ shownElapsed: settle - 0.01 }), false, "not during the canvas fade-in and the copy's entrance");
  assert.equal(gate({ shownElapsed: settle }), true);
  assert.equal(gate({ shownElapsed: Number.NaN }), false, "an unknown time since the first frame never streams");
  // Never while the overlay covers the page or lifts.
  for (const phase of ["loading", "reveal"]) {
    for (const played of [false, true]) assert.equal(gate({ phase, played, revealElapsed: 99 }), false, `${phase} ${played}`);
  }
  // A globe revealed by the intro streams only once its fade-up and flare are over.
  const revealed = (revealElapsed) => gate({ phase: "done", played: true, revealElapsed });
  assert.equal(revealed(-1), false, "the reveal has not started");
  assert.equal(revealed(end - 0.01), false);
  assert.equal(revealed(end), true);
  assert.equal(revealed(Number.NaN), false, "an unknown reveal time never streams");
});

test("the GPU renderer string comes from RENDERER when it is unmasked, else from the debug extension", async () => {
  const { rendererName } = await import("../src/components/globe/device.ts");
  const UNMASKED = 0x9246;
  const context = (renderer, unmasked) => ({
    RENDERER: 0x1f01,
    getParameter: (name) => (name === 0x1f01 ? renderer : name === UNMASKED ? unmasked : null),
    getExtension: (name) => (name === "WEBGL_debug_renderer_info" && unmasked !== undefined ? { UNMASKED_RENDERER_WEBGL: UNMASKED } : null),
  });
  const gtx = "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)";
  // Chromium and Safari mask RENDERER.
  assert.equal(rendererName(context("WebKit WebGL", gtx)), gtx);
  // Firefox reports the (sanitised) renderer in RENDERER and deprecates the extension: it is not asked.
  assert.equal(rendererName(context("NVIDIA GeForce GTX 980, or similar", "unused")), "NVIDIA GeForce GTX 980, or similar");
  // No extension: the masked string is all there is.
  assert.equal(rendererName(context("WebKit WebGL", undefined)), "WebKit WebGL");
});

test("intro progress only moves forward and the phases run in order", () => {
  const store = intro.createIntroStore("off");
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  store.reveal();
  store.finish();
  assert.equal(store.get().phase, "off", "without an intro there are no phases");
  store.start();
  assert.equal(store.get().phase, "loading");
  store.setProgress(0.5);
  store.setProgress(0.3);
  assert.equal(store.get().progress, 0.5, "never goes back");
  store.setProgress(2);
  assert.equal(store.get().progress, 1, "clamped");
  store.setProgress(Number.NaN);
  assert.equal(store.get().progress, 1, "NaN ignored");
  store.markReady();
  assert.equal(store.get().ready, true);
  store.reveal();
  assert.equal(store.get().phase, "reveal");
  store.finish();
  assert.equal(store.get().phase, "done");
  store.start();
  assert.equal(store.get().phase, "done", "a finished intro never restarts");
  unsubscribe();
  const before = calls;
  store.fail();
  assert.equal(calls, before, "unsubscribed listeners are not called");
});

test("the intro can be skipped and can fail, and only real changes notify", () => {
  const store = intro.createIntroStore("loading");
  let calls = 0;
  store.subscribe(() => calls++);
  store.start();
  store.setProgress(0);
  assert.equal(calls, 0, "starting again or reporting no progress changes nothing");
  store.setProgress(0.2);
  store.markReady();
  assert.equal(store.get().ready, true);
  assert.equal(store.get().progress, 1, "ready means fully loaded");
  store.fail();
  assert.equal(store.get().failed, true);
  store.finish();
  assert.equal(store.get().phase, "done", "any input skips straight from loading to done");
  assert.equal(calls, 4);
  const snapshot = store.get();
  store.start();
  store.reveal();
  store.finish();
  store.markReady();
  store.fail();
  store.setProgress(0.5);
  store.setProgress(Number.NaN);
  assert.equal(calls, 4, "no-op updates do not notify");
  assert.equal(store.get(), snapshot, "and keep the same snapshot");
});

test("the caps leave room for the reveal and the store starts off on the server", () => {
  assert.ok(intro.INTRO_HOLD_MS + intro.INTRO_REVEAL_MS + 500 <= intro.INTRO_EXTRA_CAP_MS, "room for the catch-up, the hold and the reveal");
  assert.ok(intro.INTRO_MIN_MS < intro.INTRO_LOAD_CAP_MS && intro.INTRO_CHUNK_SHARE > 0 && intro.INTRO_CHUNK_SHARE < 0.2);
  assert.ok(intro.INTRO_EXTRA_CAP_MS <= 2500 && intro.INTRO_LOAD_CAP_MS <= 4000);
  assert.equal(intro.introStore.get().phase, "off");
  assert.equal(intro.getServerIntroPhase(), "off");
});

test("on the client the store starts loading when the gate marked the intro", async () => {
  const url = new URL("../src/components/globe/intro-store.ts", import.meta.url).href;
  try {
    globalThis.document = { documentElement: { dataset: { intro: "play" } } };
    const played = await import(`${url}?gate=play`);
    assert.equal(played.introStore.get().phase, "loading");
    assert.equal(played.getIntroPhase(), "loading");
    assert.equal(played.getServerIntroPhase(), "off", "the server snapshot stays off for hydration");
    globalThis.document = { documentElement: { dataset: {} } };
    const skipped = await import(`${url}?gate=none`);
    assert.equal(skipped.introStore.get().phase, "off");
  } finally {
    delete globalThis.document;
  }
});

function fakeWindow({ path = "/", hash = "", width = 1440, reducedMotion = false, saveData = false, effectiveType, webgl2 = true, seen = false, getThrows = false, setThrows = false, storageGetterThrows = false } = {}) {
  const attributes = {};
  const storage = new Map(seen ? [[gate.INTRO_SESSION_KEY, "1"]] : []);
  const win = {
    attributes,
    storage,
    location: { pathname: path, hash },
    // Answers only the gate's own query, the way the browser would evaluate it.
    matchMedia: (query) => ({ matches: query === gate.INTRO_QUERY && width >= 1024 && !reducedMotion }),
    navigator: saveData || effectiveType ? { connection: { saveData, effectiveType } } : {},
    document: { documentElement: { setAttribute: (name, value) => { attributes[name] = value; } } },
    ...(webgl2 ? { WebGL2RenderingContext: function WebGL2RenderingContext() {} } : {}),
  };
  const sessionStorage = {
    getItem: (key) => {
      if (getThrows) throw new Error("storage blocked");
      return storage.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (setThrows) throw new Error("quota exceeded");
      storage.set(key, value);
    },
  };
  if (storageGetterThrows) Object.defineProperty(win, "sessionStorage", { get() { throw new Error("SecurityError"); } });
  else win.sessionStorage = sessionStorage;
  return win;
}

/** Runs the shipped inline script in a fresh context where only `window` is defined. */
const runGate = (win) => vm.runInNewContext(gate.INTRO_GATE_SCRIPT, { window: win });

const GATE_CASES = [
  ["a first desktop visit to the home page", {}, "play"],
  ["a fast connection", { effectiveType: "4g" }, "play"],
  ["a phone", { width: 390 }, undefined],
  ["reduced motion", { reducedMotion: true }, undefined],
  ["Save-Data", { saveData: true }, undefined],
  ["a slow-2g connection", { effectiveType: "slow-2g" }, undefined],
  ["a 2g connection", { effectiveType: "2g" }, undefined],
  ["a 3g connection", { effectiveType: "3g" }, undefined],
  ["a deep link", { hash: "#pricing" }, undefined],
  ["another page", { path: "/services/" }, undefined],
  ["no WebGL2", { webgl2: false }, undefined],
  ["a repeat view in this tab", { seen: true }, undefined],
  ["getItem throws", { getThrows: true }, undefined],
  ["setItem throws", { setThrows: true }, undefined],
  ["the sessionStorage getter throws", { storageGetterThrows: true }, undefined],
];

test("the inline gate plays the intro only on a first desktop visit to the home page", () => {
  for (const [label, options, expected] of GATE_CASES) {
    const win = fakeWindow(options);
    assert.doesNotThrow(() => runGate(win), label);
    assert.equal(win.attributes["data-intro"], expected, label);
    const marked = expected === "play" || options.seen ? "1" : undefined;
    assert.equal(win.storage.get(gate.INTRO_SESSION_KEY), marked, `${label}: only a played intro marks the tab`);
  }
});

test("the intro plays once per tab session", () => {
  const win = fakeWindow();
  runGate(win);
  assert.equal(win.attributes["data-intro"], "play");
  delete win.attributes["data-intro"];
  runGate(win);
  assert.equal(win.attributes["data-intro"], undefined, "a repeat view skips it");
});

test("the gate script is fixed ES5 text with a knowable CSP hash", () => {
  const script = gate.INTRO_GATE_SCRIPT;
  assert.equal(gate.introGateScript(), script, "IntroGate.tsx renders the literal");
  assert.ok(script.includes(JSON.stringify(gate.INTRO_SESSION_KEY)) && script.includes(JSON.stringify(gate.INTRO_QUERY)));
  const parse = new Linter().verify(script, [{ languageOptions: { ecmaVersion: 5, sourceType: "script" } }]);
  assert.deepEqual(parse.filter((message) => message.fatal), [], "parses as ES5");
  assert.match(script, /^[\x20-\x7e]*$/, "printable ASCII, so the hash does not depend on an encoding");
  assert.ok(!script.includes("<"), "safe inside an inline <script>");
  // A change to the gate changes these pins; a CSP script-src entry would be 'sha256-<this hash>'.
  assert.equal(script.length, 496);
  assert.equal(createHash("sha256").update(script).digest("base64"), "0y3wV+PoPNzI6HQAOkd/uEUhzfrGQIcFoTGmdo7yXCU=");
});

test("the CSS failsafe hides the overlay and releases the held copy only after the caps", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const rules = [...css.matchAll(/^(html\[data-intro="(\w+)"\][^{]*)\{ animation: (intro-failsafe(?:-copy)?) 0s linear (\d+(?:\.\d+)?)s forwards; \}$/gm)];
  assert.deepEqual(rules.map((rule) => [rule[1].trim(), rule[2], rule[3]]), [
    ['html[data-intro="play"] .intro-overlay', "play", "intro-failsafe"],
    ['html[data-intro="play"] #home [data-reveal]', "play", "intro-failsafe-copy"],
  ], "one rule for the overlay and one for the hero copy, both only while the intro plays");
  const delays = rules.map((rule) => Number(rule[4]) * 1000);
  assert.equal(new Set(delays).size, 1, "the overlay and the copy are released together");
  assert.ok(delays[0] > intro.INTRO_LOAD_CAP_MS + intro.INTRO_HOLD_MS + intro.INTRO_REVEAL_MS, "a working script always reveals and ends first");
  assert.match(css, /@keyframes intro-failsafe \{ to \{ visibility: hidden; opacity: 0; \} \}/);
  assert.match(css, /@keyframes intro-failsafe-copy \{ to \{ opacity: 1; transform: none; filter: none; \} \}/);
});
