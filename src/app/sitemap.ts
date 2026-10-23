import type { MetadataRoute } from "next";
import { HTML_LANG, LOCALES } from "@/lib/i18n/locales";
import { getPublishedRoutes, SITE } from "@/lib/site";
export const dynamic = "force-static";
/** Every page in both languages; each lists its language versions (xhtml:link hreflang), x-default being English. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, SITE.origin).href;
  return getPublishedRoutes().map(({ path, alternates }) => ({
    url: url(path),
    alternates: {
      languages: {
        ...Object.fromEntries(LOCALES.flatMap((locale) => (alternates[locale] ? [[HTML_LANG[locale], url(alternates[locale])]] : []))),
        ...(alternates.en ? { "x-default": url(alternates.en) } : {}),
      },
    },
  }));
}
