// Site copy, loaded from the files in content/ (edited through the CMS at /admin/).
// Every file is validated when this module loads: at build time, in `npm test` and in
// scripts/check-content.mjs, so a malformed edit fails with a list of the fields to fix.
// The exports keep the names and types the components used before the CMS
// (src/lib/content-contract.ts proves the types; tests/content-roundtrip.test.mjs the values).
// Honesty rules (tests/content.test.mjs, scripts/check-content.mjs): no invented clients,
// staff, prices, timelines, offices, press or results. Illustrative figures are labelled
// where they render. See docs/superpowers/specs/2026-10-20-spacegear-fidelity-design.md.
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
import { COLLECTION_FILES } from "./content-index.generated.ts";
import { buildContent } from "./content-model.ts";
import type { Service } from "./content-model.ts";

export type { Article, Engagement, FooterLink, Person, Pillar, ProcessStep, SectionCopy, Service, Stat, Testimonial, WorkTile } from "./content-model.ts";

const content = buildContent({
  home, sections, work, servicesPanel, process: processBlock, approach, measure,
  engagementsPanel, faqCard, team, footer, collections: COLLECTION_FILES,
});

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
export const ARTICLES = content.ARTICLES;
export const FOOTER = content.FOOTER;
