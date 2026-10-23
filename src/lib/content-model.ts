// The content model behind the CMS: the public content types, one schema per file in
// content/, and buildContent(), which validates those files and derives the values that
// src/lib/content.ts exports. Service art and pillar summaries come from the service entries,
// so every place a service appears shows the same image and text.
// public/admin/config.yml mirrors these schemas field by field (tests/cms-config.test.mjs).
// Erasable TypeScript only: scripts/check-content.mjs loads this under --experimental-strip-types.
import { ContentError, SLUG, boolean, check, color, href, image, isRecord, list, literal, nullable, number, object, oneOf, slug, text } from "./content-schema.ts";
import type { Schema } from "./content-schema.ts";

export type Service = {
  slug: string; name: string; shortName: string; summary: string; buyerProblem: string;
  deliverables: string[]; process: string[]; faqs: { question: string; answer: string }[];
  relatedInsightSlugs: string[]; image: string; category: string;
};
export type Engagement = {
  name: string; short: string; img: string;
  stage: string; stageNo: string; deliverables: string[]; outcomes: string[]; featured: boolean;
};
export type Stat = { value: string; unit: string; label: string; sub: string };
export type SectionCopy = { title: string; index: string; heading: string; description: string };
export type WorkTile = { slug: string; name: string; img: string; desc: string; href: string };
export type Pillar = { no: string; slug: string; name: string; tag: string; glyph: string; img: string; desc: string };
export type ProcessStep = { step: string; name?: string; desc: string; outputs: string[] };
export type Person = { name: string; role: string; img: string; imgAlt: string; bio: string; links: { label: string; href: string }[] };
// Render only real, permission-confirmed quotes.
export type Testimonial = { img: string; name: string; role: string; company: string; quote: string; permissionConfirmed: true };
export type FooterLink = { label: string; href: string };

export const COLLECTION_NAMES = ["services", "engagements", "faqs", "team-roles", "testimonials"] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];
export type CollectionFile = { file: string; data: unknown };

/** One JSON file per page block. Keys are the buildContent() input names. */
export const SINGLETON_FILES = {
  home: "content/home.json",
  sections: "content/sections.json",
  work: "content/work.json",
  servicesPanel: "content/services-panel.json",
  process: "content/process.json",
  approach: "content/approach.json",
  measure: "content/measure.json",
  engagementsPanel: "content/engagements-panel.json",
  faqCard: "content/faq-card.json",
  team: "content/team.json",
  footer: "content/footer.json",
} as const;
export type SingletonName = keyof typeof SINGLETON_FILES;
export type ContentInput = Record<SingletonName, unknown> & { collections: Record<CollectionName, CollectionFile[]> };

const COUNT = /^\d+\/\d+$/;
const TWO_DIGITS = /^\d{2}$/;
const THREE_DIGITS = /^\d{3}$/;
const count = () => text({ max: 7, pattern: COUNT, message: "use a count such as 5/5" });
const order = () => number({ min: 1, max: 999, integer: true });
const link = () => object({ label: text({ max: 30 }), href: href() });

/**
 * content/site.json and content/vi/site.json (read by src/lib/site.ts; the rest of SITE comes from environment
 * variables). The address and the telephone are the owner's facts (bilingual spec, decision 4). The honesty scan
 * allows them only in these fields, and they must read exactly as on the Google Business Profile
 * (docs/operations/google-business-profile.md). `street` and `locality` feed the PostalAddress structured data.
 */
export const siteSchema = object({
  name: text({ max: 40 }),
  description: text({ max: 200 }),
  socialProfiles: list(text({ max: 200, pattern: /^https:\/\/\S+$/, message: "use a full https:// profile address" }), { max: 8 }),
  address: object({ full: text({ max: 120 }), street: text({ max: 80 }), locality: text({ max: 40 }) }),
  telephone: text({ max: 12, pattern: /^\+84\d{9}$/, message: "use the international format with no spaces, such as +84386749799" }),
});

