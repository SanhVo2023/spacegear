// A tiny validation layer for the files in content/ (edited through the CMS at /admin/).
// Each schema checks a value and returns a fresh copy whose keys follow the schema's own
// order, so exported objects never depend on the key order a CMS writes; unknown keys are
// errors. Every schema also carries `meta`, which tests/cms-config.test.mjs uses to prove that
// public/admin/config.yml mirrors these rules (required fields, lengths, options, bounds).
// Erasable TypeScript only: scripts/check-content.mjs loads this under --experimental-strip-types.

export type TextFormat = "plain" | "slug" | "href" | "image" | "color";
export type Meta =
  | { kind: "text"; format: TextFormat; min: number; max: number; pattern?: RegExp }
  | { kind: "number"; min: number; max: number; integer: boolean }
  | { kind: "boolean" }
  | { kind: "literal"; value: boolean }
  | { kind: "oneOf"; values: readonly string[] }
  | { kind: "list"; item: AnySchema; min: number; max: number }
  | { kind: "object"; shape: Readonly<Record<string, AnySchema>> }
  | { kind: "nullable"; inner: AnySchema };

export type Schema<T> = ((value: unknown, path: string, issues: string[]) => T) & { readonly meta: Meta };
export type AnySchema = Schema<unknown>;
export type Infer<S> = S extends Schema<infer T> ? T : never;
type Shape = Record<string, AnySchema>;
type Output<S extends Shape> = { [K in keyof S]: Infer<S[K]> };

export class ContentError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Content check failed. Fix these fields:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "ContentError";
    this.issues = issues;
  }
}

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// A site path (never "//host", which browsers read as another site) or a full https:// address.
// Every other scheme is refused, mailto: included: the contact address comes only from
// SITE.contactEmail, which is env-gated.
export const HREF = /^(?:\/(?!\/)[\w.~/#?=&%-]*|https:\/\/[^\s"<>]+)$/;
// Lowercase names and extensions, and SVG only under /images/: an SVG served from /uploads/ would
// be an active same-origin document that a CMS editor could upload. No name has a dot before its
// extension, so a generated variant (photo.jpg.w640.webp) never fits, and no folder or file is a
// Windows device name (con, prn, aux, nul, com0-9, lpt0-9), which Git for Windows cannot check out.
// scripts/lib/uploads.mjs applies the same names to the files themselves.
export const IMAGE = /^(?!\/uploads\/.*\.svg$)(?!\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*(?:con|prn|aux|nul|com\d|lpt\d)[./])\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)$/;
export const COLOR = /^#[0-9a-fA-F]{6}$/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const at = (path: string, key: string | number) => (typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key);
const where = (path: string) => path || "(file)";
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
const show = (value: unknown) =>
  typeof value === "string" ? JSON.stringify(value) : Array.isArray(value) ? "a list" : isRecord(value) ? "a group of fields" : String(value);

function schema<T>(meta: Meta, run: (value: unknown, path: string, issues: string[]) => T): Schema<T> {
  return Object.assign(run, { meta });
}

type TextOptions = { min?: number; max: number; pattern?: RegExp; message?: string };
function textOf(format: TextFormat, { min = 1, max, pattern, message }: TextOptions): Schema<string> {
  return schema({ kind: "text", format, min, max, pattern }, (value, path, issues) => {
    if (typeof value !== "string") {
      issues.push(`${where(path)}: expected text`);
      return "";
    }
    // Lengths count code points, so an emoji is one character, not two UTF-16 units. Sveltia's
    // maxlength counter is the reference: if it counts differently, this follows it.
    const length = [...value].length;
    const trimmed = value.trim();
    if (min > 0 && trimmed === "") issues.push(`${where(path)}: required`);
    else {
      if (length < min) issues.push(`${where(path)}: needs at least ${count(min, "character")}`);
      if (value !== trimmed) issues.push(`${where(path)}: remove the spaces at the start or the end`);
      if (pattern && value !== "" && !pattern.test(value)) issues.push(`${where(path)}: ${message ?? `must match ${pattern}`}`);
    }
    if (length > max) issues.push(`${where(path)}: ${count(length, "character")}, the limit is ${max}`);
    return value;
  });
}

export const text = (options: TextOptions) => textOf("plain", options);
export const slug = (max = 60) => textOf("slug", { max, pattern: SLUG, message: "use lowercase letters, digits and single hyphens" });
export const href = () => textOf("href", { max: 200, pattern: HREF, message: "use a site path such as /contact/ or a full https:// address" });
export const image = () => textOf("image", { max: 200, pattern: IMAGE, message: "use a lowercase file name (letters, digits, - or _) ending in .webp, .png, .jpg, .jpeg, .avif or .gif under /images/ or /uploads/ (.svg only under /images/), not a Windows device name such as con or nul" });
export const color = () => textOf("color", { max: 7, pattern: COLOR, message: "use a hex colour such as #fa6e43" });

export function number({ min, max, integer = false }: { min: number; max: number; integer?: boolean }): Schema<number> {
  return schema({ kind: "number", min, max, integer }, (value, path, issues) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push(`${where(path)}: expected a number`);
      return 0;
    }
    if (integer && !Number.isInteger(value)) issues.push(`${where(path)}: expected a whole number`);
    if (value < min || value > max) issues.push(`${where(path)}: ${value} is outside ${min} to ${max}`);
    return value;
  });
}

