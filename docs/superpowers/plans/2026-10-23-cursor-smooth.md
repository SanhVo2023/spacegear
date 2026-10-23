# Smoother custom cursor: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The custom cursor keeps its look but feels instant. The dot is painted in the first frame after each pointer event. The ring trails on a critically damped follower that settles in about 100 ms. The cursor no longer blends.

**Architecture:**
- `Cursor.tsx` stops using Motion.
- **Dot:** the input handler writes its `translate3d` directly. The handler listens to `pointerrawupdate` where the browser has it, otherwise `pointermove`, and uses the last coalesced point.
- **Ring:** a pure critically damped step (`trailStep` in `math.ts`, unit-tested) moves it. The existing `createIdleLoop` drives that step, so no frame is requested once the ring is at rest. A pointer jump of more than 300 px snaps the ring onto the pointer.
- **CSS:** the FX block drops `mix-blend-mode`. The white parts get a dark hairline, and the hover fill becomes translucent so the link under it stays legible. Only the two moving layers get `will-change: transform` and `contain: layout style`.

**Tech stack:**
- Next 16 static export, React 19 and the existing fx helpers;
- `node:test` for the unit tests;
- Playwright, through `scripts/fx-checks.mjs`, for the browser checks.

**Spec:** Part 1 of `docs/superpowers/specs/2026-10-23-bilingual-labs-cursor-design.md` (on `feat/bilingual`).

**Where:**
- Worktree `E:/Personal/clone website/spacegear-motion`, branch `feat/cursor-smooth`, preview port 8791. Port 8787 is off-limits.
- Every build, preview and Playwright run goes through `wt.sh`, as in `showcase-conventions.md`. `<wt.sh>` below means that script.

---

## Files

| File | Change |
|---|---|
| `src/components/fx/math.ts` | Add `Trail` and `trailStep()`, the critically damped follower step (pure). |
| `tests/fx.test.mjs` | Unit tests for `trailStep`: stopping from 1000 px/s settles in about 100 ms without overshoot; the same path at any frame rate; at rest it stays at rest. |
| `src/components/fx/Cursor.tsx` | Drop Motion. Write the dot directly in the input handler and drive the ring with `createIdleLoop` + `trailStep`. Snap on jumps over 300 px. Every other behaviour stays as it is. |
| `src/app/globals.css` | Cursor rules in the FX block. Remove `mix-blend-mode`, add dark hairlines and a translucent hover fill, and add a default off-screen `translate3d`, `will-change: transform` and `contain: layout style` on `.fx-cursor-dot-pos` and `.fx-cursor-ring`. Update the view-transition comment. |
| `scripts/fx-checks.mjs` | Add the exported helpers `probeCursor`, `stopProbe`, `glide` and `cursorTiming`, plus two desktop checks: dot latency, look and blending; ring settle, snap and idle frames. |

Kept unchanged:
- `FxLayer.tsx` still loads Cursor with `next/dynamic` and `ssr: false`, so the server markup is unchanged.
- `idle-loop.ts`.
- The view-transition rules, except one comment.
- z-index 110, the `data-fx-cursor` root flag, the labels, the text state, hiding on the keyboard and on touch, forced colours, and the route re-check.

---

### Task 1: The follower step (`trailStep`)

**Files:**
- Modify: `src/components/fx/math.ts` (append)
- Test: `tests/fx.test.mjs`

- [ ] **Step 1: Write the failing tests.** Add them to `tests/fx.test.mjs`, after the `createIdleLoop` tests.

