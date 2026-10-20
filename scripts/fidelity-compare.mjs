// Section-by-section visual comparison against the original platform-clone build.
// Usage: node scripts/fidelity-compare.mjs [originalBase] [candidateBase]
// Writes artifacts/fidelity/<profile>/<section>.jpg (original left, candidate right)
// and artifacts/fidelity/report.json. Exits 1 when a required section is missing
// or its height drifts more than the tolerance from the original.
import fs from "node:fs/promises";
import sharp from "sharp";
import { launchBrowser } from "./browser-runtime.mjs";

const originalBase = process.argv[2] || "http://127.0.0.1:3101";
const candidateBase = process.argv[3] || "http://127.0.0.1:8787";
const TOLERANCE = 0.15;
// Spacegear has five services where the original had four product columns.
const TOLERANCE_OVERRIDES = { "mobile:services": 0.3 };
const REQUIRED = ["home", "work", "services", "process", "analytics", "pricing", "faq", "team", "contact"];
// Rendered only once real, permission-confirmed entries exist.
const OPTIONAL = ["testimonials", "labs"];
const PROFILES = [
  { name: "desktop", width: 1440, height: 900, tile: 720 },
  { name: "mobile", width: 390, height: 844, tile: 390 },
];
const MAX_SCREENS = 3;

async function capture(browser, base, profile) {
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  // Walk the page once so in-view animations, count-ups and lazy images settle.
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 400) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  const shots = {};
  for (const id of [...REQUIRED, ...OPTIONAL]) {
    const box = await page.evaluate((sid) => {
      const el = document.getElementById(sid);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top + window.scrollY), height: Math.round(r.height) };
    }, id);
    if (!box) continue;
    const frames = [];
    const shoot = async (y, settle) => {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(settle);
      frames.push(await page.screenshot({ type: "png" }));
    };
    if (id === "home") {
      // The desktop hero is a pinned scroll sequence: sample its opening, zoom and statement beats.
      const travel = Math.max(0, box.height - profile.height);
      for (const p of travel > profile.height ? [0, 0.4, 0.85] : [0]) await shoot(Math.round(box.top + travel * p), 1200);
    } else if (id === "contact") {
      // The footer may be pinned behind the page (curtain), so read it at the very bottom.
      await shoot(total, 900);
    } else {
      const screens = Math.min(MAX_SCREENS, Math.ceil(box.height / profile.height));
      for (let s = 0; s < screens; s++) await shoot(box.top + s * profile.height, 900);
    }
    shots[id] = { ...box, frames };
  }
  await context.close();
  return shots;
}

async function stack(frames, width) {
  const parts = await Promise.all(frames.map((f) => sharp(f).resize({ width }).png().toBuffer({ resolveWithObject: true })));
  const height = parts.reduce((sum, p) => sum + p.info.height, 0);
  let top = 0;
  const layers = parts.map((p) => { const layer = { input: p.data, left: 0, top }; top += p.info.height; return layer; });
  const buffer = await sharp({ create: { width, height, channels: 3, background: "#000000" } }).composite(layers).png().toBuffer();
  return { buffer, height };
}

async function sideBySide(left, right, width, file) {
  const gap = 16;
  const height = Math.max(left.height, right.height);
  await sharp({ create: { width: width * 2 + gap, height, channels: 3, background: "#ff00ff" } })
    .composite([{ input: left.buffer, left: 0, top: 0 }, { input: right.buffer, left: width + gap, top: 0 }])
    .jpeg({ quality: 78 })
    .toFile(file);
}

const browser = await launchBrowser();
const report = { testedAt: new Date().toISOString(), originalBase, candidateBase, tolerance: TOLERANCE, results: [] };
let failed = false;
try {
  for (const profile of PROFILES) {
    const dir = `artifacts/fidelity/${profile.name}`;
    await fs.mkdir(dir, { recursive: true });
    const original = await capture(browser, originalBase, profile);
    const candidate = await capture(browser, candidateBase, profile);
    for (const id of [...REQUIRED, ...OPTIONAL]) {
      const o = original[id];
      const c = candidate[id];
      if (!c) {
        const ok = OPTIONAL.includes(id);
        if (!ok) failed = true;
        report.results.push({ profile: profile.name, section: id, ok, reason: ok ? "optional, not rendered" : "missing in candidate" });
        continue;
      }
      if (!o) { report.results.push({ profile: profile.name, section: id, ok: true, reason: "not in original" }); continue; }
      const ratio = c.height / o.height;
      const tolerance = TOLERANCE_OVERRIDES[`${profile.name}:${id}`] ?? TOLERANCE;
      const ok = Math.abs(1 - ratio) <= tolerance;
      if (!ok) failed = true;
      report.results.push({ profile: profile.name, section: id, ok, originalHeight: o.height, candidateHeight: c.height, ratio: Number(ratio.toFixed(3)) });
      await sideBySide(await stack(o.frames, profile.tile), await stack(c.frames, profile.tile), profile.tile, `${dir}/${id}.jpg`);
    }
  }
  await fs.writeFile("artifacts/fidelity/report.json", JSON.stringify(report, null, 2));
  for (const r of report.results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.profile.padEnd(8)} ${r.section.padEnd(13)} ${r.ratio ?? ""} ${r.reason ?? ""}`);
  if (failed) { console.error("Fidelity check failed. Review artifacts/fidelity/<profile>/<section>.jpg"); process.exitCode = 1; }
  else console.log("Fidelity check passed. Review every sheet in artifacts/fidelity/ before signing off.");
} finally {
  await browser.close();
}
