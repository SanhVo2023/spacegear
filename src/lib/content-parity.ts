// The Vietnamese files mirror the English ones (bilingual spec, "Loader"): the same files and entries, the same
// fields and list lengths. Only text may differ, and text that holds no letter in English (a figure, a count, a
// symbol: "62%", "05", "5/5", "⠿") or follows a pattern ("004", "+84386749799") stays exactly the same, and so do
// links, images, colours, slugs, numbers, switches and choices. The CMS keeps it that way (those fields are
// `i18n: duplicate` in public/admin/config.yml); this check catches a hand edit and a missing translation.
// Erasable TypeScript only (scripts/check-content.mjs loads it under --experimental-strip-types).
import { COLLECTION_NAMES, SINGLETON_FILES, contentSchemas, siteSchema } from "./content-model.ts";
import type { ContentInput, SingletonName } from "./content-model.ts";
import { isRecord } from "./content-schema.ts";
import type { AnySchema } from "./content-schema.ts";

export type LocaleFiles = ContentInput & { site: unknown };
type Where = { en: string; vi: string };

const LETTER = /\p{L}/u;
const at = (path: string, key: string | number) => (typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key);
/** An optional group the CMS left empty ("not added"), as `nullable()` reads it. */
const blank = (value: unknown, depth = 0): boolean =>
  depth > 64 || value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0) ||
  (isRecord(value) && Object.values(value).every((child) => blank(child, depth + 1)));
const KIND: Record<string, string> = { href: "links", image: "images", color: "colours", slug: "slugs" };

/** Compares one value of an English file with its Vietnamese twin, by the schema. */
export function valueParity(schema: AnySchema, en: unknown, vi: unknown, path: string, where: Where, issues: string[]): void {
  const meta = schema.meta;
  const same = (why: string) => {
    if (JSON.stringify(en) !== JSON.stringify(vi)) issues.push(`${where.vi}: ${path || "(file)"} is ${JSON.stringify(vi)}, but it must stay ${JSON.stringify(en)} as in ${where.en} (${why})`);
  };
  switch (meta.kind) {
    case "text":
      if (meta.format !== "plain") return same(`${KIND[meta.format]} are the same in both languages`);
      if (meta.pattern || (typeof en === "string" && !LETTER.test(en))) return same("figures, counts and symbols are the same in both languages");
      return;
    case "number":
    case "boolean":
    case "literal":
    case "oneOf":
      return same("numbers, switches and choices are the same in both languages");
    case "nullable":
      if (blank(en) !== blank(vi)) issues.push(`${where.vi}: ${path} is ${blank(vi) ? "empty" : "filled in"}, but in ${where.en} it is ${blank(en) ? "empty" : "filled in"}: add or remove it in both languages`);
      else if (!blank(en)) valueParity(meta.inner, en, vi, path, where, issues);
      return;
    case "list":
      if (!Array.isArray(en) || !Array.isArray(vi)) return;
      if (en.length !== vi.length) {
        issues.push(`${where.vi}: ${path} has ${vi.length} item${vi.length === 1 ? "" : "s"}, but ${where.en} has ${en.length}: keep the same items in both languages`);
        return;
      }
      en.forEach((item, index) => valueParity(meta.item, item, vi[index], at(path, index), where, issues));
      return;
    case "object":
      if (!isRecord(en) || !isRecord(vi)) return;
      for (const [key, child] of Object.entries(meta.shape)) valueParity(child, en[key], vi[key], at(path, key), where, issues);
      return;
  }
}

const slugsOf = (files: LocaleFiles) => files.collections.services.flatMap(({ data }) => (isRecord(data) && typeof data.slug === "string" ? [data.slug] : []));

/** Every way the Vietnamese files differ from the English ones other than in their text. */
export function contentParityProblems(en: LocaleFiles, vi: LocaleFiles, dirs: Where = { en: "content", vi: "content/vi" }): string[] {
  const issues: string[] = [];
  const schemas = contentSchemas(slugsOf(en));
  valueParity(siteSchema, en.site, vi.site, "", { en: `${dirs.en}/site.json`, vi: `${dirs.vi}/site.json` }, issues);
  for (const name of Object.keys(SINGLETON_FILES) as SingletonName[]) {
    const file = SINGLETON_FILES[name].replace(/^content\//, "");
    valueParity(schemas.singletons[name], en[name], vi[name], "", { en: `${dirs.en}/${file}`, vi: `${dirs.vi}/${file}` }, issues);
  }
  for (const name of COLLECTION_NAMES) {
    const vietnamese = new Map(vi.collections[name].map(({ file, data }) => [file, data]));
    const english = new Set(en.collections[name].map(({ file }) => file));
    for (const { file, data } of en.collections[name]) {
      if (!vietnamese.has(file)) issues.push(`${dirs.vi}/${name}/${file}: missing; every English entry needs its Vietnamese version (in the CMS, open the entry and fill in its Vietnamese side)`);
      else valueParity(schemas.collections[name], data, vietnamese.get(file), "", { en: `${dirs.en}/${name}/${file}`, vi: `${dirs.vi}/${name}/${file}` }, issues);
    }
    for (const { file } of vi.collections[name]) if (!english.has(file)) issues.push(`${dirs.vi}/${name}/${file}: has no English entry ${dirs.en}/${name}/${file}; add the English one or remove it`);
  }
  return issues;
}
