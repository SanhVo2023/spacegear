# Showcase Part 2 — Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give spacegear.tech a bold, showcase-grade motion system — smooth scroll, a morphing cursor, magnetic and tilting surfaces, split-character titles, a section progress rail, film grain, per-section scroll choreography, micro-interactions and an orange curtain between pages — without regressing no-JS, reduced motion, keyboard access, the CSP or the 60 fps budget.

**Architecture:** Small client-only primitives in `src/components/fx/` built on the existing Motion (`motion/react`) plus Lenis for smooth scrolling (no GSAP). One media gate decides everything: heavy effects run only after hydration on `(hover: hover) and (pointer: fine)` at ≥1024 px with motion allowed (`useFx()`, `html[data-fx]`); light reveals and scroll draws run wherever motion is allowed (`html[data-fx-motion]`). Without a flag, every rule leaves content in its end state, so the static export, no-JS and reduced-motion visitors keep today's markup and visibility. Idle pages request no animation frames: entrance effects are CSS transitions toggled by IntersectionObserver, scroll-linked effects read Motion `useScroll` values without springs, and pointer effects only animate while the pointer moves. Page transitions use React `<ViewTransition>` with Next 16's `experimental.viewTransition`.

**Tech Stack:** Next.js 16.2.7 (static export), React 19.2 (Next's bundled canary for `ViewTransition`), Motion 12.40, Lenis 1.3.26 (new, pinned), Tailwind CSS 4, Playwright (Chromium) for `scripts/browser-check.mjs` + new `scripts/fx-checks.mjs`, node:test + tsx for unit tests.

**Spec:** `docs/superpowers/specs/2026-10-21-spacegear-showcase-design.md`, Part 2 (approved). Read its guardrails and testing sections first.

---

## Conventions for every task

### Environment (from the showcase conventions)

- **Worktree:** `E:\Personal\clone website\spacegear`, branch `feat/spacegear-showcase`. Quote paths (the folder name has a space). Never edit `E:\Personal\clone website\platform-clone`.
- **Next 16 differs from older versions.** The Next-specific code in this plan follows `node_modules/next/dist/docs/` (`01-app/02-guides/view-transitions.md`, `01-app/03-api-reference/05-config/01-next-config-js/viewTransition.md`, `01-app/03-api-reference/03-file-conventions/template.md`). Read the matching guide before adding anything else Next-specific.
- **Memory is tight.** Every rebuild, `test:browser`, `check:seo`, `check:fidelity`, `fx-checks` run and Playwright script goes through the lock helper, with the Bash tool `timeout: 600000`:
  ```bash
  WT="C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh"
  bash "$WT" "E:/Personal/clone website/spacegear" 8787 rebuild
  bash "$WT" "E:/Personal/clone website/spacegear" 8787 run node scripts/fx-checks.mjs http://127.0.0.1:8787
  bash "$WT" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787
  bash "$WT" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787
  ```
  `rebuild` prints `preview up on :8787` at the end; the build log is `artifacts/build-cf.log` and ends with `Export valid: 12 core pages, … files, … MiB total.` Never run `next dev`. Never stop processes that are not yours.
- **Fast gates** (no lock): `npm run lint && npm run typecheck && npm test`.
- **Heavy gates** (lock, in this order): rebuild → `check:seo` (expect `SEO crawl passed: …`) → `test:browser` (expect `Browser checks passed: 6 profiles; …`).
- **Fidelity:** `check:fidelity` needs the reference server; run it only when the controller says so (Task 16).
- **Git:** never push, merge or deploy; never use bare `git stash`. `git status` first and commit only the files the task lists. Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the `-m … -m …` form below does that). Ignore CRLF warnings.

### Rules that must not regress

1. **Reduced motion:** never branch rendered markup on `useReducedMotion()`. Effects branch only on `useFx()` / `useMotionOK()` from `src/components/fx/env.ts`: `useSyncExternalStore` with a `false` server snapshot, the same pattern `OrbitalCinematic` already uses, so every visitor hydrates the server markup and only then re-renders. `useReducedMotion()` inside effects stays fine.
2. **Hidden text:** text under `main` must stay at opacity ≥ 0.99 in the no-JS and reduced-motion profiles. Every hidden starting state in this plan is scoped under `html[data-fx-motion]` or `html[data-fx]`, or exists only in markup rendered after `useFx()` turns true. Scroll-linked Motion styles that could hide or move content carry the existing `data-reveal` hook (end state in `globals.css` and `NoScriptStyles.tsx`).
3. **Accessible names** contain the visible text; decorative glyphs get `aria-hidden`; keyboard access and the global `:focus-visible` ring stay intact.
4. **No invented claims:** labels come from `src/lib/content.ts`. The only new UI strings are the cursor labels (`View`, `Drag`, `Open`) and the rail's landmark name (`On this page`). Do not edit the data in `src/lib/content.ts` (Part 3 moves it into `content/` and keeps the same exports).
5. **CSP** stays strict: no inline scripts, no new origins. The grain is a `data:` image (`img-src` already allows `data:`).
6. **Packaging:** no new files under `public/`.

### Motion-system rules (this plan)

- **Two flags on `<html>`, set by `FxLayer`:** `data-fx-motion` (JS on, motion allowed: CSS reveals and scroll draws on every device) and `data-fx` (fine pointer with hover, ≥1024 px, motion allowed: heavy effects).
- **Primitives** (`src/components/fx/`) are client-only, remove every listener and frame they add in their cleanup, and do nothing unless `useFx()` is true.
- **Idle means zero frames.** No continuous `requestAnimationFrame` loops: Lenis and the ticker use `createIdleLoop` (stops itself), entrance effects are CSS transitions toggled by `data-in`, scroll-linked effects use `useScroll` + `useTransform` without springs, and springs only run after pointer input. The existing rAF-budget check (`offscreen scene must stop requesting frames`) stays unchanged, and `fx-checks` adds an idle-frame check after a Lenis glide.
- **Transform and opacity only.** Exceptions, all paint-only (they never move layout): SVG draws animate `stroke-dasharray`, the page curtain animates `clip-path` on a view-transition pseudo-element, and the field focus glow transitions `box-shadow`.
- **Shared files** get clearly delimited blocks so the parallel parts merge cleanly:
  - `src/app/globals.css`: everything goes inside one block at the end of the file, between `/* === FX === … */` and `/* === /FX === */`. Each task inserts its rules immediately above the closing `/* === /FX === */` line.
  - `scripts/browser-check.mjs`: five small insertions, each starting with a `// === FX ===` comment; the checks themselves live in `scripts/fx-checks.mjs`.
  - `package.json` / `package-lock.json`: only the `lenis` dependency.
  - `src/app/layout.tsx`: one import and one element.
- **`scripts/fx-checks.mjs`** registers checks with `desktop(name, fn)` and `touch(name, fn)`. New blocks go immediately above the `// --- Run alone ---` line. `browser-check.mjs` runs them inside the desktop profile and a new touch context; `node scripts/fx-checks.mjs <base>` runs them alone (faster while building an effect).
- **Part 1 (globe and hero) has already landed** when you start. It owns `src/components/EarthScene.tsx` and `src/components/sections/OrbitalCinematic.tsx`; do not edit them before Task 15. Its intro plays once per browser tab: `fx-checks` reuses one tab, so only the first load in a run shows it.
- **Part 3 (CMS)** runs in parallel in another worktree. It does not touch components; keep UI-only strings in components.

### Real-GPU checks

The controller checks every visual task in the owner's Chrome (Claude in Chrome, 1422×745, DevTools → Rendering → "Frame Rendering Stats" on) against the preview on `http://127.0.0.1:8787`. Each task lists what to look at and what "sick" means. Report what you changed; do not wait for the controller.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/components/fx/math.ts` (new) | Pure maths: clamp, damp, magnet, tilt, repel, ticker, curtain reveal, ripple cells | 1 |
| `src/components/fx/split.ts` (new) | Grapheme-safe word/character split and stagger offsets | 1 |
| `src/components/fx/idle-loop.ts` (new) | rAF loop that stops itself when idle | 1 |
| `tests/fx.test.mjs` (new) | Unit tests for the three pure modules | 1 |
| `src/components/fx/env.ts` (new) | `FX_QUERY`, `MOTION_QUERY`, `useFx()`, `useMotionOK()` | 2 |
| `src/components/fx/useInViewFlag.ts` (new) | Sets `data-in` on first intersection (CSS reveals) | 2 |
| `src/components/fx/FxLayer.tsx` (new) | Sets the `<html>` flags; mounts SmoothScroll, Grain, Cursor | 2, 3, 4 |
| `src/components/fx/Grain.tsx` (new) | Static film-grain overlay | 2 |
| `scripts/fx-checks.mjs` (new) | Browser checks for every effect; runnable alone | 2–14 |
| `src/components/fx/SmoothScroll.tsx`, `scroll-lock.ts` (new) | Lenis with native-scroll guards; scroll-lock contract | 3 |
| `src/components/fx/Cursor.tsx` (new) | Dot + ring cursor with `data-cursor` labels | 4 |
| `src/components/fx/Magnetic.tsx` (new) | `useMagnetic`, `Magnetic`, `MagneticLink` | 5 |
| `src/components/fx/Spotlight.tsx`, `Tilt.tsx` (new) | Pointer highlight and 3D tilt | 5 |
| `src/components/fx/SplitReveal.tsx` (new) | `useSplitReveal`, `SplitWordChars` | 6 |
| `src/components/fx/ScrollProgressRail.tsx` (new) | Home section rail | 7 |
| `src/components/fx/PageTransition.tsx`, `src/app/template.tsx`, `src/types/react-canary.d.ts` (new) | Orange curtain view transition | 9 |
| `src/components/fx/Parallax.tsx`, `ScrollDepth.tsx` (new) | Image parallax; desktop "stack and scale" | 10 |
| `src/components/fx/useTickerVelocity.ts` (new) | Ticker speed and skew from scroll velocity | 12 |
| `src/components/sections/FooterWordmark.tsx` (new) | Rising, cursor-repelling footer wordmark | 14 |
| `src/app/layout.tsx`, `src/app/page.tsx`, `next.config.ts` | Mount FxLayer; rail; view-transition flag | 2, 7, 9 |
| `src/app/globals.css` | `=== FX ===` block | 2–14 |
| `scripts/browser-check.mjs` | Five `// === FX ===` hooks into `fx-checks.mjs` | 2 |
| `package.json`, `package-lock.json` | `lenis` 1.3.26 | 3 |
| `src/components/ui.tsx`, `Nav.tsx`, `QuickStart.tsx`, `PageIntro.tsx`, `ScrollColorTitle.tsx`, `DotField.tsx` | Magnetic buttons, sweep, nav pill, underline, glow, split titles, ripple | 5, 6, 8, 11 |
| `src/components/sections/{Work,Services,Process,Analytics,Pricing,Faq,Team,Footer,Testimonials,Labs}.tsx` | Section effects | 4, 5, 7, 8, 10–14 |
| `src/components/sections/OrbitalCinematic.tsx` (after Part 1) | Magnetic hero CTA only | 15 |
| `README.md`, this plan | Motion-system notes; execution record | 16 |

---

### Task 1: Pure FX helpers (maths, split, idle loop)

**Files:**
- Create: `src/components/fx/math.ts`
- Create: `src/components/fx/split.ts`
- Create: `src/components/fx/idle-loop.ts`
- Test: `tests/fx.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/fx.test.mjs`:

```js
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
  assert.deepEqual(splitWords("e\u0301x")[0].chars, ["e\u0301", "x"]);
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
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `src/components/fx/math.ts`.

- [ ] **Step 3: Write `src/components/fx/math.ts`**

```ts
// Pure maths for the motion system: no DOM, no React. Unit-tested in tests/fx.test.mjs.

/** Clamps `value` into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Turns -0 (and NaN) into 0, so results compare cleanly. */
function tidy(value: number): number {
  return value || 0;
}

/** Frame-rate independent exponential smoothing from `current` toward `target` over `dt` seconds. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return tidy(current + (target - current) * (1 - Math.exp(-lambda * dt)));
}

/** Magnetic pull for a w×h element when the pointer is (dx, dy) px from its centre: a fraction of the
 *  offset capped at `max` px, plus the offset normalised to [-1, 1] for the arrow-glyph nudge. */
export function magnetOffset(dx: number, dy: number, w: number, h: number, max = 10, strength = 0.35) {
  return {
    x: tidy(clamp(dx * strength, -max, max)),
    y: tidy(clamp(dy * strength, -max, max)),
    nx: tidy(clamp(dx / Math.max(1, w / 2), -1, 1)),
    ny: tidy(clamp(dy / Math.max(1, h / 2), -1, 1)),
  };
}

/** 3D tilt in degrees for a pointer at (px, py) inside a w×h card: the side under the pointer dips away. */
export function tiltAngles(px: number, py: number, w: number, h: number, max = 4) {
  const nx = clamp((px / Math.max(1, w)) * 2 - 1, -1, 1);
  const ny = clamp((py / Math.max(1, h)) * 2 - 1, -1, 1);
  return { rx: tidy(-ny * max), ry: tidy(nx * max) };
}

/** Push-away offset for a letter when the pointer is (dx, dy) px from its centre: nothing outside
 *  `radius`, rising quadratically to `max` px near the centre, pointing away from the pointer. */
export function repelOffset(dx: number, dy: number, radius = 140, max = 18) {
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance >= radius) return { x: 0, y: 0 };
  const push = (1 - distance / radius) ** 2 * max;
  return { x: tidy((-dx / distance) * push), y: tidy((-dy / distance) * push) };
}

/** Capability-ticker response to a scroll velocity in px/s: playback rate (1–5) and skew (±8°). */
export function tickerFromVelocity(velocity: number) {
  return {
    rate: 1 + clamp(Math.abs(velocity) / 900, 0, 4),
    skew: tidy(clamp(-velocity / 320, -8, 8)),
  };
}

/** Share of the footer (0–1) the curtain has uncovered. Works for the pinned curtain and for a footer in flow,
 *  because both end the document with the footer's height. */
export function curtainReveal(scrollY: number, viewportH: number, scrollHeight: number, footerH: number) {
  if (footerH <= 0) return 1;
  return clamp((scrollY + viewportH - (scrollHeight - footerH)) / footerH, 0, 1);
}

/** Grid cell under a pointer at (px, py) inside a w×h field of cols×rows cells. */
export function cellAt(px: number, py: number, w: number, h: number, cols: number, rows: number) {
  return {
    row: clamp(Math.floor((py / Math.max(1, h)) * rows), 0, rows - 1),
    col: clamp(Math.floor((px / Math.max(1, w)) * cols), 0, cols - 1),
  };
}

/** Ring distance between two cells (0 for the same cell, 1 for its eight neighbours, …): the ripple's delay step. */
export function ringDistance(r0: number, c0: number, r: number, c: number) {
  return Math.max(Math.abs(r - r0), Math.abs(c - c0));
}
```

- [ ] **Step 4: Write `src/components/fx/split.ts`**

```ts
// Splits a title into words and user-perceived characters for the split-title reveal.

export type SplitWord = { text: string; chars: string[] };

const graphemes = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

function chars(word: string): string[] {
  return graphemes ? Array.from(graphemes.segment(word), (part) => part.segment) : Array.from(word);
}

/** Words split on whitespace, each with its characters (accents stay with their letters). */
export function splitWords(text: string): SplitWord[] {
  return text.trim().split(/\s+/).filter(Boolean).map((word) => ({ text: word, chars: chars(word) }));
}

/** Index of each word's first character across the whole title, for the stagger. */
export function charOffsets(words: SplitWord[]): number[] {
  return words.map((_, i) => words.slice(0, i).reduce((total, word) => total + word.chars.length, 0));
}
```

- [ ] **Step 5: Write `src/components/fx/idle-loop.ts`**

```ts
// An animation-frame loop that runs only while there is work, so an idle page requests no frames.

export type FrameScheduler = {
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
};

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

/**
 * `tick(time, dt)` runs once per frame and returns whether another frame is needed. `time` is a clock in ms
 * that only advances while the loop runs; `dt` is the frame step in ms, capped at 50 ms. The first frame
 * after a start counts as one 60 Hz frame, so a pause never turns into a jump.
 */
