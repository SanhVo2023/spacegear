// js-yaml 4.2.0 ships no type declarations (and @types/js-yaml is not a dependency). These are the parts the
// TypeScript modules use: src/lib/labs-files.ts reads article front matter with the JSON schema, so dates stay text.
declare module "js-yaml" {
  export interface Schema {
    readonly __brand?: "js-yaml.Schema";
  }
  export const FAILSAFE_SCHEMA: Schema;
  export const JSON_SCHEMA: Schema;
  export const CORE_SCHEMA: Schema;
  export const DEFAULT_SCHEMA: Schema;
  export interface LoadOptions {
    filename?: string;
    schema?: Schema;
    json?: boolean;
  }
  export function load(source: string, options?: LoadOptions): unknown;
}
