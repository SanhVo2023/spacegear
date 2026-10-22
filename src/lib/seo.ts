import type { Metadata } from "next";
import { SITE } from "./site";

export function canonicalUrl(path: string) { return new URL(path, SITE.origin).href; }
export function buildMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const fullTitle = path === "/" ? `${SITE.name} | Digital Transformation & AI Consulting` : `${title} | ${SITE.name}`;
  return {
    title: { absolute: fullTitle }, description, alternates: { canonical: canonicalUrl(path) },
    openGraph: { type: "website", siteName: SITE.name, title: fullTitle, description, url: canonicalUrl(path), images: [{ url: "/seo/og.png", width: 1200, height: 630, alt: "spacegear logo" }] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: ["/seo/og.png"] },
  };
}
export function breadcrumbData(items: { name: string; path: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: canonicalUrl(item.path) })) };
}