export function createIdleLoop(tick: (time: number, dt: number) => boolean, scheduler: FrameScheduler = browserFrames) {
  let id = 0;
  let last = 0;
  let clock = 0;
  let running = false;
  const frame = (now: number) => {
    const dt = last ? Math.min(now - last, 50) : 1000 / 60;
    last = now;
    clock += dt;
    if (tick(clock, dt)) {
      id = scheduler.request(frame);
    } else {
      running = false;
      last = 0;
    }
  };
  return {
    start() {
      if (running) return;
      running = true;
      id = scheduler.request(frame);
    },
    stop() {
      if (!running) return;
      scheduler.cancel(id);
      running = false;
      last = 0;
    },
    get running() {
      return running;
    },
  };
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS — the 12 new `fx` tests pass alongside the existing suites (`# fail 0`).

- [ ] **Step 7: Fast gates**

Run: `npm run lint && npm run typecheck`
Expected: both exit 0.

No heavy gates in this task: nothing rendered changed.

- [ ] **Step 8: Commit**

```bash
git add src/components/fx/math.ts src/components/fx/split.ts src/components/fx/idle-loop.ts tests/fx.test.mjs
git commit -m "feat(fx): pure helpers for the motion system" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: FX environment, html flags, grain and the browser-check harness

**Files:**
- Create: `src/components/fx/env.ts`
- Create: `src/components/fx/useInViewFlag.ts`
- Create: `src/components/fx/Grain.tsx`
- Create: `src/components/fx/FxLayer.tsx`
- Create: `scripts/fx-checks.mjs`
- Modify: `src/app/layout.tsx` (import + `<FxLayer />`)
- Modify: `src/app/globals.css` (append the `=== FX ===` block)
- Modify: `scripts/browser-check.mjs` (five `// === FX ===` hooks)

- [ ] **Step 1: Write the failing browser checks**

Create `scripts/fx-checks.mjs`:

```js
// Browser checks for the motion system (src/components/fx). scripts/browser-check.mjs runs them inside its
// desktop profile and a touch context. Run them alone (faster while building an effect) with:
//   node scripts/fx-checks.mjs http://127.0.0.1:8787
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

/** Page instrumentation, installed before any page script: counts animation frames and view transitions. */
function instrument() {
  window.__fx = { raf: 0, vt: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => { window.__fx.raf++; return raf(callback); };
  const start = Document.prototype.startViewTransition;
  if (start) Document.prototype.startViewTransition = function (...args) { window.__fx.vt++; return start.apply(this, args); };
}

/** Loads a route with a full page load and waits for the heavy-effect flag. */
export async function fresh(page, base, path = "/") {
  await page.goto("about:blank");
  await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-fx"), null, { timeout: 10000 });
}

/** Instant scroll (the page's CSS asks for smooth scrolling, which would make positions lag). */
export async function jumpTo(page, top) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
}

/** Document offset of a section's top edge. */
export function sectionTop(page, id) {
  return page.evaluate((sid) => window.scrollY + document.getElementById(sid).getBoundingClientRect().top, id);
}

/** Steps through the page so in-view effects get their chance to run, then returns to the top. */
export async function scrollPass(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await jumpTo(page, y);
    await page.waitForTimeout(60);
  }
  await jumpTo(page, 0);
  await page.waitForTimeout(200);
}

/** Animation frames requested during `ms` of idle time. */
export async function idleFrames(page, ms = 300) {
  const before = await page.evaluate(() => window.__fx.raf);
  await page.waitForTimeout(ms);
  return (await page.evaluate(() => window.__fx.raf)) - before;
}

/** Translation (m41, m42) and scale (a) of an element's computed transform. */
export function matrixOf(locator) {
  return locator.evaluate((el) => {
    const transform = getComputedStyle(el).transform;
    const m = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    return { a: m.a, m41: m.m41, m42: m.m42, is2D: m.is2D };
  });
}

async function fxState(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      fx: root.hasAttribute("data-fx"),
      lenis: root.classList.contains("lenis"),
      cursor: Boolean(document.querySelector("[data-fx-cursor-root]")),
      nativeCursorHidden: getComputedStyle(document.body).cursor === "none",
      grain: Boolean(document.querySelector("[data-fx-grain]")),
      rail: Boolean(document.querySelector("[data-fx-rail]")),
      splitChars: document.querySelectorAll("[data-split-char]").length,
      letters: document.querySelectorAll("[data-letter]").length,
      // Magnetic, Tilt, ScrollDepth and Parallax layers that carry a transform (none when the effects are off).
      moved: [...document.querySelectorAll("[data-magnetic], [data-tilt], [data-depth], [data-parallax] > *")].filter((el) => getComputedStyle(el).transform !== "none").length,
    };
  });
}
const ABSENT = { fx: false, lenis: false, cursor: false, nativeCursorHidden: false, grain: false, rail: false, splitChars: 0, letters: 0, moved: 0 };

/** Touch, phone, tablet, reduced-motion and no-JS profiles: no heavy effect is mounted. With `motionOff`
 *  (reduced motion, no JavaScript) the light reveals stay off too. */
export async function assertFxAbsent(page, label, { motionOff = false } = {}) {
  assert.deepEqual(await fxState(page), ABSENT, `${label}: heavy effects stay off`);
  if (motionOff) assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-fx-motion")), false, `${label}: reveal effects stay off`);
}

const DESKTOP_CHECKS = [];
const TOUCH_CHECKS = [];
/** Registers a check for the fine-pointer desktop (1440×1000). It gets (page, ctx) on a fresh home page. */
export function desktop(name, check) { DESKTOP_CHECKS.push([name, check]); }
/** Registers a check for the coarse-pointer context (1440×1000, touch). It gets (page, ctx). */
export function touch(name, check) { TOUCH_CHECKS.push([name, check]); }

/** Runs every desktop check in one tab of `context`; returns results the touch checks compare against. */
export async function checkFxDesktop({ context, base, report }) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(instrument);
  const ctx = { base, deepLinkTop: null };
  for (const [name, check] of DESKTOP_CHECKS) {
    await fresh(page, base);
    await check(page, ctx);
    report.interactions.push(`fx desktop: ${name}`);
  }
  assert.deepEqual(errors, [], "fx desktop: no page errors");
  await page.close();
  return ctx;
}

/** A coarse pointer at desktop width (touch laptop, large tablet): only reveals and scroll draws. */
export async function checkFxTouch({ browser, base, report, watchCsp, desktop: desktopResults }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true, isMobile: true });
  const cspProblems = watchCsp ? await watchCsp(context) : [];
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches), false, "touch: the emulated pointer is coarse (precondition)");
  await assertFxAbsent(page, "touch");
  report.interactions.push("fx touch: heavy effects stay off on a coarse pointer at 1440 px");
  const ctx = { base, desktop: desktopResults };
  for (const [name, check] of TOUCH_CHECKS) {
    await check(page, ctx);
    report.interactions.push(`fx touch: ${name}`);
  }
  assert.deepEqual(errors, [], "fx touch: no page errors");
  assert.deepEqual(cspProblems, [], "fx touch: no CSP violations");
  await context.close();
}

// --- Desktop and touch checks, one block per effect ---

desktop("the effect flags and the grain mount on a fine pointer at 1440 px", async (page) => {
  const state = await fxState(page);
  assert.equal(state.fx, true, "desktop: data-fx is set");
  assert.equal(state.grain, true, "desktop: the grain overlay mounts");
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-fx-motion")), true, "desktop: data-fx-motion is set");
  const grain = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector("[data-fx-grain]"));
    return { opacity: parseFloat(style.opacity), events: style.pointerEvents, position: style.position };
  });
  assert.ok(grain.opacity >= 0.03 && grain.opacity <= 0.04, `desktop: grain sits at 3–4% (${grain.opacity})`);
  assert.deepEqual({ events: grain.events, position: grain.position }, { events: "none", position: "fixed" }, "desktop: grain is a fixed, click-through overlay");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "desktop: effects add no horizontal overflow");
});

// --- Run alone ---

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { launchBrowser } = await import("./browser-runtime.mjs");
  const base = process.argv[2] || "http://127.0.0.1:8787";
  const browser = await launchBrowser();
  const report = { interactions: [] };
  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const desktopResults = await checkFxDesktop({ context: desktopContext, base, report });
    await desktopContext.close();
    for (const [label, options, flags] of [
      ["reduced-motion", { viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" }, { motionOff: true }],
      ["no-javascript", { viewport: { width: 1440, height: 1000 }, javaScriptEnabled: false }, { motionOff: true }],
      ["mobile-390", { viewport: { width: 390, height: 844 } }, {}],
    ]) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto(base, { waitUntil: "networkidle" });
      await assertFxAbsent(page, label, flags);
      report.interactions.push(`fx ${label}: effects stay off`);
      await context.close();
    }
    await checkFxTouch({ browser, base, report, desktop: desktopResults });
    console.log(report.interactions.join("\n"));
    console.log(`FX checks passed: ${report.interactions.length} checks.`);
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Hook the checks into `scripts/browser-check.mjs`**

Read the whole file first (Part 1 changed it). Make five insertions:

1. After `import { launchBrowser } from "./browser-runtime.mjs";` add:
   ```js
   // === FX === motion-system checks (scripts/fx-checks.mjs)
   import { assertFxAbsent, checkFxDesktop, checkFxTouch } from "./fx-checks.mjs";
   ```
2. Immediately before the top-level `try {` that opens the profile loop, add:
   ```js
   // === FX === desktop results the touch check compares against
   let fxDesktop = null;
   ```
3. Inside the profile loop, directly after the line `assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, \`${profile.name}: overflow\`);` add:
   ```js
   // === FX === heavy effects only on the fine-pointer desktop profile
   if (profile.name !== "desktop") await assertFxAbsent(page, profile.name, { motionOff: Boolean(profile.reducedMotion || profile.javaScriptEnabled === false) });
   ```
4. Inside the desktop-only block, directly after `report.interactions.push("desktop deep link to #pricing lands on the section after hydration");` add:
   ```js
   // === FX === park this page at the bottom (globe offscreen), then run the effect checks in a second tab
   await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
   fxDesktop = await checkFxDesktop({ context, base, report });
   ```
5. After the profile loop's closing brace, immediately before `const page = await browser.newPage({ viewport: { width: 720, height: 500 } });`, add:
   ```js
   // === FX === coarse pointer at desktop width
   await checkFxTouch({ browser, base, report, watchCsp, desktop: fxDesktop });
   ```

- [ ] **Step 3: Run the checks against the current preview and watch them fail**

Make sure the preview runs the current branch (`bash "$WT" "E:/Personal/clone website/spacegear" 8787 start` if nothing listens on 8787), then:

Run: `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run node scripts/fx-checks.mjs http://127.0.0.1:8787`
Expected: FAIL — `page.waitForFunction: Timeout 10000ms exceeded` inside `fresh()` (nothing sets `data-fx` yet).

- [ ] **Step 4: Write `src/components/fx/env.ts`**

```ts
import { useSyncExternalStore } from "react";

/** Heavy effects: smooth scroll, cursor, magnetic, tilt and spotlight, split titles, progress rail, grain, footer letters. */
export const FX_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)";
/** Light effects: CSS reveals and scroll draws, on every device that allows motion. */
export const MOTION_QUERY = "(prefers-reduced-motion: no-preference)";

function mediaStore(query: string) {
  return {
    subscribe(onChange: () => void) {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    snapshot: () => window.matchMedia(query).matches,
    server: () => false,
  };
}
const fxStore = mediaStore(FX_QUERY);
const motionStore = mediaStore(MOTION_QUERY);

/** True once hydrated on a fine-pointer desktop that allows motion. False on the server and during hydration,
 *  so every visitor hydrates the static markup first (the OrbitalCinematic pattern). */
export function useFx(): boolean {
  return useSyncExternalStore(fxStore.subscribe, fxStore.snapshot, fxStore.server);
}

/** True once hydrated when the visitor allows motion (any pointer). */
export function useMotionOK(): boolean {
  return useSyncExternalStore(motionStore.subscribe, motionStore.snapshot, motionStore.server);
}
```

- [ ] **Step 5: Write `src/components/fx/useInViewFlag.ts`**

```ts
import { useEffect, type RefObject } from "react";

/**
 * Sets `data-in` on the element when it enters the viewport (and, with `once: false`, removes it when it
 * leaves). CSS reveals key off the attribute, so there is no React state and no animation frame.
 */
export function useInViewFlag(
  ref: RefObject<Element | null>,
  { enabled = true, amount = 0.25, once = true }: { enabled?: boolean; amount?: number; once?: boolean } = {},
) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.setAttribute("data-in", "");
        if (once) observer.disconnect();
      } else if (!once) {
        el.removeAttribute("data-in");
      }
    }, { threshold: amount });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled, amount, once]);
}
```

- [ ] **Step 6: Write `src/components/fx/Grain.tsx`**

```tsx
/** Static film grain over the whole page: one noise tile at 3.5%, click-through (globals.css, FX block). */
export default function Grain() {
  return <div aria-hidden data-fx-grain="" className="fx-grain" />;
}
```

- [ ] **Step 7: Write `src/components/fx/FxLayer.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import Grain from "./Grain";
import { useFx, useMotionOK } from "./env";

/**
 * Site-wide effects, mounted once in the root layout. It renders nothing on the server, during hydration,
 * on coarse pointers, below 1024 px, under reduced motion or without JavaScript. The flags it sets on <html>
 * scope the effect CSS (globals.css, FX block): data-fx-motion (motion allowed: reveals and scroll draws)
 * and data-fx (fine pointer at >=1024 px: heavy effects).
 */
export default function FxLayer() {
  const fx = useFx();
  const motionOK = useMotionOK();

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-fx-motion", motionOK);
    return () => root.removeAttribute("data-fx-motion");
  }, [motionOK]);

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-fx", fx);
    return () => root.removeAttribute("data-fx");
  }, [fx]);

  if (!fx) return null;
  return <Grain />;
}
```

- [ ] **Step 8: Mount it in `src/app/layout.tsx`**

Add the import after `import NoScriptStyles from "@/components/NoScriptStyles";`:

```tsx
import FxLayer from "@/components/fx/FxLayer";
```

Replace

```tsx
      <CurtainShell footer={<Footer />}>{children}</CurtainShell>
    </MotionProvider>
```

with

```tsx
      <CurtainShell footer={<Footer />}>{children}</CurtainShell>
      {/* === FX === smooth scroll, cursor and grain on fine-pointer desktops (src/components/fx) */}
      <FxLayer />
    </MotionProvider>
```

- [ ] **Step 9: Open the FX block in `src/app/globals.css`**

Append at the very end of the file:

```css
/* ================================================================== */
/* === FX === Motion system (src/components/fx). Flags on <html>:      */
/*   data-fx-motion  JavaScript on and motion allowed: CSS reveals and  */
/*                   scroll draws, on every device.                     */
/*   data-fx         hover + fine pointer, >= 1024 px, motion allowed:  */
/*                   heavy effects.                                     */
/* Without a flag, every rule below leaves content in its end state,   */
/* so no-JS and reduced-motion visitors see everything. New rules go   */
/* immediately above the closing marker.                               */
/* ================================================================== */
:root {
  --fx-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --fx-ease-io: cubic-bezier(0.76, 0, 0.24, 1);
}

/* Grain: one static noise tile at 3.5%, click-through (Grain.tsx). */
.fx-grain {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}

/* === /FX === */
```

- [ ] **Step 10: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 11: Rebuild and watch the checks pass**

Run: `bash "$WT" "E:/Personal/clone website/spacegear" 8787 rebuild`
Expected: ends with `preview up on :8787`.

Run: `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run node scripts/fx-checks.mjs http://127.0.0.1:8787`
Expected: PASS — lists `fx desktop: the effect flags and the grain mount on a fine pointer at 1440 px`, the three `effects stay off` lines and `fx touch: heavy effects stay off on a coarse pointer at 1440 px`, then `FX checks passed: 5 checks.` If the touch precondition fails (`the emulated pointer is coarse`), Chromium ignored the touch emulation: stop and report it rather than weakening the assertion.

- [ ] **Step 12: Heavy gates**

Run: `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787`
Expected: `SEO crawl passed: …`

Run: `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787`
Expected: `Browser checks passed: 6 profiles; …`; `artifacts/browser-report.json` lists the `fx desktop:` and `fx touch:` interactions.

- [ ] **Step 13: Real-GPU check (controller)**

Look at a flat dark area between two sections at 100% zoom: a fine, static grain is barely perceptible (it should read as texture, never as noise or banding), and it does not move while scrolling. Frame Rendering Stats stay at ~60 fps while scrolling. With the DevTools device toolbar set to a phone, the grain is gone. Sick = the page feels like film stock instead of flat digital black, and nobody notices why.

- [ ] **Step 14: Commit**

```bash
git add src/components/fx/env.ts src/components/fx/useInViewFlag.ts src/components/fx/Grain.tsx src/components/fx/FxLayer.tsx scripts/fx-checks.mjs scripts/browser-check.mjs src/app/layout.tsx src/app/globals.css
git commit -m "feat(fx): effect flags, film grain and the effect browser checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: SmoothScroll (Lenis)

**Files:**
- Modify: `package.json`, `package-lock.json` (add `lenis` 1.3.26)
- Create: `src/components/fx/scroll-lock.ts`
- Create: `src/components/fx/SmoothScroll.tsx`
- Modify: `src/components/fx/FxLayer.tsx`
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

Why Lenis 1.3.26 and these options (read from the published 1.3.26 source):
- `npm view lenis version` reports 1.3.27, published 2026-10-15 (six days ago). 1.3.26 (2026-08-05) has every option used here; pin it exactly (supply-chain cooldown). Its `vue`, `react` and `@nuxt/kit` peers are optional, so nothing else installs.
- Lenis writes `window.scrollTo({ top, behavior: "instant" })` every frame, so native `scroll` events, Motion `useScroll`, `position: sticky` and the hero's own scroll listener keep working, and `html { scroll-behavior: smooth }` does not interfere.
- `anchors: false` keeps anchor links and deep links native, so `scroll-padding-top` and `scroll-margin` still decide where they land.
- `autoRaf` stays off: our `createIdleLoop` drives `lenis.raf()` only while a glide runs.
- `prevent` hands nested scrollers (textarea, select, snap rows) back to native scrolling. Do not use `allowNestedScroll`: `body` computes `overflow-y: auto` here (its `overflow-x: hidden`), which can make Lenis treat the whole page as a nested scroller.
- During a glide Lenis ignores native scroll events, so any native scroll would be pulled back. `settle()` ends the glide (`stop()` + `start()`, which reset Lenis to the real scroll position) on keydown, pointerdown, focusin, hash-link clicks, `hashchange` and `popstate`. That keeps keyboard scrolling, CurtainShell's footer-focus scroll and the hero's focus scroll-to-top intact.

- [ ] **Step 1: Write the failing checks**

In `scripts/fx-checks.mjs`, insert immediately above the `// --- Run alone ---` line:

```js
desktop("Lenis smooths the wheel, then requests no frames once idle", async (page) => {
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("lenis")), true, "desktop: Lenis is active");
  // Start below the hero (its globe stops rendering offscreen), with the pointer in the empty left gutter.
  await jumpTo(page, await sectionTop(page, "pricing"));
  await page.mouse.move(6, 500);
  await page.waitForTimeout(800);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(80);
  const mid = await page.evaluate(() => ({ y: window.scrollY, smooth: document.documentElement.classList.contains("lenis-smooth") }));
  assert.equal(mid.smooth, true, "desktop: a wheel scroll glides (lenis-smooth)");
  await page.waitForTimeout(1600);
  const y1 = await page.evaluate(() => window.scrollY);
  assert.ok(y1 - y0 > 600 && y1 - y0 <= 701, `desktop: the glide covers the wheel delta (moved ${y1 - y0}px)`);
  assert.ok(mid.y < y1, "desktop: the glide is still under way 80 ms after the wheel");
  const frames = await idleFrames(page);
  assert.ok(frames <= 2, `desktop: no animation frames once the glide ends (${frames} in 300 ms)`);
});

desktop("keyboard scrolling wins over a glide in progress", async (page) => {
  await jumpTo(page, await sectionTop(page, "process"));
  await page.mouse.move(6, 500);
  await page.waitForTimeout(600);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(60);
  await page.keyboard.press("End");
  await page.waitForTimeout(1800);
  const gap = await page.evaluate(() => document.documentElement.scrollHeight - (window.scrollY + innerHeight));
  assert.ok(gap < 4, `desktop: End during a glide reaches the end of the page (${gap}px short)`);
});

desktop("a deep link to #pricing lands at the anchor offset with Lenis on", async (page, ctx) => {
  await page.goto("about:blank");
  await page.goto(new URL("/#pricing", ctx.base).href, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const landing = await page.evaluate(() => ({ lenis: document.documentElement.classList.contains("lenis"), top: document.getElementById("pricing").getBoundingClientRect().top }));
  assert.equal(landing.lenis, true, "desktop deep link: Lenis is active (precondition)");
  assert.ok(Math.abs(landing.top) < 200, `desktop deep link: #pricing lands at the top (${landing.top}px)`);
  ctx.deepLinkTop = landing.top;
});

touch("a deep link to #pricing lands at the same offset without Lenis", async (page, ctx) => {
  assert.equal(typeof ctx.desktop?.deepLinkTop, "number", "touch: the desktop deep-link result is available (precondition)");
  await page.goto("about:blank");
  await page.goto(new URL("/#pricing", ctx.base).href, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => document.getElementById("pricing").getBoundingClientRect().top);
  assert.ok(Math.abs(top - ctx.desktop.deepLinkTop) <= 4, `deep link: ${top}px without Lenis, ${ctx.desktop.deepLinkTop}px with it`);
});
```

- [ ] **Step 2: Watch them fail**

Run: `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run node scripts/fx-checks.mjs http://127.0.0.1:8787`
Expected: FAIL — `desktop: Lenis is active`.

- [ ] **Step 3: Install Lenis, pinned**

Run: `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run npm install --save-exact lenis@1.3.26`
Expected: `added 1 package`. Then `git diff package.json` shows only `+    "lenis": "1.3.26",` in `dependencies`, and `npm ls lenis` prints `lenis@1.3.26`.

- [ ] **Step 4: Write `src/components/fx/scroll-lock.ts`**

```ts
/** Attribute on <html> that holds the page still (for example while an intro plays). SmoothScroll pauses
 *  Lenis while it is present; blocking native scrolling (overflow: hidden) stays the lock owner's job. */
export const SCROLL_LOCK_ATTR = "data-scroll-lock";

export function setScrollLock(locked: boolean) {
  document.documentElement.toggleAttribute(SCROLL_LOCK_ATTR, locked);
}
```

- [ ] **Step 5: Write `src/components/fx/SmoothScroll.tsx`**

```tsx
"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { createIdleLoop } from "./idle-loop";
import { SCROLL_LOCK_ATTR } from "./scroll-lock";

/** Wheel input over these keeps native scrolling (nested scrollers). */
const NESTED = "textarea, select, [data-snap-row], [data-lenis-prevent]";

/** Ends a glide in progress, so a native scroll is never pulled back toward the glide's target. */
function settle(lenis: Lenis) {
  if (lenis.isScrolling === "smooth") {
    lenis.stop();
    lenis.start();
  }
}

/**
 * Lenis smooth scrolling for fine-pointer desktops (FxLayer mounts it only there). Lenis scrolls the window
 * itself, so native scroll events, Motion's useScroll, sticky elements and scroll-padding-top keep working,
 * and anchors stay native. Keys, pointer presses, focus moves, hash links and history moves end a glide
 * first, so keyboard scrolling and the CurtainShell / hero focus handlers always win. Frames run only while
 * a glide is under way; `data-scroll-lock` on <html> pauses it.
 */
export default function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 1,
      anchors: false,
      stopInertiaOnNavigate: true,
      prevent: (node) => node.matches(NESTED),
    });
    lenisRef.current = lenis;
    const loop = createIdleLoop((time) => {
      lenis.raf(time);
      return lenis.isScrolling === "smooth";
    });
    const offWheel = lenis.on("virtual-scroll", () => loop.start());
    const end = () => settle(lenis);
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href*="#"]')) end();
    };
    const lock = () => {
      if (document.documentElement.hasAttribute(SCROLL_LOCK_ATTR)) lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(lock);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [SCROLL_LOCK_ATTR] });
    lock();
    window.addEventListener("keydown", end, true);
    window.addEventListener("pointerdown", end, true);
    document.addEventListener("focusin", end, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", end);
    window.addEventListener("popstate", end);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", end, true);
      window.removeEventListener("pointerdown", end, true);
      document.removeEventListener("focusin", end, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", end);
      window.removeEventListener("popstate", end);
      offWheel();
      loop.stop();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // A new route has a new height: end any glide and re-measure.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    settle(lenis);
    lenis.resize();
  }, [pathname]);

  return null;
}
```

- [ ] **Step 6: Mount it in `src/components/fx/FxLayer.tsx`**

Add `import SmoothScroll from "./SmoothScroll";` after `import Grain from "./Grain";`, and replace

```tsx
  if (!fx) return null;
  return <Grain />;
```

with

```tsx
  if (!fx) return null;
  return (
    <>
      <SmoothScroll />
      <Grain />
    </>
  );
```

- [ ] **Step 7: Add the Lenis base rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Smooth scroll (SmoothScroll.tsx): Lenis's base rules. */
html.lenis,
html.lenis body { height: auto; }
.lenis.lenis-smooth iframe { pointer-events: none; }
```

- [ ] **Step 8: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 9: Rebuild and watch the checks pass**

Run: `bash "$WT" "E:/Personal/clone website/spacegear" 8787 rebuild` (expect `preview up on :8787`), then
`bash "$WT" "E:/Personal/clone website/spacegear" 8787 run node scripts/fx-checks.mjs http://127.0.0.1:8787`
Expected: PASS, including the three new desktop lines and `fx touch: a deep link to #pricing lands at the same offset without Lenis`.

- [ ] **Step 10: Heavy gates**

Run `check:seo` (expect `SEO crawl passed: …`) and `test:browser` (expect `Browser checks passed: 6 profiles; …`) through `wt.sh` as in the conventions. The unchanged desktop assertions — curtain footer focus, hero focus scroll-to-top, `#pricing` deep link and `offscreen scene must stop requesting frames` — now run with Lenis active.

- [ ] **Step 11: Real-GPU check (controller)**

1. Wheel the home page from top to bottom: it glides with gentle inertia and stops cleanly within about a second; the hero's 300vh beats (globe right → centre with the statement → curtain) scrub smoothly with no stepping; the curtain panel and the footer reveal glide too.
2. Mid-glide, press PageDown, Space, ↓ and End: the page follows the keys at once, with no tug-of-war.
3. From `/about/`, click the footer's "Engagements": it lands with the Engagements title just under the nav (same as before).
4. Tab from the last Team control into the footer: the footer comes into view; Tab into the faded hero copy at mid-hero: it jumps back to the opening frame.
5. Trackpad sideways swipe: nothing moves. Frame Rendering Stats stay at ~60 fps during glides.
Sick = buttery and weighty, but never fights a key, a click or focus.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json src/components/fx/scroll-lock.ts src/components/fx/SmoothScroll.tsx src/components/fx/FxLayer.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): Lenis smooth scrolling that yields to native scrolls" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cursor

**Files:**
- Create: `src/components/fx/Cursor.tsx`
- Modify: `src/components/fx/FxLayer.tsx`
- Modify: `src/components/sections/Work.tsx` (`data-cursor="View"`)
- Modify: `src/components/sections/Services.tsx` (`data-cursor="Open"`)
- Modify: `src/components/sections/Team.tsx` (`data-cursor="Drag"`)
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

- [ ] **Step 1: Write the failing checks**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("the cursor follows the mouse, steps aside for the keyboard and over text fields", async (page) => {
  await page.mouse.move(640, 420);
  await page.mouse.move(660, 430, { steps: 3 });
  await page.waitForTimeout(200);
  const shown = await page.evaluate(() => ({
    state: document.querySelector("[data-fx-cursor-root]")?.dataset.state ?? "missing",
    native: getComputedStyle(document.body).cursor,
  }));
  assert.ok(!["hidden", "missing"].includes(shown.state), `desktop: the custom cursor appears with the mouse (${shown.state})`);
  assert.equal(shown.native, "none", "desktop: the native cursor is replaced");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(350);
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    const root = document.querySelector("[data-fx-cursor-root]");
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const style = getComputedStyle(el);
    return {
      state: root.dataset.state,
      dot: parseFloat(getComputedStyle(root.querySelector(".fx-cursor-dot")).opacity),
      disc: parseFloat(getComputedStyle(root.querySelector(".fx-cursor-disc")).opacity),
      outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2,
      onTop: Boolean(hit && (hit === el || el.contains(hit))),
      native: getComputedStyle(document.body).cursor,
    };
  });
  assert.deepEqual(focus, { state: "hidden", dot: 0, disc: 0, outline: true, onTop: true, native: "auto" }, "desktop: keyboard focus hides the custom cursor and keeps the focus ring visible");
  await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  await page.getByLabel("Your name").hover();
  await page.waitForTimeout(250);
  const overField = await page.evaluate(() => ({
    state: document.querySelector("[data-fx-cursor-root]").dataset.state,
    cursor: getComputedStyle(document.querySelector('input[aria-label="Your name"]')).cursor,
  }));
  assert.equal(overField.state, "text", "desktop: the custom cursor steps aside over a text field");
  assert.notEqual(overField.cursor, "none", "desktop: the native caret shows over a text field");
});

desktop("the cursor shows the data-cursor label", async (page) => {
  await jumpTo(page, await sectionTop(page, "work"));
  await page.waitForTimeout(900);
  await page.locator('#work [data-cursor="View"]').first().hover();
  await page.waitForTimeout(300);
  const labelled = await page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    const label = root.querySelector(".fx-cursor-label");
    return { state: root.dataset.state, text: label.textContent, opacity: parseFloat(getComputedStyle(label).opacity) };
  });
  assert.deepEqual({ state: labelled.state, text: labelled.text }, { state: "label", text: "View" }, "desktop: a What We Do tile labels the cursor");
  assert.ok(labelled.opacity > 0.99, "desktop: the label is visible");
});
```

- [ ] **Step 2: Watch them fail**

Run: `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run node scripts/fx-checks.mjs http://127.0.0.1:8787`
Expected: FAIL — `desktop: the custom cursor appears with the mouse (missing)`.

- [ ] **Step 3: Write `src/components/fx/Cursor.tsx`**

```tsx
"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

type CursorState = "hidden" | "idle" | "hover" | "label" | "text";

/** Elements that make the ring grow. */
const INTERACTIVE = 'a[href], button, summary, label, [role="button"], [role="switch"], [role="marquee"]';
/** Over form fields the custom cursor steps aside for the native caret. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);
const RING = { stiffness: 480, damping: 38, mass: 0.6 };

/**
 * Dot + ring cursor for fine-pointer desktops (FxLayer mounts it only there), inverted against the page.
 * The ring grows over interactive elements and shows the label of the nearest [data-cursor] ("View",
 * "Drag", "Open"). Over form fields and during keyboard use it steps aside and the native cursor returns,
 * so it never covers a focus ring. It is click-through and hidden from assistive technology.
 */
export default function Cursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, RING);
  const ringY = useSpring(y, RING);
  const [state, setState] = useState<CursorState>("hidden");
  const [label, setLabel] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    let visible = false;
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
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        if (visible) hide();
        return;
      }
      x.set(event.clientX);
      y.set(event.clientY);
      if (!visible) {
        visible = true;
        ringX.jump(event.clientX);
        ringY.jump(event.clientY);
        root.setAttribute("data-fx-cursor", "");
        classify(event.target);
      }
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
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", hide);
      root.removeAttribute("data-fx-cursor");
    };
  }, [x, y, ringX, ringY]);

  return (
    <div aria-hidden data-fx-cursor-root="" data-state={state} className="fx-cursor">
      <motion.span className="fx-cursor-dot" style={{ x, y }} />
      <motion.span className="fx-cursor-ring" style={{ x: ringX, y: ringY }}>
        <span className="fx-cursor-disc" />
        <span className="fx-cursor-label">{label}</span>
      </motion.span>
    </div>
  );
}
```

