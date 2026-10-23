import type { Metadata } from "next";
import { dictionary } from "./i18n/dictionary";
import { localizedHref, type Locale } from "./i18n/locales";
import { SITE } from "./site";

export function canonicalUrl(path: string) { return new URL(path, SITE.origin).href; }
/** A page's metadata in one language. `path` is the page's English path ("/about/"); the canonical is its own language's. */
export function buildMetadata({ title, description, path, locale }: { title: string; description: string; path: string; locale: Locale }): Metadata {
  const t = dictionary(locale).meta;
  const url = canonicalUrl(localizedHref(path, locale));
  const fullTitle = path === "/" ? `${SITE.name} | ${t.homeTitle}` : `${title} | ${SITE.name}`;
  return {
    title: { absolute: fullTitle }, description, alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE.name, title: fullTitle, description, url, images: [{ url: "/seo/og.png", width: 1200, height: 630, alt: t.ogImageAlt }] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: ["/seo/og.png"] },
  };
}
export function breadcrumbData(items: { name: string; path: string }[], locale: Locale) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: canonicalUrl(localizedHref(item.path, locale)) })) };
}
