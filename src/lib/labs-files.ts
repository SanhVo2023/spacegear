// The Labs articles as files (bilingual spec, Part 3): content/articles/<slug>.md (English) and
// content/vi/articles/<slug>.md (Vietnamese), Markdown with YAML front matter, written by the CMS ("Labs").
// The slug is the file name and both languages share it; an article may exist in one language only.
// Sveltia cannot switch its default language off, so it always writes the English file: a Vietnamese-only
// article has an English file whose text fields are empty. A file is "filled" in its language when its title is
// not empty, and then all its text must be. The cover, the dates and the author are shared and must match.
// Read at build time from disk, like the legal pages. next.config.ts imports labsLocales() to decide which Labs
// routes exist, so this module uses only fs, js-yaml and the erasable content schema (scripts/check-content.mjs
// loads it under --experimental-strip-types). The honesty scan (scripts/lib/honesty.mjs) reads these files as
// they are written, front matter and text, in both languages.
import fs from "node:fs";
import path from "node:path";
import { JSON_SCHEMA, load } from "js-yaml";
import { check, image, nullable, object, text } from "./content-schema.ts";
import { LOCALES, type Locale } from "./i18n/locales.ts";

export type ArticleData = { title: string; summary: string; cover: string; coverAlt: string; date: string; updated: string | null; author: string; body: string };
export type ArticleFile = { slug: string; locale: Locale; file: string; data: ArticleData; filled: boolean };

/** Where each language's articles are. */
export const ARTICLE_DIRS: Record<Locale, string> = { en: "content/articles", vi: "content/vi/articles" };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// The slug rule (content-schema SLUG) plus ".md". No Windows device name (con, nul, com1…): Git for Windows
// cannot check such a file out (the same rule as image names).
const FILE = /^(?!(?:con|prn|aux|nul|com\d|lpt\d)\.)[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;
const TEXT_FIELDS = ["title", "summary", "coverAlt", "body"] as const;
const SHARED_FIELDS = ["cover", "date", "updated", "author"] as const;
// The original site's stock art: its Labs article images and its review portraits. An article shows its own image.
const STOCK_COVER = /^\/images\/(?:labs|reviews|team)\//;

/** The front matter, in the order the CMS writes it. Text may be empty in a language the article is not written in. */
export const articleSchema = object({
  title: text({ min: 0, max: 120 }),
  summary: text({ min: 0, max: 200 }),
  cover: image(),
  coverAlt: text({ min: 0, max: 160 }),
  date: text({ max: 10, pattern: DATE, message: "use a date such as 2026-10-23" }),
  updated: nullable(text({ max: 10, pattern: DATE, message: "use a date such as 2026-10-23, or leave it empty" })),
  author: text({ max: 60 }),
});

const realDate = (value: string) => DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Every article file of both languages, parsed, with each field checked (problems name the file and the field). */
export function readArticleFiles(root: string = process.cwd()): { files: ArticleFile[]; issues: string[] } {
  const files: ArticleFile[] = [];
  const issues: string[] = [];
  for (const locale of LOCALES) {
    const dir = ARTICLE_DIRS[locale];
    // The folder spelled out, not path.join(root, dir): Turbopack's file tracing cannot read ARTICLE_DIRS[locale]
    // and would then trace the whole project (a build warning, "unexpected file in NFT list").
    const full = path.join(root, locale === "en" ? "content/articles" : "content/vi/articles");
    if (!fs.existsSync(full)) continue;
    const entries = fs.readdirSync(full, { withFileTypes: true }).filter((entry) => !entry.name.startsWith("."));
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const name = entry.name;
      const file = `${dir}/${name}`;
      if (!entry.isFile()) {
        issues.push(`${file}: Labs articles are Markdown files, one per article, directly in ${dir}/; move or remove this ${entry.isDirectory() ? "folder" : "entry"}`);
        continue;
      }
      if (!FILE.test(name)) {
        issues.push(`${file}: Labs articles are Markdown files named after their slug (lowercase letters, digits and single hyphens, ending in .md, not a Windows device name such as con or nul)`);
        continue;
      }
      const source = fs.readFileSync(path.join(full, name), "utf8").replace(/^\u{FEFF}/u, "");
      const match = FRONT_MATTER.exec(source);
      if (!match) {
        issues.push(`${file}: start the file with its front matter between two --- lines`);
        continue;
      }
      let front: unknown;
      try {
        front = load(match[1], { schema: JSON_SCHEMA });
      } catch (error) {
        issues.push(`${file}: the front matter is not valid YAML (${String((error as Error).message).split("\n")[0]})`);
        continue;
      }
      // A missing field is already an issue, and the schema leaves it out: it reads as empty here, so a file
      // without a title is never published.
      const fields: Partial<Omit<ArticleData, "body">> = check(articleSchema, front, file, issues);
      const data: ArticleData = {
        title: fields.title ?? "", summary: fields.summary ?? "", cover: fields.cover ?? "", coverAlt: fields.coverAlt ?? "",
        date: fields.date ?? "", updated: fields.updated ?? null, author: fields.author ?? "", body: match[2].trim(),
      };
      files.push({ slug: name.slice(0, -3), locale, file, data, filled: data.title !== "" });
    }
  }
  return { files, issues };
}

