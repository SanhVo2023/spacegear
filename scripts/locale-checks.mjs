// Browser checks for the Vietnamese site and the language routing (bilingual plan, Task 20), against the running
// preview (wrangler dev, which runs the Worker). Run alone:
//   npm run check:locale -- <base URL>      (node scripts/locale-checks.mjs <base URL> works too)
// browser-check.mjs can run them as well: localeChecks(browser, base) returns its report lines. The routes come
// from the preview's sitemap, so new pages are covered without editing this file. What they prove:
// - type: on every /vi/ route at 320, 390, 768, 1024 and 1440 px no glyph's ink (canvas text metrics, so stacked
//   diacritics such as Ấ, Ở, Ữ count at their full height) is cut by a mask (the hero's word masks, the split
//   section titles) or by any ancestor that clips (the ring badges' text, turned round its circle, by its svg), and
//   in tight-leading text (display titles, the hero) no Vietnamese mark runs into the ink of the line above or below
//   it (drawn glyph by glyph: a descender grazing an ascender is the English design and counts in neither language);
// - widths: no text box crosses its own block or the viewport and nothing scrolls sideways; the Vietnamese hero
//   headline keeps clear of the pitch below it and, in the pinned desktop hero, fits the screen under the nav;
// - the cursor's Vietnamese labels (XEM, KÉO, MỞ) sit inside the orange disc, drawn in the site's Inter;
// - no English UI or content string, and no English sentence, shows on a Vietnamese page (text, labels, title),
//   with and without JavaScript, and Vietnamese pages link only to Vietnamese pages or shared files (the language
//   switch excepted). Only what the page renders is scanned: Next's flight data in <script> carries its default
//   not-found text ("This page could not be found.") on every page, but never renders it;
// - fonts: English pages never download a Vietnamese subset; Vietnamese pages do, and every Vietnamese letter is
//   drawn by the site's own fonts (Chromium's platform fonts per node), never by a system fallback;
// - the switch: keyboard-reachable, named "EN – English" and "VI – Tiếng Việt", the current one marked, working
//   with and without JavaScript (and from the phone menu) through ?lang= and the sg_lang cookie;
// - the redirect: a visitor from Vietnam (x-sg-test-country, which only the local preview honours) or with a
//   Vietnamese browser lands on the /vi/ twin when it exists; the cookie wins; a /vi/ URL is never moved.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SOFTWARE_RENDERER, fakeGpu } from "./globe-stream.mjs";

/** A TypeScript module: native under --experimental-strip-types (browser-check after Task 21), else through tsx. */
async function importTs(path) {
  const url = new URL(path, import.meta.url).href;
  try {
    return await import(url);
  } catch (error) {
    if (error?.code !== "ERR_UNKNOWN_FILE_EXTENSION") throw error;
    const { tsImport } = await import("tsx/esm/api");
    return tsImport(url, import.meta.url);
  }
}

const { dictionary } = await importTs("../src/lib/i18n/dictionary.ts");
const { LOCALE_COOKIE } = await importTs("../src/lib/i18n/locales.ts");
const { INTRO_SESSION_KEY } = await importTs("../src/components/globe/intro-gate.ts");

const ROOT = new URL("../", import.meta.url);
const WIDTHS = [320, 390, 768, 1024, 1440];
const SWITCH = /[?&]lang=(?:en|vi)\b/;
const SHARED = /^\/(?:_next|images|uploads|textures|models|seo|licenses|admin|api)\/|^\/[^/]+\.[A-Za-z0-9]+$/;
const YEAR = 31536000;
const LOOPBACK = /^(?:localhost|127\.0\.0\.1)$/;
/** Characters the SG Inter and SG Mono faces cover (Google Fonts' latin and vietnamese subsets). */
const FACE_RANGE = "\\u0000-\\u00FF\\u0102\\u0103\\u0110\\u0111\\u0128\\u0129\\u0131\\u0152\\u0153\\u0168\\u0169\\u01A0\\u01A1\\u01AF\\u01B0\\u02BB\\u02BC\\u02C6\\u02DA\\u02DC\\u0300-\\u0304\\u0308\\u0309\\u0323\\u0329\\u1EA0-\\u1EF9\\u2000-\\u206F\\u20AB\\u20AC\\u2122\\u2191\\u2193\\u2212\\u2215\\uFEFF\\uFFFD";
/** Letters only Vietnamese uses (beyond Latin-1): in the Vietnamese unicode-range of both faces. */
const VI_LETTER = "\\u0102\\u0103\\u0110\\u0111\\u0128\\u0129\\u0168\\u0169\\u01A0\\u01A1\\u01AF\\u01B0\\u1EA0-\\u1EF9";

// ---------------------------------------------------------------------------------------------------------------
// In-page helpers. They run through page.evaluate as source text (inPage below), so they work with JavaScript
// disabled too, and they may use only browser globals and each other.

/** Every visible grapheme under `root`: its advance box (the text fragment's client rect) and its ink box from
 *  canvas metrics in the element's own font, so a stacked diacritic or a descender counts at its real extent.
 *  Horizontal HTML text only: SVG text (the rotating ring badges) has its own check (svgTextInk). */
function graphemes(root, skip) {
  const out = [];
  if (!root) return out;
  const ctx = (window.__lcCanvas ??= document.createElement("canvas")).getContext("2d");
  const segmenter = new Intl.Segmenter("vi", { granularity: "grapheme" });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    // Visually hidden text (.sr-only, the contact form's .honeypot trap) is never drawn.
    if (!el || !node.data.trim() || el.closest("script, style, noscript, template, .sr-only, .honeypot, svg")) continue;
    if (skip && el.closest(skip)) continue;
    const style = getComputedStyle(el);
    if (style.visibility !== "visible" || !el.checkVisibility({ checkVisibilityCSS: true })) continue;
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const lang = el.closest("[lang]")?.getAttribute("lang") || "en";
    const upper = style.textTransform === "uppercase";
    for (const { segment, index } of segmenter.segment(node.data)) {
      if (!segment.trim()) continue;
      range.setStart(node, index);
      range.setEnd(node, index + segment.length);
      const box = [...range.getClientRects()].find((rect) => rect.width > 0 && rect.height > 0);
      if (!box) continue;
      const metrics = ctx.measureText(upper ? segment.toLocaleUpperCase(lang) : segment);
      // The fragment's box is the font's content area (ascent + descent); a CSS scale shows as its ratio.
      const k = box.height / (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);
      const baseline = box.top + metrics.fontBoundingBoxAscent * k;
      out.push({
        g: upper ? segment.toLocaleUpperCase(lang) : segment,
        el,
        box,
        baseline,
        size: parseFloat(style.fontSize) * k,
        font: `${style.fontStyle} ${style.fontWeight} ${parseFloat(style.fontSize) * k}px ${style.fontFamily}`,
        left: box.left - metrics.actualBoundingBoxLeft * k,
        right: box.left + metrics.actualBoundingBoxRight * k,
        top: baseline - metrics.actualBoundingBoxAscent * k,
        bottom: baseline + metrics.actualBoundingBoxDescent * k,
      });
    }
  }
  return out;
}

