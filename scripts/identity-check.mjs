// Browser checks for the spacegear identity (brand kit, docs/brand/), run by scripts/browser-check.mjs
// against the running preview. No copy the CMS can change is asserted here: the names below live in
// the components (Nav.tsx, Wordmark.tsx), not in content/.
// - identityOnPage, on every route: the nav's home link is named "spacegear home" (its logo is an
//   aria-hidden SVG, so the name is the label and holds no hidden text); the footer wordmark has one
//   [data-letter] element per drawn glyph, 9 in all, and they spell its screen-reader name; the page
//   links an icon and the web manifest, sets a theme colour, and nowhere shows the retired dash
//   wordmark "space—gear".
// - identityServed, once: the favicon, the SVG icon, the Apple icon and the manifest are served, and
//   every icon the manifest names is a PNG of the size it states.
import assert from "node:assert/strict";

export const NAV_HOME_NAME = "spacegear home";
export const WORDMARK_LETTERS = 9;
const OLD_WORDMARK = "space—gear";

export async function identityOnPage(page, route) {
  const home = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: NAV_HOME_NAME, exact: true });
  assert.equal(await home.count(), 1, `${route}: the nav's home link is named "${NAV_HOME_NAME}"`);
  const logo = await home.evaluate(link => ({ text: link.textContent.trim(), svgs: link.querySelectorAll('svg[aria-hidden="true"]').length }));
  assert.deepEqual(logo, { text: "", svgs: 1 }, `${route}: the nav logo is one aria-hidden SVG with no hidden text`);
  const state = await page.evaluate(() => {
    const mark = document.querySelector("footer .brand-wordmark");
    const letters = mark ? [...mark.querySelectorAll("[data-letter]")] : [];
    const glyphs = letters.map(el => [...el.classList].find(name => name.startsWith("glyph-"))?.slice(6).replace(/\d+$/, "") ?? "?").join("");
    return {
      letters: letters.length,
      fxLetters: letters.filter(el => el.classList.contains("fx-letter") && el.style.getPropertyValue("--i") !== "").length,
      glyphs,
      name: mark?.querySelector(".sr-only")?.textContent ?? null,
      icon: Boolean(document.querySelector('head link[rel~="icon"]')),
      manifest: document.querySelector('head link[rel="manifest"]')?.getAttribute("href") ?? null,
      themeColor: Boolean(document.querySelector('head meta[name="theme-color"]')?.content),
      html: document.documentElement.outerHTML,
    };
  });
  assert.equal(state.letters, WORDMARK_LETTERS, `${route}: the footer wordmark renders ${WORDMARK_LETTERS} letter elements`);
  assert.equal(state.fxLetters, WORDMARK_LETTERS, `${route}: every footer letter carries .fx-letter and its --i index`);
  assert.equal(state.glyphs, state.name, `${route}: the footer letters spell the wordmark's screen-reader name (${state.glyphs} / ${state.name})`);
  assert.ok(state.icon && state.themeColor, `${route}: the page links an icon and sets a theme colour`);
  assert.equal(state.manifest, "/manifest.webmanifest", `${route}: the page links the web manifest`);
  assert.equal(state.html.includes(OLD_WORDMARK), false, `${route}: the retired "${OLD_WORDMARK}" wordmark is gone`);
}

/** Width and height from a PNG's IHDR chunk, or null when the bytes are not a PNG. */
function pngSize(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((byte, i) => bytes[i] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return `${view.getUint32(16)}x${view.getUint32(20)}`;
}

export async function identityServed(base) {
  const get = async (pathname, type) => {
    const response = await fetch(new URL(pathname, base));
    assert.equal(response.status, 200, `${pathname} is served`);
    assert.match(response.headers.get("content-type") ?? "", type, `${pathname}: content type`);
    return new Uint8Array(await response.arrayBuffer());
  };
  const ico = await get("/favicon.ico", /^image\/(?:x-icon|vnd\.microsoft\.icon)/);
  assert.deepEqual([...ico.slice(0, 4)], [0, 0, 1, 0], "/favicon.ico is an ICO file");
  assert.match(new TextDecoder().decode(await get("/icon.svg", /^image\/svg\+xml/)), /^<svg[\s>]/, "/icon.svg is an SVG");
  assert.equal(pngSize(await get("/apple-icon.png", /^image\/png/)), "180x180", "/apple-icon.png is 180 px");
  const manifest = JSON.parse(new TextDecoder().decode(await get("/manifest.webmanifest", /^application\/(?:manifest\+)?json/)));
  assert.ok(manifest.icons?.length >= 1, "the manifest names icons");
  for (const icon of manifest.icons) assert.equal(pngSize(await get(icon.src, /^image\/png/)), icon.sizes, `${icon.src} matches its manifest size`);
  return `identity: favicon.ico, icon.svg, apple-icon.png and manifest.webmanifest served, with its ${manifest.icons.length} icons at their stated sizes`;
}
