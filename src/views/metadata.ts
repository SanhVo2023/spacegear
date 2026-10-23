// Each page's metadata in one language, kept apart from the views so tests and the route files can read it
// without loading the client component trees. `path` is always the English path; buildMetadata localizes it.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
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
 * The one 404 page says it in both languages. Next writes `<meta name="robots" content="noindex">` on every 404
 * itself, so the layout's robots default is dropped here (two robots tags otherwise; in production they would
 * disagree). Previews still send X-Robots-Tag: noindex, nofollow (scripts/package-site.mjs).
 */
export function notFoundMetadata(): Metadata {
  return { title: { absolute: `${dictionary("en").notFound.title} · ${dictionary("vi").notFound.title} | ${SITE.name}` }, robots: null };
}
