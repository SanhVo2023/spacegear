import { SERVICES } from "./content";
export const SITE = {
  name: "Spacegear",
  description: "Digital transformation and AI consulting, from strategy to working systems. Modernize operations, connect data and put AI to work.",
  origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8787",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  publicationMode: process.env.SITE_MODE === "production" ? "production" : "preview",
  policiesApproved: process.env.POLICIES_APPROVED === "true",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
  socialProfiles: [] as string[],
};
export function getPublishedRoutes() {
  return [
    { path: "/", kind: "home" }, { path: "/services/", kind: "index" },
    ...SERVICES.map((service) => ({ path: `/services/${service.slug}/`, kind: "service" })),
    ...["approach", "about", "contact", "privacy", "terms"].map((slug) => ({ path: `/${slug}/`, kind: "page" })),
  ];
}
