import type { MetadataRoute } from "next";
import { HTML_LANG, LOCALES } from "@/lib/i18n/locales";
import { labsRoutes } from "@/lib/labs";
import { getPublishedRoutes, SITE } from "@/lib/site";
export const dynamic = "force-static";
/**
 * Every page in both languages, then the Labs pages of each language that has articles. Each lists the language
 * versions that exist (xhtml:link hreflang), x-default being the English one when there is one: a Labs article may
 * exist in one language only, and then names only itself. check-export compares the Labs entries with the
 * published articles (scripts/lib/labs-export.mjs).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, SITE.origin).href;
  return [...getPublishedRoutes(), ...labsRoutes()].map(({ path, alternates }) => ({
    url: url(path),
    alternates: {
      languages: {
        ...Object.fromEntries(LOCALES.flatMap((locale) => (alternates[locale] ? [[HTML_LANG[locale], url(alternates[locale])]] : []))),
        ...(alternates.en ? { "x-default": url(alternates.en) } : {}),
      },
    },
  }));
}
