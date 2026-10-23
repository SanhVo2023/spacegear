import siteFile from "../../content/site.json" with { type: "json" };
import siteFileVi from "../../content/vi/site.json" with { type: "json" };
import { SERVICES } from "./content";
import { siteSchema } from "./content-model";
import { parseContent } from "./content-schema";
import { LOCALES, alternatePaths, localizedHref, type Locale } from "./i18n/locales";

/** The Organization's name in structured data and on Google Business Profile. The visible site name stays SITE.name ("spacegear.tech"). */
export const BRAND_NAME = "spacegear";
// Identity copy comes from content/site.json and content/vi/site.json (editable in the CMS); the rest comes from the environment.
const IDENTITY = {
  en: parseContent(siteSchema, siteFile, "content/site.json"),
  vi: parseContent(siteSchema, siteFileVi, "content/vi/site.json"),
};
export type SiteIdentity = (typeof IDENTITY)["en"];
const site = IDENTITY.en;
export const SITE = {
  name: site.name,
  description: site.description,
  origin: process.env.NEXT_PUBLIC_SITE_URL || "https://spacegear.tech",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  publicationMode: process.env.SITE_MODE === "production" ? "production" : "preview",
  policiesApproved: process.env.POLICIES_APPROVED === "true",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
  socialProfiles: site.socialProfiles,
  address: site.address,
  telephone: site.telephone,
};
/** SITE with one language's identity copy (name, description, profiles, address); the environment values are shared. */
export function siteFor(locale: Locale) {
  const identity = IDENTITY[locale];
  return { ...SITE, name: identity.name, description: identity.description, socialProfiles: identity.socialProfiles, address: identity.address, telephone: identity.telephone };
}
export type PublishedRoute = { path: string; kind: "home" | "index" | "service" | "page" | "labs" | "article"; locale: Locale; alternates: Partial<Record<Locale, string>> };
/** Every page in both languages, English first, each with the paths of its language versions (hreflang, sitemap). */
export function getPublishedRoutes(): PublishedRoute[] {
  const pages: { path: string; kind: PublishedRoute["kind"] }[] = [
    { path: "/", kind: "home" }, { path: "/services/", kind: "index" },
    ...SERVICES.map((service) => ({ path: `/services/${service.slug}/`, kind: "service" as const })),
    ...["approach", "about", "contact", "privacy", "terms"].map((slug) => ({ path: `/${slug}/`, kind: "page" as const })),
  ];
  return LOCALES.flatMap((locale) => pages.map(({ path, kind }) => ({ path: localizedHref(path, locale), kind, locale, alternates: alternatePaths(path) })));
}
