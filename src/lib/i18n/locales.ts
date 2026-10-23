// The site's two languages and the path rules that join them. English keeps today's URLs; Vietnamese
// mirrors every page under /vi/ with the same slugs. Pure and dependency-free: the pages, the Worker
// (worker/locale.ts) and the scripts all use it. Erasable TypeScript only (scripts load it under
// --experimental-strip-types).
export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
/** Remembers a visitor's explicit choice for a year (set by worker/locale.ts, read there too). */
export const LOCALE_COOKIE = "sg_lang";
/** <html lang> and hreflang. */
export const HTML_LANG: Record<Locale, string> = { en: "en", vi: "vi" };
/** og:locale and og:locale:alternate. */
export const OG_LOCALE: Record<Locale, string> = { en: "en_US", vi: "vi_VN" };
/** Each language's name in that language, for the switch. */
export const LOCALE_NAME: Record<Locale, string> = { en: "English", vi: "Tiếng Việt" };
export const LOCALE_SHORT: Record<Locale, string> = { en: "EN", vi: "VI" };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "vi";
}

/** The language of a site path: "/vi" and everything under "/vi/" is Vietnamese. */
export function localeOfPath(pathname: string): Locale {
  return pathname === "/vi" || pathname.startsWith("/vi/") ? "vi" : "en";
}

/** The path without its language prefix: "/vi/about/" → "/about/", "/vi" and "/vi/" → "/". */
export function stripLocale(pathname: string): string {
  if (localeOfPath(pathname) === "en") return pathname;
  return pathname.slice(3) || "/";
}

/** Paths every language shares: build files, media, the CMS, the API and root-level files (sitemap.xml, llms.txt, favicon.ico). */
const SHARED = /^\/(?:_next|images|uploads|textures|models|seo|licenses|admin|api)(?:\/|$)|^\/[^/]+\.[A-Za-z0-9]+$/;
export function isSharedPath(pathname: string): boolean {
  return SHARED.test(pathname);
}

/**
 * A link in `locale`. A site path ("/about/", "/#faq", "/contact/?service=x") gets the language prefix, and a
 * path that already has one is moved to `locale`. Anything else (https://…, mailto:, tel:, "#top",
 * protocol-relative "//…", shared paths such as /images/…) comes back unchanged.
 */
export function localizedHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const tail = cut === -1 ? "" : href.slice(cut);
  if (isSharedPath(path)) return href;
  const base = stripLocale(path);
  return locale === "vi" ? `/vi${base}${tail}` : `${base}${tail}`;
}

const withSlash = (path: string) => (path.endsWith("/") ? path : `${path}/`);

/**
 * The EN/VI switch's link: always the English path with ?lang=<target>. The Worker stores the choice in the
 * sg_lang cookie and redirects to the clean page in that language (worker/locale.ts), and it works without JavaScript.
 */
export function switchHref(pathname: string, target: Locale): string {
  return `${withSlash(stripLocale(pathname))}?lang=${target}`;
}

/** Both language versions of a page path. */
export function alternatePaths(path: string): Record<Locale, string> {
  return { en: localizedHref(path, "en"), vi: localizedHref(path, "vi") };
}
