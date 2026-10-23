import siteFile from "../../content/site.json" with { type: "json" };
import siteFileVi from "../../content/vi/site.json" with { type: "json" };
import { SERVICES } from "./content";
import { siteSchema } from "./content-model";
import { parseContent } from "./content-schema";
import type { Locale } from "./i18n/locales";

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
export function getPublishedRoutes() {
  return [
    { path: "/", kind: "home" }, { path: "/services/", kind: "index" },
    ...SERVICES.map((service) => ({ path: `/services/${service.slug}/`, kind: "service" })),
    ...["approach", "about", "contact", "privacy", "terms"].map((slug) => ({ path: `/${slug}/`, kind: "page" })),
  ];
}