/** The graphemes of what a page shows as its own: the main content and the footer (which every page carries). */
function pageText(skip) {
  return [...document.querySelectorAll("main, footer#contact")].flatMap((root) => graphemes(root, skip));
}

/** SVG text (the rotating ring badges: their copy runs round a circle on a textPath) against its <svg>'s
 *  viewport, which clips it: each glyph's ink box, from canvas metrics in the text's own font and user-unit size,
 *  is turned to the glyph's rotation round its start point, and its corners must stay inside the viewBox. Also
 *  the least room left, in CSS px. */
function svgTextInk() {
  const ctx = (window.__lcCanvas ??= document.createElement("canvas")).getContext("2d");
  const clipped = [];
  let count = 0, room = Infinity, roomAt = "";
  for (const root of document.querySelectorAll("main, footer#contact")) {
    for (const text of root.querySelectorAll("svg text")) {
      const svg = text.ownerSVGElement;
      const view = svg.viewBox.baseVal;
      if (!view || !view.width || !text.getNumberOfChars() || !svg.checkVisibility()) continue;
      const scale = svg.clientWidth / view.width;
      const style = getComputedStyle(text);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const lang = text.closest("[lang]")?.getAttribute("lang") || "en";
      const chars = Array.from(text.textContent);
      for (let i = 0, index = 0; i < chars.length; index += chars[i].length, i++) {
        const char = style.textTransform === "uppercase" ? chars[i].toLocaleUpperCase(lang) : chars[i];
        if (!char.trim()) continue;
        count++;
        const start = text.getStartPositionOfChar(index);
        const turn = (text.getRotationOfChar(index) * Math.PI) / 180;
        const m = ctx.measureText(char);
        const corners = [[-m.actualBoundingBoxLeft, -m.actualBoundingBoxAscent], [m.actualBoundingBoxRight, -m.actualBoundingBoxAscent], [-m.actualBoundingBoxLeft, m.actualBoundingBoxDescent], [m.actualBoundingBoxRight, m.actualBoundingBoxDescent]]
          .map(([x, y]) => [start.x + x * Math.cos(turn) - y * Math.sin(turn), start.y + x * Math.sin(turn) + y * Math.cos(turn)]);
        const least = Math.min(...corners.flatMap(([x, y]) => [x - view.x, view.x + view.width - x, y - view.y, view.y + view.height - y])) * scale;
        if (least < room) { room = least; roomAt = `${char} in "${text.textContent.trim().slice(0, 40)}"`; }
        if (least < -0.25) clipped.push(`${char} in "${text.textContent.trim().slice(0, 40)}": ${Math.round(-least * 10) / 10}px outside its svg`);
      }
    }
  }
  return { count, clipped: [...new Set(clipped)], room: Math.round(room * 10) / 10, roomAt };
}

/** The nearest ancestor that lays out its own box (not an inline box): what a text run has to fit in. */
function blockOf(el) {
  let block = el;
  while (block.parentElement && /^(?:inline|contents)$/.test(getComputedStyle(block).display)) block = block.parentElement;
  return block;
}

/** A short label for an element in a report. */
function describe(el) {
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50)}"`;
}

/** Ink cut by a mask (.hero-word-mask, .fx-split-mask), and the tightest margin a stacked mark keeps. */
function maskInk() {
  const clipped = [];
  let count = 0, minTop = Infinity, minTopChar = "";
  for (const mask of document.querySelectorAll(".hero-word-mask, .fx-split-mask")) {
    const clip = mask.getBoundingClientRect();
    for (const ink of graphemes(mask)) {
      count++;
      const room = { above: ink.top - clip.top, below: clip.bottom - ink.bottom, left: ink.left - clip.left, right: clip.right - ink.right };
      if (room.above < minTop) { minTop = room.above; minTopChar = ink.g; }
      if (Math.min(...Object.values(room)) < -0.5) clipped.push({ char: ink.g, word: mask.textContent.trim(), ...Object.fromEntries(Object.entries(room).map(([side, px]) => [side, Math.round(px * 10) / 10])) });
    }
  }
  return { count, clipped, minTop: Math.round(minTop * 10) / 10, minTopChar };
}

/** Ink partly cut, top or bottom, by an ancestor that clips (overflow other than visible). Ink wholly outside a
 *  box is hidden by design (a closed panel), and ink beside a box belongs to a scroller's other slides. */
function clippedByAncestors(skip) {
  const out = [];
  const boxes = new Map();
  const clipBox = (el) => {
    if (!boxes.has(el)) {
      const style = getComputedStyle(el);
      if (style.overflowY === "visible" || el.matches(".hero-word-mask, .fx-split-mask")) boxes.set(el, null);
      else {
        const rect = el.getBoundingClientRect();
        const top = rect.top + el.clientTop, left = rect.left + el.clientLeft;
        boxes.set(el, { top, bottom: top + el.clientHeight, left, right: left + el.clientWidth });
      }
    }
    return boxes.get(el);
  };
  for (const ink of pageText(skip)) {
    for (let el = ink.el; el && el !== document.body; el = el.parentElement) {
      const box = clipBox(el);
      if (!box || ink.right <= box.left || ink.left >= box.right) continue;
      const shown = Math.min(ink.bottom, box.bottom) - Math.max(ink.top, box.top);
      const cut = Math.max(box.top - ink.top, ink.bottom - box.bottom);
      if (shown > 0.5 && cut > 0.5) {
        out.push(`${ink.g} in ${describe(ink.el)}: ${Math.round(cut * 10) / 10}px cut by ${describe(el)}`);
        break;
      }
    }
  }
  return [...new Set(out)];
}

