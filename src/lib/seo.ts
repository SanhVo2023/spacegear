import type { Metadata } from "next";
import { dictionary } from "./i18n/dictionary";
import { HTML_LANG, LOCALES, OG_LOCALE, alternatePaths, localizedHref, type Locale } from "./i18n/locales";
import { BRAND_NAME, SITE, siteFor } from "./site";

export function canonicalUrl(path: string) { return new URL(path, SITE.origin).href; }

const ORGANIZATION_ID = `${SITE.origin}/#organization`;
/** One WebSite node per language, named after its home page. */
const websiteId = (locale: Locale) => `${canonicalUrl(localizedHref("/", locale))}#website`;

type MetadataInput = {
  title: string; description: string;
  /** The page's English path ("/about/"); with `languages`, the paths of the versions that exist (a Labs article may have one). */
  path: string; locale: Locale; languages?: Partial<Record<Locale, string>>;
  /** og:type; an article (Part 3) also gets its dates, and its cover as `image`. */
  type?: "website" | "article"; image?: { url: string; alt: string; width?: number; height?: number };
  publishedTime?: string; modifiedTime?: string;
};
/** What buildMetadata always sets, typed, so webPageData can read it back. */
export type PageMetadata = Metadata & { title: { absolute: string }; description: string; alternates: { canonical: string; languages: Record<string, string> } };

/**
 * A page's metadata in one language: its own canonical; hreflang links to every language version, with x-default
 * pointing at the English one (when there is one); og:locale and og:locale:alternate.
 */
export function buildMetadata({ title, description, path, locale, languages, type = "website", image, publishedTime, modifiedTime }: MetadataInput): PageMetadata {
  const t = dictionary(locale).meta;
  const versions = languages ?? alternatePaths(path);
  const url = canonicalUrl(versions[locale] ?? localizedHref(path, locale));
  const fullTitle = path === "/" ? `${SITE.name} | ${t.homeTitle}` : `${title} | ${SITE.name}`;
  const og = image ?? { url: "/seo/og.png", width: 1200, height: 630, alt: t.ogImageAlt };
  const hreflang: Record<string, string> = {};
  for (const version of LOCALES) {
    const versionPath = versions[version];
    if (versionPath) hreflang[HTML_LANG[version]] = canonicalUrl(versionPath);
  }
  if (versions.en) hreflang["x-default"] = canonicalUrl(versions.en);
  const common = {
    siteName: SITE.name, title: fullTitle, description, url, locale: OG_LOCALE[locale],
    alternateLocale: LOCALES.filter((version) => version !== locale && versions[version]).map((version) => OG_LOCALE[version]), images: [og],
  };
  return {
    title: { absolute: fullTitle }, description, alternates: { canonical: url, languages: hreflang },
    openGraph: type === "article" ? { ...common, type: "article", publishedTime, modifiedTime } : { ...common, type: "website" },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [og.url] },
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

/**
 * The organization, the same node on every page (one @id), described in the page's language. Its name is the
 * Google Business Profile name ("spacegear"), and the site name is its alternate name. The address and the phone
 * are the owner's (Site identity). No postal code was given, so none is set.
 */
export function organizationData(locale: Locale) {
  const site = siteFor(locale);
  return {
    "@type": "Organization", "@id": ORGANIZATION_ID, name: BRAND_NAME, alternateName: SITE.name, url: SITE.origin,
    description: site.description, logo: `${SITE.origin}/icon-512.png`, ...(SITE.contactEmail ? { email: SITE.contactEmail } : {}),
    telephone: site.telephone,
    address: { "@type": "PostalAddress", streetAddress: site.address.street, addressLocality: site.address.locality, addressCountry: "VN" },
  };
}

/** One WebSite per language (its home page's URL), with its language. */
export function websiteData(locale: Locale) {
  const home = canonicalUrl(localizedHref("/", locale));
  return { "@type": "WebSite", "@id": websiteId(locale), url: home, name: SITE.name, inLanguage: HTML_LANG[locale], publisher: { "@id": ORGANIZATION_ID } };
}

/** The page itself, from its metadata: its title, canonical URL and language, inside that language's WebSite. */
export function webPageData(page: PageMetadata, locale: Locale) {
  const url = page.alternates.canonical;
  return {
    "@context": "https://schema.org", "@type": "WebPage", "@id": `${url}#webpage`, url, name: page.title.absolute, description: page.description,
    inLanguage: HTML_LANG[locale], isPartOf: { "@id": websiteId(locale) }, publisher: { "@id": ORGANIZATION_ID },
  };
}
