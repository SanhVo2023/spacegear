// Reads the legal pages from content/legal/*.md at build time (server components only; the
// static export inlines the text, so nothing is fetched at run time). `root` is the project
// folder: the cwd in `next build` and in tests, or an explicit folder (check-content, temp copies).
import fs from "node:fs";
import path from "node:path";
import { parseLegalMarkdown } from "./legal-markdown.ts";
import type { LegalSection } from "./legal-markdown.ts";

export type { LegalSection };
export const LEGAL_PAGES = ["privacy", "terms"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

export function legalSections(page: LegalPage, root: string = process.cwd()): LegalSection[] {
  const file = `content/legal/${page}.md`;
  return parseLegalMarkdown(fs.readFileSync(path.join(root, file), "utf8"), file);
}