/** The ink two glyphs on neighbouring lines share, in CSS px², split by where it comes from. Each glyph is drawn
 *  alone, in its own font at its own size, at 4× on a scratch canvas, and so is its base letter (the first code
 *  point of its canonical decomposition: "o" for "ộ", "E" for "Ệ"); what the base letter does not cover is the
 *  glyph's marks (the circumflex, the tilde, the horn, the dot below). A pixel counts when it is at least a third
 *  covered. `all` is every shared pixel; `marks` only those where a mark of either glyph meets the other glyph. */
function inkOverlap(a, b) {
  const left = Math.max(a.left, b.left) - 1, right = Math.min(a.right, b.right) + 1;
  const top = Math.max(a.top, b.top) - 1, bottom = Math.min(a.bottom, b.bottom) + 1;
  if (right <= left || bottom <= top) return { all: 0, marks: 0 };
  const S = 4, w = Math.ceil((right - left) * S), h = Math.ceil((bottom - top) * S);
  const canvas = (window.__lcInk ??= document.createElement("canvas"));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const draw = (ink, text) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(S, 0, 0, S, -left * S, -top * S);
    ctx.font = ink.font;
    ctx.fillStyle = "#000";
    ctx.fillText(text, ink.box.left, ink.baseline);
    const data = ctx.getImageData(0, 0, w, h).data, on = new Uint8Array(w * h);
    for (let i = 0; i < on.length; i++) on[i] = data[i * 4 + 3] > 85 ? 1 : 0;
    return on;
  };
  const layers = (ink) => {
    const glyph = draw(ink, ink.g);
    const base = Array.from(ink.g.normalize("NFD"))[0];
    if (base === ink.g) return { glyph, marks: null };
    const plain = draw(ink, base);
    return { glyph, marks: glyph.map((on, i) => (on && !plain[i] ? 1 : 0)) };
  };
  const one = layers(a), two = layers(b);
  let all = 0, marks = 0;
  for (let i = 0; i < one.glyph.length; i++) {
    if (!one.glyph[i] || !two.glyph[i]) continue;
    all++;
    if (one.marks?.[i] || two.marks?.[i]) marks++;
  }
  return { all: all / (S * S), marks: marks / (S * S) };
}

/** In tight-leading text (line height under 1.4 em: display titles, the hero, snug labels), Vietnamese marks that
 *  run into the line above or below: a stacked circumflex and tone mark into a descender, a dot below into the marks under it.
 *  Glyph pairs whose ink boxes overlap are drawn (inkOverlap). The tight leading is the English design: there a
 *  descender may graze an ascender ("g" over "f", "p" over the dot of "i"), and the same letters do so in
 *  Vietnamese, so only ink a mark adds counts: 0.25 px² of it is a collision. Also the most mark ink found. */
function lineCollisions(skip) {
  const groups = new Map();
  for (const ink of pageText(skip)) {
    // A word's mask and its characters (the hero, the split titles) are inline blocks inside one title.
    const block = blockOf(ink.el.closest(".hero-word-mask, .fx-split-mask")?.parentElement ?? ink.el);
    const style = getComputedStyle(block);
    if (!(parseFloat(style.lineHeight) < 1.4 * parseFloat(style.fontSize))) continue;
    if (!groups.has(block)) groups.set(block, []);
    groups.get(block).push(ink);
  }
  const hits = [];
  let blocks = 0, multiLine = 0, pairs = 0, worst = 0, worstAt = "";
  for (const [block, inks] of groups) {
    blocks++;
    const lines = [];
    for (const ink of [...inks].sort((a, b) => a.baseline - b.baseline)) {
      const line = lines.at(-1);
      if (line && ink.baseline - line.baseline < 0.4 * ink.size) line.inks.push(ink);
      else lines.push({ baseline: ink.baseline, inks: [ink] });
    }
    if (lines.length > 1) multiLine++;
    for (let i = 0; i + 1 < lines.length; i++) {
      for (const upper of lines[i].inks) {
        for (const lower of lines[i + 1].inks) {
          if (Math.min(upper.right, lower.right) - Math.max(upper.left, lower.left) <= 0 || lower.top >= upper.bottom) continue;
          pairs++;
          const at = `"${upper.g}" (line ${i + 1}) over "${lower.g}" (line ${i + 2}) in ${describe(block)}`;
          const shared = inkOverlap(upper, lower);
          if (shared.marks > worst) { worst = shared.marks; worstAt = at; }
          if (shared.marks >= 0.25) hits.push(`${at}: a mark runs into the other line (${Math.round(shared.marks * 100) / 100} px² of ink)`);
        }
      }
    }
  }
  const round = (px) => Math.round(px * 100) / 100;
  return { hits: [...new Set(hits)], blocks, multiLine, pairs, worst: round(worst), worstAt };
}

/** Text that crosses its own block or the viewport, outside scrollers built to overflow, and sideways scroll. */
function textOverflow() {
  const out = new Map();
  for (const ink of pageText("[data-snap-row], [role='marquee']")) {
    let scroller = false;
    for (let el = ink.el; el && el !== document.body; el = el.parentElement) {
      if (/^(?:auto|scroll)$/.test(getComputedStyle(el).overflowX)) { scroller = true; break; }
    }
    if (scroller) continue;
    const block = blockOf(ink.el);
    const rect = block.getBoundingClientRect();
    const over = Math.max(ink.box.right - rect.right, rect.left - ink.box.left, ink.box.right - innerWidth, -ink.box.left);
    if (over > 1) out.set(block, Math.max(out.get(block) ?? 0, over));
  }
  return {
    sideways: document.documentElement.scrollWidth > innerWidth + 1,
    clipped: [...out].map(([block, over]) => `${describe(block)} overflows by ${Math.round(over)}px`),
  };
}