/** The rules across fields and languages. `production` refuses the zz-probe- test articles. */
export function labsProblems(files: ArticleFile[], { production = false }: { production?: boolean } = {}): string[] {
  const problems: string[] = [];
  const bySlug = new Map<string, Partial<Record<Locale, ArticleFile>>>();
  for (const item of files) bySlug.set(item.slug, { ...bySlug.get(item.slug), [item.locale]: item });
  for (const [slug, { en, vi }] of bySlug) {
    for (const item of [en, vi]) {
      if (!item) continue;
      const empty = TEXT_FIELDS.filter((field) => item.data[field] === "");
      if (item.filled && empty.length) problems.push(`${item.file}: ${empty.join(", ")} ${empty.length === 1 ? "is" : "are"} empty; an article needs a title, a summary, a cover description and its text`);
      if (!item.filled && empty.length < TEXT_FIELDS.length) problems.push(`${item.file}: the title is empty but other text is filled in; give the article a title, or empty its text in this language`);
      if (DATE.test(item.data.date) && !realDate(item.data.date)) problems.push(`${item.file}: date ${item.data.date} is not a real date`);
      if (item.data.updated && DATE.test(item.data.updated) && !realDate(item.data.updated)) problems.push(`${item.file}: updated ${item.data.updated} is not a real date`);
      if (item.data.updated && item.data.updated < item.data.date) problems.push(`${item.file}: updated (${item.data.updated}) is before the publication date (${item.data.date})`);
      if (STOCK_COVER.test(item.data.cover)) problems.push(`${item.file}: cover uses the original site's stock art (${item.data.cover}); use the article's own image`);
      if (production && slug.startsWith("zz-probe-")) problems.push(`${item.file}: zz-probe- articles are test fixtures and never ship`);
    }
    if (vi && !vi.filled) problems.push(`${vi.file}: has no Vietnamese text; write it, or switch the Vietnamese version off in the CMS`);
    if (en && !en.filled && !vi?.filled) problems.push(`${en.file}: has no text in either language; write the article in English or Vietnamese`);
    if (!en && vi) problems.push(`${ARTICLE_DIRS.en}/${slug}.md is missing: the CMS keeps an English file for every article (with empty text for a Vietnamese-only one); open and save the article in the CMS`);
    if (en && vi) {
      for (const field of SHARED_FIELDS) {
        if (en.data[field] !== vi.data[field]) problems.push(`${vi.file}: ${field} is ${JSON.stringify(vi.data[field])}, but it must stay ${JSON.stringify(en.data[field])} as in ${en.file} (the cover, the dates and the author are the same in both languages)`);
      }
    }
  }
  return problems;
}

/** One language's published articles, newest first, then by slug. */
export function publishedArticles(files: ArticleFile[], locale: Locale): ArticleFile[] {
  return files.filter((item) => item.locale === locale && item.filled).sort((a, b) => (a.data.date === b.data.date ? (a.slug < b.slug ? -1 : 1) : a.data.date < b.data.date ? 1 : -1));
}

/** The languages that have at least one published article (next.config.ts: which Labs routes exist). Never throws: a broken file fails check-content, which runs before next build. */
export function labsLocales(root: string = process.cwd()): Locale[] {
  try {
    const { files } = readArticleFiles(root);
    return LOCALES.filter((locale) => files.some((item) => item.locale === locale && item.filled));
  } catch {
    return [];
  }
}
