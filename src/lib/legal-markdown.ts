// Parses the restricted Markdown of the legal pages in content/legal/: "## " headings that open
// sections, followed by plain paragraphs separated by blank lines. Anything else (lists, links,
// emphasis, HTML, other heading levels) is rejected, so an edit can never render raw Markdown
// or markup on the page. Each problem names the file and the line, and every problem is listed.
// Erasable TypeScript only (also loaded by scripts/check-content.mjs).
export type LegalSection = { heading: string; paragraphs: string[] };

/**
 * Inline Markdown or HTML: emphasis, code, links, tags, escapes, tables, strikethrough and
 * entities. Exported so the CMS field pattern can be tested against it.
 */
export const INLINE_SYNTAX = /[*_`<>[\]\\|]|~~|&#?\w+;/;
const INLINE_ALL = new RegExp(INLINE_SYNTAX.source, "g");
const HEADING_ALL = new RegExp(`#|${INLINE_SYNTAX.source}`, "g");
// Other heading levels, list items, quotes, fences and setext underlines.
const BLOCK_SYNTAX = /^(?:#|[-+*](?:\s|$)|\d+[.)](?:\s|$)|>|```|~~~|[-=]+$)/;
const HEADING = /^##(?:[ \t]+(.*))?$/;
// Blank lines separate blocks, and a "## " line always starts one. The group keeps the
// separators, so line numbers can be counted.
const BLOCK_BREAK = /(\n\s*\n|\n(?=[ \t]*##(?:[ \t]|$)))/m;
const FRONT_MATTER = /^---\n(?:[\s\S]*?\n)?---\n/;
const TEXT_HINT = "write the text without * _ ` < > [ ] \\ | ~~ or &…;";
const HEADING_HINT = "write the heading without # * _ ` < > [ ] \\ | ~~ or &…;";
const CONTEXT = 12;

export class LegalPageError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid legal page:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "LegalPageError";
    this.issues = issues;
  }
}

const newlines = (text: string) => text.split("\n").length - 1;

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** Up to CONTEXT characters on each side of a match, with "…" where the line goes on; never half a surrogate pair. */
function excerpt(line: string, index: number, length: number) {
  let start = Math.max(0, index - CONTEXT);
  let end = Math.min(line.length, index + length + CONTEXT);
  if (start > 0 && isLowSurrogate(line.charCodeAt(start))) start -= 1;
  if (end < line.length && isLowSurrogate(line.charCodeAt(end))) end += 1;
  return `${start > 0 ? "…" : ""}${line.slice(start, end)}${end < line.length ? "…" : ""}`;
}

/** Reports each distinct match of `pattern` in `text` once, with its context. */
function syntaxProblems(text: string, pattern: RegExp, where: string, hint: string, errors: string[]) {
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    errors.push(`${where}: "${match[0]}" in "${excerpt(text, match.index, match[0].length)}": ${hint}`);
  }
}

export function parseLegalMarkdown(source: string, file: string): LegalSection[] {
  // A byte order mark would hide the front matter.
  const normalized = source.replace(/^\u{FEFF}/u, "").replace(/\r\n?/g, "\n");
  const frontMatter = FRONT_MATTER.exec(normalized)?.[0] ?? "";
  const rest = normalized.slice(frontMatter.length);
  const body = rest.trim();
  let lineNo = 1 + newlines(frontMatter) + newlines(rest.slice(0, rest.length - rest.trimStart().length));
  const sections: { section: LegalSection; where: string }[] = [];
  const errors: string[] = [];
  // Text before the first heading is reported once, at its first line.
  let headless = false;

  const parseBlock = (block: string, first: number) => {
    const lines = block.split("\n")
      .map((text, offset) => ({ text: text.trim(), where: `${file}, line ${first + offset}` }))
      .filter(({ text }) => text);
    if (!lines.length) return;
    const heading = HEADING.exec(lines[0].text);
    if (heading) {
      const { where } = lines.shift()!;
      const text = (heading[1] ?? "").trim();
      if (!text) errors.push(`${where}: the heading is empty`);
      else syntaxProblems(text, HEADING_ALL, where, HEADING_HINT, errors);
      sections.push({ section: { heading: text, paragraphs: [] }, where });
      if (!lines.length) return;
    }
    for (const { text, where } of lines) {
      if (BLOCK_SYNTAX.test(text)) errors.push(`${where}: only "## " headings and plain paragraphs are supported ("${text.slice(0, 40)}")`);
      else syntaxProblems(text, INLINE_ALL, where, TEXT_HINT, errors);
    }
    const current = sections.at(-1);
    if (current) current.section.paragraphs.push(lines.map(({ text }) => text).join(" "));
    else if (!headless) {
      headless = true;
      errors.push(`${lines[0].where}: start the page with a "## " heading`);
    }
  };

  if (body) body.split(BLOCK_BREAK).forEach((part, index) => {
    if (index % 2 === 0) parseBlock(part, lineNo);
    lineNo += newlines(part);
  });
  for (const { section, where } of sections) {
    if (!section.paragraphs.length) errors.push(`${where}: the section ${section.heading ? `"${section.heading}" ` : ""}has no text`);
  }
  if (!sections.length && !errors.length) errors.push(`${file}: no sections found`);
  if (errors.length) throw new LegalPageError(errors);
  return sections.map(({ section }) => section);
}