```js
test("trailStep comes to rest on a pointer that stops from 1000 px/s in about 100 ms, without overshoot", () => {
  const dt = 1 / 60;
  let trail = { x: 0, y: 0, vx: 0, vy: 0 };
  let target = 0;
  for (let i = 0; i < 30; i++) {
    target += 1000 * dt;
    trail = math.trailStep(trail, target, 0, dt).trail;
    assert.ok(trail.x <= target, "the ring never passes the pointer");
  }
  let settle = 0;
  for (let moving = true; moving; settle += dt) {
    const step = math.trailStep(trail, target, 0, dt);
    trail = step.trail;
    moving = step.moving;
    assert.ok(trail.x <= target, "no overshoot after the stop");
  }
  assert.ok(settle >= 0.06 && settle <= 0.125, `settles in about 100 ms (${(settle * 1000).toFixed(0)} ms)`);
  assert.deepEqual(trail, { x: target, y: 0, vx: 0, vy: 0 }, "lands exactly on the pointer");
});

test("trailStep gives the same path at any frame rate", () => {
  const start = { x: 0, y: 0, vx: 300, vy: -200 };
  const one = math.trailStep(start, 120, 80, 0.032).trail;
  const half = math.trailStep(math.trailStep(start, 120, 80, 0.016).trail, 120, 80, 0.016).trail;
  for (const key of ["x", "y", "vx", "vy"]) near(one[key], half[key], key);
});

test("trailStep keeps a ring at rest on the pointer at rest", () => {
  const step = math.trailStep({ x: 40, y: 50, vx: 0, vy: 0 }, 40, 50, 1 / 60);
  assert.deepEqual(step, { trail: { x: 40, y: 50, vx: 0, vy: 0 }, moving: false });
});
```

- [ ] **Step 2: Run them to see them fail.**

Run: `npm test -- --test-name-pattern trailStep` (or the full `npm test`).
Expected: FAIL with `math.trailStep is not a function`.

- [ ] **Step 3: Implement.** Append to `src/components/fx/math.ts`:

```ts
/** A point that trails a target (the cursor ring): position in px, velocity in px/s. */
export type Trail = { x: number; y: number; vx: number; vy: number };

/** One axis of a critically damped spring, solved exactly over `dt` seconds: [position, velocity]. */
function critical(position: number, velocity: number, target: number, omega: number, dt: number): [number, number] {
  const offset = position - target;
  const c = velocity + omega * offset;
  const decay = Math.exp(-omega * dt);
  return [target + (offset + c * dt) * decay, (velocity - omega * c * dt) * decay];
}

/**
 * Moves `trail` toward (tx, ty) over `dt` seconds on a critically damped spring of natural frequency `omega`
 * (1/s). It never overshoots, and the closed form gives the same path at any frame rate. With omega 60, a
 * pointer stopping from 1000 px/s is reached in about 100 ms. Within `rest` px and below 40·rest px/s it
 * lands exactly on the target and reports `moving: false`.
 */
export function trailStep(trail: Trail, tx: number, ty: number, dt: number, omega = 60, rest = 0.25) {
  const [x, vx] = critical(trail.x, trail.vx, tx, omega, dt);
  const [y, vy] = critical(trail.y, trail.vy, ty, omega, dt);
  if (Math.hypot(x - tx, y - ty) < rest && Math.hypot(vx, vy) < rest * 40) {
    return { trail: { x: tx, y: ty, vx: 0, vy: 0 }, moving: false };
  }
  return { trail: { x, y, vx, vy }, moving: true };
}
```

- [ ] **Step 4: Run the tests to see them pass.**

Run: `npm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/fx/math.ts tests/fx.test.mjs
git commit -m "feat(fx): critically damped trail step for the cursor ring"
```

### Task 2: Browser checks first (red against today's cursor)

**Files:**
- Modify: `scripts/fx-checks.mjs`. The helpers go after `matrixOf`; the checks go after "the cursor never takes a pointer event, and the live globe labels it Drag".

- [ ] **Step 1: Add the helpers.** They are exported, so a scratch measurement script can reuse them.