- [ ] **Step 4: Mount it in `src/components/fx/FxLayer.tsx`**

Add `import Cursor from "./Cursor";` after `import Grain from "./Grain";`, and replace

```tsx
      <SmoothScroll />
      <Grain />
    </>
```

with

```tsx
      <SmoothScroll />
      <Grain />
      <Cursor />
    </>
```

- [ ] **Step 5: Add the cursor rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Cursor (Cursor.tsx): dot + spring ring inverted against the page; the native caret over fields. */
html[data-fx-cursor],
html[data-fx-cursor] * { cursor: none !important; }
html[data-fx-cursor] :is(input, textarea, select, [contenteditable]) { cursor: auto !important; }
.fx-cursor { position: fixed; left: 0; top: 0; z-index: 90; width: 0; height: 0; pointer-events: none; mix-blend-mode: difference; }
.fx-cursor[data-state="label"] { mix-blend-mode: normal; }
.fx-cursor-dot,
.fx-cursor-ring { position: absolute; left: 0; top: 0; }
.fx-cursor-dot { width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 9999px; background: #fff; transition: opacity 0.2s, scale 0.3s var(--fx-ease); }
.fx-cursor-ring { display: grid; place-items: center; width: 40px; height: 40px; margin: -20px 0 0 -20px; }
.fx-cursor-disc { position: absolute; inset: 0; border: 1.5px solid #fff; border-radius: 9999px; transition: opacity 0.2s, scale 0.4s var(--fx-ease), background-color 0.25s, border-color 0.25s; }
.fx-cursor-label { position: relative; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #161719; opacity: 0; transition: opacity 0.2s; }
.fx-cursor:is([data-state="hover"], [data-state="label"]) .fx-cursor-dot { scale: 0; }
.fx-cursor[data-state="hover"] .fx-cursor-disc { scale: 1.6; background: #fff; }
.fx-cursor[data-state="label"] .fx-cursor-disc { scale: 2.2; border-color: #fa6e43; background: #fa6e43; }
.fx-cursor[data-state="label"] .fx-cursor-label { opacity: 1; }
.fx-cursor:is([data-state="hidden"], [data-state="text"]) :is(.fx-cursor-dot, .fx-cursor-disc) { opacity: 0; }
```

- [ ] **Step 6: Add the cursor labels (UI text, not content)**

`src/components/sections/Work.tsx` — in `Tile`, replace

```tsx
    <Link prefetch={false} href={href} className="group relative block h-full overflow-hidden rounded-2xl border border-line">
```

with

```tsx
    <Link prefetch={false} href={href} data-cursor="View" className="group relative block h-full overflow-hidden rounded-2xl border border-line">
```

and in the desktop bento's featured item replace

```tsx
            <Link prefetch={false} href={f.href} className="group relative block h-full min-h-[260px] overflow-hidden rounded-2xl border border-line">
```

with

```tsx
            <Link prefetch={false} href={f.href} data-cursor="View" className="group relative block h-full min-h-[260px] overflow-hidden rounded-2xl border border-line">
```

`src/components/sections/Services.tsx` — in the desktop accordion, replace

```tsx
                    onMouseEnter={() => setActive(i)}
```

with

```tsx
                    data-cursor="Open"
                    onMouseEnter={() => setActive(i)}
```

`src/components/sections/Team.tsx` — replace

```tsx
                drag="x"
```

with

```tsx
                drag="x"
                data-cursor="Drag"
```

- [ ] **Step 7: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 8: Rebuild and watch the checks pass**

Rebuild through `wt.sh` (expect `preview up on :8787`), then run `node scripts/fx-checks.mjs http://127.0.0.1:8787` through `wt.sh`.
Expected: PASS, including `fx desktop: the cursor follows the mouse, steps aside for the keyboard and over text fields` and `fx desktop: the cursor shows the data-cursor label`.

- [ ] **Step 9: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: `SEO crawl passed: …` and `Browser checks passed: 6 profiles; …` (the `assertFxAbsent` hooks confirm the native cursor is untouched on phones, tablet, reduced motion and no-JS).

- [ ] **Step 10: Real-GPU check (controller)**

1. Over body text: a small white dot with a trailing ring, both inverting what is under them.
2. Over links and buttons: the dot shrinks away and the ring grows into a filled inverted disc.
3. Over a What We Do tile: an orange disc reading "VIEW"; Services columns read "OPEN"; the Team photo reads "DRAG".
4. Over the footer name/email fields and the contact form: the native I-beam, no custom cursor.
5. Press Tab: the custom cursor vanishes and the orange focus ring is fully visible; move the mouse: the cursor reappears at the pointer (no fly-in from a corner).
6. Leave the window: it disappears; re-enter: it returns.
Sick = the ring trails with a springy but tight lag (well under 100 ms), morphs are crisp and never flicker at element edges.

- [ ] **Step 11: Commit**

```bash
git add src/components/fx/Cursor.tsx src/components/fx/FxLayer.tsx src/components/sections/Work.tsx src/components/sections/Services.tsx src/components/sections/Team.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): morphing cursor with contextual labels" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pointer primitives — Magnetic, Spotlight, Tilt

**Files:**
- Create: `src/components/fx/Magnetic.tsx`
- Create: `src/components/fx/Spotlight.tsx`
- Create: `src/components/fx/Tilt.tsx`
- Modify: `src/components/ui.tsx` (ArrowIcon glyph hook, FlameButton, GhostButton)
- Modify: `src/components/Nav.tsx` (header CTA)
- Modify: `src/components/sections/Footer.tsx` (Privacy/Terms pills)
- Modify: `src/components/sections/Work.tsx` (tiles in Tilt)
- Modify: `src/components/sections/Analytics.tsx` (cards in Tilt)
- Modify: `src/components/sections/Pricing.tsx` (desktop rows in Tilt)
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

- [ ] **Step 1: Write the failing checks**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("magnetic CTAs lean toward the pointer and nudge their arrow", async (page) => {
  const cta = page.locator("#process a[data-magnetic]").first();
  await cta.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await cta.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2, { steps: 5 });
  await page.waitForTimeout(600);
  const pulled = await matrixOf(cta);
  assert.ok(pulled.m41 > 1 && pulled.m41 <= 10.5, `desktop: the CTA leans toward the pointer, at most 10 px (${pulled.m41}px)`);
  const nudge = await cta.locator("[data-magnetic-glyph]").evaluate((el) => parseFloat(getComputedStyle(el).translate));
  assert.ok(nudge > 1, `desktop: the arrow glyph nudges further (${nudge}px)`);
  await page.mouse.move(6, 500, { steps: 4 });
  await page.waitForTimeout(900);
  assert.ok(Math.abs((await matrixOf(cta)).m41) < 0.5, "desktop: the CTA springs back when the pointer leaves");
});

desktop("What We Do tiles tilt toward the pointer under a spotlight", async (page) => {
  await jumpTo(page, await sectionTop(page, "work"));
  await page.waitForTimeout(900);
  const card = page.locator("#work [data-tilt]").first();
  const rest = await card.evaluate((el) => getComputedStyle(el).transform);
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2, { steps: 6 });
  await page.waitForTimeout(700);
  const tilted = await card.evaluate((el) => ({
    transform: getComputedStyle(el).transform,
    spot: parseFloat(getComputedStyle(el.querySelector(":scope > .fx-spotlight")).opacity),
  }));
  assert.match(tilted.transform, /^matrix3d\(/, "desktop: the tile tilts in 3D");
  assert.notEqual(tilted.transform, rest, "desktop: the tilt follows the pointer");
  assert.ok(tilted.spot > 0.99, "desktop: the spotlight shows under the pointer");
});
```

- [ ] **Step 2: Watch them fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded` for `#process a[data-magnetic]` (nothing is magnetic yet).

- [ ] **Step 3: Write `src/components/fx/Magnetic.tsx`**

```tsx
"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useFx } from "./env";
import { magnetOffset } from "./math";

const SPRING = { stiffness: 260, damping: 18, mass: 0.5 };
const MotionLink = motion.create(Link);

/**
 * Magnetic pull for buttons and pills. While a mouse is over the element it leans toward the pointer
 * (spring, at most `max` px) and sets --mx/--my (-1..1) so an inner [data-magnetic-glyph] can nudge
 * further. Fine-pointer desktops only; everywhere else the element never moves.
 */
export function useMagnetic<T extends HTMLElement>(max = 10) {
  const ref = useRef<T>(null);
  const fx = useFx();
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const x = useSpring(targetX, SPRING);
  const y = useSpring(targetY, SPRING);

  useEffect(() => {
    const el = ref.current;
    if (!fx || !el) return;
    let measured = false;
    let cx = 0, cy = 0, w = 1, h = 1;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // The resting box: take the current pull back out.
      cx = r.left + r.width / 2 - x.get();
      cy = r.top + r.height / 2 - y.get();
      w = r.width;
      h = r.height;
      measured = true;
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") measure();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (!measured) measure();
      const pull = magnetOffset(event.clientX - cx, event.clientY - cy, w, h, max);
      targetX.set(pull.x);
      targetY.set(pull.y);
      el.style.setProperty("--mx", pull.nx.toFixed(3));
      el.style.setProperty("--my", pull.ny.toFixed(3));
    };
    const leave = () => {
      measured = false;
      targetX.set(0);
      targetY.set(0);
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      leave();
    };
  }, [fx, max, targetX, targetY, x, y]);

  return { ref, x, y };
}

/** Makes any children magnetic inside an inline-flex span. */
export function Magnetic({ children, className = "", max = 10 }: { children: ReactNode; className?: string; max?: number }) {
  const { ref, x, y } = useMagnetic<HTMLSpanElement>(max);
  return (
    <motion.span ref={ref} data-magnetic="" className={`inline-flex ${className}`} style={{ x, y }}>
      {children}
    </motion.span>
  );
}

/** A next/link that is itself magnetic (no wrapper, so classes such as w-full keep working). */
export function MagneticLink({ href, className = "", children, max = 10 }: { href: string; className?: string; children: ReactNode; max?: number }) {
  const { ref, x, y } = useMagnetic<HTMLAnchorElement>(max);
  return (
    <MotionLink ref={ref} prefetch={false} href={href} data-magnetic="" className={className} style={{ x, y }}>
      {children}
    </MotionLink>
  );
}
```

- [ ] **Step 4: Write `src/components/fx/Spotlight.tsx`**

```tsx
"use client";

import { useEffect, type RefObject } from "react";

/** Moves the `.fx-spotlight` highlight (globals.css, FX block) under the pointer by setting --sx/--sy on the
 *  element, at most once per frame and only while a mouse moves over it. */
export function useSpotlight(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let frame = 0;
    let px = 0;
    let py = 0;
    const paint = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", `${(px - r.left).toFixed(1)}px`);
      el.style.setProperty("--sy", `${(py - r.top).toFixed(1)}px`);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      px = event.clientX;
      py = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    el.addEventListener("pointermove", move);
    return () => {
      el.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);
}
```

- [ ] **Step 5: Write `src/components/fx/Tilt.tsx`**

```tsx
"use client";

import { motion, useSpring } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useFx } from "./env";
import { tiltAngles } from "./math";
import { useSpotlight } from "./Spotlight";

const SPRING = { stiffness: 220, damping: 20, mass: 0.6 };

/**
 * Subtle 3D tilt toward the pointer (at most `max` degrees), with an optional warm spotlight that follows it.
 * Fine-pointer desktops only: elsewhere the wrapper has no transform. The spotlight layer is decorative.
 */
export default function Tilt({ children, className = "", max = 4, spotlight = false }: { children: ReactNode; className?: string; max?: number; spotlight?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useFx();
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  useSpotlight(ref, fx && spotlight);

  useEffect(() => {
    const el = ref.current;
    if (!fx || !el) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const angles = tiltAngles(event.clientX - r.left, event.clientY - r.top, r.width, r.height, max);
      rotateX.set(angles.rx);
      rotateY.set(angles.ry);
    };
    const leave = () => {
      rotateX.set(0);
      rotateY.set(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      leave();
    };
  }, [fx, max, rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      data-tilt=""
      data-spotlight={spotlight ? "" : undefined}
      className={`relative ${className}`}
      style={fx ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
    >
      {children}
      {spotlight && <span aria-hidden className="fx-spotlight" />}
    </motion.div>
  );
}
```

- [ ] **Step 6: Add the glyph and spotlight rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Magnetic (Magnetic.tsx): the arrow glyph travels a little further than its button. */
[data-magnetic] [data-magnetic-glyph] { translate: calc(var(--mx, 0) * 3px) calc(var(--my, 0) * 3px); transition: translate 0.3s var(--fx-ease); }

/* Spotlight (Spotlight.tsx, Tilt.tsx): a warm highlight under the pointer. */
.fx-spotlight { position: absolute; inset: 0; z-index: 1; border-radius: inherit; pointer-events: none; opacity: 0; background: radial-gradient(280px circle at var(--sx, 50%) var(--sy, 50%), rgba(250, 110, 67, 0.18), transparent 65%); transition: opacity 0.35s ease-out; }
html[data-fx] [data-spotlight]:hover > .fx-spotlight { opacity: 1; }
```

- [ ] **Step 7: Make the buttons magnetic (`src/components/ui.tsx`)**

Add after `import ScrollColorTitle from "@/components/ScrollColorTitle";`:

```tsx
import { MagneticLink } from "@/components/fx/Magnetic";
```

In `ArrowIcon`, replace

```tsx
    <span
      className="relative inline-block overflow-hidden"
      style={{ width: size, height: size }}
    >
```

with

```tsx
    <span
      data-magnetic-glyph=""
      className="relative inline-block overflow-hidden"
      style={{ width: size, height: size }}
    >
```

Replace the whole `FlameButton` and `GhostButton` functions with:

```tsx
export function FlameButton({
  children,
  href = "/contact/",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  // transition-[filter,box-shadow], not transition-all: the magnetic pull writes transform every frame.
  return (
    <MagneticLink
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl bg-flame px-5 py-[14px] text-[13px] font-medium text-[#161719] transition-[filter,box-shadow] duration-300 hover:brightness-110 hover:shadow-[0_10px_30px_-8px_rgba(250,110,67,0.6)] ${className}`}
    >
      {children}
      <ArrowIcon />
    </MagneticLink>
  );
}

export function GhostButton({
  children,
  href = "/",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <MagneticLink
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card-2/60 px-5 py-[14px] text-[13px] font-medium text-ink transition-colors duration-300 hover:border-mut-3 hover:bg-card-3/60 ${className}`}
    >
      {children}
    </MagneticLink>
  );
}
```

Nothing else in `ui.tsx` uses `Link` now: delete the line `import Link from "next/link";`.

- [ ] **Step 8: Make the nav CTA and the footer pills magnetic**

`src/components/Nav.tsx` — add `import { MagneticLink } from "@/components/fx/Magnetic";` after `import Brand from "@/components/Brand";`, then replace

```tsx
          <Link
            prefetch={false}
            href="/contact/"
            className="hidden rounded-xl border border-line px-4 py-2 text-[13px] text-ink transition-colors hover:border-mut-3 sm:inline-flex"
          >
            Discuss a project
          </Link>
```

with

```tsx
          <MagneticLink
            href="/contact/"
            className="hidden rounded-xl border border-line px-4 py-2 text-[13px] text-ink transition-colors hover:border-mut-3 sm:inline-flex"
          >
            Discuss a project
          </MagneticLink>
```

`src/components/sections/Footer.tsx` — add `import { MagneticLink } from "@/components/fx/Magnetic";` after `import QuickStart from "@/components/QuickStart";`, then replace

```tsx
                <Link prefetch={false} href="/privacy/" className={pill}>Privacy</Link>
                <Link prefetch={false} href="/terms/" className={pill}>Terms</Link>
```

with

```tsx
                <MagneticLink href="/privacy/" className={pill} max={6}>Privacy</MagneticLink>
                <MagneticLink href="/terms/" className={pill} max={6}>Terms</MagneticLink>
```

- [ ] **Step 9: Tilt and spotlight the cards**

`src/components/sections/Work.tsx` — add `import Tilt from "@/components/fx/Tilt";` after `import DotField from "@/components/DotField";`. Replace the featured item

```tsx
          <AppearItem className="sm:col-span-2 sm:row-span-2">
            <Link prefetch={false} href={f.href} data-cursor="View" className="group relative block h-full min-h-[260px] overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/80 via-transparent to-[#0c0d0f]/40" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{f.label}</span>
                    <h3 className="display mt-1 text-2xl text-ink-strong">{f.name}</h3>
                  </div>
                  <GridDots />
                </div>
                <ArrowBtn />
              </div>
            </Link>
          </AppearItem>
```

with

```tsx
          <AppearItem className="sm:col-span-2 sm:row-span-2">
            <Tilt spotlight className="h-full rounded-2xl">
              <Link prefetch={false} href={f.href} data-cursor="View" className="group relative block h-full min-h-[260px] overflow-hidden rounded-2xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/80 via-transparent to-[#0c0d0f]/40" />
                <div className="relative flex h-full flex-col justify-between p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{f.label}</span>
                      <h3 className="display mt-1 text-2xl text-ink-strong">{f.name}</h3>
                    </div>
                    <GridDots />
                  </div>
                  <ArrowBtn />
                </div>
              </Link>
            </Tilt>
          </AppearItem>
```

and replace

```tsx
          {WORK.tiles.map((tile) => (
            <AppearItem key={tile.slug} className="h-full">
              <Tile {...tile} />
            </AppearItem>
          ))}
```

with

```tsx
          {WORK.tiles.map((tile) => (
            <AppearItem key={tile.slug} className="h-full">
              <Tilt spotlight className="h-full rounded-2xl">
                <Tile {...tile} />
              </Tilt>
            </AppearItem>
          ))}
```

`src/components/sections/Analytics.tsx` — add `import Tilt from "@/components/fx/Tilt";` after `import { Container, SectionHeader } from "@/components/ui";`. Replace `Card` with

```tsx
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Tilt spotlight max={3} className={`rounded-2xl border border-line bg-card/55 p-6 ${className}`}>
      {children}
    </Tilt>
  );
}
```

and wrap the image card: replace the whole first `<Reveal as="div">` block of the top row

```tsx
          <Reveal as="div">
            <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MEASURE.imageCard.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e] via-[#0b0c0e]/30 to-transparent" />
              <span className="absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                <span className="text-flame">{MEASURE.imageCard.accent}</span> {MEASURE.imageCard.label}
              </span>
              <span className="absolute bottom-5 left-5 text-[15px] font-medium text-flame">
                space<span className="text-ink">—</span>gear
              </span>
            </div>
          </Reveal>
```

with

```tsx
          <Reveal as="div">
            <Tilt spotlight max={3} className="h-full rounded-2xl">
              <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MEASURE.imageCard.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e] via-[#0b0c0e]/30 to-transparent" />
                <span className="absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                  <span className="text-flame">{MEASURE.imageCard.accent}</span> {MEASURE.imageCard.label}
                </span>
                <span className="absolute bottom-5 left-5 text-[15px] font-medium text-flame">
                  space<span className="text-ink">—</span>gear
                </span>
              </div>
            </Tilt>
          </Reveal>
```

`src/components/sections/Pricing.tsx` — add `import Tilt from "@/components/fx/Tilt";` after `import { Container, SectionHeader } from "@/components/ui";`, then replace

```tsx
            <Reveal as="div" key={item.name} delay={80 + i * 80}>
              <EngagementRow item={item} selected={selected === item.name} onSelect={() => setSelected(item.name)} />
            </Reveal>
```

with

```tsx
            <Reveal as="div" key={item.name} delay={80 + i * 80}>
              <Tilt spotlight max={1.5} className="rounded-2xl">
                <EngagementRow item={item} selected={selected === item.name} onSelect={() => setSelected(item.name)} />
              </Tilt>
            </Reveal>
```

(Task 12 rewrites `Analytics.tsx` and Task 13 rewrites `Pricing.tsx` in full and keep these wrappers.)

- [ ] **Step 10: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0. If `typecheck` rejects `motion.create(Link)` props, keep `MagneticLink`'s explicit prop list (it does not spread Link props on purpose) and report the exact error.

- [ ] **Step 11: Rebuild and watch the checks pass**

Rebuild through `wt.sh`, then run fx-checks through `wt.sh`.
Expected: PASS, including `magnetic CTAs lean toward the pointer and nudge their arrow` and `What We Do tiles tilt toward the pointer under a spotlight`.

- [ ] **Step 12: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass. The quick-start test clicks the footer button and the 320 px sweep checks every route with the new wrappers.

- [ ] **Step 13: Real-GPU check (controller)**

1. Hover the flame CTAs (Process band, Services core panel, FAQ card, 404 page) and the header's "Discuss a project": each leans about 10 px toward the pointer with a weighty spring and settles back on leave; the ↗ arrow travels slightly further than its button. Footer Privacy/Terms pills lean a little (6 px).
2. What We Do tiles tilt up to 4° toward the pointer with a warm radial glow tracking it; What We Measure cards up to 3°; engagement rows only 1.5°.
3. Text stays crisp while tilted (no blur), hover zoom on tile images still works, no flicker at card edges.
Sick = tactile, like the surfaces have weight; never jittery, never laggy.

- [ ] **Step 14: Commit**

```bash
git add src/components/fx/Magnetic.tsx src/components/fx/Spotlight.tsx src/components/fx/Tilt.tsx src/components/ui.tsx src/components/Nav.tsx src/components/sections/Footer.tsx src/components/sections/Work.tsx src/components/sections/Analytics.tsx src/components/sections/Pricing.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): magnetic buttons, card tilt and spotlight" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: SplitReveal section titles

**Files:**
- Create: `src/components/fx/SplitReveal.tsx`
- Modify: `src/components/ScrollColorTitle.tsx` (full rewrite below)
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

How it stays safe: the server (and every client during hydration) renders the current word spans. Only after `useFx()` turns true does each word's text become masked character spans. The heading carries `aria-label={title}` and every split word is `aria-hidden`, so assistive technology reads the whole title. No-JS, touch and reduced-motion visitors never get the split. The grey→white fill still colours each word's `data-scroll-word` span, and the characters inherit it.

- [ ] **Step 1: Write the failing check**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("split titles keep their full accessible name and rise in as they enter", async (page) => {
  await scrollPass(page);
  const titles = await page.evaluate(() => [...document.querySelectorAll("h2[data-split-title]")].map((heading) => ({
    label: heading.getAttribute("aria-label"),
    chars: [...heading.querySelectorAll("[data-split-char]")].map((char) => char.textContent).join(""),
    hidden: heading.children.length > 0 && [...heading.children].every((child) => child.getAttribute("aria-hidden") === "true"),
    risen: heading.hasAttribute("data-in"),
  })));
  assert.ok(titles.length >= 7, `desktop: every home section title is split (${titles.length})`);
  for (const title of titles) {
    assert.equal(title.chars, title.label.replace(/\s+/g, ""), `desktop: "${title.label}" keeps every character`);
    assert.ok(title.hidden, `desktop: "${title.label}" hides its split spans from assistive technology`);
    assert.ok(title.risen, `desktop: "${title.label}" rose in when it entered the viewport`);
    assert.ok(await page.getByRole("heading", { level: 2, name: title.label, exact: true }).count() >= 1, `desktop: "${title.label}" is the heading's accessible name`);
  }
});
```

- [ ] **Step 2: Watch it fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `desktop: every home section title is split (0)`.

- [ ] **Step 3: Write `src/components/fx/SplitReveal.tsx`**

```tsx
"use client";

import type { CSSProperties, RefObject } from "react";
import { useFx } from "./env";
import { useInViewFlag } from "./useInViewFlag";

/** Whether a title splits into characters (fine-pointer desktop, after hydration), plus the in-view flag that
 *  starts the rise. The server, no-JS, touch and reduced-motion visitors keep whole words. */
export function useSplitReveal(ref: RefObject<HTMLElement | null>): boolean {
  const split = useFx();
  useInViewFlag(ref, { enabled: split, amount: 0.35 });
  return split;
}

/** One word's characters, each rising out of the word's mask from blur to sharp (globals.css, FX block).
 *  Render it inside an aria-hidden word, under a heading that carries the full aria-label. */
export function SplitWordChars({ chars, offset }: { chars: string[]; offset: number }) {
  return (
    <span className="fx-split-mask">
      {chars.map((char, j) => (
        <span key={j} data-split-char="" className="fx-split-char" style={{ "--i": offset + j } as CSSProperties}>
          {char}
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 4: Rewrite `src/components/ScrollColorTitle.tsx`**

```tsx
"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";
import { SplitWordChars, useSplitReveal } from "@/components/fx/SplitReveal";
import { charOffsets, splitWords } from "@/components/fx/split";

/**
 * Large section title that fills from faint grey to bright ink as it scrolls up through the viewport —
 * the same word-by-word fill used for the hero statement, scoped to a heading. On fine-pointer desktops
 * each word's characters also rise out of a mask when the title enters (SplitReveal); the heading's
 * aria-label keeps the whole title for assistive technology.
 */
export default function ScrollColorTitle({
  title,
  className = "",
}: {
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const split = useSplitReveal(ref);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "end 0.5"],
  });
  const words = splitWords(title);
  const offsets = charOffsets(words);
  return (
    <h2
      ref={ref}
      aria-label={title}
      data-split-title=""
      className={`display text-[clamp(38px,7vw,84px)] leading-[0.95] ${className}`}
    >
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + 1 / words.length;
        return (
          <Word key={i} progress={scrollYProgress} range={[start, end]} split={split}>
            {split ? <SplitWordChars chars={word.chars} offset={offsets[i]} /> : word.text}
          </Word>
        );
      })}
    </h2>
  );
}

function Word({
  children,
  progress,
  range,
  split,
}: {
  children: ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
  split: boolean;
}) {
  const color = useTransform(progress, range, ["#3a3b3e", "#e3dbd8"]);
  return (
    <span className="mr-[0.26em] inline-block" aria-hidden={split || undefined}>
      <motion.span data-scroll-word="" style={{ color }}>{children}</motion.span>
    </span>
  );
}
```

- [ ] **Step 5: Add the split rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Split titles (SplitReveal.tsx): characters rise out of each word's mask, blur to sharp, staggered. The
   negative margins cancel the mask's padding, so the line box (and the section height) stays the same. */
.fx-split-mask { display: inline-block; overflow: hidden; vertical-align: top; padding: 0.08em 0.04em 0.18em; margin: -0.08em -0.04em -0.18em; }
.fx-split-char { display: inline-block; translate: 0 115%; opacity: 0; filter: blur(10px); transition: translate 1s var(--fx-ease), opacity 0.7s ease-out, filter 0.9s ease-out; transition-delay: calc(var(--i, 0) * 30ms); }
[data-in] .fx-split-char { translate: 0 0; opacity: 1; filter: blur(0); }
```

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 7: Rebuild and watch the check pass**

Rebuild through `wt.sh`, then fx-checks through `wt.sh`.
Expected: PASS, including `split titles keep their full accessible name and rise in as they enter`.

- [ ] **Step 8: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass; the hidden-text gate (no-JS, reduced motion) still sees whole-word titles, and the 320 px sweep sees unsplit titles.

- [ ] **Step 9: Real-GPU check (controller)**

1. Scroll to each section title (What We Do, Our Services, Our Process, What We Measure, Engagements, Questions & Answers, Who You Work With): the characters rise out of an invisible mask one after another, from blurred to sharp, left to right, in about half a second per title.
2. Keep scrolling: the grey→white fill still sweeps across the words.
3. Reload with a title already on screen: there is no visible jump in its position or line wrapping when the split happens (descenders such as the "y" and "g" are not clipped once risen).
4. On a service page, "How It Works" / "Questions & Answers" / "Related Services" titles behave the same.
Sick = cinematic and legible at every moment of the rise.

- [ ] **Step 10: Commit**

```bash
git add src/components/fx/SplitReveal.tsx src/components/ScrollColorTitle.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): split-character section titles that keep their accessible names" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ScrollProgressRail

**Files:**
- Create: `src/components/fx/ScrollProgressRail.tsx`
- Modify: `src/app/page.tsx` (full rewrite below)
- Modify: `src/components/sections/Testimonials.tsx` (export `HAS_TESTIMONIALS`)
- Modify: `src/components/sections/Labs.tsx` (export `HAS_LABS`)
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

Design: a right-side rail on the home page that upgrades the footer's "Home page sections" list into a live, in-viewport navigator. It reuses the section titles from `SECTIONS` (no new copy) and is named "On this page", so the two landmarks stay distinct. It sits **before** `<main>` in the DOM: Tab from the header reaches it, and Tab from the last section still enters the curtain footer (the existing `browser-check` assertion). It fades out over the hero and the footer but stays focusable: focus brings it back. Like every primitive it mounts only for `useFx()`; the footer list remains the always-available equivalent.

- [ ] **Step 1: Write the failing check**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("the progress rail is keyboard-reachable and tracks the section in view", async (page) => {
  await page.locator("header").getByRole("link", { name: "Discuss a project" }).focus();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(450);
  const first = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el?.closest("[data-fx-rail]")) return null;
    let opacity = 1;
    for (let node = el; node; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity);
    const r = el.getBoundingClientRect();
    return {
      href: el.getAttribute("href"),
      name: el.textContent.trim(),
      outline: getComputedStyle(el).outlineStyle !== "none",
      inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
      opacity,
      labelOpacity: parseFloat(getComputedStyle(el.querySelector(".fx-rail-label")).opacity),
    };
  });
  assert.ok(first, "desktop: Tab from the header reaches the progress rail");
  assert.deepEqual({ href: first.href, name: first.name, outline: first.outline, inView: first.inView }, { href: "#work", name: "What We Do", outline: true, inView: true }, "desktop: the first rail link is focused, named and in view");
  assert.ok(first.opacity >= 0.99 && first.labelOpacity >= 0.99, "desktop: the focused rail link and its label are visible");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const work = document.getElementById("work");
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) + parseFloat(getComputedStyle(work).scrollMarginTop);
    return Math.abs(work.getBoundingClientRect().top - offset) < 4;
  }, null, { timeout: 4000 });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.querySelector('[data-fx-rail] a[aria-current="location"]')?.getAttribute("href")), "#work", "desktop: the rail marks the section in view");
});
```

- [ ] **Step 2: Watch it fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `desktop: Tab from the header reaches the progress rail`.

- [ ] **Step 3: Write `src/components/fx/ScrollProgressRail.tsx`**

```tsx
"use client";

import { motion, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { useFx } from "./env";

export type RailItem = { id: string; label: string };

/**
 * Right-side progress rail for the home page (fine-pointer desktops). Plain anchor links, so keyboard,
 * scroll-padding-top and smooth native anchors behave like the footer's section list. The section in the
 * middle of the viewport is marked aria-current; labels show on hover and focus. It fades out while the
 * hero or the footer fills the screen, and focus brings it back.
 */
export default function ScrollProgressRail({ items }: { items: RailItem[] }) {
  const fx = useFx();
  if (!fx) return null;
  return <Rail items={items} />;
}

function Rail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
      setActive(items.find((item) => seen.get(item.id))?.id ?? null);
    }, { rootMargin: "-45% 0px -54% 0px" });
    for (const item of items) {
      const section = document.getElementById(item.id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" data-fx-rail="" data-idle={active ? undefined : ""} className="fx-rail">
      <span aria-hidden className="fx-rail-track">
        <motion.span className="fx-rail-fill" style={{ scaleY: scrollYProgress }} />
      </span>
      <ol className="fx-rail-list">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={item.id === active ? "location" : undefined} className="fx-rail-link">
              <span className="fx-rail-label">{item.label}</span>
              <span aria-hidden className="fx-rail-dot" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 4: Export the visibility of the data-gated sections**

`src/components/sections/Testimonials.tsx` — after the line `const REVIEWS = TESTIMONIALS.length ? TESTIMONIALS : USING_SAMPLES ? SAMPLE_TESTIMONIALS : [];` add:

```tsx
/** Whether the section renders (the home progress rail lists it only then). */
export const HAS_TESTIMONIALS = REVIEWS.length > 0;
```

`src/components/sections/Labs.tsx` — after the line `const ITEMS = ARTICLES.length ? ARTICLES : USING_SAMPLES ? SAMPLE_ARTICLES : [];` add:

```tsx
/** Whether the section renders (the home progress rail lists it only then). */
export const HAS_LABS = ITEMS.length > 0;
```

- [ ] **Step 5: Rewrite `src/app/page.tsx`**

Read it first; if Part 1 changed it, keep Part 1's changes and apply only the rail additions (imports, `RAIL`, the fragment and `<ScrollProgressRail>`).

```tsx
import { buildMetadata } from "@/lib/seo";
import OrbitalCinematic from "@/components/sections/OrbitalCinematic";
import Work from "@/components/sections/Work";
import Services from "@/components/sections/Services";
import Analytics from "@/components/sections/Analytics";
import Process from "@/components/sections/Process";
import Pricing from "@/components/sections/Pricing";
import Faq from "@/components/sections/Faq";
import Team from "@/components/sections/Team";
import Testimonials, { HAS_TESTIMONIALS } from "@/components/sections/Testimonials";
import Labs, { HAS_LABS } from "@/components/sections/Labs";
import ScrollProgressRail, { type RailItem } from "@/components/fx/ScrollProgressRail";
import { SECTIONS } from "@/lib/content";

export const metadata = buildMetadata({ title: "Digital Transformation & AI Consulting", description: "Turn business challenges into working digital systems. spacegear.tech brings digital transformation, AI strategy and hands-on delivery together.", path: "/" });

/** Home sections for the progress rail, labelled with their section titles (no new copy). */
const RAIL: RailItem[] = [
  { id: "work", label: SECTIONS.work.title },
  { id: "services", label: SECTIONS.services.title },
  { id: "process", label: SECTIONS.process.title },
  { id: "analytics", label: SECTIONS.analytics.title },
  { id: "pricing", label: SECTIONS.pricing.title },
  { id: "faq", label: SECTIONS.faq.title },
  { id: "team", label: SECTIONS.team.title },
  ...(HAS_TESTIMONIALS ? [{ id: "testimonials", label: SECTIONS.testimonials.title }] : []),
  ...(HAS_LABS ? [{ id: "labs", label: SECTIONS.labs.title }] : []),
];

export default function Home() {
  return (
    <>
      {/* === FX === before <main> in the tab order, so Tab from the last section still enters the footer */}
      <ScrollProgressRail items={RAIL} />
      <main id="main" className="relative bg-bg">
        <OrbitalCinematic />
        {/* curtain: this panel slides up over the locked hero background */}
        <div className="relative z-10 rounded-t-[28px] border-t border-line bg-bg shadow-[0_-30px_60px_-20px_rgba(0,0,0,0.75)]">
          <Work />
          <Services />
          <Process />
          <Analytics />
          <Pricing />
          <Faq />
          <Team />
          <Testimonials />
          <Labs />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 6: Add the rail rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Progress rail (ScrollProgressRail.tsx). Faded but focusable over the hero and footer; focus shows it. */
.fx-rail { position: fixed; right: 18px; top: 50%; z-index: 40; translate: 0 -50%; transition: opacity 0.4s ease-out; }
.fx-rail[data-idle]:not(:focus-within) { opacity: 0; pointer-events: none; }
.fx-rail-track { position: absolute; top: 11px; bottom: 11px; right: 10.5px; width: 1px; overflow: hidden; background: #2a2b2e; }
.fx-rail-fill { position: absolute; inset: 0; background: #fa6e43; transform-origin: top; }
.fx-rail-list { position: relative; display: flex; flex-direction: column; gap: 6px; }
.fx-rail-link { position: relative; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 8px; }
.fx-rail-dot { width: 6px; height: 6px; border-radius: 9999px; background: #5f5f66; transition: background-color 0.3s, scale 0.35s var(--fx-ease); }
.fx-rail-link[aria-current] .fx-rail-dot { background: #fa6e43; scale: 1.6; }
.fx-rail-label { position: absolute; right: calc(100% + 8px); top: 50%; translate: 6px -50%; white-space: nowrap; border: 1px solid #2a2b2e; border-radius: 8px; background: rgba(22, 23, 25, 0.92); padding: 5px 10px; font-size: 12px; line-height: 1.2; color: #e3dbd8; opacity: 0; pointer-events: none; transition: opacity 0.25s, translate 0.3s var(--fx-ease); }
.fx-rail-link:is(:hover, :focus-visible) .fx-rail-label { opacity: 1; translate: 0 -50%; }
```

- [ ] **Step 7: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 8: Rebuild and watch the check pass**

Rebuild through `wt.sh`, then fx-checks through `wt.sh`.
Expected: PASS, including `the progress rail is keyboard-reachable and tracks the section in view`.

- [ ] **Step 9: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass — in particular `desktop: keyboard focus in the curtain footer must be visible (focus must enter the footer)`, which proves the rail did not steal the Tab after the last section.

- [ ] **Step 10: Real-GPU check (controller)**

1. Past the hero, a slim rail of dots fades in at the right edge; the dot for the section in the middle of the screen grows and turns orange, and a hairline progress fill grows down the track as the page scrolls.
2. Hover a dot: its section title slides in to its left. Click it: the page glides there and the title lands just under the nav.
3. The rail fades out over the hero and over the footer.
4. Tab from "Discuss a project" in the header: focus lands on the rail with a visible ring and label, even over the hero.
5. It never overlaps content at 1422 px (the container leaves ~90 px of gutter).
Sick = quiet, precise and always right about where you are.

- [ ] **Step 11: Commit**

```bash
git add src/components/fx/ScrollProgressRail.tsx src/app/page.tsx src/components/sections/Testimonials.tsx src/components/sections/Labs.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): home progress rail" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Site-wide micro-interactions — nav pill, button sweep, link underline, field glow

**Files:**
- Modify: `src/components/Nav.tsx` (full rewrite below)
- Modify: `src/components/ui.tsx` (sweep classes)
- Modify: `src/components/sections/Footer.tsx` (underline classes)
- Modify: `src/components/PageIntro.tsx` (underline class)
- Modify: `src/components/QuickStart.tsx` (field class)
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

These run on every device (they are hover/focus feedback, not heavy effects): the sweep and the underline only on hover-capable devices, the glow on focus everywhere, the pill whenever the desktop nav shows. Reduced motion makes them instant (global `transition-duration: 0s`, Motion `skipAnimations`).

- [ ] **Step 1: Write the failing check**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("the nav pill slides, buttons sweep, links underline and fields glow", async (page) => {
  const pill = () => page.evaluate(() => document.querySelector("[data-nav-pill]")?.closest("a")?.getAttribute("href") ?? null);
  assert.equal(await pill(), "/", "desktop: the pill sits on the current page link");
  assert.equal(await page.evaluate(() => document.querySelector('header a[aria-current="page"]')?.getAttribute("href")), "/", "desktop: the current page link is marked");
  await page.locator("header").getByRole("link", { name: "About", exact: true }).hover();
  await page.waitForTimeout(500);
  assert.equal(await pill(), "/about/", "desktop: the pill follows the hovered link");
  await page.mouse.move(700, 600, { steps: 4 });
  await page.waitForTimeout(500);
  assert.equal(await pill(), "/", "desktop: the pill returns to the current page link");
  const button = page.locator("#process a.fx-sweep").first();
  await button.scrollIntoViewIfNeeded();
  await button.hover();
  await page.waitForTimeout(650);
  assert.equal(await button.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el, "::before").transform).a), 1, "desktop: the button fill sweeps in on hover");
  await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  const link = page.locator('#contact nav a[href="/#work"]');
  await link.hover();
  await page.waitForTimeout(550);
  assert.equal(await link.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el, "::after").transform).a), 1, "desktop: the link underline draws in on hover");
  const field = page.getByLabel("Your name");
  await field.focus();
  await page.waitForTimeout(450);
  assert.match(await field.evaluate((el) => getComputedStyle(el).boxShadow), /rgba\(250, 110, 67/, "desktop: a focused field glows");
});
```

- [ ] **Step 2: Watch it fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `desktop: the pill sits on the current page link` (`null` instead of `/`).

- [ ] **Step 3: Rewrite `src/components/Nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Brand from "@/components/Brand";
import { MagneticLink } from "@/components/fx/Magnetic";
import { SERVICES } from "@/lib/content";

type Item = { label: string; href: string };

const PRIMARY: Item[] = [{ label: "Home", href: "/" }];
const SERVICE_ITEMS: Item[] = SERVICES.map((s) => ({ label: s.name, href: `/services/${s.slug}/` }));
const TAIL: Item[] = [
  { label: "Approach", href: "/approach/" },
  { label: "About", href: "/about/" },
  { label: "Engagements", href: "/#pricing" },
  { label: "Contact", href: "/contact/" },
];

/** The desktop link for the current page: "/" at home, the Services trigger anywhere under /services/,
 *  otherwise the page link whose path the pathname starts with. Hash links are never current. */
function currentHref(pathname: string): string | null {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/services/")) return "/services/";
  return TAIL.find((it) => !it.href.includes("#") && pathname.startsWith(it.href))?.href ?? null;
}

/** The pill behind the current (or hovered) link; Motion's shared layout slides it between links. */
function Pill() {
  return (
    <motion.span
      data-nav-pill=""
      layoutId="nav-pill"
      aria-hidden
      className="absolute inset-0 -z-10 rounded-lg bg-card-2"
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    />
  );
}

function NavLink({ it, current, pill, onHover }: { it: Item; current: boolean; pill: boolean; onHover: () => void }) {
  return (
    <li onMouseEnter={onHover}>
      <Link
        prefetch={false}
        href={it.href}
        aria-current={current ? "page" : undefined}
        className={`relative isolate rounded-lg px-3 py-2 text-[13px] transition-colors hover:text-ink ${current ? "text-ink" : "text-mut-2"}`}
      >
        {pill && <Pill />}
        {it.label}
      </Link>
    </li>
  );
}

function Dropdown({ label, href, items, current, pill, onHover }: { label: string; href: string; items: Item[]; current: boolean; pill: boolean; onHover: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const open = dismissed
    ? ""
    : "group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100";
  return (
    <li
      className="group relative"
      onMouseEnter={() => { setDismissed(false); onHover(); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDismissed(false); }}
      onKeyDown={(event) => { if (event.key === "Escape") { setDismissed(true); trigger.current?.focus(); } }}
    >
      <Link
        ref={trigger}
        prefetch={false}
        href={href}
        aria-current={current ? "page" : undefined}
        className={`relative isolate flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] transition-colors group-hover:text-ink group-focus-within:text-ink ${current ? "text-ink" : "text-mut-2"}`}
      >
        {pill && <Pill />}
        {label}
        <span aria-hidden className="text-[9px] text-mut-3 transition-transform group-hover:rotate-180 group-focus-within:rotate-180">
          ▾
        </span>
      </Link>
      <div className={`invisible absolute left-0 top-full z-10 pt-2 opacity-0 transition-all duration-200 ${open}`}>
        <ul className="w-64 rounded-xl border border-line bg-[#161719]/95 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                prefetch={false}
                href={it.href}
                className="block truncate rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors hover:bg-card-2 hover:text-ink"
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function MobileGroup({ title, items, onNavigate }: { title: string; items: Item[]; onNavigate: () => void }) {
  return (
    <div className="mt-2 border-t border-line-soft pt-2">
      <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{title}</p>
      {items.map((it) => (
        <Link
          prefetch={false}
          key={it.href}
          href={it.href}
          onClick={onNavigate}
          className="block truncate rounded-lg px-4 py-2.5 text-[13px] text-mut-2 hover:bg-card-2 hover:text-ink"
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const current = currentHref(pathname);
  const pillAt = hovered ?? current;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  const close = () => { if (menu.current) menu.current.open = false; };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        aria-label="Main navigation"
        className={`flex w-full max-w-[1180px] items-center justify-between gap-4 rounded-2xl border px-3 py-2 transition-all duration-500 ${
          scrolled ? "border-line bg-[#161719]/85 backdrop-blur-xl" : "border-transparent bg-[#161719]/30 backdrop-blur-md"
        }`}
      >
        <Link prefetch={false} href="/" aria-label="space—gear home" className="flex items-center gap-2 pl-2">
          <Brand />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex" onMouseLeave={() => setHovered(null)}>
          {PRIMARY.map((it) => (
            <NavLink key={it.href} it={it} current={current === it.href} pill={pillAt === it.href} onHover={() => setHovered(it.href)} />
          ))}
          <Dropdown
            label="Services"
            href="/services/"
            items={SERVICE_ITEMS}
            current={current === "/services/"}
            pill={pillAt === "/services/"}
            onHover={() => setHovered("/services/")}
          />
          {TAIL.map((it) => (
            <NavLink key={it.href} it={it} current={current === it.href} pill={pillAt === it.href} onHover={() => setHovered(it.href)} />
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <MagneticLink
            href="/contact/"
            className="fx-sweep fx-sweep-ghost hidden rounded-xl border border-line px-4 py-2 text-[13px] text-ink transition-colors hover:border-mut-3 sm:inline-flex"
          >
            Discuss a project
          </MagneticLink>
          <details
            ref={menu}
            className="mobile-menu lg:hidden"
            onKeyDown={(event) => { if (event.key === "Escape" && menu.current?.open) { close(); menu.current?.querySelector("summary")?.focus(); } }}
          >
            <summary
              aria-label="Open navigation"
              className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-xl border border-line text-ink"
            >
              <span aria-hidden className="space-y-1">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            </summary>
            {/* mobile sitemap — positioned against the fixed header, like the original */}
            <div className="scrollbar-none absolute -inset-x-px top-[calc(100%+3px)] max-h-[78vh] overflow-y-auto rounded-2xl border border-line bg-[#161719]/97 p-3 backdrop-blur-xl">
              {[...PRIMARY, { label: "Services", href: "/services/" }, ...TAIL].map((it) => (
                <Link
                  prefetch={false}
                  key={it.href}
                  href={it.href}
                  onClick={close}
                  className="block rounded-lg px-4 py-3 text-[15px] text-ink hover:bg-card-2"
                >
                  {it.label}
                </Link>
              ))}
              <MobileGroup title="All services" items={SERVICE_ITEMS} onNavigate={close} />
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Add the sweep to the buttons (`src/components/ui.tsx`)**

In `FlameButton`, replace

```tsx
      className={`group inline-flex items-center justify-center gap-2 rounded-xl bg-flame
```

with

```tsx
      className={`fx-sweep group inline-flex items-center justify-center gap-2 rounded-xl bg-flame
```

In `GhostButton`, replace

```tsx
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card-2/60
```

with

```tsx
      className={`fx-sweep fx-sweep-ghost inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card-2/60
```

- [ ] **Step 5: Underline the text links**

`src/components/sections/Footer.tsx`:
- In the column list, replace `className="text-[14px] text-mut-2 transition-colors hover:text-ink"` with `className="fx-underline text-[14px] text-mut-2 transition-colors hover:text-ink"`.
- In the email link and the "Discuss a project ↗" link, replace both occurrences of `className="relative inline-block text-[13px] text-mut-2 transition-colors hover:text-flame lg:float-right"` with `className="fx-underline relative inline-block text-[13px] text-mut-2 transition-colors hover:text-flame lg:float-right"`.
- Replace `className="text-flame hover:underline"` (the Privacy policy link) with `className="fx-underline text-flame"`.

`src/components/PageIntro.tsx` — replace `className="font-mono text-[12px] text-mut-2 transition-colors hover:text-flame"` with `className="fx-underline font-mono text-[12px] text-mut-2 transition-colors hover:text-flame"`.

`src/components/QuickStart.tsx` — replace

```tsx
  const input = "w-full rounded-xl border border-line bg-card-2/60 px-4 py-3.5 text-[14px] text-ink placeholder:text-mut-2 focus:border-flame";
```

with

```tsx
  const input = "fx-field w-full rounded-xl border border-line bg-card-2/60 px-4 py-3.5 text-[14px] text-ink placeholder:text-mut-2 focus:border-flame";
```

- [ ] **Step 6: Add the micro-interaction rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Micro-interactions. Sweep fill and underline draw on hover devices (and the underline on keyboard focus);
   focus glow on every device. Transforms only, except the glow's box-shadow (paint, no layout). */
@media (hover: hover) {
  .fx-sweep,
  .contact-form .button { position: relative; isolation: isolate; overflow: hidden; }
  .fx-sweep::before,
  .contact-form .button::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: var(--fx-sweep, #ff9573); pointer-events: none; transform: scaleX(0); transform-origin: right; transition: transform 0.5s var(--fx-ease-io); }
  .fx-sweep:hover::before,
  .contact-form .button:not(:disabled):hover::before { transform: scaleX(1); transform-origin: left; }
  .fx-underline:hover::after { transform: scaleX(1); transform-origin: left; }
}
.fx-sweep-ghost { --fx-sweep: rgba(250, 110, 67, 0.16); }
.fx-underline { position: relative; }
.fx-underline::after { content: ""; position: absolute; left: 0; right: 0; bottom: -2px; height: 1px; background: currentColor; pointer-events: none; transform: scaleX(0); transform-origin: right; transition: transform 0.4s var(--fx-ease-io); }
.fx-underline:focus-visible::after { transform: scaleX(1); transform-origin: left; }
.fx-field,
.field :is(input, select, textarea) { transition: border-color 0.25s, box-shadow 0.35s; }
.fx-field:focus,
.field :is(input, select, textarea):focus { box-shadow: 0 0 0 3px rgba(250, 110, 67, 0.16), 0 0 28px -6px rgba(250, 110, 67, 0.55); }
```

- [ ] **Step 7: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 8: Rebuild and watch the check pass**

Rebuild through `wt.sh`, then fx-checks through `wt.sh`.
Expected: PASS, including `the nav pill slides, buttons sweep, links underline and fields glow`.

- [ ] **Step 9: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass (the mobile-390 menu keyboard test still opens, closes and navigates with the rewritten nav).

- [ ] **Step 10: Real-GPU check (controller)**

1. Nav: glide the pointer across Home → Services → Approach → About → Engagements → Contact: a soft pill slides between them and slides back to the current page's link when the pointer leaves the bar; open `/about/`: the pill sits on About.
2. Flame buttons: a lighter orange fill sweeps in left→right on hover and wipes out to the right on leave; ghost buttons and the header CTA: a faint orange tint sweeps the same way.
3. Footer links and the inner-page "← Home" link: an underline draws in from the left on hover (and on Tab focus) and retracts to the right.
4. Focus the footer name/email fields, then the contact form fields: a soft orange glow blooms around the field.
Sick = every micro-motion lands in 300–500 ms on the same easing family, and nothing shifts layout.

- [ ] **Step 11: Commit**

```bash
git add src/components/Nav.tsx src/components/ui.tsx src/components/sections/Footer.tsx src/components/PageIntro.tsx src/components/QuickStart.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): nav pill, button sweep, link underline and field glow" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Page transitions (orange curtain via React ViewTransition)

**Files:**
- Modify: `next.config.ts` (`experimental.viewTransition`)
- Create: `src/types/react-canary.d.ts`
- Create: `src/components/fx/PageTransition.tsx`
- Create: `src/app/template.tsx`
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

The supported Next 16 way, per `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/viewTransition.md` and `01-app/02-guides/view-transitions.md`: set `experimental.viewTransition: true` and use React's `<ViewTransition>` (`import { ViewTransition } from "react"`; the App Router bundles the React canary that exports it, no extra install). Route navigations are transitions, so boundaries animate on navigation; without browser support "the transitions simply do not animate". React's own fallback (read in `next/dist/compiled/react-dom`) catches a missing `document.startViewTransition` and commits immediately, so navigation degrades to instant.

How the curtain works:
- React only animates named boundaries and cancels the root snapshot when nothing outside a boundary changes, so the curtain cannot be a `::view-transition-old(root)` trick.
- Instead, `PageTransition` keys its content by pathname. Every route change therefore exits the old page boundary (`fx-page-out`) and enters both a new full-viewport curtain element (`fx-curtain`) and the new page (`fx-page-in`).
- A key per pathname is needed because `template.tsx` alone only remounts when the first URL segment changes (`template.md`: `/services/` → `/services/applied-ai/` would not remount).
- The CSS paints the curtain orange: it rises from the bottom over the held old page, which disappears while covered, then lifts off the top as the new page settles.
- The nav is not given its own name, because a permanent `view-transition-name` on the header would make it a backdrop root and break its backdrop blur. The curtain therefore covers the whole viewport, nav included, for its 720 ms.
- Reduced motion sets every view-transition animation to 0 s (the guide's recipe), so the swap is instant.

- [ ] **Step 1: Write the failing checks**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
const curtainRunning = (page) => page.evaluate(() => document.getAnimations().filter((a) => a.animationName === "fx-curtain" && a.playState === "running").length);

desktop("a route change plays the orange curtain view transition", async (page) => {
  await page.locator("header").getByRole("link", { name: "About", exact: true }).click();
  // The curtain's animation exists only while the transition runs (720 ms).
  await page.waitForFunction(() => document.getAnimations().some((a) => a.animationName === "fx-curtain"), null, { timeout: 3000 });
  await page.waitForURL("**/about/");
  assert.ok(await page.evaluate(() => window.__fx.vt) >= 1, "desktop: navigation starts a view transition");
  await page.waitForTimeout(900);
  assert.equal(await curtainRunning(page), 0, "desktop: the curtain finishes");
  assert.ok(await page.locator("h1").isVisible(), "desktop: the new page shows after the curtain");
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains("lenis")), "desktop: smooth scrolling survives the navigation");
});

desktop("without the View Transitions API the route change is instant", async (page) => {
  await page.evaluate(() => { delete Document.prototype.startViewTransition; });
  await page.locator("header").getByRole("link", { name: "About", exact: true }).click();
  await page.waitForURL("**/about/");
  await page.locator("h1").waitFor({ state: "visible", timeout: 2000 });
  assert.equal(await curtainRunning(page), 0, "desktop: no curtain without the API");
});

desktop("under reduced motion the route change is instant", async (page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-fx"));
    await page.locator("header").getByRole("link", { name: "About", exact: true }).click();
    await page.waitForURL("**/about/");
    await page.waitForTimeout(60);
    assert.equal(await curtainRunning(page), 0, "reduced motion: the curtain does not play");
    assert.ok(await page.locator("h1").isVisible(), "reduced motion: the new page shows at once");
  } finally {
    await page.emulateMedia({ reducedMotion: null });
  }
});
```

- [ ] **Step 2: Watch them fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `page.waitForFunction: Timeout 3000ms exceeded` in `a route change plays the orange curtain view transition`.

- [ ] **Step 3: Enable the flag in `next.config.ts`**

Replace

```ts
  poweredByHeader: false,
};
```

with

```ts
  poweredByHeader: false,
  // React <ViewTransition> on route navigations (the page curtain, src/components/fx/PageTransition.tsx).
  experimental: { viewTransition: true },
};
```

- [ ] **Step 4: Load the React canary types — `src/types/react-canary.d.ts`**

```ts
// <ViewTransition> ships in the React canary that Next's App Router bundles; @types/react declares it here.
/// <reference types="react/canary" />
```

- [ ] **Step 5: Write `src/components/fx/PageTransition.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Fragment, ViewTransition, type ReactNode } from "react";

