// Labs article bodies: Markdown to HTML at build time with markdown-it 15.0.2 (pinned), raw HTML off. Headings h2–h4
// get unique ids and an anchor link; site links follow the page's language; every other link gets
// rel="noopener noreferrer"; images go through contentImage() (upload variants) and, given `imageSize`, carry their
// width and height (src/lib/labs.ts reads them from the files, so nothing moves when they load). Tables and
// strikethrough are off: the spec allows headings, lists, links, images, blockquotes and code. markdownProblems()
// refuses what the renderer would not show as intended, naming the file and the line. Server and build only.
// Erasable TypeScript with explicit .ts imports (scripts/check-content.mjs loads it under --experimental-strip-types).
import MarkdownIt, { type Token } from "markdown-it";
import { contentImage } from "./content-images.ts";
import { HREF, IMAGE } from "./content-schema.ts";
import type { ImageSize } from "./image-size.ts";
import { dictionary, format } from "./i18n/dictionary.ts";
import { localizedHref, type Locale } from "./i18n/locales.ts";

export type RenderedMarkdown = { html: string; headings: { id: string; text: string; level: 2 | 3 | 4 }[]; words: number };
export type RenderOptions = { /** An image's intrinsic size by its path, for width and height. */ imageSize?: (src: string) => ImageSize | undefined };
type LabsEnv = { locale: Locale; headings: RenderedMarkdown["headings"]; words: number } & RenderOptions;

/** The article column is at most 720px wide on a desktop and the full width below 1024px. */
const IMAGE_SIZES = "(min-width: 1024px) 720px, 100vw";
const md = new MarkdownIt("default", { html: false, linkify: false, typographer: false }).disable(["table", "strikethrough"]);
/** Only for validation: with html on, raw HTML shows up as html_block and html_inline tokens, and tables and strikethrough as theirs. */
const raw = new MarkdownIt("default", { html: true });

/** An ASCII id from heading text, Vietnamese included ("Vì sao cần đo Ấ" → "vi-sao-can-do-a"). */
const slugify = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
/** An inline token's readable text: text and inline code, a line break as a space (image descriptions are not read). */
const plain = (token: Token) =>
  (token.children ?? []).map((child) => (child.type === "text" || child.type === "code_inline" ? child.content : child.type === "softbreak" || child.type === "hardbreak" ? " " : "")).join("");
const attr = (token: Token, name: string) => String(token.attrGet(name) ?? "");
const escape = (value: string) => md.utils.escapeHtml(value);

md.core.ruler.push("labs_headings", (state) => {
  const env = state.env as LabsEnv;
  const used = new Set<string>();
  env.headings = [];
  env.words = 0;
  state.tokens.forEach((token, index) => {
    if (token.type === "inline") env.words += plain(token).split(/\s+/).filter(Boolean).length;
    if (token.type !== "heading_open") return;
    const text = plain(state.tokens[index + 1]).trim();
    const base = slugify(text);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    token.attrSet("id", id);
    const level = Number(token.tag.slice(1));
    if (level >= 2 && level <= 4) env.headings.push({ id, text, level: level as 2 | 3 | 4 });
  });
});
md.renderer.rules.heading_close = (tokens, index, _options, env) => {
  const { locale } = env as LabsEnv;
  const id = attr(tokens[index - 2], "id");
  const label = format(dictionary(locale).labs.anchor, { heading: plain(tokens[index - 1]).trim() });
  return `<a class="labs-anchor" href="#${escape(id)}" aria-label="${escape(label)}">#</a></${tokens[index].tag}>\n`;
};
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const { locale } = env as LabsEnv;
  const token = tokens[index];
  const href = attr(token, "href");
  if (href.startsWith("/") && !href.startsWith("//")) token.attrSet("href", localizedHref(href, locale));
  else if (!href.startsWith("#")) token.attrSet("rel", "noopener noreferrer");
  return self.renderToken(tokens, index, options);
};
md.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const image = contentImage(attr(token, "src"), IMAGE_SIZES);
  const alt = self.renderInlineAsText(token.children ?? [], options, env);
  const size = (env as LabsEnv).imageSize?.(attr(token, "src"));
  const attrs = [
    `src="${escape(image.src)}"`,
    image.srcSet ? `srcset="${escape(image.srcSet)}"` : "",
    image.sizes ? `sizes="${escape(image.sizes)}"` : "",
    `alt="${escape(alt)}"`,
    size ? `width="${size.width}" height="${size.height}"` : "",
    'loading="lazy"',
    'decoding="async"',
  ].filter(Boolean);
  return `<img ${attrs.join(" ")}>`;
};

/** An article body as HTML, with its headings (for anchors) and its word count (for the reading time). */
export function renderMarkdown(source: string, locale: Locale, { imageSize }: RenderOptions = {}): RenderedMarkdown {
  const env: LabsEnv = { locale, headings: [], words: 0, imageSize };
  const html = md.render(source, env);
  return { html, headings: env.headings, words: env.words };
}

/** What an article body may not contain, as "<file>, line <n>: <problem>". */
export function markdownProblems(source: string, file: string): string[] {
  const problems: string[] = [];
  const at = (token: Token, parent?: Token) => `${file}, line ${((token.map ?? parent?.map)?.[0] ?? 0) + 1}`;
  for (const token of md.parse(source, {})) {
    if (token.type === "heading_open" && !["h2", "h3", "h4"].includes(token.tag)) problems.push(`${at(token)}: use headings ## to #### only (found ${"#".repeat(Number(token.tag.slice(1)))})`);
    if (token.type !== "inline") continue;
    for (const child of token.children ?? []) {
      if (child.type === "image") {
        const src = attr(child, "src");
        if (!child.content.trim()) problems.push(`${at(child, token)}: the image needs a description (the text in ![…])`);
        if (!IMAGE.test(src)) problems.push(`${at(child, token)}: the image ${JSON.stringify(src)} must be an upload or a site image (/uploads/… or /images/…)`);
      }
      if (child.type === "link_open") {
        const href = attr(child, "href");
        if (!HREF.test(href)) problems.push(`${at(child, token)}: the link ${JSON.stringify(href)} must be a site path such as /contact/ or a full https:// address`);
      }
    }
  }
  for (const token of raw.parse(source, {})) {
    const children = token.children ?? [];
    if (token.type === "html_block" || children.some((child) => child.type === "html_inline")) problems.push(`${at(token)}: raw HTML is not allowed; write it in Markdown`);
    if (token.type === "table_open") problems.push(`${at(token)}: tables are not shown on the site; use a list or paragraphs`);
    if (children.some((child) => child.type === "s_open")) problems.push(`${at(token)}: strikethrough (~~…~~) is not shown on the site`);
  }
  return problems;
}