```js
/** Starts recording, in the page, every pointer point (coalesced ones included) and, once per frame, where the
 *  cursor's dot and ring sit in that frame. A ResizeObserver callback reads them: it runs after every animation-frame
 *  callback, once style and layout are done, just before paint, so it reads what the frame paints. */
export function probeCursor(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    const dot = root.querySelector(".fx-cursor-dot-pos");
    const ring = root.querySelector(".fx-cursor-ring");
    const at = (el) => {
      const transform = getComputedStyle(el).transform;
      const m = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
      return [m.m41, m.m42];
    };
    const log = { points: [], frames: [] };
    const onMove = (event) => {
      const merged = event.getCoalescedEvents?.() ?? [];
      for (const p of merged.length ? merged : [event]) log.points.push({ t: p.timeStamp, x: p.clientX, y: p.clientY });
    };
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none";
    document.body.append(probe);
    let frameTime = 0;
    let running = true;
    const observer = new ResizeObserver(() => {
      if (frameTime) log.frames.push({ t: frameTime, ready: performance.now(), dot: at(dot), ring: at(ring) });
    });
    observer.observe(probe);
    const tick = (time) => {
      if (!running) return;
      frameTime = time;
      probe.style.height = probe.style.height === "2px" ? "1px" : "2px"; // a resize every frame wakes the observer
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove, { capture: true, passive: true });
    window.__cursorProbe = () => {
      running = false;
      observer.disconnect();
      probe.remove();
      window.removeEventListener("pointermove", onMove, { capture: true });
      return log;
    };
  });
}

/** Stops probeCursor and returns its log. */
export function stopProbe(page) {
  return page.evaluate(() => window.__cursorProbe());
}

/** Moves the mouse from `from` to `to` in `steps` integer moves, one every `every` ms (a 125 Hz mouse): x rises
 *  at every step (so each position names one move), and y rides a gentle wave. */
export async function glide(page, from, to, { steps = 200, every = 8, wave = 60 } = {}) {
  let next = performance.now();
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    next += every;
    while (performance.now() < next) await new Promise((resolve) => setImmediate(resolve));
    await page.mouse.move(Math.round(from.x + (to.x - from.x) * f), Math.round(from.y + (to.y - from.y) * f + wave * Math.sin(f * Math.PI * 2)));
  }
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : NaN;
};

/** Reads a probeCursor log taken over a glide.
 *  - For each move: `late` counts the frames that started after the move and still did not show it (0 means
 *    painted in the first frame after the event); `ms` is the time until the frame that shows it was ready.
 *  - `long`: frames longer than 25 ms while the pointer moved.
 *  - `ringSettle`: the ms after the last move until the ring rests on the pointer (within 0.5 px) for good. */
export function cursorTiming({ points, frames }) {
  const byX = new Map(points.map((p, i) => [p.x, i]));
  const shown = frames.map((f) => {
    const i = byX.get(f.dot[0]);
    return i !== undefined && Math.abs(points[i].y - f.dot[1]) < 0.01 ? i : -1;
  });
  const late = [];
  const ms = [];
  let cover = 0;
  for (let i = 0; i < points.length; i++) {
    while (cover < frames.length && shown[cover] < i) cover++;
    if (cover === frames.length) break;
    late.push(frames.slice(0, cover).filter((f) => f.t > points[i].t).length);
    ms.push(frames[cover].ready - points[i].t);
  }
  const end = points.at(-1);
  const steps = frames.slice(1).map((f, i) => ({ t: f.t, step: f.t - frames[i].t })).filter((f) => f.t >= points[0].t && f.t <= end.t + 50);
  const off = frames.findLastIndex((f) => Math.hypot(f.ring[0] - end.x, f.ring[1] - end.y) > 0.5 || f.dot[0] !== end.x || f.dot[1] !== end.y);
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    moves: points.length,
    painted: late.length,
    lateFrames: { p50: percentile(late, 0.5), p95: percentile(late, 0.95), max: Math.max(...late) },
    ms: { p50: r1(percentile(ms, 0.5)), p95: r1(percentile(ms, 0.95)), max: r1(Math.max(...ms)) },
    frames: steps.length,
    long: steps.filter((f) => f.step > 25).length,
    longest: r1(Math.max(0, ...steps.map((f) => f.step))),
    ringSettle: off + 1 < frames.length ? r1(frames[off + 1].ready - end.t) : Infinity,
  };
}
```

- [ ] **Step 2: Add the two checks.**

