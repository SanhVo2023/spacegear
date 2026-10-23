// Machine-readable lists, written at build time by their route handlers:
//   - RSS 2.0 per language for the Labs articles (/labs/rss.xml, /vi/labs/rss.xml): that language's published
//     articles only, newest first, with absolute links and RFC 822 dates. Text is XML-escaped; the article HTML is
//     never put in a feed.
//   - /llms.txt (llmstxt.org): every published page in both languages, then the Labs index, its feed and its
//     articles, generated from the same routes as the sitemap (getPublishedRoutes, labsRoutes), so it cannot drift.
//     Titles and descriptions are the pages' own metadata copy (no new claims).
import { getContent } from "./content";
import { dictionary } from "./i18n/dictionary";
import { HTML_LANG, LOCALES, localizedHref, stripLocale, type Locale } from "./i18n/locales";
import { labsArticles, labsRoutes } from "./labs";
import { canonicalUrl } from "./seo";
import { SITE, getPublishedRoutes, siteFor, type PublishedRoute } from "./site";

// Characters XML 1.0 refuses (a C0 control other than tab, line feed and carriage return; U+FFFE, U+FFFF): dropped.
const NOT_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const xml = (text: string) => text.replace(NOT_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** "2026-10-15" → "Thu, 15 Oct 2026 00:00:00 GMT" (RFC 822 with a four-digit year, as RSS 2.0 asks). */
export function rfc822(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) throw new Error(`Labs feed: ${JSON.stringify(date)} is not a date`);
  return value.toUTCString();
}

/** The RSS 2.0 document of one language's Labs. */
export function rssFeed(locale: Locale, root?: string): string {
  const { SECTIONS } = getContent(locale);
  const articles = labsArticles(locale, root);
  const items = articles.map((article) => {
    const url = canonicalUrl(article.path);
    return `<item><title>${xml(article.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${rfc822(article.date)}</pubDate><description>${xml(article.summary)}</description><dc:creator>${xml(article.author)}</dc:creator></item>`;
  });
  // The latest change of any article (YYYY-MM-DD compares as text): an older article may have been updated last.
  const lastChange = articles.map((article) => article.updated ?? article.date).sort().at(-1);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "<channel>",
    `<title>${xml(`${SECTIONS.labs.title} · ${SITE.name}`)}</title>`,
    `<link>${canonicalUrl(localizedHref("/labs/", locale))}</link>`,
    `<description>${xml(SECTIONS.labs.description)}</description>`,
    `<language>${HTML_LANG[locale]}</language>`,
    `<atom:link href="${canonicalUrl(localizedHref("/labs/rss.xml", locale))}" rel="self" type="application/rss+xml"/>`,
    ...(lastChange ? [`<lastBuildDate>${rfc822(lastChange)}</lastBuildDate>`] : []),
    ...items,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}

/** One line of text: a title or a description never breaks the list. */
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
/** Markdown link text: brackets and backslashes are escaped, so a title cannot end the link early. */
const linkText = (text: string) => oneLine(text).replace(/[\\[\]]/g, (char) => `\\${char}`);
const entry = (title: string, path: string, description?: string) => `- [${linkText(title)}](${canonicalUrl(path)})${description ? `: ${oneLine(description)}` : ""}`;

/**
 * A published route's title and description, as its page's metadata gives them (src/views/metadata.ts). A route
 * this does not know fails the build, so a new page cannot be left out of /llms.txt.
 */
function describe(route: PublishedRoute, root?: string): { title: string; description: string } {
  const t = dictionary(route.locale);
  const { SECTIONS, SERVICES } = getContent(route.locale);
  const segments = stripLocale(route.path).split("/").filter(Boolean);
  const found = (() => {
    switch (route.kind) {
      case "home": return { title: t.nav.home, description: t.meta.homeDescription };
      case "index": return segments[0] === "services" ? { title: t.services.title, description: t.services.description } : undefined;
      case "service": {
        const service = SERVICES.find((item) => item.slug === segments[1]);
        return service && { title: service.name, description: service.summary };
      }
      case "page": {
        const page = segments[0];
        return page === "about" || page === "approach" || page === "contact" || page === "privacy" || page === "terms" ? { title: t[page].title, description: t[page].description } : undefined;
      }
      case "labs": return { title: SECTIONS.labs.title, description: `${SECTIONS.labs.heading} ${SECTIONS.labs.description}` };
      case "article": {
        const article = labsArticles(route.locale, root).find((item) => item.path === route.path);
        return article && { title: article.title, description: article.summary };
      }
    }
  })();
  if (!found) throw new Error(`llms.txt: no title and description for ${route.path} (${route.kind}); add the page to describe() in src/lib/labs-feed.ts`);
  return found;
}

const LANGUAGE_NAME: Record<Locale, string> = { en: "English", vi: "Vietnamese" };

/** /llms.txt: the site in Markdown for language models, in both languages. */
export function llmsText(root?: string): string {
  const pages = getPublishedRoutes();
  const labs = labsRoutes(root);
  const sections = LOCALES.flatMap((locale) => {
    const lines = (routes: PublishedRoute[]) => routes.filter((route) => route.locale === locale).flatMap((route) => {
      const { title, description } = describe(route, root);
      const line = entry(title, route.path, description);
      // The feed follows its index.
      return route.kind === "labs" ? [line, entry(dictionary(locale).labs.feed, localizedHref("/labs/rss.xml", locale))] : [line];
    });
    const labsLines = lines(labs);
    return [
      `## Pages in ${LANGUAGE_NAME[locale]}`, "", ...lines(pages), "",
      ...(labsLines.length ? [`## Labs in ${LANGUAGE_NAME[locale]}`, "", ...labsLines, ""] : []),
    ];
  });
  return [
    `# ${SITE.name}`, "",
    `> ${oneLine(siteFor("en").description)}`, "",
    `${SITE.name} is published in English and in Vietnamese: every page has a Vietnamese version under /vi/ with the same path.${labs.length ? " A Labs article may be written in one language or in both; it is listed in each language it is published in, next to that language's RSS feed." : ""}`, "",
    ...sections,
  ].join("\n");
}