/** Every content schema. Fields that name a service only accept the slugs of the service entries. */
export function contentSchemas(serviceSlugs: readonly string[]) {
  const service = () => oneOf(serviceSlugs);
  const section = () => object({
    title: text({ max: 30 }),
    index: text({ max: 3, pattern: THREE_DIGITS, message: "use three digits, such as 004" }),
    heading: text({ max: 140 }),
    description: text({ max: 160 }),
  });
  const steps = () => list(object({
    step: text({ max: 12 }),
    name: text({ max: 20 }),
    desc: text({ max: 220 }),
    outputs: list(text({ max: 40 }), { min: 1, max: 6 }),
  }), { min: 1, max: 8 });
  const person = () => ({ name: text({ max: 40 }), role: text({ max: 20 }), img: image(), imgAlt: text({ min: 0, max: 120 }) });

  return {
    site: siteSchema,
    singletons: {
      home: object({
        eyebrow: object({ muted: text({ max: 40 }), strong: text({ max: 40 }) }),
        headline: object({ lead: text({ max: 30 }), verbs: list(text({ max: 12 }), { min: 3, max: 3 }), tail: text({ max: 32 }) }),
        pitch: object({ title: text({ max: 40 }), text: text({ max: 48 }) }),
        cta: link(),
        stats: list(object({ value: text({ max: 4 }), unit: text({ min: 0, max: 4 }), label: text({ max: 24 }), sub: text({ max: 40 }) }), { min: 2, max: 2 }),
        corner: object({ title: text({ max: 40 }), sub: text({ max: 30 }), href: href() }),
        scrollHint: text({ max: 30 }),
        statement: text({ max: 120 }),
      }),
      sections: object({
        work: section(), services: section(), process: section(), analytics: section(), pricing: section(),
        faq: section(), team: section(), testimonials: section(), labs: section(),
      }),
      work: object({
        featured: object({ label: text({ max: 30 }), name: text({ max: 30 }), slug: service() }),
        lineup: object({ label: text({ max: 30 }), count: count(), title: text({ max: 60 }), text: text({ max: 200 }), footer: text({ max: 40 }) }),
        tiles: list(object({ slug: service(), name: text({ max: 30 }), desc: text({ max: 120 }) }), { min: 4, max: 4 }),
        assessment: object({
          title: text({ max: 40 }), badge: count(), note: text({ max: 60 }), chip: text({ max: 30 }),
          value: text({ max: 4 }), unit: text({ max: 6 }), progress: number({ min: 0, max: 100 }),
          cta: text({ max: 40 }), href: href(),
        }),
      }),
      servicesPanel: object({
        panel: object({
          label: text({ max: 30 }), count: count(), title: text({ max: 80 }), text: text({ max: 200 }),
          line: text({ max: 60 }), cta: text({ max: 40 }), href: href(),
        }),
        pillars: list(object({
          no: text({ max: 2, pattern: TWO_DIGITS, message: "use two digits, such as 03" }),
          slug: service(), name: text({ max: 30 }), tag: text({ max: 20 }), glyph: text({ max: 2 }),
        }), { min: 1, max: 12 }),
      }),
      process: object({
        steps: steps(),
        cta: object({ title: text({ max: 80 }), text: text({ max: 120 }), cta: text({ max: 30 }), href: href() }),
      }),
      approach: object({ steps: steps() }),
      measure: object({
        illustrative: literal(true),
        imageCard: object({ img: image(), accent: text({ max: 20 }), label: text({ max: 20 }) }),
        workflow: object({
          title: text({ max: 30 }), sub: text({ max: 40 }), center: text({ max: 6 }),
          segments: list(object({ label: text({ max: 24 }), value: number({ min: 0, max: 100 }), color: color() }), { min: 1, max: 6 }),
        }),
        stages: list(object({
          name: text({ max: 20 }), note: text({ max: 12 }), status: text({ max: 16 }), detail: text({ max: 24 }),
          hands: list(number({ min: 0, max: 360 }), { min: 2, max: 2 }),
        }), { min: 1, max: 6 }),
        stagesFooter: text({ max: 40 }),
        accuracy: object({ label: text({ max: 30 }), value: text({ max: 6 }), unit: text({ min: 0, max: 3 }), sub: text({ max: 24 }) }),
        throughput: object({
          title: text({ max: 24 }), sub: text({ max: 40 }),
          legend: list(object({ value: text({ max: 8 }), label: text({ max: 16 }) }), { min: 1, max: 4 }),
        }),
        readiness: object({
          title: text({ max: 30 }), sub: text({ max: 50 }), score: text({ max: 4 }), scoreLabel: text({ max: 24 }),
          bars: list(object({ label: text({ max: 16 }), v: number({ min: 0, max: 100 }) }), { min: 1, max: 8 }),
        }),
        coverage: object({ tag: text({ max: 30 }), value: text({ max: 8 }), label: text({ max: 30 }), progress: number({ min: 0, max: 100 }) }),
        connectors: object({ tag: text({ max: 30 }), glyphs: list(text({ max: 2 }), { min: 1, max: 8 }) }),
        ticker: list(text({ max: 40 }), { min: 1, max: 16 }),
        cta: link(),
      }),
      engagementsPanel: object({ footer: object({ text: text({ max: 80 }), href: href() }) }),
      faqCard: object({
        title: text({ max: 40 }), text: text({ max: 200 }), cta: text({ max: 30 }), href: href(),
        img: image(), imgAlt: text({ min: 0, max: 120 }), badge: text({ max: 60 }),
      }),
      team: object({
        label: text({ max: 30 }),
        cta: link(),
        founder: nullable(object({ ...person(), links: list(link(), { max: 4 }), bio: text({ max: 240 }) })),
      }),
      footer: object({
        badge: text({ max: 60 }), tagline: text({ max: 80 }),
        identity: list(text({ max: 30 }), { min: 1, max: 3 }), identityStrong: text({ max: 30 }),
        columns: list(list(link(), { min: 1, max: 12 }), { min: 1, max: 3 }),
        quickStart: object({ title: text({ max: 40 }), text: text({ max: 100 }), note: text({ max: 80 }) }),
        about: text({ max: 120 }),
      }),
    },
    collections: {
      services: object({
        slug: slug(40), name: text({ max: 60 }), shortName: text({ max: 40 }), category: text({ max: 20 }), image: image(),
        summary: text({ max: 160 }), buyerProblem: text({ max: 320 }),
        deliverables: list(text({ max: 100 }), { min: 1, max: 8 }),
        process: list(text({ max: 100 }), { min: 1, max: 6 }),
        faqs: list(object({ question: text({ max: 80 }), answer: text({ max: 300 }) }), { min: 1, max: 6 }),
        // No insights are published yet, so a service cannot point at one.
        relatedInsightSlugs: list(slug(60), { max: 0 }),
        order: order(),
      }),
      engagements: object({
        name: text({ max: 40 }), short: text({ max: 12 }), img: image(), stage: text({ max: 20 }),
        stageNo: text({ max: 2, pattern: TWO_DIGITS, message: "use two digits, such as 02" }),
        deliverables: list(text({ max: 60 }), { min: 3, max: 6 }),
        outcomes: list(text({ max: 60 }), { min: 3, max: 6 }),
        featured: boolean(),
        order: order(),
      }),
      faqs: object({ question: text({ max: 100 }), answer: text({ max: 400 }), order: order() }),
      // Roles, not people: role cards never link to profiles.
      "team-roles": object({ ...person(), links: list(link(), { max: 0 }), bio: text({ max: 240 }), order: order() }),
      testimonials: object({
        img: image(), name: text({ max: 60 }), role: text({ max: 60 }), company: text({ max: 80 }),
        quote: text({ max: 400 }), permissionConfirmed: boolean(), order: order(),
      }),
    },
  };
}

