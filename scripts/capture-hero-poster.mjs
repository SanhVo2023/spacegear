// Renders the desktop globe's opening frame to public/images/hero-poster.webp.
// The poster sits under the WebGL canvas: loading state and WebGL fallback.
// Usage (local preview running): node scripts/capture-hero-poster.mjs [base]
// Re-run whenever the globe model, galaxy or EarthScene camera changes.
import sharp from "sharp";
import { launchBrowser } from "./browser-runtime.mjs";

const base = process.argv[2] || "http://127.0.0.1:8787";
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("#home .hero-scene canvas", { timeout: 30000 });
  await page.waitForTimeout(5000); // model + 4K textures decode, sun glow settles
  await page.evaluate(() => {
    // display, not visibility: the nav's 500 ms `transition-all` would keep it visible for the shot.
    document.querySelector("header")?.style.setProperty("display", "none");
    const stage = document.querySelector("#home .sticky");
    for (const el of stage ? [...stage.children] : []) {
      if (!el.classList.contains("hero-scene")) el.style.visibility = "hidden";
    }
  });
  await page.waitForTimeout(300);
  const png = await page.screenshot({ type: "png" });
  await sharp(png).webp({ quality: 80 }).toFile("public/images/hero-poster.webp");
  console.log("Hero poster written: public/images/hero-poster.webp");
} finally {
  await browser.close();
}
