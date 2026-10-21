// Parses the restricted Markdown of the legal pages in content/legal/: "## " headings that open
// sections, followed by plain paragraphs separated by blank lines. Anything else (lists, links,
// emphasis, HTML, other heading levels) is rejected, so an edit can never render raw Markdown
// or markup on the page. Erasable TypeScript only (also loaded by scripts/check-content.mjs).
export type LegalSection = { heading: string; paragraphs: string[] };

const INLINE_SYNTAX = /[*_`<>[\]\\|]|&#?\w+;/;
const BLOCK_SYNTAX = /^(?:#|[-+*]\s|\d+[.)]\s|>|```|~~~|[-=]{3,}$)/;

export function parseLegalMarkdown(source: string, file: string): LegalSection[] {
  const body = source.replace(/\r\n?/g, "\n").replace(/^---\n(?:[\s\S]*?\n)?---\n/, "").trim();
  const sections: LegalSection[] = [];
  const errors: string[] = [];
  body.split(/\n\s*\n/).forEach((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const where = `${file}, block ${index + 1}`;
    if (lines[0]?.startsWith("## ")) {
      const heading = lines.shift()!.slice(3).trim();
      if (!heading) errors.push(`${where}: the heading is empty`);
      if (INLINE_SYNTAX.test(heading)) errors.push(`${where}: remove the formatting from the heading "${heading}"`);
      sections.push({ heading, paragraphs: [] });
      if (!lines.length) return;
    }
    for (const line of lines) {
      if (BLOCK_SYNTAX.test(line)) errors.push(`${where}: only "## " headings and plain paragraphs are supported ("${line.slice(0, 40)}")`);
    }
    const paragraph = lines.join(" ");
    if (INLINE_SYNTAX.test(paragraph)) errors.push(`${where}: remove Markdown or HTML formatting (* _ \` < > [ ] \\ | or &entities;)`);
    const current = sections.at(-1);
    if (!current) errors.push(`${where}: start the page with a "## " heading`);
    else current.paragraphs.push(paragraph);
  });
  for (const section of sections) if (!section.paragraphs.length) errors.push(`${file}: the section "${section.heading}" has no text`);
  if (!sections.length && !errors.length) errors.push(`${file}: no sections found`);
  if (errors.length) throw new Error(`Invalid legal page:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
  return sections;
}