/**
 * Orange curtain between routes (React <ViewTransition> + Next's experimental.viewTransition). Keying by
 * pathname makes every route change exit the old page and enter the new one together with a full-viewport
 * curtain element; globals.css (FX block) turns those snapshots into the wipe. Same-page hash links and
 * search-param changes keep the key, so they never animate. Where the View Transitions API is missing,
 * React commits at once; under reduced motion the animations last 0 s.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Fragment key={pathname}>
      <ViewTransition enter="fx-curtain" exit="none" update="none" default="none">
        <div aria-hidden className="fx-vt-curtain" />
      </ViewTransition>
      <ViewTransition enter="fx-page-in" exit="fx-page-out" update="none" default="none">
        {children}
      </ViewTransition>
    </Fragment>
  );
}
```

- [ ] **Step 6: Write `src/app/template.tsx`**

```tsx
import type { ReactNode } from "react";
import PageTransition from "@/components/fx/PageTransition";

/** Wraps every page in the curtain transition (src/components/fx/PageTransition.tsx). */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
```

- [ ] **Step 7: Add the curtain rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Page transition (PageTransition.tsx), 720 ms: an orange curtain rises over the held old page, the old page
   drops out while covered, then the curtain lifts off the top as the new page settles. */
::view-transition { pointer-events: none; }
.fx-vt-curtain { position: fixed; inset: 0; pointer-events: none; }
::view-transition-group(.fx-curtain) { z-index: 3; animation: none; }
::view-transition-new(.fx-curtain) { background: #fa6e43; animation: fx-curtain 720ms var(--fx-ease-io) both; }
::view-transition-group(.fx-page-out) { z-index: 2; animation: none; }
::view-transition-old(.fx-page-out) { animation: fx-page-hold 720ms linear both; }
::view-transition-group(.fx-page-in) { z-index: 1; animation: none; }
::view-transition-new(.fx-page-in) { animation: fx-page-settle 720ms var(--fx-ease) both; }
@keyframes fx-curtain {
  0% { clip-path: inset(100% 0 0 0); }
  46%, 54% { clip-path: inset(0 0 0 0); }
  100% { clip-path: inset(0 0 100% 0); }
}
@keyframes fx-page-hold { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
@keyframes fx-page-settle { 0%, 50% { translate: 0 40px; } 100% { translate: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation-duration: 0s !important; animation-delay: 0s !important; }
}
```