```js
/** Blend modes other than normal anywhere in the cursor. */
function cursorBlends(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    return [root, ...root.querySelectorAll("*")].map((el) => getComputedStyle(el).mixBlendMode).filter((mode) => mode !== "normal");
  });
}

desktop("the cursor dot is painted in the first frame after each move, over the globe, and never blends", async (page) => {
  await page.waitForSelector('#home .hero-scene[data-cursor="Drag"]', { timeout: 45000 }); // the live globe renders under the path
  await page.mouse.move(700, 480);
  await page.mouse.move(710, 480, { steps: 2 });
  await page.waitForTimeout(400);
  await probeCursor(page);
  await glide(page, { x: 720, y: 480 }, { x: 1320, y: 480 }, { steps: 200 });
  await page.waitForTimeout(400);
  const timing = cursorTiming(await stopProbe(page));
  const facts = JSON.stringify(timing);
  assert.ok(timing.painted >= 190, `desktop: the probe saw the dot reach the glide's moves (${facts})`);
  assert.ok(timing.lateFrames.p95 === 0 && timing.lateFrames.max <= 1, `desktop: the dot is painted in the first frame after each move, at worst one frame later (${facts})`);
  assert.deepEqual(await cursorBlends(page), [], "desktop: over the globe (Drag) the cursor does not blend");
  const look = await page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    const style = (selector) => getComputedStyle(root.querySelector(selector));
    return {
      dotOutline: style(".fx-cursor-dot").boxShadow !== "none",
      ringOutline: style(".fx-cursor-disc").boxShadow !== "none",
      promoted: [style(".fx-cursor-dot-pos").willChange, style(".fx-cursor-ring").willChange, getComputedStyle(root).willChange],
    };
  });
  assert.deepEqual(look, { dotOutline: true, ringOutline: true, promoted: ["transform", "transform", "auto"] }, "desktop: the white dot and ring carry a dark outline, and only the moving layers are promoted");
  const link = await page.locator('header a[href="/about/"]').first().boundingBox();
  await page.mouse.move(link.x + link.width / 2, link.y + link.height / 2, { steps: 4 });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.querySelector("[data-fx-cursor-root]").dataset.state), "hover", "desktop: over a nav link the cursor morphs (precondition)");
  assert.deepEqual(await cursorBlends(page), [], "desktop: over a link the cursor does not blend");
});

