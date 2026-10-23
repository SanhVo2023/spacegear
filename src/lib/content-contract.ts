// Compile-time proof that the CMS loader kept the public content API: every export of
// src/lib/content.ts still has the type it had before the migration. The reference types
// (tests/fixtures/content-v1.d.ts) were emitted by tsc from the pre-CMS module. If a type
// drifts, `npm run typecheck` fails on the matching line below.
import type * as Before from "../../tests/fixtures/content-v1";
import type * as After from "./content";

// Exact equality: mutual assignability would also accept an added optional key or `any`.
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

export type ContentContract = [
  Expect<Same<Before.Service, After.Service>>,
  Expect<Same<Before.Engagement, After.Engagement>>,
  Expect<Same<Before.Stat, After.Stat>>,
  Expect<Same<Before.SectionCopy, After.SectionCopy>>,
  Expect<Same<Before.WorkTile, After.WorkTile>>,
  Expect<Same<Before.Pillar, After.Pillar>>,
  Expect<Same<Before.ProcessStep, After.ProcessStep>>,
  Expect<Same<Before.Person, After.Person>>,
  Expect<Same<Before.Testimonial, After.Testimonial>>,
  Expect<Same<Before.FooterLink, After.FooterLink>>,
  Expect<Same<typeof Before.SERVICES, typeof After.SERVICES>>,
  Expect<Same<typeof Before.ENGAGEMENTS, typeof After.ENGAGEMENTS>>,
  Expect<Same<typeof Before.ENGAGEMENTS_FOOTER, typeof After.ENGAGEMENTS_FOOTER>>,
  Expect<Same<typeof Before.FAQS, typeof After.FAQS>>,
  Expect<Same<typeof Before.INSIGHTS, typeof After.INSIGHTS>>,
  Expect<Same<typeof Before.CASE_STUDIES, typeof After.CASE_STUDIES>>,
  Expect<Same<typeof Before.serviceBySlug, typeof After.serviceBySlug>>,
  Expect<Same<typeof Before.HOME, typeof After.HOME>>,
  Expect<Same<typeof Before.SECTIONS, typeof After.SECTIONS>>,
  Expect<Same<typeof Before.WORK, typeof After.WORK>>,
  Expect<Same<typeof Before.PILLARS, typeof After.PILLARS>>,
  Expect<Same<typeof Before.CORE_PANEL, typeof After.CORE_PANEL>>,
  Expect<Same<typeof Before.PROCESS_STEPS, typeof After.PROCESS_STEPS>>,
  Expect<Same<typeof Before.PROCESS_CTA, typeof After.PROCESS_CTA>>,
  Expect<Same<typeof Before.APPROACH_STEPS, typeof After.APPROACH_STEPS>>,
  Expect<Same<typeof Before.MEASURE, typeof After.MEASURE>>,
  Expect<Same<typeof Before.FAQ_CARD, typeof After.FAQ_CARD>>,
  Expect<Same<typeof Before.FOUNDER, typeof After.FOUNDER>>,
  Expect<Same<typeof Before.TEAM, typeof After.TEAM>>,
  Expect<Same<typeof Before.TEAM_ROLES, typeof After.TEAM_ROLES>>,
  Expect<Same<typeof Before.TESTIMONIALS, typeof After.TESTIMONIALS>>,
  Expect<Same<typeof Before.FOOTER, typeof After.FOOTER>>,
];
