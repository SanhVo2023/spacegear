// Each page's metadata in one language, kept apart from the views so tests and the route files can read it
// without loading the client component trees. `path` is always the English path; buildMetadata localizes it.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary } from "@/lib/i18n/dictionary";
import { LOCALES, localizedHref, type Locale } from "@/lib/i18n/locales";
import { labsArticle, labsArticles } from "@/lib/labs";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";

type Page = "about" | "approach" | "contact" | "privacy" | "terms" | "services";
const PATHS: Record<Page, string> = { about: "/about/", approach: "/approach/", contact: "/contact/", privacy: "/privacy/", terms: "/terms/", services: "/services/" };
const pageMetadata = (page: Page) => (locale: Locale) => {
  const t = dictionary(locale)[page];
  return buildMetadata({ title: t.title, description: t.description, path: PATHS[page], locale });
};

export function homeMetadata(locale: Locale) {
  const t = dictionary(locale).meta;
  return buildMetadata({ title: t.homeTitle, description: t.homeDescription, path: "/", locale });
}
export const aboutMetadata = pageMetadata("about");
export const approachMetadata = pageMetadata("approach");
export const contactMetadata = pageMetadata("contact");
export const privacyMetadata = pageMetadata("privacy");
export const termsMetadata = pageMetadata("terms");
export const servicesMetadata = pageMetadata("services");

export function serviceStaticParams(locale: Locale) {
  return getContent(locale).SERVICES.map(({ slug }) => ({ slug }));
}
export function serviceMetadata(locale: Locale, slug: string) {
  const service = getContent(locale).SERVICES.find((item) => item.slug === slug);
  if (!service) notFound();
  return buildMetadata({ title: service.name, description: service.summary, path: `/services/${slug}/`, locale });
}
/**
 * The Labs index of one language (a route only when the language has an article: next.config.ts). Its hreflang names
 * the languages that have an index. The description is the section's heading and its line: the line alone is too
 * short for a search result.
 */
export function labsIndexMetadata(locale: Locale) {
  const { SECTIONS } = getContent(locale);
  const languages = Object.fromEntries(LOCALES.filter((other) => labsArticles(other).length > 0).map((other) => [other, localizedHref("/labs/", other)]));
  return buildMetadata({ title: SECTIONS.labs.title, description: `${SECTIONS.labs.heading} ${SECTIONS.labs.description}`, path: "/labs/", locale, languages, feed: localizedHref("/labs/rss.xml", locale) });
}
export function labsStaticParams(locale: Locale) {
  return labsArticles(locale).map(({ slug }) => ({ slug }));
}
/** A Labs article: its summary as the description, its cover as the share image, its dates, its language versions. */
export function labsArticleMetadata(locale: Locale, slug: string) {
  const article = labsArticle(locale, slug);
  if (!article) notFound();
  return buildMetadata({
    title: article.title, description: article.summary, path: `/labs/${slug}/`, locale, languages: article.languages, type: "article",
    image: { url: contentImage(article.cover).src, alt: article.coverAlt }, publishedTime: article.date, modifiedTime: article.updated ?? article.date,
    feed: localizedHref("/labs/rss.xml", locale),
  });
}
/**
 * The one 404 page says it in both languages. Next writes `<meta name="robots" content="noindex">` on every 404
 * itself, so the layout's robots default is dropped here (two robots tags otherwise; in production they would
 * disagree). Previews still send X-Robots-Tag: noindex, nofollow (scripts/package-site.mjs).
 */
export function notFoundMetadata(): Metadata {
  return { title: { absolute: `${dictionary("en").notFound.title} · ${dictionary("vi").notFound.title} | ${SITE.name}` }, robots: null };
}
