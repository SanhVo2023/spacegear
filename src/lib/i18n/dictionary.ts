// The UI strings in each language (en.ts is the source of the keys; vi.ts must match it exactly: a missing key
// fails `npm run typecheck`, an extra key fails it as an excess property, and tests/i18n-dictionary.test.mjs checks
// lists, placeholders and honesty). Erasable TypeScript only (scripts load it under --experimental-strip-types).
import { en } from "./en.ts";
import { vi } from "./vi.ts";
import type { Locale } from "./locales.ts";

type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };
/** en.ts's shape with every string widened; tuples keep their length. */
export type Dictionary = Widen<typeof en>;

const DICTIONARIES: Record<Locale, Dictionary> = { en, vi };

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Fills "{name}" placeholders; an unknown placeholder stays as it is. For attributes and plain strings. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (Object.hasOwn(values, key) ? String(values[key]) : match));
}

/**
 * format() for JSX children: the template's text and the values as separate children, so React renders exactly
 * what `Role {i + 1} of {n}` written inline rendered (the same text nodes), and English HTML stays byte-identical.
 */
export function formatParts(template: string, values: Record<string, string | number>): (string | number)[] {
  return template.split(/(\{\w+\})/).filter((part) => part !== "").map((part) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key !== undefined && Object.hasOwn(values, key) ? values[key] : part;
  });
}
