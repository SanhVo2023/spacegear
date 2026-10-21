import { test } from "node:test";
import assert from "node:assert/strict";

const constants = await import("../src/components/globe/constants.ts");
const scroll = await import("../src/components/globe/scroll.ts");
const interaction = await import("../src/components/globe/interaction.ts");
const tiers = await import("../src/components/globe/tiers.ts");
const intro = await import("../src/components/globe/intro-store.ts");
const gate = await import("../src/components/globe/intro-gate.ts");
const manifest = await import("../src/components/globe/texture-manifest.ts");

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearVec = (a, b, eps = 1e-9) => a.every((value, index) => near(value, b[index], eps));

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
});

test("the 4k set streams only to capable desktops with a hardware GPU", () => {
  const gpu = { viewportWidth: 1440, saveData: false, maxTextureSize: 16384, renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)" };
  assert.equal(tiers.canStream4k(gpu), true);
  assert.equal(tiers.canStream4k({ ...gpu, deviceMemory: 8, effectiveType: "4g" }), true);
  assert.equal(tiers.canStream4k({ ...gpu, deviceMemory: 4 }), false);
  assert.equal(tiers.canStream4k({ ...gpu, saveData: true }), false);
  assert.equal(tiers.canStream4k({ ...gpu, effectiveType: "3g" }), false);
  assert.equal(tiers.canStream4k({ ...gpu, maxTextureSize: 2048 }), false);
  assert.equal(tiers.canStream4k({ ...gpu, renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)" }), false);
  assert.equal(tiers.canStream4k({ ...gpu, viewportWidth: 800 }), false);
  assert.equal(tiers.GLOBE_MAPS, manifest.GLOBE_MAPS, "the map list is the manifest's own, never restated");
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

test("the caps leave room for the reveal and the store starts off on the server", () => {
  assert.ok(intro.INTRO_REVEAL_MS + 500 <= intro.INTRO_EXTRA_CAP_MS);
  assert.ok(intro.INTRO_EXTRA_CAP_MS <= 2500 && intro.INTRO_LOAD_CAP_MS <= 4000);
  assert.equal(intro.introStore.get().phase, "off");
  assert.equal(intro.getServerIntroPhase(), "off");
});

function fakeWindow({ path = "/", hash = "", desktop = true, saveData = false, webgl2 = true, seen = false, storageThrows = false } = {}) {
  const attributes = {};
  const storage = new Map(seen ? [[gate.INTRO_SESSION_KEY, "1"]] : []);
  return {
    attributes,
    storage,
    location: { pathname: path, hash },
    matchMedia: (query) => ({ matches: query === gate.INTRO_QUERY && desktop }),
    sessionStorage: {
      getItem: (key) => {
        if (storageThrows) throw new Error("storage blocked");
        return storage.get(key) ?? null;
      },
      setItem: (key, value) => storage.set(key, value),
    },
    navigator: saveData ? { connection: { saveData: true } } : {},
    document: { documentElement: { setAttribute: (name, value) => { attributes[name] = value; } } },
    ...(webgl2 ? { WebGL2RenderingContext: function WebGL2RenderingContext() {} } : {}),
  };
}

test("the intro plays once, on a first desktop visit to the home page", () => {
  const win = fakeWindow();
  assert.equal(gate.runIntroGate(gate.INTRO_SESSION_KEY, gate.INTRO_QUERY, win), true);
  assert.equal(win.attributes["data-intro"], "play");
  assert.equal(win.storage.get(gate.INTRO_SESSION_KEY), "1");
  delete win.attributes["data-intro"];
  assert.equal(gate.runIntroGate(gate.INTRO_SESSION_KEY, gate.INTRO_QUERY, win), false, "a repeat view skips it");
  assert.equal(win.attributes["data-intro"], undefined);
});

test("the intro is skipped for reduced motion or phones, Save-Data, deep links, other pages, no WebGL2 and blocked storage", () => {
  for (const options of [{ desktop: false }, { saveData: true }, { hash: "#pricing" }, { path: "/services/" }, { webgl2: false }, { seen: true }, { storageThrows: true }]) {
    const win = fakeWindow(options);
    assert.equal(gate.runIntroGate(gate.INTRO_SESSION_KEY, gate.INTRO_QUERY, win), false, JSON.stringify(options));
    assert.equal(win.attributes["data-intro"], undefined, JSON.stringify(options));
  }
});

test("the serialised gate runs on its own as an inline script", () => {
  const win = fakeWindow();
  new Function("window", gate.introGateScript())(win);
  assert.equal(win.attributes["data-intro"], "play");
});
