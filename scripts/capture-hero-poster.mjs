// Renders the desktop globe's opening frame to the hero poster: the width candidates in POSTER_FILES
// (src/components/globe/poster.ts; public/images/hero-poster.webp at 2400×1000 and
// hero-poster-3840w.webp at 3840×1600), served through a srcset.
//
// The poster is the desktop hero's first paint, its loading state under the WebGL canvas and the static
// hero for reduced motion, no JavaScript, Save-Data and missing WebGL2, so it must be the frame the canvas
// fades in on: the opening pose at scroll 0, which the globe holds through its fade-in
// (OPENING_HOLD_SECONDS) before its motion eases in. The shot is that pose exactly: the pose is checked at
// the first frame, and after the 4k swap the page's clock is frozen and the pose restored (three.js
// objects are reached through three's devtools hook: globe-poster.mjs freezeOpeningPose), with the copy,
// the nav and the intro overlay hidden. The 3D stars come from a fixed seed, so they match too.
//
// Geometry: three's camera keeps a fixed vertical field of view, so the scene scales with the viewport's
// height and stays centred. A poster this wide (POSTER_ASPECT, 2.4:1, wider than nearly every desktop
// window) shown with object-fit: cover (contain on wider windows) therefore scales by height too and lands on
// the live frame at any desktop shape. Each candidate is rendered at its own size (DPR 1), so it is sharp, not upscaled.
//
// Run it on a real GPU (headless Chromium uses the machine's GPU where it can; the page's own renderer
// string is used, so the 4k set streams as on a capable desktop):
//   node --import tsx scripts/capture-hero-poster.mjs [base] [--tier=4k|2k] [--out=dir] [--widths=2400,3840]
// Re-run whenever the globe textures, shaders, LOOK, galaxy, sun or camera framing change.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { launchBrowser } from "./browser-runtime.mjs";
import { captureHooks, freezeOpeningPose, readPose } from "./globe-poster.mjs";
import { CAMERA_Z, INITIAL_SPIN } from "../src/components/globe/constants.ts";
import { INTRO_SESSION_KEY } from "../src/components/globe/intro-gate.ts";
import { POSTER_FILES } from "../src/components/globe/poster.ts";

const args = process.argv.slice(2);
const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = args.find((arg) => !arg.startsWith("--")) || "http://127.0.0.1:8787";
// The 4k set is what capable desktops show after the intro; the 2k first frame fades in over the same
// geometry and light. 4k keeps the surface sharp where the opening globe is magnified most.
const tier = option("tier", "4k");
const out = option("out", "public/images");
const QUALITY = 80;

async function capture(browser, { width, height }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    // A repeat view: the poster is the opening frame, not the intro.
    await context.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_SESSION_KEY);
    await context.addInitScript(captureHooks);
    const page = await context.newPage();
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    if (tier === "2k") await page.route("**/textures/earth/4k/**", (route) => route.abort());
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForSelector('#home .hero-scene[data-globe="ready"]', { timeout: 60000 });
    // The opening pose, read while the globe still holds it (its fade-in): the spin it mounted with, and
    // no cloud drift or sky turn yet.
    const pose = await readPose(page);
    if (Math.abs(pose.spin - INITIAL_SPIN) > 1e-6 || pose.clouds !== 0 || pose.sky !== 0) {
      throw new Error(`The globe did not hold its opening pose at its first frame: ${JSON.stringify(pose)} (INITIAL_SPIN ${INITIAL_SPIN}).`);
    }
    if (tier === "4k") await page.waitForSelector('#home .hero-scene[data-globe-tier="4k"]', { timeout: 60000 });
    const loaded = requests.filter((url) => url.includes("/textures/earth/"));
    if (!loaded.some((url) => url.includes(`/textures/earth/${tier}/`))) throw new Error(`The globe did not load its ${tier} textures.`);
    // Freeze the page's clock (every frame now has a zero delta), restore the opening pose with the
    // cursor's tilt and parallax at rest, hide everything but the canvas and let a few frames render.
    await freezeOpeningPose(page);
    await page.addStyleTag({ content: "* { transition: none !important; } header, .intro-overlay { display: none !important; } #home .sticky > :not(.hero-scene) { visibility: hidden !important; }" });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    const check = { ...(await readPose(page)), ...(await page.evaluate(() => {
      const scene = document.querySelector("#home .hero-scene");
      return { tier: scene.dataset.globeTier, opacity: getComputedStyle(scene).opacity, scrollY };
    })) };
    if (check.spin !== pose.spin || check.clouds !== 0 || check.sky !== 0 || check.tier !== tier || check.opacity !== "1" || check.scrollY !== 0) throw new Error(`The frame is not the opening pose: ${JSON.stringify(check)}`);
    const png = await page.screenshot({ type: "png" });
    return { png, pose, check, renderer: await rendererOf(page) };
  } finally {
    await context.close();
  }
}

/** The GPU the page renders with, as the scene reads it (device.ts rendererName). */
function rendererOf(page) {
  return page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return String(name ?? "none");
  });
}

const browser = await launchBrowser();
try {
  await fs.mkdir(out, { recursive: true });
  const widths = option("widths", POSTER_FILES.map((poster) => poster.width).join(",")).split(",").map(Number);
  for (const poster of POSTER_FILES.filter((candidate) => widths.includes(candidate.width))) {
    const shot = await capture(browser, poster);
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(shot.renderer)) throw new Error(`Capture on a real GPU, not ${shot.renderer}.`);
    const file = path.join(out, path.basename(poster.src));
    const info = await sharp(shot.png).webp({ quality: QUALITY, effort: 6, smartSubsample: true }).toFile(file);
    console.log(`Hero poster written: ${file} (${info.width}×${info.height}, ${info.size} bytes, ${tier}, ${shot.renderer}, camera z ${CAMERA_Z}, pose ${JSON.stringify(shot.check)})`);
  }
} finally {
  await browser.close();
}
