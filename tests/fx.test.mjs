import { test } from "node:test";
import assert from "node:assert/strict";

const math = await import("../src/components/fx/math.ts");
const { splitWords, charOffsets } = await import("../src/components/fx/split.ts");
const { createIdleLoop } = await import("../src/components/fx/idle-loop.ts");

const near = (actual, expected, message = "") => assert.ok(Math.abs(actual - expected) < 1e-9, `${message} expected ${expected}, got ${actual}`);

test("clamp keeps a value inside its range", () => {
  assert.equal(math.clamp(5, 0, 3), 3);
  assert.equal(math.clamp(-1, 0, 3), 0);
  assert.equal(math.clamp(2, 0, 3), 2);
});

test("damp eases toward the target independently of frame rate", () => {
  assert.equal(math.damp(0, 100, 8, 0), 0);
  near(math.damp(0, 100, Math.log(2), 1), 50);
  assert.ok(math.damp(0, 100, 8, 10) > 99.99);
  near(math.damp(50, 50, 6, 1 / 60), 50);
});

test("magnetOffset pulls a fraction of the offset, capped at max, and normalises the nudge", () => {
  assert.deepEqual(math.magnetOffset(0, 0, 120, 48), { x: 0, y: 0, nx: 0, ny: 0 });
  const pull = math.magnetOffset(20, -10, 120, 48);
  near(pull.x, 7); near(pull.y, -3.5); near(pull.nx, 20 / 60); near(pull.ny, -10 / 24);
  assert.deepEqual(math.magnetOffset(400, -400, 120, 48), { x: 10, y: -10, nx: 1, ny: -1 });
  assert.equal(math.magnetOffset(400, 0, 120, 48, 6).x, 6);
});

test("tiltAngles dips the side under the pointer, within max", () => {
  assert.deepEqual(math.tiltAngles(50, 50, 100, 100), { rx: 0, ry: 0 });
  assert.deepEqual(math.tiltAngles(0, 0, 100, 100), { rx: 4, ry: -4 });
  assert.deepEqual(math.tiltAngles(100, 100, 100, 100, 3), { rx: -3, ry: 3 });
  assert.deepEqual(math.tiltAngles(-50, 250, 100, 100), { rx: -4, ry: -4 });
});

test("repelOffset pushes a letter away from a nearby pointer", () => {
  assert.deepEqual(math.repelOffset(0, 0), { x: 0, y: 0 });
  assert.deepEqual(math.repelOffset(140, 0), { x: 0, y: 0 });
  assert.deepEqual(math.repelOffset(0, 300), { x: 0, y: 0 });
  const left = math.repelOffset(70, 0, 140, 18);
  near(left.x, -4.5); near(left.y, 0);
  const up = math.repelOffset(0, 35, 140, 16);
  near(up.x, 0); near(up.y, -9);
});

test("tickerFromVelocity speeds up and skews with scroll, within limits", () => {
  assert.deepEqual(math.tickerFromVelocity(0), { rate: 1, skew: 0 });
  near(math.tickerFromVelocity(900).rate, 2);
  near(math.tickerFromVelocity(-900).rate, 2);
  near(math.tickerFromVelocity(320).skew, -1);
  near(math.tickerFromVelocity(-320).skew, 1);
  assert.deepEqual(math.tickerFromVelocity(1e6), { rate: 5, skew: -8 });
  assert.deepEqual(math.tickerFromVelocity(-1e6), { rate: 5, skew: 8 });
});

test("curtainReveal measures how much of the footer is uncovered", () => {
  // A 5000 px page that ends with an 800 px footer, in a 1000 px viewport.
  assert.equal(math.curtainReveal(0, 1000, 5000, 800), 0);
  assert.equal(math.curtainReveal(3200, 1000, 5000, 800), 0);
  assert.equal(math.curtainReveal(3600, 1000, 5000, 800), 0.5);
  assert.equal(math.curtainReveal(4000, 1000, 5000, 800), 1);
  assert.equal(math.curtainReveal(10, 1000, 5000, 0), 1);
});

test("cellAt and ringDistance drive the dot-matrix ripple", () => {
  assert.deepEqual(math.cellAt(0, 0, 200, 100, 5, 5), { row: 0, col: 0 });
  assert.deepEqual(math.cellAt(199, 99, 200, 100, 5, 5), { row: 4, col: 4 });
  assert.deepEqual(math.cellAt(250, -10, 200, 100, 5, 5), { row: 0, col: 4 });
  assert.deepEqual(math.cellAt(100, 50, 200, 100, 5, 5), { row: 2, col: 2 });
  assert.equal(math.ringDistance(2, 2, 2, 2), 0);
  assert.equal(math.ringDistance(2, 2, 1, 3), 1);
  assert.equal(math.ringDistance(0, 0, 4, 1), 4);
});

test("splitWords keeps every character, in order, per word", () => {
  assert.deepEqual(splitWords("What We Do"), [
    { text: "What", chars: ["W", "h", "a", "t"] },
    { text: "We", chars: ["W", "e"] },
    { text: "Do", chars: ["D", "o"] },
  ]);
  assert.deepEqual(splitWords("  Questions  &  Answers ").map((word) => word.text), ["Questions", "&", "Answers"]);
  assert.deepEqual(splitWords("Café")[0].chars, ["C", "a", "f", "é"]);
  assert.deepEqual(splitWords("éx")[0].chars, ["é", "x"]);
  assert.deepEqual(splitWords(""), []);
});

test("charOffsets numbers characters across the title for the stagger", () => {
  assert.deepEqual(charOffsets(splitWords("What We Do")), [0, 4, 6]);
  assert.deepEqual(charOffsets([]), []);
});

function fakeScheduler() {
  const queue = [];
  return {
    queue,
    request: (callback) => { queue.push(callback); return queue.length; },
    cancel: () => { queue.length = 0; },
  };
}

test("createIdleLoop runs only while the tick reports work, with a clock that never jumps", () => {
  const scheduler = fakeScheduler();
  const times = [], steps = [];
  let budget = 3;
  const loop = createIdleLoop((time, dt) => { times.push(time); steps.push(dt); return --budget > 0; }, scheduler);
  assert.equal(loop.running, false);
  loop.start();
  loop.start();
  assert.equal(scheduler.queue.length, 1, "a second start is a no-op");
  let now = 1000;
  while (scheduler.queue.length) { scheduler.queue.shift()(now); now += 16; }
  assert.equal(times.length, 3);
  assert.equal(loop.running, false, "the loop stops itself once idle");
  near(steps[0], 1000 / 60); near(steps[1], 16); near(steps[2], 16);
  near(times[2] - times[0], 32);
  budget = 1;
  now += 5000;
  loop.start();
  scheduler.queue.shift()(now);
  near(steps[3], 1000 / 60, "after a pause the clock advances one frame, not the pause");
  near(times[3] - times[2], 1000 / 60);
});

test("createIdleLoop caps a long frame and stop() cancels the pending frame", () => {
  const scheduler = fakeScheduler();
  const steps = [];
  const loop = createIdleLoop((_, dt) => { steps.push(dt); return true; }, scheduler);
  loop.start();
  scheduler.queue.shift()(100);
  scheduler.queue.shift()(400);
  near(steps[1], 50, "a 300 ms frame counts as 50 ms");
  loop.stop();
  assert.equal(loop.running, false);
  assert.equal(scheduler.queue.length, 0);
});