desktop("the cursor ring settles on the pointer within 150 ms of a stop, snaps across long jumps, then requests no frames", async (page) => {
  await jumpTo(page, await sectionTop(page, "pricing"));
  await page.mouse.move(6, 420);
  await page.waitForTimeout(800);
  await probeCursor(page);
  await glide(page, { x: 20, y: 420 }, { x: 620, y: 420 }, { steps: 100, wave: 40 }); // 6 px every 8 ms: 750 px/s
  await page.waitForTimeout(500);
  const timing = cursorTiming(await stopProbe(page));
  assert.ok(timing.ringSettle <= 150, `desktop: the ring rests on the pointer within 150 ms of a stop (${JSON.stringify(timing)})`);
  await probeCursor(page);
  await page.mouse.move(1100, 700); // one 530 px jump
  await page.waitForTimeout(300);
  const jump = await stopProbe(page);
  const landed = jump.frames.find((f) => f.dot[0] === 1100 && f.dot[1] === 700);
  assert.deepEqual(landed?.ring, [1100, 700], "desktop: after a jump of more than 300 px the ring is on the pointer in the same frame as the dot");
  await page.waitForTimeout(600);
  const frames = await idleFrames(page);
  assert.ok(frames <= 2, `desktop: a resting cursor requests no frames (${frames} in 300 ms)`);
});
```

- [ ] **Step 3: Rebuild today's cursor and run the new checks to see them fail.**

```bash
bash "<wt.sh>" "E:/Personal/clone website/spacegear-motion" 8791 rebuild
FX_ONLY="first frame after each move|ring settles" bash "<wt.sh>" "E:/Personal/clone website/spacegear-motion" 8791 run node scripts/fx-checks.mjs http://127.0.0.1:8791
```

Expected: FAIL. The ring check fails on its settle time (the Motion spring needs well over 150 ms) and the dot check on blending (`difference`). The dot-latency assertion may already pass in Chromium: the record notes it either way.

- [ ] **Step 4: Measure BEFORE** with the scratch script `<scratchpad>/cursor/measure.mjs`. It imports `fresh`, `probeCursor`, `stopProbe`, `glide` and `cursorTiming` from `scripts/fx-checks.mjs`, and `launchBrowser` from `scripts/browser-runtime.mjs`.
  - Profile: desktop 1440×900, fine pointer.
  - Scenarios: glides over the hero globe (slow, 250 px/s; fast, 1000 px/s) and over the page (#pricing, 375 px/s and 1000 px/s), three runs each.
  - It prints the latency p50/p95/max (in frames and ms), the long frames and the ring settle time.

```bash
bash "<wt.sh>" "E:/Personal/clone website/spacegear-motion" 8791 run node "<scratchpad>/cursor/measure.mjs" http://127.0.0.1:8791 before
```

- [ ] **Step 5: Commit the checks** (red on today's cursor; Task 3 makes them pass).

```bash
git add scripts/fx-checks.mjs
git commit -m "test(fx): cursor paint-latency, ring-settle and no-blend checks"
```

### Task 3: The cursor

**Files:**
- Modify: `src/components/fx/Cursor.tsx` (rewrite of its effect and its markup)
- Modify: `src/app/globals.css`, the Cursor rules in the FX block and the view-transition comment

- [ ] **Step 1: Rewrite `Cursor.tsx`.**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createIdleLoop } from "./idle-loop";
import { trailStep, type Trail } from "./math";

type CursorState = "hidden" | "idle" | "hover" | "label" | "text";

/** Elements that make the ring grow. */
const INTERACTIVE = 'a[href], button, summary, label, [role="button"], [role="switch"], [role="marquee"]';
/** Over form fields the custom cursor steps aside for the native caret. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);
/** A pointer this far (px) from the ring, re-entering the window say, puts the ring on it at once. */
const RING_SNAP = 300;

function place(el: HTMLElement, x: number, y: number) {
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

/** The newest point an input event carries: the last coalesced one when the browser merged several. */
function latest(event: PointerEvent) {
  const merged = event.getCoalescedEvents?.();
  return merged?.length ? merged[merged.length - 1] : event;
}

/**
 * Dot + ring cursor for fine-pointer desktops (FxLayer mounts it only there). The dot is written straight
 * from the input event (pointerrawupdate where the browser has it), so it is painted in the next frame. The
 * ring trails it on a critically damped follower (trailStep) whose frame loop stops once it rests. The ring
 * grows over interactive elements and shows the label of the nearest [data-cursor] ("View", "Drag", "Open").
 * Over form fields and during keyboard use it steps aside and the native cursor returns, so it never covers
 * a focus ring. It is click-through and hidden from assistive technology.
 */
export default function Cursor() {
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<CursorState>("hidden");
  const [label, setLabel] = useState("");
  const pathname = usePathname();
  const recheck = useRef(() => {});

  useEffect(() => {
    const root = document.documentElement;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;
    let visible = false;
    let px = -100;
    let py = -100;
    let trail: Trail = { x: px, y: py, vx: 0, vy: 0 };
    const loop = createIdleLoop((_, dt) => {
      const step = trailStep(trail, px, py, dt / 1000);
      trail = step.trail;
      place(ring, trail.x, trail.y);
      return step.moving;
    });
    const classify = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      if (!el) {
        setState("idle");
        return;
      }
      if (el.closest(TEXT_ENTRY)) {
        setState("text");
        return;
      }
      const labelled = el.closest<HTMLElement>("[data-cursor]");
      if (labelled?.dataset.cursor) {
        setLabel(labelled.dataset.cursor);
        setState("label");
        return;
      }
      setState(el.closest(INTERACTIVE) ? "hover" : "idle");
    };
    const hide = () => {
      visible = false;
      root.removeAttribute("data-fx-cursor");
      setState("hidden");
    };
    const onMove = (event: Event) => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType !== "mouse") {
        if (visible) hide();
        return;
      }
      const point = latest(pointer);
      px = point.clientX;
      py = point.clientY;
      place(dot, px, py);
      if (!visible || Math.hypot(px - trail.x, py - trail.y) > RING_SNAP) {
        loop.stop();
        trail = { x: px, y: py, vx: 0, vy: 0 };
        place(ring, px, py);
      } else {
        loop.start();
      }
      if (!visible) {
        visible = true;
        root.setAttribute("data-fx-cursor", "");
        classify(pointer.target);
      }
    };
    const onDown = (event: PointerEvent) => {
      if (visible && event.pointerType !== "mouse") hide();
    };
    const onOver = (event: PointerEvent) => {
      if (visible && event.pointerType === "mouse") classify(event.target);
    };
    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (visible && !MODIFIERS.has(event.key)) hide();
    };
    // A click navigation swaps the page under a still pointer, and not every browser sends pointerover then.
    recheck.current = () => {
      if (visible) classify(document.elementFromPoint(px, py));
    };
    // pointerrawupdate (Chromium, secure contexts) fires as soon as the input arrives, not aligned to a frame.
    const move = "onpointerrawupdate" in window ? "pointerrawupdate" : "pointermove";
    window.addEventListener(move, onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", hide);
    return () => {
      loop.stop();
      window.removeEventListener(move, onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", hide);
      root.removeAttribute("data-fx-cursor");
      recheck.current = () => {};
    };
  }, []);

  // After a route change, read again what is under the pointer (a stale "View" would otherwise stay).
  useEffect(() => {
    recheck.current();
  }, [pathname]);

  // The two moving spans carry no React style: their transforms are written directly, outside rendering.
  return (
    <div aria-hidden data-fx-cursor-root="" data-state={state} className="fx-cursor">
      {/* The outer span carries the position, the inner one scales: CSS `scale` applies outside `transform`,
          so scaling the positioned span itself would pull the dot toward the viewport origin. */}
      <span ref={dotRef} className="fx-cursor-dot-pos">
        <span className="fx-cursor-dot" />
      </span>
      <span ref={ringRef} className="fx-cursor-ring">
        <span className="fx-cursor-disc" />
        <span className="fx-cursor-label">{label}</span>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Replace the Cursor rules in the FX block of `globals.css`.** They run from the `/* Cursor (Cursor.tsx)` comment to the `data-state="hidden"` rule.

```css
/* Cursor (Cursor.tsx): a dot written straight from the input events and a ring on a critically damped
   follower; the native caret over fields. Nothing blends (a difference blend over the WebGL globe made the
   compositor blend every frame): the white dot and ring carry a dark hairline, so they read on light and
   dark grounds, and the hover fill is translucent, so the link under it stays legible. Only the two moving
   layers are promoted and contained. It sits above the skip link (100): it takes no pointer events. FxLayer
   does not mount it in forced colours. */
