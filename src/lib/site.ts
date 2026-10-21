import siteFile from "../../content/site.json" with { type: "json" };
import { SERVICES } from "./content";
import { siteSchema } from "./content-model";
import { parseContent } from "./content-schema";

// Identity copy comes from content/site.json (editable in the CMS); the rest comes from the environment.
const site = parseContent(siteSchema, siteFile, "content/site.json");
export const SITE = {
  name: site.name,
  description: site.description,
  origin: process.env.NEXT_PUBLIC_SITE_URL || "https://spacegear.tech",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  publicationMode: process.env.SITE_MODE === "production" ? "production" : "preview",
  policiesApproved: process.env.POLICIES_APPROVED === "true",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
  socialProfiles: site.socialProfiles,
};
export function getPublishedRoutes() {
  return [
    { path: "/", kind: "home" }, { path: "/services/", kind: "index" },
    ...SERVICES.map((service) => ({ path: `/services/${service.slug}/`, kind: "service" })),
    ...["approach", "about", "contact", "privacy", "terms"].map((slug) => ({ path: `/${slug}/`, kind: "page" })),
  ];
}