export function boolean(): Schema<boolean> {
  return schema({ kind: "boolean" }, (value, path, issues) => {
    if (typeof value !== "boolean") {
      issues.push(`${where(path)}: expected true or false`);
      return false;
    }
    return value;
  });
}

/** A flag that must always hold `expected`. Typed as boolean, like the pre-CMS object literal. */
export function literal(expected: boolean): Schema<boolean> {
  return schema({ kind: "literal", value: expected }, (value, path, issues) => {
    if (value !== expected) issues.push(`${where(path)}: must be ${expected}`);
    return expected;
  });
}

export function oneOf(values: readonly string[]): Schema<string> {
  return schema({ kind: "oneOf", values: [...values] }, (value, path, issues) => {
    if (typeof value !== "string" || !values.includes(value)) {
      issues.push(`${where(path)}: ${show(value)} is not one of: ${values.join(", ")}`);
      return typeof value === "string" ? value : "";
    }
    return value;
  });
}

export function list<T>(item: Schema<T>, { min = 0, max }: { min?: number; max: number }): Schema<T[]> {
  return schema({ kind: "list", item, min, max }, (value, path, issues) => {
    if (!Array.isArray(value)) {
      issues.push(`${where(path)}: expected a list`);
      return [];
    }
    if (value.length < min) issues.push(`${where(path)}: needs at least ${count(min, "item")}`);
    if (value.length > max) issues.push(`${where(path)}: ${count(value.length, "item")}, the limit is ${max}`);
    return value.map((entry, index) => item(entry, at(path, index), issues));
  });
}

export function object<S extends Shape>(shape: S): Schema<Output<S>> {
  return schema({ kind: "object", shape }, (value, path, issues) => {
    const out: Record<string, unknown> = {};
    if (!isRecord(value)) {
      issues.push(`${where(path)}: expected a group of fields`);
      return out as Output<S>;
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(shape, key)) issues.push(`${at(path, key)}: unknown field (remove it, or add it to src/lib/content-model.ts and public/admin/config.yml)`);
    }
    for (const [key, child] of Object.entries(shape)) {
      if (Object.hasOwn(value, key)) out[key] = child(value[key], at(path, key), issues);
      else if (child.meta.kind === "nullable") out[key] = null;
      else issues.push(`${at(path, key)}: missing`);
    }
    return out as Output<S>;
  });
}

const MAX_DEPTH = 64;
// Recurses into the file's data, not the schema, so the depth is capped: absurd input is a
// ContentError instead of a RangeError (stack overflow).
const isEmpty = (value: unknown, path: string, depth = 0): boolean => {
  if (depth > MAX_DEPTH) throw new ContentError([`${where(path)}: nested more than ${MAX_DEPTH} levels deep`]);
  return value === null || value === undefined || value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (isRecord(value) && Object.values(value).every((child) => isEmpty(child, path, depth + 1)));
};

/**
 * An optional group: null, a missing key or an all-empty group (a CMS "not added" value) all mean
 * null. Only "", [], null and missing values are empty: `false` and `0` count as content, so a
 * group with a boolean or number field is never "not added" and is always validated.
 */
export function nullable<T>(inner: Schema<T>): Schema<T | null> {
  return schema({ kind: "nullable", inner }, (value, path, issues) => (isEmpty(value, path) ? null : inner(value, path, issues)));
}

/**
 * Validates one file's data and records its problems, prefixed with the file name. If the data is
 * too deeply nested to check, throws a ContentError with the problems found so far.
 */
export function check<T>(target: Schema<T>, value: unknown, file: string, issues: string[]): T {
  const local: string[] = [];
  const prefix = (issue: string) => `${file}: ${issue}`;
  try {
    const result = target(value, "", local);
    for (const issue of local) issues.push(prefix(issue));
    return result;
  } catch (error) {
    if (error instanceof ContentError) throw new ContentError([...issues, ...[...local, ...error.issues].map(prefix)]);
    throw error;
  }
}

/** Validates one file and throws a ContentError that lists every problem. */
export function parseContent<T>(target: Schema<T>, value: unknown, file: string): T {
  const issues: string[] = [];
  const result = check(target, value, file, issues);
  if (issues.length) throw new ContentError(issues);
  return result;
}