html[data-fx-cursor],
html[data-fx-cursor] * { cursor: none !important; }
html[data-fx-cursor] :is(input, textarea, select, [contenteditable]) { cursor: auto !important; }
.fx-cursor { position: fixed; left: 0; top: 0; z-index: 110; width: 0; height: 0; pointer-events: none; }
.fx-cursor-dot-pos,
.fx-cursor-ring { position: absolute; left: 0; top: 0; transform: translate3d(-100px, -100px, 0); will-change: transform; contain: layout style; }
.fx-cursor-dot { display: block; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 9999px; background: #fff; box-shadow: 0 0 0 1px rgba(22, 23, 25, 0.55); transition: opacity 0.2s, scale 0.3s var(--fx-ease); }
.fx-cursor-ring { display: grid; place-items: center; width: 40px; height: 40px; margin: -20px 0 0 -20px; }
.fx-cursor-disc { position: absolute; inset: 0; border: 1.5px solid #fff; border-radius: 9999px; box-shadow: 0 0 0 1px rgba(22, 23, 25, 0.45), inset 0 0 0 1px rgba(22, 23, 25, 0.45); transition: opacity 0.2s, scale 0.4s var(--fx-ease), background-color 0.25s, border-color 0.25s, box-shadow 0.25s; }
.fx-cursor-label { position: relative; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #161719; opacity: 0; transition: opacity 0.2s; }
.fx-cursor:is([data-state="hover"], [data-state="label"]) .fx-cursor-dot { scale: 0; }
.fx-cursor[data-state="hover"] .fx-cursor-disc { scale: 1.6; background: rgba(255, 255, 255, 0.16); }
.fx-cursor[data-state="label"] .fx-cursor-disc { scale: 2.2; border-color: #fa6e43; background: #fa6e43; box-shadow: none; }
.fx-cursor[data-state="label"] .fx-cursor-label { opacity: 1; }
.fx-cursor:is([data-state="hidden"], [data-state="text"]) :is(.fx-cursor-dot, .fx-cursor-disc) { opacity: 0; }
```

In the page-transition comment, replace "still click-through, and its difference blend carries over." with "still click-through." The rule itself is unchanged.

- [ ] **Step 3: Fast gates.**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Rebuild and run the new checks to see them pass.**

```bash
bash "<wt.sh>" "E:/Personal/clone website/spacegear-motion" 8791 rebuild
FX_ONLY="first frame after each move|ring settles" bash "<wt.sh>" "E:/Personal/clone website/spacegear-motion" 8791 run node scripts/fx-checks.mjs http://127.0.0.1:8791
```

Expected: PASS.

- [ ] **Step 5: Measure AFTER** with the same script (`… measure.mjs http://127.0.0.1:8791 after`) and compare it with BEFORE.

- [ ] **Step 6: Commit**

```bash
git add src/components/fx/Cursor.tsx src/app/globals.css
git commit -m "feat(fx): the cursor dot paints in the next frame, the ring settles in ~100 ms, no blending"
```

### Task 4: Gates

- [ ] `npm run lint && npm run typecheck && npm test`
- [ ] `bash "<wt.sh>" "E:/Personal/clone website/spacegear-motion" 8791 rebuild` (the build includes `check-export`).
- [ ] The full fx-checks: `bash "<wt.sh>" … 8791 run node scripts/fx-checks.mjs http://127.0.0.1:8791`. Every existing cursor check must pass: the labels, the hover, the keyboard hide and the text field, forced colours, the route re-check, the dot staying under the pointer while it morphs, and the curtain naming.
- [ ] One full browser run: `bash "<wt.sh>" … 8791 run npm run test:browser -- http://127.0.0.1:8791`. Check free memory first.
- [ ] `bash "<wt.sh>" … 8791 stop`.

## Self-review against the spec

The spec's requirements and where they are handled:

| Spec requirement | Where |
|---|---|
| Dot written in the input handler, `pointerrawupdate` or `pointermove`, last coalesced point, `translate3d`, no Motion | Task 3 Step 1 (`onMove`, `latest`, `place`) |
| Ring: critically damped, about 100 ms, snaps over 300 px, idle loop | Task 1 (`trailStep`, unit-tested settle) and Task 3 (`createIdleLoop`, `RING_SNAP`) |
| No `mix-blend-mode`; dark hairline on the white dot and ring; the orange label disc unchanged | Task 3 Step 2 (CSS) and Task 2 (`cursorBlends`, outline check) |
| `will-change` and `contain` on the moving layers only | Task 3 Step 2 and Task 2 (the `promoted` assertion) |
| Kept: labels, text state, keyboard and touch hide, forced colours, route re-check, z-index 110, view-transition naming | Task 3 (same logic and selectors) and Task 4 (existing fx-checks) |
| Measured before and after: latency, ring settle, dropped frames | Task 2 Step 4 and Task 3 Step 5 |
| fx-checks: dot within one frame, ring under 150 ms | Task 2 Step 2 |

**One deviation by necessity: the hover fill.** Without blending, the 64 px solid white hover disc would hide the link text under it, so the fill becomes 16% white. The owner should feel-check it.

**One addition: a pointer-down hide.** A non-mouse pointer-down also hides the cursor, so a touch tap on a hybrid laptop hides it even when the browser sends no `pointerrawupdate` for touch.

## Amendments made during execution

1. **The dot was already painted in the first frame after each event.** The BEFORE run used headless Chromium 156 at 1440×900, rendering on ANGLE D3D11 with the NVIDIA GTX 1660 Ti (not the AMD iGPU). The Motion-driven dot showed 0 late frames at p95, and the event-to-frame-ready time was the same as AFTER.
   - Chromium dispatches frame-aligned `pointermove` before the frame's animation callbacks, so Motion's render runs in the same frame.
   - So the dot-latency check passes on both versions. It pins the behaviour; it does not prove the change.
   - What the change does deliver: the ring, no compositor blending, and no Motion work per move.
2. **The glide is about one step per frame.** An awaited `page.mouse.move` returns only once the page has taken the move, about one frame later, so the fx-checks glide advances about one step per frame. The comments now say so.
   - The scratch measurement adds a second driver: raw CDP `Input.dispatchMouseEvent` every 8 ms, not awaited. That is a real 125 Hz mouse, with several moves per frame, coalesced.
3. **The outline is checked per state.** Over the globe the cursor reads Drag, and the orange label disc keeps its outline-free look by design. So the check expects no ring outline in the label state, and checks the white ring's outline over a nav link (hover state).
