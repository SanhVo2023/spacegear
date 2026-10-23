// The Labs articles the pages render (server and build only): one language's published files with their Markdown
// rendered, the reading time, the cover's size and the paths of every language version (hreflang, the sitemap).
// Erasable TypeScript with explicit .ts imports, like the modules it reads.
import { siteImageSize, type ImageSize } from "./image-size.ts";
import { publishedArticles, readArticleFiles, type ArticleData } from "./labs-files.ts";
import { renderMarkdown, type RenderedMarkdown } from "./markdown.ts";
import { HTML_LANG, LOCALES, localizedHref, type Locale } from "./i18n/locales.ts";
import type { PublishedRoute } from "./site.ts";

export type LabsArticle = ArticleData & {
  slug: string; locale: Locale; path: string; html: string; headings: RenderedMarkdown["headings"]; readingMinutes: number;
  /** The paths of the article in every language it is published in (always includes its own). */
  languages: Partial<Record<Locale, string>>;
  /** The cover's intrinsic size, for its width and height (check-content refuses a cover whose size cannot be read). */
  coverSize: ImageSize | undefined;
};

/**
 * Reading speed in the units renderMarkdown counts (text split at spaces). An English unit is a word; a Vietnamese
 * one is a syllable, and most Vietnamese words have two, so a translation counts far more units than its original.
 * About 220 English words and 320 Vietnamese syllables a minute give both versions the same estimate: a draft of
 * 1,746 words and its translation of 2,544 syllables read in 8 minutes each.
 */
export const READING_RATE: Record<Locale, number> = { en: 220, vi: 320 };

/** "n min read": at least 1. */
export function readingMinutes(units: number, locale: Locale): number {
  return Math.max(1, Math.round(units / READING_RATE[locale]));
}

const cache = new Map<string, LabsArticle[]>();

/** One language's published articles, newest first. */
export function labsArticles(locale: Locale, root: string = process.cwd()): LabsArticle[] {
  const key = `${root}\n${locale}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { files } = readArticleFiles(root);
  const versions = (slug: string) => Object.fromEntries(LOCALES.filter((other) => files.some((item) => item.slug === slug && item.locale === other && item.filled)).map((other) => [other, localizedHref(`/labs/${slug}/`, other)]));
  const imageSize = (src: string) => siteImageSize(src, root);
  const list = publishedArticles(files, locale).map((item): LabsArticle => {
    const rendered = renderMarkdown(item.data.body, locale, { imageSize });
    return {
      ...item.data, slug: item.slug, locale, path: localizedHref(`/labs/${item.slug}/`, locale), html: rendered.html, headings: rendered.headings,
      readingMinutes: readingMinutes(rendered.words, locale), languages: versions(item.slug), coverSize: imageSize(item.data.cover),
    };
  });
  // The files are read once per build; under `next dev` an edited article shows on the next request.
  if (process.env.NODE_ENV !== "development") cache.set(key, list);
  return list;
}

export function labsArticle(locale: Locale, slug: string, root?: string): LabsArticle | undefined {
  return labsArticles(locale, root).find((item) => item.slug === slug);
}

/** The Labs index and articles of every language that has articles, English first (sitemap, check-seo). */
export function labsRoutes(root: string = process.cwd()): PublishedRoute[] {
  const languages = LOCALES.filter((locale) => labsArticles(locale, root).length > 0);
  const index = Object.fromEntries(languages.map((locale) => [locale, localizedHref("/labs/", locale)]));
  return languages.flatMap((locale) => [
    { path: localizedHref("/labs/", locale), kind: "labs" as const, locale, alternates: index },
    ...labsArticles(locale, root).map((item) => ({ path: item.path, kind: "article" as const, locale, alternates: item.languages })),
  ]);
}

/** "October 23, 2026" / "23 tháng 10, 2026". */
export function formatDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(HTML_LANG[locale], { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
