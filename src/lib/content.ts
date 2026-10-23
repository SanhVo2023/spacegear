// Site copy, loaded from the files in content/ (English) and content/vi/ (Vietnamese), both edited through the CMS
// at /admin/. A language is validated the first time it is used: at build time, in `npm test`, in
// scripts/check-content.mjs, and in the browser and the Worker (buildContent also derives values the components
// hydrate with). That cost (about 5 KB gzip and a few ms per language) is accepted; see "Controller amendments" in
// docs/superpowers/plans/2026-10-21-showcase-part3-cms.md and README "What the CMS costs".
// The English exports keep the names and types the components used before the CMS (src/lib/content-contract.ts
// proves the types); getContent(locale) returns the same exports for one language. content/vi/ mirrors content/
// field for field (src/lib/content-parity.ts): only text differs, links stay site paths ("/contact/"), and pages
// localize them (localizedHref).
// Honesty rules (tests/content.test.mjs, scripts/check-content.mjs): no invented clients, staff, prices, timelines,
// offices, press or results, in either language. Illustrative figures are labelled where they render.
import approach from "../../content/approach.json" with { type: "json" };
import engagementsPanel from "../../content/engagements-panel.json" with { type: "json" };
import faqCard from "../../content/faq-card.json" with { type: "json" };
import footer from "../../content/footer.json" with { type: "json" };
import home from "../../content/home.json" with { type: "json" };
import measure from "../../content/measure.json" with { type: "json" };
import processBlock from "../../content/process.json" with { type: "json" };
import sections from "../../content/sections.json" with { type: "json" };
import servicesPanel from "../../content/services-panel.json" with { type: "json" };
import team from "../../content/team.json" with { type: "json" };
import work from "../../content/work.json" with { type: "json" };
import viApproach from "../../content/vi/approach.json" with { type: "json" };
import viEngagementsPanel from "../../content/vi/engagements-panel.json" with { type: "json" };
import viFaqCard from "../../content/vi/faq-card.json" with { type: "json" };
import viFooter from "../../content/vi/footer.json" with { type: "json" };
import viHome from "../../content/vi/home.json" with { type: "json" };
import viMeasure from "../../content/vi/measure.json" with { type: "json" };
import viProcess from "../../content/vi/process.json" with { type: "json" };
import viSections from "../../content/vi/sections.json" with { type: "json" };
import viServicesPanel from "../../content/vi/services-panel.json" with { type: "json" };
import viTeam from "../../content/vi/team.json" with { type: "json" };
import viWork from "../../content/vi/work.json" with { type: "json" };
import { COLLECTION_FILES, COLLECTION_FILES_VI } from "./content-index.generated.ts";
import { buildContent } from "./content-model.ts";
import type { ContentInput, Service } from "./content-model.ts";
import type { Locale } from "./i18n/locales.ts";

export type { Engagement, FooterLink, Person, Pillar, ProcessStep, SectionCopy, Service, Stat, Testimonial, WorkTile } from "./content-model.ts";
/** One language's copy: the English exports' names and shapes (SERVICES, HOME, SECTIONS, …). */
export type SiteContent = ReturnType<typeof buildContent>;

const INPUTS: Record<Locale, () => ContentInput> = {
  en: () => ({ home, sections, work, servicesPanel, process: processBlock, approach, measure, engagementsPanel, faqCard, team, footer, collections: COLLECTION_FILES }),
  vi: () => ({
    home: viHome, sections: viSections, work: viWork, servicesPanel: viServicesPanel, process: viProcess, approach: viApproach,
    measure: viMeasure, engagementsPanel: viEngagementsPanel, faqCard: viFaqCard, team: viTeam, footer: viFooter, collections: COLLECTION_FILES_VI,
  }),
};
/** Where each language's files are; a content problem names its file there. */
export const CONTENT_DIRS: Record<Locale, string> = { en: "content", vi: "content/vi" };
const built = new Map<Locale, SiteContent>();

/** One language's copy, built and validated on first use. */
export function getContent(locale: Locale): SiteContent {
  let copy = built.get(locale);
  if (!copy) {
    copy = buildContent(INPUTS[locale](), CONTENT_DIRS[locale]);
    built.set(locale, copy);
  }
  return copy;
}

const content = getContent("en");

export const SERVICES = content.SERVICES;
export const ENGAGEMENTS = content.ENGAGEMENTS;
export const ENGAGEMENTS_FOOTER = content.ENGAGEMENTS_FOOTER;
export const FAQS = content.FAQS;
// Not CMS-managed yet: nothing is published, and check-content refuses unapproved case studies.
export const INSIGHTS: { slug: string; title: string; published: boolean }[] = [];
export const CASE_STUDIES: { slug: string; title: string; published: boolean; approved: boolean }[] = [];

export function serviceBySlug(slug: string): Service {
  const service = SERVICES.find((item) => item.slug === slug);
  if (!service) throw new Error(`Unknown service: ${slug}`);
  return service;
}

/** A service in one language (the slug is the same in both). */
export function serviceFor(locale: Locale, slug: string): Service {
  const service = getContent(locale).SERVICES.find((item) => item.slug === slug);
  if (!service) throw new Error(`Unknown service: ${slug}`);
  return service;
}

export const HOME = content.HOME;
export const SECTIONS = content.SECTIONS;
export const WORK = content.WORK;
export const PILLARS = content.PILLARS;
export const CORE_PANEL = content.CORE_PANEL;
export const PROCESS_STEPS = content.PROCESS_STEPS;
export const PROCESS_CTA = content.PROCESS_CTA;
export const APPROACH_STEPS = content.APPROACH_STEPS;
// Illustrative dashboard: the kind of measures agreed for a document workflow.
// Rendered under SECTIONS.analytics, whose description says "not client results".
export const MEASURE = content.MEASURE;
export const FAQ_CARD = content.FAQ_CARD;
// The founder card (content/team.json) leads the team carousel once the owner adds a real
// name, photo (an upload), role, bio and profile links.
export const FOUNDER = content.FOUNDER;
export const TEAM = content.TEAM;
export const TEAM_ROLES = content.TEAM_ROLES;
export const TESTIMONIALS = content.TESTIMONIALS;
export const FOOTER = content.FOOTER;
