import type { Metadata } from "next";
import { dictionary } from "./i18n/dictionary";
import { localizedHref, type Locale } from "./i18n/locales";
import { SITE, siteFor } from "./site";

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
/** The root layouts' metadata: defaults for every page of one language. */
export function siteMetadata(locale: Locale): Metadata {
  return {
    metadataBase: new URL(SITE.origin), title: `${SITE.name} | ${dictionary(locale).meta.homeTitle}`, description: siteFor(locale).description,
    robots: { index: SITE.publicationMode === "production", follow: SITE.publicationMode === "production" },
    // Brand kit (docs/brand/): favicon.ico comes from the src/app convention; the web manifest is src/app/manifest.ts.
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }] },
  };
}
export function organizationData(locale: Locale) {
  return { "@type": "Organization", "@id": `${SITE.origin}/#organization`, name: SITE.name, url: SITE.origin, description: siteFor(locale).description, logo: `${SITE.origin}/icon-512.png`, ...(SITE.contactEmail ? { email: SITE.contactEmail } : {}) };
}
// The shared interface takes the language; nothing here depends on it yet (bilingual SEO extends it).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function websiteData(locale: Locale) {
  return { "@type": "WebSite", "@id": `${SITE.origin}/#website`, url: SITE.origin, name: SITE.name, publisher: { "@id": `${SITE.origin}/#organization` } };
}