/** The hero headline: size, lines, the ink gap to the pitch below it, and whether the copy fits the screen. */
function heroLayout(navLabel) {
  const h1 = document.querySelector("#home h1");
  const pitch = document.querySelector("#home h1 + *");
  if (!h1 || !pitch) return null;
  const head = graphemes(h1), below = graphemes(pitch);
  const baselines = [];
  for (const ink of [...head].sort((a, b) => a.baseline - b.baseline)) if (!baselines.length || ink.baseline - baselines.at(-1) > 0.4 * ink.size) baselines.push(ink.baseline);
  const overlaps = head.filter((a) => below.some((b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5)).map((ink) => ink.g);
  const copy = h1.closest(".hero-copy") ?? h1.parentElement;
  const copyInk = graphemes(copy);
  return {
    fontSize: parseFloat(getComputedStyle(h1).fontSize),
    lines: baselines.length,
    gap: Math.round((Math.min(...below.map((ink) => ink.top)) - Math.max(...head.map((ink) => ink.bottom))) * 10) / 10,
    overlaps,
    copyTop: Math.round(Math.min(...copyInk.map((ink) => ink.top))),
    copyBottom: Math.round(Math.max(...copyInk.map((ink) => ink.bottom))),
    viewport: innerHeight,
    navBottom: Math.round([...document.querySelectorAll("nav[aria-label]")].find((nav) => nav.getAttribute("aria-label") === navLabel)?.getBoundingClientRect().bottom ?? 0),
  };
}

/** The Pricing "Focus" cells (dictionary pricing.focus): each value's lines and the room left in its cell. */
function focusCells(label) {
  return [...document.querySelectorAll("#pricing span")].filter((el) => el.textContent.trim() === label && el.children.length === 0).map((tag) => {
    const cell = tag.parentElement;
    const value = cell.querySelector(".display");
    const style = getComputedStyle(cell);
    const inner = cell.getBoundingClientRect().right - parseFloat(style.paddingRight);
    const ink = graphemes(value);
    const tops = new Set(ink.map((g) => Math.round(g.baseline)));
    return { text: value.textContent.trim(), lines: tops.size, room: Math.round(inner - Math.max(...ink.map((g) => g.box.right))) };
  });
}

/** English strings and English-reading lines in what a Vietnamese page renders: its visible text, its labels and
 *  its title. Text marked as another language (the switch's lang="en" link) is left out. */
function englishOnPage(strings) {
  const foreign = [...document.body.querySelectorAll("[lang]")].filter((el) => !/^vi\b/i.test(el.getAttribute("lang")));
  // Read the visible text with those elements taken out for a moment (their inline display restored after).
  const display = foreign.map((el) => el.style.getPropertyValue("display"));
  foreign.forEach((el) => el.style.setProperty("display", "none"));
  const text = document.body.innerText;
  foreign.forEach((el, i) => (display[i] ? el.style.setProperty("display", display[i]) : el.style.removeProperty("display")));
  const NAMES = ["aria-label", "placeholder", "data-cursor", "alt", "title", "aria-description", "aria-roledescription"];
  const labels = [...document.body.querySelectorAll(NAMES.map((name) => `[${name}]`).join(","))].filter((el) => !foreign.some((f) => f.contains(el))).flatMap((el) => NAMES.map((name) => el.getAttribute(name)).filter(Boolean));
  const head = [document.title, document.querySelector('meta[name="description"]')?.getAttribute("content") ?? ""];
  const all = [text, ...labels, ...head].join("\n");
  const STOP = new Set("the and with your our we you for of to in on is are this that from by or it be an at as can will what how who when not all more about into its their they them us".split(" "));
  const vietnamese = /[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/;
  const sentences = all.split("\n").map((line) => line.trim()).filter((line) => line && !vietnamese.test(line)).filter((line) => {
    const words = line.toLowerCase().match(/\p{L}+/gu) ?? [];
    return words.length >= 3 && words.filter((word) => STOP.has(word)).length >= 2;
  });
  return { found: strings.filter((english) => all.includes(english)), sentences: [...new Set(sentences)], nextNotFound: all.includes("This page could not be found") };
}

/** Same-site links and form targets that leave the Vietnamese pages (the switch and shared files excepted). */
function siteLinks() {
  return [...document.querySelectorAll("a[href^='/'], form[action^='/']")].map((el) => el.getAttribute("href") ?? el.getAttribute("action"));
}

/** The cursor label over a [data-cursor] target: its text, its ink inside the disc (a circle), the margin left. */
function cursorFit() {
  const cursor = document.querySelector("[data-fx-cursor-root]");
  const label = cursor?.querySelector(".fx-cursor-label");
  const disc = cursor?.querySelector(".fx-cursor-disc");
  if (!label || !disc) return null;
  const d = disc.getBoundingClientRect();
  const border = parseFloat(getComputedStyle(disc).borderTopWidth) * (d.width / disc.offsetWidth);
  const cx = d.left + d.width / 2, cy = d.top + d.height / 2, radius = Math.min(d.width, d.height) / 2 - border;
  const ink = graphemes(label);
  const corners = ink.flatMap((g) => [[g.left, g.top], [g.right, g.top], [g.left, g.bottom], [g.right, g.bottom]]);
  const margin = Math.min(...corners.map(([x, y]) => radius - Math.hypot(x - cx, y - cy)));
  return { state: cursor.dataset.state, text: label.textContent, shown: ink.map((g) => g.g).join(""), opacity: parseFloat(getComputedStyle(label).opacity), disc: Math.round(d.width), margin: Math.round(margin * 10) / 10, inside: ink.length > 0 && margin >= 0 };
}

/** Wraps every visible run of text that holds a Vietnamese letter, and only characters the site's faces cover, in
 *  an element of its own with `attribute` (a span, or a tspan in SVG): Chromium reports the fonts of a node's whole
 *  subtree, so a run must stand alone for its fonts to be its own. Arrows and symbols beside it ("→", "↗", "▾",
 *  which neither face has, in English either) stay outside. Inline wrappers inherit everything, so no glyph changes
 *  font. Returns the number of runs. */
function markVietnameseText(attribute) {
  const run = new RegExp(`[${FACE_RANGE}]+`, "g"), letter = new RegExp(`[${VI_LETTER}]`);
  const nodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || el.closest("script, style, noscript, template") || !el.checkVisibility({ checkVisibilityCSS: true }) || !letter.test(node.data)) continue;
    nodes.push(node);
  }
  let count = 0;
  for (const node of nodes) {
    const svg = node.parentElement.closest("svg");
    // From the last run back, so the earlier runs keep their offsets in the node.
    for (const match of [...node.data.matchAll(run)].filter((found) => letter.test(found[0])).reverse()) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const wrapper = svg ? document.createElementNS("http://www.w3.org/2000/svg", "tspan") : document.createElement("span");
      wrapper.setAttribute(attribute, "");
      range.surroundContents(wrapper);
      count++;
    }
  }
  return count;
}

