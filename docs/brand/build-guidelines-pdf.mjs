// Builds docs/brand/guidelines.pdf from docs/brand/guidelines.html (A4, one section per page).
// Each numbered section (from its h2 up to the next) becomes one block. Blocks taller than the A4
// content area are scaled down with CSS zoom until they fit, down to MIN_ZOOM. A block that would
// need less flows over two pages instead, breaking only between figures, tables and table rows.
//   node docs/brand/build-guidelines-pdf.mjs            writes the PDF
//   node docs/brand/build-guidelines-pdf.mjs --measure  only prints each block's height and zoom
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser } from "../../scripts/browser-runtime.mjs";

const HTML = fileURLToPath(new URL("./guidelines.html", import.meta.url));
const PDF = fileURLToPath(new URL("./guidelines.pdf", import.meta.url));
const MM = 96 / 25.4;
const MARGIN = 12; // mm, matches the page's own @page rule
const WIDTH = Math.floor((210 - 2 * MARGIN) * MM); // 703 px
const HEIGHT = Math.floor((297 - 2 * MARGIN) * MM) - 40; // 991 px: slack for zoom rounding, so a block that just fits never pushes its last figure over
const MIN_ZOOM = 0.7;
const measureOnly = process.argv.includes("--measure");

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.emulateMedia({ media: "print" });
  await page.goto(pathToFileURL(HTML).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const blocks = await page.evaluate(({ height, minZoom }) => {
    const main = document.querySelector("main");
    const groups = [];
    for (const node of [...main.childNodes]) {
      if (!groups.length || (node.nodeName === "H2" && !node.classList.contains("keep"))) groups.push([]);
      groups.at(-1).push(node);
    }
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        h2 { break-before: auto !important; margin-top: 0; }
        .pg { break-after: page; }
        .pg:last-child { break-after: auto; }
        .pg.flow figure, .pg.flow table, .pg.flow tr, .pg.flow .tile, .pg.flow .sizes, .pg.flow .hero { break-inside: avoid; }
        .pg.flow h2, .pg.flow h3 { break-after: avoid; }
      }`;
    document.head.append(style);
    return groups.map((nodes) => {
      const pg = document.createElement("div");
      pg.className = "pg";
      main.append(pg);
      pg.append(...nodes);
      const h = pg.getBoundingClientRect().height;
      const zoom = h <= height ? 1 : height / h;
      const fits = zoom >= minZoom;
      if (fits && zoom < 1) pg.style.zoom = String(Math.floor(zoom * 1000) / 1000);
      if (!fits) pg.classList.add("flow");
      const title = pg.querySelector("h2")?.textContent ?? pg.querySelector("h1")?.textContent ?? "?";
      return { title, height: Math.round(h), zoom: fits ? Math.floor(zoom * 1000) / 1000 : 1, flow: !fits };
    });
  }, { height: HEIGHT, minZoom: MIN_ZOOM });
  for (const b of blocks) console.log(`${b.title.padEnd(28)} ${String(b.height).padStart(5)} px  ${b.flow ? "flows over pages" : `zoom ${b.zoom}`}`);
  if (!measureOnly) {
    await page.pdf({ path: PDF, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: `${MARGIN}mm`, bottom: `${MARGIN}mm`, left: `${MARGIN}mm`, right: `${MARGIN}mm` } });
    console.log(`wrote ${PDF}`);
  }
} finally {
  await browser.close();
}
