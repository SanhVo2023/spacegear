import { test } from "node:test";
import assert from "node:assert/strict";

const { createPendingLoads } = await import("../src/components/globe/pending-load.ts");

/** A start function that records its calls and hands out loads the test settles by hand. */
function starter() {
  const calls = [];
  const start = (key) => {
    let resolve, reject;
    const load = new Promise((res, rej) => { resolve = res; reject = rej; });
    calls.push({ key, load, resolve, reject });
    return load;
  };
  return { calls, start };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("render attempts before a commit share one load per scene variant", () => {
  const { calls, start } = starter();
  const loads = createPendingLoads(start);
  const first = loads.take("mobile");
  const retried = loads.take("mobile");
  assert.equal(retried, first, "a retried first render reuses the pending load");
  assert.equal(calls.length, 1, "one load started for two render attempts");
  const desktop = loads.take("cinematic");
  assert.notEqual(desktop, first, "each variant has its own load");
  assert.deepEqual(calls.map((call) => call.key), ["mobile", "cinematic"]);
});

test("a commit hands the load to its scene, so the next mount starts its own", () => {
  const { calls, start } = starter();
  const loads = createPendingLoads(start);
  const load = loads.take("mobile");
  loads.commit("mobile", load);
  assert.equal(loads.pending("mobile"), false, "the committed load is no longer pending");
  const next = loads.take("mobile");
  assert.notEqual(next, load, "a later mount starts a new load");
  assert.equal(calls.length, 2);
  // A stale commit (an older scene's load) leaves the newer pending load alone.
  loads.commit("mobile", load);
  assert.equal(loads.pending("mobile"), true);
  assert.equal(loads.take("mobile"), next);
});

test("a rejected load is dropped, never reused", async () => {
  const { calls, start } = starter();
  const loads = createPendingLoads(start);
  const failed = loads.take("cinematic");
  // The scene's error boundary sees the rejection through use(); the module only marks it handled.
  failed.catch(() => {});
  calls[0].reject(new Error("404"));
  await settle();
  assert.equal(loads.pending("cinematic"), false, "the failed load is removed");
  const retry = loads.take("cinematic");
  assert.notEqual(retry, failed, "a remount after a failure fetches again");
  assert.equal(calls.length, 2);
});

test("a stale load that fails late leaves the newer pending load alone", async () => {
  const { calls, start } = starter();
  const loads = createPendingLoads(start);
  const old = loads.take("mobile");
  old.catch(() => {});
  loads.commit("mobile", old);
  const fresh = loads.take("mobile");
  calls[0].reject(new Error("aborted"));
  await settle();
  assert.equal(loads.pending("mobile"), true, "the newer load is still pending");
  assert.equal(loads.take("mobile"), fresh);
  calls[1].resolve("textures");
  assert.equal(await fresh, "textures");
});

test("a rejection is handled by the module, so it never surfaces as unhandled", async () => {
  const { calls, start } = starter();
  const loads = createPendingLoads(start);
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    loads.take("mobile");
    calls[0].reject(new Error("decode"));
    await settle();
    await settle();
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});