- [ ] **Step 8: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0. If `typecheck` reports `Module '"react"' has no exported member 'ViewTransition'`, the canary reference was not picked up: confirm `src/types/react-canary.d.ts` exists and that `tsconfig.json`'s `include` still has `**/*.ts`.

- [ ] **Step 9: Rebuild and watch the checks pass**

Rebuild through `wt.sh` (the build log mentions the experimental `viewTransition` flag; that is expected), then fx-checks through `wt.sh`.
Expected: PASS, including the three view-transition lines.

If the curtain check times out although `window.__fx.vt` is at least 1, open the page in the controller's Chrome and check DevTools → Animations. If the `.fx-curtain` class is missing on the `::view-transition-new` pseudo, the browser lacks `view-transition-class` (Chrome < 125). Report it; do not lower the assertion.

If the pathname key breaks Next's own scroll or focus handling (symptoms: a navigation lands mid-page instead of at the top, or `test:browser`'s mobile-menu navigation fails), remove `key={pathname}` (keep the `Fragment`) and record it in the plan's execution record. Navigations that change the first URL segment keep the curtain, because `template.tsx` remounts. Navigations within `/services/`, `/work/` or `/labs/` then become instant, which is the documented graceful fallback.

- [ ] **Step 10: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass. In particular, the mobile menu navigation, the quick-start hand-off (`router.push`) and the contact page prefill still work through the transition.

- [ ] **Step 11: Real-GPU check (controller)**

1. Click About in the nav: an orange curtain rises from the bottom over the current page, holds for a beat, then lifts off the top, revealing About as it settles up into place (~0.7 s in total).
2. Try home → a service page → another service page (same `/services/` segment), the footer links and the browser Back button: every route change gets the same single wipe.
3. Same-page links (footer "What We Do" while on home) just scroll: no curtain.
4. DevTools → Rendering → `prefers-reduced-motion: reduce`: navigation swaps instantly.
5. Watch for a flash of the new page before the curtain covers, a double flash, or a stuck orange screen: there must be none.
Sick = one clean, confident wipe that feels like a scene cut, never a loading screen.

- [ ] **Step 12: Commit**

```bash
git add next.config.ts src/types/react-canary.d.ts src/components/fx/PageTransition.tsx src/app/template.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): orange curtain page transitions with React ViewTransition" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: What We Do — image parallax and the desktop depth stack

**Files:**
- Create: `src/components/fx/Parallax.tsx`
- Create: `src/components/fx/ScrollDepth.tsx`
- Modify: `src/components/sections/Work.tsx` (full rewrite below)
- Modify: `scripts/fx-checks.mjs`

"Cards stack and scale on desktop scroll" is built from scroll-linked transforms, not sticky pinning: each bento item, as it leaves through the top, lags up to 96 px and shrinks to 0.9, so the row below slides over it. Pinning would add height to the section, which the fidelity guard would flag; this adds none. The mobile `StackCards` stack is unchanged.

- [ ] **Step 1: Write the failing check**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("What We Do images drift inside their frames and leaving cards stack and shrink", async (page) => {
  const read = () => page.evaluate(() => {
    const layer = document.querySelector("#work [data-parallax] > *");
    const depth = document.querySelector("#work [data-depth]");
    if (!layer || !depth) return null;
    return {
      parallaxY: new DOMMatrixReadOnly(getComputedStyle(layer).transform === "none" ? undefined : getComputedStyle(layer).transform).m42,
      depthScale: new DOMMatrixReadOnly(getComputedStyle(depth).transform === "none" ? undefined : getComputedStyle(depth).transform).a,
    };
  });
  const work = await sectionTop(page, "work");
  await jumpTo(page, work + 200);
  await page.waitForTimeout(500);
  const entering = await read();
  assert.ok(entering, "desktop: the bento has parallax and depth layers");
  await jumpTo(page, work + 900);
  await page.waitForTimeout(500);
  const leaving = await read();
  assert.ok(Math.abs(leaving.parallaxY - entering.parallaxY) > 4, `desktop: the image drifts in its frame (${entering.parallaxY} → ${leaving.parallaxY})`);
  assert.ok(leaving.depthScale < 0.99 && leaving.depthScale < entering.depthScale, `desktop: the leaving card shrinks (${entering.depthScale} → ${leaving.depthScale})`);
});
```

- [ ] **Step 2: Watch it fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `desktop: the bento has parallax and depth layers`.

- [ ] **Step 3: Write `src/components/fx/Parallax.tsx`**

```tsx
"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useFx } from "./env";

/**
 * Image parallax inside a clipped frame. On fine-pointer desktops the content is oversized by `distance` px
 * top and bottom and drifts from -distance to +distance as the frame crosses the viewport; elsewhere it
 * fills the frame exactly as before. `className` must position the frame (for example "absolute inset-0").
 */
export default function Parallax({ children, className = "", distance = 24 }: { children: ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useFx();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
  return (
    <div ref={ref} data-parallax="" className={`overflow-hidden ${className}`}>
      <motion.div className="absolute inset-x-0" style={fx ? { top: -distance, bottom: -distance, y } : { top: 0, bottom: 0 }}>
        {children}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/components/fx/ScrollDepth.tsx`**

```tsx
"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useFx } from "./env";

/**
 * Desktop "stack and scale": as the item leaves through the top of the viewport it lags (drifts down up to
 * `drift` px) and shrinks to `scale`, so the row below slides over it. Scroll-linked transforms only — no
 * height change and no frames while the page is still. Fine-pointer desktops only.
 */
export default function ScrollDepth({ children, className = "", drift = 96, scale = 0.9 }: { children: ReactNode; className?: string; drift?: number; scale?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useFx();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["end 0.75", "end 0.1"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, drift]);
  const s = useTransform(scrollYProgress, [0, 1], [1, scale]);
  return (
    <motion.div ref={ref} data-depth="" className={className} style={fx ? { y, scale: s, transformOrigin: "50% 0%" } : undefined}>
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 5: Rewrite `src/components/sections/Work.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Appear, AppearGroup, AppearItem, FillBar } from "@/components/motion";
import { Container, ArrowButton } from "@/components/ui";
import ScrollColorTitle from "@/components/ScrollColorTitle";
import StackCards from "@/components/StackCards";
import DotField from "@/components/DotField";
import Parallax from "@/components/fx/Parallax";
import ScrollDepth from "@/components/fx/ScrollDepth";
import Tilt from "@/components/fx/Tilt";
import { SECTIONS, WORK, type WorkTile } from "@/lib/content";

