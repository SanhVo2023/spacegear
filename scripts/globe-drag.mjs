// Measures how far a held mouse drag turns the hero globe's surface (used by browser-check.mjs).
//
// Three identical sequences on the opening frame: idle (the mouse moves, no press), then a slow drag
// left and a slow drag right of `angle` degrees, each held still while the second capture is taken,
// so nothing flings. The cursor is parked at the sequence's end point for both captures, so the
// cursor tilt cancels, and the idle sequence measures the idle spin over the same timing, which is
// subtracted. The surface shift comes from 2D block matching: the canvas is downsampled ×4 to grey
// and high-passed (so the fixed limb shading and lighting cannot pull a match toward zero), and five
// patches below the ocean glint are found again by normalised cross-correlation; the median
// horizontal shift wins. At the opening scale 8° moves the surface about 170 px, which the patches
// follow reliably; 30° moves it about 500 px, beyond what they can track.
import sharp from "sharp";

const PATCHES = [[950, 600], [1050, 600], [950, 700], [1050, 700], [1000, 650]]; // centres at 1440×1000
const PATCH = [50, 30]; // samples (×4 px)
const SEARCH = [80, 40]; // ± samples

// Screenshot of the hero canvas alone (the copy, scrim and hint layers hidden).
export async function canvasShot(page) {
  const toggle = hide => page.evaluate(hide => {
    for (const el of document.querySelectorAll("#home .sticky > :not(.hero-scene)")) {
      if (hide) el.style.setProperty("visibility", "hidden"); else el.style.removeProperty("visibility");
    }
  }, hide);
  await toggle(true);
  const png = await page.locator("#home .hero-scene canvas").screenshot();
  await toggle(false);
  return png;
}

async function highPass(png) {
  const { width, height } = await sharp(png).metadata();
  const w = Math.round(width / 4), h = Math.round(height / 4);
  const grey = await sharp(png).removeAlpha().resize(w, h, { fit: "fill" }).greyscale().raw().toBuffer();
  const sum = new Float64Array((w + 1) * (h + 1)); // integral image for a 13×13 box blur
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sum[(y + 1) * (w + 1) + x + 1] = grey[y * w + x] + sum[y * (w + 1) + x + 1] + sum[(y + 1) * (w + 1) + x] - sum[y * (w + 1) + x];
  const px = new Float64Array(w * h), r = 6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    const box = sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0];
    px[y * w + x] = grey[y * w + x] - box / ((x1 - x0) * (y1 - y0));
  }
  return { w, h, px, scale: width / 1440 };
}

// Best (dx, dy) in px for one patch of `a` found in `b`, by normalised cross-correlation.
function matchPatch(a, b, [cx, cy]) {
  const [tw, th] = PATCH, [sx, sy] = SEARCH;
  const x0 = Math.round((cx * a.scale) / 4 - tw / 2), y0 = Math.round((cy * a.scale) / 4 - th / 2);
  let mean = 0, energy = 0;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) mean += a.px[(y0 + y) * a.w + x0 + x];
  mean /= tw * th;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) energy += (a.px[(y0 + y) * a.w + x0 + x] - mean) ** 2;
  let best = { dx: 0, dy: 0, r: -2 };
  for (let dy = -sy; dy <= sy; dy++) for (let dx = -sx; dx <= sx; dx++) {
    const bx = x0 + dx, by = y0 + dy;
    if (bx < 0 || by < 0 || bx + tw > b.w || by + th > b.h) continue;
    let mb = 0, sab = 0, sbb = 0;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) mb += b.px[(by + y) * b.w + bx + x];
    mb /= tw * th;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const va = a.px[(y0 + y) * a.w + x0 + x] - mean, vb = b.px[(by + y) * b.w + bx + x] - mb;
      sab += va * vb; sbb += vb * vb;
    }
    const r = sab / Math.sqrt(energy * sbb || 1);
    if (r > best.r) best = { dx: (dx * 4) / a.scale, dy: (dy * 4) / a.scale, r };
  }
  return best;
}

// Median horizontal surface shift (px at 1440 wide; + = the surface moved right) from `before` to `during`.
function surfaceShift(before, during) {
  const matches = PATCHES.map(centre => matchPatch(before, during, centre));
  return { shift: Math.round(matches.map(m => m.dx).sort((p, q) => p - q)[2]), matches };
}

/**
 * Runs the idle, left and right sequences on the opening frame (1440×1000) and returns the shifts.
 * `induced` = drag sequence minus idle sequence: negative for the left drag, positive for the right.
 */
export async function dragTurn(page, { angle = 8, press = true } = {}) {
  const scene = page.locator("#home .hero-scene");
  const distance = Math.round((angle / 180) * 1440); // DRAG_RADIANS_PER_VIEWPORT is π
  const y = 540;
  const sequence = async (from, to, withPress) => {
    await page.mouse.move(to, y, { steps: 4 });
    await page.waitForTimeout(1000); // the tilt settles with the cursor where it will end
    const before = await highPass(await canvasShot(page));
    await page.mouse.move(from, y, { steps: 4 });
    if (withPress) await page.mouse.down();
    const pressed = await scene.evaluate(el => el.hasAttribute("data-dragging"));
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(from + ((to - from) * i) / 10, y);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(700); // held still: the fling velocity decays and the tilt settles back
    const during = await highPass(await canvasShot(page));
    const held = await scene.evaluate(el => el.hasAttribute("data-dragging"));
    if (withPress) await page.mouse.up();
    return { ...surfaceShift(before, during), pressed, held };
  };
  const start = 1000;
  const idle = await sequence(start + distance, start, false);
  const left = await sequence(start + distance, start, press);
  const right = await sequence(start, start + distance, press);
  return { idle, left, right, inducedLeft: left.shift - idle.shift, inducedRight: right.shift - idle.shift };
}
