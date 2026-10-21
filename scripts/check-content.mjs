import { validatePublication } from "../src/lib/publication.ts";
import { SERVICES, CASE_STUDIES } from "../src/lib/content.ts";
const mode = process.argv.includes("--production") ? "production" : process.env.SITE_MODE || "preview";
const routes = ["/", "/services/", ...SERVICES.map((s) => `/services/${s.slug}/`), ...["about", "approach", "contact", "privacy", "terms"].map((s) => `/${s}/`)];
const errors = validatePublication({ mode, origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8787", contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL, policiesApproved: process.env.POLICIES_APPROVED === "true" }, routes);
for (const service of SERVICES) {
  if (!service.summary || !service.buyerProblem || !service.deliverables.length || !service.faqs.length) errors.push(`incomplete service: ${service.slug}`);
}
if (CASE_STUDIES.some((study) => study.published && !study.approved)) errors.push("unverified published case study");
// `next build` always inlines NODE_ENV=production; sample mode exists only under `next dev`.
if (process.env.NEXT_PUBLIC_SHOW_SAMPLES === "true") errors.push("sample sections are only available under `next dev`; unset NEXT_PUBLIC_SHOW_SAMPLES to build");
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(`Content valid: ${routes.length} routes; ${mode} mode.`);
