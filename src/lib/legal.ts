// Reads the legal pages from content/legal/*.md at build time (server components only; the
// static export inlines the text, so nothing is fetched at run time).
import fs from "node:fs";
import path from "node:path";
import { parseLegalMarkdown } from "./legal-markdown.ts";
import type { LegalSection } from "./legal-markdown.ts";

export type { LegalSection };
export const LEGAL_PAGES = ["privacy", "terms"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

export function legalSections(page: LegalPage): LegalSection[] {
  const file = `content/legal/${page}.md`;
  return parseLegalMarkdown(fs.readFileSync(path.join(process.cwd(), file), "utf8"), file);
}