type Loaded<T> = { file: string; entry: T };

/** Validates every entry of a folder collection and sorts them by `order` (unique per collection). */
function loadCollection<T extends { order: number }>(files: readonly CollectionFile[], name: CollectionName, entrySchema: Schema<T>, issues: string[], dir: string): Loaded<T>[] {
  const loaded = files.map(({ file, data }) => ({ file, entry: check(entrySchema, data, `${dir}/${name}/${file}`, issues) }));
  const taken = new Map<number, string>();
  for (const { file, entry } of loaded) {
    // A missing or invalid order is already reported by the schema; it is not a shared number.
    if (!Number.isInteger(entry.order) || entry.order < 1) continue;
    const other = taken.get(entry.order);
    if (other !== undefined) issues.push(`${dir}/${name}/${file}: order ${entry.order} is already used by ${other}; give every entry its own number`);
    else taken.set(entry.order, file);
  }
  return [...loaded].sort((a, b) => a.entry.order - b.entry.order || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/** Drops the CMS-only `order` field, keeping the other keys in their order. */
function withoutOrder<T extends { order: number }>(entry: T): Omit<T, "order"> {
  const copy: Partial<T> = { ...entry };
  delete copy.order;
  return copy as Omit<T, "order">;
}

/**
 * Reports every entry whose `fields` repeat an earlier entry's values, in display order. The
 * site uses these values to tell entries apart (React keys, the selected engagement). Several
 * fields are joined with "|", exactly like the key that TestimonialsCarousel builds from name and
 * company, so two entries whose fields differ but join to the same key are refused too. Missing
 * and empty values are left to the schema.
 */
function uniqueField<T, K extends keyof T & string>(loaded: readonly Loaded<T>[], name: CollectionName, fields: K | readonly K[], issues: string[], dir: string) {
  const keys: readonly K[] = typeof fields === "string" ? [fields] : fields;
  const seen = new Map<string, string>();
  for (const { file, entry } of loaded) {
    const values: unknown[] = keys.map((key) => entry[key]);
    if (values.some((value) => typeof value !== "string" || value === "")) continue;
    const id = values.join("|");
    const other = seen.get(id);
    if (other === undefined) seen.set(id, file);
    else if (keys.length === 1) issues.push(`${dir}/${name}/${file}: ${keys[0]} ${JSON.stringify(id)} is already used by ${other}; give every entry its own ${keys[0]}`);
    else issues.push(`${dir}/${name}/${file}: ${keys.join(" and ")} make the key ${JSON.stringify(id)}, which ${other} already uses; give every entry its own combination of ${keys.join(" and ")}`);
  }
}

/**
 * Reports items that repeat an earlier item of the same list: the site renders these lists with
 * the value as the React key. With `key`, the value is that field of each item (a tile's slug).
 */
function uniqueItems(items: unknown, file: string, field: string, issues: string[], key?: string) {
  if (!Array.isArray(items)) return;
  const at = (index: number) => (key === undefined ? `${field}[${index}]` : `${field}[${index}].${key}`);
  const seen = new Map<string, number>();
  items.forEach((item: unknown, index) => {
    const value = key === undefined ? item : isRecord(item) ? item[key] : undefined;
    if (typeof value !== "string" || value === "") return;
    const first = seen.get(value);
    if (first !== undefined) issues.push(`${file}: ${at(index)}: ${JSON.stringify(value)} repeats ${at(first)}; make every item different`);
    else seen.set(value, index);
  });
}

/**
 * The engagements section highlights one engagement, so exactly one entry sets `featured`. When
 * an entry's file has no true/false `featured` (the schema reports it), "none featured" is not
 * also reported.
 */
function oneFeatured(engagements: readonly Loaded<{ featured: boolean }>[], files: readonly CollectionFile[], issues: string[], dir: string) {
  const featured = engagements.filter(({ entry }) => entry.featured === true);
  const unreadable = files.some(({ data }) => !isRecord(data) || typeof data.featured !== "boolean");
  if (featured.length === 0 && !unreadable) issues.push(`${dir}/engagements: no engagement is featured; set featured on exactly one`);
  for (const { file } of featured.slice(1)) issues.push(`${dir}/engagements/${file}: featured is already set on ${featured[0].file}; set featured on exactly one engagement`);
}

/** Validates all content and derives the exported values. Throws one ContentError listing every problem, each
 *  named by its file under `dir` ("content" for English, "content/vi" for Vietnamese). */
export function buildContent(input: ContentInput, dir = "content") {
  const issues: string[] = [];
  const fileOf = (name: SingletonName) => SINGLETON_FILES[name].replace(/^content\//, `${dir}/`);
  const services = loadCollection(input.collections.services, "services", contentSchemas([]).collections.services, issues, dir);
  // Only a well-formed slug names a service: a malformed one is reported by the schema alone,
  // with no advice to rename the file after it, and tiles and pillars cannot point at it.
  const serviceSlugs: string[] = [];
  for (const { file, entry } of services) {
    uniqueItems(entry.deliverables, `${dir}/services/${file}`, "deliverables", issues);
    const value: unknown = entry.slug;
    if (typeof value !== "string" || !SLUG.test(value)) continue;
    serviceSlugs.push(value);
    if (file !== `${value}.json`) issues.push(`${dir}/services/${file}: rename the file to ${value}.json (it must match the slug)`);
  }
  const schemas = contentSchemas(serviceSlugs);
  const one = schemas.singletons;
  const home = check(one.home, input.home, fileOf("home"), issues);
  const sections = check(one.sections, input.sections, fileOf("sections"), issues);
  const work = check(one.work, input.work, fileOf("work"), issues);
  const servicesPanel = check(one.servicesPanel, input.servicesPanel, fileOf("servicesPanel"), issues);
  const processBlock = check(one.process, input.process, fileOf("process"), issues);
  const approach = check(one.approach, input.approach, fileOf("approach"), issues);
  const measure = check(one.measure, input.measure, fileOf("measure"), issues);
  const engagementsPanel = check(one.engagementsPanel, input.engagementsPanel, fileOf("engagementsPanel"), issues);
  const faqCard = check(one.faqCard, input.faqCard, fileOf("faqCard"), issues);
  const team = check(one.team, input.team, fileOf("team"), issues);
  const footer = check(one.footer, input.footer, fileOf("footer"), issues);
  const many = schemas.collections;
  const engagements = loadCollection(input.collections.engagements, "engagements", many.engagements, issues, dir);
  const faqs = loadCollection(input.collections.faqs, "faqs", many.faqs, issues, dir);
  const roles = loadCollection(input.collections["team-roles"], "team-roles", many["team-roles"], issues, dir);
  const testimonials = loadCollection(input.collections.testimonials, "testimonials", many.testimonials, issues, dir);
  for (const { file, entry } of engagements) {
    uniqueItems(entry.deliverables, `${dir}/engagements/${file}`, "deliverables", issues);
    uniqueItems(entry.outcomes, `${dir}/engagements/${file}`, "outcomes", issues);
  }
  uniqueField(engagements, "engagements", "name", issues, dir);
  oneFeatured(engagements, input.collections.engagements, issues, dir);
  uniqueField(faqs, "faqs", "question", issues, dir);
  uniqueField(testimonials, "testimonials", ["name", "company"], issues, dir);
  uniqueItems(work.tiles, fileOf("work"), "tiles", issues, "slug");
  if (issues.length) throw new ContentError(issues);

  const SERVICES: Service[] = services.map(({ entry }) => withoutOrder(entry));
  const bySlug = new Map(SERVICES.map((item) => [item.slug, item]));
  const art = (serviceSlug: string) => bySlug.get(serviceSlug) as Service;
  const WORK = {
    featured: { label: work.featured.label, name: work.featured.name, img: art(work.featured.slug).image, href: `/services/${work.featured.slug}/` },
    lineup: work.lineup,
    tiles: work.tiles.map((tile): WorkTile => ({ slug: tile.slug, name: tile.name, img: art(tile.slug).image, desc: tile.desc, href: `/services/${tile.slug}/` })),
    assessment: work.assessment,
  };
  const PILLARS: Pillar[] = servicesPanel.pillars.map((pillar) => ({
    no: pillar.no, slug: pillar.slug, name: pillar.name, tag: pillar.tag, glyph: pillar.glyph,
    img: art(pillar.slug).image, desc: art(pillar.slug).summary,
  }));
  const ENGAGEMENTS: Engagement[] = engagements.map(({ entry }) => withoutOrder(entry));
  const TEAM_ROLES: Person[] = roles.map(({ entry }) => withoutOrder(entry));
  const TESTIMONIALS: Testimonial[] = testimonials
    .filter(({ entry }) => entry.permissionConfirmed)
    .map(({ entry }) => ({ ...withoutOrder(entry), permissionConfirmed: true }));
  const PROCESS_STEPS: ProcessStep[] = processBlock.steps;
  const APPROACH_STEPS: ProcessStep[] = approach.steps;
  const FOUNDER: Person | null = team.founder;

  return {
    SERVICES,
    ENGAGEMENTS,
    ENGAGEMENTS_FOOTER: engagementsPanel.footer,
    FAQS: faqs.map(({ entry }) => withoutOrder(entry)),
    HOME: home,
    SECTIONS: sections,
    WORK,
    PILLARS,
    CORE_PANEL: servicesPanel.panel,
    PROCESS_STEPS,
    PROCESS_CTA: processBlock.cta,
    APPROACH_STEPS,
    MEASURE: measure,
    FAQ_CARD: faqCard,
    FOUNDER,
    TEAM: { label: team.label, cta: team.cta },
    TEAM_ROLES,
    TESTIMONIALS,
    FOOTER: footer,
  };
}