/** small animated drag-handle dots, top-right of each tile */
function GridDots() {
  return (
    <span aria-hidden className="grid grid-cols-3 gap-[3px] opacity-50 transition-opacity duration-300 group-hover:opacity-100">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

function ArrowBtn() {
  return <ArrowButton />;
}

/** Service tile with hover-revealed description + image zoom. Reused on service pages. On fine-pointer
 *  desktops the image also drifts inside its frame as the tile crosses the viewport. */
export function Tile({ name, img, desc, href }: WorkTile) {
  return (
    <Link prefetch={false} href={href} data-cursor="View" className="group relative block h-full overflow-hidden rounded-2xl border border-line">
      <Parallax className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-110"
        />
      </Parallax>
      {/* base gradient (legibility); a touch stronger on mobile where the desc is always shown */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f] via-[#0c0d0f]/30 to-transparent lg:via-transparent" />
      <div className="absolute inset-0 bg-[#0b0c0e]/0 transition-colors duration-500 group-hover:bg-[#0b0c0e]/65" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_70%_15%,rgba(250,110,67,0.22),transparent_72%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex h-full flex-col justify-between p-5 text-ink">
        <div className="flex items-start justify-between">
          <h3 className="text-[15px] font-medium drop-shadow">{name}</h3>
          <GridDots />
        </div>
        <div>
          {/* visible on mobile, hover/focus-revealed on desktop */}
          <p
            data-hover-reveal=""
            className="mb-3 max-w-[24ch] text-[12.5px] leading-relaxed text-mut-2 transition-all duration-[400ms] ease-out lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-visible:translate-y-0 lg:group-focus-visible:opacity-100"
          >
            {desc}
          </p>
          <ArrowBtn />
        </div>
      </div>
    </Link>
  );
}

function LineupPanel({ variant }: { variant: "desktop" | "mobile" }) {
  const l = WORK.lineup;
  const header = (
    <div className="flex items-center justify-between border-b border-[#161719]/20 pb-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{l.label}</span>
      <span className="font-mono text-[11px] tracking-[0.2em]">{l.count}</span>
    </div>
  );
  if (variant === "mobile") {
    return (
      <div className="flex h-[46vh] flex-col justify-between overflow-hidden rounded-2xl bg-flame p-6 text-[#161719]">
        <div>
          {header}
          <h3 className="display mt-4 text-2xl leading-tight">{l.title}</h3>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a2a17]">{l.text}</p>
        </div>
        <DotField cols={6} rows={3} color="#161719" className="gap-y-3" />
        <div className="flex items-center gap-2 border-t border-[#161719]/20 pt-3">
          <span aria-hidden className="text-base">◉</span>
          <span className="text-[13px] font-medium">{l.footer}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-flame p-6 text-[#161719]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_80%_10%,rgba(255,255,255,0.18),transparent_60%)]" />
      <div className="relative">
        {header}
        <h3 className="display mt-5 text-2xl leading-tight">{l.title}</h3>
        <p className="mt-3 text-[13px] leading-relaxed text-[#5a2a17]">{l.text}</p>
      </div>
      {/* flowing dot matrix */}
      <DotField cols={6} rows={5} color="#161719" className="relative my-4 gap-y-3.5" />
      <div className="relative flex items-center gap-2 border-t border-[#161719]/20 pt-3">
        <span aria-hidden className="text-base">◉</span>
        <span className="text-[13px] font-medium">{l.footer}</span>
      </div>
    </div>
  );
}

function AssessmentCard({ variant }: { variant: "desktop" | "mobile" }) {
  const a = WORK.assessment;
  const title = (
    <>
      <h3 className="display text-xl text-ink-strong">
        {a.title} <span className="text-mut-2">{a.badge}</span>
      </h3>
      <p className="mt-1 text-[13px] text-flame">{a.note}</p>
    </>
  );
  const bar = <FillBar value={a.progress} className="h-full rounded-full bg-flame" />;
  if (variant === "mobile") {
    return (
      <div className="mt-4 rounded-2xl border border-line bg-card p-6">
        {title}
        <p className="display mt-3 text-3xl text-mut">
          {a.value}<span className="text-base text-mut-3">{a.unit}</span>
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-3">{bar}</div>
        <Link prefetch={false} href={a.href} className="group mt-4 flex items-center justify-between">
          <span className="text-[13px] text-ink">{a.cta}</span>
          <ArrowBtn />
        </Link>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-line bg-card p-6">
      <div>
        {title}
        <div className="mt-4">
          <span className="inline-block rounded-md bg-card-3 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-mut-2">{a.chip}</span>
          <p className="display mt-2 text-3xl text-mut">
            {a.value}<span className="text-base text-mut-3">{a.unit}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-3">{bar}</div>
        </div>
      </div>
      <Link prefetch={false} href={a.href} className="group flex items-center justify-between">
        <span className="text-[13px] text-ink">{a.cta}</span>
        <ArrowBtn />
      </Link>
    </div>
  );
}

export default function Work() {
  const copy = SECTIONS.work;
  const f = WORK.featured;
  return (
    <section id="work" className="relative py-24">
      <Container>
        {/* header */}
        <ScrollColorTitle title={copy.title} />

        <Appear delay={0.05}>
          <div className="mt-8 grid gap-6 border-t border-line-soft pt-8 lg:grid-cols-[200px_1fr_240px]">
            <div className="font-mono text-[11px] leading-relaxed text-mut-3">
              <span className="text-mut">{copy.index}</span>
              <br />
              space<span className="text-flame">—</span>gear
            </div>
            <h3 className="display max-w-md text-[clamp(22px,2.6vw,34px)] text-ink">{copy.heading}</h3>
            <p className="text-[12px] leading-relaxed text-mut-2">{copy.description}</p>
          </div>
        </Appear>

        {/* bento (desktop): items lag and shrink as they leave, so the next row slides over them */}
        <AppearGroup className="mt-10 hidden auto-rows-[200px] gap-4 lg:grid lg:grid-cols-3 lg:[grid-auto-rows:200px]" stagger={0.07}>
          {/* featured service — spans 2 cols, 2 rows */}
          <AppearItem className="sm:col-span-2 sm:row-span-2">
            <ScrollDepth className="h-full">
              <Tilt spotlight className="h-full rounded-2xl">
                <Link prefetch={false} href={f.href} data-cursor="View" className="group relative block h-full min-h-[260px] overflow-hidden rounded-2xl border border-line">
                  <Parallax className="absolute inset-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
                  </Parallax>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/80 via-transparent to-[#0c0d0f]/40" />
                  <div className="relative flex h-full flex-col justify-between p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{f.label}</span>
                        <h3 className="display mt-1 text-2xl text-ink-strong">{f.name}</h3>
                      </div>
                      <GridDots />
                    </div>
                    <ArrowBtn />
                  </div>
                </Link>
              </Tilt>
            </ScrollDepth>
          </AppearItem>

          {/* service lineup orange panel — spans 2 rows */}
          <AppearItem className="sm:row-span-2">
            <ScrollDepth className="h-full">
              <LineupPanel variant="desktop" />
            </ScrollDepth>
          </AppearItem>

          {WORK.tiles.map((tile) => (
            <AppearItem key={tile.slug} className="h-full">
              <ScrollDepth className="h-full">
                <Tilt spotlight className="h-full rounded-2xl">
                  <Tile {...tile} />
                </Tilt>
              </ScrollDepth>
            </AppearItem>
          ))}

          {/* animated neural placeholder */}
          <AppearItem className="hidden h-full sm:block">
            <ScrollDepth className="h-full">
              <div aria-hidden className="relative grid h-full place-items-center overflow-hidden rounded-2xl border border-line bg-card/40">
                <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(250,110,67,0.08),transparent_70%)]" />
                <div className="spin-26 grid grid-cols-3 gap-2.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i} className="tile-pulse h-2 w-2 rounded-[3px] bg-flame/70" style={{ animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
              </div>
            </ScrollDepth>
          </AppearItem>

          <AppearItem className="h-full">
            <ScrollDepth className="h-full">
              <AssessmentCard variant="desktop" />
            </ScrollDepth>
          </AppearItem>
        </AppearGroup>

        {/* mobile: curtain card-stack — featured → services → lineup, each card freezes while the next slides over */}
        <div className="mt-10 lg:hidden">
          <StackCards top={88} step={14} gap={64}>
            <Link prefetch={false} href={f.href} data-cursor="View" className="group relative block h-[46vh] overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/85 via-transparent to-[#0c0d0f]/30" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{f.label}</span>
                    <h3 className="display mt-1 text-2xl text-ink-strong">{f.name}</h3>
                  </div>
                  <GridDots />
                </div>
                <ArrowBtn />
              </div>
            </Link>

            {WORK.tiles.map((tile) => (
              <div key={tile.slug} className="h-[46vh]">
                <Tile {...tile} />
              </div>
            ))}

            <LineupPanel variant="mobile" />
          </StackCards>

          <AssessmentCard variant="mobile" />
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 7: Rebuild and watch the check pass**

Rebuild through `wt.sh`, then fx-checks through `wt.sh`.
Expected: PASS, including `What We Do images drift inside their frames and leaving cards stack and shrink`.

- [ ] **Step 8: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass (the service pages' "Related Services" tiles use the same `Tile`).

- [ ] **Step 9: Real-GPU check (controller)**

1. Scroll slowly through What We Do at 1422×745: the tile and featured images move a little slower than their frames (depth); there is never a gap at the top or bottom edge of a frame.
2. As the upper bento row leaves the top, its cards shrink slightly and lag, and the row below slides over them; the last row drifts into the gap above Our Services without touching its title.
3. Hover zoom and the hover description still work on every tile; the 60 fps counter holds.
Sick = the bento feels like a stack of physical cards being dealt past you.

- [ ] **Step 10: Commit**

```bash
git add src/components/fx/Parallax.tsx src/components/fx/ScrollDepth.tsx src/components/sections/Work.tsx scripts/fx-checks.mjs
git commit -m "feat(fx): What We Do parallax and depth stack" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Services image sweep and dot ripple; Process scrubbed timeline

**Files:**
- Modify: `src/components/DotField.tsx` (full rewrite below)
- Modify: `src/components/sections/Services.tsx`
- Modify: `src/components/sections/Process.tsx`
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

- [ ] **Step 1: Write the failing checks**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("Services: an opening column wipes its image in and the dot matrix ripples", async (page) => {
  await jumpTo(page, await sectionTop(page, "services"));
  await page.waitForTimeout(900);
  const column = page.locator('#services a[data-cursor="Open"]').nth(1);
  await column.hover();
  await page.waitForTimeout(1300);
  const opened = await column.evaluate((el) => ({
    active: el.dataset.active,
    wipe: new DOMMatrixReadOnly(getComputedStyle(el.querySelector(".fx-reveal-wipe")).transform).a,
  }));
  assert.deepEqual(opened, { active: "true", wipe: 0 }, "desktop: the opened column's wipe has cleared its image");
  const field = page.locator("#services [data-ripple]").first(); // the desktop core panel (the mobile copy is hidden)
  const box = await field.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  await page.waitForTimeout(80);
  const rippling = await field.evaluate((el) => [...el.querySelectorAll(".dot-pulse")].filter((dot) => dot.getAnimations().some((a) => !(a instanceof CSSAnimation))).length);
  assert.ok(rippling >= 20, `desktop: the dot matrix ripples from the pointer (${rippling} dots)`);
});

desktop("Process: the timeline draws with the scroll, dots ignite and cards lift in turn", async (page) => {
  const read = () => page.evaluate(() => ({
    scale: new DOMMatrixReadOnly(getComputedStyle(document.querySelector("#process [data-timeline]")).transform).a,
    lit: [...document.querySelectorAll("#process [data-timeline-dot]")].map((dot) => parseFloat(getComputedStyle(dot).opacity)),
  }));
  const top = await page.evaluate(() => window.scrollY + document.querySelector("#process [data-timeline]").getBoundingClientRect().top);
  const at = async (dy) => {
    await page.evaluate(({ y, dy }) => window.scrollTo({ top: y - innerHeight * 0.8 + dy, behavior: "instant" }), { y: top, dy });
    await page.waitForTimeout(300);
    return read();
  };
  const start = await at(0);
  const mid = await at(200);
  const end = await at(600);
  const back = await at(200);
  assert.ok(start.scale < 0.05, `desktop: the line starts undrawn (${start.scale})`);
  assert.ok(mid.scale > 0.2 && mid.scale < 0.8, `desktop: the line is part-drawn mid-scroll (${mid.scale})`);
  assert.ok(end.scale > 0.99, `desktop: the line is fully drawn (${end.scale})`);
  assert.ok(Math.abs(back.scale - mid.scale) < 0.02, "desktop: scrolling back retracts the line");
  assert.ok(mid.lit[0] > 0.99 && mid.lit.at(-1) < 0.01, `desktop: dots ignite in order (${mid.lit.join(", ")})`);
  assert.ok(end.lit.every((opacity) => opacity > 0.99), "desktop: every dot is lit at the end");
});
```

- [ ] **Step 2: Watch them fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `TypeError: Cannot read properties of null (reading 'transform')` in the Services check (no `.fx-reveal-wipe` yet).

- [ ] **Step 3: Rewrite `src/components/DotField.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useFx } from "@/components/fx/env";
import { cellAt, ringDistance } from "@/components/fx/math";

/**
 * Grid of dots with a diagonal wave that sweeps a bright pulse through the
 * formation — they appear to constantly shift and move. Driven by the
 * `.dot-pulse` keyframes in globals.css, so it costs no JavaScript frames
 * and stops under prefers-reduced-motion. With `ripple`, on fine-pointer
 * desktops, moving over the field sends a ring of swelling dots out from
 * the pointer (Web Animations added on top of the pulse; no frames requested).
 */
export default function DotField({
  cols = 5,
  rows = 5,
  color = "#fa6e43",
  className = "",
  dotClassName = "h-1.5 w-1.5",
  ripple = false,
}: {
  cols?: number;
  rows?: number;
  color?: string;
  className?: string;
  dotClassName?: string;
  ripple?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useFx();

  useEffect(() => {
    const field = ref.current;
    if (!ripple || !fx || !field) return;
    let last = -1;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const r = field.getBoundingClientRect();
      const { row, col } = cellAt(event.clientX - r.left, event.clientY - r.top, r.width, r.height, cols, rows);
      const index = row * cols + col;
      if (index === last) return;
      last = index;
      field.querySelectorAll<HTMLElement>(".dot-pulse").forEach((dot, i) => {
        const ring = ringDistance(row, col, Math.floor(i / cols), i % cols);
        dot.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.9)" }, { transform: "scale(1)" }],
          { duration: 520, delay: ring * 70, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", composite: "add" },
        );
      });
    };
    const leave = () => { last = -1; };
    field.addEventListener("pointermove", move);
    field.addEventListener("pointerleave", leave);
    return () => {
      field.removeEventListener("pointermove", move);
      field.removeEventListener("pointerleave", leave);
    };
  }, [ripple, fx, cols, rows]);

  const cells = Array.from({ length: rows * cols }, (_, i) => ({
    r: Math.floor(i / cols),
    c: i % cols,
  }));
  return (
    <div
      ref={ref}
      aria-hidden
      data-ripple={ripple ? "" : undefined}
      className={`grid place-items-center gap-y-3 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {cells.map(({ r, c }, i) => (
        <span
          key={i}
          className={`dot-pulse rounded-full ${dotClassName}`}
          style={{
            backgroundColor: color,
            animationDelay: `${((r + c) % (cols + 1)) * 0.22}s`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Services column sweep and core-panel ripple (`src/components/sections/Services.tsx`)**

In `CorePanel`, replace

```tsx
      <DotField cols={5} rows={5} className="my-2 gap-y-5 px-1" />
```

with

```tsx
      <DotField cols={5} rows={5} className="my-2 gap-y-5 px-1" ripple />
```

In the desktop accordion, replace

```tsx
                    data-cursor="Open"
                    onMouseEnter={() => setActive(i)}
```

with

```tsx
                    data-cursor="Open"
                    data-active={isActive ? "true" : "false"}
                    onMouseEnter={() => setActive(i)}
```

and replace

```tsx
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.img} alt="" loading="lazy" decoding="async" className="mt-5 h-48 w-full max-w-sm rounded-xl object-cover" />
```

with

```tsx
                      <div className="relative mt-5 h-48 w-full max-w-sm overflow-hidden rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.img} alt="" loading="lazy" decoding="async" className="fx-reveal-img h-full w-full object-cover" />
                        <span aria-hidden className="fx-reveal-wipe" />
                      </div>
```

- [ ] **Step 5: Process scrubbed timeline (`src/components/sections/Process.tsx`)**

Replace the imports

```tsx
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
```

with

```tsx
import { animate, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
```

Replace the whole `ProcessSteps` function (from its doc comment `/** Animated connecting line + step cards. …` to its closing brace) with:

```tsx
/**
 * Timeline line scrubbed by scroll, dots that ignite as the line reaches them and step cards that lift in
 * turn. It is a scroll draw, so it also runs on touch; no-JS and reduced motion get the drawn end state
 * through the data-reveal hook (globals.css, NoScriptStyles.tsx). Used on the home page, Approach and
 * service pages.
 */
export function ProcessSteps({ steps, gridClassName = "md:grid-cols-2 xl:grid-cols-4" }: { steps: ProcessStep[]; gridClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.7"] });
  const stops = steps.map((_, i) => (steps.length === 1 ? 0 : i / (steps.length - 1)));
  return (
    <div ref={ref}>
      <div className="relative mt-12 hidden h-px md:block">
        <div className="absolute inset-0 bg-line-soft" />
        <motion.div
          data-reveal=""
          data-timeline=""
          className="absolute inset-0 origin-left bg-gradient-to-r from-flame to-flame/40"
          style={{ scaleX: scrollYProgress }}
        />
        {stops.map((at, i) => (
          <TimelineDot key={i} at={at} progress={scrollYProgress} />
        ))}
      </div>

      <div className={`mt-6 grid gap-4 ${gridClassName}`}>
        {steps.map((s, i) => (
          <LiftOnPass key={s.step} at={stops[i]} progress={scrollYProgress}>
            <StepCard s={s} i={i} />
          </LiftOnPass>
        ))}
      </div>
    </div>
  );
}

/** A grey dot with a flame core that ignites (fades and swells in, with a glow) as the line reaches it. */
function TimelineDot({ at, progress }: { at: number; progress: MotionValue<number> }) {
  const lit = useTransform(progress, [at - 0.04, at], [0, 1]);
  const scale = useTransform(progress, [at - 0.04, at], [0.4, 1]);
  return (
    <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at * 100}%` }}>
      <span className="absolute inset-0 rounded-full bg-mut-3" />
      <motion.span
        data-reveal=""
        data-timeline-dot=""
        className="absolute inset-0 rounded-full bg-flame shadow-[0_0_14px_3px_rgba(250,110,67,0.6)]"
        style={{ opacity: lit, scale }}
      />
    </span>
  );
}

/** Lifts a step card, and lights a soft glow under it, once the timeline passes its dot. */
function LiftOnPass({ at, progress, children }: { at: number; progress: MotionValue<number>; children: ReactNode }) {
  const y = useTransform(progress, [at - 0.06, at], [0, -10]);
  const glow = useTransform(progress, [at - 0.06, at], [0, 1]);
  return (
    <motion.div data-reveal="" className="relative h-full" style={{ y }}>
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl shadow-[0_26px_60px_-30px_rgba(250,110,67,0.7)]" style={{ opacity: glow }} />
      {children}
    </motion.div>
  );
}
```

(`data-reveal` gives the line, the lit dots and the card wrappers their drawn/rest end state in the no-JS and reduced-motion profiles; the old `data-line`/`data-dot` rules stay in the shared CSS, unused and harmless.)

- [ ] **Step 6: Add the Services rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Services (Services.tsx): as a column opens, an orange panel wipes off its image while the image settles. */
.fx-reveal-wipe { position: absolute; inset: 0; background: #fa6e43; pointer-events: none; transform: scaleX(0); transform-origin: right; }
html[data-fx-motion] [data-active="false"] .fx-reveal-wipe { transform: scaleX(1); }
html[data-fx-motion] [data-active="true"] .fx-reveal-wipe { transition: transform 0.8s var(--fx-ease-io) 0.12s; }
html[data-fx-motion] .fx-reveal-img { transition: scale 1.2s var(--fx-ease) 0.12s; }
html[data-fx-motion] [data-active="false"] .fx-reveal-img { scale: 1.12; }
```

- [ ] **Step 7: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 8: Rebuild and watch the checks pass**

Rebuild through `wt.sh`, then fx-checks through `wt.sh`.
Expected: PASS, including the Services and Process lines.

- [ ] **Step 9: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass. The hidden-text gate on `/`, `/approach/` and every service page sees the drawn timeline, and the 320 px sweep passes with the single-column cards.

- [ ] **Step 10: Real-GPU check (controller)**

1. Our Services: move across the columns. As each opens, an orange panel slides off its image from left to right while the image settles from a slight zoom; nothing jumps when the pointer leaves.
2. Move over the core panel's dot matrix: a ring of swelling dots spreads out from the pointer cell; the background pulse continues.
3. Our Process: scroll slowly down and up. The orange line draws and retracts locked to the scroll; each dot ignites with a glow the moment the line reaches it; the matching card lifts about 10 px with a warm glow under it.
4. Repeat on `/approach/` and a service page.
Sick = the scrub feels mechanically locked to the wheel, and the ignition is crisp, not mushy.

- [ ] **Step 11: Commit**

```bash
git add src/components/DotField.tsx src/components/sections/Services.tsx src/components/sections/Process.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): Services sweep and ripple, scrubbed Process timeline" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: What We Measure — chart draws and a velocity-driven ticker

**Files:**
- Create: `src/components/fx/useTickerVelocity.ts`
- Modify: `src/components/sections/Analytics.tsx` (full rewrite below)
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

The bars and counters already animate; this adds the donut drawing its segments in turn, the dial hands sweeping into place, and a ticker whose speed and skew follow scroll velocity. The throughput line keeps its existing left-to-right clip draw. The ticker keeps WCAG 2.2.2: hovering or focusing it still pauses the CSS loop. A new FX rule makes the pause work through the extra skew wrapper, and the hook drops the skew to zero while paused. The velocity loop listens only while the ticker is on screen and stops itself at rest.

- [ ] **Step 1: Write the failing check**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("What We Measure draws in, and the ticker follows the scroll but stops on hover and focus", async (page) => {
  await jumpTo(page, (await sectionTop(page, "analytics")) + 300);
  await page.waitForTimeout(1800);
  const drawn = await page.evaluate(() => ({
    donut: document.querySelector("#analytics .fx-donut")?.hasAttribute("data-in") ?? false,
    dials: document.querySelector("#analytics .fx-dial")?.hasAttribute("data-in") ?? false,
    dash: getComputedStyle(document.querySelector("#analytics .fx-donut circle") ?? document.body).strokeDasharray,
  }));
  assert.ok(drawn.donut && drawn.dials, "desktop: the donut and the dials start drawing in view");
  assert.match(drawn.dash, /^62(px)?,?\s+38/, `desktop: the first donut segment is fully drawn (${drawn.dash})`);
  const box = page.locator('#analytics [role="marquee"]');
  await box.scrollIntoViewIfNeeded();
  await page.mouse.move(6, 300);
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(150);
  const ticker = () => box.evaluate((el) => {
    const marquee = el.querySelector(".marquee-track").getAnimations()[0];
    return { rate: marquee?.playbackRate, state: marquee?.playState, skew: el.querySelector(".fx-ticker-skew").style.transform };
  });
  const moving = await ticker();
  assert.ok(moving.rate > 1.05, `desktop: the ticker speeds up with the scroll (rate ${moving.rate})`);
  assert.match(moving.skew, /^skewX\(/, "desktop: the ticker leans with the scroll");
  await page.waitForTimeout(2400);
  const rest = await ticker();
  assert.deepEqual({ rate: rest.rate, skew: rest.skew }, { rate: 1, skew: "" }, "desktop: the ticker settles back at rest");
  await box.focus();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(150);
  const focused = await ticker();
  assert.deepEqual({ state: focused.state, skew: focused.skew }, { state: "paused", skew: "" }, "desktop: focus stops the ticker even while the page scrolls (WCAG 2.2.2)");
  await box.hover();
  await page.waitForTimeout(150);
  assert.equal((await ticker()).state, "paused", "desktop: hovering stops the ticker");
});
```

- [ ] **Step 2: Watch it fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `desktop: the donut and the dials start drawing in view`.

- [ ] **Step 3: Write `src/components/fx/useTickerVelocity.ts`**

```ts
"use client";

import { useEffect, type RefObject } from "react";
import { useFx } from "./env";
import { createIdleLoop } from "./idle-loop";
import { damp, tickerFromVelocity } from "./math";

type TickerRefs = {
  box: RefObject<HTMLElement | null>;
  skew: RefObject<HTMLElement | null>;
  track: RefObject<HTMLElement | null>;
};

/**
 * Scroll velocity drives the capability ticker on fine-pointer desktops: it speeds up and leans while the page
 * moves and settles back at rest. It listens only while the ticker is on screen, and hovering or focusing the
 * ticker still stops it dead (WCAG 2.2.2): the CSS pause wins and the skew drops to zero.
 */
export function useTickerVelocity({ box, skew, track }: TickerRefs) {
  const fx = useFx();
  useEffect(() => {
    const boxEl = box.current;
    const skewEl = skew.current;
    const trackEl = track.current;
    if (!fx || !boxEl || !skewEl || !trackEl) return;
    const marquee = trackEl.getAnimations()[0];
    let target = 0;
    let current = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    const apply = (velocity: number) => {
      const paused = boxEl.matches(":hover, :focus-within");
      const { rate, skew: degrees } = tickerFromVelocity(paused ? 0 : velocity);
      if (marquee) marquee.playbackRate = rate;
      skewEl.style.transform = degrees ? `skewX(${degrees.toFixed(2)}deg)` : "";
    };
    const loop = createIdleLoop((_, dt) => {
      const seconds = dt / 1000;
      target = damp(target, 0, 5, seconds);
      current = damp(current, target, 10, seconds);
      const busy = Math.abs(current) > 4 || Math.abs(target) > 4;
      if (!busy) current = target = 0;
      apply(current);
      return busy;
    });
    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      target = (y - lastY) / (Math.max(1, now - lastT) / 1000);
      lastY = y;
      lastT = now;
      loop.start();
    };
    const reset = () => {
      loop.stop();
      current = target = 0;
      apply(0);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        lastY = window.scrollY;
        lastT = performance.now();
        window.addEventListener("scroll", onScroll, { passive: true });
      } else {
        window.removeEventListener("scroll", onScroll);
        reset();
      }
    });
    observer.observe(boxEl);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      reset();
    };
  }, [fx, box, skew, track]);
}
```

- [ ] **Step 4: Rewrite `src/components/sections/Analytics.tsx`**

```tsx
"use client";

import { useId, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import Reveal from "@/components/Reveal";
import { FillBar, FillColumn } from "@/components/motion";
import { Container, SectionHeader } from "@/components/ui";
import Tilt from "@/components/fx/Tilt";
import { useInViewFlag } from "@/components/fx/useInViewFlag";
import { useTickerVelocity } from "@/components/fx/useTickerVelocity";
import { MEASURE, SECTIONS } from "@/lib/content";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Clock dial. The hands are drawn at 12 o'clock and turned into place by CSS (globals.css, FX block) so they
 *  can sweep in when the card enters; the SVG transform keeps them right even without that CSS. */
function Dial({ h, m, index }: { h: number; m: number; index: number }) {
  return (
    <svg viewBox="0 0 100 100" className="h-14 w-14" aria-hidden>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#2a2b2e" strokeWidth="2" />
      <g className="fx-hand" transform={`rotate(${h} 50 50)`} style={{ "--a": `${h}deg`, "--d": index * 0.12 } as CSSProperties}>
        <line x1="50" y1="50" x2="50" y2="24" stroke="#e3dbd8" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="fx-hand" transform={`rotate(${m} 50 50)`} style={{ "--a": `${m}deg`, "--d": index * 0.12 + 0.08 } as CSSProperties}>
        <line x1="50" y1="50" x2="50" y2="12" stroke="#fa6e43" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="3" fill="#fa6e43" />
    </svg>
  );
}

/** The workflow donut as SVG ring segments (the same 112 px ring the conic gradient drew), so each segment
 *  can draw itself in turn when the card enters (globals.css, FX block). */
function Donut() {
  const w = MEASURE.workflow;
  const ref = useRef<HTMLDivElement>(null);
  useInViewFlag(ref, { amount: 0.6 });
  const starts = w.segments.map((_, i) => w.segments.slice(0, i).reduce((total, s) => total + s.value, 0));
  return (
    <div ref={ref} className="fx-donut relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90" aria-hidden>
        {w.segments.map((s, i) => (
          <circle
            key={s.label}
            cx="56"
            cy="56"
            r="49.5"
            fill="none"
            stroke={s.color}
            strokeWidth="13"
            pathLength={100}
            strokeDasharray={`${s.value} ${100 - s.value}`}
            strokeDashoffset={-starts[i]}
            style={{ "--i": i } as CSSProperties}
          />
        ))}
      </svg>
      <div className="absolute inset-[13px] grid place-items-center rounded-full bg-card">
        <span className="display text-xl text-ink-strong">{w.center}</span>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Tilt spotlight max={3} className={`rounded-2xl border border-line bg-card/55 p-6 ${className}`}>
      {children}
    </Tilt>
  );
}

export default function Analytics() {
  const uid = useId().replace(/:/g, "");
  const w = MEASURE.workflow;
  const [assisted, manual] = MEASURE.throughput.legend;
  const dials = useRef<HTMLDivElement>(null);
  const ticker = useRef<HTMLDivElement>(null);
  const skew = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useInViewFlag(dials, { amount: 0.5 });
  useTickerVelocity({ box: ticker, skew, track });

  return (
    <section id="analytics" className="relative scroll-mt-2 py-24">
      <Container>
        <SectionHeader {...SECTIONS.analytics} />

        {/* top row */}
        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_0.85fr_1.15fr]">
          <Reveal as="div">
            <Tilt spotlight max={3} className="h-full rounded-2xl">
              <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MEASURE.imageCard.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e] via-[#0b0c0e]/30 to-transparent" />
                <span className="absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                  <span className="text-flame">{MEASURE.imageCard.accent}</span> {MEASURE.imageCard.label}
                </span>
                <span className="absolute bottom-5 left-5 text-[15px] font-medium text-flame">
                  space<span className="text-ink">—</span>gear
                </span>
              </div>
            </Tilt>
          </Reveal>

          <Reveal as="div" delay={60}>
            <Card className="h-full">
              <h3 className="text-[14px] font-medium text-ink">{w.title}</h3>
              <p className="text-[12px] text-mut-2">{w.sub}</p>
              <div className="mt-5 flex items-center gap-5">
                <Donut />
                <div className="flex-1 space-y-2.5">
                  {w.segments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-[12px]">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="flex-1 text-mut">{s.label}</span>
                      <span className="text-ink">{s.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal as="div" delay={120}>
            <Card className="h-full">
              <div ref={dials} className="fx-dial grid grid-cols-3 gap-3">
                {MEASURE.stages.map((c, i) => (
                  <div key={c.name} className="flex flex-col items-center text-center">
                    <span className="text-[12px] text-ink">{c.name}</span>
                    <span className="font-mono text-[10px] text-mut-3">{c.note}</span>
                    <div className="my-2"><Dial h={c.hands[0]} m={c.hands[1]} index={i} /></div>
                    <span className="text-[11px] text-flame">{c.status}</span>
                    <span className="font-mono text-[10px] text-mut-2">{c.detail}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 border-t border-line-soft pt-3">
                <span className="h-1.5 w-1.5 rounded-full bg-flame pulse-dot" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-2">{MEASURE.stagesFooter}</span>
              </div>
            </Card>
          </Reveal>
        </div>

        {/* bottom row */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1.2fr_0.7fr]">
          <Reveal as="div">
            <Card className="flex h-full flex-col">
              <div className="flex flex-1 items-end gap-1.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <FillColumn key={i} value={35 + ((i * 37) % 60)} className="flex-1 rounded-sm bg-flame/80" duration={0.6} delay={i * 0.03} />
                ))}
              </div>
              <p className="mt-4 text-[12px] text-mut-2">{MEASURE.accuracy.label}</p>
              <p className="display mt-1 text-3xl text-ink-strong">
                {MEASURE.accuracy.value}<span className="text-base text-mut-2">{MEASURE.accuracy.unit}</span>
              </p>
              <p className="text-[12px] text-mut-2">{MEASURE.accuracy.sub}</p>
            </Card>
          </Reveal>

          <Reveal as="div" delay={60}>
            <Card className="flex h-full flex-col">
              <h3 className="text-[14px] font-medium text-ink">{MEASURE.throughput.title}</h3>
              <p className="text-[12px] text-mut-2">{MEASURE.throughput.sub}</p>
              <svg viewBox="0 0 200 90" preserveAspectRatio="none" className="mt-3 h-24 w-full" aria-hidden>
                <defs>
                  <linearGradient id={`perfFill${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fa6e43" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#fa6e43" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id={`perfClip${uid}`}>
                    <motion.rect
                      data-fill-svg=""
                      x="0"
                      y="0"
                      height="90"
                      initial={{ width: 0 }}
                      whileInView={{ width: 200 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, ease: EASE }}
                    />
                  </clipPath>
                </defs>
                <g clipPath={`url(#perfClip${uid})`}>
                  <polygon fill={`url(#perfFill${uid})`} points="0,70 33,55 66,60 100,38 133,42 166,18 200,8 200,90 0,90" />
                  <polyline fill="none" stroke="#5f5f66" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points="0,78 33,72 66,66 100,60 133,55 166,46 200,40" />
                  <polyline fill="none" stroke="#fa6e43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points="0,70 33,55 66,60 100,38 133,42 166,18 200,8" />
                </g>
              </svg>
              <div className="mt-auto flex gap-6 pt-3 text-[12px]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-flame" /> <span className="text-ink">{assisted.value}</span> <span className="text-mut-2">{assisted.label}</span></span>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mut-3" /> <span className="text-ink">{manual.value}</span> <span className="text-mut-2">{manual.label}</span></span>
              </div>
            </Card>
          </Reveal>

          <Reveal as="div" delay={120}>
            <Card className="flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-medium text-ink">{MEASURE.readiness.title}</h3>
                  <p className="text-[12px] text-mut-2">{MEASURE.readiness.sub}</p>
                </div>
                <div className="text-right">
                  <span className="display text-2xl text-flame">{MEASURE.readiness.score}</span>
                  <span className="text-[12px] text-mut-2">/100</span>
                  <p className="text-[10px] text-mut-2">{MEASURE.readiness.scoreLabel}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-1 items-end gap-3">
                {MEASURE.readiness.bars.map((e, i) => (
                  <div key={e.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end rounded-md bg-bg/60">
                      <FillColumn value={e.v} className="w-full rounded-md bg-flame/85" delay={i * 0.08} />
                    </div>
                    <span className="text-[10px] text-ink">{e.v}%</span>
                    <span className="font-mono text-[9px] text-mut-3">{e.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal as="div" delay={180}>
            <div className="flex h-full flex-col gap-4">
              <Card className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-3 lg:block lg:leading-[1.2]">{MEASURE.coverage.tag}</span>
                <p className="display mt-2 text-3xl text-ink-strong">{MEASURE.coverage.value}</p>
                <p className="text-[12px] text-mut-2">{MEASURE.coverage.label}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card-3">
                  <FillBar value={MEASURE.coverage.progress} className="h-full rounded-full bg-flame" duration={1} />
                </div>
              </Card>
              <Card className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-3 lg:block lg:leading-[1.2]">{MEASURE.connectors.tag}</span>
                <div aria-hidden className="mt-3 flex gap-2">
                  {MEASURE.connectors.glyphs.map((g) => (
                    <span key={g} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">{g}</span>
                  ))}
                </div>
              </Card>
            </div>
          </Reveal>
        </div>

        {/* capabilities marquee: focusable so a keyboard or a tap can pause it (globals.css); on fine-pointer
            desktops its speed and skew follow the scroll velocity (useTickerVelocity) */}
        <Reveal delay={120}>
          <div ref={ticker} tabIndex={0} role="marquee" aria-label="Capabilities" className="mt-4 overflow-hidden rounded-2xl border border-line bg-card/40 py-4">
            <div ref={skew} className="fx-ticker-skew">
              <div ref={track} className="marquee-track">
                {[...MEASURE.ticker, ...MEASURE.ticker].map((item, i) => (
                  <span key={i} aria-hidden={i >= MEASURE.ticker.length} className="mx-4 flex items-center gap-3 text-[14px] text-mut-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-flame" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">{MEASURE.cta.label}</span>
            <Link
              prefetch={false}
              href={MEASURE.cta.href}
              aria-label={MEASURE.cta.label}
              className="grid h-10 w-10 place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-1"
            >
              →
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
```

- [ ] **Step 5: Add the What We Measure rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* What We Measure (Analytics.tsx): dial hands sweep into place, donut segments draw in turn. */
.fx-hand { transform-box: view-box; transform-origin: 50px 50px; transform: rotate(var(--a)); }
html[data-fx-motion] .fx-dial .fx-hand { transition: transform 1.3s var(--fx-ease) calc(var(--d, 0) * 1s); }
html[data-fx-motion] .fx-dial:not([data-in]) .fx-hand { transform: rotate(calc(var(--a) - 140deg)); }
html[data-fx-motion] .fx-donut circle { transition: stroke-dasharray 1.1s var(--fx-ease) calc(var(--i, 0) * 0.16s); }
html[data-fx-motion] .fx-donut:not([data-in]) circle { stroke-dasharray: 0 100; }
/* The ticker pauses when its box (or anything in it) is hovered or focused, through the skew wrapper (WCAG 2.2.2). */
[role="marquee"]:is(:hover, :focus, :focus-within) .marquee-track { animation-play-state: paused; }
```

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 7: Rebuild and watch the check pass**

Rebuild through `wt.sh`, then fx-checks through `wt.sh`.
Expected: PASS, including `What We Measure draws in, and the ticker follows the scroll but stops on hover and focus`.

- [ ] **Step 8: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass. The reduced-motion profile still finds no running animations on load (the ticker loop is `animation: none` there), and the no-JS profile sees the full donut and the hands at their final angles.

- [ ] **Step 9: Real-GPU check (controller)**

1. Scroll into What We Measure. The donut's three segments draw clockwise one after another, ending exactly like the old conic ring. The three dials' hands sweep into their positions with a slight stagger. The throughput chart reveals left to right, and the bars grow.
2. Scroll fast past the ticker: it speeds up and leans into the scroll direction, then eases back to its normal pace and upright within about a second of stopping.
3. Hover the ticker, and separately Tab to it: it stops dead and stands upright, even if you keep scrolling with the wheel.
Sick = lively and data-like, and still readable at every moment.

- [ ] **Step 10: Commit**

```bash
git add src/components/fx/useTickerVelocity.ts src/components/sections/Analytics.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): What We Measure chart draws and a velocity-driven ticker" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Engagements and FAQ

**Files:**
- Modify: `src/components/sections/Pricing.tsx` (full rewrite below)
- Modify: `src/components/sections/Faq.tsx`
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

- [ ] **Step 1: Write the failing checks**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("Engagements: rows slide in, the toggle springs and Select pulses once", async (page) => {
  const rows = page.locator("#pricing .fx-rows");
  assert.equal(await rows.count(), 1, "desktop: the engagement rows use the slide-in list");
  assert.equal(await rows.evaluate((el) => el.hasAttribute("data-in")), false, "desktop: the rows wait below the fold");
  await rows.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const shown = await rows.evaluate((el) => ({ in: el.hasAttribute("data-in"), opacity: [...el.children].map((row) => parseFloat(getComputedStyle(row).opacity)) }));
  assert.ok(shown.in && shown.opacity.every((opacity) => opacity > 0.99), `desktop: every row slid in (${shown.opacity.join(", ")})`);
  const toggle = rows.getByRole("switch").first();
  await toggle.click();
  await page.waitForTimeout(700);
  const knob = await toggle.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el.firstElementChild).transform).m41);
  assert.ok(Math.abs(knob - 16) < 1, `desktop: the toggle knob springs across (${knob}px)`);
  await rows.getByRole("button", { name: /^Select/ }).first().click();
  await page.waitForTimeout(100);
  const pulse = rows.locator(".fx-pulse");
  assert.equal(await pulse.count(), 1, "desktop: the selected row pulses");
  assert.equal(await pulse.evaluate((el) => el.getAnimations().length), 1, "desktop: the pulse is animating");
  await page.waitForTimeout(1100);
  assert.equal(await pulse.evaluate((el) => el.getAnimations().length), 0, "desktop: the pulse plays once");
});

desktop("FAQ: the icon spins as it morphs and the photo drifts in its frame", async (page) => {
  const item = page.locator("#faq .faq-accordion details").nth(1);
  await item.scrollIntoViewIfNeeded();
  await item.locator("summary").click();
  await page.waitForTimeout(800);
  const spin = await item.locator("summary > span[aria-hidden]").evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
  assert.ok(spin < -0.99, `desktop: the open icon has turned half a turn (${spin})`);
  const faq = await sectionTop(page, "faq");
  const photo = page.locator("#faq [data-parallax] > *");
  await jumpTo(page, faq - 400);
  await page.waitForTimeout(400);
  const a = (await matrixOf(photo)).m42;
  await jumpTo(page, faq + 150);
  await page.waitForTimeout(400);
  const b = (await matrixOf(photo)).m42;
  assert.ok(Math.abs(b - a) > 3, `desktop: the photo drifts in its frame (${a} → ${b})`);
});
```

- [ ] **Step 2: Watch them fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `desktop: the engagement rows use the slide-in list` (count 0).

- [ ] **Step 3: Rewrite `src/components/sections/Pricing.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import { Container, SectionHeader } from "@/components/ui";
import Tilt from "@/components/fx/Tilt";
import { useInViewFlag } from "@/components/fx/useInViewFlag";
import { ENGAGEMENTS, ENGAGEMENTS_FOOTER, SECTIONS, type Engagement } from "@/lib/content";

/** Original billing toggle, repurposed: switch the list between deliverables and outcomes. The knob moves
 *  on a springy transform (it used to animate `left`). */
function Toggle({ outcomes, onToggle, label }: { outcomes: boolean; onToggle: (v: boolean) => void; label: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-[12px]">
      <span className={outcomes ? "text-mut-2" : "text-ink"}>Deliverables</span>
      <button
        type="button"
        role="switch"
        aria-checked={outcomes}
        aria-label={`Show outcomes instead of deliverables (${label})`}
        onClick={() => onToggle(!outcomes)}
        className="relative h-5 w-9 rounded-full bg-card-3 transition-colors before:absolute before:-inset-1 before:content-['']"
      >
        <motion.span
          initial={false}
          className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-flame"
          animate={{ x: outcomes ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 22, mass: 0.7 }}
        />
      </button>
      <span className={outcomes ? "text-ink" : "text-mut-2"}>Outcomes</span>
    </div>
  );
}

function Cell({ label, children, className = "" }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col justify-center p-6 ${className}`}>
      {label && <span className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{label}</span>}
      {children}
    </div>
  );
}

/** One engagement. When selected, a glow ring pulses out once; `pulseKey` changes on every Select click so
 *  the ring replays even when the same row is chosen again. */
function EngagementRow({ item, selected, pulseKey, onSelect }: { item: Engagement; selected: boolean; pulseKey: number; onSelect: () => void }) {
  const [outcomes, setOutcomes] = useState(false);
  const list = outcomes ? item.outcomes : item.deliverables;
  return (
    <div className="relative">
      {selected && <span key={pulseKey} aria-hidden className="fx-pulse" />}
      <motion.div
        initial={false}
        animate={{
          borderColor: selected ? "#fa6e43" : "#2a2b2e",
          boxShadow: selected ? "0 18px 50px -20px rgba(250,110,67,0.45)" : "0 0 0 0 rgba(0,0,0,0)",
          scale: selected ? 1.01 : 1,
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 overflow-hidden rounded-2xl border bg-card/40 md:grid-cols-2 lg:grid-cols-[220px_1fr_1fr_1.5fr_auto] lg:divide-x lg:divide-line-soft"
      >
        {/* image tile */}
        <div className="relative h-44 overflow-hidden lg:h-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e]/70 to-transparent" />
          <span className="absolute left-5 top-5 text-[15px] font-medium text-ink">{item.short}</span>
          {item.featured && (
            <span className="absolute right-4 top-4 rounded-full bg-flame/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-flame">
              Start here
            </span>
          )}
        </div>

        {/* stage + toggle (the original price cell) */}
        <Cell label="Stage">
          <span className="display text-4xl text-ink">{item.stageNo}</span>
          <Toggle outcomes={outcomes} onToggle={setOutcomes} label={item.short} />
        </Cell>

        {/* engagement + focus stacked (the original plan + seats cells) */}
        <div className="grid grid-rows-2 lg:divide-y lg:divide-line-soft">
          <Cell label="Engagement">
            <span className="text-lg text-ink">{item.name}</span>
          </Cell>
          <Cell label="Focus">
            <span className="display text-2xl text-mut">{item.stage}</span>
          </Cell>
        </div>

        {/* deliverables / outcomes */}
        <Cell label={outcomes ? "Outcomes" : "Deliverables"}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-live="polite">
            {list.map((entry) => (
              <li key={entry} className="flex items-center gap-2 text-[12.5px] text-mut">
                <span aria-hidden className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
                {entry}
              </li>
            ))}
          </ul>
        </Cell>

        {/* select */}
        <Cell>
          <motion.button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            whileTap={{ scale: 0.96 }}
            className={`relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-medium transition-colors duration-300 ${
              selected
                ? "bg-flame text-[#161719]"
                : item.featured
                  ? "bg-flame/90 text-[#161719] hover:bg-flame"
                  : "border border-line text-ink hover:border-flame hover:text-flame"
            }`}
          >
            <motion.span
              key={selected ? "on" : "off"}
              aria-hidden
              initial={selected ? { scale: 0.6, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
            >
              {selected ? "✓" : "→"}
            </motion.span>
            {selected ? "Selected" : "Select"}
            {/* the name follows the visible text; `relative` keeps this span inside the mobile scroller */}
            <span className="sr-only"> {item.short}</span>
          </motion.button>
        </Cell>
      </motion.div>
    </div>
  );
}

export default function Pricing() {
  const [selected, setSelected] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const rows = useRef<HTMLDivElement>(null);
  useInViewFlag(rows, { amount: 0.15 });
  const chosen = ENGAGEMENTS.find((item) => item.name === selected);
  const select = (name: string) => {
    setSelected(name);
    setPulse((count) => count + 1);
  };
  return (
    <section id="pricing" className="relative scroll-mt-2 py-24">
      <Container>
        <SectionHeader {...SECTIONS.pricing} />

        {/* desktop: stacked rows that slide in one after another (globals.css, FX block) */}
        <div ref={rows} className="fx-rows mt-12 hidden space-y-4 lg:block">
          {ENGAGEMENTS.map((item, i) => (
            <div key={item.name} style={{ "--i": i } as CSSProperties}>
              <Tilt spotlight max={1.5} className="rounded-2xl">
                <EngagementRow item={item} selected={selected === item.name} pulseKey={pulse} onSelect={() => select(item.name)} />
              </Tilt>
            </div>
          ))}
        </div>

        {/* mobile: swipeable cards */}
        <SnapRow className="mt-10 lg:hidden" itemClassName="w-[85%]">
          {ENGAGEMENTS.map((item) => (
            <EngagementRow key={item.name} item={item} selected={selected === item.name} pulseKey={pulse} onSelect={() => select(item.name)} />
          ))}
        </SnapRow>

        <div aria-live="polite" role="status">
          {chosen && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center text-[13px] text-flame">
              {chosen.short} selected —{" "}
              <Link prefetch={false} href="/contact/" className="underline underline-offset-4">tell us about your challenge</Link> to get started.
            </motion.p>
          )}
        </div>

        <Reveal delay={120}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">{ENGAGEMENTS_FOOTER.text}</span>
            <Link
              prefetch={false}
              href={ENGAGEMENTS_FOOTER.href}
              aria-label="Discuss a project"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-1"
            >
              →
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
```

- [ ] **Step 4: FAQ icon and photo (`src/components/sections/Faq.tsx`)**

Add after `import Reveal from "@/components/Reveal";`:

```tsx
import Parallax from "@/components/fx/Parallax";
```

Replace the whole `ToggleIcon` function with:

```tsx
const ICON_SPRING = { type: "spring", stiffness: 380, damping: 22 } as const;

/** Two short lines that cross into an X when open, while the whole icon spins half a turn. */
function ToggleIcon({ open }: { open: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="relative grid h-5 w-5 shrink-0 place-items-center"
      animate={{ rotate: open ? 180 : 0 }}
      transition={ICON_SPRING}
    >
      <motion.span
        className="absolute h-[2px] w-4 rounded-full bg-flame"
        animate={{ rotate: open ? 45 : 0, y: open ? 0 : -3 }}
        transition={ICON_SPRING}
      />
      <motion.span
        className="absolute h-[2px] w-4 rounded-full bg-flame"
        animate={{ rotate: open ? -45 : 0, y: open ? 0 : 3 }}
        transition={ICON_SPRING}
      />
    </motion.span>
  );
}
```

In `StillQuestionsCard`, replace

```tsx
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FAQ_CARD.img} alt={FAQ_CARD.imgAlt} loading="lazy" className="h-full w-full object-cover grayscale" />
```

with

```tsx
          <Parallax className="absolute inset-0" distance={18}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FAQ_CARD.img} alt={FAQ_CARD.imgAlt} loading="lazy" className="absolute inset-0 h-full w-full object-cover grayscale" />
          </Parallax>
```

(The frame keeps its `relative h-56 overflow-hidden` box, so the card's height does not change.)

- [ ] **Step 5: Add the Engagements rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Engagements (Pricing.tsx): rows slide in from the right in turn; a selected row pulses a glow ring once. */
html[data-fx-motion] .fx-rows > * { opacity: 0; translate: 80px 0; transition: opacity 0.7s ease-out, translate 1s var(--fx-ease); transition-delay: calc(var(--i, 0) * 120ms); }
html[data-fx-motion] .fx-rows[data-in] > * { opacity: 1; translate: 0 0; }
.fx-pulse { position: absolute; inset: 0; z-index: 2; border: 2px solid #fa6e43; border-radius: 1rem; box-shadow: 0 0 44px 2px rgba(250, 110, 67, 0.45); pointer-events: none; opacity: 0; }
html[data-fx-motion] .fx-pulse { animation: fx-pulse 1s var(--fx-ease) 1; }
@keyframes fx-pulse { 0% { opacity: 1; scale: 1; } 100% { opacity: 0; scale: 1.03; } }
```

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 7: Rebuild and watch the checks pass**

Rebuild through `wt.sh`, then fx-checks through `wt.sh`.
Expected: PASS, including the Engagements and FAQ lines.

- [ ] **Step 8: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass. The hidden-text gate sees the rows at full opacity (no `data-fx-motion` under reduced motion or without JS), the `#pricing` deep link still lands, and the FAQ keyboard toggles still work.

- [ ] **Step 9: Real-GPU check (controller)**

1. Scroll to Engagements: the three rows slide in from the right one after another.
2. Flip a row's Deliverables/Outcomes toggle: the knob springs across with a small overshoot.
3. Click Select: a single orange glow ring pulses out from the row and fades; click another row's Select: it pulses once too.
4. FAQ: opening a question spins the icon half a turn while = morphs into ×; closing spins it back.
5. The "You still have questions?" photo drifts gently within its frame as you scroll toward it.
Sick = playful and springy, never sluggish.

- [ ] **Step 10: Commit**

```bash
git add src/components/sections/Pricing.tsx src/components/sections/Faq.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): Engagements slide-in, spring toggle and pulse; FAQ icon spin and photo drift" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Footer wordmark — letters rise as the curtain opens and lean away from the cursor

**Files:**
- Create: `src/components/sections/FooterWordmark.tsx`
- Modify: `src/components/sections/Footer.tsx`
- Modify: `src/app/globals.css` (FX block)
- Modify: `scripts/fx-checks.mjs`

The footer is fixed behind the content (CurtainShell), so an IntersectionObserver would report it as always visible. The rise therefore follows `curtainReveal()`: it fires once 45% of the footer is uncovered and resets below 5%, so it replays each time the curtain opens. The letters exist only for `useFx()`. Everywhere else, and for assistive technology through an `sr-only` copy, the wordmark is the plain `space—gear`.

- [ ] **Step 1: Write the failing check**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("the footer wordmark rises as the curtain opens and leans away from the pointer", async (page) => {
  const before = await page.evaluate(() => {
    const mark = document.querySelector(".fx-wordmark");
    return { letters: mark?.querySelectorAll("[data-letter]").length ?? 0, risen: mark?.hasAttribute("data-in") ?? null, name: mark?.querySelector(".sr-only")?.textContent ?? null };
  });
  assert.deepEqual(before, { letters: 10, risen: false, name: "space—gear" }, "desktop: the split wordmark waits behind the curtain with its full name");
  await jumpTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.waitForTimeout(1600);
  assert.equal(await page.evaluate(() => document.querySelector(".fx-wordmark").hasAttribute("data-in")), true, "desktop: the letters rise when the curtain opens");
  const letter = page.locator(".fx-wordmark [data-letter]").nth(2);
  const box = await letter.boundingBox();
  await page.mouse.move(box.x - 60, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2, { steps: 5 });
  await page.waitForTimeout(700);
  const pushed = (await matrixOf(letter)).m41;
  assert.ok(pushed > 1, `desktop: a letter right of the pointer leans right (${pushed}px)`);
});
```

- [ ] **Step 2: Watch it fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `desktop: the split wordmark waits behind the curtain with its full name` (`letters: 0`).

- [ ] **Step 3: Write `src/components/sections/FooterWordmark.tsx`**

```tsx
"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useFx } from "@/components/fx/env";
import { curtainReveal, repelOffset } from "@/components/fx/math";

const NAME = "space—gear";
const PARTS = [
  { text: "space", className: "" },
  { text: "—", className: "text-ink" },
  { text: "gear", className: "" },
];
const OFFSETS = PARTS.map((_, i) => PARTS.slice(0, i).reduce((total, part) => total + Array.from(part.text).length, 0));

/**
 * The footer's giant wordmark. On fine-pointer desktops its letters rise in sequence as the curtain uncovers
 * the footer, and lean away from a nearby pointer. Everywhere else, and for assistive technology, it is the
 * plain wordmark.
 */
export default function FooterWordmark() {
  const ref = useRef<HTMLParagraphElement>(null);
  const fx = useFx();

  useEffect(() => {
    const el = ref.current;
    const footer = el?.closest("footer");
    if (!fx || !el || !footer) return;
    let frame = 0;
    let pointerFrame = 0;
    let px = 0;
    let py = 0;
    let letters: { node: HTMLElement; x: number; y: number }[] = [];
    const measure = () => {
      letters = [...el.querySelectorAll<HTMLElement>("[data-letter]")].map((node) => {
        const r = node.getBoundingClientRect();
        // The resting centre: take the current lean back out.
        const rx = parseFloat(node.style.getPropertyValue("--rx")) || 0;
        const ry = parseFloat(node.style.getPropertyValue("--ry")) || 0;
        return { node, x: r.left + r.width / 2 - rx, y: r.top + r.height / 2 - ry };
      });
    };
    const reveal = () => {
      frame = 0;
      letters = [];
      const uncovered = curtainReveal(window.scrollY, window.innerHeight, document.documentElement.scrollHeight, footer.offsetHeight);
      if (uncovered > 0.45) el.setAttribute("data-in", "");
      else if (uncovered < 0.05) el.removeAttribute("data-in");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(reveal);
    };
    const lean = () => {
      pointerFrame = 0;
      if (!letters.length) measure();
      for (const letter of letters) {
        const offset = repelOffset(px - letter.x, py - letter.y, 150, 18);
        letter.node.style.setProperty("--rx", `${offset.x.toFixed(2)}px`);
        letter.node.style.setProperty("--ry", `${offset.y.toFixed(2)}px`);
      }
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") measure();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      px = event.clientX;
      py = event.clientY;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(lean);
    };
    const leave = () => {
      for (const node of el.querySelectorAll<HTMLElement>("[data-letter]")) {
        node.style.removeProperty("--rx");
        node.style.removeProperty("--ry");
      }
    };
    reveal();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    footer.addEventListener("pointerenter", enter);
    footer.addEventListener("pointermove", move);
    footer.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pointerFrame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      footer.removeEventListener("pointerenter", enter);
      footer.removeEventListener("pointermove", move);
      footer.removeEventListener("pointerleave", leave);
      leave();
      el.removeAttribute("data-in");
    };
  }, [fx]);

  return (
    <p ref={ref} className="fx-wordmark display text-[clamp(36px,10vw,104px)] leading-[0.85] lg:text-[clamp(40px,8vw,104px)] text-flame">
      {fx ? (
        <>
          <span className="sr-only">{NAME}</span>
          <span aria-hidden>
            {PARTS.map((part, p) => (
              <span key={p} className={part.className}>
                {Array.from(part.text).map((char, i) => (
                  <span key={i} data-letter="" className="fx-letter" style={{ "--i": OFFSETS[p] + i } as CSSProperties}>
                    {char}
                  </span>
                ))}
              </span>
            ))}
          </span>
        </>
      ) : (
        <>
          space<span className="text-ink">—</span>gear
        </>
      )}
      <sup aria-hidden className="ml-1 align-top text-base text-mut-3">™</sup>
    </p>
  );
}
```

- [ ] **Step 4: Use it in `src/components/sections/Footer.tsx`**

Add after `import QuickStart from "@/components/QuickStart";`:

```tsx
import FooterWordmark from "./FooterWordmark";
```

Replace

```tsx
              <p className="display text-[clamp(36px,10vw,104px)] leading-[0.85] lg:text-[clamp(40px,8vw,104px)] text-flame">
                space<span className="text-ink">—</span>gear
                <sup aria-hidden className="ml-1 align-top text-base text-mut-3">™</sup>
              </p>
```

with

```tsx
              <FooterWordmark />
```

(Keep the comment above it about the wordmark size.)

- [ ] **Step 5: Add the wordmark rules to the FX block**

In `src/app/globals.css`, immediately above `/* === /FX === */`:

```css
/* Footer wordmark (FooterWordmark.tsx): letters rise in sequence as the curtain opens (translate, staggered)
   and lean away from the pointer (transform, from --rx/--ry). */
.fx-letter { display: inline-block; transform: translate(var(--rx, 0px), var(--ry, 0px)); transition: transform 0.45s var(--fx-ease), translate 1s var(--fx-ease) calc(var(--i, 0) * 55ms), opacity 0.7s ease-out calc(var(--i, 0) * 55ms); }
html[data-fx] .fx-wordmark:not([data-in]) .fx-letter { translate: 0 0.55em; opacity: 0; }
```

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 7: Rebuild and watch the check pass**

Rebuild through `wt.sh`, then fx-checks through `wt.sh`.
Expected: PASS, including `the footer wordmark rises as the curtain opens and leans away from the pointer`.

- [ ] **Step 8: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass. In particular, the quick-start flows still fill and submit from the footer, and the export check finds no old-identity strings (the wordmark text is unchanged).

- [ ] **Step 9: Real-GPU check (controller)**

1. Scroll to the very bottom: as the content lifts off the footer, "space—gear" rises letter by letter from just below its line.
2. Scroll back up and down again: it sinks back once the footer is covered and rises again.
3. Sweep the pointer across the wordmark: letters near it lean away (up to ~18 px) with a soft spring and settle back when the pointer leaves the footer.
4. The ™ stays put, and the layout of the identity text below does not move.
Sick = a finale, like the brand taking a bow.

- [ ] **Step 10: Commit**

```bash
git add src/components/sections/FooterWordmark.tsx src/components/sections/Footer.tsx src/app/globals.css scripts/fx-checks.mjs
git commit -m "feat(fx): footer wordmark rises with the curtain and repels the cursor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Hero integration

**Files:**
- Modify: `src/components/sections/OrbitalCinematic.tsx` (Magnetic CTA only)
- Modify (only if Part 1 did not do it): the globe wrapper element, `data-cursor="Drag"`
- Modify (only if Part 1's intro locks scrolling): the intro component, `setScrollLock`
- Modify (only if it screenshots with effects on): `scripts/capture-hero-poster.mjs`
- Modify: `scripts/fx-checks.mjs`

Part 1 rewrote the hero and the globe. **Re-read them before changing anything:** `git log --oneline -25`, then read `src/components/sections/OrbitalCinematic.tsx`, `src/components/EarthScene.tsx` and every new file Part 1 added (`git diff --stat b83d904..HEAD -- src scripts`). Change only what this task lists.

Contracts this task relies on:
- Part 1 puts `data-cursor="Drag"` on the element that receives the globe drag (desktop only). The cursor reads the nearest `[data-cursor]`.
- The primary hero CTA renders `HOME.cta` (`label: "Discuss a project"`, `href: "/contact/"`).
- The hero scroll beats read native scroll position (Lenis scrolls the window, so `scroll` events, `getBoundingClientRect` and `useScroll` keep working), and keyboard focus inside the faded copy scrolls back with `window.scrollTo({ behavior: "instant" })`. SmoothScroll ends any glide on `focusin` first.

- [ ] **Step 1: Write the failing checks**

In `scripts/fx-checks.mjs`, immediately above `// --- Run alone ---`:

```js
desktop("the hero CTA is magnetic and the globe asks to be dragged", async (page) => {
  const cta = page.locator("#home [data-magnetic]").first();
  assert.equal(await cta.count(), 1, "desktop: the hero CTA is magnetic");
  const box = await cta.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2, { steps: 5 });
  await page.waitForTimeout(600);
  assert.ok((await matrixOf(cta)).m41 > 1, "desktop: the hero CTA leans toward the pointer");
  const globe = page.locator('#home [data-cursor="Drag"]');
  assert.ok(await globe.count() >= 1, "desktop: the globe wrapper carries data-cursor=Drag");
  const area = await globe.first().boundingBox();
  await page.mouse.move(area.x + area.width * 0.72, area.y + area.height * 0.5, { steps: 6 });
  await page.waitForTimeout(300);
  const cursor = await page.evaluate(() => {
    const root = document.querySelector("[data-fx-cursor-root]");
    return { state: root.dataset.state, label: root.querySelector(".fx-cursor-label").textContent };
  });
  assert.deepEqual(cursor, { state: "label", label: "Drag" }, "desktop: the cursor reads Drag over the globe");
});

desktop("Lenis glides through the hero's scroll beats", async (page) => {
  await page.mouse.move(6, 500);
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("lenis-smooth")), true, "desktop: the hero scroll glides");
  await page.waitForTimeout(1600);
  const hero = await page.evaluate(() => {
    const link = document.querySelector('#home a[href="/services/applied-ai/"]');
    let opacity = 1;
    for (let node = link; node; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity);
    return { y: window.scrollY, copyOpacity: opacity };
  });
  assert.ok(hero.y > 600, `desktop: the glide moved through the hero (${hero.y}px)`);
  assert.ok(hero.copyOpacity < 0.5, `desktop: the hero beat advanced with the glide (copy opacity ${hero.copyOpacity})`);
});
```

If Part 1 changed the hero's corner link, use the same selector that `scripts/browser-check.mjs`'s hero-focus check now uses instead of `#home a[href="/services/applied-ai/"]`.

- [ ] **Step 2: Watch them fail**

Run fx-checks through `wt.sh`.
Expected: FAIL — `desktop: the hero CTA is magnetic` (count 0).

- [ ] **Step 3: Make the hero CTA magnetic**

In `src/components/sections/OrbitalCinematic.tsx`, add:

```tsx
import { Magnetic } from "@/components/fx/Magnetic";
```

Wrap the element that renders `HOME.cta` in `Magnetic`. If it still reads as before Part 1, replace

```tsx
        <Link
          prefetch={false}
          href={HOME.cta.href}
          className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-xl bg-flame px-5 py-3 text-[13px] font-medium text-[#161719] transition-all hover:brightness-110 hover:shadow-[0_10px_30px_-8px_rgba(250,110,67,0.6)]"
        >
```

…through its closing `</Link>` with

```tsx
        <Magnetic className="pointer-events-auto w-fit">
          <Link
            prefetch={false}
            href={HOME.cta.href}
            className="fx-sweep pointer-events-auto inline-flex w-fit items-center gap-2 rounded-xl bg-flame px-5 py-3 text-[13px] font-medium text-[#161719] transition-[filter,box-shadow] hover:brightness-110 hover:shadow-[0_10px_30px_-8px_rgba(250,110,67,0.6)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2 6.5h12M5.5 2v2M10.5 2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {HOME.cta.label}
          </Link>
        </Magnetic>
```

If Part 1 restructured the copy (for example a mask wrapper per line), keep its markup and put `<Magnetic className="pointer-events-auto w-fit">` directly around the CTA `Link`, adding `fx-sweep` to the link's classes. Do not move the CTA out of Part 1's reveal wrapper.

- [ ] **Step 4: Verify the globe's cursor contract**

Run: `grep -rn 'data-cursor="Drag"' src/components`
Expected: a hit in Part 1's globe or hero code. If there is none, add `data-cursor="Drag"` to the element that has the globe's pointer-drag handlers (the `.hero-scene` wrapper if the handlers live on the canvas inside it). Change nothing else in the globe.

- [ ] **Step 5: Pause Lenis during the intro, if the intro locks scrolling**

Run: `grep -rn "overflow" src/components/sections/OrbitalCinematic.tsx src/components/*Intro* src/components/sections/*Intro* 2>/dev/null`
- If the intro sets `overflow: hidden` (or similar) on `<html>`/`<body>` while it plays: import `setScrollLock` from `@/components/fx/scroll-lock`, call `setScrollLock(true)` where the lock is applied and `setScrollLock(false)` where it is released (including the cap/skip path and the effect cleanup).
- If the intro never locks scrolling, change nothing.

- [ ] **Step 6: Keep the effects out of the hero poster**

Read `scripts/capture-hero-poster.mjs`. If it screenshots the page in a default (fine-pointer) desktop context, add this line immediately before its `page.screenshot(` call:

```js
  await page.addStyleTag({ content: "[data-fx-grain],[data-fx-cursor-root],[data-fx-rail]{display:none!important}" });
```

Do not re-capture the poster in this task.

- [ ] **Step 7: Fast gates**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all exit 0.

- [ ] **Step 8: Rebuild and watch the checks pass**

Rebuild through `wt.sh`, then fx-checks through `wt.sh`.
Expected: PASS, including both hero lines.

- [ ] **Step 9: Heavy gates**

`check:seo` then `test:browser` through `wt.sh`. Expected: both pass, including Part 1's globe/intro assertions, the hero focus scroll-to-top, the `#pricing` deep link and the rAF budget.

- [ ] **Step 10: Real-GPU check (controller)**

1. On the hero, the "Discuss a project" CTA leans toward the pointer, its fill sweeps on hover, and it springs back on leave.
2. Over the globe the cursor becomes an orange "DRAG" disc; dragging spins the globe with inertia (Part 1), and the page does not scroll while dragging.
3. Wheel through the 300vh: globe right → shrink to centre with the statement filling word by word → the curtain slides over. All of it glides with Lenis, with no snapping between beats, and the sun sweep/dolly (Part 1) stay in sync with the glide.
4. Reload in a fresh tab: the intro plays and the wheel does nothing until it ends (if Part 1 locks scrolling), then glides.
5. Tab into the hero copy mid-scroll: it jumps back to the opening frame.
Sick = the hero feels like scrubbing a film reel, with the cursor inviting you to touch the planet.

- [ ] **Step 11: Commit**

Commit only the files you changed in Steps 3–6, for example:

```bash
git add src/components/sections/OrbitalCinematic.tsx scripts/fx-checks.mjs
git commit -m "feat(fx): magnetic hero CTA, globe drag cursor and Lenis through the hero beats" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Final gates, fidelity and docs

**Files:**
- Modify: `README.md` (new "Motion system" section)
- Modify: `docs/superpowers/plans/2026-10-21-showcase-part2-motion.md` (execution record)

- [ ] **Step 1: Guardrail sweep**

Run:

```bash
grep -rn "useReducedMotion" src --include=*.tsx
grep -rn "requestAnimationFrame" src/components/fx src/components/sections/FooterWordmark.tsx
grep -n "=== FX ===\|=== /FX ===" src/app/globals.css
grep -n "=== FX ===" scripts/browser-check.mjs
```

Expected:
- `useReducedMotion` only appears where it already did (`MotionProvider.tsx`, `Process.tsx` `CountUp`, Part 1's files), and never decides markup.
- `requestAnimationFrame` appears only in `idle-loop.ts`, `Spotlight.tsx` and `FooterWordmark.tsx`, always once per pointer or scroll event.
- `globals.css` has exactly one opening and one closing FX marker, at the end of the file.
- `browser-check.mjs` has five `// === FX ===` hooks.

- [ ] **Step 2: Full gates**

Run, in order:
1. `npm run lint && npm run typecheck && npm test` (expect exit 0).
2. `bash "$WT" "E:/Personal/clone website/spacegear" 8787 rebuild` (expect `preview up on :8787`).
3. `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run node scripts/fx-checks.mjs http://127.0.0.1:8787` (expect `FX checks passed: …`).
4. `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run npm run check:seo -- http://127.0.0.1:8787` (expect `SEO crawl passed: …`).
5. `bash "$WT" "E:/Personal/clone website/spacegear" 8787 run npm run test:browser -- http://127.0.0.1:8787` (expect `Browser checks passed: 6 profiles; …`).

Open `artifacts/browser-report.json` and copy the desktop profile's `cls`, `longTasks` and `jsBytes` into the execution record (Step 5).

- [ ] **Step 3: Fidelity (only when the controller allows the reference server)**

Ask the controller. If allowed:

```bash
# In a separate terminal, from the read-only original (never edit it):
cd "/e/Personal/clone website/platform-clone" && npx next start -p 3101 -H 127.0.0.1
# Then, under the lock:
bash "$WT" "E:/Personal/clone website/spacegear" 8787 run npm run check:fidelity -- http://127.0.0.1:3101 http://127.0.0.1:8787
```

Expected: every section within tolerance with no new tolerance. No effect in this plan adds height: ScrollDepth and Parallax are transforms, the split mask cancels its padding, and the donut keeps its 112 px box. The desktop sheets will show the progress rail at the right edge and a faint grain; both are intended. Stop the reference server afterwards (only that process). If the controller does not allow it, record "check:fidelity not run" and why.

- [ ] **Step 4: README — add a "Motion system" section**

In `README.md`, insert after the `## Verification` section (before `## Content and release`):

```md
## Motion system

Effects live in `src/components/fx/`: Motion plus Lenis 1.3.26 (no GSAP).

- **Who gets what.** Heavy effects (smooth scroll, cursor, magnetic buttons, tilt and spotlight, split titles, the home progress rail, grain, the footer letters) run only after hydration on `(hover: hover) and (pointer: fine)` at ≥1024 px with motion allowed (`useFx()`, `html[data-fx]`). Reveals and scroll draws run wherever motion is allowed (`html[data-fx-motion]`). Without JavaScript or under reduced motion, everything shows its end state.
- **Rules.** Markup branches only on `useFx()` / `useMotionOK()` (false on the server and during hydration), never on `useReducedMotion()`. Effects animate transform and opacity (SVG draws animate stroke dashes). An idle page requests no animation frames.
- **Cursor labels.** Add `data-cursor="View"` (or `Drag`, `Open`) to an element to show that label in the custom cursor.
- **Scroll locks.** Set `data-scroll-lock` on `<html>` (`setScrollLock()` in `src/components/fx/scroll-lock.ts`) to pause smooth scrolling.
- **Page transitions.** `experimental.viewTransition` plus React `<ViewTransition>` (`src/app/template.tsx`, `src/components/fx/PageTransition.tsx`): an orange curtain, instant where unsupported or under reduced motion.
- **Checks.** `scripts/fx-checks.mjs` runs inside `npm run test:browser`, or alone with `node scripts/fx-checks.mjs http://127.0.0.1:8787`.
```

- [ ] **Step 5: Execution record in this plan**

At the end of this plan, add:

```md
## Execution record

- Lenis: 1.3.26 (pinned; 1.3.27 was six days old at planning time).
- Desktop lab metrics after Part 2 (artifacts/browser-report.json, unthrottled local): CLS …, long tasks …, JS bytes ….
- check:fidelity: <result, or "not run" and why>.
- Deviations from this plan and why: <each one, or "none">.
```

Fill in the real values from Steps 2–3. Leave no `…` in it.

- [ ] **Step 6: Real-GPU sign-off (controller)**

Run one full pass in the owner's Chrome at 1422×745:
1. Load home in a fresh tab and let the intro play.
2. Wheel through every section, checking each effect's "sick" bar from Tasks 2–15.
3. Navigate home → About → a service → another service → Contact and back.
4. Tab through the home page from the skip link to the footer.
5. Repeat the scroll with DevTools reduced motion on.
6. Use the device toolbar at 390 px and 320 px (no heavy effects, no horizontal scroll).
Frame Rendering Stats should hold ~60 fps throughout. Record the outcome in the execution record.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/superpowers/plans/2026-10-21-showcase-part2-motion.md
git commit -m "docs: motion system notes and Part 2 execution record" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**1. Spec coverage (Part 2 + guardrails + testing).**

| Spec item | Task |
|---|---|
| Motion + Lenis, no GSAP; pinned version | 3 |
| Primitives client-only, cleaned up, no-op for reduced motion and coarse pointers | 2 (`useFx`), 3–7, 10, 12 |
| SmoothScroll: anchors, deep links, `scroll-padding-top`, curtain focus scroll, hero focus scroll, snap carousels, `<details>`, keyboard, `useScroll` | 3 (+ checks: wheel/idle, End key, deep-link A/B; existing curtain/hero/deep-link/FAQ checks run with Lenis on), 15 |
| Cursor: dot + ring, difference blend, morph, `data-cursor` labels, native cursor over inputs, hidden for keyboard, never over focus rings | 4 |
| Magnetic (≤10 px spring, arrow nudge) | 5, 15 |
| Spotlight / Tilt (≤4°) on What We Do tiles, What We Measure cards, engagement rows | 5 |
| SplitReveal: client split after hydration, `aria-label` + `aria-hidden` spans, no-JS/reduced motion whole words, fill kept | 6 |
| ScrollProgressRail: right rail, labels on hover/focus, upgrades "Home page sections", keyboard-usable | 7 |
| Grain 3–4%, `pointer-events: none` | 2 |
| What We Do parallax + desktop stack/scale | 10 (stack without pinning: no height change) |
| Services image sweep + dot ripple | 11 |
| Process scrubbed line, dot ignition, card lift | 11 |
| What We Measure chart/line draws, ticker velocity + skew, still pauses on hover/focus | 12 |
| Engagements stagger, spring toggle, single selected pulse | 13 |
| FAQ icon rotate/morph, photo parallax | 13 |
| Footer letters rise with the curtain, repel near the cursor | 14 |
| Nav pill (shared layout), button sweep, link underline, input glow | 8 |
| Page transitions: orange curtain via View Transitions, Next 16 way, instant fallback | 9 |
| Limits: heavy only on fine pointer ≥1024 px; touch gets reveals/draws; transform/opacity; 60 fps; rAF budget kept | Conventions, 2, 3 (idle check), every task's Real-GPU step |
| Tests: absent on touch, reduced motion, no-JS; focus visible with cursor; deep-link offset with smooth scroll; split names; rail keyboard; no new CSP violations; 320 px overflow | 2: `assertFxAbsent` covers Lenis, cursor, native cursor, grain, rail, split characters, footer letters, and Magnetic/Tilt/ScrollDepth/Parallax transforms on every non-desktop profile, plus the touch context with its CSP watch. 3, 4, 6 and 7 add the specific checks. The 320 px sweep and the CSP checks keep running in `test:browser` |
| Unit tests for pure logic | 1 |
| Hero integration (Magnetic CTA, `data-cursor="Drag"`, Lenis with 300vh beats) | 15 |
| Docs | 16 |

**2. Placeholder scan.** The plan contains no "TBD" or "similar to Task N". Each code step contains its code. Task 15 is conditional on Part 1's code. Every branch says exactly what to do and to which element, and the `…` placeholders in Task 16's execution-record template are explicitly to be filled with measured values before committing.

**3. Type and name consistency.** Every task uses the same names:
- `useFx`, `useMotionOK`, `FX_QUERY`, `MOTION_QUERY` (env.ts);
- `createIdleLoop(tick(time, dt))` (idle-loop.ts);
- `magnetOffset`, `tiltAngles`, `repelOffset`, `tickerFromVelocity`, `curtainReveal`, `cellAt`, `ringDistance`, `clamp`, `damp` (math.ts);
- `splitWords`, `charOffsets` (split.ts);
- `useInViewFlag`, `useSpotlight`, `useMagnetic` / `Magnetic` / `MagneticLink`, `Tilt`, `useSplitReveal` / `SplitWordChars`, `ScrollProgressRail` / `RailItem`, `PageTransition`, `Parallax`, `ScrollDepth`, `useTickerVelocity`, `SCROLL_LOCK_ATTR` / `setScrollLock`, `FooterWordmark`.

The data hooks are also consistent across components, CSS and checks: `data-fx`, `data-fx-motion`, `data-in`, `data-fx-cursor`, `data-fx-cursor-root`, `data-cursor`, `data-magnetic`, `data-magnetic-glyph`, `data-tilt`, `data-spotlight`, `data-split-title`, `data-split-char`, `data-fx-rail`, `data-fx-grain`, `data-nav-pill`, `data-parallax`, `data-depth`, `data-active`, `data-ripple`, `data-timeline`, `data-timeline-dot`, `data-letter` and `data-scroll-lock`.

## Controller amendments (before execution, 2026-10-21)

- **Order:** Part 2 starts after Part 1 has landed and `feat/showcase-cms` (Part 3) has been merged into `feat/spacegear-showcase`. `src/lib/content.ts` then re-exports data loaded from `content/`, with the same export names, and must not be edited. Content changes go in `content/*.json` (see Part 3).
- **Part 1 contracts confirmed by its plan:**
  - The globe wrapper carries `data-cursor="Drag"` once ready.
  - Hero scroll progress is read from the section rect on `scroll` events.
  - The hero `h1` already rises word by word from masks. Task 6 must leave it alone.
  - The intro does not lock scrolling (any key, pointer, wheel, touch, focus or scroll ends it). Task 15 Step 5 should therefore find nothing to change.
- **After Part 2, Part 3's deferred Task 8** (content images through `contentImage()`) runs against the components as Part 2 leaves them.
- **Logo (2026-10-22, on `feat/spacegear-showcase`):** the drawn spacegear logo (concept B "Shift", `docs/brand/guidelines.md`) replaced the "space—gear" dash wordmark. Merge `feat/spacegear-showcase` into the motion branch again before Tasks 8 and 14. "space—gear" is now an old-identity string: `scripts/check-export.mjs` and `scripts/lib/honesty.mjs` reject it in any exported file or content, so no code, check or copy may bring it back.
  - **Task 8:** the nav pill wraps the new `<Brand />` (`src/components/Brand.tsx`), an `aria-hidden` inline-SVG lockup (24 px tall, 28 px from `lg`). Keep the home link as `<Link prefetch={false} href="/" aria-label="spacegear home" …><Brand /></Link>` wherever the plan's Nav markup still shows `aria-label="space—gear home"`; `scripts/identity-check.mjs` (run by `test:browser`) asserts that name on every route.
  - **Task 14:** the footer wordmark is now `<Wordmark>` (`src/components/Wordmark.tsx`) with 9 letters ("spacegear"), not 10 letters of "space—gear". Each glyph is already a `<span data-letter class="fx-letter inline-block glyph-…" style="--i:n">` holding its own SVG, followed by a `.sr-only` "spacegear" and the drawn ™ (`.brand-tm`, not a `data-letter`). `FooterWordmark.tsx` must not split text (drop `NAME`): it renders `<Wordmark ref={ref} className="fx-wordmark flex justify-center text-[clamp(36px,10vw,104px)] lg:justify-start lg:text-[clamp(40px,8vw,104px)] text-flame" />` (the classes `Footer.tsx` passes today: the flex centring keeps it centred on phones) and runs the letter-rise and the cursor lean on those `[data-letter]` / `.fx-letter` elements and their `--i`. The `fx-checks` expectation becomes `{ letters: 9, risen: false, name: "spacegear" }`. Under reduced motion the glyphs stay at rest (guidelines §9).