const PAGE_LIB = [graphemes, pageText, inkOverlap, blockOf, describe, markVietnameseText].map(String).join("\n") + `\nconst FACE_RANGE = ${JSON.stringify(FACE_RANGE)}, VI_LETTER = ${JSON.stringify(VI_LETTER)};`;
/** Runs an in-page helper (with the helpers above in scope) on the page, with one JSON argument. */
const inPage = (page, fn, arg) => page.evaluate(`(() => { ${PAGE_LIB}\nreturn (${fn})(${JSON.stringify(arg ?? null)}); })()`);

// ---------------------------------------------------------------------------------------------------------------

/** `{ path: text }` for every string leaf of a JSON-like value. */
function flatten(value, path = "", out = new Map()) {
  if (typeof value === "string") out.set(path, value);
  else if (Array.isArray(value)) value.forEach((item, i) => flatten(item, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) flatten(item, `${path}.${key}`, out);
  return out;
}

/** The parts of a string between its "{name}" placeholders that are long enough to search for. */
const searchable = (text, words) => text.split(/\{\w+\}/).map((part) => part.replace(/\s+/g, " ").trim()).filter((part) => part.length >= 8 && part.split(" ").length >= words);

/** English strings that must never show on a Vietnamese page: UI strings that differ in Vietnamese (2+ words),
 *  English content text (3+ words) that differs from its Vietnamese twin, and the English legal sentences. */
function englishStrings() {
  const out = [];
  const pairs = (en, vi, words) => {
    const english = flatten(en), vietnamese = flatten(vi);
    for (const [path, text] of english) if (vietnamese.get(path) !== text) out.push(...searchable(text, words));
  };
  pairs(dictionary("en"), dictionary("vi"), 2);
  const files = (dir) => readdirSync(new URL(dir, ROOT), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? (dir === "content/" && entry.name === "vi" ? [] : files(`${dir}${entry.name}/`)) : [`${dir}${entry.name}`]));
  for (const file of files("content/")) {
    const twin = file.replace(/^content\//, "content/vi/");
    if (!existsSync(new URL(twin, ROOT))) continue;
    const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
    if (file.endsWith(".json")) pairs(JSON.parse(read(file)), JSON.parse(read(twin)), 3);
    if (file.endsWith(".md")) {
      const vietnamese = read(twin);
      const plain = read(file).replace(/^---[\s\S]*?\n---\n/, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`#>]/g, " ");
      for (const sentence of plain.split(/\n+|(?<=[.!?:;])\s+/)) {
        const text = sentence.replace(/^\s*[-+\d.]+\s+/, "").replace(/\s+/g, " ").trim();
        if (text.split(" ").length >= 4 && !vietnamese.includes(text)) out.push(...searchable(text, 4));
      }
    }
  }
  return [...new Set(out)];
}

/** The sitemap's routes, by language. */
async function sitemapRoutes(base) {
  const xml = await (await fetch(new URL("/sitemap.xml", base))).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  return { vi: paths.filter((path) => path.startsWith("/vi/")), en: paths.filter((path) => !path.startsWith("/vi/")) };
}

/** Steps through the page so in-view effects run, then back to the top, and waits for the last ones to land. */
async function settle(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1500);
}

/** A context for these checks: the intro skipped (a seen session), the desktop's reported GPU fixed (2k globe). */
async function newContext(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(30000);
  await context.addInitScript((key) => { try { sessionStorage.setItem(key, "1"); } catch { /* storage blocked: the gate skips the intro too */ } }, INTRO_SESSION_KEY);
  await context.addInitScript(fakeGpu, SOFTWARE_RENDERER);
  return context;
}

async function open(page, base, route, waitUntil = "networkidle") {
  await page.goto(new URL(route, base).href, { waitUntil });
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

/** The platform fonts Chromium drew each marked element's own text with (DevTools protocol). */
async function platformFonts(page, attribute) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: `[${attribute}]` });
    const used = new Map();
    const fallback = [];
    for (const nodeId of nodeIds) {
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      for (const font of fonts) {
        used.set(font.familyName, (used.get(font.familyName) ?? 0) + font.glyphCount);
        if (!font.isCustomFont) fallback.push(font.familyName);
      }
    }
    return { nodes: nodeIds.length, used: Object.fromEntries(used), fallback: [...new Set(fallback)] };
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/** Runs every check; returns the report lines (`log` also gets each one as it lands). */
export async function localeChecks(browser, base, { log = () => {} } = {}) {
  const done = [];
  done.push = (...lines) => { lines.forEach((line) => log(line)); return Array.prototype.push.apply(done, lines); };
  const leaks = englishStrings();
  const routes = await sitemapRoutes(base);
  assert.ok(routes.vi.length >= 12 && routes.vi.length === routes.en.length, `the sitemap lists every page in both languages (${routes.en.length} English, ${routes.vi.length} Vietnamese)`);
  const t = dictionary("vi");

  // 1. The fine-pointer desktop with motion (split titles, the pinned hero, the cursor), after every reveal has
  //    landed: masks, clipping ancestors, line collisions and English on every Vietnamese page.
  {
    for (const width of [1440, 1024]) {
      const context = await newContext(browser, { viewport: { width, height: width === 1440 ? 1000 : 768 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let masks = 0, minTop = Infinity, minTopChar = "", pairs = 0, rings = { room: Infinity, at: "" };
      for (const route of width === 1440 ? routes.vi : ["/vi/"]) {
        await open(page, base, route);
        await page.waitForFunction(() => document.documentElement.hasAttribute("data-fx"), null, { timeout: 10000 });
        await settle(page);
        const mask = await inPage(page, maskInk);
        assert.deepEqual(mask.clipped, [], `desktop ${width}px ${route}: no glyph (a stacked diacritic, a descender) is cut by its mask`);
        masks += mask.count;
        if (mask.minTop < minTop) ({ minTop, minTopChar } = mask);
        assert.deepEqual(await inPage(page, clippedByAncestors), [], `desktop ${width}px ${route}: no glyph is cut by a clipping box`);
        const ring = await inPage(page, svgTextInk);
        assert.deepEqual(ring.clipped, [], `desktop ${width}px ${route}: the ring badges keep every glyph inside their svg`);
        if (ring.count && ring.room < rings.room) rings = { room: ring.room, at: ring.roomAt };
        const lines = await inPage(page, lineCollisions);
        assert.deepEqual(lines.hits, [], `desktop ${width}px ${route}: no Vietnamese mark runs into the line next to it`);
        pairs += lines.pairs;
        if (route === "/vi/") {
          const hero = await inPage(page, heroLayout, t.nav.label);
          assert.deepEqual(hero.overlaps, [], `desktop ${width}px: the headline's ink never touches the pitch (${JSON.stringify(hero)})`);
          assert.ok(hero.gap >= 4, `desktop ${width}px: the headline keeps clear of the pitch (${JSON.stringify(hero)})`);
          assert.ok(hero.copyTop >= hero.navBottom && hero.copyBottom <= hero.viewport, `desktop ${width}px: the pinned hero's copy fits the screen (${JSON.stringify(hero)})`);
          done.push(`locale: desktop ${width}px /vi/ hero: headline ${hero.fontSize}px on ${hero.lines} lines, ${hero.gap}px clear of the pitch, copy within the screen (${hero.copyTop}–${hero.copyBottom} of ${hero.viewport}px)`);
        }
        if (width === 1440) {
          const shown = await inPage(page, englishOnPage, leaks);
          assert.deepEqual(shown.found, [], `desktop ${route}: no English UI or copy`);
          assert.deepEqual(shown.sentences, [], `desktop ${route}: no English sentence`);
          assert.equal(shown.nextNotFound, false, `desktop ${route}: Next's default not-found text never renders`);
        }
      }
      assert.ok(masks > 0, `desktop ${width}px: the Vietnamese pages have masked text to check (precondition)`);
      assert.deepEqual(errors, [], `desktop ${width}px: no page errors`);
      done.push(`locale: desktop ${width}px with motion: ${masks} masked glyphs keep their ink inside the masks (tightest top margin ${minTop}px, "${minTopChar}"); no glyph cut by a clipping box${rings.room < Infinity ? ` (ring badges ${rings.room}px inside their svg at the closest)` : ""}; no mark runs into a neighbouring line (${pairs} close glyph pairs drawn)`);
      if (width === 1440) done.push(`locale: ${routes.vi.length} Vietnamese pages, hydrated, show none of ${leaks.length} English strings and no English sentence`);
      await context.close();
    }
  }

  // 2. Widths, in the reduced-motion end state (the layout without the split titles): every Vietnamese page fits,
  //    no glyph is cut, no mark runs into a neighbouring line, and the hero headline keeps clear of the pitch.
  for (const width of WIDTHS) {
    const context = await newContext(browser, { viewport: { width, height: width >= 1024 ? 1000 : 844 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    let pairs = 0, multiLine = 0, hero = null, focus = [], rings = Infinity;
    for (const route of routes.vi) {
      await open(page, base, route);
      const fit = await inPage(page, textOverflow);
      assert.equal(fit.sideways, false, `${route} at ${width}px: no sideways scroll`);
      assert.deepEqual(fit.clipped, [], `${route} at ${width}px: every text box fits its block and the viewport`);
      assert.deepEqual(await inPage(page, clippedByAncestors), [], `${route} at ${width}px: no glyph is cut by a clipping box`);
      const ring = await inPage(page, svgTextInk);
      assert.deepEqual(ring.clipped, [], `${route} at ${width}px: the ring badges keep every glyph inside their svg`);
      if (ring.count) rings = Math.min(rings, ring.room);
      const lines = await inPage(page, lineCollisions);
      assert.deepEqual(lines.hits, [], `${route} at ${width}px: no Vietnamese mark runs into the line next to it`);
      multiLine += lines.multiLine;
      pairs += lines.pairs;
      if (route === "/vi/") {
        hero = await inPage(page, heroLayout, t.nav.label);
        assert.deepEqual(hero.overlaps, [], `/vi/ at ${width}px: the headline's ink never touches the pitch (${JSON.stringify(hero)})`);
        assert.ok(hero.gap >= 4, `/vi/ at ${width}px: the headline keeps clear of the pitch (${JSON.stringify(hero)})`);
        focus = await inPage(page, focusCells, t.pricing.focus);
        assert.ok(focus.length > 0 && focus.every((cell) => cell.room >= 0), `/vi/ at ${width}px: the Pricing ${t.pricing.focus} values fit their cells (${JSON.stringify(focus)})`);
      }
    }
    const roomiest = focus.reduce((least, cell) => (cell.room < least.room ? cell : least), focus[0]);
    done.push(`locale: ${routes.vi.length} Vietnamese pages fit ${width}px (no overflow, no glyph cut, ring badges ${rings}px inside; ${multiLine} multi-line tight titles, ${pairs} close glyph pairs, no mark runs into a neighbouring line); hero headline ${hero.fontSize}px on ${hero.lines} lines, ${hero.gap}px clear of the pitch; Pricing "${roomiest.text}" ${roomiest.lines} line(s), ${roomiest.room}px to spare`);
    await context.close();
  }

  // 3. The cursor's labels fit the disc (fine-pointer desktop), in capitals with their marks, drawn in Inter.
  {
    const context = await newContext(browser);
    const page = await context.newPage();
    await open(page, base, "/vi/");
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-fx"), null, { timeout: 10000 });
    const fits = [];
    for (const label of [t.cursor.view, t.cursor.open, t.cursor.drag]) {
      const target = page.locator(`main [data-cursor="${label}"]:not(.hero-scene)`).first();
      assert.equal(await target.count(), 1, `a Vietnamese page carries the "${label}" cursor label (precondition)`);
      await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      const box = await target.boundingBox();
      await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2 - 20);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
      await page.waitForFunction(() => {
        const cursor = document.querySelector("[data-fx-cursor-root]");
        const disc = cursor?.querySelector(".fx-cursor-disc");
        return cursor?.dataset.state === "label" && disc.getBoundingClientRect().width > disc.offsetWidth * 2.15 && parseFloat(getComputedStyle(cursor.querySelector(".fx-cursor-label")).opacity) > 0.99;
      }, null, { timeout: 4000 }).catch(() => {});
      const fit = await inPage(page, cursorFit);
      const capitals = label.toLocaleUpperCase("vi");
      assert.ok(fit && fit.state === "label" && fit.text === label && fit.shown === capitals && fit.opacity > 0.99, `the cursor shows "${capitals}" over its target (${JSON.stringify(fit)})`);
      assert.ok(fit.inside, `the cursor label "${capitals}" sits inside the disc (${JSON.stringify(fit)})`);
      await page.evaluate(() => document.querySelector("[data-fx-cursor-root] .fx-cursor-label").setAttribute("data-lc-cursor", ""));
      const fonts = await platformFonts(page, "data-lc-cursor");
      assert.ok(fonts.nodes === 1 && fonts.fallback.length === 0 && Object.keys(fonts.used).every((family) => /^Inter\b/.test(family)), `the cursor label "${capitals}" is drawn in Inter, marks included (${JSON.stringify(fonts)})`);
      fits.push(`${capitals} ${fit.margin}px in ${fit.disc}px`);
    }
    await context.close();
    done.push(`locale: the cursor's Vietnamese labels sit inside the orange disc, in capitals with their marks, drawn in Inter (room to the rim: ${fits.join(", ")})`);
  }

  // 4. Without JavaScript: no English, and links stay in Vietnamese.
  {
    const context = await newContext(browser, { javaScriptEnabled: false });
    const page = await context.newPage();
    for (const route of routes.vi) {
      await open(page, base, route, "load");
      const shown = await inPage(page, englishOnPage, leaks);
      assert.deepEqual(shown.found, [], `no-JS ${route}: no English UI or copy`);
      assert.deepEqual(shown.sentences, [], `no-JS ${route}: no English sentence`);
      assert.equal(shown.nextNotFound, false, `no-JS ${route}: Next's default not-found text never renders`);
      const english = (await page.evaluate(siteLinks)).filter((href) => !href.startsWith("/vi/") && !href.startsWith("//") && !SWITCH.test(href) && !SHARED.test(href.split(/[?#]/)[0]));
      assert.deepEqual(english, [], `no-JS ${route}: links stay in Vietnamese`);
    }
    await context.close();
    done.push(`locale: ${routes.vi.length} Vietnamese pages without JavaScript show no English and link only to Vietnamese pages, shared files or the switch`);
  }

  // 5. Fonts: English never downloads a Vietnamese subset; Vietnamese pages do, and draw every letter in them.
  {
    const fontsOf = async (page, log) => [...new Set([...log, ...(await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name)))])].filter((url) => /\.woff2(?:$|\?)/.test(url));
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const english = await newContext(browser, { viewport });
      const page = await english.newPage();
      const log = [];
      page.on("request", (request) => log.push(request.url()));
      for (const route of viewport.width === 1440 ? routes.en : ["/"]) {
        await open(page, base, route);
        if (route === "/") await settle(page);
        assert.deepEqual((await fontsOf(page, log)).filter((url) => /vietnamese/.test(url)), [], `English ${route} at ${viewport.width}px downloads no Vietnamese subset`);
      }
      await english.close();
      const vietnamese = await newContext(browser, { viewport });
      const vi = await vietnamese.newPage();
      const viLog = [];
      vi.on("request", (request) => viLog.push(request.url()));
      for (const route of ["/vi/", "/vi/contact/"]) {
        await open(vi, base, route);
        if (route === "/vi/") await settle(vi);
        const loaded = await fontsOf(vi, viLog);
        assert.ok(loaded.some((url) => /inter_vietnamese/.test(url)), `Vietnamese ${route} at ${viewport.width}px loads the Vietnamese Inter subset (${loaded.join(", ")})`);
        const mono = await vi.evaluate((letter) => [...document.body.querySelectorAll("*")].some((el) => /SG Mono/.test(getComputedStyle(el).fontFamily) && el.checkVisibility() && [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && new RegExp(`[${letter}]`).test(node.data))), VI_LETTER);
        if (mono) assert.ok(loaded.some((url) => /jetbrains_mono_vietnamese/.test(url)), `Vietnamese ${route} at ${viewport.width}px loads the Vietnamese mono subset for its mono labels`);
        const marked = await inPage(vi, markVietnameseText, "data-lc-vi");
        const fonts = await platformFonts(vi, "data-lc-vi");
        assert.ok(marked > 20 && fonts.nodes === marked, `Vietnamese ${route} at ${viewport.width}px: text to check (precondition: ${marked} runs)`);
        assert.deepEqual(fonts.fallback, [], `Vietnamese ${route} at ${viewport.width}px: every Vietnamese letter is drawn by the site's fonts (${JSON.stringify(fonts.used)})`);
        assert.ok(Object.keys(fonts.used).every((family) => /^(?:Inter|JetBrains Mono)\b/.test(family)), `Vietnamese ${route} at ${viewport.width}px: only Inter and JetBrains Mono draw the text (${JSON.stringify(fonts.used)})`);
      }
      await vietnamese.close();
    }
    done.push(`locale: ${routes.en.length} English pages never download the Vietnamese subsets (home scrolled through at 1440 and 390px); Vietnamese pages load them and draw every Vietnamese letter in Inter or JetBrains Mono, no system fallback`);
  }

  // 6. The redirect and the cookie, over HTTP.
  {
    const get = (path, headers = {}) => fetch(new URL(path, base), { redirect: "manual", headers });
    const where = (response) => { const url = new URL(response.headers.get("location"), base); return url.pathname + url.search; };
    // The Worker drops Secure only on a plain-http loopback preview, where a browser could refuse the cookie.
    const secure = new URL(base).protocol === "https:" || !LOOPBACK.test(new URL(base).hostname) ? "; Secure" : "";
    const cookie = (value) => `${LOCALE_COOKIE}=${value}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
    let response = await get("/about/?lang=vi&utm_source=x");
    assert.equal(response.status, 302, "?lang=vi redirects");
    assert.equal(where(response), "/vi/about/?utm_source=x", "?lang=vi lands on the twin and keeps the other parameters");
    assert.equal(response.headers.get("set-cookie"), cookie("vi"), "?lang=vi stores the choice for a year");
    response = await get("/services/applied-ai/?lang=en", { cookie: `${LOCALE_COOKIE}=vi` });
    assert.deepEqual([response.status, where(response), response.headers.get("set-cookie")], [302, "/services/applied-ai/", cookie("en")], "?lang=en returns to the clean English page and replaces the stored choice");
    response = await get("/no-such-page/?lang=vi");
    assert.deepEqual([response.status, where(response)], [302, "/vi/"], "?lang=vi on a page without a twin lands on the Vietnamese home");
    response = await get("/services/applied-ai/?ref=a", { "x-sg-test-country": "VN" });
    assert.equal(response.status, 302, "a first visit from Vietnam is redirected");
    assert.equal(where(response), "/vi/services/applied-ai/?ref=a", "a visitor from Vietnam lands on the twin, parameters kept");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("vary"), "Cookie, Accept-Language");
    assert.equal(response.headers.get("set-cookie"), null, "the region redirect stores no choice");
    assert.equal(where(await get("/", { "x-sg-test-country": "vn" })), "/vi/", "the home page has its twin too");
    response = await get("/about/", { "accept-language": "vi-VN,vi;q=0.9,en;q=0.8" });
    assert.deepEqual([response.status, where(response)], [302, "/vi/about/"], "a Vietnamese browser is sent to /vi/");
    assert.equal((await get("/about/", { "accept-language": "en-US,vi;q=0.9" })).status, 200, "only the browser's first language counts");
    assert.equal((await get("/about/", { "x-sg-test-country": "VN", cookie: `${LOCALE_COOKIE}=en` })).status, 200, "the cookie wins over the region");
    assert.equal((await get("/about/", { "accept-language": "vi", cookie: `other=1; ${LOCALE_COOKIE}=en` })).status, 200, "the cookie wins over the browser");
    assert.equal((await get("/about/", { "x-sg-test-country": "VN", cookie: `${LOCALE_COOKIE}=vi` })).status, 200, "a visitor who chose is never moved, whatever the choice");
    assert.equal((await get("/vi/about/", { cookie: `${LOCALE_COOKIE}=en`, "x-sg-test-country": "US" })).status, 200, "a /vi/ URL is never moved");
    assert.equal((await get("/no-such-page/", { "x-sg-test-country": "VN" })).status, 404, "no twin, no redirect");
    assert.equal((await get("/about/", { "x-sg-test-country": "US" })).status, 200, "a visitor from elsewhere stays on English");
    assert.equal((await get("/about/")).status, 200, "the preview ignores its cached request.cf");
    done.push(`locale: ?lang= stores sg_lang for a year${secure ? "" : " (not Secure on the plain-http loopback preview)"} and lands on the twin or the language's home; VN or a Vietnamese first language lands on an existing /vi/ twin (no-store, Vary); the cookie wins; /vi/ URLs are never moved`);
  }

  // 7. The switch in a browser: keyboard, names, current language, with and without JavaScript, and the cookie;
  //    and the phone menu's switch without JavaScript.
  for (const javaScriptEnabled of [true, false]) {
    const context = await newContext(browser, { javaScriptEnabled, extraHTTPHeaders: { "x-sg-test-country": "VN" } });
    const page = await context.newPage();
    await open(page, base, "/about/", "load");
    assert.equal(new URL(page.url()).pathname, "/vi/about/", "a first visit from Vietnam lands on the Vietnamese twin");
    assert.equal(await page.evaluate(() => document.documentElement.lang), "vi");
    const english = page.getByRole("link", { name: "EN – English", exact: true });
    const vietnamese = page.getByRole("link", { name: "VI – Tiếng Việt", exact: true });
    assert.equal(await vietnamese.getAttribute("aria-current"), "true", "the current language is marked");
    assert.equal(await english.getAttribute("aria-current"), null);
    assert.equal(await english.getAttribute("hreflang"), "en");
    // Tab from the top of the page until the English link has focus.
    let presses = 0;
    while (presses < 40 && !(await english.evaluate((el) => el === document.activeElement))) {
      await page.keyboard.press("Tab");
      presses++;
    }
    assert.equal(await english.evaluate((el) => el === document.activeElement && el.matches(":focus-visible")), true, `the switch is reached by Tab (${presses} presses) and shows its focus ring`);
    await Promise.all([page.waitForURL((url) => url.pathname === "/about/" && !url.search), page.keyboard.press("Enter")]);
    assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
    assert.ok((await context.cookies()).some((cookie) => cookie.name === LOCALE_COOKIE && cookie.value === "en"), "the choice is stored");
    await open(page, base, "/contact/", "load");
    assert.equal(new URL(page.url()).pathname, "/contact/", "with the cookie, a visitor from Vietnam stays on English");
    await Promise.all([page.waitForURL((url) => url.pathname === "/vi/contact/"), page.getByRole("link", { name: "VI – Tiếng Việt", exact: true }).click()]);
    assert.ok((await context.cookies()).some((cookie) => cookie.name === LOCALE_COOKIE && cookie.value === "vi"), "switching back stores Vietnamese");
    await context.close();
    done.push(`locale: the EN/VI switch works by keyboard ${javaScriptEnabled ? "with" : "without"} JavaScript, marks the current language and is remembered over the region`);
  }
  {
    const context = await newContext(browser, { viewport: { width: 390, height: 844 }, javaScriptEnabled: false, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await open(page, base, "/vi/services/", "load");
    await page.getByRole("navigation", { name: t.nav.label }).locator("summary").click();
    const english = page.getByRole("link", { name: "English", exact: true });
    assert.equal(await english.isVisible(), true, "the phone menu shows the switch");
    assert.equal(await page.getByRole("link", { name: "Tiếng Việt", exact: true }).getAttribute("aria-current"), "true", "the phone menu marks the current language");
    await Promise.all([page.waitForURL((url) => url.pathname === "/services/"), english.click()]);
    assert.ok((await context.cookies()).some((cookie) => cookie.name === LOCALE_COOKIE && cookie.value === "en"), "the phone menu's choice is stored");
    await context.close();
    done.push("locale: the phone menu's switch works without JavaScript and is remembered");
  }
  return done;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2];
  if (!base) {
    console.error("usage: node scripts/locale-checks.mjs <base URL of the preview>");
    process.exit(2);
  }
  // Never hold the heavy-job lock for long: a stuck page fails the run instead of hanging it.
  setTimeout(() => { console.error("Locale checks timed out after 9 minutes."); process.exit(1); }, 9 * 60 * 1000).unref();
  const { launchBrowser } = await import("./browser-runtime.mjs");
  const browser = await launchBrowser();
  try {
    const done = await localeChecks(browser, base, { log: (line) => console.log(line) });
    console.log(`Locale checks passed: ${done.length} checks.`);
  } finally {
    await browser.close();
  }
}
