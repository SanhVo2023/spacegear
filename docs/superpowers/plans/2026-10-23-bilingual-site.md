# Bilingual site (Part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve every page of spacegear.tech in English (today's URLs) and Vietnamese (under `/vi/`), with the right `<html lang>`, a Worker region redirect and a no-JS EN/VI switch, Vietnamese fonts, the owner's contact details (NAP), a Vietnamese honesty scan, bilingual SEO and gates for both languages.

**Architecture:** One component tree serves both languages. Server components take a `locale` prop; client components read it from a React context (`useLocale()`), so English markup stays identical while components learn Vietnamese. Copy comes from `getContent(locale)` (the CMS files, `content/` and `content/vi/`) and UI strings from a typed dictionary (`dictionary(locale)`). Two root layouts in route groups (`src/app/(en)/` and `src/app/(vi)/vi/`) give each static page its own `<html lang>`; `global-not-found.tsx` gives one bilingual 404. The Worker runs first for HTML navigations only and redirects first visits from Vietnam (or with a Vietnamese browser) to the `/vi/` twin, and turns `?lang=` into the `sg_lang` cookie.

**Tech Stack:** Next.js 16.2.7 (`output: "export"`, Turbopack, route groups, `experimental.globalNotFound`), React 19.2, Tailwind CSS 4.3 (`@import "tailwindcss" source("..")`), `next/font/local`, Cloudflare Workers Static Assets (`assets.run_worker_first`), Sveltia CMS 0.230.1 i18n, node:test with tsx, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-23-bilingual-labs-cursor-design.md`, Part 2 (owner-approved). Part 3 (Labs articles) has its own plan, `docs/superpowers/plans/2026-10-23-labs-articles.md`, and uses the shared interfaces defined below with exactly these names.

---

## Research notes (verified 2026-10-23 in this worktree; probes under `artifacts/plan-probe-next/` and `artifacts/tw-probe/`, both gitignored)

**Next 16.2.7, `<html lang>` per language.**
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`: route groups can each define a root layout. With no top-level `app/layout.tsx`, the home route must live inside a group. Navigating between root layouts is a full page load, which is what the spec wants for the language switch.
- `…/not-found.md`: `global-not-found.js` (experimental, `experimental: { globalNotFound: true }`) is the 404 for apps with several root layouts. It bypasses layouts, so it returns its own `<html>` and imports its own CSS and fonts.
- **Probe (Turbopack production build, `output: "export"`, `trailingSlash: true`):** `app/(en)/layout.jsx` with `<html lang="en">`, `app/(vi)/layout.jsx` with `<html lang="vi">`, pages under `app/(en)/…` and `app/(vi)/vi/…`, a `template.jsx` inside a group, `app/global-not-found.jsx`, `app/sitemap.js` and `app/llms.txt/route.js` at the app root, `app/favicon.ico`. Result:
  - `out/index.html` has `<html lang="en">` and `out/vi/index.html` has `<html lang="vi">`.
  - `out/404.html` is the global-not-found page (also `out/404/index.html` and `out/_not-found/index.html`, which `scripts/package-site.mjs` already ships).
  - Root-level metadata routes and route handlers still work without a root layout. `favicon.ico` is still linked from every page, the 404 included.
  - `sitemap()` entries with `alternates.languages` render `<xhtml:link rel="alternate" hreflang=…>` and add `xmlns:xhtml` to `<urlset>`.
- **Empty dynamic routes (Part 3):** `node_modules/next/dist/build/index.js` (around line 1362) throws E87, `Page "…" is missing "generateStaticParams()" so it cannot be used with "output: export" config`, whenever a dynamic route prerenders zero paths. The probe reproduced it with `generateStaticParams() { return [] }`. So a language with no articles must not have the route file at all. Part 3 does this with `pageExtensions`: the probe named the files `page.en-labs.jsx` and `route.en-labs.js`, and they became routes only when `next.config` listed `en-labs.jsx`/`en-labs.js`. Without that, `/labs/` did not exist. Route handlers (`rss.xml`) follow the same rule.

**Fonts.**
- The shipped `src/app/fonts/inter-latin.woff2` (Inter "Version 4.001;git-66647c0bb", variable wght 100–900) and `jetbrains-mono-latin.woff2` ("Version 2.211", wght 100–800) are Google Fonts' `latin` subsets. Neither has any precomposed Vietnamese letter (fontTools cmap check: 102 of 102 missing).
- Google Fonts' CSS2 API (`fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@100..800`, Chrome user agent) serves `vietnamese` subsets of the same versions with the same vertical metrics. Both are OFL 1.1, and the copyright lines are already in `public/licenses/fonts.txt`:
  - Inter: `https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2pL7SUc.woff2`, 10 252 bytes, sha256 `5c66f9e07e90c6d4ac4922cc68d60de26c17b1858e677fb5e603fce3952b3ff2`.
  - JetBrains Mono: `https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD0OwG_TA.woff2`, 7 504 bytes, sha256 `2288795da89dd97e648954b96e22b4501bd85dfc453264460b252f888b582ca2`.
  - Copies downloaded for this plan: `C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/plan-probes/fonts-dl/{inter,jbm}-vietnamese-gf.woff2`.
  - Their `unicode-range` is `U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB`.
- **Turbopack names a `next/font/local` family after the JS binding.** Today's CSS has `font-family:inter` and `font-family:mono`, and `--font-code:"mono", "mono Fallback"`. So two calls can share a family only through a custom `declarations: [{ prop: "font-family", value: … }]`.
- **Probe:** two `localFont()` calls declaring the same family `SG Inter` (the second with `unicode-range`), imported only for their side effect.
  - Both `@font-face` rules were emitted, and only the latin file kept the `.p.` preload name and a `<link rel="preload">`.
  - With a custom family, Turbopack's `variable` still points at the binding name. So the site sets its own CSS variables (`--font-inter`, `--font-code`) and its own metric-adjusted fallback faces. The values are copied from today's generated CSS:
    - Inter: `ascent-override:89.79%; descent-override:22.36%; line-gap-override:0%; size-adjust:107.89%`;
    - Mono: `77.57% / 22.82% / 0% / 131.49%`.
  - `next/font` options must be literals, so the range string is written in each call.

**Sveltia CMS 0.230.1** (vendored bundle `public/admin/sveltia/sveltia-cms.js`, schema `scripts/sveltia-cms.schema.json`).
- Global `i18n`: `{ structure, locales, default_locale, initial_locales, omit_default_locale_from_file_path }`. `save_all_locales` and `omit_default_locale_from_filename` are deprecated. Collections and collection files take `i18n: true` (or an options object). Every field type takes `i18n: true | "translate" | "duplicate" | false | "none"`.
- The path rule, from the bundle's `nj()`: when a path holds `{{locale}}`, the default locale's file path drops `{{locale}}/`, as long as `omit_default_locale_from_file_path: true`. The `{{locale}}` placeholder takes precedence over `structure`, and file collections must use it. So:
  - `file: content/{{locale}}/home.json` writes `content/home.json` (en) and `content/vi/home.json` (vi);
  - `folder: content/{{locale}}/services` writes `content/services/*.json` and `content/vi/services/*.json`;
  - `content/{{locale}}/legal/privacy.md` writes `content/vi/legal/privacy.md`.
- Field-level `i18n`: `duplicate` makes a field read-only outside English and copies the English value. A subfield without its own setting inherits its parent's (`K1()` walks up the key path). Validation skips non-default locales for `false` and `duplicate` fields. This plan sets `i18n` explicitly on every field, and a test enforces it.
- **The default locale can never be disabled.** The editor's "Disable {locale}" control is disabled when `locale === defaultLocale`. Non-default locales can be disabled only with `initial_locales` set. Field `required` also takes a locale list (`required: [en]`). Part 3 relies on both.

**Cloudflare Workers Static Assets, `run_worker_first`** (wrangler 4.151.2 `parseStaticRouting`, `wrangler-dist/cli.js` around line 165733; miniflare router `node_modules/miniflare/dist/src/workers/assets/router.worker.js` lines 165–178 and 1833–1856).
- Rules start with `/` (to the Worker) or `!/` (to assets). At least one positive rule is needed; at most 100 rules, each under 100 characters.
- A rule ending in `*` makes any other rule with that prefix "redundant", which is an error. So `/*` cannot sit next to `/api/*`.
- Matching is a glob on the pathname only (no query string): `*` becomes `.*` (it crosses `/`) and the rule is anchored. **Negative rules are checked first and win.**
- The chosen list is `["/*", "!/_next/*", "!/images/*", "!/textures/*", "!/uploads/*", "!/admin/*", "!/vi/*", "!/*.*"]`. Here `/*.*` is "any path with a dot", which covers every file. `/vi` (no slash) still reaches the Worker, which passes it to assets.
- Responses fetched through `env.ASSETS.fetch()` still get `_headers`: the asset worker's `attachCustomHeaders` runs on binding fetches. Worker-made responses (the redirects) do not, so they set their own `Cache-Control: no-store`.
- **`request.cf` in `wrangler dev --local`** comes from `node_modules/.mf/cf.json`, cached from `workers.cloudflare.com/cf.json`. In this worktree it says `"country":"VN"`, so without care the preview would redirect every English test run to `/vi/`. Hence:
  - with the local-only variable `LOCALE_TEST_HEADER="true"` (top-level `vars`; `"false"` in `env.production`) on a localhost `SITE_ORIGIN`, the Worker ignores `request.cf` and reads the country only from the `x-sg-test-country` header;
  - Node's `fetch` sends `accept-language: *`, and Playwright sends `en-US`, so English checks stay English.

**Tailwind 4.3 scope** (`artifacts/tw-probe/one.mjs` and `diff.mjs`, given in full in Task 3).
- With `@import "tailwindcss" source("..")` (base `src/`, relative to `src/app/globals.css`) and the six `@source not` lines removed, the utilities layer loses 29 rules, all class names quoted only in docs and plans: `top-[72px]`, `left-4`, `ml-0.5`, `contents`, `h-1`, `w-1`, `w-[min(120vw,720px)]`, `flex-[0.8]`, `flex-[2.3]`, `flex-[2.6]`, `scroll-mt-24`, `align-top`, `text-[8.5px]`, `text-[19px]`, `text-[clamp(48px,10.8vw,116px)]`, `leading-[0.85]`, `tracking-[0.18em]`, `tracking-tight`, `shadow-[0_0_24px_rgba(250,110,67,0.6)]`, `outline`, `invert`, `ease-in-out`, `hover:underline`, `focus:outline-none`, `lg:bottom-auto`, `lg:mx-0`, `lg:h-screen`, `lg:min-h-screen`, `lg:opacity-100`.
- It also loses the theme variables `--ease-in-out` and `--tracking-tight`, which only those utilities used. No rule is added.
- A word search shows the 7 names that appear in `src/` only inside CSS comments or values (`ease-in-out` in keyframes, `scroll-mt-24` in a comment) or as part of a longer class (`h-1.5`, `lg:contents`).
- **`@tailwindcss/postcss` caches by file within one process.** Each stylesheet must be built in its own `node` process.

**Honesty scan today** (`scripts/lib/honesty.mjs`).
- `npm test` and `check-content` are red on this branch. `content/vi/measure.json` repeats the dashboard figures (62%, 94.6%, +68%, 82, 99.1%), which the scan allows only in `content/measure.json` (MEASURE_FIGURE).
- ASCII `\b` makes `82 Mức` read as "82 M", `62 Xử` as "62 x" and `100 ký tự` as "100 k". The UI-strings draft trips it on "100/200/3.000 ký tự".
- The price rule also flags any bounded "đồng" (hợp đồng, đồng ý, đồng thời).
- Draft Vietnamese patterns for this plan were run against all of `content/vi/**`, the 190-entry UI draft `docs/i18n/ui-strings-vi.json`, 46 planted claims and 25 neutral phrases, with zero misses and zero false positives (script: `C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/plan-probes/vi-patterns.mjs`). Task 7 uses exactly those patterns.

**Copy already written (by the translator, 2026-10-23).**
- `content/vi/**`: 35 files mirroring `content/` with identical keys, list lengths and non-text values. A parity script found no difference.
- `docs/i18n/ui-strings-vi.json`: 190 `{ en, vi, where, note }` entries, which inventory every hard-coded user-facing string in `src/` plus NAP, cursor labels, metadata and validation messages. Also `docs/i18n/glossary-vi.md`.
- The Vietnamese content passes today's schema except `home.json` `headline.verbs` (10/8/7 characters against a limit of 6) and `headline.tail` (28 against 24).

**Client bundle cost.** Client components read copy through `getContent(locale)`, so both languages' JSON ship in the shared content chunk: +36 KB raw, about +8.6 KB gzip over today's 7.4 KB. It is cached across pages. Validation runs only for the language a page uses (`getContent` builds lazily). Task 22 records this in README "What the CMS costs".

---

## Conventions for every task (read before starting)

- **Worktree:** `E:/Personal/clone website/spacegear-hero` (quote the path), branch `feat/bilingual`. Preview port **8792**. Never use 8787.
- **Shared worktree.**
  - Other agents may be working in this worktree at the same time, so commit only the files your task lists. Run `git status` first, never `git add -A`, and never stash.
  - If git reports `index.lock`, wait 5 s and retry. Never delete another agent's lock.
- **Parallel tasks share one working tree**, so a build can see another task's half-done edits. Tasks marked ∥ run **fast gates only**: `npm run lint`, `npm run typecheck`, the named `node --import tsx --test …` files, and `npm test` once at the end. They never run `next build`. Each wave ends with an integration task that builds and runs the heavy checks once everything in the wave has committed.
- **Heavy jobs** go through `C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh`, with the Bash tool timeout set to 600000 ms:
  - `bash "<wt.sh>" "E:/Personal/clone website/spacegear-hero" 8792 rebuild`
  - `bash "<wt.sh>" "E:/Personal/clone website/spacegear-hero" 8792 run <command…>`
- **Gates:**
  - **Fast:** `npm run lint && npm run typecheck && npm test`.
  - **Heavy (integration tasks only):** rebuild, then `npm run check:seo -- http://127.0.0.1:8792`, the targeted `node scripts/fx-checks.mjs` with `FX_ONLY`, and `node scripts/locale-checks.mjs` (from Task 20).
  - **Full `npm run test:browser -- http://127.0.0.1:8792`:** once, in Task 22.
- **Never** push, merge or deploy, and never run `wrangler deploy`, `wrangler secret` or `d1 … --remote`.
- **Commits:** end every commit message with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Ignore CRLF warnings.
- **Rules that must not regress** (showcase conventions):
  - no rendered markup branches on `useReducedMotion()`;
  - the hidden-text gate;
  - accessible names contain the visible text;
  - no invented claims;
  - strict CSP;
  - the packaging allowlist.
- **Tailwind:** until Task 3 lands, files under `docs/` are scanned for class names, and this plan quotes some. Task 3 runs in the first wave; its diff proof lists every rule that the docs alone were adding. From Task 3 on, only `src/` is scanned.
- **Vietnamese copy:** use the translator's strings verbatim (they follow the owner's style rule: natural, full sentences, facts identical, no new claims). If a split string is needed, the task gives the split.

## Shared interfaces (defined here; Part 3 uses these exact names)

```ts
// src/lib/i18n/locales.ts (Task 2)
export const LOCALES: readonly ["en", "vi"];
export type Locale = "en" | "vi";
export const DEFAULT_LOCALE: Locale;                 // "en"
export const LOCALE_COOKIE = "sg_lang";
export const HTML_LANG: Record<Locale, string>;      // { en: "en", vi: "vi" }
export const OG_LOCALE: Record<Locale, string>;      // { en: "en_US", vi: "vi_VN" }
export const LOCALE_NAME: Record<Locale, string>;    // { en: "English", vi: "Tiếng Việt" }
export const LOCALE_SHORT: Record<Locale, string>;   // { en: "EN", vi: "VI" }
export function isLocale(value: unknown): value is Locale;
export function localeOfPath(pathname: string): Locale;            // "/vi", "/vi/…" → "vi"
export function stripLocale(pathname: string): string;             // "/vi/about/" → "/about/"
export function isSharedPath(pathname: string): boolean;           // /_next/, /images/, /api/, /sitemap.xml…
export function localizedHref(href: string, locale: Locale): string; // "/about/" → "/vi/about/"; re-targets prefixed paths; leaves https:, mailto:, tel:, #… and shared paths alone
export function switchHref(pathname: string, target: Locale): string; // "/vi/about/" → "/about/?lang=en"
export function alternatePaths(path: string): Record<Locale, string>; // { en: "/about/", vi: "/vi/about/" }

// src/components/LocaleProvider.tsx (Task 2; "use client")
export function LocaleProvider(props: { locale: Locale; notFound?: boolean; children: ReactNode }): JSX.Element;
export function useLocale(): Locale;          // "en" outside a provider
export function useNotFoundPage(): boolean;   // true only inside global-not-found

// src/lib/i18n/dictionary.ts (Task 6)
export type Dictionary;                       // the shape of en.ts with every string widened; vi.ts must match it exactly
export function dictionary(locale: Locale): Dictionary;
export function format(template: string, values: Record<string, string | number>): string; // "{year}" placeholders, for attributes
export function formatParts(template: string, values: Record<string, string | number>): (string | number)[]; // the same for JSX children (keeps English text nodes identical)

// src/lib/content.ts (Task 8)
export type SiteContent = ReturnType<typeof buildContent>;   // SERVICES, HOME, SECTIONS, … (the English export names)
export function getContent(locale: Locale): SiteContent;     // built and validated on first use
export function serviceFor(locale: Locale, slug: string): Service;
// The English constants (SERVICES, HOME, …, serviceBySlug) stay exactly as they are (src/lib/content-contract.ts).

// src/lib/site.ts (Task 11)
export const BRAND_NAME = "spacegear";       // Organization name (Google Business Profile name)
export type SiteIdentity;                    // name, description, socialProfiles, address { full, street, locality }, telephone
export function siteFor(locale: Locale): typeof SITE & SiteIdentity;
export type PublishedRoute = { path: string; kind: "home" | "index" | "service" | "page" | "labs" | "article"; locale: Locale; alternates: Partial<Record<Locale, string>> };
export function getPublishedRoutes(): PublishedRoute[];      // Task 18: both languages (24 in Part 2)

// src/lib/seo.ts (Tasks 17 and 19)
export function buildMetadata(input: { title: string; description: string; path: string; locale: Locale; languages?: Partial<Record<Locale, string>>; type?: "website" | "article"; image?: { url: string; width: number; height: number; alt: string }; publishedTime?: string; modifiedTime?: string }): Metadata;
export function breadcrumbData(items: { name: string; path: string }[], locale: Locale): object;
export function organizationData(locale: Locale): object;
export function websiteData(locale: Locale): object;

// The page wrapper pattern (Tasks 17 and 18): every route file is a thin wrapper around a view.
//   src/app/(en)/about/page.tsx:     import AboutView from "@/views/AboutView"; import { aboutMetadata } from "@/views/metadata";
//                                    export const metadata = aboutMetadata("en"); export default function Page() { return <AboutView locale="en" />; }
//   src/app/(vi)/vi/about/page.tsx:  the same with "vi".
// A view (src/views/*View.tsx) is a server component `({ locale }: { locale: Locale })`. Its `<name>Metadata(locale)`
// lives in src/views/metadata.ts (no component imports, so tests can load it).
// Root layouts: src/app/(en)/layout.tsx and src/app/(vi)/layout.tsx render <SiteShell locale=…> (src/components/SiteShell.tsx).
```

## File structure

New:

| File | Responsibility |
|---|---|
| `src/lib/i18n/locales.ts` | Languages and path rules (pure; shared by pages, Worker, scripts) |
| `src/components/LocaleProvider.tsx` | Client context: the page's language and whether it is the 404 |
| `src/lib/i18n/dictionary.ts`, `en.ts`, `vi.ts` | Typed UI strings; `vi` must match `en`'s keys exactly |
| `src/lib/content-parity.ts` | English and Vietnamese content files mirror each other (non-text fields equal) |
| `scripts/lib/content-input.mjs` | Reads `content/` or `content/vi/` into `buildContent()` input (scripts and tests) |
| `src/lib/phone.ts` | Phone display per language and `tel:` link |
| `src/app/fonts/fonts.ts`, `fonts.css`, `inter-vietnamese.woff2`, `jetbrains-mono-vietnamese.woff2` | Font faces (latin + Vietnamese, one family each), fallbacks and variables |
| `worker/locale.ts` | Region redirect and `?lang=` cookie switch |
| `src/components/LanguageSwitch.tsx` | EN/VI links (desktop nav and mobile menu) |
| `src/components/SiteShell.tsx` | `<html lang>`, body and site chrome, shared by both root layouts and the 404 |
| `src/views/*View.tsx` | Page bodies and their metadata, per locale |
| `src/app/(en)/…`, `src/app/(vi)/vi/…`, `src/app/global-not-found.tsx` | Route groups, root layouts, thin page wrappers, 404 |
| `scripts/locale-checks.mjs` | Browser checks for `/vi/`: diacritic clipping, layout widths, cursor labels, English leaks, the switch and the redirect |
| tests: `honesty-locale`, `honesty-vi`, `locales`, `i18n-dictionary`, `worker-locale`, `fonts`, `content-locale`, `phone`, `routes` (`.test.mjs`) | Unit tests |

Modified:

| File | Change |
|---|---|
| `scripts/lib/honesty.mjs` | Mirror scopes for `content/vi/`, Unicode word edges, "đồng" only after a number, Vietnamese claim patterns, the NAP-placement rule |
| `src/app/globals.css` | `source("..")`, `@source not` lines dropped |
| `src/lib/content.ts`, `content-model.ts`, `content-index.generated.ts`, `legal.ts`, `site.ts`, `seo.ts`, `contact.ts` | Per-locale loading, hero limits, NAP fields, per-locale metadata and JSON-LD |
| `scripts/build-content-index.mjs`, `check-content.mjs`, `lib/content-rules.mjs` | Vietnamese index, parity, Vietnamese rules |
| `public/admin/config.yml` | Sveltia i18n, `{{locale}}` paths, field-level `i18n`, NAP fields, wider hero limits |
| Every section component, `Nav.tsx`, `Footer.tsx`, `QuickStart.tsx`, `ContactForm.tsx`, `ui.tsx`, `PageIntro.tsx`, `SnapRow.tsx`, `fx/ScrollProgressRail.tsx`, `globe/intro-gate.ts` | Locale-aware copy and links |
| `worker/index.ts`, `wrangler.jsonc`, `worker-configuration.d.ts`, `tsconfig.worker.json` | Locale routing |
| `next.config.ts` | `experimental.globalNotFound` |
| `scripts/package-site.mjs`, `check-export.mjs`, `check-seo.mjs`, `browser-check.mjs`, `fx-checks.mjs`, `identity-check.mjs` | Both languages |
| `README.md` | Editing in two languages, the Worker, fonts, Tailwind scope, costs |

## Task order, sizes and parallel groups

Sizes: **S** about 20–30 min, **M** about 40–50 min, **L** about 60 min (one agent session each). "∥" = may run at the same time as the other ∥ tasks of its wave (disjoint files, fast gates only).

| # | Task | Size | Wave / runs with | Depends on |
|---|---|---|---|---|
| 1 | Honesty: green the branch (mirror scopes, Unicode edges, "đồng") | S | Wave 0 ∥ 2 (**first**) | — |
| 2 | Locale primitives + LocaleProvider | S | Wave 0 ∥ 1 | — |
| 3 | Tailwind `source("..")` with CSS-diff proof | S | Wave A ∥ 4–8 | 1 |
| 4 | Vietnamese font subsets | M | Wave A ∥ | 1 |
| 5 | Worker region redirect + `?lang=` cookie | M | Wave A ∥ | 2 |
| 6 | Typed dictionary (from the translator's draft) | M | Wave A ∥ | 1, 2 |
| 7 | Vietnamese honesty patterns + NAP placement rule | M | Wave A ∥ | 1 |
| 8 | Content loader per locale, parity, check-content, hero limits | L | Wave A ∥ | 1, 2 |
| 9 | Integration A (build, CSS chunk diff, fonts, Worker smoke) | S | after 3–8 | 3–8 |
| 10 | CMS i18n config | M | Wave B (sequential before 11), ∥ 12–14 | 8 |
| 11 | NAP data (schema, content, `siteFor`, phone) | M | Wave B, after 10, ∥ 12–14 | 10 |
| 12 | Hero + Work (+ intro gate, hero grammar, cursor labels) | M | Wave C ∥ 13, 14, 10, 11 | 6, 8 |
| 13 | Services, Process, Analytics, Pricing | M | Wave C ∥ | 6, 8 |
| 14 | Faq, Team, Testimonials, Labs, SnapRow, rail, ui, PageIntro | M | Wave C ∥ | 6, 8 |
| 15 | Nav + LanguageSwitch, Footer (NAP), QuickStart, ContactForm, contact.ts | M | Wave C, after 11 | 6, 8, 11 |
| 16 | Integration B (build, html-snapshot: English unchanged) | S | after 10–15 | 10–15 |
| 17 | Views (page bodies per locale, NAP on Contact, Privacy and Terms, bilingual 404 view) | L | Wave D | 16 |
| 18 | Route groups, root layouts, `/vi/` pages, global 404, sitemap, packaging | L | Wave D | 17 |
| 19 | SEO: hreflang, og:locale, JSON-LD, check-seo for both languages | M | Wave D ∥ 20 | 18 |
| 20 | `scripts/locale-checks.mjs` (diacritics, widths, cursor labels, leaks, switch and redirect) | M | Wave D ∥ 19 | 18 |
| 21 | browser-check, fx-checks and identity-check on `/vi/` | M | Wave D | 19, 20 |
| 22 | README and final gates (full test:browser once, check-seo) | M | last | 21 |

The site stays shippable after every task:
- Tasks 1–16 change no English page except fonts (Task 4: same glyphs and metrics) and the 404 (Task 17).
- `/vi/` pages appear only in Task 18, already translated.
- The Worker redirect (Task 5) checks that the `/vi/` twin exists before redirecting, so it is safe before Task 18.

---
## Wave 0

### Task 1: Honesty scan, green the branch (S, ∥ Task 2, runs first)

Today `npm test` (`tests/content.test.mjs`, "no file under content/ makes an unverified claim") and `check-content` fail on `content/vi/measure.json`. This task changes three things:
- a file under `content/vi/` gets the scopes of its English twin (MEASURE_FIGURE, LEGAL);
- letters after a number are read in any script;
- "đồng" is a price only after a number.

**Files:**
- Modify: `scripts/lib/honesty.mjs` (lines 26–35, 46, 54, 73)
- Create: `tests/honesty-locale.test.mjs`

- [ ] **Step 1: Write the failing test** (`tests/honesty-locale.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { findForbidden, scanContentTree, scanFile } from "../scripts/lib/honesty.mjs";

const FAQ = "content/faqs/x.json";

test("content/vi/measure.json may show the dashboard figures, in its figure fields only", () => {
  assert.deepEqual(scanFile("content/vi/measure.json", JSON.stringify({ workflow: { center: "62%" }, accuracy: { value: "94.6", unit: "%" }, coverage: { value: "99.1%" } })), []);
  assert.ok(scanFile("content/vi/measure.json", JSON.stringify({ ticker: ["Tăng 62%"] })).some((problem) => problem.startsWith("ticker[0]: a result figure")));
  assert.ok(scanFile("content/vi/faqs/x.json", JSON.stringify({ answer: "Tỷ lệ 62%" })).some((problem) => problem.startsWith("answer: a result figure")));
});

test("content/vi/legal/ may state periods, exactly as content/legal/ may", () => {
  const period = "## Retention\n\nRecords are kept for 2 years.";
  assert.deepEqual(scanFile("content/vi/legal/privacy.md", period), []);
  assert.ok(scanFile("content/vi/faqs/x.md", period).some((problem) => problem.startsWith("an experience claim")));
});

test("a letter after a number is read in any script: ký tự, Mức and Xử are words, not k, M or x", () => {
  for (const text of ["Vui lòng nhập từ 2 đến 100 ký tự.", "Vui lòng nhập không quá 200 ký tự.", "Vui lòng nhập từ 20 đến 3.000 ký tự.", "82 Mức độ sẵn sàng", "62 Xử lý tự động"]) {
    assert.deepEqual(findForbidden(text, FAQ), [], text);
  }
  for (const [text, what] of [["5M users", "a price or scale figure"], ["Over 10k installs", "a price or scale figure"], ["10 k downloads", "a price or scale figure"], ["3x faster delivery", "a multiplier claim"], ["2.5× the output", "a multiplier claim"]]) {
    assert.ok(findForbidden(text, FAQ).some((problem) => problem.startsWith(what)), text);
  }
});

test("đồng is a price only after a number", () => {
  for (const text of ["Hai bên ký hợp đồng.", "Bạn đồng ý với điều khoản.", "đồng thời", "đồng hành cùng đội ngũ của bạn"]) {
    assert.deepEqual(findForbidden(text, FAQ), [], text);
  }
  for (const text of ["Gói chỉ 5.000.000 đồng.", "200.000đ một giờ", "Chỉ 50 VNĐ", "₫20,000,000"]) {
    assert.ok(findForbidden(text, FAQ).some((problem) => problem.startsWith("a price")), text);
  }
});

test("the committed content passes in both languages", () => {
  assert.deepEqual(scanContentTree("."), []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test tests/honesty-locale.test.mjs`
Expected: FAIL in 4 tests:
- the measure test: `workflow.center: a result figure ("62%")`;
- the legal test: an experience claim;
- the "ký tự" test: `a price or scale figure ("100 k")`;
- the "đồng" test: `a price ("đồng")`.
- The last test fails with the five content/vi/measure.json problems.

- [ ] **Step 3: Implement** in `scripts/lib/honesty.mjs`

Replace the "Known gaps" sentence (line 26):

```js
// Known gaps: Vietnamese claim phrasing until the Vietnamese patterns land (bilingual plan, Task 7),
// look-alike letters (Cyrillic "Ѕ")
```

(keep the rest of that comment as it is). Replace lines 32–35:

```js
// content/vi/ mirrors content/ file for file, so a Vietnamese file has the scopes of its English twin.
const englishTwin = (where) => where.replace(/^content\/vi\//, "content/");
const LEGAL = (where) => englishTwin(where).startsWith("content/legal/");
// The figure fields of the illustrative dashboard (content/measure.json and its Vietnamese twin), and the figure groups built from them.
const FIGURE_FIELD = /^(?:workflow\.center|workflow\.segments\[\d+\](?:\.value)?|stages\[\d+\]\.detail|accuracy(?:\.value|\.unit)?|throughput\.legend\[\d+\](?:\.value)?|readiness(?:\.score|\.bars\[\d+\](?:\.v)?)?|coverage(?:\.value|\.progress)?)$/;
const MEASURE_FIGURE = (where, field) => (englishTwin(where) === "content/measure.json" || where === "MEASURE") && FIGURE_FIELD.test(field);
```

Replace the second price rule (line 46) with these two rules:

```js
  [/[€£¥₫₹₩₽₺₦₱฿]|\b(?:USD|EUR|GBP|VND|SGD|AUD|CHF|JPY|CNY|INR)\b|\b(?:dollars?|euros?|pounds?|bucks)\b/i, "a price"],
  // "đồng" (and "đ", "VNĐ") is the currency only after a number ("5.000.000 đồng", "200.000đ"): hợp đồng,
  // đồng ý and đồng thời are words. \b only knows ASCII letters, hence the Unicode lookarounds.
  [/(?<![\p{L}\p{N}_.,])\d[\d.,]{0,15}\s{0,3}(?:đồng|đ|vnđ)(?![\p{L}\p{N}_])/iu, "a price"],
```

In the scale rule (line 54), end both unit letters with a Unicode lookahead instead of `\b`, and add the `u` flag. The whole new line is:

```js
  [new RegExp(String.raw`(?<![\w.,])(?!(?<=\b(?:${MODEL})\b[ -]?(?:\d{1,2}(?:\.\d)?[ -])?)\d{1,4}(?:\.\d)?[bBmM](?![\p{L}\p{N}_])(?!${AUDIENCE}))\d{1,6}(?:[.,]\d{1,3})?\s?[kKmMbB](?![\p{L}\p{N}_])(?!(?:\s?(?:and|or|,)\s?\d{1,4}[bB]\b){0,3}(?:(?<=[bB])\s?(?:parameters?|params|models?)\b|(?<=[kK])\s{1,3}context\s{1,3}window\b|(?<=[kK])\s?(?:displays?|screens?|monitors?|video|resolution|TV|UHD|HDR)\b))`, "u"), "a price or scale figure", { skip: MEASURE_FIGURE }],
```

and in the multiplier rule (line 73) replace `x\b` and the flags:

```js
  [/(?<![\w.,])\d{1,6}(?:\.\d{1,3})?\s?(?:x(?![\p{L}\p{N}_])|×)|\b(?:two|three|four|five|ten)(?:fold| times)\b|\b(?:doubled|tripled|quadrupled)\b/iu, "a multiplier claim"],
```

Also extend the comment above `FORBIDDEN`'s scope list (lines 19–23): "the sample dashboard (content/measure.json **and content/vi/measure.json**, MEASURE)…" and "the legal pages (**content/legal/ and content/vi/legal/**) may state periods…".

- [ ] **Step 4: Run the tests**

Run: `node --import tsx --test tests/honesty-locale.test.mjs tests/content.test.mjs`
Expected: PASS. In particular the existing CLAIMS ("20.000.000 đồng", "₫20,000,000", "1M users", "10× ROI") and ORDINARY ("4K display", "Llama 3 70B") cases still pass, and so does the "no pattern is slow" timing test.

- [ ] **Step 5: Fast gates and content check**

Run: `npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs`
Expected: all pass, and the last line is `Content valid: 12 routes; preview mode.`

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/honesty.mjs tests/honesty-locale.test.mjs
git commit -m "fix(honesty): scope content/vi mirrors, read letters after numbers in any script, đồng only after a number

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Locale primitives and LocaleProvider (S, ∥ Task 1)

**Files:**
- Create: `src/lib/i18n/locales.ts`
- Create: `src/components/LocaleProvider.tsx`
- Create: `tests/locales.test.mjs`

- [ ] **Step 1: Write the failing test** (`tests/locales.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, HTML_LANG, OG_LOCALE, isLocale, localeOfPath, stripLocale, isSharedPath, localizedHref, switchHref, alternatePaths } = await import("../src/lib/i18n/locales.ts");
const { LocaleProvider, useLocale, useNotFoundPage } = await import("../src/components/LocaleProvider.tsx");

test("two languages, English by default", () => {
  assert.deepEqual([...LOCALES], ["en", "vi"]);
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(LOCALE_COOKIE, "sg_lang");
  assert.deepEqual(HTML_LANG, { en: "en", vi: "vi" });
  assert.deepEqual(OG_LOCALE, { en: "en_US", vi: "vi_VN" });
  assert.ok(isLocale("vi") && isLocale("en"));
  for (const value of ["fr", "VI", "", undefined, null, 1]) assert.equal(isLocale(value), false, String(value));
});

test("a path is Vietnamese only under /vi", () => {
  for (const path of ["/vi", "/vi/", "/vi/about/", "/vi/services/applied-ai/"]) assert.equal(localeOfPath(path), "vi", path);
  for (const path of ["/", "/about/", "/video/", "/vietnam/", "/services/"]) assert.equal(localeOfPath(path), "en", path);
  assert.equal(stripLocale("/vi"), "/");
  assert.equal(stripLocale("/vi/"), "/");
  assert.equal(stripLocale("/vi/services/applied-ai/"), "/services/applied-ai/");
  assert.equal(stripLocale("/about/"), "/about/");
});

test("localizedHref moves site links into a language and leaves everything else alone", () => {
  const cases = [
    ["/", "vi", "/vi/"], ["/about/", "vi", "/vi/about/"], ["/#pricing", "vi", "/vi/#pricing"],
    ["/contact/?service=applied-ai", "vi", "/vi/contact/?service=applied-ai"], ["/vi/about/", "en", "/about/"],
    ["/vi/about/", "vi", "/vi/about/"], ["/about/", "en", "/about/"], ["/labs/rss.xml", "vi", "/vi/labs/rss.xml"],
    ["https://github.com/x", "vi", "https://github.com/x"], ["#top", "vi", "#top"], ["mailto:a@b.co", "vi", "mailto:a@b.co"],
    ["tel:+84386749799", "vi", "tel:+84386749799"], ["//evil.example/", "vi", "//evil.example/"],
    ["/images/a.webp", "vi", "/images/a.webp"], ["/uploads/a.jpg", "vi", "/uploads/a.jpg"], ["/_next/static/x.js", "vi", "/_next/static/x.js"],
    ["/admin/", "vi", "/admin/"], ["/api/contact", "vi", "/api/contact"], ["/sitemap.xml", "vi", "/sitemap.xml"], ["/llms.txt", "vi", "/llms.txt"],
  ];
  for (const [href, locale, expected] of cases) assert.equal(localizedHref(href, locale), expected, `${href} in ${locale}`);
  for (const path of ["/images/a.webp", "/textures/earth/2k/day.webp", "/seo/og.png", "/favicon.ico", "/robots.txt"]) assert.ok(isSharedPath(path), path);
  for (const path of ["/", "/about/", "/labs/rss.xml", "/vi/"]) assert.ok(!isSharedPath(path), path);
});

test("the switch always links the English path with ?lang=", () => {
  assert.equal(switchHref("/about/", "vi"), "/about/?lang=vi");
  assert.equal(switchHref("/vi/about/", "en"), "/about/?lang=en");
  assert.equal(switchHref("/vi", "en"), "/?lang=en");
  assert.equal(switchHref("/services/applied-ai", "vi"), "/services/applied-ai/?lang=vi");
  assert.deepEqual(alternatePaths("/vi/about/"), { en: "/about/", vi: "/vi/about/" });
});

test("useLocale reads the provider, English and not the 404 by default", () => {
  const Probe = () => React.createElement("span", null, `${useLocale()}:${useNotFoundPage()}`);
  assert.equal(renderToStaticMarkup(React.createElement(Probe)), "<span>en:false</span>");
  assert.equal(renderToStaticMarkup(React.createElement(LocaleProvider, { locale: "vi" }, React.createElement(Probe))), "<span>vi:false</span>");
  assert.equal(renderToStaticMarkup(React.createElement(LocaleProvider, { locale: "en", notFound: true }, React.createElement(Probe))), "<span>en:true</span>");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test tests/locales.test.mjs`
Expected: FAIL, `Cannot find module …/src/lib/i18n/locales.ts`.

- [ ] **Step 3: Implement `src/lib/i18n/locales.ts`**

```ts
// The site's two languages and the path rules that join them. English keeps today's URLs; Vietnamese
// mirrors every page under /vi/ with the same slugs. Pure and dependency-free: the pages, the Worker
// (worker/locale.ts) and the scripts all use it. Erasable TypeScript only (scripts load it under
// --experimental-strip-types).
export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
/** Remembers a visitor's explicit choice for a year (set by worker/locale.ts, read there too). */
export const LOCALE_COOKIE = "sg_lang";
/** <html lang> and hreflang. */
export const HTML_LANG: Record<Locale, string> = { en: "en", vi: "vi" };
/** og:locale and og:locale:alternate. */
export const OG_LOCALE: Record<Locale, string> = { en: "en_US", vi: "vi_VN" };
/** Each language's name in that language, for the switch. */
export const LOCALE_NAME: Record<Locale, string> = { en: "English", vi: "Tiếng Việt" };
export const LOCALE_SHORT: Record<Locale, string> = { en: "EN", vi: "VI" };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "vi";
}

/** The language of a site path: "/vi" and everything under "/vi/" is Vietnamese. */
export function localeOfPath(pathname: string): Locale {
  return pathname === "/vi" || pathname.startsWith("/vi/") ? "vi" : "en";
}

/** The path without its language prefix: "/vi/about/" → "/about/", "/vi" and "/vi/" → "/". */
export function stripLocale(pathname: string): string {
  if (localeOfPath(pathname) === "en") return pathname;
  return pathname.slice(3) || "/";
}

/** Paths every language shares: build files, media, the CMS, the API and root-level files (sitemap.xml, llms.txt, favicon.ico). */
const SHARED = /^\/(?:_next|images|uploads|textures|models|seo|licenses|admin|api)(?:\/|$)|^\/[^/]+\.[A-Za-z0-9]+$/;
export function isSharedPath(pathname: string): boolean {
  return SHARED.test(pathname);
}

/**
 * A link in `locale`. A site path ("/about/", "/#faq", "/contact/?service=x") gets the language prefix, and a
 * path that already has one is moved to `locale`. Anything else (https://…, mailto:, tel:, "#top",
 * protocol-relative "//…", shared paths such as /images/…) comes back unchanged.
 */
export function localizedHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const tail = cut === -1 ? "" : href.slice(cut);
  if (isSharedPath(path)) return href;
  const base = stripLocale(path);
  return locale === "vi" ? `/vi${base}${tail}` : `${base}${tail}`;
}

const withSlash = (path: string) => (path.endsWith("/") ? path : `${path}/`);

/**
 * The EN/VI switch's link: always the English path with ?lang=<target>. The Worker stores the choice in the
 * sg_lang cookie and redirects to the clean page in that language (worker/locale.ts), and it works without JavaScript.
 */
export function switchHref(pathname: string, target: Locale): string {
  return `${withSlash(stripLocale(pathname))}?lang=${target}`;
}

/** Both language versions of a page path. */
export function alternatePaths(path: string): Record<Locale, string> {
  return { en: localizedHref(path, "en"), vi: localizedHref(path, "vi") };
}
```

- [ ] **Step 4: Implement `src/components/LocaleProvider.tsx`**

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "../lib/i18n/locales";

/**
 * The page's language for client components. Server components take a `locale` prop instead; client
 * components call useLocale(), so they need no new props and their English markup stays the same.
 * SiteShell (the root layouts and the 404) provides it. `notFound` marks the 404 page, which has no single
 * path (LanguageSwitch then links each language's home page).
 */
type LocaleState = { locale: Locale; notFound: boolean };
const LocaleContext = createContext<LocaleState>({ locale: DEFAULT_LOCALE, notFound: false });

export function LocaleProvider({ locale, notFound = false, children }: { locale: Locale; notFound?: boolean; children: ReactNode }) {
  return <LocaleContext value={{ locale, notFound }}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useNotFoundPage(): boolean {
  return useContext(LocaleContext).notFound;
}
```

- [ ] **Step 5: Run the tests**

Run: `node --import tsx --test tests/locales.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck`
Expected: pass. Skip `npm test` if Task 1 has not committed yet, since the branch is red until then. Run it once Task 1 is in.

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n/locales.ts src/components/LocaleProvider.tsx tests/locales.test.mjs
git commit -m "feat(i18n): locale primitives and the client LocaleProvider

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Wave A (Tasks 3–8 in parallel, then Task 9)

**Wave A preflight (controller, about 10 min, after Tasks 1 and 2 have committed and before any Wave A task starts).** Tasks 1 and 2 change no rendered HTML, so this build is today's site. It becomes the English baseline for Tasks 9, 16, 17 and 18:

```bash
bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 rebuild
cd "E:/Personal/clone website/spacegear-hero"
node scripts/html-snapshot.mjs save artifacts/html-baseline-bilingual
rm -rf artifacts/dist-before-bilingual && mkdir -p artifacts/dist-before-bilingual/_next/static && cp -r dist/_next/static/chunks artifacts/dist-before-bilingual/_next/static/
```

### Task 3: Tailwind scans `src/` only, with a CSS-diff proof (S, ∥)

**Files:**
- Modify: `src/app/globals.css` (lines 1–11)
- Scratch (gitignored, not committed): `artifacts/tw-probe/one.mjs`, `artifacts/tw-probe/diff.mjs`

- [ ] **Step 1: Write the stylesheet builder** `artifacts/tw-probe/one.mjs` (one build per process: the plugin caches by file)

```js
// node artifacts/tw-probe/one.mjs <current|scoped> <out.css>: builds the site stylesheet with the project's
// Tailwind PostCSS plugin from src/app/globals.css as it is (current) or with source("..") and without the
// @source not lines (scoped). One build per process: @tailwindcss/postcss caches by file within a process.
import fs from "node:fs";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
const FROM = "src/app/globals.css";
const current = fs.readFileSync(FROM, "utf8");
const variants = {
  current,
  scoped: current.replace('@import "tailwindcss";', '@import "tailwindcss" source("..");').replace(/^@source not .*\n/gm, ""),
};
const result = await postcss([tailwind()]).process(variants[process.argv[2]], { from: FROM });
fs.writeFileSync(process.argv[3], result.css);
let rules = 0;
result.root.walkRules(() => rules++);
console.log(process.argv[2], rules, "rules", result.css.length, "bytes");
```

- [ ] **Step 2: Write the diff** `artifacts/tw-probe/diff.mjs`

```js
// node artifacts/tw-probe/diff.mjs before.css after.css: the rules only one stylesheet has, and for each removed
// utility, whether its class name appears in any file under src/ (a substring search; review every hit).
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

const keyOf = (rule) => `${rule.parent?.type === "atrule" ? `@${rule.parent.name} ${rule.parent.params} ` : ""}${rule.selector}`;
const rules = (file) => {
  const out = new Map();
  postcss.parse(fs.readFileSync(file, "utf8")).walkRules((rule) => out.set(keyOf(rule), rule.toString()));
  return out;
};
const [a, b] = [rules(process.argv[2]), rules(process.argv[3])];
const removed = [...a.keys()].filter((key) => !b.has(key));
const added = [...b.keys()].filter((key) => !a.has(key));
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
const src = walk("src").map((file) => fs.readFileSync(file, "utf8")).join("\n");
/** The class a utility rule is for: the selector's first class, unescaped (".hover\:x:hover" -> "hover:x"). */
function className(key) {
  const selector = key.replace(/^@\S+ \S+ /, "");
  if (!selector.startsWith(".")) return null;
  let name = "";
  for (let i = 1; i < selector.length; i++) {
    const char = selector[i];
    if (char === "\\") { name += selector[++i]; continue; }
    if (/[\s:>+~,.()[\]]/.test(char)) break;
    name += char;
  }
  return name;
}
for (const key of removed) {
  const name = className(key);
  console.log(`removed ${key}\n  class ${name ?? "(not a class)"}: ${name ? (src.includes(name) ? "FOUND IN src/ (check it)" : "not in src/") : "-"}`);
}
for (const key of added) console.log(`added ${key}`);
console.log(JSON.stringify({ before: a.size, after: b.size, removed: removed.length, added: added.length }));
```

- [ ] **Step 3: Build both stylesheets and compare**

Run:
```bash
cd "E:/Personal/clone website/spacegear-hero"
node artifacts/tw-probe/one.mjs current artifacts/tw-probe/current.css
node artifacts/tw-probe/one.mjs scoped artifacts/tw-probe/scoped.css
node artifacts/tw-probe/diff.mjs artifacts/tw-probe/current.css artifacts/tw-probe/scoped.css
```

Expected:
- **`added: 0`.**
- `removed` lists only `@layer utilities` rules for class names quoted in `docs/`. On 2026-10-23 there were 29 (Research notes), plus whatever this plan and the Part 3 plan quote and `src/` does not use.
- For every line marked "FOUND IN src/", confirm with `git grep -nwF -- "<class>" src` that the hit is not a class attribute: a CSS value (`ease-in-out` in keyframes), a comment (`scroll-mt-24`), or part of a longer class (`h-1.5`, `w-1.5`, `lg:contents`, `outline-*`).
- If any removed class **is** used as a class in `src/`, stop and report it: it would mean `source("..")` resolved somewhere other than `src/`.
- Save the output as `artifacts/tw-probe/diff.txt` for the commit message.

- [ ] **Step 4: Change `src/app/globals.css`**

Replace lines 1–11 (`@import "tailwindcss";` through `/* <<< CMS */`) with:

```css
/* Tailwind builds utilities only from class names under src/ (source("..") is relative to this file).
   Plans, specs, the README, content/, the CMS bundle and its schema can no longer add rules to the site
   stylesheet; the @source not lines that kept content/ and the CMS out are no longer needed. */
@import "tailwindcss" source("..");
```

- [ ] **Step 5: Prove the shipped stylesheet equals the scoped build**

Run:
```bash
node artifacts/tw-probe/one.mjs current artifacts/tw-probe/after-edit.css
node artifacts/tw-probe/diff.mjs artifacts/tw-probe/scoped.css artifacts/tw-probe/after-edit.css
```

Expected: `{"before":N,"after":N,"removed":0,"added":0}`. The `current` variant now reads the edited file, which must match the scoped build. The full Next build is checked in Task 9.

- [ ] **Step 6: Fast gates**

Run: `npm run lint && npm run typecheck`
Expected: pass. Run `npm test` once Task 1 has landed.

- [ ] **Step 7: Commit** (paste the diff counts into the message)

```bash
git add src/app/globals.css
git commit -m "build(css): Tailwind scans src/ only (source(\"..\")); drop the @source not lines

Scoped build: <after> rules; removed <n> utilities quoted only in docs (artifacts/tw-probe/diff.txt), added 0.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Vietnamese subsets of Inter and JetBrains Mono (M, ∥)

**Files:**
- Create: `src/app/fonts/fonts.ts`, `src/app/fonts/fonts.css`, `src/app/fonts/inter-vietnamese.woff2`, `src/app/fonts/jetbrains-mono-vietnamese.woff2`, `tests/fonts.test.mjs`
- Modify: `src/app/layout.tsx` (lines 2, 15–16, 27), `public/licenses/fonts.txt`

- [ ] **Step 1: Write the failing test** (`tests/fonts.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
// Google Fonts subsets (fonts.googleapis.com/css2, Chrome user agent): Inter v20 = "Version 4.001;git-66647c0bb",
// JetBrains Mono v24 = "Version 2.211". The latin files are the ones the site has shipped since the rebuild.
const FILES = {
  "src/app/fonts/inter-latin.woff2": "c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4",
  "src/app/fonts/inter-vietnamese.woff2": "5c66f9e07e90c6d4ac4922cc68d60de26c17b1858e677fb5e603fce3952b3ff2",
  "src/app/fonts/jetbrains-mono-latin.woff2": "1e06740a02a443fb7f3eeda8fcaa685a0f6c620e3f01e6666e847295469ce3ad",
  "src/app/fonts/jetbrains-mono-vietnamese.woff2": "2288795da89dd97e648954b96e22b4501bd85dfc453264460b252f888b582ca2",
};
const RANGE = "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB";

test("the self-hosted font files are the pinned Google Fonts subsets", () => {
  for (const [file, hash] of Object.entries(FILES)) assert.equal(sha256(file), hash, file);
});

test("each family is one name for its latin and Vietnamese faces; only the Vietnamese faces carry a unicode-range", () => {
  const source = fs.readFileSync("src/app/fonts/fonts.ts", "utf8");
  const calls = [...source.matchAll(/localFont\(\{([\s\S]*?)\}\);/g)].map((match) => match[1]);
  const faces = calls.map((body) => ({
    file: body.match(/src: "\.\/([^"]+)"/)?.[1],
    family: body.match(/prop: "font-family", value: "([^"]+)"/)?.[1],
    range: body.match(/prop: "unicode-range", value: "([^"]+)"/)?.[1] ?? null,
    preload: !/preload: false/.test(body),
    fallback: !/adjustFontFallback: false/.test(body),
  }));
  assert.deepEqual(faces, [
    { file: "inter-latin.woff2", family: "SG Inter", range: null, preload: true, fallback: false },
    { file: "inter-vietnamese.woff2", family: "SG Inter", range: RANGE, preload: false, fallback: false },
    { file: "jetbrains-mono-latin.woff2", family: "SG Mono", range: null, preload: false, fallback: false },
    { file: "jetbrains-mono-vietnamese.woff2", family: "SG Mono", range: RANGE, preload: false, fallback: false },
  ]);
});

test("fonts.css sets the family variables and the metric-adjusted fallbacks next/font computed for these files", () => {
  const css = fs.readFileSync("src/app/fonts/fonts.css", "utf8");
  assert.match(css, /--font-inter: "SG Inter", "SG Inter Fallback";/);
  assert.match(css, /--font-code: "SG Mono", "SG Mono Fallback";/);
  assert.match(css, /font-family: "SG Inter Fallback"; src: local\("Arial"\); ascent-override: 89\.79%; descent-override: 22\.36%; line-gap-override: 0%; size-adjust: 107\.89%;/);
  assert.match(css, /font-family: "SG Mono Fallback"; src: local\("Arial"\); ascent-override: 77\.57%; descent-override: 22\.82%; line-gap-override: 0%; size-adjust: 131\.49%;/);
});

test("only src/app/fonts/fonts.ts loads fonts, and a root module imports it", () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
  const sources = walk("src").filter((file) => /\.tsx?$/.test(file)).map((file) => [file.replaceAll("\\", "/"), fs.readFileSync(file, "utf8")]);
  assert.deepEqual(sources.filter(([, text]) => text.includes("next/font")).map(([file]) => file), ["src/app/fonts/fonts.ts"]);
  assert.ok(sources.some(([, text]) => /import "(?:\.\/fonts|@\/app\/fonts)\/fonts";/.test(text)), "a layout or the site shell imports the fonts module");
});

test("the font licence names every shipped font file", () => {
  const licence = fs.readFileSync("public/licenses/fonts.txt", "utf8");
  for (const file of Object.keys(FILES)) assert.ok(licence.includes(path.basename(file)), path.basename(file));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test tests/fonts.test.mjs`
Expected: FAIL (`ENOENT … inter-vietnamese.woff2`, and the fonts.ts test fails).

- [ ] **Step 3: Add the font files**

Copy them from the plan probe if it is still there; otherwise download them with a Chrome user agent:
```bash
cd "E:/Personal/clone website/spacegear-hero"
P="C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/plan-probes/fonts-dl"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
[ -f "$P/inter-vietnamese-gf.woff2" ] && cp "$P/inter-vietnamese-gf.woff2" src/app/fonts/inter-vietnamese.woff2 || curl -s -A "$UA" -o src/app/fonts/inter-vietnamese.woff2 "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2pL7SUc.woff2"
[ -f "$P/jbm-vietnamese-gf.woff2" ] && cp "$P/jbm-vietnamese-gf.woff2" src/app/fonts/jetbrains-mono-vietnamese.woff2 || curl -s -A "$UA" -o src/app/fonts/jetbrains-mono-vietnamese.woff2 "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD0OwG_TA.woff2"
sha256sum src/app/fonts/*-vietnamese.woff2
```

Expected: the two hashes in `FILES`.
- If Google now serves different bytes, check with fontTools (`python -c "from fontTools.ttLib import TTFont; …"`) that the name table version and the hhea/OS/2 metrics equal the latin file's: Inter 4.001 (asc 1984, desc −494, upm 2048); JetBrains Mono 2.211 (1020/−300, upm 1000).
- If they do, update the pinned hash and say so in the commit. If they do not, stop and report.

- [ ] **Step 4: Create `src/app/fonts/fonts.ts`**

```ts
// The site's two type families, self-hosted (OFL 1.1, public/licenses/fonts.txt): Inter and JetBrains Mono, each
// as Google Fonts' "latin" subset plus its "vietnamese" subset (same versions and metrics). One family name covers
// both subsets, and the Vietnamese face carries Google's unicode-range, so a browser downloads it only for a page
// that shows Vietnamese letters: English pages never fetch it (scripts/locale-checks.mjs checks this).
// Explicit family names: Turbopack names a next/font family after its JS binding (`inter`, `mono`), so two
// bindings could never share a family; `declarations` sets the name instead. next/font then cannot build the
// metric-adjusted fallback or the CSS variable, so fonts.css does. Options must be literals (next/font), so the
// range string is written out in each call; tests/fonts.test.mjs checks they match.
// Only the latin Inter face is preloaded, as before.
import localFont from "next/font/local";
import "./fonts.css";

export const interLatin = localFont({ src: "./inter-latin.woff2", display: "swap", adjustFontFallback: false, declarations: [{ prop: "font-family", value: "SG Inter" }] });
export const interVietnamese = localFont({ src: "./inter-vietnamese.woff2", display: "swap", preload: false, adjustFontFallback: false, declarations: [{ prop: "font-family", value: "SG Inter" }, { prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }] });
export const monoLatin = localFont({ src: "./jetbrains-mono-latin.woff2", display: "swap", preload: false, adjustFontFallback: false, declarations: [{ prop: "font-family", value: "SG Mono" }] });
export const monoVietnamese = localFont({ src: "./jetbrains-mono-vietnamese.woff2", display: "swap", preload: false, adjustFontFallback: false, declarations: [{ prop: "font-family", value: "SG Mono" }, { prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }] });
```

- [ ] **Step 5: Create `src/app/fonts/fonts.css`**

```css
/* The families' CSS variables (read by --font-sans and --font-mono in globals.css) and their fallbacks while the
   web fonts load: Arial with the metric overrides next/font computed for these exact files (the site's CSS before
   the Vietnamese subsets: "inter Fallback" and "mono Fallback"), so text keeps its size when the fonts swap in. */
@font-face { font-family: "SG Inter Fallback"; src: local("Arial"); ascent-override: 89.79%; descent-override: 22.36%; line-gap-override: 0%; size-adjust: 107.89%; }
@font-face { font-family: "SG Mono Fallback"; src: local("Arial"); ascent-override: 77.57%; descent-override: 22.82%; line-gap-override: 0%; size-adjust: 131.49%; }
:root {
  --font-inter: "SG Inter", "SG Inter Fallback";
  --font-code: "SG Mono", "SG Mono Fallback";
}
```

- [ ] **Step 6: Use the module in `src/app/layout.tsx`**

Delete line 2 (`import localFont from "next/font/local";`) and lines 15–16 (the two `localFont` calls). Add after `import "./globals.css";`:

```tsx
// The type families (Inter and JetBrains Mono, latin and Vietnamese subsets): src/app/fonts/fonts.ts.
import "./fonts/fonts";
```

and change the `<html>` line's className from ``{`${inter.variable} ${mono.variable} antialiased`}`` to `"antialiased"`:

```tsx
  return <html lang="en" className="antialiased" suppressHydrationWarning><body id="top">
```

- [ ] **Step 7: Update `public/licenses/fonts.txt`** (replace its first five lines, keep the OFL text that follows)

```text
Inter: Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter)
Source: https://github.com/rsms/inter/blob/master/LICENSE.txt
Files: inter-latin.woff2, inter-vietnamese.woff2 (Google Fonts subsets of Inter 4.001, variable weight 100-900)

JetBrains Mono: Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)
Source: https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt
Files: jetbrains-mono-latin.woff2, jetbrains-mono-vietnamese.woff2 (Google Fonts subsets of JetBrains Mono 2.211, variable weight 100-800)
```

- [ ] **Step 8: Run the tests and fast gates**

Run: `node --import tsx --test tests/fonts.test.mjs && npm run lint && npm run typecheck`
Expected: PASS. (`npm test` once Task 1 is in.) Do not build: Task 9 verifies the CSS, the preload and the font requests in a browser.

- [ ] **Step 9: Commit**

```bash
git add src/app/fonts/fonts.ts src/app/fonts/fonts.css src/app/fonts/inter-vietnamese.woff2 src/app/fonts/jetbrains-mono-vietnamese.woff2 src/app/layout.tsx public/licenses/fonts.txt tests/fonts.test.mjs
git commit -m "feat(fonts): Vietnamese subsets of Inter and JetBrains Mono behind unicode-range

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Worker region redirect and the `?lang=` cookie switch (M, ∥)

**Files:**
- Create: `worker/locale.ts`, `tests/worker-locale.test.mjs`
- Modify: `worker/index.ts`, `wrangler.jsonc` (`assets.run_worker_first`, `vars`, `env.production.vars`), `worker-configuration.d.ts` (regenerated), `tsconfig.worker.json` (`include`)

- [ ] **Step 1: Write the failing test** (`tests/worker-locale.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { handleLocale, prefersVietnamese, cookieLocale, countryOf, TEST_COUNTRY_HEADER } = await import("../worker/locale.ts");

// The pages the asset store has, for the twin checks.
const PAGES = new Set(["/", "/about/", "/contact/", "/vi/", "/vi/about/", "/vi/contact/", "/labs/only-english/"]);
const ASSETS = { fetch: async (request) => new Response(null, { status: PAGES.has(new URL(request.url).pathname) ? 200 : 404 }) };
const PRODUCTION = { ASSETS, SITE_ORIGIN: "https://spacegear.tech", LOCALE_TEST_HEADER: "false" };
const PREVIEW = { ASSETS, SITE_ORIGIN: "http://localhost:8787", LOCALE_TEST_HEADER: "true" };
function navigation(path, { headers = {}, cf, method = "GET" } = {}) {
  const request = new Request(new URL(path, "https://spacegear.tech"), { method, headers });
  if (cf) Object.defineProperty(request, "cf", { value: cf });
  return request;
}

test("a first visit from Vietnam goes to the Vietnamese twin, query kept, never cached, no cookie", async () => {
  const response = await handleLocale(navigation("/about/?utm_source=google&utm_medium=organic", { cf: { country: "VN" } }), PRODUCTION);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/vi/about/?utm_source=google&utm_medium=organic");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("vary"), "Cookie, Accept-Language");
  assert.equal(response.headers.get("set-cookie"), null);
  const head = await handleLocale(navigation("/", { cf: { country: "VN" }, method: "HEAD" }), PRODUCTION);
  assert.equal(head.headers.get("location"), "/vi/");
  const bare = await handleLocale(navigation("/contact", { cf: { country: "VN" } }), PRODUCTION);
  assert.equal(bare.headers.get("location"), "/vi/contact/", "the twin gets its trailing slash");
});

test("only a first Accept-Language entry of vi or vi-* counts", async () => {
  assert.ok(prefersVietnamese("vi") && prefersVietnamese("vi-VN,vi;q=0.9,en;q=0.8") && prefersVietnamese(" VI-vn ;q=1"));
  for (const header of ["en-US,en;q=0.9,vi;q=0.8", "*", "", null, "vietnamese", "fr-VI"]) assert.equal(prefersVietnamese(header), false, String(header));
  const response = await handleLocale(navigation("/about/", { headers: { "accept-language": "vi-VN,vi;q=0.9" }, cf: { country: "US" } }), PRODUCTION);
  assert.equal(response.headers.get("location"), "/vi/about/");
});

test("no redirect with a cookie, from another country, for other methods, without a twin, on shared or Vietnamese paths", async () => {
  const vn = { country: "VN" };
  const cases = [
    navigation("/about/", { cf: vn, headers: { cookie: "a=1; sg_lang=en" } }),
    navigation("/about/", { cf: vn, headers: { cookie: "sg_lang=vi" } }),
    navigation("/about/", { cf: { country: "SG" }, headers: { "accept-language": "en-GB" } }),
    navigation("/about/", { cf: vn, method: "POST" }),
    navigation("/labs/only-english/", { cf: vn }),
    navigation("/no-such-page/", { cf: vn }),
    navigation("/vi", { cf: vn }),
    navigation("/admin", { cf: vn }),
    navigation("/api/contact", { cf: vn }),
    navigation("/sitemap.xml", { cf: vn }),
  ];
  for (const request of cases) assert.equal(await handleLocale(request, PRODUCTION), null, `${request.method} ${new URL(request.url).pathname} ${request.headers.get("cookie") ?? ""}`);
  assert.equal(cookieLocale("x=1; sg_lang=vi; y=2"), "vi");
  assert.equal(cookieLocale("sg_lang=fr"), undefined);
  assert.equal(cookieLocale(null), undefined);
});

test("?lang= stores the choice for a year and redirects to the clean page in that language", async () => {
  const toVi = await handleLocale(navigation("/about/?lang=vi&utm_source=x"), PRODUCTION);
  assert.equal(toVi.status, 302);
  assert.equal(toVi.headers.get("location"), "/vi/about/?utm_source=x");
  assert.equal(toVi.headers.get("set-cookie"), "sg_lang=vi; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
  assert.equal(toVi.headers.get("cache-control"), "no-store");
  const toEn = await handleLocale(navigation("/about/?lang=en", { cf: { country: "VN" } }), PRODUCTION);
  assert.equal(toEn.headers.get("location"), "/about/");
  assert.equal(toEn.headers.get("set-cookie"), "sg_lang=en; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
  const noTwin = await handleLocale(navigation("/labs/only-english/?lang=vi"), PRODUCTION);
  assert.equal(noTwin.headers.get("location"), "/vi/", "a page without a twin falls back to the language's home page");
  assert.equal(await handleLocale(navigation("/about/?lang=fr"), PRODUCTION), null, "an unknown language is ignored");
});

test("the preview ignores request.cf and reads the test header, only on a localhost origin", async () => {
  assert.equal(await handleLocale(navigation("/about/", { cf: { country: "VN" } }), PREVIEW), null, "the cached cf.json says VN; the preview ignores it");
  const header = await handleLocale(navigation("/about/", { headers: { [TEST_COUNTRY_HEADER]: "vn" } }), PREVIEW);
  assert.equal(header.headers.get("location"), "/vi/about/");
  assert.equal(await handleLocale(navigation("/about/", { headers: { [TEST_COUNTRY_HEADER]: "VN" }, cf: { country: "US" } }), PRODUCTION), null, "production never reads the header");
  assert.equal(countryOf(navigation("/", { headers: { [TEST_COUNTRY_HEADER]: "VN" } }), { SITE_ORIGIN: "https://spacegear.tech", LOCALE_TEST_HEADER: "true" }), undefined, "the flag alone is not enough off localhost");
});

test("wrangler.jsonc sends only HTML navigations to the Worker, and only the preview honours the test header", () => {
  const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
  const rules = config.assets.run_worker_first;
  // The asset router's matcher (miniflare router.worker.js, rules-engine): negative rules first, "*" is ".*", anchored.
  const glob = (rule) => new RegExp(`^${rule.split("*").map((part) => part.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join(".*")}$`);
  const toWorker = (path) => !rules.filter((rule) => rule.startsWith("!")).some((rule) => glob(rule.slice(1)).test(path)) && rules.filter((rule) => !rule.startsWith("!")).some((rule) => glob(rule).test(path));
  for (const path of ["/", "/about/", "/services/applied-ai/", "/contact", "/vi", "/api/contact", "/api/auth/callback", "/labs/a-post/"]) assert.ok(toWorker(path), `${path} runs the Worker first`);
  for (const path of ["/vi/", "/vi/about/", "/_next/static/chunks/a.js", "/images/galaxy.webp", "/textures/earth/2k/day.webp", "/uploads/a.jpg", "/admin/", "/admin/config.yml", "/sitemap.xml", "/robots.txt", "/favicon.ico", "/manifest.webmanifest", "/labs/rss.xml", "/vi/labs/rss.xml", "/llms.txt", "/404.html"]) assert.ok(!toWorker(path), `${path} goes straight to assets`);
  assert.equal(config.vars.LOCALE_TEST_HEADER, "true");
  assert.equal(config.env.production.vars.LOCALE_TEST_HEADER, "false");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test tests/worker-locale.test.mjs`
Expected: FAIL, `Cannot find module …/worker/locale.ts`.

- [ ] **Step 3: Implement `worker/locale.ts`**

```ts
// Language routing for HTML navigations. wrangler.jsonc (assets.run_worker_first) sends every path without a file
// extension here first, except /_next/, /images/, /textures/, /uploads/, /admin/ and /vi/.
// - ?lang=en|vi (the EN/VI switch, which always links an English path): remember the choice in the sg_lang cookie
//   for a year and send the visitor to the clean page in that language: its twin, or the language's home page
//   when the page has no twin (a Labs article in one language). Other query parameters are kept.
// - A first visit to an English page (no sg_lang cookie) from Vietnam (request.cf.country "VN"), or from a browser
//   whose first Accept-Language entry is Vietnamese ("vi", "vi-*"), goes to the page's /vi/ twin when it exists.
// - Everything else, and every visitor with the cookie, gets the page as asked. Crawlers are not special:
//   Googlebot from outside Vietnam sees English and finds /vi/ through hreflang and the sitemap.
// Redirects are made here, so public/_headers does not reach them: they carry no-store and Vary themselves.
// The local preview (wrangler dev --local) reads request.cf from node_modules/.mf/cf.json, which says VN on the
// owner's machine. With LOCALE_TEST_HEADER "true" (wrangler.jsonc top-level vars only) on a localhost origin, the
// country comes only from the x-sg-test-country header and request.cf is ignored; production never reads the header.
import { LOCALE_COOKIE, isLocale, isSharedPath, localeOfPath, localizedHref, stripLocale, type Locale } from "../src/lib/i18n/locales.ts";
import type { RuntimeEnv } from "./types.ts";

export const TEST_COUNTRY_HEADER = "x-sg-test-country";
const YEAR = 31536000;
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
type LocaleEnv = Pick<RuntimeEnv, "ASSETS" | "SITE_ORIGIN" | "LOCALE_TEST_HEADER">;

const withSlash = (path: string) => (path.endsWith("/") ? path : `${path}/`);

/** The visitor's country code: request.cf in production; in the local preview, only the test header. */
export function countryOf(request: Request, env: Pick<RuntimeEnv, "SITE_ORIGIN" | "LOCALE_TEST_HEADER">): string | undefined {
  if (env.LOCALE_TEST_HEADER === "true" && LOCAL_ORIGIN.test(env.SITE_ORIGIN)) return request.headers.get(TEST_COUNTRY_HEADER)?.trim().toUpperCase() || undefined;
  const country = (request.cf as { country?: unknown } | undefined)?.country;
  return typeof country === "string" ? country : undefined;
}

/** True when the first Accept-Language entry is Vietnamese ("vi" or "vi-VN"); later entries do not count. */
export function prefersVietnamese(acceptLanguage: string | null): boolean {
  const first = (acceptLanguage ?? "").split(",")[0].split(";")[0].trim().toLowerCase();
  return first === "vi" || first.startsWith("vi-");
}

/** The sg_lang cookie, when it names a language. */
export function cookieLocale(cookie: string | null): Locale | undefined {
  const value = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`).exec(cookie ?? "")?.[1];
  return isLocale(value) ? value : undefined;
}

async function exists(env: LocaleEnv, url: URL): Promise<boolean> {
  return (await env.ASSETS.fetch(new Request(url, { method: "HEAD" }))).status < 400;
}

function redirect(url: URL, choice?: Locale): Response {
  const headers = new Headers({ Location: `${url.pathname}${url.search}`, "Cache-Control": "no-store", Vary: "Cookie, Accept-Language" });
  if (choice) headers.set("Set-Cookie", `${LOCALE_COOKIE}=${choice}; Path=/; Max-Age=${YEAR}; SameSite=Lax; Secure`);
  return new Response(null, { status: 302, headers });
}

/** A redirect for this navigation, or null to serve it from the assets as asked. */
export async function handleLocale(request: Request, env: LocaleEnv): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const path = url.pathname;
  if (isSharedPath(path) || /\.[A-Za-z0-9]+$/.test(path)) return null;
  const choice = url.searchParams.get("lang");
  if (isLocale(choice)) {
    url.searchParams.delete("lang");
    const twin = new URL(localizedHref(withSlash(stripLocale(path)), choice), url);
    const page = (await exists(env, twin)) ? twin : new URL(localizedHref("/", choice), url);
    page.search = url.search;
    return redirect(page, choice);
  }
  if (localeOfPath(path) === "vi" || cookieLocale(request.headers.get("cookie"))) return null;
  if (countryOf(request, env) !== "VN" && !prefersVietnamese(request.headers.get("accept-language"))) return null;
  const twin = new URL(localizedHref(withSlash(path), "vi"), url);
  if (!(await exists(env, twin))) return null;
  twin.search = url.search;
  return redirect(twin);
}
```

- [ ] **Step 4: Call it from `worker/index.ts`**

Add `import { handleLocale } from "./locale.ts";` and replace the last line of `fetch`:

```ts
    if(path==="/api"||path.startsWith("/api/"))return json({ok:false,code:"not_found"},404);
    const localized=await handleLocale(request,env);
    if(localized)return localized;
    return env.ASSETS.fetch(request);
```

- [ ] **Step 5: Configure `wrangler.jsonc`**

Replace `"run_worker_first": ["/api/*"]` with:

```jsonc
    // HTML navigations run the Worker first (worker/locale.ts: region redirect, ?lang= switch); /api/* still
    // does. Files (any path with a dot), build output, media, the CMS and every /vi/ page go straight to assets.
    // Negative rules win; "*" matches across "/" (miniflare's router, rules-engine).
    "run_worker_first": ["/*", "!/_next/*", "!/images/*", "!/textures/*", "!/uploads/*", "!/admin/*", "!/vi/*", "!/*.*"]
```

Add to the top-level `vars`:

```jsonc
    // The local preview reads the visitor's country from the x-sg-test-country header (worker/locale.ts), never in production.
    "LOCALE_TEST_HEADER": "true"
```

and to `env.production.vars`: `"LOCALE_TEST_HEADER": "false"`.

- [ ] **Step 6: Regenerate the Worker types and include the shared locale module**

Run: `npx wrangler types --strict-vars=false`
Expected: `worker-configuration.d.ts` gains `LOCALE_TEST_HEADER: string;` in `__BaseEnv_Env` and in `ProductionEnv`, and `"LOCALE_TEST_HEADER"` in the `ProcessEnv` `Pick`. If wrangler cannot run offline, add exactly those three entries by hand, next to `GITHUB_OAUTH_SCOPE`.

In `tsconfig.worker.json` change `include` to:

```json
  "include": ["worker/**/*.ts", "worker-configuration.d.ts", "src/lib/contact.ts", "src/lib/content.ts", "src/lib/i18n/*.ts"]
```

- [ ] **Step 7: Run the tests and fast gates**

Run: `node --import tsx --test tests/worker-locale.test.mjs tests/github-auth.test.mjs tests/contact.test.mjs && npm run lint && npm run typecheck`
Expected: PASS. (`npm test` once Task 1 is in.) The preview smoke test runs in Task 9.

- [ ] **Step 8: Commit**

```bash
git add worker/locale.ts worker/index.ts wrangler.jsonc worker-configuration.d.ts tsconfig.worker.json tests/worker-locale.test.mjs
git commit -m "feat(worker): region redirect to /vi/ and the ?lang= cookie switch for HTML navigations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: The typed dictionary, filled from the translator's draft (M, ∥)

The strings below are `docs/i18n/ui-strings-vi.json` (190 entries, 2026-10-23) arranged by component. Where a sentence wraps a link, it is split into before/link/after parts; the splits are given here. NAP strings are not here: they are owner facts in `content/site.json` (Task 11).

**Files:**
- Create: `src/lib/i18n/en.ts`, `src/lib/i18n/vi.ts`, `src/lib/i18n/dictionary.ts`, `tests/i18n-dictionary.test.mjs`

- [ ] **Step 1: Write the failing test** (`tests/i18n-dictionary.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findForbidden, textsOf } from "../scripts/lib/honesty.mjs";

const { dictionary, format, formatParts } = await import("../src/lib/i18n/dictionary.ts");
const { en } = await import("../src/lib/i18n/en.ts");
const { vi } = await import("../src/lib/i18n/vi.ts");

/** Every leaf path ("nav.home", "about.principles[2]") with its value. */
function leaves(value, at = "", out = new Map()) {
  if (typeof value === "string") out.set(at, value);
  else if (Array.isArray(value)) value.forEach((item, index) => leaves(item, `${at}[${index}]`, out));
  else for (const [key, child] of Object.entries(value)) leaves(child, at ? `${at}.${key}` : key, out);
  return out;
}

test("Vietnamese has exactly the English keys, lists of the same length, and no empty string", () => {
  const [english, vietnamese] = [leaves(en), leaves(vi)];
  assert.deepEqual([...vietnamese.keys()], [...english.keys()]);
  for (const [key, text] of [...english, ...vietnamese]) assert.ok(text.trim().length > 0, `${key} is empty`);
});

test("every placeholder of a string is in its translation", () => {
  const english = leaves(en);
  for (const [key, text] of leaves(vi)) {
    const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(names(text), names(english.get(key)), key);
  }
});

test("dictionary() picks the language and format() fills placeholders", () => {
  assert.equal(dictionary("en"), en);
  assert.equal(dictionary("vi"), vi);
  assert.equal(format("Step {n}", { n: 3 }), "Step 3");
  assert.equal(format("© {year} spacegear.tech.", { year: 2026 }), "© 2026 spacegear.tech.");
  assert.equal(format("{missing} stays", {}), "{missing} stays");
  assert.deepEqual(formatParts("Role {i} of {n}", { i: 1, n: 5 }), ["Role ", 1, " of ", 5]);
  assert.deepEqual(formatParts("© {year} spacegear.tech. All rights reserved.", { year: 2026 }), ["© ", 2026, " spacegear.tech. All rights reserved."]);
});

test("the UI strings make no unverified claim in either language", () => {
  for (const [locale, strings] of [["en", en], ["vi", vi]]) {
    for (const [field, text] of textsOf(strings)) assert.deepEqual(findForbidden(text, `src/lib/i18n/${locale}.ts`, field), [], `${locale} ${field}: ${text}`);
  }
});

test("TypeScript refuses a Vietnamese dictionary with a missing or an extra key", () => {
  const source = fs.readFileSync("src/lib/i18n/vi.ts", "utf8");
  assert.match(source, /export const vi: Dictionary = \{/, "vi is annotated, so a missing key fails typecheck and an extra key fails as an excess property");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test tests/i18n-dictionary.test.mjs`
Expected: FAIL, `Cannot find module …/src/lib/i18n/dictionary.ts`.

- [ ] **Step 3: Create `src/lib/i18n/en.ts`** (the source of the keys)

```ts
// UI strings that live in code, not in the CMS: navigation, buttons, form labels and messages, aria labels,
// the 404, metadata defaults, cursor labels and the copy of the pages without a content file. Vietnamese
// (vi.ts) must have exactly these keys (src/lib/i18n/dictionary.ts). "{name}" is a placeholder for format().
// Erasable TypeScript only.
export const en = {
  meta: {
    homeTitle: "Digital Transformation & AI Consulting",
    homeDescription: "Turn business challenges into working digital systems. spacegear.tech brings digital transformation, AI strategy and hands-on delivery together.",
    ogImageAlt: "spacegear logo",
  },
  shell: { skipToContent: "Skip to content" },
  nav: {
    label: "Main navigation",
    homeLink: "spacegear home",
    home: "Home",
    services: "Services",
    approach: "Approach",
    about: "About",
    engagements: "Engagements",
    contact: "Contact",
    cta: "Discuss a project",
    openMenu: "Open navigation",
    allServices: "All services",
    language: "Language",
  },
  footer: {
    contactLink: "Discuss a project ↗",
    homeSections: "Home page sections",
    pages: "Pages",
    privacyLead: "Read how we handle your details in our",
    privacyLink: "Privacy policy.",
    copyright: "© {year} spacegear.tech. All rights reserved.",
    tagline: "Digital transformation & AI consulting.",
    privacy: "Privacy",
    terms: "Terms",
    backToTop: "Back to top",
  },
  contactDetails: { address: "Address", phone: "Phone", email: "Email" },
  quickStart: {
    nameLabel: "Your name",
    namePlaceholder: "Your Name",
    emailLabel: "Your email",
    emailPlaceholder: "Your Email",
    submit: "Continue to the project brief",
  },
  form: {
    verificationFailed: "Verification could not load. Please reload the page or use the email address below.",
    previewNoSend: "This preview does not send inquiries.",
    completeVerification: "Please complete the verification, then send your inquiry.",
    received: "Your inquiry has been received. We’ll review your brief and respond about a suitable next step.",
    tooMany: "Too many attempts in a short time. Please wait a minute and try again.",
    changed: "Your brief changed after an earlier attempt. Check the details and send it again.",
    expired: "Verification expired or could not be confirmed. Complete it again and retry.",
    checkFields: "Please check the highlighted fields.",
    notSaved: "Your inquiry could not be saved. Your text is still here—please try again.",
    noReceipt: "We couldn’t confirm receipt. Your text is still here. Complete verification again and retry; the same inquiry won’t be saved twice.",
    previewNotice: "This preview does not send inquiries. The form will open when the contact channel is ready.",
    name: "Name",
    email: "Email",
    company: "Company",
    optional: "(optional)",
    service: "Service interest",
    serviceAny: "Let’s explore it together",
    message: "What would you like to improve?",
    messagePlaceholder: "Tell us about the challenge, your current approach and what you would like to change.",
    website: "Website",
    noteLead: "We use these details to review and respond to your inquiry. Read our",
    noteLink: "privacy policy",
    noteTail: ". Please leave out confidential information.",
    sending: "Sending…",
    send: "Send inquiry",
    noscript: "The protected form requires JavaScript. Please use the contact email below when available.",
  },
  contactErrors: {
    submitted: "Please check the submitted details.",
    reload: "Please reload the form and try again.",
    name: "Use between 2 and 100 characters.",
    email: "Enter a valid email address.",
    company: "Use no more than 200 characters.",
    message: "Use between 20 and 3,000 characters.",
    service: "Choose a listed service or leave this blank.",
    verification: "Complete verification and try again.",
    rejected: "The inquiry could not be accepted.",
  },
  // The hero headline's grammar between the three verbs ("plan, build, and scale"); Vietnamese puts no comma before "và".
  hero: { afterFirst: ",", afterSecond: ",", conjunction: "and" },
  cursor: { view: "View", drag: "Drag", open: "Open" },
  pricing: {
    toggleDeliverables: "Deliverables",
    toggleOutcomes: "Outcomes",
    toggleLabel: "Show outcomes instead of deliverables ({label})",
    startHere: "Start here",
    stage: "Stage",
    engagement: "Engagement",
    focus: "Focus",
    columnDeliverables: "Deliverables",
    columnOutcomes: "Outcomes",
    select: "Select",
    selected: "Selected",
    chosenBefore: "{short} selected — ",
    chosenLink: "tell us about your challenge",
    chosenAfter: " to get started.",
    discuss: "Discuss a project",
  },
  process: { output: "output", outputs: "outputs", step: "Step {n}" },
  team: { roleOf: "Role {i} of {n}", swipe: "‹ swipe ›", previous: "Previous role", next: "Next role" },
  testimonials: { previous: "Previous", next: "Next", reviews: "Reviews", show: "Show {name}", sample: "Sample content — not a real client" },
  labs: { writtenBy: "Written by", read: "Read article", sample: "Sample content — not a real article" },
  analytics: { ticker: "Capabilities" },
  rail: { label: "On this page" },
  snapRow: { goTo: "Go to item {n}" },
  cta: { discuss: "Discuss a project" },
  pageIntro: { back: "Home" },
  notFound: {
    title: "Page not found",
    eyebrow: "Page not found",
    headingBefore: "A different ",
    headingAccent: "direction",
    headingAfter: ".",
    text: "This page is unavailable. Explore our services or tell us what you would like to improve.",
    explore: "Explore services",
    home: "Back to home",
  },
  about: {
    title: "About",
    description: "spacegear.tech connects digital transformation and AI strategy with hands-on delivery, practical implementation and adoption.",
    eyebrow: "About spacegear.tech",
    heading: "Good thinking should become useful work.",
    lead: "We connect business strategy, technology and delivery to help you make a meaningful change in the way work gets done.",
    contextHeading: "Business context first. Technology with a purpose.",
    contextParagraphs: [
      "Digital transformation starts with a real challenge. We look at the work, the people using the systems and the constraints around them, then choose an approach that makes sense.",
      "AI and deep learning are part of the toolkit. So are process design, integration and thoughtful software engineering. The goal is a solution you can operate, understand and improve.",
    ],
    principlesLabel: "Working principles",
    principles: ["Understand before recommending", "Make assumptions visible and testable", "Design for the whole workflow", "Keep human judgment where it matters", "Make handover part of delivery"],
    ctaTitle: "From the first decision to what happens next.",
    ctaText: "We bring strategy and implementation into the same conversation.",
    ctaButton: "See how we work",
  },
  approach: {
    title: "Our Approach",
    description: "Assess, prioritize, validate, deliver and adopt. A practical approach to digital transformation and AI implementation with clear decisions and handover.",
    eyebrow: "How we work",
    heading: "A clear path from intention to implementation.",
    lead: "Useful deliverables, visible decisions and a shared understanding of what comes next. The depth of each stage follows the engagement.",
    stepsHeading: "How an engagement runs",
    ctaTitle: "Start with the challenge in front of you.",
    ctaText: "Tell us where you are and we’ll suggest a sensible starting point.",
  },
  contact: {
    title: "Discuss a Project",
    description: "Tell spacegear.tech what you want to improve. Start a conversation about digital transformation, AI, automation or software delivery.",
    eyebrow: "Let’s start a conversation",
    heading: "What would you like to improve?",
    lead: "A challenge, an idea or a project already in motion. Tell us where you are and what you want to make possible.",
    asideHeading: "A useful next step starts here.",
    asideText: "You don’t need a finished brief or ready-to-use data. Share what you know, and we can work through the next questions together.",
    asideReply: "We review your brief and respond about a suitable next step.",
  },
  privacy: {
    title: "Privacy",
    description: "How spacegear.tech handles information submitted through this website and how to contact us about that information.",
    eyebrow: "Website information",
    heading: "Privacy.",
    lead: "How information submitted through this website is handled.",
    notice: "Preview policy. The operator must confirm the contact details, retention period and data practices before public launch or collection of real inquiries.",
    contactHeading: "Questions or requests",
    contactBefore: "Contact ",
    contactAfter: " about information you have submitted, including requests for access or deletion.",
    contactPending: "A verified privacy contact will be provided before this website opens for real inquiries.",
  },
  terms: {
    title: "Website Terms",
    description: "Terms for using the spacegear.tech website. Service scope, pricing, ownership and delivery commitments are agreed separately.",
    eyebrow: "Website information",
    heading: "Website terms.",
    lead: "Information about using this website and discussing an engagement.",
    notice: "Preview terms. The operator must approve the final website terms and necessary company facts before public launch.",
    contactHeading: "Contact",
    contactPending: "A verified contact address will be available before public launch.",
  },
  services: {
    title: "Services",
    description: "Explore digital transformation strategy, AI consulting, applied AI and deep learning, automation, integration and digital product delivery.",
    eyebrow: "Strategy & delivery",
    heading: "Flexible services for modernizing operations and putting AI to work.",
    lead: "Five capabilities — plan, build, connect and improve — that work on their own or together, from the first decision to daily use.",
    explore: "Explore this service",
    ctaTitle: "Plan, build, connect and improve.",
    ctaText: "See how the services work together for your organization.",
  },
  service: {
    problemHeading: "Start with the work you want to improve.",
    discuss: "Discuss a project",
    receive: "What you receive",
    howTitle: "How It Works",
    howHeading: "From first conversation to a useful outcome.",
    howDescription: "Scope, access, responsibilities and acceptance criteria are agreed before delivery.",
    faqTitle: "Questions & Answers",
    faqHeading: "A few useful answers about this service.",
    faqDescription: "Ask us anything else when we talk.",
    relatedTitle: "Related Services",
    relatedHeading: "Capabilities that often work together.",
    relatedDescription: "Each one also works on its own.",
    ctaTitle: "Tell us what you want to improve.",
    ctaText: "Share the challenge. We’ll suggest a sensible first step.",
  },
} as const;
```

- [ ] **Step 4: Create `src/lib/i18n/dictionary.ts`**

```ts
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
```

- [ ] **Step 5: Create `src/lib/i18n/vi.ts`** (from `docs/i18n/ui-strings-vi.json`; splits as noted)

```ts
// Vietnamese UI strings (en.ts has the keys and the notes). Written to the owner's style rule: natural sentences
// with a subject and predicate, facts identical to the English, no new claims. Source: the translator's draft,
// docs/i18n/ui-strings-vi.json (2026-10-23). Erasable TypeScript only.
import type { Dictionary } from "./dictionary.ts";

export const vi: Dictionary = {
  meta: {
    homeTitle: "Tư vấn chuyển đổi số & AI",
    homeDescription: "spacegear.tech giúp bạn biến những bài toán kinh doanh thành hệ thống số vận hành thực tế, bằng cách kết hợp chuyển đổi số, chiến lược AI và việc trực tiếp triển khai.",
    ogImageAlt: "Logo spacegear",
  },
  shell: { skipToContent: "Chuyển đến nội dung chính" },
  nav: {
    label: "Điều hướng chính",
    homeLink: "Trang chủ spacegear",
    home: "Trang chủ",
    services: "Dịch vụ",
    approach: "Phương pháp",
    about: "Giới thiệu",
    engagements: "Hợp tác",
    contact: "Liên hệ",
    cta: "Trao đổi về dự án",
    openMenu: "Mở menu điều hướng",
    allServices: "Tất cả dịch vụ",
    language: "Ngôn ngữ",
  },
  footer: {
    contactLink: "Trao đổi về dự án ↗",
    homeSections: "Các phần của trang chủ",
    pages: "Các trang",
    privacyLead: "Xem cách chúng tôi xử lý thông tin của bạn trong",
    privacyLink: "Chính sách quyền riêng tư.",
    copyright: "© {year} spacegear.tech. Bảo lưu mọi quyền.",
    tagline: "Tư vấn chuyển đổi số & AI.",
    privacy: "Quyền riêng tư",
    terms: "Điều khoản",
    backToTop: "Lên đầu trang",
  },
  contactDetails: { address: "Địa chỉ", phone: "Điện thoại", email: "Email" },
  quickStart: {
    nameLabel: "Họ và tên của bạn",
    namePlaceholder: "Họ và tên của bạn",
    emailLabel: "Email của bạn",
    emailPlaceholder: "Email của bạn",
    submit: "Tiếp tục đến phần mô tả dự án",
  },
  form: {
    verificationFailed: "Không tải được bước xác minh. Vui lòng tải lại trang hoặc dùng địa chỉ email bên dưới.",
    previewNoSend: "Bản xem trước này không gửi yêu cầu đi.",
    completeVerification: "Vui lòng hoàn tất bước xác minh rồi gửi yêu cầu.",
    received: "Chúng tôi đã nhận được yêu cầu của bạn và sẽ xem xét thông tin, rồi phản hồi về một bước tiếp theo phù hợp.",
    tooMany: "Bạn đã thử quá nhiều lần trong thời gian ngắn. Vui lòng chờ một phút rồi thử lại.",
    changed: "Nội dung bạn gửi đã thay đổi so với lần thử trước. Vui lòng kiểm tra lại thông tin và gửi lại.",
    expired: "Bước xác minh đã hết hạn hoặc chưa được xác nhận. Vui lòng xác minh lại rồi thử lại.",
    checkFields: "Vui lòng kiểm tra các trường được đánh dấu.",
    notSaved: "Chưa lưu được yêu cầu của bạn. Nội dung bạn đã nhập vẫn còn nguyên, vui lòng thử lại.",
    noReceipt: "Chúng tôi chưa xác nhận được việc đã nhận yêu cầu. Nội dung bạn đã nhập vẫn còn nguyên. Vui lòng xác minh lại rồi thử lại; cùng một yêu cầu sẽ không bị lưu hai lần.",
    previewNotice: "Bản xem trước này không gửi yêu cầu đi. Biểu mẫu sẽ mở khi kênh liên hệ sẵn sàng.",
    name: "Họ và tên",
    email: "Email",
    company: "Công ty",
    optional: "(không bắt buộc)",
    service: "Dịch vụ quan tâm",
    serviceAny: "Chưa rõ, cần trao đổi thêm",
    message: "Bạn muốn cải thiện điều gì?",
    messagePlaceholder: "Hãy kể về bài toán, cách bạn đang làm hiện nay và điều bạn muốn thay đổi.",
    website: "Website",
    noteLead: "Chúng tôi dùng những thông tin này để xem xét và phản hồi yêu cầu của bạn. Mời bạn đọc",
    noteLink: "chính sách quyền riêng tư",
    noteTail: ". Vui lòng không gửi kèm thông tin mật.",
    sending: "Đang gửi…",
    send: "Gửi yêu cầu",
    noscript: "Biểu mẫu được bảo vệ này cần JavaScript. Vui lòng dùng email liên hệ bên dưới (nếu có).",
  },
  contactErrors: {
    submitted: "Vui lòng kiểm tra lại thông tin đã gửi.",
    reload: "Vui lòng tải lại biểu mẫu rồi thử lại.",
    name: "Vui lòng nhập từ 2 đến 100 ký tự.",
    email: "Vui lòng nhập địa chỉ email hợp lệ.",
    company: "Vui lòng nhập không quá 200 ký tự.",
    message: "Vui lòng nhập từ 20 đến 3.000 ký tự.",
    service: "Vui lòng chọn một dịch vụ trong danh sách hoặc để trống.",
    verification: "Vui lòng hoàn tất bước xác minh rồi thử lại.",
    rejected: "Không thể tiếp nhận yêu cầu này.",
  },
  hero: { afterFirst: ",", afterSecond: "", conjunction: "và" },
  cursor: { view: "Xem", drag: "Kéo", open: "Mở" },
  pricing: {
    toggleDeliverables: "Bàn giao",
    toggleOutcomes: "Kết quả",
    toggleLabel: "Hiện kết quả thay cho sản phẩm bàn giao ({label})",
    startHere: "Bắt đầu từ đây",
    stage: "Giai đoạn",
    engagement: "Hình thức hợp tác",
    focus: "Trọng tâm",
    columnDeliverables: "Sản phẩm bàn giao",
    columnOutcomes: "Kết quả",
    select: "Chọn",
    selected: "Đã chọn",
    chosenBefore: "Bạn đã chọn {short}. ",
    chosenLink: "Hãy chia sẻ bài toán của bạn",
    chosenAfter: " để bắt đầu.",
    discuss: "Trao đổi về dự án",
  },
  process: { output: "đầu ra", outputs: "đầu ra", step: "Bước {n}" },
  team: { roleOf: "Vai trò {i} trên {n}", swipe: "‹ vuốt ›", previous: "Vai trò trước", next: "Vai trò tiếp theo" },
  testimonials: { previous: "Trước", next: "Tiếp", reviews: "Nhận xét", show: "Xem {name}", sample: "Nội dung mẫu — không phải khách hàng thật" },
  labs: { writtenBy: "Tác giả", read: "Đọc bài viết", sample: "Nội dung mẫu — không phải bài viết thật" },
  analytics: { ticker: "Các năng lực" },
  rail: { label: "Trên trang này" },
  snapRow: { goTo: "Đến mục {n}" },
  cta: { discuss: "Trao đổi về dự án" },
  pageIntro: { back: "Trang chủ" },
  notFound: {
    title: "Không tìm thấy trang",
    eyebrow: "Không tìm thấy trang",
    headingBefore: "Hãy chọn một ",
    headingAccent: "hướng đi",
    headingAfter: " khác.",
    text: "Trang này hiện không có sẵn. Bạn có thể xem các dịch vụ của chúng tôi hoặc cho chúng tôi biết bạn muốn cải thiện điều gì.",
    explore: "Xem các dịch vụ",
    home: "Về trang chủ",
  },
  about: {
    title: "Giới thiệu",
    description: "spacegear.tech kết nối chiến lược chuyển đổi số và AI với việc trực tiếp triển khai, hiện thực hóa giải pháp một cách thiết thực và hỗ trợ đưa vào sử dụng.",
    eyebrow: "Về spacegear.tech",
    heading: "Ý tưởng tốt cần được biến thành những việc làm hữu ích.",
    lead: "Chúng tôi kết nối chiến lược kinh doanh, công nghệ và triển khai để giúp bạn tạo ra thay đổi có ý nghĩa trong cách công việc được thực hiện.",
    contextHeading: "Chúng tôi hiểu bối cảnh kinh doanh trước, rồi mới chọn công nghệ phục vụ đúng mục đích.",
    contextParagraphs: [
      "Chuyển đổi số bắt đầu từ một bài toán thực tế. Chúng tôi xem xét công việc, những người sử dụng hệ thống và các ràng buộc xung quanh, rồi chọn cách tiếp cận hợp lý.",
      "AI và học sâu là một phần trong bộ công cụ của chúng tôi, bên cạnh thiết kế quy trình, tích hợp hệ thống và kỹ thuật phần mềm được làm kỹ lưỡng. Mục tiêu là một giải pháp mà bạn có thể vận hành, hiểu rõ và cải tiến.",
    ],
    principlesLabel: "Nguyên tắc làm việc",
    principles: ["Hiểu rõ trước khi đề xuất", "Làm rõ các giả định để có thể kiểm chứng", "Thiết kế cho toàn bộ quy trình làm việc", "Giữ vai trò phán đoán của con người ở những khâu quan trọng", "Coi bàn giao là một phần của triển khai"],
    ctaTitle: "Chúng tôi làm việc cùng bạn từ quyết định đầu tiên đến những bước tiếp theo.",
    ctaText: "Chúng tôi đặt chiến lược và triển khai vào cùng một cuộc trao đổi.",
    ctaButton: "Xem cách chúng tôi làm việc",
  },
  approach: {
    title: "Phương pháp làm việc",
    description: "Đánh giá, xác định ưu tiên, kiểm chứng, triển khai và đưa vào sử dụng: đó là cách tiếp cận thiết thực của chúng tôi cho chuyển đổi số và triển khai AI, với các quyết định và bước bàn giao rõ ràng.",
    eyebrow: "Cách chúng tôi làm việc",
    heading: "Một lộ trình rõ ràng đưa mong muốn của bạn thành hiện thực.",
    lead: "Bạn nhận được những sản phẩm bàn giao hữu ích, các quyết định minh bạch và sự hiểu biết chung về bước tiếp theo. Mức độ chuyên sâu của từng giai đoạn tùy thuộc vào từng dự án hợp tác.",
    stepsHeading: "Một dự án hợp tác diễn ra như thế nào",
    ctaTitle: "Hãy bắt đầu từ bài toán bạn đang gặp phải.",
    ctaText: "Hãy chia sẻ tình hình hiện tại, chúng tôi sẽ gợi ý một điểm xuất phát hợp lý.",
  },
  contact: {
    title: "Trao đổi về dự án",
    description: "Hãy cho spacegear.tech biết bạn muốn cải thiện điều gì và bắt đầu trao đổi về chuyển đổi số, AI, tự động hóa hoặc phát triển phần mềm.",
    eyebrow: "Hãy bắt đầu trao đổi",
    heading: "Bạn muốn cải thiện điều gì?",
    lead: "Đó có thể là một bài toán, một ý tưởng hay một dự án đang triển khai. Hãy cho chúng tôi biết tình hình hiện tại và điều bạn muốn hiện thực hóa.",
    asideHeading: "Một bước tiếp theo hữu ích bắt đầu từ đây.",
    asideText: "Bạn không cần chuẩn bị sẵn bản mô tả hoàn chỉnh hay dữ liệu dùng được ngay. Hãy chia sẻ những gì bạn biết, rồi hai bên có thể cùng làm rõ các câu hỏi tiếp theo.",
    asideReply: "Chúng tôi sẽ xem xét thông tin bạn gửi và phản hồi về một bước tiếp theo phù hợp.",
  },
  privacy: {
    title: "Quyền riêng tư",
    description: "Trang này giải thích cách spacegear.tech xử lý thông tin bạn gửi qua website và cách liên hệ với chúng tôi về những thông tin đó.",
    eyebrow: "Thông tin website",
    heading: "Quyền riêng tư.",
    lead: "Trang này giải thích cách thông tin bạn gửi qua website được xử lý.",
    notice: "Đây là bản chính sách xem trước. Đơn vị vận hành phải xác nhận thông tin liên hệ, thời gian lưu giữ và cách xử lý dữ liệu trước khi ra mắt chính thức hoặc tiếp nhận yêu cầu thật.",
    contactHeading: "Câu hỏi hoặc yêu cầu",
    contactBefore: "Hãy liên hệ ",
    contactAfter: " về những thông tin bạn đã gửi, kể cả yêu cầu truy cập hoặc xóa thông tin.",
    contactPending: "Đầu mối liên hệ về quyền riêng tư đã được xác minh sẽ được cung cấp trước khi website bắt đầu tiếp nhận yêu cầu thật.",
  },
  terms: {
    title: "Điều khoản sử dụng website",
    description: "Đây là các điều khoản sử dụng website spacegear.tech. Phạm vi dịch vụ, giá cả, quyền sở hữu và các cam kết triển khai được thống nhất riêng.",
    eyebrow: "Thông tin website",
    heading: "Điều khoản sử dụng website.",
    lead: "Trang này cung cấp thông tin về việc sử dụng website và trao đổi về một dự án hợp tác.",
    notice: "Đây là bản điều khoản xem trước. Đơn vị vận hành phải phê duyệt điều khoản chính thức và các thông tin cần thiết về công ty trước khi ra mắt chính thức.",
    contactHeading: "Liên hệ",
    contactPending: "Địa chỉ liên hệ đã được xác minh sẽ có trước khi website ra mắt chính thức.",
  },
  services: {
    title: "Dịch vụ",
    description: "Tìm hiểu các dịch vụ chiến lược chuyển đổi số, tư vấn AI, AI ứng dụng và học sâu, tự động hóa, tích hợp hệ thống và phát triển sản phẩm số.",
    eyebrow: "Chiến lược & triển khai",
    heading: "Các dịch vụ linh hoạt giúp bạn hiện đại hóa vận hành và đưa AI vào công việc.",
    lead: "Năm năng lực — hoạch định, xây dựng, kết nối và cải tiến — có thể hoạt động riêng lẻ hoặc kết hợp, từ quyết định đầu tiên đến khi được sử dụng hằng ngày.",
    explore: "Tìm hiểu dịch vụ này",
    ctaTitle: "Chúng tôi hoạch định, xây dựng, kết nối và cải tiến.",
    ctaText: "Hãy xem các dịch vụ phối hợp với nhau như thế nào cho tổ chức của bạn.",
  },
  service: {
    problemHeading: "Hãy bắt đầu từ công việc bạn muốn cải thiện.",
    discuss: "Trao đổi về dự án",
    receive: "Những gì bạn nhận được",
    howTitle: "Cách thực hiện",
    howHeading: "Mỗi dự án đi từ buổi trao đổi đầu tiên đến một kết quả hữu ích.",
    howDescription: "Phạm vi, quyền truy cập, trách nhiệm và tiêu chí nghiệm thu được thống nhất trước khi triển khai.",
    faqTitle: "Hỏi đáp",
    faqHeading: "Dưới đây là một vài giải đáp hữu ích về dịch vụ này.",
    faqDescription: "Mọi câu hỏi khác, bạn cứ hỏi khi trao đổi với chúng tôi.",
    relatedTitle: "Dịch vụ liên quan",
    relatedHeading: "Các năng lực này thường được kết hợp cùng nhau.",
    relatedDescription: "Mỗi năng lực cũng có thể triển khai riêng.",
    ctaTitle: "Hãy cho chúng tôi biết bạn muốn cải thiện điều gì.",
    ctaText: "Hãy chia sẻ bài toán của bạn, chúng tôi sẽ gợi ý một bước đầu tiên hợp lý.",
  },
};
```

- [ ] **Step 6: Run the tests**

Run: `node --import tsx --test tests/i18n-dictionary.test.mjs && npm run typecheck`
Expected: PASS. To prove the type check, temporarily delete `view: "Xem",` from `vi.cursor` and run `npm run typecheck`. Expected: `error TS2741: Property 'view' is missing`. Then add a stray `extra: "x",` there instead. Expected: `TS2353 … Object literal may only specify known properties`. Restore the file.

- [ ] **Step 7: Fast gates and commit**

Run: `npm run lint` (and `npm test` once Task 1 is in). Expected: pass.

```bash
git add src/lib/i18n/en.ts src/lib/i18n/vi.ts src/lib/i18n/dictionary.ts tests/i18n-dictionary.test.mjs
git commit -m "feat(i18n): typed UI dictionary in English and Vietnamese

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Vietnamese claim patterns and the NAP-placement rule (M, ∥)

The patterns below were run, before writing this plan, against:
- all of `content/vi/**` and the UI draft (0 problems);
- 46 planted claims (all refused);
- 25 neutral Vietnamese phrases and the English ORDINARY list in `tests/content.test.mjs` (all accepted);
- 200 000-character pathological inputs (119 ms in all).

**Files:**
- Modify: `scripts/lib/honesty.mjs`
- Create: `tests/honesty-vi.test.mjs`

- [ ] **Step 1: Write the failing test** (`tests/honesty-vi.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { findForbidden, scanContentTree, scanFile } from "../scripts/lib/honesty.mjs";

const FAQ = "content/vi/faqs/x.json";
const refused = (text, where = FAQ) => findForbidden(text, where);

// One planted claim per family of the spec ("Honesty scan in Vietnamese"), each with the problem it must raise.
const PLANTS = {
  "a price": ["Gói dịch vụ chỉ 5.000.000 đồng.", "Chỉ 200.000đ mỗi giờ.", "Giá từ 15 triệu.", "Phí 2 tỷ cho cả dự án.", "10 triệu/tháng", "500 nghìn một tháng", "Chi phí chỉ từ 9 triệu", "Chỉ 50 VNĐ"],
  "a client or scale claim": ["Hơn 100 khách hàng tin dùng.", "Đã hoàn thành 250 dự án.", "50+ doanh nghiệp", "Đội ngũ 30 chuyên gia.", "hàng trăm doanh nghiệp", "hơn năm mươi khách hàng", "12 nhân sự"],
  "an experience claim": ["10 năm kinh nghiệm", "mười năm kinh nghiệm", "Thành lập năm 2015.", "Từ năm 2012, chúng tôi đồng hành cùng bạn.", "hàng thập kỷ", "5 năm hoạt động"],
  "an unverified partnership claim": ["Đối tác chính thức của Google.", "đối tác vàng", "là đối tác của Microsoft"],
  "an unverified rating or award": ["Đạt giải thưởng Sao Khuê.", "Top 10 công ty AI", "đơn vị số 1", "hàng đầu Việt Nam", "được đánh giá 4.9", "5 sao"],
  "an unverified certification": ["Chứng nhận ISO 27001.", "Chúng tôi được chứng nhận."],
  "an unverified press claim": ["Được báo chí đưa tin.", "xuất hiện trên VnExpress"],
  "an office location": ["Văn phòng tại Hà Nội.", "chi nhánh ở Đà Nẵng", "3 văn phòng", "Trụ sở chính tại TP. Hồ Chí Minh", "Chúng tôi có văn phòng riêng."],
  "a delivery timeline": ["Bàn giao trong 14 ngày.", "Triển khai chỉ trong hai tuần.", "trong vòng 30 ngày", "4-6 tuần", "dưới 3 tháng"],
  "a result figure": ["Tăng 30% doanh thu.", "giảm chi phí đến 45%", "gấp 3 lần", "nhanh hơn 5 lần", "10 lần nhanh hơn"],
};
const NEUTRAL = [
  "hợp đồng", "đồng ý", "đồng thời", "đồng hành cùng bạn", "Vui lòng nhập từ 2 đến 100 ký tự.", "Vui lòng nhập không quá 200 ký tự.",
  "Vui lòng nhập từ 20 đến 3.000 ký tự.", "Năm năng lực — hoạch định, xây dựng, kết nối và cải tiến", "một dự án hợp tác", "các dự án",
  "mỗi dự án", "Bước 1", "Vai trò 1 trên 5", "© 2026 spacegear.tech", "không hàm ý quan hệ đối tác", "Chúng tôi chọn công cụ của đối tác phù hợp.",
  "tiêu chí nghiệm thu", "trong từng giai đoạn", "trong năm nay", "82 Mức độ sẵn sàng", "62 Xử lý tự động", "12 phút → 2 phút",
  "Đây là ví dụ minh họa", "triển khai AI vào quy trình", "tăng tốc quy trình", "giảm thao tác thủ công",
  // English copy the Vietnamese rules must not catch.
  "Top 10 risks", "Step 1", "Phase 2 of 3", "24/7 support", "Our #1 rule", "Plan for 2027", "under 16", "Version 2.0",
];

test("every Vietnamese claim family is refused, with its own problem", () => {
  for (const [what, texts] of Object.entries(PLANTS)) {
    for (const text of texts) assert.ok(refused(text).some((problem) => problem.startsWith(what)), `${text} → ${what} (got ${JSON.stringify(refused(text))})`);
  }
});

test("ordinary Vietnamese and English copy passes", () => {
  for (const text of NEUTRAL) assert.deepEqual(refused(text), [], text);
});

test("the legal pages may state periods in Vietnamese too, but never a delivery promise", () => {
  assert.deepEqual(refused("Các yêu cầu đã đóng được lưu giữ tối đa 90 ngày.", "content/vi/legal/privacy.md"), []);
  assert.deepEqual(refused("Website này không hàm ý quan hệ đối tác.", "content/vi/legal/terms.md"), []);
  assert.ok(refused("Bàn giao trong 14 ngày.", "content/vi/legal/terms.md").some((problem) => problem.startsWith("a delivery timeline")));
  assert.ok(refused("Các yêu cầu được lưu giữ tối đa 90 ngày.").some((problem) => problem.startsWith("a delivery timeline")), "outside the legal pages a period is refused");
});

test("the owner's contact details may appear only in Site identity", () => {
  const site = JSON.stringify({ name: "spacegear.tech", description: "x", socialProfiles: [], address: { full: "11 B4 Street, Sala Urban Area, An Khanh Ward, Ho Chi Minh City, Vietnam", street: "11 B4 Street, Sala Urban Area, An Khanh Ward", locality: "Ho Chi Minh City" }, telephone: "+84386749799" });
  assert.deepEqual(scanFile("content/site.json", site), []);
  const viSite = JSON.stringify({ name: "spacegear.tech", description: "x", socialProfiles: [], address: { full: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh, TP. Hồ Chí Minh, Việt Nam", street: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh", locality: "Thành phố Hồ Chí Minh" }, telephone: "+84386749799" });
  assert.deepEqual(scanFile("content/vi/site.json", viSite), []);
  for (const text of ["Gọi 0386 749 799 để được tư vấn.", "Call +84 386 749 799", "Visit us at 11 B4 Street", "Ghé thăm chúng tôi tại đường B4, Khu đô thị Sala."]) {
    assert.ok(refused(text).some((problem) => problem.startsWith("the owner's contact details")), text);
  }
  assert.ok(scanFile("content/site.json", JSON.stringify({ description: "Call 0386 749 799" })).some((problem) => problem.startsWith("description: the owner's contact details")), "Site identity's other fields may not hold them either");
});

test("the Vietnamese patterns stay linear on long pathological input", () => {
  const n = 200_000;
  const inputs = ["1 ".repeat(n / 2), "năm ".repeat(n / 4), `${"1".repeat(n)}x`, "giá ".repeat(n / 4), `${"tăng ".repeat(n / 5)}5%`, `bàn giao ${"a ".repeat(n / 2)}`, "đối tác ".repeat(n / 8)];
  const start = performance.now();
  for (const text of inputs) refused(text);
  assert.ok(performance.now() - start < 3000);
});

test("the committed content still passes", () => {
  assert.deepEqual(scanContentTree("."), []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test tests/honesty-vi.test.mjs`
Expected: FAIL in the plant, legal (outside the legal pages) and contact-details tests. The neutral, timing and committed-content tests already pass.

- [ ] **Step 3: Add the Vietnamese rules to `scripts/lib/honesty.mjs`**

After `const VENDORS = …;` add:

```js
// Vietnamese. \b only knows ASCII letters, so words are bounded with Unicode lookarounds (L before, R after), and a
// number may not continue a word or another number (NUM). Spelled numbers and the nouns a count would claim:
const L = String.raw`(?<![\p{L}\p{N}_])`;
const R = String.raw`(?![\p{L}\p{N}_])`;
const NUM = String.raw`(?<![\p{L}\p{N}_.,])\d[\d.,]{0,15}`;
const VI_SPELLED = "một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|mươi|trăm|nghìn|ngàn|chục";
const VI_COUNTED = "khách hàng|dự án|doanh nghiệp|công ty|tổ chức|nhân sự|nhân viên|chuyên gia|kỹ sư|lập trình viên|đối tác|thương hiệu|quốc gia|người dùng";
const VI_PRESS = "VnExpress|Tuổi Trẻ|Thanh Niên|CafeF|CafeBiz|VTV|VietnamNet|Dân Trí|Zing|Forbes Việt Nam|Người Lao Động";
const vi = (source) => new RegExp(source, "iu");
// The owner's contact details (bilingual spec, decision 4) are facts that only Site identity holds.
const NAP_FIELD = (where, field) => /^content\/(?:vi\/)?site\.json$/.test(where) && /^(?:address\.(?:full|street|locality)|telephone)$/.test(field);
```

Replace the "đồng" rule that Task 1 added (`[/(?<![\p{L}\p{N}_.,])\d[\d.,]{0,15}\s{0,3}(?:đồng|đ|vnđ)…/iu, "a price"],`) with the first rule below, which includes it. Then append all the other rules at the end of `FORBIDDEN`, before its closing `];`:

```js
  // Vietnamese prices and rates ("5.000.000 đồng", "15 triệu", "10 triệu/tháng", "giá từ 9…"). "đồng" alone is a word (hợp đồng, đồng ý).
  [vi(String.raw`${NUM}\s{0,3}(?:đồng|đ|vnđ|vnd|nghìn|ngàn|triệu|tr|tỷ)${R}`), "a price"],
  [vi(String.raw`${NUM}\s{0,3}(?:\/|mỗi|một|cho mỗi|trên mỗi)\s{0,3}(?:tháng|năm|quý|giờ|ngày|tuần|dự án|người dùng|người|tài khoản|lượt)${R}`), "a price"],
  [vi(String.raw`${L}(?:giá|chi phí|phí|mức phí|báo giá|ngân sách)\s{1,3}(?:(?:dịch vụ|gói|trọn gói)\s{1,3})?(?:chỉ\s{1,3})?(?:từ|chỉ|khoảng|dưới|trên|:)\s{0,3}\d`), "a price"],
  // Counts of khách hàng, dự án, doanh nghiệp, nhân sự, chuyên gia…, also "hàng trăm" and spelled numbers.
  [vi(String.raw`${NUM}\s{0,3}\+?\s{0,3}(?:${VI_COUNTED})${R}|${L}(?:hàng|vài|hơn|trên)\s{1,3}(?:chục|trăm|nghìn|ngàn|triệu)\s{1,3}(?:${VI_COUNTED})${R}|${L}(?:hơn|trên)\s{1,3}(?:${VI_SPELLED})(?:\s{1,3}(?:${VI_SPELLED})){0,3}\s{1,3}(?:${VI_COUNTED})${R}`), "a client or scale claim"],
  // Năm kinh nghiệm, founding years and decades are refused everywhere; "N năm" periods are allowed on the legal pages.
  [vi(String.raw`${NUM}\s{0,3}\+?\s{0,3}năm\s{1,3}kinh\s{1,3}nghiệm|${L}(?:${VI_SPELLED})(?:\s{1,3}(?:${VI_SPELLED})){0,3}\s{1,3}năm\s{1,3}kinh\s{1,3}nghiệm|${L}(?:thành\s{1,3}lập|ra\s{1,3}đời)\s{1,3}(?:(?:từ|vào)\s{1,3})?(?:năm\s{1,3})?(?:19|20)\d{2}${R}|${L}(?:kể\s{1,3})?từ\s{1,3}năm\s{1,3}(?:19|20)\d{2}${R}|${L}thập\s{1,3}(?:kỷ|niên)${R}`), "an experience claim"],
  [vi(String.raw`${NUM}\s{0,3}\+?\s{0,3}năm${R}`), "an experience claim", { skip: LEGAL }],
  // Đối tác, giải thưởng, chứng nhận, báo chí. "Không hàm ý quan hệ đối tác" (the terms) and "công cụ của đối tác" are not claims.
  [vi(String.raw`${L}đối\s{1,3}tác\s{1,3}(?:chính\s{1,3}thức|chiến\s{1,3}lược|vàng|bạc|bạch\s{1,3}kim|kim\s{1,3}cương|cấp\s{1,3}cao|được\s{1,3}chứng\s{1,3}nhận|ưu\s{1,3}tiên|hàng\s{1,3}đầu|độc\s{1,3}quyền)${R}|${L}đối\s{1,3}tác\s{1,3}(?:của|với)\s{1,3}(?:${VENDORS})${R}|${L}(?:${VENDORS})\s{1,3}(?:chứng\s{1,3}nhận|công\s{1,3}nhận|ủy\s{1,3}quyền)${R}`), "an unverified partnership claim"],
  [vi(String.raw`${L}(?:giải\s{1,3}thưởng|đạt\s{1,3}giải|đoạt\s{1,3}giải|được\s{1,3}vinh\s{1,3}danh|top\s{1,3}\d{1,3}\s{1,3}(?:công\s{1,3}ty|doanh\s{1,3}nghiệp|đơn\s{1,3}vị|nhà\s{1,3}cung\s{1,3}cấp|agency|thương\s{1,3}hiệu)|(?:đơn\s{1,3}vị|công\s{1,3}ty|doanh\s{1,3}nghiệp|nhà\s{1,3}cung\s{1,3}cấp|agency|thương\s{1,3}hiệu)\s{1,3}số\s{1,3}1|số\s{1,3}1\s{1,3}(?:Việt\s{1,3}Nam|thị\s{1,3}trường|khu\s{1,3}vực|châu\s{1,3}Á|thế\s{1,3}giới|về)|hàng\s{1,3}đầu\s{1,3}(?:Việt\s{1,3}Nam|thị\s{1,3}trường|khu\s{1,3}vực|châu\s{1,3}Á|thế\s{1,3}giới)|được\s{1,3}(?:đánh\s{1,3}giá|xếp\s{1,3}hạng)\s{1,3}\d|${NUM}\s{0,3}sao)${R}`), "an unverified rating or award"],
  [vi(String.raw`${L}(?:chứng\s{1,3}nhận|chứng\s{1,3}chỉ|đạt\s{1,3}chuẩn|tiêu\s{1,3}chuẩn)\s{1,3}(?:ISO|SOC)${R}|${L}được\s{1,3}chứng\s{1,3}nhận${R}`), "an unverified certification"],
  [vi(String.raw`${L}(?:báo\s{1,3}chí|truyền\s{1,3}thông\s{1,3}(?:đưa\s{1,3}tin|nói\s{1,3}về)|lên\s{1,3}báo|xuất\s{1,3}hiện\s{1,3}trên\s{1,3}(?:báo|truyền\s{1,3}hình|VTV)|${VI_PRESS})${R}`), "an unverified press claim", { skip: LEGAL }],
  // Văn phòng, chi nhánh, trụ sở.
  [vi(String.raw`${L}(?:văn\s{1,3}phòng|chi\s{1,3}nhánh|trụ\s{1,3}sở)(?:\s{1,3}(?:chính|đại\s{1,3}diện|giao\s{1,3}dịch))?\s{1,3}(?:tại|ở|đặt\s{1,3}tại)${R}|${L}(?:các|nhiều|hệ\s{1,3}thống)\s{1,3}(?:văn\s{1,3}phòng|chi\s{1,3}nhánh)${R}|${NUM}\s{0,3}(?:văn\s{1,3}phòng|chi\s{1,3}nhánh)${R}|${L}có\s{1,3}(?:văn\s{1,3}phòng|chi\s{1,3}nhánh|trụ\s{1,3}sở)${R}`), "an office location"],
  // Delivery timelines: a promise to deliver is refused everywhere; other periods ("tối đa 90 ngày") only off the legal pages.
  [vi(String.raw`${L}(?:bàn\s{1,3}giao|triển\s{1,3}khai|hoàn\s{1,3}thành|hoàn\s{1,3}tất|ra\s{1,3}mắt|vận\s{1,3}hành|go\s{1,3}live|giao|xây\s{1,3}dựng\s{1,3}xong|làm\s{1,3}xong)${R}[^.!?\n]{0,40}?${L}(?:trong|chỉ\s{1,3}trong|trong\s{1,3}vòng|dưới|chưa\s{1,3}đến|không\s{1,3}quá)\s{1,3}(?:chỉ\s{1,3})?(?:\d{1,3}|${VI_SPELLED})(?:\s{1,3}(?:${VI_SPELLED}))?\s{0,3}(?:giờ|ngày|tuần|tháng)${R}`), "a delivery timeline"],
  [vi(String.raw`${L}(?:trong|chỉ\s{1,3}trong|trong\s{1,3}vòng|dưới|chưa\s{1,3}đến|không\s{1,3}quá|tối\s{1,3}đa)\s{1,3}(?:chỉ\s{1,3})?\d{1,3}\s{0,3}(?:giờ|ngày|tuần|tháng)${R}|${NUM}\s{0,3}(?:-|–|đến|tới)\s{0,3}\d{1,3}\s{0,3}(?:ngày|tuần|tháng)${R}`), "a delivery timeline", { skip: LEGAL }],
  // Results with figures: tăng/giảm N%, gấp N lần, nhanh hơn N lần.
  [vi(String.raw`${L}gấp\s{1,3}(?:\d{1,3}(?:[.,]\d)?|${VI_SPELLED})\s{1,3}lần${R}|${NUM}\s{0,3}lần\s{1,3}(?:nhanh|hiệu\s{1,3}quả|rẻ|tốt|cao|nhiều)|${L}(?:nhanh|hiệu\s{1,3}quả|rẻ|tốt|cao|nhiều)\s{1,3}hơn\s{1,3}(?:\d{1,3}(?:[.,]\d)?|${VI_SPELLED})\s{1,3}lần${R}|${L}(?:tăng|giảm|cải\s{1,3}thiện|tiết\s{1,3}kiệm|rút\s{1,3}ngắn|nâng|cắt\s{1,3}giảm)\s{1,3}(?:\p{L}{1,10}\s{1,3}){0,3}?(?:đến\s{1,3}|tới\s{1,3}|hơn\s{1,3}|thêm\s{1,3}|khoảng\s{1,3})?\d[\d.,]{0,6}\s{0,3}(?:%|phần\s{1,3}trăm)`), "a result figure", { skip: MEASURE_FIGURE }],
  // The owner's phone number and street address, in either language, outside Site identity's address and telephone fields.
  [/(?<!\p{N})(?:\+\s?84|0)\s?386\s?749\s?799(?!\p{N})|\bB4\s{1,3}Street\b|đường\s{1,3}B4(?![\p{L}\p{N}])|\bSala\s{1,3}Urban\s{1,3}Area\b|Khu\s{1,3}đô\s{1,3}thị\s{1,3}Sala(?!\p{L})/iu, "the owner's contact details outside Site identity (content/site.json: address and telephone)", { skip: NAP_FIELD }],
```

Update the header comment's scope list with: "the owner's contact details (phone, street address) only in Site identity's `address` and `telephone` fields (content/site.json, content/vi/site.json)". Also remove the "Known gaps: Vietnamese claim phrasing…" clause Task 1 added.

- [ ] **Step 4: Run the tests**

Run: `node --import tsx --test tests/honesty-vi.test.mjs tests/honesty-locale.test.mjs tests/content.test.mjs`
Expected: PASS, including the existing English CLAIMS/ORDINARY lists and both timing tests.

If Task 6 has landed, also run `node --import tsx --test tests/i18n-dictionary.test.mjs`. Expected: PASS (the draft's 190 strings were checked against these rules).

- [ ] **Step 5: Fast gates, content check, commit**

Run: `npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs`
Expected: pass; `Content valid: 12 routes; preview mode.`

```bash
git add scripts/lib/honesty.mjs tests/honesty-vi.test.mjs
git commit -m "feat(honesty): Vietnamese claim patterns and the owner's contact details only in Site identity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Content per locale, parity check, wider hero limits (L, ∥)

**Files:**
- Modify:
  - `src/lib/content.ts`;
  - `src/lib/content-model.ts` (lines 87, 204–245, 268–318);
  - `src/lib/content-index.generated.ts` (regenerated);
  - `scripts/build-content-index.mjs`;
  - `scripts/check-content.mjs`;
  - `scripts/lib/content-rules.mjs` (`illustrativeProblems`, `contentRuleProblems`);
  - `src/lib/legal.ts`, `src/components/legal-sections.ts`;
  - `tests/helpers/content.mjs`;
  - `public/admin/config.yml` (two `maxlength` values).
- Create: `src/lib/content-parity.ts`, `scripts/lib/content-input.mjs`, `tests/content-locale.test.mjs`

- [ ] **Step 1: Write the failing test** (`tests/content-locale.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readContentInput, readLocaleFiles } from "../scripts/lib/content-input.mjs";
import { renderIndex } from "../scripts/build-content-index.mjs";

const { getContent, serviceFor, HOME, SERVICES, CONTENT_DIRS } = await import("../src/lib/content.ts");
const { buildContent, contentSchemas } = await import("../src/lib/content-model.ts");
const { contentParityProblems } = await import("../src/lib/content-parity.ts");
const { legalSections } = await import("../src/lib/legal.ts");

test("getContent('en') is the English exports; getContent('vi') has the same names, shapes and links", () => {
  assert.equal(getContent("en").HOME, HOME);
  assert.equal(getContent("en").SERVICES, SERVICES);
  const vi = getContent("vi");
  assert.deepEqual(Object.keys(vi), Object.keys(getContent("en")));
  assert.deepEqual(vi.SERVICES.map((service) => service.slug), SERVICES.map((service) => service.slug));
  assert.notEqual(vi.HOME.headline.lead, HOME.headline.lead, "the Vietnamese copy is loaded");
  assert.equal(vi.HOME.cta.href, HOME.cta.href, "links stay site paths; pages localize them");
  assert.equal(serviceFor("vi", "applied-ai").slug, "applied-ai");
  assert.deepEqual(CONTENT_DIRS, { en: "content", vi: "content/vi" });
});

test("the hero takes the Vietnamese verbs and tail (limits 12 and 32)", () => {
  const { home } = contentSchemas([]).singletons;
  assert.equal(home.meta.shape.headline.meta.shape.verbs.meta.item.meta.max, 12);
  assert.equal(home.meta.shape.headline.meta.shape.tail.meta.max, 32);
});

test("a Vietnamese problem names its file under content/vi/", () => {
  const input = readContentInput(".", "content/vi");
  input.home.headline.tail = "x".repeat(40);
  input.collections.faqs[0].data.order = input.collections.faqs[1].data.order;
  assert.throws(() => buildContent(input, "content/vi"), (error) => {
    assert.ok(error.issues.includes("content/vi/home.json: headline.tail: 40 characters, the limit is 32"), error.issues.join("\n"));
    assert.ok(error.issues.some((issue) => issue.startsWith(`content/vi/faqs/${input.collections.faqs[1].file}: order`)), error.issues.join("\n"));
    return true;
  });
});

test("the committed Vietnamese copy mirrors the English one", () => {
  assert.deepEqual(contentParityProblems(readLocaleFiles(".", "content"), readLocaleFiles(".", "content/vi")), []);
  for (const page of ["privacy", "terms"]) assert.equal(legalSections(page, ".", "vi").length, legalSections(page, ".", "en").length, page);
});

test("parity refuses a changed link, image, number, flag or figure, a different list length, and a missing or extra entry", () => {
  const en = readLocaleFiles(".", "content");
  const vi = structuredClone(readLocaleFiles(".", "content/vi"));
  vi.home.cta.href = "/vi/contact/";
  vi.faqCard.img = "/images/galaxy.webp";
  vi.measure.workflow.segments[0].value = 61;
  vi.home.stats[0].value = "06";
  vi.measure.workflow.center = "61%";
  vi.process.steps[0].outputs.pop();
  vi.collections.faqs.pop();
  vi.collections.faqs.push({ file: "zz-extra.json", data: {} });
  const problems = contentParityProblems(en, vi);
  for (const expected of [
    'content/vi/home.json: cta.href is "/vi/contact/", but it must stay "/contact/" as in content/home.json (links are the same in both languages)',
    "content/vi/faq-card.json: img is",
    "content/vi/measure.json: workflow.segments[0].value is 61",
    'content/vi/home.json: stats[0].value is "06", but it must stay "05"',
    'content/vi/measure.json: workflow.center is "61%"',
    "content/vi/process.json: steps[0].outputs has",
    "missing; every English entry needs its Vietnamese version",
    "content/vi/faqs/zz-extra.json: has no English entry",
  ]) assert.ok(problems.some((problem) => problem.startsWith(expected) || problem.includes(expected)), `${expected}\n${problems.join("\n")}`);
});

test("the entry index lists both languages", () => {
  const index = renderIndex(".");
  assert.match(index, /import vi_services_0 from "\.\.\/\.\.\/content\/vi\/services\/ai-strategy\.json" with \{ type: "json" \};/);
  assert.match(index, /export const COLLECTION_FILES_VI: Record<CollectionName, CollectionFile\[\]> = \{/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test tests/content-locale.test.mjs`
Expected: FAIL, `Cannot find module …/scripts/lib/content-input.mjs`.

- [ ] **Step 3: Create `scripts/lib/content-input.mjs`** (moved out of `tests/helpers/content.mjs`, so `check-content` can use it too)

```js
// Reads one language's content files into the shape buildContent() takes, plus <dir>/site.json, for
// scripts/check-content.mjs and the tests. `dir` is "content" (English) or "content/vi" (Vietnamese).
// Loaded under --experimental-strip-types or tsx (it imports the TypeScript content model).
import fs from "node:fs";
import path from "node:path";
import { COLLECTIONS, listEntries } from "../build-content-index.mjs";

const { SINGLETON_FILES } = await import("../../src/lib/content-model.ts");

/** Reads one JSON file. A syntax error names the file, so a broken save is easy to find. */
export function readJson(file) {
  const source = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new SyntaxError(`${file}: ${error.message}`, { cause: error });
  }
}

export function readContentInput(root = ".", dir = "content") {
  const input = Object.fromEntries(Object.entries(SINGLETON_FILES).map(([name, file]) => [name, readJson(path.join(root, file.replace(/^content\//, `${dir}/`)))]));
  input.collections = Object.fromEntries(COLLECTIONS.map((collection) => [
    collection,
    listEntries(root, collection, dir).map((file) => ({ file, data: readJson(path.join(root, dir, collection, file)) })),
  ]));
  return input;
}

/** readContentInput plus the language's Site identity file. */
export function readLocaleFiles(root = ".", dir = "content") {
  return { ...readContentInput(root, dir), site: readJson(path.join(root, dir, "site.json")) };
}
```

In `tests/helpers/content.mjs`:
- Delete its `readJson` and `readContentInput` functions, and the `SINGLETON_FILES` import.
- Delete the `listEntries` import as well, if nothing else uses it.
- Add:

```js
import { readContentInput } from "../../scripts/lib/content-input.mjs";
export { readJson, readContentInput } from "../../scripts/lib/content-input.mjs";
```

Keep `SAMPLE_ROOT`, `sampleInput` and `copySampleContent` as they are.

- [ ] **Step 4: Index both languages** (`scripts/build-content-index.mjs`)

Give `listEntries` a `dir` parameter. The changed lines are the signature, the folder and the message:

```js
export function listEntries(root, collection, dir = "content") {
  const folder = path.join(root, dir, collection);
  if (!fs.existsSync(folder)) return [];
  const names = fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => entry.name);
  const bad = names.filter((name) => !ENTRY_NAME.test(name));
  if (bad.length) throw new EntryNameError(`Rename ${bad.map((name) => `${dir}/${collection}/${name}`).join(", ")}: entry file names use lowercase letters, digits, - and _ only.`);
  return names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The two languages' collections in the index: English as COLLECTION_FILES (as before), Vietnamese as COLLECTION_FILES_VI. */
const INDEXED = [
  { dir: "content", prefix: "", name: "COLLECTION_FILES" },
  { dir: "content/vi", prefix: "vi_", name: "COLLECTION_FILES_VI" },
];

export function renderIndex(root = ROOT) {
  const imports = [];
  const exports = [];
  for (const { dir, prefix, name } of INDEXED) {
    const groups = [];
    for (const collection of COLLECTIONS) {
      const id = `${prefix}${collection.replaceAll("-", "_")}`;
      const rows = listEntries(root, collection, dir).map((file, index) => {
        imports.push(`import ${id}_${index} from "../../${dir}/${collection}/${file}" with { type: "json" };`);
        return `    { file: ${JSON.stringify(file)}, data: ${id}_${index} },`;
      });
      groups.push(rows.length ? `  ${JSON.stringify(collection)}: [\n${rows.join("\n")}\n  ],` : `  ${JSON.stringify(collection)}: [],`);
    }
    exports.push("", `export const ${name}: Record<CollectionName, CollectionFile[]> = {`, ...groups, "};");
  }
  return [
    "// Generated by scripts/build-content-index.mjs. Do not edit by hand.",
    "// Lists every entry of the content/ and content/vi/ folder collections so that src/lib/content.ts can",
    "// import them statically. Run `npm run content:index` after adding, renaming or removing an entry.",
    'import type { CollectionFile, CollectionName } from "./content-model.ts";',
    ...imports,
    ...exports,
    "",
  ].join("\n");
}
```

Run: `npm run content:index`
Expected: `Wrote src/lib/content-index.generated.ts.`; the file now ends with `COLLECTION_FILES_VI`.

- [ ] **Step 5: Name the language's folder in `buildContent`'s problems; widen the hero** (`src/lib/content-model.ts`)

Line 87 (the `headline` object):

```ts
        headline: object({ lead: text({ max: 30 }), verbs: list(text({ max: 12 }), { min: 3, max: 3 }), tail: text({ max: 32 }) }),
```

Then thread a `dir` through the helpers:
- `loadCollection(files, name, entrySchema, issues, dir)` uses `` `${dir}/${name}/${file}` `` in its `check` call and its order message.
- `uniqueField(loaded, name, fields, issues, dir)` uses `` `${dir}/${name}/${file}` `` in both messages.
- `oneFeatured(engagements, files, issues, dir)` uses `` `${dir}/engagements` `` and `` `${dir}/engagements/${file}` ``.

In `buildContent`:

```ts
/** Validates all content and derives the exported values. Throws one ContentError listing every problem, each
 *  named by its file under `dir` ("content" for English, "content/vi" for Vietnamese). */
export function buildContent(input: ContentInput, dir = "content") {
  const issues: string[] = [];
  const fileOf = (name: SingletonName) => SINGLETON_FILES[name].replace(/^content\//, `${dir}/`);
  const services = loadCollection(input.collections.services, "services", contentSchemas([]).collections.services, issues, dir);
```

and replace every remaining `SINGLETON_FILES.<name>` in `buildContent` with `fileOf("<name>")` (the 11 `check(...)` calls and the final `uniqueItems(work.tiles, …)`). Replace `` `content/services/${file}` `` and `` `content/engagements/${file}` `` with `` `${dir}/services/${file}` `` and `` `${dir}/engagements/${file}` ``. Pass `dir` to every `loadCollection`, `uniqueField` and `oneFeatured` call.

- [ ] **Step 6: Load both languages** (`src/lib/content.ts`, whole file)

```ts
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

export type { Article, Engagement, FooterLink, Person, Pillar, ProcessStep, SectionCopy, Service, Stat, Testimonial, WorkTile } from "./content-model.ts";
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
export const ARTICLES = content.ARTICLES;
export const FOOTER = content.FOOTER;
```

- [ ] **Step 7: Create `src/lib/content-parity.ts`**

```ts
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
```

- [ ] **Step 8: Legal pages per locale**

`src/lib/legal.ts`: keep the argument order (callers pass `root` second) and add the language last:

```ts
import type { Locale } from "./i18n/locales.ts";
…
/** One legal page's sections, from content/legal/<page>.md (English) or content/vi/legal/<page>.md (Vietnamese). */
export function legalSections(page: LegalPage, root: string = process.cwd(), locale: Locale = "en"): LegalSection[] {
  const file = `${locale === "vi" ? "content/vi" : "content"}/legal/${page}.md`;
  return parseLegalMarkdown(fs.readFileSync(path.join(root, file), "utf8"), file);
}
```

`src/components/legal-sections.ts`:

```ts
import type { Locale } from "@/lib/i18n/locales";
export function legalSectionElements(page: LegalPage, locale: Locale = "en"): ReactElement[] {
  return legalSections(page, undefined, locale).map(({ heading, paragraphs }) =>
```

(the rest unchanged).

- [ ] **Step 9: Rules in Vietnamese** (`scripts/lib/content-rules.mjs`)

Replace `illustrativeProblems` and `contentRuleProblems`:

```js
/** The words that label the sample dashboard, per language (Vietnamese writes "minh họa" with either tone placement). */
const ILLUSTRATIVE = {
  en: { section: [/illustrative/i, /not client results/i], sectionWords: '"illustrative" and "not client results"', card: /illustrative|example|sample/i, cardWords: "illustrative, an example or a sample", footer: /illustrative/i, footerWord: '"illustrative"' },
  vi: { section: [/minh h(?:ọa|oạ)/iu, /không phải kết quả của khách hàng/iu], sectionWords: '"minh họa" and "không phải kết quả của khách hàng"', card: /minh h(?:ọa|oạ)|ví dụ|mẫu/iu, cardWords: '"minh họa", "ví dụ" or "mẫu"', footer: /minh h(?:ọa|oạ)/iu, footerWord: '"minh họa"' },
};

/**
 * The sample dashboard shows made-up figures, so its section and each of its cards must say so: the
 * section description says "illustrative" and "not client results", each card names itself an
 * illustrative figure, an example or a sample, and the stages footer says "illustrative" (in Vietnamese:
 * "minh họa", "không phải kết quả của khách hàng", "ví dụ", "mẫu").
 */
export function illustrativeProblems({ SECTIONS, MEASURE }, locale = "en") {
  const words = ILLUSTRATIVE[locale];
  const problems = [];
  const description = SECTIONS.analytics.description;
  if (!words.section.every((pattern) => pattern.test(description))) {
    problems.push(`content/sections.json: analytics.description must say that the figures are illustrative and not client results (both words ${words.sectionWords}), because the dashboard shows sample data`);
  }
  for (const card of ["workflow", "accuracy", "throughput", "readiness", "coverage"]) {
    if (!words.card.test(JSON.stringify(MEASURE[card]))) problems.push(`content/measure.json: ${card} must call itself ${words.cardWords} in one of its texts`);
  }
  if (!words.footer.test(MEASURE.stagesFooter)) problems.push(`content/measure.json: stagesFooter must say ${words.footerWord}`);
  return problems;
}
```

```js
/** Every rule above, in the order check-content prints them. A Vietnamese problem names its file under content/vi/. */
export function contentRuleProblems(content, routes, { locale = "en" } = {}) {
  const problems = [
    ...stageNumberProblems(content.ENGAGEMENTS),
    ...countProblems(content),
    ...teamProblems(content),
    ...illustrativeProblems(content, locale),
    ...stockImageProblems(content),
    ...linkProblems(content, routes),
  ];
  return locale === "en" ? problems : problems.map((problem) => problem.replace(/^content\//, "content/vi/"));
}
```

(For English the messages are unchanged, so `tests/content-rules.test.mjs` keeps passing.)

- [ ] **Step 10: `scripts/check-content.mjs`: Vietnamese, parity and the legal translations**

Add imports:

```js
import { contentParityProblems } from "../src/lib/content-parity.ts";
import { readLocaleFiles } from "./lib/content-input.mjs";
```

Replace lines 72–74 (content, site, legal) with:

```js
const content = await attempt(() => import("../src/lib/content.ts"));
// Building the Vietnamese copy validates content/vi/ the same way (problems name content/vi/ files).
const vietnamese = content ? await attempt(() => content.getContent("vi")) : undefined;
await attempt(() => parseContent(siteSchema, readJson("content/site.json"), "content/site.json"));
await attempt(() => parseContent(siteSchema, readJson("content/vi/site.json"), "content/vi/site.json"));
for (const page of LEGAL_PAGES) {
  const english = await attempt(() => legalSections(page, ROOT, "en"));
  const translated = await attempt(() => legalSections(page, ROOT, "vi"));
  if (english && translated && english.length !== translated.length) errors.push(`content/vi/legal/${page}.md has ${translated.length} sections, but content/legal/${page}.md has ${english.length}: translate every section`);
}
// content/vi/ mirrors content/: the same files and entries, and only text may differ (src/lib/content-parity.ts).
await attempt(() => { errors.push(...contentParityProblems(readLocaleFiles(ROOT, "content"), readLocaleFiles(ROOT, "content/vi"))); });
```

and inside `if (content) { … }`, after the English honesty scan line, add:

```js
  if (vietnamese) {
    errors.push(...contentRuleProblems(vietnamese, routes, { locale: "vi" }));
    for (const problem of scanExports(vietnamese)) errors.push(`forbidden claim in Vietnamese export ${problem}`);
  }
```

- [ ] **Step 11: Widen the two CMS limits** (`public/admin/config.yml`, so `tests/cms-config.test.mjs` still mirrors the schema)

In the `home` file's `headline`:
- `field: { name: verb, label: Verb, widget: string, maxlength: 6, use_emoji_autocomplete: false }`: change `maxlength: 6` to `maxlength: 12`.
- `{ name: tail, label: Tail, widget: string, maxlength: 24, use_emoji_autocomplete: false }`: change `maxlength: 24` to `maxlength: 32`.
- In the `verbs` list label, write `Verbs (three short words or phrases)`.

- [ ] **Step 12: Run the tests**

Run: `node --import tsx --test tests/content-locale.test.mjs tests/content-index.test.mjs tests/content-loader.test.mjs tests/content-rules.test.mjs tests/cms-config.test.mjs tests/legal.test.mjs tests/content.test.mjs`
Expected: PASS.

- [ ] **Step 13: Fast gates and the content check**

Run: `npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs`
Expected: all pass; `Content valid: 12 routes; preview mode.`

Then plant a problem to see the Vietnamese message: set `content/vi/home.json` `cta.href` to `"/vi/contact/"`. Run `node --experimental-strip-types scripts/check-content.mjs`. Expected: exit 1 and `content/vi/home.json: cta.href is "/vi/contact/", but it must stay "/contact/" as in content/home.json (links are the same in both languages)`. Restore the file with `git checkout -- content/vi/home.json`.

- [ ] **Step 14: Commit**

```bash
git add src/lib/content.ts src/lib/content-model.ts src/lib/content-index.generated.ts src/lib/content-parity.ts src/lib/legal.ts src/components/legal-sections.ts scripts/build-content-index.mjs scripts/check-content.mjs scripts/lib/content-rules.mjs scripts/lib/content-input.mjs tests/helpers/content.mjs tests/content-locale.test.mjs public/admin/config.yml
git commit -m "feat(content): load content/vi per locale, check that it mirrors English, widen the hero limits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Integration A (S, after Tasks 3–8 have committed)

No new code unless a check fails: fix in the owning task's files, or report back. Run each step once.

- [ ] **Step 1: Fast gates on the merged wave**

Run: `npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs`
Expected: pass.

- [ ] **Step 2: Rebuild the preview**

Run: `bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 rebuild`
Expected: `Export valid: 12 core pages, …` and `preview up on :8792`.

- [ ] **Step 3: The shipped stylesheet** (Task 3)

Run: `node -e "const fs=require('fs');const d='dist/_next/static/chunks/';for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.css'))){const c=fs.readFileSync(d+f,'utf8');console.log(f,c.length,/\.tracking-tight\{/.test(c),/font-family:SG Inter;unicode-range/.test(c))}"`
Expected:
- the site stylesheet has no `.tracking-tight{` rule (false);
- it has `@font-face{font-family:SG Inter;unicode-range:…}` (true);
- it also has `@font-face` rules for `SG Mono` and both fallbacks.

Run: `grep -o '<link rel="preload"[^>]*woff2[^>]*>' dist/index.html`
Expected: exactly one font preload, the latin Inter file (`inter_latin…p…woff2`).

- [ ] **Step 4: Fonts in the browser** (Task 4)

Save as `artifacts/probe-fonts.mjs` and run it through wt.sh: `bash "<wt.sh>" "E:/Personal/clone website/spacegear-hero" 8792 run node artifacts/probe-fonts.mjs`

```js
import { launchBrowser } from "../scripts/browser-runtime.mjs";
const base = "http://127.0.0.1:8792";
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const fonts = [];
  page.on("request", (request) => { if (request.url().endsWith(".woff2")) fonts.push(request.url().split("/").pop()); });
  await page.goto(base, { waitUntil: "networkidle" });
  const english = [...fonts];
  await page.evaluate(() => { const p = document.createElement("p"); p.textContent = "Ấ Ở Ữ đường Tiếng Việt"; p.style.cssText = "font-family: var(--font-sans); font-size: 40px"; document.querySelector("main").prepend(p); });
  await page.waitForTimeout(1500);
  const ready = await page.evaluate(() => document.fonts.check('40px "SG Inter"', "Ấ Ở Ữ"));
  console.log(JSON.stringify({ english, after: fonts, ready }));
  if (english.some((name) => name.includes("vietnamese"))) throw new Error("the English home page downloaded a Vietnamese subset");
  if (!fonts.some((name) => name.includes("inter_vietnamese"))) throw new Error("Vietnamese text did not load the Vietnamese Inter subset");
  if (!ready) throw new Error("SG Inter cannot render Vietnamese letters");
} finally { await browser.close(); }
```

Expected: one JSON line:
- `english` lists only latin files;
- `after` adds `inter_vietnamese….woff2`;
- `ready` is `true`;
- no error.

- [ ] **Step 5: The Worker on the preview** (Task 5)

Run:
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://127.0.0.1:8792/about/
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "x-sg-test-country: VN" http://127.0.0.1:8792/about/
curl -s -D - -o /dev/null "http://127.0.0.1:8792/about/?lang=vi&utm_source=x" | grep -iE "^(location|set-cookie|cache-control|vary):"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8792/api/unknown
```

Expected:
1. `200`: no redirect without the header, although the cached cf.json says VN.
2. `200`. There is no `/vi/about/` yet, so the twin check keeps the visitor on English. That proves the guard.
3. `location: /vi/?utm_source=x`. There is no Vietnamese twin yet, so the Worker falls back to the Vietnamese home page. That page appears in Task 18, and nothing links to `?lang=vi` before then. The full redirect is proven in Task 20. Also expected:
   - `set-cookie: sg_lang=vi; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
   - `cache-control: no-store`;
   - `vary: Cookie, Accept-Language`.
4. `404`.

- [ ] **Step 6: The English pages are unchanged apart from fonts**

The baseline is the one the controller saved before Wave A (see "Wave A preflight" below). Run: `node scripts/html-snapshot.mjs compare artifacts/html-baseline-bilingual --explain-client-ids artifacts/dist-before-bilingual`

Expected: the only differences on the 15 pages are:
- the `<html>` class, now `antialiased` only;
- the `@font-face` family names that reach the page through the CSS.

Explain anything else or report it. Then run `node scripts/fx-checks.mjs http://127.0.0.1:8792` through wt.sh. Expected: `FX checks passed`.

- [ ] **Step 7: Save the next baseline, report**

Run:
```bash
node scripts/html-snapshot.mjs save artifacts/html-baseline-wave-a
rm -rf artifacts/dist-wave-a && mkdir -p artifacts/dist-wave-a/_next/static && cp -r dist/_next/static/chunks artifacts/dist-wave-a/_next/static/
```

No commit unless a fix was needed; then commit only the fixed files, with a `fix(…)` message. Report:
- the CSS rule count before and after;
- the font requests;
- the curl results;
- the snapshot differences.

---

## Wave B and C (Tasks 10–15; 10 → 11 sequential, 12 ∥ 13 ∥ 14 alongside them, 15 after 11; then Task 16)

### Task 10: Sveltia CMS in two languages (M; after Task 8; ∥ Tasks 12–14)

Keys verified against the vendored 0.230.1 schema and bundle (Research notes). English files keep their paths, and Vietnamese files mirror them under `content/vi/`.

**Files:**
- Modify: `public/admin/config.yml`, `tests/cms-config.test.mjs`

- [ ] **Step 1: Write the failing tests** (`tests/cms-config.test.mjs`)

At the top, after `const legal = …`, add the path helper:

```js
/** A CMS path for one language: "content/{{locale}}/home.json" → content/home.json (en) or content/vi/home.json (vi). */
const localePath = (template, locale = "en") => template.replace("{{locale}}/", locale === "en" ? "" : `${locale}/`);
```

Change the existing tests so they read the templated paths:
- In "every content file has a CMS entry…":
  `const files = new Map(pages.files.map((file) => [localePath(file.file), file]));`
- In "every folder collection mirrors…":
  - `assert.deepEqual([collection.folder, collection.extension, collection.format], [`content/{{locale}}/${name}`, "json", "json"], …)`
  - `assert.ok(fs.existsSync(localePath(collection.folder)), …)`
- In "legal pages are Markdown files…":
  - `assert.deepEqual(legal.files.map((file) => file.file), ["content/{{locale}}/legal/privacy.md", "content/{{locale}}/legal/terms.md"])`
  - `fs.existsSync(localePath(file.file))`
- In "the legal body pattern mirrors the parser…", read both languages:
  `for (const locale of ["en", "vi"]) { const body = fs.readFileSync(localePath(file.file, locale), "utf8"); assert.ok(cmsAccepts(body) && parserAccepts(body), `${localePath(file.file, locale)}: today's text passes both`); }`

Add these tests:

```js
test("i18n: English stays at today's paths, Vietnamese mirrors it under content/vi/, and every Vietnamese entry is required", () => {
  assert.deepEqual(config.i18n, { structure: "multiple_folders", locales: ["en", "vi"], default_locale: "en", omit_default_locale_from_file_path: true });
  for (const collection of config.collections) {
    assert.equal(collection.i18n, true, `${collection.name}: i18n`);
    for (const file of collection.files ?? []) {
      assert.equal(file.i18n, true, `${collection.name}/${file.name}: i18n`);
      assert.match(file.file, /^content\/\{\{locale\}\}\//, file.file);
      for (const locale of ["en", "vi"]) assert.ok(fs.existsSync(localePath(file.file, locale)), localePath(file.file, locale));
    }
    if (collection.folder) {
      assert.match(collection.folder, /^content\/\{\{locale\}\}\//, collection.folder);
      assert.equal(collection.initial_locales, undefined, `${collection.name}: both languages are always saved (Vietnamese cannot be switched off)`);
    }
  }
});

/** Whether a schema holds text an editor translates: plain text without a fixed pattern, or a group or list holding some. */
function translatable(meta) {
  switch (meta.kind) {
    case "text": return meta.format === "plain" && !meta.pattern;
    case "list": return meta.max > 0 && translatable(meta.item.meta);
    case "object": return Object.values(meta.shape).some((child) => translatable(child.meta));
    case "nullable": return translatable(meta.inner.meta);
    default: return false;
  }
}

/** Every CMS field says how it behaves in Vietnamese: translated (true) or copied from English (duplicate). */
function i18nFields(shape, fields, where) {
  for (const field of fields) {
    const meta = shape[field.name].meta;
    assert.equal(field.i18n, translatable(meta) ? true : "duplicate", `${where}.${field.name}`);
    const inner = meta.kind === "nullable" ? meta.inner.meta : meta;
    if (inner.kind === "object") i18nFields(inner.shape, field.fields, `${where}.${field.name}`);
    if (inner.kind === "list" && inner.max > 0) {
      if (inner.item.meta.kind === "object") i18nFields(inner.item.meta.shape, field.fields, `${where}.${field.name}[]`);
      else assert.equal(field.field.i18n, translatable(inner.item.meta) ? true : "duplicate", `${where}.${field.name}[]`);
    }
  }
}

test("text is translated; links, images, numbers, choices, patterned counts and the order are copied from English", () => {
  const files = new Map(pages.files.map((file) => [localePath(file.file), file]));
  i18nFields(schemas.site.meta.shape, files.get("content/site.json").fields, "content/site.json");
  for (const [name, file] of Object.entries(SINGLETON_FILES)) i18nFields(schemas.singletons[name].meta.shape, files.get(file).fields, file);
  for (const name of COLLECTION_NAMES) i18nFields(schemas.collections[name].meta.shape, config.collections.find((item) => item.name === name).fields, `content/${name}`);
  for (const file of legal.files) assert.equal(file.fields[0].i18n, true, `${file.file}: the body is translated`);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --import tsx --test tests/cms-config.test.mjs`
Expected: FAIL. The paths are still `content/home.json`, so `files.get("content/home.json")` is found but the new i18n tests fail (`config.i18n` is undefined).

- [ ] **Step 3: Global i18n block** (`public/admin/config.yml`, after the `output:` block)

```yaml
# Two languages (bilingual spec, Part 2). English files stay where they are; Vietnamese files mirror them under
# content/vi/: every path holds {{locale}}, and omit_default_locale_from_file_path leaves English's folder out
# (Sveltia 0.230.1 replaces "{{locale}}/" with nothing for the default locale). Every field says how it behaves
# in Vietnamese: i18n: true (translated) or i18n: duplicate (copied from English and read-only there: links,
# images, numbers, choices, patterned counts and the order). Both languages are saved for every entry.
# tests/cms-config.test.mjs checks every field; scripts/check-content.mjs refuses a Vietnamese file that differs
# from English other than in its text.
i18n:
  structure: multiple_folders
  locales: [en, vi]
  default_locale: en
  omit_default_locale_from_file_path: true
```

- [ ] **Step 4: Paths and collection flags**

1. Add `i18n: true` to every collection: `pages`, `services`, `engagements`, `faqs`, `team-roles`, `testimonials`, `articles`, `legal`.
2. In `pages` and `legal`, add `i18n: true` to every file entry and put `{{locale}}/` after `content/` in every `file:`. For example `file: content/{{locale}}/home.json` and `file: content/{{locale}}/legal/privacy.md`.
3. Give every folder collection `folder: content/{{locale}}/<name>`. For example `folder: content/{{locale}}/services`.

- [ ] **Step 5: Field flags**

Add `i18n: true` or `i18n: duplicate` to every field, by this rule (the test's `translatable()`):

| Field | i18n |
|---|---|
| `string`/`text` without `pattern` (labels, titles, texts, names, glyphs, figures such as `value`) | `true` |
| `string` with a `pattern` (`index`, `count`, `badge`, `no`, `stageNo`, `color`, `href`, `slug`, social profile addresses, later `telephone`) | `duplicate` |
| `image`, `number`, `boolean`, `select`, `hidden` (`order`, `illustrative`, `relatedInsightSlugs`, team-role `links`) | `duplicate` |
| `object` or `list` that holds at least one `true` field | `true` (and flag its children) |
| `list` whose items are all `duplicate` (measure `hands`, `socialProfiles`) | `duplicate` (and its `field` too) |
| legal `body` (`&legal_body`) | `true` |

The YAML anchors carry their flags to every alias. Set them once:
- `&link_label` → `true`;
- `&link_href` → `duplicate`;
- `&image_field` → `duplicate`;
- `&image_alt` → `true`;
- `&count` → `duplicate`;
- `&service_slug` → `duplicate`;
- `&order` → `duplicate`;
- in `&section_fields`: `title` `true`, `index` `duplicate`, `heading` `true`, `description` `true`;
- `&link_cta` (the object) → `true`;
- `&process_steps` (the list) → `true`, with `step`/`name`/`desc` `true` and `outputs` `true` (its `field` `true`);
- `&legal_body` → `true`.

For example:

```yaml
              - &link_label { name: label, label: Label, widget: string, maxlength: 30, i18n: true, use_emoji_autocomplete: false }
              - &link_href { name: href, label: Link, widget: string, maxlength: 200, i18n: duplicate, hint: "A site path such as /contact/ or /#faq, or a full https:// address.", pattern: ['^(?:\/(?!\/)[\w.~/#?=&%-]*|https:\/\/[^\s"<>]+)$', "Use a site path such as /contact/ or a full https:// address"], use_emoji_autocomplete: false }
```

```yaml
          - name: hands
            label: Dial hands (degrees)
            widget: list
            i18n: duplicate
            min: 2
            max: 2
            field: { name: angle, label: Angle, widget: number, value_type: float, min: 0, max: 360, i18n: duplicate }
```

Also add, to each collection's `description` (or to the file's `hint` for single files), one sentence: "Write the Vietnamese version in the right-hand pane; links, images, numbers and the order are copied from English."

- [ ] **Step 6: Run the tests until every field passes**

Run: `node --import tsx --test tests/cms-config.test.mjs`
Expected: PASS. A failure names the field (`content/measure.json.workflow.segments[].color: expected "duplicate"`): fix that field and run again. The test "config.yml is valid for the vendored release's own schema" must pass too, which proves every `i18n` key is a 0.230.1 option.

- [ ] **Step 7: Fast gates and commit**

Run: `npm run lint && npm run typecheck && npm test`. Expected: pass. Booting `/admin/` against this config in a browser happens in Task 16 (`cmsChecks`).

```bash
git add public/admin/config.yml tests/cms-config.test.mjs
git commit -m "feat(cms): edit English and Vietnamese side by side (Sveltia i18n, content/vi mirrors)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: The owner's contact details (NAP) as Site identity data (M; after Task 10; ∥ Tasks 12–14)

**Files:**
- Modify: `src/lib/content-model.ts` (`siteSchema`), `content/site.json`, `content/vi/site.json`, `src/lib/site.ts`, `public/admin/config.yml` (site file fields), `scripts/lib/content-rules.mjs`, `scripts/check-content.mjs`
- Create: `src/lib/phone.ts`, `tests/phone.test.mjs`

- [ ] **Step 1: Write the failing test** (`tests/phone.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";

const { formatPhone, telHref } = await import("../src/lib/phone.ts");
const { SITE, BRAND_NAME, siteFor } = await import("../src/lib/site.ts");
const { addressProblems } = await import("../scripts/lib/content-rules.mjs");

test("the owner's number reads nationally in Vietnamese and internationally in English", () => {
  assert.equal(formatPhone("+84386749799", "vi"), "0386 749 799");
  assert.equal(formatPhone("+84386749799", "en"), "+84 386 749 799");
  assert.equal(telHref("+84386749799"), "tel:+84386749799");
  assert.equal(formatPhone("+1 555", "en"), "+1 555", "an unexpected format is shown as written");
});

test("Site identity holds the owner's contact details (bilingual spec, decision 4) in both languages", () => {
  assert.equal(BRAND_NAME, "spacegear");
  assert.equal(SITE.telephone, "+84386749799");
  assert.deepEqual(siteFor("en").address, { full: "11 B4 Street, Sala Urban Area, An Khanh Ward, Ho Chi Minh City, Vietnam", street: "11 B4 Street, Sala Urban Area, An Khanh Ward", locality: "Ho Chi Minh City" });
  assert.deepEqual(siteFor("vi").address, { full: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh, TP. Hồ Chí Minh, Việt Nam", street: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh", locality: "Thành phố Hồ Chí Minh" });
  assert.equal(siteFor("vi").telephone, SITE.telephone);
  assert.equal(siteFor("vi").origin, SITE.origin);
  assert.notEqual(siteFor("vi").description, SITE.description);
});

test("the full address starts with the street line", () => {
  assert.deepEqual(addressProblems(siteFor("vi"), "content/vi/site.json"), []);
  assert.deepEqual(addressProblems({ address: { full: "Hồ Chí Minh", street: "Số 11", locality: "x" } }, "content/vi/site.json"), ["content/vi/site.json: address.full must begin with address.street (\"Số 11\"), the street line that the structured data and Google Business Profile use"]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test tests/phone.test.mjs`
Expected: FAIL, `Cannot find module …/src/lib/phone.ts`.

- [ ] **Step 3: Schema** (`src/lib/content-model.ts`, replace `siteSchema`)

```ts
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
```

- [ ] **Step 4: The data**

`content/site.json` (whole file):

```json
{
  "name": "spacegear.tech",
  "description": "Digital transformation and AI consulting, from strategy to working systems. Modernize operations, connect data and put AI to work.",
  "socialProfiles": [],
  "address": {
    "full": "11 B4 Street, Sala Urban Area, An Khanh Ward, Ho Chi Minh City, Vietnam",
    "street": "11 B4 Street, Sala Urban Area, An Khanh Ward",
    "locality": "Ho Chi Minh City"
  },
  "telephone": "+84386749799"
}
```

`content/vi/site.json` (whole file; the description is the translator's):

```json
{
  "name": "spacegear.tech",
  "description": "spacegear.tech tư vấn chuyển đổi số và AI, từ chiến lược đến hệ thống vận hành thực tế. Chúng tôi giúp bạn hiện đại hóa vận hành, kết nối dữ liệu và đưa AI vào công việc.",
  "socialProfiles": [],
  "address": {
    "full": "Số 11, đường B4, Khu đô thị Sala, phường An Khánh, TP. Hồ Chí Minh, Việt Nam",
    "street": "Số 11, đường B4, Khu đô thị Sala, phường An Khánh",
    "locality": "Thành phố Hồ Chí Minh"
  },
  "telephone": "+84386749799"
}
```

- [ ] **Step 5: CMS fields** (`public/admin/config.yml`, the `site` file, after `socialProfiles`)

```yaml
          - name: address
            label: Address
            hint: "Exactly as on the Google Business Profile (docs/operations/google-business-profile.md). The honesty check allows the address and the phone number only here."
            widget: object
            i18n: true
            fields:
              - { name: full, label: Full address (shown on the site), widget: string, maxlength: 120, i18n: true, use_emoji_autocomplete: false }
              - { name: street, label: Street line (structured data), widget: string, maxlength: 80, i18n: true, hint: "The start of the full address, up to the ward.", use_emoji_autocomplete: false }
              - { name: locality, label: City (structured data), widget: string, maxlength: 40, i18n: true, use_emoji_autocomplete: false }
          - { name: telephone, label: Telephone, widget: string, maxlength: 12, i18n: duplicate, hint: "International format with no spaces: +84386749799. The site shows 0386 749 799 in Vietnamese and +84 386 749 799 in English.", pattern: ['^\+84\d{9}$', "Use the international format with no spaces, such as +84386749799"], use_emoji_autocomplete: false }
```

- [ ] **Step 6: `src/lib/phone.ts`**

```ts
// The owner's phone number on the page: national in Vietnamese ("0386 749 799"), international in English
// ("+84 386 749 799"), and always the E.164 number in tel: links (bilingual spec, decision 4).
import type { Locale } from "./i18n/locales.ts";

export function formatPhone(e164: string, locale: Locale): string {
  const match = /^\+84(\d{3})(\d{3})(\d{3})$/.exec(e164);
  if (!match) return e164;
  const [, a, b, c] = match;
  return locale === "vi" ? `0${a} ${b} ${c}` : `+84 ${a} ${b} ${c}`;
}

export const telHref = (e164: string) => `tel:${e164}`;
```

- [ ] **Step 7: `src/lib/site.ts`** (whole file)

```ts
import siteFile from "../../content/site.json" with { type: "json" };
import siteFileVi from "../../content/vi/site.json" with { type: "json" };
import { SERVICES } from "./content";
import { siteSchema } from "./content-model";
import { parseContent } from "./content-schema";
import type { Locale } from "./i18n/locales";

/** The Organization's name in structured data and on Google Business Profile. The visible site name stays SITE.name ("spacegear.tech"). */
export const BRAND_NAME = "spacegear";
// Identity copy comes from content/site.json and content/vi/site.json (editable in the CMS); the rest comes from the environment.
const IDENTITY = {
  en: parseContent(siteSchema, siteFile, "content/site.json"),
  vi: parseContent(siteSchema, siteFileVi, "content/vi/site.json"),
};
export type SiteIdentity = (typeof IDENTITY)["en"];
const site = IDENTITY.en;
export const SITE = {
  name: site.name,
  description: site.description,
  origin: process.env.NEXT_PUBLIC_SITE_URL || "https://spacegear.tech",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  publicationMode: process.env.SITE_MODE === "production" ? "production" : "preview",
  policiesApproved: process.env.POLICIES_APPROVED === "true",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
  socialProfiles: site.socialProfiles,
  address: site.address,
  telephone: site.telephone,
};
/** SITE with one language's identity copy (name, description, profiles, address); the environment values are shared. */
export function siteFor(locale: Locale) {
  const identity = IDENTITY[locale];
  return { ...SITE, name: identity.name, description: identity.description, socialProfiles: identity.socialProfiles, address: identity.address, telephone: identity.telephone };
}
export function getPublishedRoutes() {
  return [
    { path: "/", kind: "home" }, { path: "/services/", kind: "index" },
    ...SERVICES.map((service) => ({ path: `/services/${service.slug}/`, kind: "service" })),
    ...["approach", "about", "contact", "privacy", "terms"].map((slug) => ({ path: `/${slug}/`, kind: "page" })),
  ];
}
```

- [ ] **Step 8: Address rule** (`scripts/lib/content-rules.mjs`, new export; call it from `scripts/check-content.mjs`)

```js
/** The full address begins with the street line, so the page and the structured data never disagree. */
export function addressProblems(site, file) {
  const { full, street } = site.address ?? {};
  return typeof full === "string" && typeof street === "string" && !full.startsWith(street)
    ? [`${file}: address.full must begin with address.street (${quote(street)}), the street line that the structured data and Google Business Profile use`]
    : [];
}
```

In `scripts/check-content.mjs`, change the two `parseContent(siteSchema, …)` lines to:

```js
for (const file of ["content/site.json", "content/vi/site.json"]) {
  await attempt(() => { errors.push(...addressProblems(parseContent(siteSchema, readJson(file), file), file)); });
}
```

and import `addressProblems` next to `contentRuleProblems`.

- [ ] **Step 9: Run the tests and gates**

Run: `node --import tsx --test tests/phone.test.mjs tests/cms-config.test.mjs tests/honesty-vi.test.mjs tests/content-locale.test.mjs && npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs`
Expected: all pass. The cms-config mirror and i18n tests cover the new fields, and parity accepts them: the telephone is identical, the addresses are text.

- [ ] **Step 10: Commit**

```bash
git add src/lib/content-model.ts content/site.json content/vi/site.json src/lib/site.ts src/lib/phone.ts public/admin/config.yml scripts/lib/content-rules.mjs scripts/check-content.mjs tests/phone.test.mjs
git commit -m "feat(site): the owner's address and phone number as Site identity data in both languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Rules for Tasks 12–15 (component localization)

- **Client components** (`"use client"`) call `useLocale()` (from `@/components/LocaleProvider`) at the top of every component that needs the language. Call it unconditionally, after the component's existing hooks. They read copy with `getContent(locale)` and strings with `dictionary(locale)`. Their props do not change, so the React Server Components payload of English pages stays the same.
- **Server components** take an optional `locale?: Locale` prop (default `"en"`).
- Every internal link goes through `localizedHref(href, locale)`. For `"en"` it returns the same string.
- JSX text with values uses `formatParts(template, values)`; attributes use `format(…)`.
- **English must render byte-identically** (Task 16 proves it with the HTML snapshot), apart from the new language switch and footer address (Task 15). Do not reorder markup, change classes, or merge or split text nodes.
- Gates per task: `npm run lint && npm run typecheck && npm test`. No build.

### Task 12: Hero and Work: copy, hero grammar, cursor labels, the intro on `/vi/` (M, ∥ 13, 14)

**Files:**
- Modify: `src/components/sections/OrbitalCinematic.tsx`, `src/components/sections/Work.tsx`, `src/components/globe/intro-gate.ts`, `tests/globe-logic.test.mjs`

- [ ] **Step 1: Failing test for the intro on the Vietnamese home page** (`tests/globe-logic.test.mjs`, in `GATE_CASES`)

```js
  ["the Vietnamese home page", { path: "/vi/" }, "play"],
  ["a Vietnamese page", { path: "/vi/about/" }, undefined],
```

Run: `node --import tsx --test tests/globe-logic.test.mjs`
Expected: FAIL on "the Vietnamese home page" (`undefined !== 'play'`).

- [ ] **Step 2: The gate** (`src/components/globe/intro-gate.ts`)

Replace the path line of `INTRO_GATE_SCRIPT`:

```ts
  'var p=w.location.pathname;if(p!=="/"&&p!=="/vi/"||w.location.hash)return;' +
```

and in the doc comment: "- the home page (`/` or `/vi/`) without a hash;".

Run: `node --import tsx --test tests/globe-logic.test.mjs`
Expected: the gate cases pass. Only "the gate script is fixed ES5 text…" fails, on the length and hash pins.

Print the new pins:
`node --import tsx -e "import('./src/components/globe/intro-gate.ts').then(async (g) => { const { createHash } = await import('node:crypto'); console.log(g.INTRO_GATE_SCRIPT.length, createHash('sha256').update(g.INTRO_GATE_SCRIPT).digest('base64')); })"`

Then replace `553` and the base64 string in the test with the printed values. Run again. Expected: PASS.

- [ ] **Step 3: OrbitalCinematic.tsx**

1. Replace the import `import { HOME, type Stat as StatData } from "@/lib/content";` with:

```tsx
import { useLocale } from "@/components/LocaleProvider";
import { getContent, type SiteContent, type Stat as StatData } from "@/lib/content";
import { dictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { localizedHref } from "@/lib/i18n/locales";
```

2. In `HeroScene`, just before `const live = globe === "ready";`, add `const drag = dictionary(useLocale()).cursor.drag;`. In the `hero-scene` div, change `data-cursor={live ? "Drag" : undefined}` to `data-cursor={live ? drag : undefined}`.
3. Delete `const STATEMENT_WORDS = HOME.statement.split(" ").length;`. At the top of `StaticStage`'s body add:

```tsx
  const home = getContent(useLocale()).HOME;
  const statementWords = home.statement.split(" ").length;
```

   Replace `dimBy={1 / STATEMENT_WORDS}` with `dimBy={1 / statementWords}` and `text={HOME.statement}` with `text={home.statement}`. Run `grep -n "STATEMENT_WORDS" src/components/sections/OrbitalCinematic.tsx`. Expected: no line.
4. Replace the `const [FIRST, SECOND, THIRD] = HOME.headline.verbs;` … `const WORDS: Word[] = [ … ];` block (from `type Word` to the end of `WORDS`) with:

```tsx
type Word = { text: string; tone?: string; after?: string };
/**
 * "— The smarter way to plan, build, and scale your business." as single words, each in its own mask. The
 * punctuation and the word between the verbs come from the dictionary (hero.*): English writes "plan, build, and
 * scale", Vietnamese "hoạch định, xây dựng và mở rộng" (no comma before "và"). An empty `after` renders nothing.
 */
function heroWords(headline: SiteContent["HOME"]["headline"], grammar: Dictionary["hero"]): Word[] {
  const [first, second, third] = headline.verbs;
  return [
    { text: "—", tone: "text-mut-3" },
    ...headline.lead.split(" ").map((text) => ({ text })),
    { text: first, tone: "text-flame", after: grammar.afterFirst },
    { text: second, tone: "text-flame", after: grammar.afterSecond },
    { text: grammar.conjunction },
    { text: third, tone: "text-flame" },
    ...headline.tail.split(" ").map((text) => ({ text })),
  ];
}
```

5. In `HeroCopy`, after `const state = copyState(phase, startPhase);`, add:

```tsx
  const locale = useLocale();
  const home = getContent(locale).HOME;
  const words = heroWords(home.headline, dictionary(locale).hero);
```

   Then:
   - replace `WORDS.map` with `words.map`;
   - replace every `HOME.` with `home.`;
   - change the CTA's `href={HOME.cta.href}` to `href={localizedHref(home.cta.href, locale)}`.
6. In the default export `OrbitalCinematic`, add `const locale = useLocale();` and `const home = getContent(locale).HOME;` after its existing hooks. Replace `HOME.` with `home.`, and change the corner link's `href={HOME.corner.href}` to `href={localizedHref(home.corner.href, locale)}`.
7. Run `grep -n "HOME\b" src/components/sections/OrbitalCinematic.tsx`. Expected: no line.

- [ ] **Step 4: Work.tsx**

1. Replace `import { SECTIONS, WORK, type WorkTile } from "@/lib/content";` with:

```tsx
import { useLocale } from "@/components/LocaleProvider";
import { getContent, type WorkTile } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref } from "@/lib/i18n/locales";
```

2. `Tile`: first line of the body `const locale = useLocale();`. Change its link to `href={localizedHref(href, locale)}` and `data-cursor={dictionary(locale).cursor.view}`.
3. `LineupPanel`: `const l = getContent(useLocale()).WORK.lineup;`
4. `AssessmentCard`: `const locale = useLocale();` and `const a = getContent(locale).WORK.assessment;`. Change both `href={a.href}` to `href={localizedHref(a.href, locale)}`.
5. `Work()`: replace its first two lines with:

```tsx
  const locale = useLocale();
  const { SECTIONS, WORK } = getContent(locale);
  const copy = SECTIONS.work;
  const f = WORK.featured;
  const featuredHref = localizedHref(f.href, locale);
  const view = dictionary(locale).cursor.view;
```

   Change both `href={f.href}` to `href={featuredHref}` and the featured link's `data-cursor="View"` to `data-cursor={view}`.

- [ ] **Step 5: Gates and commit**

Run: `npm run lint && npm run typecheck && npm test`
Expected: pass.

```bash
git add src/components/sections/OrbitalCinematic.tsx src/components/sections/Work.tsx src/components/globe/intro-gate.ts tests/globe-logic.test.mjs
git commit -m "feat(i18n): hero and Work read the page's language (copy, grammar, cursor labels, intro on /vi/)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Services, Process, Analytics, Pricing (M, ∥ 12, 14)

**Files:**
- Modify: `src/components/sections/Services.tsx`, `Process.tsx`, `Analytics.tsx`, `Pricing.tsx`

In each file replace the `@/lib/content` import as shown and add the shared imports:

```tsx
import { useLocale } from "@/components/LocaleProvider";
import { getContent, type ProcessStep } from "@/lib/content";        // keep only the type imports the file had
import { dictionary, format } from "@/lib/i18n/dictionary";          // only what the file uses
import { localizedHref } from "@/lib/i18n/locales";
```

- [ ] **Step 1: Services.tsx**
  1. `CorePanel()`: first lines `const locale = useLocale();` and `const { CORE_PANEL } = getContent(locale);`. Change the button to `href={localizedHref(CORE_PANEL.href, locale)}`.
  2. `Services()`: after `const [active, setActive] = useState(0);` add `const locale = useLocale();`, `const { PILLARS, SECTIONS } = getContent(locale);` and `const open = dictionary(locale).cursor.open;`.
  3. Both `` href={`/services/${s.slug}/`} `` become `` href={localizedHref(`/services/${s.slug}/`, locale)} ``.
  4. `data-cursor="Open"` becomes `data-cursor={open}`.

- [ ] **Step 2: Process.tsx**
  1. `StepCard`: first line `const t = dictionary(useLocale()).process;`, and `{s.outputs.length === 1 ? "output" : "outputs"}` becomes `{s.outputs.length === 1 ? t.output : t.outputs}`.
  2. `Process()`: first lines `const locale = useLocale();` and `const { PROCESS_CTA, PROCESS_STEPS, SECTIONS } = getContent(locale);`. Its button becomes `href={localizedHref(PROCESS_CTA.href, locale)}`.

- [ ] **Step 3: Analytics.tsx**
  1. `Donut()`: `const w = getContent(useLocale()).MEASURE.workflow;`
  2. `Analytics()`: after `const uid = useId().replace(/:/g, "");` add `const locale = useLocale();` and `const { MEASURE, SECTIONS } = getContent(locale);`. Keep the following lines.
  3. `aria-label="Capabilities"` becomes `aria-label={dictionary(locale).analytics.ticker}`.
  4. `href={MEASURE.cta.href}` becomes `href={localizedHref(MEASURE.cta.href, locale)}`.

- [ ] **Step 4: Pricing.tsx**
  1. `Toggle`: first line `const t = dictionary(useLocale()).pricing;`.
     - `Deliverables` becomes `{t.toggleDeliverables}` and `Outcomes` becomes `{t.toggleOutcomes}`.
     - ``aria-label={`Show outcomes instead of deliverables (${label})`}`` becomes `aria-label={format(t.toggleLabel, { label })}`.
  2. `EngagementRow`: after its `useState` add `const t = dictionary(useLocale()).pricing;`. Then:
     - `Start here` becomes `{t.startHere}`;
     - `label="Stage"`, `label="Engagement"` and `label="Focus"` become `label={t.stage}`, `label={t.engagement}` and `label={t.focus}`;
     - `label={outcomes ? "Outcomes" : "Deliverables"}` becomes `label={outcomes ? t.columnOutcomes : t.columnDeliverables}`;
     - `{selected ? "Selected" : "Select"}` becomes `{selected ? t.selected : t.select}`.
  3. `Pricing()`: after `useInViewFlag(rows, { amount: 0.15 });` add `const locale = useLocale();`, `const { ENGAGEMENTS, ENGAGEMENTS_FOOTER, SECTIONS } = getContent(locale);` and `const t = dictionary(locale).pricing;`. Move `const chosen = …` below them. The chosen line becomes:

```tsx
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center text-[13px] text-flame">
              {format(t.chosenBefore, { short: chosen.short })}
              <Link prefetch={false} href={localizedHref("/contact/", locale)} className="underline underline-offset-4">{t.chosenLink}</Link>{t.chosenAfter}
            </motion.p>
```

     (it renders only after a press, so the server HTML does not change). In the footer link, `href={ENGAGEMENTS_FOOTER.href}` becomes `href={localizedHref(ENGAGEMENTS_FOOTER.href, locale)}` and `aria-label="Discuss a project"` becomes `aria-label={t.discuss}`.

- [ ] **Step 5: Check no English literal or content constant is left**

Run: `grep -nE '"(Deliverables|Outcomes|Start here|Stage|Engagement|Focus|Select|Selected|Open|Capabilities|output|outputs|Discuss a project)"|\b(CORE_PANEL|PILLARS|SECTIONS|PROCESS_CTA|PROCESS_STEPS|MEASURE|ENGAGEMENTS|ENGAGEMENTS_FOOTER)\.' src/components/sections/{Services,Process,Analytics,Pricing}.tsx`
Expected: only lines that read the destructured locals (`SECTIONS.services`, `MEASURE.workflow`, …), each inside a component that called `getContent(locale)`.

- [ ] **Step 6: Gates and commit**

Run: `npm run lint && npm run typecheck && npm test`. Expected: pass.

```bash
git add src/components/sections/Services.tsx src/components/sections/Process.tsx src/components/sections/Analytics.tsx src/components/sections/Pricing.tsx
git commit -m "feat(i18n): Services, Process, Analytics and Pricing read the page's language

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Faq, Team, Testimonials, Labs, SnapRow, the rail, ui and PageIntro (M, ∥ 12, 13)

**Files:**
- Modify: `src/components/sections/Faq.tsx`, `Team.tsx`, `Testimonials.tsx`, `TestimonialsCarousel.tsx`, `Labs.tsx`, `src/components/SnapRow.tsx`, `src/components/fx/ScrollProgressRail.tsx`, `src/components/ui.tsx`, `src/components/PageIntro.tsx`
- Create: `tests/locale-components.test.mjs`

- [ ] **Step 1: Write the failing test** (server components render per language; English output is unchanged)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { CtaBand, FlameButton } = await import("../src/components/ui.tsx");
const { default: PageIntro } = await import("../src/components/PageIntro.tsx");
const h = React.createElement;

test("CtaBand and FlameButton: English as before; with a locale, the default label and the link follow it", () => {
  const en = renderToStaticMarkup(h(CtaBand, { title: "T", text: "X" }));
  assert.match(en, /href="\/contact\/"/);
  assert.match(en, />Discuss a project</);
  const vi = renderToStaticMarkup(h(CtaBand, { title: "T", text: "X", locale: "vi" }));
  assert.match(vi, /href="\/vi\/contact\/"/);
  assert.match(vi, />Trao đổi về dự án</);
  assert.match(renderToStaticMarkup(h(FlameButton, { href: "/vi/about/" }, "x")), /href="\/vi\/about\/"/, "without a locale the href is used as given");
});

test("PageIntro's back link defaults to the page language's home", () => {
  assert.match(renderToStaticMarkup(h(PageIntro, { eyebrow: "E", title: "T", description: "D" })), /href="\/"[^>]*>← (?:<!-- -->)?Home/);
  assert.match(renderToStaticMarkup(h(PageIntro, { eyebrow: "E", title: "T", description: "D", locale: "vi" })), /href="\/vi\/"[^>]*>← (?:<!-- -->)?Trang chủ/);
});
```

Run: `node --import tsx --test tests/locale-components.test.mjs`
Expected: FAIL (the `vi` assertions).

- [ ] **Step 2: ui.tsx**

Add the imports `import { dictionary } from "@/lib/i18n/dictionary";` and `import { localizedHref, type Locale } from "@/lib/i18n/locales";`.

In `FlameButton` and `GhostButton`, add a prop `locale?: Locale` (type and destructuring) and pass `href={locale ? localizedHref(href, locale) : href}` to `MagneticLink`:

```tsx
/** `locale` localizes `href`; without it `href` is used as given (client callers pass an href they localized). */
```

`CtaBand`: replace `cta = "Discuss a project",` with `cta,` and add `locale` to the props:

```tsx
export function CtaBand({ title, text, cta, href = "/contact/", locale }: { title: string; text: string; cta?: string; href?: string; locale?: Locale }) {
  return (
    <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-line bg-card/40 p-10 text-center">
      <h2 className="display text-3xl text-ink">{title}</h2>
      <p className="max-w-md text-[14px] text-mut-2">{text}</p>
      <FlameButton href={href} locale={locale}>{cta ?? dictionary(locale ?? "en").cta.discuss}</FlameButton>
    </div>
  );
}
```

- [ ] **Step 3: PageIntro.tsx**

```tsx
import Link from "next/link";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";

/** Inner-page header from the original /services page: back link, eyebrow, display H1, lead. */
export default function PageIntro({
  eyebrow,
  title,
  description,
  back,
  locale = "en",
}: {
  eyebrow: string;
  title: string;
  description: string;
  back?: { href: string; label: string };
  locale?: Locale;
}) {
  const link = back ?? { href: "/", label: dictionary(locale).pageIntro.back };
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link prefetch={false} href={localizedHref(link.href, locale)} className="fx-underline font-mono text-[12px] text-mut-2 transition-colors hover:text-flame">
          ← {link.label}
        </Link>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
          {eyebrow}
        </span>
      </div>
      <h1 className="display mt-6 max-w-3xl break-words text-[clamp(32px,6vw,72px)] text-ink">{title}</h1>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">{description}</p>
    </>
  );
}
```

- [ ] **Step 4: Faq.tsx** (client)
  1. Imports: `getContent` (in place of `FAQ_CARD, FAQS, SECTIONS`), `useLocale`, `localizedHref`.
  2. Delete `const BADGE_RING = ringText(FAQ_CARD.badge, 36, { size: 8 });`.
  3. In `CircleBadge`, first lines: `const { FAQ_CARD } = getContent(useLocale());` and `const ring = ringText(FAQ_CARD.badge, 36, { size: 8 });`. Replace `BADGE_RING` with `ring`.
  4. `StillQuestionsCard`: `const locale = useLocale();` and `const { FAQ_CARD } = getContent(locale);`. The button becomes `href={localizedHref(FAQ_CARD.href, locale)}`.
  5. `Faq()`: `const { FAQS, SECTIONS } = getContent(useLocale());`.

- [ ] **Step 5: Team.tsx** (client)
  1. Imports: `getContent`, `useLocale`, `dictionary`, `formatParts`, `localizedHref`. Delete the module-level `const MEMBERS = …;`.
  2. In `Team()`, after `const [i, setI] = useState(0);` add:

```tsx
  const locale = useLocale();
  const { FOUNDER, SECTIONS, TEAM, TEAM_ROLES } = getContent(locale);
  const MEMBERS = FOUNDER ? [FOUNDER, ...TEAM_ROLES] : TEAM_ROLES;
  const t = dictionary(locale).team;
```

  3. Then:
     - `Role {i + 1} of {MEMBERS.length}` becomes `{formatParts(t.roleOf, { i: i + 1, n: MEMBERS.length })}`;
     - `data-cursor="Drag"` becomes `data-cursor={dictionary(locale).cursor.drag}`;
     - `‹ swipe ›` becomes `{t.swipe}`;
     - `aria-label="Previous role"` becomes `aria-label={t.previous}` and `aria-label="Next role"` becomes `aria-label={t.next}`;
     - `href={TEAM.cta.href}` becomes `href={localizedHref(TEAM.cta.href, locale)}`.

- [ ] **Step 6: Testimonials.tsx** (server; whole file)

```tsx
import { Container, SectionHeader } from "@/components/ui";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SAMPLE_MARKER, SAMPLE_TESTIMONIALS, SHOW_SAMPLES } from "@/lib/samples";
import TestimonialsCarousel from "./TestimonialsCarousel";

/** The entries the section shows in `locale`: real, permission-confirmed quotes, or the dev samples. */
function reviewsFor(locale: Locale) {
  const { TESTIMONIALS } = getContent(locale);
  const usingSamples = TESTIMONIALS.length === 0 && SHOW_SAMPLES;
  return { usingSamples, reviews: TESTIMONIALS.length ? TESTIMONIALS : usingSamples ? SAMPLE_TESTIMONIALS : [] };
}
/** Whether the section renders in `locale` (the home progress rail lists it only then). */
export const hasTestimonials = (locale: Locale) => reviewsFor(locale).reviews.length > 0;
export const HAS_TESTIMONIALS = hasTestimonials("en");

export default function Testimonials({ locale = "en" }: { locale?: Locale }) {
  // Renders only real, permission-confirmed quotes (or dev samples).
  const { usingSamples, reviews } = reviewsFor(locale);
  if (reviews.length === 0) return null;
  return (
    <section id="testimonials" data-sample={usingSamples ? SAMPLE_MARKER : undefined} className="relative scroll-mt-2 py-24">
      <Container>
        {usingSamples && <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-flame">{dictionary(locale).testimonials.sample}</p>}
        <SectionHeader {...getContent(locale).SECTIONS.testimonials} />
        <TestimonialsCarousel reviews={reviews} />
      </Container>
    </section>
  );
}
```

- [ ] **Step 7: TestimonialsCarousel.tsx** (client)

After `const [i, setI] = useState(0);` add `const t = dictionary(useLocale()).testimonials;`. Then:
- the four `aria-label="Previous"` / `aria-label="Next"` become `aria-label={t.previous}` / `aria-label={t.next}`;
- `Reviews` becomes `{t.reviews}`;
- ``aria-label={`Show ${rv.name}`}`` becomes `aria-label={format(t.show, { name: rv.name })}`.

Imports: `useLocale`, `dictionary`, `format`.

- [ ] **Step 8: Labs.tsx** (server; Part 3 replaces its data, so only the language plumbing here)

Replace the module constants with a `labsFor(locale)` function, the same way as `reviewsFor` in Step 6 (`ARTICLES` from `getContent(locale)`):
- export `hasLabs = (locale: Locale) => …` and `HAS_LABS = hasLabs("en")`;
- give `Labs` a `{ locale = "en" }` prop;
- pass `locale` to `ArticleCard` and, there, use `href={localizedHref(a.href, locale)}` for the internal link;
- replace `Written by` with `{t.writtenBy}`, `Read article` with `{t.read}` and the sample note with `{t.sample}`, where `t = dictionary(locale).labs`;
- render `SectionHeader {...getContent(locale).SECTIONS.labs}`.

- [ ] **Step 9: SnapRow.tsx and ScrollProgressRail.tsx** (client)

- `SnapRow`: first line of the component `const goTo = dictionary(useLocale()).snapRow.goTo;`. Then ``aria-label={`Go to item ${i + 1}`}`` becomes `aria-label={format(goTo, { n: i + 1 })}`.
- `ScrollProgressRail`'s `Rail`: first line `const label = dictionary(useLocale()).rail.label;`. Then `aria-label="On this page"` becomes `aria-label={label}`.

- [ ] **Step 10: Run the tests and gates, commit**

Run: `node --import tsx --test tests/locale-components.test.mjs && npm run lint && npm run typecheck && npm test`
Expected: PASS.

```bash
git add src/components/sections/Faq.tsx src/components/sections/Team.tsx src/components/sections/Testimonials.tsx src/components/sections/TestimonialsCarousel.tsx src/components/sections/Labs.tsx src/components/SnapRow.tsx src/components/fx/ScrollProgressRail.tsx src/components/ui.tsx src/components/PageIntro.tsx tests/locale-components.test.mjs
git commit -m "feat(i18n): Faq, Team, Testimonials, Labs, SnapRow, the rail, ui and PageIntro read the page's language

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: Nav with the language switch, Footer with the contact details, QuickStart, ContactForm (M; after Task 11)

**Files:**
- Create: `src/components/LanguageSwitch.tsx`, `src/components/ContactDetails.tsx`
- Modify: `src/components/Nav.tsx`, `src/components/sections/Footer.tsx`, `src/components/QuickStart.tsx`, `src/components/ContactForm.tsx`, `src/lib/contact.ts`, `tests/contact.test.mjs`, `tests/locale-components.test.mjs`

- [ ] **Step 1: Failing tests**

Append to `tests/contact.test.mjs`:

```js
test("field problems come back in the form's language", async () => {
  const { validateContact } = await import("../src/lib/contact.ts");
  assert.equal(validateContact({ ...valid(), name: "A", locale: "vi" }).errors.name, "Vui lòng nhập từ 2 đến 100 ký tự.");
  assert.equal(validateContact({ ...valid(), message: "ngắn", locale: "vi" }).errors.message, "Vui lòng nhập từ 20 đến 3.000 ký tự.");
  assert.equal(validateContact({ ...valid(), name: "A" }).errors.name, "Use between 2 and 100 characters.");
  assert.equal(validateContact({ ...valid(), name: "A", locale: "fr" }).errors.name, "Use between 2 and 100 characters.", "an unknown language is English");
  assert.equal(validateContact({ ...valid(), locale: "vi" }).data.name, valid().name, "the language is not stored");
});
```

Append to `tests/locale-components.test.mjs` (the footer itself cannot render outside Next: its QuickStart calls `useRouter`):

```js
const { default: ContactDetails } = await import("../src/components/ContactDetails.tsx");

test("the contact details show the owner's address and phone in the page's language, the phone as a tel: link", () => {
  const en = renderToStaticMarkup(h(ContactDetails, {}));
  assert.match(en, /11 B4 Street, Sala Urban Area, An Khanh Ward, Ho Chi Minh City, Vietnam/);
  assert.match(en, /href="tel:\+84386749799"[^>]*>\+84 386 749 799</);
  assert.match(en, /class="sr-only">Address: </, "labels are for screen readers unless asked for");
  const vi = renderToStaticMarkup(h(ContactDetails, { locale: "vi", labels: true }));
  assert.match(vi, /Số 11, đường B4, Khu đô thị Sala, phường An Khánh, TP\. Hồ Chí Minh, Việt Nam/);
  assert.match(vi, /href="tel:\+84386749799"[^>]*>0386 749 799</);
  assert.match(vi, /class="text-mut">Địa chỉ: </);
});
```

Run: `node --import tsx --test tests/contact.test.mjs tests/locale-components.test.mjs`
Expected: FAIL (the Vietnamese message; `ContactDetails.tsx` missing).

- [ ] **Step 2: `src/lib/contact.ts`** (whole file; same checks, messages per language)

```ts
import { SERVICES } from "./content.ts";
import { dictionary } from "./i18n/dictionary.ts";
import { isLocale } from "./i18n/locales.ts";
export type ContactInput = { submissionId:string; name:string; email:string; company?:string; service?:string; message:string; turnstileToken:string; website?:string };
/** Validates an inquiry. The form sends its page's language (`locale`), so a Vietnamese visitor reads the problems in Vietnamese; the language is not stored. */
export function validateContact(value: unknown): { data?:ContactInput; errors:Record<string,string> } {
  const errors:Record<string,string>={};
  if (!value || typeof value!=="object" || Array.isArray(value)) return {errors:{form:dictionary("en").contactErrors.submitted}};
  const input=value as Record<string,unknown>;
  const m=dictionary(isLocale(input.locale)?input.locale:"en").contactErrors;
  const text=(key:string)=>typeof input[key]==="string"?(input[key] as string).trim():"";
  const data:ContactInput={submissionId:text("submissionId"),name:text("name"),email:text("email").toLowerCase(),company:text("company"),service:text("service"),message:text("message"),turnstileToken:text("turnstileToken"),website:text("website")};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submissionId))errors.form=m.reload;
  if(data.name.length<2||data.name.length>100)errors.name=m.name;
  if(data.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))errors.email=m.email;
  if((data.company?.length||0)>200)errors.company=m.company;
  if(data.message.length<20||data.message.length>3000)errors.message=m.message;
  if(data.service&&!SERVICES.some(service=>service.slug===data.service))errors.service=m.service;
  if(!data.turnstileToken||data.turnstileToken.length>2048)errors.verification=m.verification;
  if(data.website)errors.form=m.rejected;
  return Object.keys(errors).length?{errors}:{data,errors};
}
```

- [ ] **Step 3: `src/components/LanguageSwitch.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useLocale, useNotFoundPage } from "@/components/LocaleProvider";
import { dictionary } from "@/lib/i18n/dictionary";
import { HTML_LANG, LOCALES, LOCALE_NAME, LOCALE_SHORT, switchHref } from "@/lib/i18n/locales";

/**
 * The EN/VI switch (desktop nav: "bar"; mobile menu: "menu"). Plain links, so switching is a full page load (each
 * language has its own root layout) and works without JavaScript: each links the English path with ?lang=, which
 * the Worker (worker/locale.ts) remembers in the sg_lang cookie before redirecting to the clean page in that
 * language. The current language is marked with aria-current. Each link's accessible name holds its visible text
 * ("VI – Tiếng Việt"); the bar shows only EN/VI, so English pages render no Vietnamese letter and never load the
 * Vietnamese font subset until the mobile menu opens. The 404 page has no single path, so its links go home.
 */
export default function LanguageSwitch({ variant }: { variant: "bar" | "menu" }) {
  const locale = useLocale();
  const notFound = useNotFoundPage();
  const pathname = usePathname() ?? "/";
  const bar = variant === "bar";
  return (
    <ul aria-label={dictionary(locale).nav.language} className={bar ? "hidden items-center gap-0.5 rounded-xl border border-line p-0.5 lg:flex" : "mt-2 flex gap-2 border-t border-line-soft px-1 pt-3"}>
      {LOCALES.map((target) => {
        const current = target === locale;
        const tone = current ? "bg-card-2 text-ink" : "text-mut-2 hover:text-ink";
        return (
          <li key={target}>
            <a
              href={switchHref(notFound ? "/" : pathname, target)}
              hrefLang={HTML_LANG[target]}
              lang={HTML_LANG[target]}
              aria-current={current ? "true" : undefined}
              aria-label={bar ? `${LOCALE_SHORT[target]} – ${LOCALE_NAME[target]}` : undefined}
              className={bar ? `grid h-8 min-w-9 place-items-center rounded-lg px-2 font-mono text-[11px] tracking-[0.12em] transition-colors ${tone}` : `block rounded-lg px-4 py-2.5 text-[13px] transition-colors hover:bg-card-2 ${tone}`}
            >
              {bar ? LOCALE_SHORT[target] : LOCALE_NAME[target]}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Nav.tsx**

1. Imports: delete `import { SERVICES } from "@/lib/content";` and add:

```tsx
import LanguageSwitch from "@/components/LanguageSwitch";
import { useLocale } from "@/components/LocaleProvider";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, stripLocale, type Locale } from "@/lib/i18n/locales";
```

2. Replace `const PRIMARY…`, `const SERVICE_ITEMS…`, `const TAIL…` and `currentHref` with:

```tsx
/** The nav's links in one language. Their hrefs are English site paths; they are localized where they render. */
function navItems(locale: Locale) {
  const t = dictionary(locale).nav;
  return {
    primary: [{ label: t.home, href: "/" }] as Item[],
    services: getContent(locale).SERVICES.map((s) => ({ label: s.name, href: `/services/${s.slug}/` })) as Item[],
    tail: [
      { label: t.approach, href: "/approach/" },
      { label: t.about, href: "/about/" },
      { label: t.engagements, href: "/#pricing" },
      { label: t.contact, href: "/contact/" },
    ] as Item[],
  };
}
const PAGE_HREFS = ["/approach/", "/about/", "/contact/"];

/** The pathname with a trailing slash: the export uses trailingSlash, and either form must give the same link. */
const withSlash = (path: string) => (path.endsWith("/") ? path : `${path}/`);

/** The desktop link for the current page, from the path without its language prefix: "/" at home, the Services
 *  trigger anywhere under /services/, otherwise the page link whose path the pathname starts with. Hash links are never current. */
function currentHref(path: string): string | null {
  if (path === "/") return "/";
  if (path.startsWith("/services/")) return "/services/";
  return PAGE_HREFS.find((href) => path.startsWith(href)) ?? null;
}
```

   (delete the old `withSlash`, which moves up here).
3. `NavLink`, `Dropdown` and `MobileGroup`: first line `const locale = useLocale();`. Every rendered `href={it.href}` / `href={href}` becomes `href={localizedHref(it.href, locale)}` / `href={localizedHref(href, locale)}`.
4. In `Nav()`:

```tsx
  const locale = useLocale();
  const t = dictionary(locale).nav;
  const { primary, services, tail } = navItems(locale);
  const pathname = usePathname();
  const path = stripLocale(withSlash(pathname));
```

   (replace the old `pathname`/`path` lines). Then:
   - `PRIMARY` → `primary`, `SERVICE_ITEMS` → `services`, `TAIL` → `tail`;
   - `aria-label="Main navigation"` → `{t.label}`;
   - the brand link: `href={localizedHref("/", locale)}`, `aria-label={t.homeLink}`;
   - the dropdown: `label={t.services}`;
   - the CTA: `href={localizedHref("/contact/", locale)}`, text `{t.cta}`;
   - the menu toggle: `aria-label={t.openMenu}`;
   - the mobile list's `{ label: "Services", href: "/services/" }` → `{ label: t.services, href: "/services/" }`, rendered with `href={localizedHref(it.href, locale)}`;
   - `MobileGroup title={t.allServices}`.
5. Add `<LanguageSwitch variant="bar" />` as the first child of the right-hand `<div className="flex items-center gap-2">`, before the CTA. Add `<LanguageSwitch variant="menu" />` after `<MobileGroup … />` inside the mobile menu.

- [ ] **Step 5: Footer.tsx** (server)

1. Imports: replace `import { FOOTER } from "@/lib/content";` and `import { SITE } from "@/lib/site";` with:

```tsx
import ContactDetails from "@/components/ContactDetails";
import { getContent } from "@/lib/content";
import { dictionary, formatParts } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { siteFor } from "@/lib/site";
```

2. Delete `const BADGE_RING = …`. `CircleBadge` takes `{ badge }: { badge: string }`, computes `const ring = ringText(badge, 37, { size: 8.5 });` and renders `{badge}` and `ring.*`.
3. `export default function Footer({ locale = "en" }: { locale?: Locale })`, with first lines:

```tsx
  const { FOOTER } = getContent(locale);
  const site = siteFor(locale);
  const t = dictionary(locale);
  const year = new Date().getFullYear();
```

   Then:
   - `<CircleBadge badge={FOOTER.badge} />`;
   - `SITE.` → `site.`;
   - the no-email link: `href={localizedHref("/contact/", locale)}`, text `{t.footer.contactLink}`;
   - the columns: `aria-label={ci === 0 ? t.footer.homeSections : t.footer.pages}`, links `href={localizedHref(it.href, locale)}`;
   - the privacy line: `{t.footer.privacyLead}{" "}<Link prefetch={false} href={localizedHref("/privacy/", locale)} className="fx-underline text-flame">{t.footer.privacyLink}</Link>`;
   - `<p>© {year} spacegear.tech. All rights reserved.</p>` → `<p>{formatParts(t.footer.copyright, { year })}</p>`;
   - `Digital transformation &amp; AI consulting.` → `{t.footer.tagline}`;
   - the Privacy and Terms magnetic links: `href={localizedHref("/privacy/", locale)}` / `href={localizedHref("/terms/", locale)}`, labels `{t.footer.privacy}` / `{t.footer.terms}`;
   - Back to top: `aria-label={t.footer.backToTop}`.
4. The contact block. Create `src/components/ContactDetails.tsx` (also used by the Contact, Privacy and Terms views in Task 17):

```tsx
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { formatPhone, telHref } from "@/lib/phone";
import { siteFor } from "@/lib/site";

/**
 * The owner's contact details (Site identity: content/site.json and content/vi/site.json), exactly as on Google
 * Business Profile: the address, the phone as a tel: link and, with `email` and a configured address, the email.
 * With `labels`, "Address:" and the like show; without, they are for screen readers only (the footer).
 */
export default function ContactDetails({ locale = "en", labels = false, email = false, className = "" }: { locale?: Locale; labels?: boolean; email?: boolean; className?: string }) {
  const site = siteFor(locale);
  const t = dictionary(locale).contactDetails;
  const label = (text: string) => <span className={labels ? "text-mut" : "sr-only"}>{text}: </span>;
  return (
    <address className={`not-italic ${className}`}>
      <span className="block">{label(t.address)}{site.address.full}</span>
      <span className="block">{label(t.phone)}<a href={telHref(site.telephone)} className="fx-underline transition-colors hover:text-flame">{formatPhone(site.telephone, locale)}</a></span>
      {email && site.contactEmail && <span className="block">{label(t.email)}<a href={`mailto:${site.contactEmail}`} className="fx-underline transition-colors hover:text-flame">{site.contactEmail}</a></span>}
    </address>
  );
}
```

   In Footer, directly after the identity `<div className="mt-5 text-[13px] leading-relaxed text-mut-2 lg:mt-6">…</div>`, add:

```tsx
                {/* The owner's contact details (Site identity), exactly as on Google Business Profile. */}
                <ContactDetails locale={locale} className="mt-4 text-[13px] leading-relaxed text-mut-2" />
```

   With that, the footer reads the address and phone only through `ContactDetails`.

- [ ] **Step 6: QuickStart.tsx** (client)

After the two `useRef` lines add:

```tsx
  const locale = useLocale();
  const t = dictionary(locale).quickStart;
  const contact = localizedHref("/contact/", locale);
```

Then:
- `window.location.pathname.replace(/\/$/, "") === "/contact"` becomes `stripLocale(window.location.pathname).replace(/\/$/, "") === "/contact"`;
- `router.push("/contact/")` becomes `router.push(contact)`, and `action="/contact/"` becomes `action={contact}`;
- the labels and placeholders become `t.nameLabel`, `t.namePlaceholder`, `t.emailLabel`, `t.emailPlaceholder` and `aria-label={t.submit}`.

Imports: `useLocale`, `dictionary`, `localizedHref`, `stripLocale`.

- [ ] **Step 7: ContactForm.tsx** (client)

After `const hydrated = useSyncExternalStore(…);` add `const locale = useLocale();` and `const t = dictionary(locale).form;`. Replace every literal with its `t.*` key:

| Literal | Key |
|---|---|
| "Verification could not load…" (two places) | `t.verificationFailed` |
| "This preview does not send inquiries." | `t.previewNoSend` |
| "Please complete the verification…" | `t.completeVerification` |
| "Your inquiry has been received…" | `t.received` |
| 429 | `t.tooMany` |
| 409 | `t.changed` |
| 403 | `t.expired` |
| 400 | `t.checkFields` |
| other | `t.notSaved` |
| catch | `t.noReceipt` |
| the preview notice | `t.previewNotice` |
| Name, Email, Company, "(optional)", "Service interest", "Let’s explore it together" | `t.name`, `t.email`, `t.company`, `t.optional`, `t.service`, `t.serviceAny` |
| the message label and placeholder | `t.message`, `t.messagePlaceholder` |
| "Website" (honeypot label) | `t.website` |
| "Sending…" / "Send inquiry" | `t.sending` / `t.send` |
| the noscript note | `t.noscript` |

Two more changes:
- The note becomes `<p className="form-note">{t.noteLead} <Link prefetch={false} href={localizedHref("/privacy/", locale)}>{t.noteLink}</Link>{t.noteTail}</p>`.
- Add `locale` to the request payload (`const payload={…,turnstileToken:token.current,locale};`).

In the Turnstile effect, read the message once (`const verificationFailed = t.verificationFailed;` above the effect), use it in both `setStatus` calls, and make the dependency list `[siteKey, verificationFailed]`. Imports: `useLocale` (relative: `./LocaleProvider`), `dictionary` (`../lib/i18n/dictionary`), `localizedHref` (`../lib/i18n/locales`). The file already uses relative imports so that `tests/contact-render.test.mjs` loads it.

- [ ] **Step 8: Run the tests and gates, commit**

Run: `node --import tsx --test tests/contact.test.mjs tests/contact-render.test.mjs tests/locale-components.test.mjs tests/locales.test.mjs && npm run lint && npm run typecheck && npm test`
Expected: PASS.

```bash
git add src/components/LanguageSwitch.tsx src/components/ContactDetails.tsx src/components/Nav.tsx src/components/sections/Footer.tsx src/components/QuickStart.tsx src/components/ContactForm.tsx src/lib/contact.ts tests/contact.test.mjs tests/locale-components.test.mjs
git commit -m "feat(i18n): EN/VI switch in the nav and menu, footer contact details, localized forms

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 16: Integration B (S, after Tasks 10–15 have committed)

- [ ] **Step 1: Fast gates and content check**

Run: `npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs`. Expected: pass.

- [ ] **Step 2: Rebuild, then compare the English pages with the Wave A baseline**

Run (wt.sh): `rebuild`, then `node scripts/html-snapshot.mjs compare artifacts/html-baseline-wave-a --explain-client-ids artifacts/dist-wave-a`

Expected: client-id changes explained, and only these real differences, on every page:
- the nav's language switch: the `bar` list before the CTA and the `menu` list in the mobile menu;
- the footer's `<address>` block.

Anything else is a regression in Tasks 12–15. Fix it there, in the owning file.

- [ ] **Step 3: Motion, CMS and NAP in the browser**

- Run (wt.sh): `node scripts/fx-checks.mjs http://127.0.0.1:8792`. Expected: `FX checks passed`. The English link names ("About", "Discuss a project", "Select") and the cursor labels are unchanged.
- Run (wt.sh) `node artifacts/probe-cms.mjs`, saved as:

```js
import { launchBrowser } from "../scripts/browser-runtime.mjs";
import { cmsChecks } from "../scripts/admin-check.mjs";
const base = "http://127.0.0.1:8792";
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
const browser = await launchBrowser();
try { console.log((await cmsChecks(browser, base, routes)).join("\n")); } finally { await browser.close(); }
```

  Expected: every CMS line passes. Sveltia boots with the i18n configuration, lists the collections with "Work with Local Repository", and raises no page error.
- Run `curl -s http://127.0.0.1:8792/ | grep -o 'tel:+84386749799'`. Expected: `tel:+84386749799`.

- [ ] **Step 4: Save the baseline for Task 17**

```bash
node scripts/html-snapshot.mjs save artifacts/html-baseline-wave-c
rm -rf artifacts/dist-wave-c && mkdir -p artifacts/dist-wave-c/_next/static && cp -r dist/_next/static/chunks artifacts/dist-wave-c/_next/static/
```

Report the differences found and the check results. Commit only fixes.

---

## Wave D (Tasks 17–22)

### Task 17: Views: every page body per locale, the owner's details on Contact, Privacy and Terms, the bilingual 404 (L)

Every route's body moves into a view, `src/views/<Name>View.tsx`. A view is a server component `({ locale })`. Its metadata function `<name>Metadata(locale)` lives in `src/views/metadata.ts`, so tests can load it without the client trees. The route files become wrappers (the pattern in "Shared interfaces"). Routes stay where they are in this task. English renders identically, except:
- the 404, which now says everything in both languages;
- Contact, Privacy and Terms, which gain the owner's contact details.

**Files:**
- Create:
  - `src/views/metadata.ts`, `HomeView.tsx`, `AboutView.tsx`, `ApproachView.tsx`, `ContactView.tsx`, `PrivacyView.tsx`, `TermsView.tsx`, `ServicesView.tsx`, `ServiceView.tsx`, `NotFoundView.tsx`;
  - `tests/views.test.mjs`.
- Modify:
  - `src/lib/seo.ts`;
  - `src/app/page.tsx`, `about/page.tsx`, `approach/page.tsx`, `contact/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `services/page.tsx`, `services/[slug]/page.tsx`, `not-found.tsx`.

- [ ] **Step 1: Write the failing test** (`tests/views.test.mjs`: metadata per locale, without rendering client trees)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const meta = await import("../src/views/metadata.ts");

test("each page gives English the metadata it had, and Vietnamese its own canonical and title", () => {
  const en = meta.aboutMetadata("en");
  assert.equal(en.title.absolute, "About | spacegear.tech");
  assert.equal(en.alternates.canonical, "https://spacegear.tech/about/");
  const vi = meta.aboutMetadata("vi");
  assert.equal(vi.title.absolute, "Giới thiệu | spacegear.tech");
  assert.equal(vi.alternates.canonical, "https://spacegear.tech/vi/about/");
  assert.equal(meta.homeMetadata("en").title.absolute, "spacegear.tech | Digital Transformation & AI Consulting");
  assert.equal(meta.homeMetadata("vi").title.absolute, "spacegear.tech | Tư vấn chuyển đổi số & AI");
  assert.equal(meta.contactMetadata("en").title.absolute, "Discuss a Project | spacegear.tech");
  assert.equal(meta.serviceMetadata("vi", "applied-ai").alternates.canonical, "https://spacegear.tech/vi/services/applied-ai/");
  assert.deepEqual(meta.serviceStaticParams("vi").map((p) => p.slug), meta.serviceStaticParams("en").map((p) => p.slug));
  assert.equal(meta.notFoundMetadata().title.absolute, "Page not found · Không tìm thấy trang | spacegear.tech");
});

test("every route file is a thin wrapper around its view", () => {
  for (const [file, view] of [["src/app/page.tsx", "HomeView"], ["src/app/about/page.tsx", "AboutView"], ["src/app/approach/page.tsx", "ApproachView"], ["src/app/contact/page.tsx", "ContactView"], ["src/app/privacy/page.tsx", "PrivacyView"], ["src/app/terms/page.tsx", "TermsView"], ["src/app/services/page.tsx", "ServicesView"], ["src/app/services/[slug]/page.tsx", "ServiceView"]]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, new RegExp(`from "@/views/${view}"`), file);
    assert.match(source, /from "@\/views\/metadata"/, file);
    assert.match(source, /locale="en"/, file);
    assert.ok(source.split("\n").length <= 12, `${file} stays a wrapper`);
  }
});
```

Run: `node --import tsx --test tests/views.test.mjs`
Expected: FAIL, `Cannot find module …/src/views/HomeView.tsx`.

- [ ] **Step 2: `src/lib/seo.ts`: metadata per locale** (Task 19 adds hreflang, og:locale and the structured data)

```ts
import type { Metadata } from "next";
import { dictionary } from "./i18n/dictionary";
import { localizedHref, type Locale } from "./i18n/locales";
import { SITE } from "./site";

export function canonicalUrl(path: string) { return new URL(path, SITE.origin).href; }
/** A page's metadata in one language. `path` is the page's English path ("/about/"); the canonical is its own language's. */
export function buildMetadata({ title, description, path, locale }: { title: string; description: string; path: string; locale: Locale }): Metadata {
  const t = dictionary(locale).meta;
  const url = canonicalUrl(localizedHref(path, locale));
  const fullTitle = path === "/" ? `${SITE.name} | ${t.homeTitle}` : `${title} | ${SITE.name}`;
  return {
    title: { absolute: fullTitle }, description, alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE.name, title: fullTitle, description, url, images: [{ url: "/seo/og.png", width: 1200, height: 630, alt: t.ogImageAlt }] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: ["/seo/og.png"] },
  };
}
export function breadcrumbData(items: { name: string; path: string }[], locale: Locale) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: canonicalUrl(localizedHref(item.path, locale)) })) };
}
```

- [ ] **Step 3: `src/views/metadata.ts`** (every page's metadata per locale; no component imports)

```ts
// Each page's metadata in one language, kept apart from the views so tests and the route files can read it
// without loading the client component trees. `path` is always the English path; buildMetadata localizes it.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";

type Page = "about" | "approach" | "contact" | "privacy" | "terms" | "services";
const PATHS: Record<Page, string> = { about: "/about/", approach: "/approach/", contact: "/contact/", privacy: "/privacy/", terms: "/terms/", services: "/services/" };
const pageMetadata = (page: Page) => (locale: Locale) => {
  const t = dictionary(locale)[page];
  return buildMetadata({ title: t.title, description: t.description, path: PATHS[page], locale });
};

export function homeMetadata(locale: Locale) {
  const t = dictionary(locale).meta;
  return buildMetadata({ title: t.homeTitle, description: t.homeDescription, path: "/", locale });
}
export const aboutMetadata = pageMetadata("about");
export const approachMetadata = pageMetadata("approach");
export const contactMetadata = pageMetadata("contact");
export const privacyMetadata = pageMetadata("privacy");
export const termsMetadata = pageMetadata("terms");
export const servicesMetadata = pageMetadata("services");

export function serviceStaticParams(locale: Locale) {
  return getContent(locale).SERVICES.map(({ slug }) => ({ slug }));
}
export function serviceMetadata(locale: Locale, slug: string) {
  const service = getContent(locale).SERVICES.find((item) => item.slug === slug);
  if (!service) notFound();
  return buildMetadata({ title: service.name, description: service.summary, path: `/services/${slug}/`, locale });
}
/** The one 404 page says it in both languages. */
export function notFoundMetadata(): Metadata {
  return { title: { absolute: `${dictionary("en").notFound.title} · ${dictionary("vi").notFound.title} | ${SITE.name}` } };
}
```

- [ ] **Step 4: The views** (they render; their metadata is in `metadata.ts`)

`src/views/HomeView.tsx`:

```tsx
import OrbitalCinematic from "@/components/sections/OrbitalCinematic";
import Work from "@/components/sections/Work";
import Services from "@/components/sections/Services";
import Analytics from "@/components/sections/Analytics";
import Process from "@/components/sections/Process";
import Pricing from "@/components/sections/Pricing";
import Faq from "@/components/sections/Faq";
import Team from "@/components/sections/Team";
import Testimonials, { hasTestimonials } from "@/components/sections/Testimonials";
import Labs, { hasLabs } from "@/components/sections/Labs";
import ScrollProgressRail, { type RailItem } from "@/components/fx/ScrollProgressRail";
import { getContent } from "@/lib/content";
import type { Locale } from "@/lib/i18n/locales";

export default function HomeView({ locale }: { locale: Locale }) {
  const { SECTIONS } = getContent(locale);
  /** Home sections for the progress rail, labelled with their section titles (no new copy). */
  const rail: RailItem[] = [
    { id: "work", label: SECTIONS.work.title },
    { id: "services", label: SECTIONS.services.title },
    { id: "process", label: SECTIONS.process.title },
    { id: "analytics", label: SECTIONS.analytics.title },
    { id: "pricing", label: SECTIONS.pricing.title },
    { id: "faq", label: SECTIONS.faq.title },
    { id: "team", label: SECTIONS.team.title },
    ...(hasTestimonials(locale) ? [{ id: "testimonials", label: SECTIONS.testimonials.title }] : []),
    ...(hasLabs(locale) ? [{ id: "labs", label: SECTIONS.labs.title }] : []),
  ];
  return (
    <>
      {/* === FX === before <main> in the tab order, so Tab from the last section still enters the footer */}
      <ScrollProgressRail items={rail} />
      <main id="main" className="relative bg-bg">
        <OrbitalCinematic />
        {/* curtain: this panel slides up over the locked hero background */}
        <div className="relative z-10 rounded-t-[28px] border-t border-line bg-bg shadow-[0_-30px_60px_-20px_rgba(0,0,0,0.75)]">
          <Work />
          <Services />
          <Process />
          <Analytics />
          <Pricing />
          <Faq />
          <Team />
          <Testimonials locale={locale} />
          <Labs locale={locale} />
        </div>
      </main>
    </>
  );
}
```

`src/views/AboutView.tsx`:

```tsx
import PageIntro from "@/components/PageIntro";
import DotField from "@/components/DotField";
import Team from "@/components/sections/Team";
import { Container, CtaBand } from "@/components/ui";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";

export default function AboutView({ locale }: { locale: Locale }) {
  const t = dictionary(locale).about;
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-12">
        <Container>
          <PageIntro eyebrow={t.eyebrow} title={t.heading} description={t.lead} locale={locale} />
          <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-line bg-card/50 p-8">
              <h2 className="display text-[clamp(26px,3vw,40px)] text-ink">{t.contextHeading}</h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">{t.contextParagraphs[0]}</p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">{t.contextParagraphs[1]}</p>
            </div>
            <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
              <div className="flex items-center justify-between border-b border-line-soft pb-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{t.principlesLabel}</span>
                <span className="font-mono text-[12px] tracking-[0.2em] text-flame">0{t.principles.length}</span>
              </div>
              <ul className="space-y-3">
                {t.principles.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[13.5px] text-mut">
                    <span aria-hidden className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <DotField cols={5} rows={3} className="mt-auto gap-y-4 px-1" />
            </div>
          </div>
        </Container>
      </section>
      <Team />
      <section className="pb-24">
        <Container>
          <CtaBand title={t.ctaTitle} text={t.ctaText} cta={t.ctaButton} href="/approach/" locale={locale} />
        </Container>
      </section>
    </main>
  );
}
```

`src/views/ApproachView.tsx`:

```tsx
import PageIntro from "@/components/PageIntro";
import { ProcessSteps } from "@/components/sections/Process";
import { Container, CtaBand } from "@/components/ui";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";

export default function ApproachView({ locale }: { locale: Locale }) {
  const t = dictionary(locale).approach;
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro eyebrow={t.eyebrow} title={t.heading} description={t.lead} locale={locale} />
          <h2 className="sr-only">{t.stepsHeading}</h2>
          <ProcessSteps steps={getContent(locale).APPROACH_STEPS} gridClassName="md:grid-cols-2 xl:grid-cols-5" />
          <CtaBand title={t.ctaTitle} text={t.ctaText} locale={locale} />
        </Container>
      </section>
    </main>
  );
}
```

`src/views/ContactView.tsx` (adds the address and the phone under the email):

```tsx
import PageIntro from "@/components/PageIntro";
import ContactForm from "@/components/ContactForm";
import ContactDetails from "@/components/ContactDetails";
import { CircleBadge } from "@/components/sections/Faq";
import { Container } from "@/components/ui";
import { getContent } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SITE } from "@/lib/site";

export default function ContactView({ locale }: { locale: Locale }) {
  const t = dictionary(locale).contact;
  const { FAQ_CARD, SERVICES } = getContent(locale);
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro eyebrow={t.eyebrow} title={t.heading} description={t.lead} locale={locale} />
          <div className="mt-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <aside className="overflow-hidden rounded-2xl border border-line bg-card/50">
              <div className="relative h-56 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img {...contentImage(FAQ_CARD.img)} alt={FAQ_CARD.imgAlt} className="h-full w-full object-cover grayscale" />
                <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
                <div className="absolute bottom-3 right-3"><CircleBadge /></div>
              </div>
              <div className="p-7">
                <h2 className="display text-2xl text-ink">{t.asideHeading}</h2>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mut-2">{t.asideText}</p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mut-2">{t.asideReply}</p>
                {SITE.contactEmail && (
                  <p className="mt-5"><a className="fx-underline text-[13px] text-flame" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></p>
                )}
                {/* The owner's contact details (Site identity), exactly as on Google Business Profile. */}
                <ContactDetails locale={locale} labels className="mt-4 space-y-1 text-[13px] leading-relaxed text-mut-2" />
              </div>
            </aside>
            <ContactForm services={SERVICES.map(({ slug, shortName }) => ({ slug, name: shortName }))} siteKey={SITE.turnstileSiteKey} />
          </div>
        </Container>
      </section>
    </main>
  );
}
```

`src/views/PrivacyView.tsx`:

```tsx
import { createElement } from "react";
import PageIntro from "@/components/PageIntro";
import ContactDetails from "@/components/ContactDetails";
import { legalSectionElements } from "@/components/legal-sections";
import { Container } from "@/components/ui";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SITE } from "@/lib/site";

// Section text: content/legal/privacy.md and content/vi/legal/privacy.md (editable in the CMS). The notice and the
// contact section depend on site settings; the contact section also gives the owner's address and phone.
export default function PrivacyView({ locale }: { locale: Locale }) {
  const t = dictionary(locale).privacy;
  const notice = !SITE.policiesApproved && <p className="policy-preview">{t.notice}</p>;
  const contact = <section><h2>{t.contactHeading}</h2><p>{SITE.contactEmail ? <>{t.contactBefore}<a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>{t.contactAfter}</> : t.contactPending}</p><ContactDetails locale={locale} labels /></section>;
  return <main id="main" className="relative min-h-screen bg-bg"><section className="pt-32 pb-24"><Container><PageIntro eyebrow={t.eyebrow} title={t.heading} description={t.lead} locale={locale}/>{createElement("div", { className: "prose-card mt-12 max-w-3xl rounded-3xl border border-line bg-card/40 p-8 sm:p-10" }, notice, ...legalSectionElements("privacy", locale), contact)}</Container></section></main>;
}
```

`src/views/TermsView.tsx`:

```tsx
import { createElement } from "react";
import PageIntro from "@/components/PageIntro";
import ContactDetails from "@/components/ContactDetails";
import { legalSectionElements } from "@/components/legal-sections";
import { Container } from "@/components/ui";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SITE } from "@/lib/site";

// Section text: content/legal/terms.md and content/vi/legal/terms.md (editable in the CMS). The notice and the
// contact section depend on site settings; the contact section also gives the owner's address and phone.
export default function TermsView({ locale }: { locale: Locale }) {
  const t = dictionary(locale).terms;
  const notice = !SITE.policiesApproved && <p className="policy-preview">{t.notice}</p>;
  const contact = <section><h2>{t.contactHeading}</h2><p>{SITE.contactEmail ? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : t.contactPending}</p><ContactDetails locale={locale} labels /></section>;
  return <main id="main" className="relative min-h-screen bg-bg"><section className="pt-32 pb-24"><Container><PageIntro eyebrow={t.eyebrow} title={t.heading} description={t.lead} locale={locale}/>{createElement("div", { className: "prose-card mt-12 max-w-3xl rounded-3xl border border-line bg-card/40 p-8 sm:p-10" }, notice, ...legalSectionElements("terms", locale), contact)}</Container></section></main>;
}
```

`src/views/ServicesView.tsx`:

```tsx
import Link from "next/link";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { ArrowIcon, Container, CtaBand } from "@/components/ui";
import { getContent, serviceFor } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { breadcrumbData } from "@/lib/seo";

export default function ServicesView({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-20">
        <Container>
          <PageIntro eyebrow={t.services.eyebrow} title={t.services.heading} description={t.services.lead} locale={locale} />

          <div className="mt-12 space-y-4">
            {getContent(locale).PILLARS.map((pillar) => {
              const service = serviceFor(locale, pillar.slug);
              const href = localizedHref(`/services/${service.slug}/`, locale);
              return (
                <article
                  key={service.slug}
                  className="grid gap-6 overflow-hidden rounded-3xl border border-line bg-card/50 p-8 lg:grid-cols-[80px_1fr_320px] lg:items-center"
                >
                  <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                    <span className="display text-3xl text-flame">{pillar.no}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{pillar.tag}</span>
                  </div>
                  <div>
                    <h2 className="display text-2xl text-ink">
                      <Link prefetch={false} href={href} className="transition-colors hover:text-flame">{service.name}</Link>
                    </h2>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mut-2">{service.buyerProblem}</p>
                    <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                      {service.deliverables.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-[13px] text-mut">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-flame" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link prefetch={false} href={href} className="group mt-6 inline-flex items-center gap-2 text-[13px] text-flame">
                      {t.services.explore} <ArrowIcon />
                    </Link>
                  </div>
                  <div className="relative h-44 overflow-hidden rounded-2xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img {...contentImage(pillar.img)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                </article>
              );
            })}
          </div>

          <CtaBand title={t.services.ctaTitle} text={t.services.ctaText} locale={locale} />
        </Container>
      </section>
      <StructuredData data={breadcrumbData([{ name: t.nav.home, path: "/" }, { name: t.nav.services, path: "/services/" }], locale)} />
    </main>
  );
}
```

`src/views/ServiceView.tsx`:

```tsx
import { notFound } from "next/navigation";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { Container, CtaBand, FlameButton, SectionHeader } from "@/components/ui";
import { ProcessSteps } from "@/components/sections/Process";
import { FaqAccordion, StillQuestionsCard } from "@/components/sections/Faq";
import { Tile } from "@/components/sections/Work";
import { getContent } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary, format } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { SITE } from "@/lib/site";
import { breadcrumbData, canonicalUrl } from "@/lib/seo";

export default function ServiceView({ locale, slug }: { locale: Locale; slug: string }) {
  const { PILLARS, SERVICES } = getContent(locale);
  const service = SERVICES.find((item) => item.slug === slug);
  if (!service) notFound();
  const t = dictionary(locale);
  const pillar = PILLARS.find((item) => item.slug === slug);
  const related = PILLARS.filter((item) => item.slug !== slug);
  const contact = `/contact/?service=${slug}`;

  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro eyebrow={service.category} title={service.name} description={service.summary} back={{ href: "/services/", label: t.nav.services }} locale={locale} />

          <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col justify-between gap-8 rounded-3xl border border-line bg-card/50 p-8">
              <div>
                <h2 className="display text-[clamp(26px,3vw,40px)] text-ink">{t.service.problemHeading}</h2>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">{service.buyerProblem}</p>
              </div>
              <FlameButton href={contact} locale={locale} className="w-fit">{t.service.discuss}</FlameButton>
            </div>
            <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
              <div className="flex items-center justify-between border-b border-line-soft pb-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{t.service.receive}</span>
                <span className="font-mono text-[12px] tracking-[0.2em] text-flame">{String(service.deliverables.length).padStart(2, "0")}</span>
              </div>
              <ul className="space-y-3">
                {service.deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-mut">
                    <span aria-hidden className="mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              {pillar && (
                <div className="relative mt-auto h-40 overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img {...contentImage(pillar.img)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-24">
            <SectionHeader title={t.service.howTitle} index="001" heading={t.service.howHeading} description={t.service.howDescription} />
            <ProcessSteps steps={service.process.map((desc, i) => ({ step: format(t.process.step, { n: i + 1 }), desc, outputs: [] }))} gridClassName="md:grid-cols-3" />
          </div>

          <div className="mt-24">
            <SectionHeader title={t.service.faqTitle} index="002" heading={t.service.faqHeading} description={t.service.faqDescription} />
            <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <FaqAccordion items={service.faqs} group={`faq-${slug}`} />
              <StillQuestionsCard />
            </div>
          </div>

          <div className="mt-24">
            <SectionHeader title={t.service.relatedTitle} index="003" heading={t.service.relatedHeading} description={t.service.relatedDescription} />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <div key={item.slug} className="h-[260px]">
                  <Tile slug={item.slug} name={item.name} img={item.img} desc={item.desc} href={`/services/${item.slug}/`} />
                </div>
              ))}
            </div>
          </div>

          <CtaBand title={t.service.ctaTitle} text={t.service.ctaText} href={contact} locale={locale} />
        </Container>
      </section>
      <StructuredData data={{ "@context": "https://schema.org", "@type": "Service", name: service.name, description: service.summary, url: canonicalUrl(localizedHref(`/services/${slug}/`, locale)), provider: { "@id": `${SITE.origin}/#organization` } }} />
      <StructuredData data={breadcrumbData([{ name: t.nav.home, path: "/" }, { name: t.nav.services, path: "/services/" }, { name: service.name, path: `/services/${slug}/` }], locale)} />
    </main>
  );
}
```

(`Tile` localizes its own `href`: Task 12.)

`src/views/NotFoundView.tsx` (one page in both languages; English first, then Vietnamese with `lang="vi"`):

```tsx
import { Container, FlameButton, GhostButton } from "@/components/ui";
import { dictionary } from "@/lib/i18n/dictionary";

/** The one 404 page (every unknown URL in either language): it says everything in English and in Vietnamese. */
export default function NotFoundView() {
  const [en, vi] = [dictionary("en").notFound, dictionary("vi").notFound];
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-40 pb-24">
        <Container>
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
            {en.eyebrow}
          </span>
          <h1 className="display mt-6 text-[clamp(40px,8vw,96px)] text-ink">
            {en.headingBefore}<span className="text-flame">{en.headingAccent}</span>{en.headingAfter}
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">{en.text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <FlameButton href="/services/">{en.explore}</FlameButton>
            <GhostButton href="/">{en.home}</GhostButton>
          </div>
          <div lang="vi" className="mt-16 border-t border-line-soft pt-10">
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
              {vi.eyebrow}
            </span>
            <h2 className="display mt-6 text-[clamp(32px,6vw,72px)] text-ink">
              {vi.headingBefore}<span className="text-flame">{vi.headingAccent}</span>{vi.headingAfter}
            </h2>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">{vi.text}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <FlameButton href="/vi/services/">{vi.explore}</FlameButton>
              <GhostButton href="/vi/">{vi.home}</GhostButton>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: The route files become wrappers**

`src/app/page.tsx`:

```tsx
import HomeView from "@/views/HomeView";
import { homeMetadata } from "@/views/metadata";

export const metadata = homeMetadata("en");
export default function Home() {
  return <HomeView locale="en" />;
}
```

Write `about`, `approach`, `contact`, `privacy`, `terms` and `services` the same way: import `<Name>View` from `@/views/<Name>View` and `{ <name>Metadata }` from `@/views/metadata`, set `export const metadata = <name>Metadata("en");`, and render `<NameView locale="en" />`.

`src/app/services/[slug]/page.tsx`:

```tsx
import ServiceView from "@/views/ServiceView";
import { serviceMetadata, serviceStaticParams } from "@/views/metadata";

export const dynamicParams = false;
export function generateStaticParams() { return serviceStaticParams("en"); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return serviceMetadata("en", (await params).slug); }
export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  return <ServiceView locale="en" slug={(await params).slug} />;
}
```

`src/app/not-found.tsx`:

```tsx
import NotFoundView from "@/views/NotFoundView";

export default function NotFound() {
  return <NotFoundView />;
}
```

- [ ] **Step 6: Tests and gates**

Run: `node --import tsx --test tests/views.test.mjs && npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 7: English is unchanged except where planned**

Run (wt.sh): `rebuild`, then `node scripts/html-snapshot.mjs compare artifacts/html-baseline-wave-c --explain-client-ids artifacts/dist-wave-c`

Expected: identical pages, except:
- `404.html` and `404/index.html` (bilingual 404);
- `contact/`, `privacy/` and `terms/` (the `<address>` block);
- `_not-found`, if it is in the snapshot.

Then run `npm run check:seo -- http://127.0.0.1:8792` (wt.sh). Expected: `SEO crawl passed: 12 pages`.

- [ ] **Step 8: Commit**

```bash
git add src/views src/lib/seo.ts src/app/page.tsx src/app/about/page.tsx src/app/approach/page.tsx src/app/contact/page.tsx src/app/privacy/page.tsx src/app/terms/page.tsx src/app/services/page.tsx "src/app/services/[slug]/page.tsx" src/app/not-found.tsx tests/views.test.mjs
git commit -m "refactor(pages): page bodies become per-locale views; NAP on Contact, Privacy and Terms; bilingual 404 view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 18: Two root layouts, the `/vi/` pages, one 404, the sitemap and packaging (L)

**Files:**
- Create:
  - `src/components/SiteShell.tsx`;
  - `src/app/(en)/layout.tsx`, `src/app/(en)/template.tsx`;
  - `src/app/(vi)/layout.tsx`, `src/app/(vi)/template.tsx`;
  - `src/app/(vi)/vi/page.tsx`, plus `about`, `approach`, `contact`, `privacy`, `terms`, `services`, `services/[slug]` pages under `src/app/(vi)/vi/`;
  - `src/app/global-not-found.tsx`, `tests/routes.test.mjs`.
- Move (git mv) into `src/app/(en)/`: `page.tsx`, `about/`, `approach/`, `contact/`, `privacy/`, `terms/`, `services/`
- Delete: `src/app/layout.tsx`, `src/app/template.tsx`, `src/app/not-found.tsx`
- Modify: `next.config.ts`, `src/lib/seo.ts` (`siteMetadata`, `organizationData`, `websiteData`), `src/lib/site.ts` (`getPublishedRoutes`), `src/app/sitemap.ts`, `scripts/package-site.mjs`, `scripts/check-export.mjs`, `scripts/check-seo.mjs` (route count)

- [ ] **Step 1: Write the failing test** (`tests/routes.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { getPublishedRoutes } = await import("../src/lib/site.ts");

test("every page exists in both languages under the same slug, and names both versions", () => {
  const routes = getPublishedRoutes();
  assert.equal(routes.length, 24);
  const en = routes.filter((route) => route.locale === "en");
  const vi = routes.filter((route) => route.locale === "vi");
  assert.deepEqual(vi.map((route) => route.path), en.map((route) => (route.path === "/" ? "/vi/" : `/vi${route.path}`)));
  for (const [index, route] of en.entries()) {
    assert.deepEqual(route.alternates, { en: route.path, vi: vi[index].path });
    assert.deepEqual(vi[index].alternates, route.alternates);
  }
});

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name).replaceAll("\\", "/")]));

test("each language has its own root layout and <html lang>; every English page has its Vietnamese twin", () => {
  assert.ok(!fs.existsSync("src/app/layout.tsx"), "no top-level root layout");
  assert.match(fs.readFileSync("src/app/(en)/layout.tsx", "utf8"), /<SiteShell locale="en">/);
  assert.match(fs.readFileSync("src/app/(vi)/layout.tsx", "utf8"), /<SiteShell locale="vi">/);
  const english = walk("src/app/(en)").filter((file) => file.endsWith("/page.tsx")).map((file) => file.replace("src/app/(en)/", ""));
  assert.equal(english.length, 8);
  for (const page of english) {
    const twin = `src/app/(vi)/vi/${page}`;
    assert.ok(fs.existsSync(twin), twin);
    assert.equal(fs.readFileSync(twin, "utf8"), fs.readFileSync(`src/app/(en)/${page}`, "utf8").replaceAll('"en"', '"vi"'), `${twin} is the English wrapper with "vi"`);
  }
  assert.match(fs.readFileSync("next.config.ts", "utf8"), /globalNotFound: true/);
  assert.match(fs.readFileSync("src/app/global-not-found.tsx", "utf8"), /<SiteShell locale="en" notFound>/);
});
```

Run: `node --import tsx --test tests/routes.test.mjs`
Expected: FAIL (12 routes; no `(en)` folder).

- [ ] **Step 2: `src/lib/seo.ts`: the root metadata and today's structured data as functions** (Task 19 extends them)

Add (and add `siteFor` to the `./site` import):

```ts
/** The root layouts' metadata: defaults for every page of one language. */
export function siteMetadata(locale: Locale): Metadata {
  return {
    metadataBase: new URL(SITE.origin), title: `${SITE.name} | ${dictionary(locale).meta.homeTitle}`, description: siteFor(locale).description,
    robots: { index: SITE.publicationMode === "production", follow: SITE.publicationMode === "production" },
    // Brand kit (docs/brand/): favicon.ico comes from the src/app convention; the web manifest is src/app/manifest.ts.
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }] },
  };
}
export function organizationData(locale: Locale) {
  return { "@type": "Organization", "@id": `${SITE.origin}/#organization`, name: SITE.name, url: SITE.origin, description: siteFor(locale).description, logo: `${SITE.origin}/icon-512.png`, ...(SITE.contactEmail ? { email: SITE.contactEmail } : {}) };
}
export function websiteData(locale: Locale) {
  return { "@type": "WebSite", "@id": `${SITE.origin}/#website`, url: SITE.origin, name: SITE.name, publisher: { "@id": `${SITE.origin}/#organization` } };
}
```

- [ ] **Step 3: `src/components/SiteShell.tsx`** (today's root layout, per language)

```tsx
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import CurtainShell from "@/components/CurtainShell";
import MotionProvider from "@/components/MotionProvider";
import NoScriptStyles from "@/components/NoScriptStyles";
import FxLayer from "@/components/fx/FxLayer";
import IntroGate from "@/components/IntroGate";
import IntroOverlay from "@/components/IntroOverlay";
import { LocaleProvider } from "@/components/LocaleProvider";
import Footer from "@/components/sections/Footer";
import StructuredData from "@/components/StructuredData";
import { dictionary } from "@/lib/i18n/dictionary";
import { HTML_LANG, type Locale } from "@/lib/i18n/locales";
import { organizationData, websiteData } from "@/lib/seo";
// The type families (Inter and JetBrains Mono, latin and Vietnamese subsets): src/app/fonts/fonts.ts.
import "@/app/fonts/fonts";
import "@/app/globals.css";

/**
 * The document of every page in one language: <html lang>, the intro gate, the skip link, the nav, the curtain
 * and footer, the motion layer and the site's structured data. The two root layouts (src/app/(en) and
 * src/app/(vi)) and the 404 (src/app/global-not-found.tsx) render it. `notFound` marks the 404, which serves every
 * unknown URL in both languages.
 */
export default function SiteShell({ locale, notFound = false, children }: { locale: Locale; notFound?: boolean; children: ReactNode }) {
  // suppressHydrationWarning: the inline intro gate may add data-intro to <html> before hydration.
  return <html lang={HTML_LANG[locale]} className="antialiased" suppressHydrationWarning><body id="top">
    <IntroGate />
    <NoScriptStyles />
    <a className="skip-link" href="#main">{dictionary(locale).shell.skipToContent}</a>
    {/* Outside main, aria-hidden and never focusable; shown only while the gate's data-intro is set. */}
    <IntroOverlay />
    <LocaleProvider locale={locale} notFound={notFound}>
      <MotionProvider>
        <Nav />
        {/* Original curtain: page content lifts away to reveal the pinned footer (desktop). */}
        <CurtainShell footer={<Footer locale={locale} />}>{children}</CurtainShell>
        {/* === FX === smooth scroll, cursor and grain on fine-pointer desktops (src/components/fx) */}
        <FxLayer />
      </MotionProvider>
    </LocaleProvider>
    <StructuredData data={{ "@context": "https://schema.org", "@graph": [organizationData(locale), websiteData(locale)] }} />
  </body></html>;
}
```

- [ ] **Step 4: Move the English routes into `(en)` and add its root layout and template**

```bash
cd "E:/Personal/clone website/spacegear-hero"
mkdir -p "src/app/(en)" "src/app/(vi)/vi/services/[slug]" "src/app/(vi)/vi/about" "src/app/(vi)/vi/approach" "src/app/(vi)/vi/contact" "src/app/(vi)/vi/privacy" "src/app/(vi)/vi/terms"
git mv src/app/page.tsx "src/app/(en)/page.tsx"
for route in about approach contact privacy terms services; do git mv "src/app/$route" "src/app/(en)/$route"; done
git rm -q src/app/layout.tsx src/app/template.tsx src/app/not-found.tsx
```

`src/app/(en)/layout.tsx`:

```tsx
import type { Viewport } from "next";
import SiteShell from "@/components/SiteShell";
import { siteMetadata } from "@/lib/seo";

export const metadata = siteMetadata("en");
// Night, the page colour (docs/brand/guidelines.md, "Colour"); Next 16 takes themeColor here, not in metadata.
export const viewport: Viewport = { themeColor: "#161719" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SiteShell locale="en">{children}</SiteShell>;
}
```

`src/app/(en)/template.tsx` (the old `src/app/template.tsx`, one per root layout):

```tsx
import type { ReactNode } from "react";
import PageTransition from "@/components/fx/PageTransition";

/** === FX === Wraps every page in the curtain transition (src/components/fx/PageTransition.tsx). It runs within one
 *  language: switching language changes the root layout, which is a full page load. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
```

- [ ] **Step 5: The Vietnamese layout, template and pages**

Create `src/app/(vi)/layout.tsx` and `src/app/(vi)/template.tsx` as exact copies of the `(en)` files, with `"en"` replaced by `"vi"` in the layout. Then create each Vietnamese page as an exact copy of its English wrapper, with `"en"` replaced by `"vi"`. The test checks that byte for byte:

```bash
cd "E:/Personal/clone website/spacegear-hero"
for page in page.tsx about/page.tsx approach/page.tsx contact/page.tsx privacy/page.tsx terms/page.tsx services/page.tsx "services/[slug]/page.tsx"; do
  sed 's/"en"/"vi"/g' "src/app/(en)/$page" > "src/app/(vi)/vi/$page"
done
sed 's/"en"/"vi"/g' "src/app/(en)/layout.tsx" > "src/app/(vi)/layout.tsx"
cp "src/app/(en)/template.tsx" "src/app/(vi)/template.tsx"
```

For example, `src/app/(vi)/vi/services/[slug]/page.tsx` becomes:

```tsx
import ServiceView from "@/views/ServiceView";
import { serviceMetadata, serviceStaticParams } from "@/views/metadata";

export const dynamicParams = false;
export function generateStaticParams() { return serviceStaticParams("vi"); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return serviceMetadata("vi", (await params).slug); }
export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  return <ServiceView locale="vi" slug={(await params).slug} />;
}
```

- [ ] **Step 6: One 404 for both languages** (`next.config.ts` and `src/app/global-not-found.tsx`)

In `next.config.ts`:

```ts
  // === FX === React <ViewTransition> on route navigations (the page curtain, src/components/fx/PageTransition.tsx).
  // globalNotFound: one 404 (src/app/global-not-found.tsx) for the two root layouts, written to 404.html.
  experimental: { viewTransition: true, globalNotFound: true },
```

`src/app/global-not-found.tsx`:

```tsx
import type { Viewport } from "next";
import SiteShell from "@/components/SiteShell";
import { siteMetadata } from "@/lib/seo";
import NotFoundView from "@/views/NotFoundView";
import { notFoundMetadata } from "@/views/metadata";

// Every unknown URL, in either language, gets this page (out/404.html): English first, then Vietnamese.
export const metadata = { ...siteMetadata("en"), ...notFoundMetadata() };
export const viewport: Viewport = { themeColor: "#161719" };
export default function GlobalNotFound() {
  return <SiteShell locale="en" notFound><NotFoundView /></SiteShell>;
}
```

- [ ] **Step 7: Routes and sitemap in both languages**

`src/lib/site.ts`, replace `getPublishedRoutes` (and import `LOCALES`, `alternatePaths`, `localizedHref` from `./i18n/locales`):

```ts
export type PublishedRoute = { path: string; kind: "home" | "index" | "service" | "page" | "labs" | "article"; locale: Locale; alternates: Partial<Record<Locale, string>> };
/** Every page in both languages, English first, each with the paths of its language versions (hreflang, sitemap). */
export function getPublishedRoutes(): PublishedRoute[] {
  const pages: { path: string; kind: PublishedRoute["kind"] }[] = [
    { path: "/", kind: "home" }, { path: "/services/", kind: "index" },
    ...SERVICES.map((service) => ({ path: `/services/${service.slug}/`, kind: "service" as const })),
    ...["approach", "about", "contact", "privacy", "terms"].map((slug) => ({ path: `/${slug}/`, kind: "page" as const })),
  ];
  return LOCALES.flatMap((locale) => pages.map(({ path, kind }) => ({ path: localizedHref(path, locale), kind, locale, alternates: alternatePaths(path) })));
}
```

`src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { HTML_LANG, LOCALES } from "@/lib/i18n/locales";
import { getPublishedRoutes, SITE } from "@/lib/site";
export const dynamic = "force-static";
/** Every page in both languages; each lists its language versions (xhtml:link hreflang), x-default being English. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, SITE.origin).href;
  return getPublishedRoutes().map(({ path, alternates }) => ({
    url: url(path),
    alternates: {
      languages: {
        ...Object.fromEntries(LOCALES.flatMap((locale) => (alternates[locale] ? [[HTML_LANG[locale], url(alternates[locale])]] : []))),
        ...(alternates.en ? { "x-default": url(alternates.en) } : {}),
      },
    },
  }));
}
```

- [ ] **Step 8: Packaging and the export check**

`scripts/package-site.mjs`:
- add `"vi"` to `roots`;
- replace the `routes` constant with:

```js
const pages=["services","services/digital-transformation","services/ai-strategy","services/applied-ai","services/automation-integration","services/product-delivery","about","approach","contact","privacy","terms"];
// Both languages: /vi/ mirrors every English page.
const routes=[...pages,"vi",...pages.map(route=>`vi/${route}`)];
```

`scripts/check-export.mjs`, replace the route loop (line 53) with:

```js
const PAGES=["","services","services/digital-transformation","services/ai-strategy","services/applied-ai","services/automation-integration","services/product-delivery","about","approach","contact","privacy","terms"];
const ROUTES=[...PAGES,...PAGES.map(route=>route?`vi/${route}`:"vi")];
for(const route of ROUTES){
  const lang=route==="vi"||route.startsWith("vi/")?"vi":"en";
  const file=path.join(root,route,"index.html");try{const html=await fs.readFile(file,"utf8");if(!html.includes("spacegear.tech"))errors.push(`Missing identity: ${route}`);if((html.match(/<h1(?:\s|>)/g)||[]).length!==1)errors.push(`H1 count: ${route}`);if(!html.includes('rel="canonical"'))errors.push(`No canonical: ${route}`);if(!html.includes(`<html lang="${lang}"`))errors.push(`html lang is not ${lang}: ${route}`);}catch{errors.push(`Missing HTML: ${route}`);}
}
```

and change the final message's `12 core pages` to `${ROUTES.length} core pages`.

`scripts/check-seo.mjs` line 11: `assert.equal(routes.length, 24, "core sitemap route count (12 pages in English and Vietnamese)");`. Task 19 adds the rest.

- [ ] **Step 9: Tests and fast gates**

Run: `node --import tsx --test tests/routes.test.mjs tests/fonts.test.mjs tests/views.test.mjs && npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 10: Build and look**

Run (wt.sh): `rebuild`. Expected: `Export valid: 24 core pages, …`.

```bash
for p in / /vi/ /vi/about/ /vi/services/applied-ai/ /vi/contact/; do printf "%s " "$p"; curl -s "http://127.0.0.1:8792$p" | grep -o '<html lang="[a-z]*"'; done
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8792/vi/no-such-page/
curl -s http://127.0.0.1:8792/vi/no-such-page/ | grep -c "Không tìm thấy trang"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "x-sg-test-country: VN" http://127.0.0.1:8792/about/
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://127.0.0.1:8792/about/?lang=vi"
curl -s http://127.0.0.1:8792/sitemap.xml | grep -c "<loc>"
```

Expected:
- `lang="en"` for `/` and `lang="vi"` for the four `/vi/` pages;
- `404`, then a count ≥ 1;
- `302 http://127.0.0.1:8792/vi/about/` for both redirects;
- `24`.

Then run `npm run check:seo -- http://127.0.0.1:8792` (wt.sh). Expected: `SEO crawl passed: 24 pages, …`.

Then run `node scripts/html-snapshot.mjs compare artifacts/html-baseline-wave-c --explain-client-ids artifacts/dist-wave-c`. Expected for the English pages:
- the HTML outside the payload is identical (skip-link text, `lang`, classes);
- the payload tree gains the `LocaleProvider` element around the nav, curtain and FX layer;
- the 404 and the planned NAP pages differ as in Task 17.

Record this in the report. `/vi/` pages are new.

- [ ] **Step 11: Commit**

```bash
git add "src/app/(en)" "src/app/(vi)" src/app/global-not-found.tsx src/components/SiteShell.tsx next.config.ts src/lib/seo.ts src/lib/site.ts src/app/sitemap.ts scripts/package-site.mjs scripts/check-export.mjs scripts/check-seo.mjs tests/routes.test.mjs
git add -u src/app
git commit -m "feat(i18n): /vi/ mirrors every page under its own root layout (lang=vi), one bilingual 404, 24-page sitemap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git add -u src/app` stages only the moves and deletions under `src/app`. Check `git status` first: nobody else edits there in Wave D.)

### Task 19: SEO in both languages: hreflang, og:locale, structured data, and check-seo (M, ∥ Task 20)

**Files:**
- Modify: `src/lib/seo.ts`, `scripts/check-seo.mjs`, `tests/views.test.mjs`

- [ ] **Step 1: Failing test** (append to `tests/views.test.mjs`)

```js
const { organizationData, websiteData } = await import("../src/lib/seo.ts");

test("every page names both language versions, x-default being English, and its og:locale", () => {
  for (const [locale, own, other] of [["en", "en_US", "vi_VN"], ["vi", "vi_VN", "en_US"]]) {
    const m = meta.aboutMetadata(locale);
    assert.deepEqual(m.alternates.languages, { en: "https://spacegear.tech/about/", vi: "https://spacegear.tech/vi/about/", "x-default": "https://spacegear.tech/about/" });
    assert.equal(m.openGraph.locale, own);
    assert.deepEqual(m.openGraph.alternateLocale, [other]);
  }
  assert.equal(meta.homeMetadata("vi").alternates.languages.vi, "https://spacegear.tech/vi/");
});

test("the Organization is spacegear (alternate name spacegear.tech) with the owner's address and phone; the WebSite names its language", () => {
  const vi = organizationData("vi");
  assert.equal(vi.name, "spacegear");
  assert.equal(vi.alternateName, "spacegear.tech");
  assert.equal(vi.telephone, "+84386749799");
  assert.deepEqual(vi.address, { "@type": "PostalAddress", streetAddress: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh", addressLocality: "Thành phố Hồ Chí Minh", addressCountry: "VN" });
  assert.deepEqual(organizationData("en").address, { "@type": "PostalAddress", streetAddress: "11 B4 Street, Sala Urban Area, An Khanh Ward", addressLocality: "Ho Chi Minh City", addressCountry: "VN" });
  assert.equal(organizationData("en")["@id"], organizationData("vi")["@id"], "one organization");
  assert.deepEqual([websiteData("en").inLanguage, websiteData("vi").inLanguage], ["en", "vi"]);
  assert.equal(websiteData("vi")["@id"], "https://spacegear.tech/vi/#website");
  assert.equal(websiteData("en")["@id"], "https://spacegear.tech/#website");
});
```

Run: `node --import tsx --test tests/views.test.mjs`
Expected: FAIL (no `languages`, no `locale`, name `spacegear.tech`).

- [ ] **Step 2: `src/lib/seo.ts`** (whole file)

```ts
import type { Metadata } from "next";
import { dictionary } from "./i18n/dictionary";
import { HTML_LANG, LOCALES, OG_LOCALE, alternatePaths, localizedHref, type Locale } from "./i18n/locales";
import { BRAND_NAME, SITE, siteFor } from "./site";

export function canonicalUrl(path: string) { return new URL(path, SITE.origin).href; }

type MetadataInput = {
  title: string; description: string;
  /** The page's English path ("/about/"); with `languages`, the paths of the versions that exist (a Labs article may have one). */
  path: string; locale: Locale; languages?: Partial<Record<Locale, string>>;
  type?: "website" | "article"; image?: { url: string; width: number; height: number; alt: string };
  publishedTime?: string; modifiedTime?: string;
};

/**
 * A page's metadata in one language: its own canonical; hreflang links to every language version, with x-default
 * pointing at the English one (when there is one); og:locale and og:locale:alternate.
 */
export function buildMetadata({ title, description, path, locale, languages, type = "website", image, publishedTime, modifiedTime }: MetadataInput): Metadata {
  const t = dictionary(locale).meta;
  const versions = languages ?? alternatePaths(path);
  const url = canonicalUrl(versions[locale] ?? localizedHref(path, locale));
  const fullTitle = path === "/" ? `${SITE.name} | ${t.homeTitle}` : `${title} | ${SITE.name}`;
  const og = image ?? { url: "/seo/og.png", width: 1200, height: 630, alt: t.ogImageAlt };
  const hreflang: Record<string, string> = {};
  for (const version of LOCALES) if (versions[version]) hreflang[HTML_LANG[version]] = canonicalUrl(versions[version]);
  if (versions.en) hreflang["x-default"] = canonicalUrl(versions.en);
  const common = {
    siteName: SITE.name, title: fullTitle, description, url, locale: OG_LOCALE[locale],
    alternateLocale: LOCALES.filter((version) => version !== locale && versions[version]).map((version) => OG_LOCALE[version]), images: [og],
  };
  return {
    title: { absolute: fullTitle }, description, alternates: { canonical: url, languages: hreflang },
    openGraph: type === "article" ? { ...common, type: "article", publishedTime, modifiedTime } : { ...common, type: "website" },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [og.url] },
  };
}

export function breadcrumbData(items: { name: string; path: string }[], locale: Locale) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: canonicalUrl(localizedHref(item.path, locale)) })) };
}

/** The root layouts' metadata: defaults for every page of one language. */
export function siteMetadata(locale: Locale): Metadata {
  return {
    metadataBase: new URL(SITE.origin), title: `${SITE.name} | ${dictionary(locale).meta.homeTitle}`, description: siteFor(locale).description,
    robots: { index: SITE.publicationMode === "production", follow: SITE.publicationMode === "production" },
    // Brand kit (docs/brand/): favicon.ico comes from the src/app convention; the web manifest is src/app/manifest.ts.
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }] },
  };
}

/**
 * The organization, the same node on every page (one @id), described in the page's language. Its name is the
 * Google Business Profile name ("spacegear"), and the site name is its alternate name. The address and the phone
 * are the owner's (Site identity). No postal code was given, so none is set.
 */
export function organizationData(locale: Locale) {
  const site = siteFor(locale);
  return {
    "@type": "Organization", "@id": `${SITE.origin}/#organization`, name: BRAND_NAME, alternateName: SITE.name, url: SITE.origin,
    description: site.description, logo: `${SITE.origin}/icon-512.png`, ...(SITE.contactEmail ? { email: SITE.contactEmail } : {}),
    telephone: site.telephone,
    address: { "@type": "PostalAddress", streetAddress: site.address.street, addressLocality: site.address.locality, addressCountry: "VN" },
  };
}

/** One WebSite per language (its home page's URL), with its language. */
export function websiteData(locale: Locale) {
  const home = canonicalUrl(localizedHref("/", locale));
  return { "@type": "WebSite", "@id": `${home}#website`, url: home, name: SITE.name, inLanguage: HTML_LANG[locale], publisher: { "@id": `${SITE.origin}/#organization` } };
}
```

- [ ] **Step 3: `scripts/check-seo.mjs`: check both languages**

1. Add `lang`, `hreflang` and the og tags to the per-route `page.evaluate`:

```js
      lang: document.documentElement.lang,
      hreflang: Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(el => [el.hreflang, el.href])),
      ogLocale: document.querySelector('meta[property="og:locale"]')?.content,
      ogAlternate: [...document.querySelectorAll('meta[property="og:locale:alternate"]')].map(el => el.content),
```

2. Before the loop, add `const LOCALE_OF = route => route === "/vi/" || route.startsWith("/vi/") ? "vi" : "en"; const versions = new Map();`. After the existing per-route assertions, add:

```js
    const locale = LOCALE_OF(route);
    const english = locale === "vi" ? route.replace(/^\/vi\//, "/") : route;
    const vietnamese = locale === "vi" ? route : `/vi${route}`;
    assert.equal(data.lang, locale, `${route}: <html lang="${locale}">`);
    assert.deepEqual(data.hreflang, { en: new URL(english, canonicalOrigin).href, vi: new URL(vietnamese, canonicalOrigin).href, "x-default": new URL(english, canonicalOrigin).href }, `${route}: hreflang names both versions and x-default (English)`);
    versions.set(route, JSON.stringify(data.hreflang));
    assert.equal(data.ogLocale, locale === "vi" ? "vi_VN" : "en_US", `${route}: og:locale`);
    assert.deepEqual(data.ogAlternate, [locale === "vi" ? "en_US" : "vi_VN"], `${route}: og:locale:alternate`);
    const graph = data.jsonLd.flatMap(block => block["@graph"] ?? [block]);
    const organization = graph.find(node => node["@type"] === "Organization");
    assert.ok(organization && organization.name === "spacegear" && organization.alternateName === "spacegear.tech" && organization.telephone === "+84386749799" && organization.address?.addressCountry === "VN", `${route}: Organization "spacegear" with the owner's address and phone`);
    assert.equal(organization.address.addressLocality, locale === "vi" ? "Thành phố Hồ Chí Minh" : "Ho Chi Minh City", `${route}: the address in the page's language`);
    assert.equal(graph.find(node => node["@type"] === "WebSite")?.inLanguage, locale, `${route}: WebSite inLanguage`);
```

3. After the loop, hreflang must point both ways:

```js
  for (const [route, links] of versions) {
    const twin = LOCALE_OF(route) === "vi" ? route.replace(/^\/vi\//, "/") : `/vi${route}`;
    assert.equal(versions.get(twin), links, `${route} and ${twin} name each other the same way`);
  }
  // The sitemap lists every page with its alternates (xhtml:link), x-default included.
  for (const entry of sitemap.split("<url>").slice(1)) {
    const languages = [...entry.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)"/g)].map(m => m[1]).sort();
    assert.deepEqual(languages, ["en", "vi", "x-default"], `sitemap alternates for ${entry.match(/<loc>([^<]+)<\/loc>/)?.[1]}`);
  }
```

4. Extend the 404 list with Vietnamese paths:

```js
  for (const route of ["/unknown-page/", "/vi/unknown-page/", "/labs/old-demo/", "/vi/labs/old-demo/", "/work/old-demo/", "/api/unknown"])
```

5. Change the final message to `SEO crawl passed: ${report.length} pages in English and Vietnamese, …`.

- [ ] **Step 4: Tests, gates, the SEO crawl**

Run: `node --import tsx --test tests/views.test.mjs && npm run lint && npm run typecheck && npm test`. Expected: PASS.

Run (wt.sh): `rebuild`, then `npm run check:seo -- http://127.0.0.1:8792`. Expected: `SEO crawl passed: 24 pages in English and Vietnamese, …`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo.ts scripts/check-seo.mjs tests/views.test.mjs
git commit -m "feat(seo): hreflang both ways, og:locale, Organization spacegear with the owner's address and phone, WebSite inLanguage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 20: `scripts/locale-checks.mjs`: diacritics, widths, cursor labels, leaks, fonts, the switch and the redirect (M, ∥ Task 19)

**Files:**
- Create: `scripts/locale-checks.mjs`
- Modify (only if a check finds a real clip): `src/app/globals.css` (`.hero-word-mask` / `.fx-split-mask` padding)

The script runs alone against the preview, with the dictionary loaded from TypeScript:

`bash "<wt.sh>" "E:/Personal/clone website/spacegear-hero" 8792 run node --experimental-strip-types scripts/locale-checks.mjs http://127.0.0.1:8792`

Task 21 wires it into `browser-check`.

- [ ] **Step 1: Write `scripts/locale-checks.mjs`**

```js
// Browser checks for the Vietnamese site and the language routing (bilingual plan, Task 20), against the running
// preview (wrangler dev, which runs the Worker). Run alone, with the TypeScript dictionary:
//   node --experimental-strip-types scripts/locale-checks.mjs <base URL>
// scripts/browser-check.mjs runs them too (localeChecks). What they prove:
// - masked text (the hero's word masks, the split section titles) never clips a stacked diacritic (Ấ, Ở, Ữ): each
//   glyph run's ink, from canvas text metrics, must sit inside its mask's clip box, at rest;
// - the Vietnamese pages fit 320, 390, 768 and 1440 px (no text box crosses the viewport, no sideways scroll), and
//   the longer Vietnamese hero headline (92 px at 1440) does not run into the pitch below it;
// - the cursor's Vietnamese labels (Xem, Kéo, Mở, set in capitals) fit inside the orange disc;
// - no English UI or content string shows on a Vietnamese page, and Vietnamese pages link only to Vietnamese pages
//   or shared files (the language switch excepted);
// - English pages never download a Vietnamese font subset, and Vietnamese pages render their letters in SG Inter;
// - the switch: keyboard-reachable, named "EN – English" and "VI – Tiếng Việt", the current one marked, working
//   without JavaScript through ?lang= and the sg_lang cookie;
// - the redirect: a visitor from Vietnam (x-sg-test-country, which only the local preview honours) or with a
//   Vietnamese browser lands on the /vi/ twin; a visitor with the cookie, or on a /vi/ URL, is never moved.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { dictionary } = await import("../src/lib/i18n/dictionary.ts");
const VI_ROUTES = ["/vi/", "/vi/about/", "/vi/approach/", "/vi/contact/", "/vi/services/", "/vi/services/applied-ai/", "/vi/privacy/", "/vi/terms/"];
const WIDTHS = [320, 390, 768, 1440];
const SWITCH = /[?&]lang=(?:en|vi)\b/;
const SHARED = /^\/(?:_next|images|uploads|textures|models|seo|licenses|admin|api)\/|^\/[^/]+\.[A-Za-z0-9]+$/;

/** English strings that must never show on a Vietnamese page: UI strings that differ in Vietnamese (2+ words), and English content text (3+ words) that differs from its Vietnamese twin. */
function englishStrings() {
  const leaves = (value, out = []) => (typeof value === "string" ? [...out, value] : Array.isArray(value) ? value.flatMap((item) => leaves(item)) : value && typeof value === "object" ? Object.values(value).flatMap((item) => leaves(item)) : out);
  const pairs = (a, b) => { const x = leaves(a), y = leaves(b); return x.map((text, i) => [text, y[i]]); };
  const ui = pairs(dictionary("en"), dictionary("vi")).filter(([english, vietnamese]) => english !== vietnamese && english.split(/\s+/).length >= 2).map(([english]) => english);
  const files = ["home", "sections", "work", "services-panel", "process", "measure", "faq-card", "team", "footer"];
  const content = files.flatMap((name) => pairs(JSON.parse(readFileSync(new URL(`../content/${name}.json`, import.meta.url), "utf8")), JSON.parse(readFileSync(new URL(`../content/vi/${name}.json`, import.meta.url), "utf8"))))
    .filter(([english, vietnamese]) => english !== vietnamese && english.split(/\s+/).length >= 3).map(([english]) => english);
  return [...new Set([...ui, ...content])].map((text) => text.replace(/\{\w+\}/g, "").trim()).filter((text) => text.length >= 8);
}

/** In the page: every text run inside a mask whose glyph ink (canvas metrics) leaves the mask's clip box. */
const clippedInk = () => {
  const ctx = document.createElement("canvas").getContext("2d");
  const out = [];
  for (const mask of document.querySelectorAll(".hero-word-mask, .fx-split-mask")) {
    const clip = mask.getBoundingClientRect();
    const walker = document.createTreeWalker(mask, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (!text) continue;
      const style = getComputedStyle(node.parentElement);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = ctx.measureText(text);
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) {
        // A text box is the inline content area: its top is the baseline minus the font's ascent.
        const baseline = box.top + metrics.fontBoundingBoxAscent;
        const inkTop = baseline - metrics.actualBoundingBoxAscent;
        const inkBottom = baseline + metrics.actualBoundingBoxDescent;
        if (inkTop < clip.top - 0.5 || inkBottom > clip.bottom + 0.5) out.push({ text, above: Math.round(clip.top - inkTop), below: Math.round(inkBottom - clip.bottom) });
      }
    }
  }
  return out;
};

/** In the page: text boxes under main that cross the viewport, and whether the page scrolls sideways. */
const overflow = () => ({
  sideways: document.documentElement.scrollWidth > innerWidth + 1,
  clipped: [...document.querySelectorAll("main h1, main h2, main h3, main p, main label, main li")].filter((el) => !el.closest("[data-snap-row]")).flatMap((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].some((rect) => rect.right > innerWidth + 1 || rect.left < -1) ? [el.textContent.trim().slice(0, 60)] : [];
  }),
});

async function settle(page) {
  for (let y = 0, height = await page.evaluate(() => document.documentElement.scrollHeight); y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1500);
}

export async function localeChecks(browser, base) {
  const done = [];
  const leaks = englishStrings();

  // 1. Diacritics in masks: the hero at rest (reduced motion) and the split titles (fine-pointer desktop, after they rose).
  for (const [label, options] of [["reduced motion", { reducedMotion: "reduce" }], ["desktop motion", {}]]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
    const page = await context.newPage();
    for (const route of ["/vi/", "/vi/services/applied-ai/"]) {
      await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await settle(page);
      assert.deepEqual(await page.evaluate(clippedInk), [], `${label} ${route}: no stacked diacritic is clipped by a mask`);
    }
    await context.close();
    done.push(`locale: ${label}: hero and split-title masks keep every Vietnamese diacritic (ink inside the clip box)`);
  }

  // 2. Widths, and the hero headline at 92 px.
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: width >= 1024 ? 1000 : 844 }, reducedMotion: "reduce" });
    for (const route of VI_ROUTES) {
      await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      const result = await page.evaluate(overflow);
      assert.equal(result.sideways, false, `${route} at ${width}px: no sideways scroll`);
      assert.deepEqual(result.clipped, [], `${route} at ${width}px: text fits`);
    }
    await page.goto(new URL("/vi/", base).href, { waitUntil: "networkidle" });
    const hero = await page.evaluate(() => {
      const h1 = document.querySelector("#home h1").getBoundingClientRect();
      const next = document.querySelector("#home h1 + *")?.getBoundingClientRect();
      return { fontSize: parseFloat(getComputedStyle(document.querySelector("#home h1")).fontSize), bottom: h1.bottom, nextTop: next?.top ?? Infinity, lines: Math.round(h1.height / (parseFloat(getComputedStyle(document.querySelector("#home h1")).lineHeight) || 1)) };
    });
    assert.ok(hero.bottom <= hero.nextTop + 1, `/vi/ at ${width}px: the headline (${hero.fontSize}px, ${hero.lines} lines) does not run into the pitch`);
    done.push(`locale: /vi/ pages fit ${width}px; hero headline ${hero.fontSize}px on ${hero.lines} lines`);
    await page.close();
  }

  // 3. Cursor labels fit the disc (fine-pointer desktop).
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(new URL("/vi/", base).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-fx"), null, { timeout: 10000 });
    for (const label of [dictionary("vi").cursor.view, dictionary("vi").cursor.open]) {
      const target = page.locator(`[data-cursor="${label}"]`).first();
      await target.scrollIntoViewIfNeeded();
      await target.hover();
      await page.waitForTimeout(600);
      const fit = await page.evaluate((text) => {
        const cursor = document.querySelector(".fx-cursor");
        const labelEl = [...(cursor?.querySelectorAll("*") ?? [])].find((el) => el.textContent.trim() === text && el.children.length === 0);
        const disc = cursor?.querySelector(".fx-cursor-disc");
        if (!labelEl || !disc) return null;
        const a = labelEl.getBoundingClientRect(), d = disc.getBoundingClientRect();
        return { width: a.width, height: a.height, disc: Math.min(d.width, d.height), inside: a.left >= d.left && a.right <= d.right && a.top >= d.top && a.bottom <= d.bottom };
      }, label);
      assert.ok(fit && fit.inside, `cursor label "${label}" sits inside the disc (${JSON.stringify(fit)})`);
    }
    await page.close();
    done.push("locale: the cursor's Vietnamese labels (XEM, MỞ) fit inside the disc");
  }

  // 4. No English on Vietnamese pages; Vietnamese pages link to Vietnamese pages.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, javaScriptEnabled: false });
    for (const route of VI_ROUTES) {
      await page.goto(new URL(route, base).href);
      const found = await page.evaluate((strings) => {
        const text = document.body.innerText;
        const attrs = [...document.querySelectorAll("[aria-label], [placeholder], [data-cursor], [alt]")].map((el) => [el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.getAttribute("data-cursor"), el.getAttribute("alt")].filter(Boolean).join(" ")).join(" ");
        return strings.filter((english) => text.includes(english) || attrs.includes(english));
      }, leaks);
      assert.deepEqual(found, [], `${route}: no English strings`);
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href^='/'], form[action^='/']")].map((el) => el.getAttribute("href") ?? el.getAttribute("action")));
      const english = links.filter((href) => !href.startsWith("/vi/") && !href.startsWith("//") && !SWITCH.test(href) && !SHARED.test(href.split(/[?#]/)[0]));
      assert.deepEqual(english, [], `${route}: links stay in Vietnamese`);
    }
    await page.close();
    done.push(`locale: ${VI_ROUTES.length} Vietnamese pages show no English UI or copy and link only to Vietnamese pages`);
  }

  // 5. Fonts.
  {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const fonts = [];
      page.on("request", (request) => { if (request.url().endsWith(".woff2")) fonts.push(request.url()); });
      await page.goto(base, { waitUntil: "networkidle" });
      await settle(page);
      assert.deepEqual(fonts.filter((url) => /vietnamese/.test(url)), [], `English home at ${viewport.width}px downloads no Vietnamese subset`);
      await page.goto(new URL("/vi/", base).href, { waitUntil: "networkidle" });
      assert.ok(fonts.some((url) => /inter_vietnamese/.test(url)), `the Vietnamese home at ${viewport.width}px loads the Vietnamese Inter subset`);
      assert.ok(await page.evaluate(() => document.fonts.check('16px "SG Inter"', "Ấ Ở Ữ đ")), "SG Inter renders Vietnamese letters");
      await page.close();
    }
    done.push("locale: English pages never download the Vietnamese subsets; Vietnamese pages render in SG Inter");
  }

  // 6. The redirect and the cookie, over HTTP.
  {
    const head = (path, headers = {}) => fetch(new URL(path, base), { redirect: "manual", headers });
    let response = await head("/about/?lang=vi&utm_source=x");
    assert.equal(response.status, 302);
    assert.equal(new URL(response.headers.get("location"), base).pathname + new URL(response.headers.get("location"), base).search, "/vi/about/?utm_source=x");
    assert.equal(response.headers.get("set-cookie"), "sg_lang=vi; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
    response = await head("/services/applied-ai/", { "x-sg-test-country": "VN" });
    assert.equal(response.status, 302);
    assert.equal(new URL(response.headers.get("location"), base).pathname, "/vi/services/applied-ai/");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("vary"), "Cookie, Accept-Language");
    assert.equal((await head("/about/", { "accept-language": "vi-VN,vi;q=0.9" })).status, 302, "a Vietnamese browser is sent to /vi/");
    assert.equal((await head("/about/", { "x-sg-test-country": "VN", cookie: "sg_lang=en" })).status, 200, "the cookie wins");
    assert.equal((await head("/vi/about/", { cookie: "sg_lang=en" })).status, 200, "a /vi/ URL is never moved");
    assert.equal((await head("/about/")).status, 200, "the preview ignores its cached request.cf");
    done.push("locale: ?lang= sets sg_lang for a year; VN or a Vietnamese browser lands on /vi/ (no-store, Vary); the cookie and /vi/ URLs are never redirected");
  }

  // 7. The switch in a browser: keyboard, names, current language, with and without JavaScript, and the cookie.
  for (const javaScriptEnabled of [true, false]) {
    // Chromium keeps a Secure cookie over plain http only on a loopback origin (127.0.0.1 or localhost), as here.
    const local = new URL(base);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, javaScriptEnabled, extraHTTPHeaders: { "x-sg-test-country": "VN" } });
    const page = await context.newPage();
    await page.goto(new URL("/about/", local).href, { waitUntil: "load" });
    assert.equal(new URL(page.url()).pathname, "/vi/about/", "a first visit from Vietnam lands on the Vietnamese twin");
    assert.equal(await page.evaluate(() => document.documentElement.lang), "vi");
    const english = page.getByRole("link", { name: "EN – English", exact: true });
    const vietnamese = page.getByRole("link", { name: "VI – Tiếng Việt", exact: true });
    assert.equal(await vietnamese.getAttribute("aria-current"), "true", "the current language is marked");
    assert.equal(await english.getAttribute("aria-current"), null);
    await english.focus();
    assert.equal(await english.evaluate((el) => el === document.activeElement), true, "the switch takes keyboard focus");
    await Promise.all([page.waitForURL((url) => url.pathname === "/about/"), page.keyboard.press("Enter")]);
    assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
    assert.ok((await context.cookies()).some((cookie) => cookie.name === "sg_lang" && cookie.value === "en"), "the choice is stored");
    await page.goto(new URL("/contact/", local).href, { waitUntil: "load" });
    assert.equal(new URL(page.url()).pathname, "/contact/", "with the cookie, a visitor from Vietnam stays on English");
    await context.close();
    done.push(`locale: the EN/VI switch works by keyboard ${javaScriptEnabled ? "with" : "without"} JavaScript and is remembered`);
  }
  return done;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2];
  if (!base) { console.error("usage: node --experimental-strip-types scripts/locale-checks.mjs <base URL of the preview>"); process.exit(2); }
  const { launchBrowser } = await import("./browser-runtime.mjs");
  const browser = await launchBrowser();
  try {
    const done = await localeChecks(browser, base);
    console.log(done.join("\n"));
    console.log(`Locale checks passed: ${done.length} checks.`);
  } finally { await browser.close(); }
}
```

- [ ] **Step 2: Run it**

Run: `bash "<wt.sh>" "E:/Personal/clone website/spacegear-hero" 8792 run node --experimental-strip-types scripts/locale-checks.mjs http://127.0.0.1:8792`
Expected: `Locale checks passed: 12 checks.` That is 2 mask profiles, 4 widths, the cursor, leaks, fonts, HTTP and 2 switch runs.

If the "the choice is stored" assertion fails only because Chromium refused the Secure cookie on `127.0.0.1`, run with `http://localhost:8792` instead, and note it in the report. The cookie's attributes are fixed by the spec.

- [ ] **Step 3: Fix what it finds, in the owning place**

- **A clipped diacritic.** The output names the text and the pixels above or below. Raise the top padding (and the matching negative margin) of `.hero-word-mask` or `.fx-split-mask` in `src/app/globals.css` by the reported amount, rounded up to 0.02 em (for example `padding: 0.40em 0.1em 0.18em; margin: -0.40em -0.1em -0.18em;`). Run the check again, then `node scripts/fx-checks.mjs` for English, which must stay unchanged in layout (`FX_ONLY="split|hero"`).
- **A width overflow.** Fix the component's text wrapping (`break-words`) in its own file.
- **A headline collision.** Report it to the controller with a screenshot; the owner decides on copy or size.
- **An English leak.** The component still reads English: fix it with `useLocale()`/`locale` as in Tasks 12–15.
- **A cursor label outside the disc.** Report it. `Cursor.tsx` and the cursor CSS belong to Part 1 (`feat/cursor-smooth`); do not edit them here.

- [ ] **Step 4: Gates and commit**

Run: `npm run lint`. Expected: pass.

```bash
git add scripts/locale-checks.mjs
git add src/app/globals.css   # only if Step 3 changed it
git commit -m "test(i18n): browser checks for /vi/ (diacritics, widths, cursor labels, leaks, fonts) and the language routing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 21: browser-check, fx-checks and identity-check cover `/vi/` (M)

**Files:**
- Modify: `package.json` (`test:browser`), `scripts/browser-check.mjs`, `scripts/fx-checks.mjs`, `scripts/identity-check.mjs`

- [ ] **Step 1: Load the TypeScript dictionary in browser-check**

In `package.json`: `"test:browser": "node --experimental-strip-types scripts/browser-check.mjs",`

- [ ] **Step 2: `scripts/identity-check.mjs`: the nav's names per language**

```js
const { dictionary } = await import("../src/lib/i18n/dictionary.ts");
const localeOf = (route) => (route === "/vi/" || route.startsWith("/vi/") ? "vi" : "en");
export const NAV_HOME_NAME = dictionary("en").nav.homeLink;
```

In `identityOnPage`, replace the first line with:

```js
  const nav = dictionary(localeOf(route)).nav;
  const home = page.getByRole("navigation", { name: nav.label }).getByRole("link", { name: nav.homeLink, exact: true });
  assert.equal(await home.count(), 1, `${route}: the nav's home link is named "${nav.homeLink}"`);
```

(the rest of the function is the same). The 320 px sweep in browser-check already visits all 24 sitemap routes.

- [ ] **Step 3: `scripts/browser-check.mjs`: the Vietnamese profiles and the locale checks**

1. Imports: `import { localeChecks } from "./locale-checks.mjs";`
2. Next to `hiddenText`, add:

```js
// Links and buttons whose aria-label does not hold their visible text (WCAG 2.5.3); text without letters (an arrow) is decoration.
const labelInName = page => page.evaluate(() => [...document.querySelectorAll("a[aria-label], button[aria-label]")].filter(el => {
  const visible = el.innerText.replace(/\s+/g, " ").trim();
  return /\p{L}/u.test(visible) && !el.getAttribute("aria-label").toLowerCase().includes(visible.toLowerCase());
}).map(el => `${el.getAttribute("aria-label")} / ${el.innerText.trim()}`));
```

3. After the main `for (const profile of […])` loop, add:

```js
  // Vietnamese pages (bilingual spec, "Tests and gates"): home, contact and a service page in the desktop, mobile,
  // reduced-motion and no-JS profiles: no page or hydration error, no CSP violation, CLS under 0.05, the headline in
  // its masks and named as one sentence, every accessible name holding its visible text. The no-JS and
  // reduced-motion hidden-text sweeps above already cover every /vi/ route (they read the sitemap).
  for (const profile of [
    { name: "vi desktop", width: 1440, height: 1000 },
    { name: "vi mobile-390", width: 390, height: 844 },
    { name: "vi reduced-motion", width: 1440, height: 1000, reducedMotion: "reduce" },
    { name: "vi no-javascript", width: 1440, height: 1000, javaScriptEnabled: false },
  ]) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, reducedMotion: profile.reducedMotion, javaScriptEnabled: profile.javaScriptEnabled });
    const cspProblems = await watchCsp(context);
    await context.addInitScript(fakeGpu, SOFTWARE_RENDERER);
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && /hydrat|error #4(18|23|25)\b/i.test(message.text())) errors.push(message.text().slice(0, 300)); });
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value; }).observe({ type: "layout-shift", buffered: true }); });
    for (const route of ["/vi/", "/vi/contact/", "/vi/services/applied-ai/"]) {
      await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      if (route === "/vi/") {
        const words = await heroWords(page);
        assert.ok(words.masked && words.count >= 5, `${profile.name}: the Vietnamese headline sits in its word masks (${JSON.stringify(words)})`);
        assert.deepEqual(words.clipped, [], `${profile.name}: no Vietnamese headline word is clipped by its mask`);
        assert.ok(!/\s[,.]/.test(words.text), `${profile.name}: the Vietnamese headline reads as a sentence (${words.text})`);
        assert.equal(await page.getByRole("heading", { level: 1, name: words.text, exact: true }).count(), 1, `${profile.name}: the headline's accessible name is the whole sentence`);
      } else {
        const h1 = (await page.locator("h1").innerText()).replace(/\s+/g, " ").trim();
        assert.equal(await page.getByRole("heading", { level: 1, name: h1, exact: true }).count(), 1, `${profile.name} ${route}: one h1, named by its text`);
      }
      assert.deepEqual(await labelInName(page), [], `${profile.name} ${route}: accessible names hold the visible text`);
      if (profile.javaScriptEnabled !== false) {
        const cls = await page.evaluate(() => window.__cls);
        assert.ok(cls < 0.05, `${profile.name} ${route}: cumulative layout shift ${cls}`);
      }
    }
    assert.deepEqual(errors, [], `${profile.name}: no page or hydration errors`);
    assert.deepEqual(cspProblems, [], `${profile.name}: no CSP violations`);
    await context.close();
    report.interactions.push(`${profile.name}: /vi/, /vi/contact/ and /vi/services/applied-ai/ hydrate cleanly, CLS under 0.05, the headline masked and named, names hold visible text`);
  }
```

(The headline's verbs are single masks that hold a space ("hoạch định,"), so the English rule "one mask per word" is `count >= 5` here.)

4. After the 320 px loop, add `report.interactions.push(...await localeChecks(browser, base));`. Change the 320 px message `"all 12 routes: …"` to `` `all ${routes.length} routes: …` ``.

- [ ] **Step 4: `scripts/fx-checks.mjs`: `FX_LOCALE=vi`**

Replace the two copy reads at the top with:

```js
// FX_LOCALE=vi runs the checks on the Vietnamese pages (/vi/…) with the Vietnamese copy and UI strings. It loads the
// TypeScript dictionary, so run it as: FX_LOCALE=vi node --experimental-strip-types scripts/fx-checks.mjs <base>.
// browser-check.mjs never sets it (the English run).
const LOCALE = process.env.FX_LOCALE === "vi" ? "vi" : "en";
const COPY = LOCALE === "vi" ? "../content/vi/" : "../content/";
const SECTION_COPY = JSON.parse(readFileSync(new URL(`${COPY}sections.json`, import.meta.url), "utf8"));
const MEASURE_COPY = JSON.parse(readFileSync(new URL(`${COPY}measure.json`, import.meta.url), "utf8"));
const HOME_COPY = JSON.parse(readFileSync(new URL(`${COPY}home.json`, import.meta.url), "utf8"));
/** The UI names the checks look for, and a site path in the run's language. */
const { NAMES, PATH } = LOCALE === "en"
  ? { NAMES: { about: "About", contact: "Contact", cta: "Discuss a project", select: "Select", selected: "Selected" }, PATH: (path) => path }
  : await (async () => {
    const { dictionary } = await import("../src/lib/i18n/dictionary.ts");
    const { localizedHref } = await import("../src/lib/i18n/locales.ts");
    const t = dictionary("vi");
    return { NAMES: { about: t.nav.about, contact: t.nav.contact, cta: t.nav.cta, select: t.pricing.select, selected: t.pricing.selected }, PATH: (path) => localizedHref(path, "vi") };
  })();
```

(if the file already reads `content/home.json` into `HOME_COPY` further down, remove that read). Then:
- `fresh(page, base, path = "/")` becomes `fresh(page, base, path = PATH("/"))`;
- every `name: "About"` becomes `name: NAMES.about`;
- `"Discuss a project"` becomes `NAMES.cta` and `"Contact"` becomes `NAMES.contact`;
- `/^Select/` becomes `new RegExp(`^${NAMES.select}`)`;
- `/^Select /` becomes `new RegExp(`^${NAMES.select} `)`;
- every site path the checks navigate to or expect (for example `"/about/"`, `"/#pricing"`, `"#work"` stays) goes through `PATH(…)`.

Find them all:

`grep -nE '"(About|Contact|Discuss a project)"|/\^Select|"/[a-z#]' scripts/fx-checks.mjs`

Expected after the edit: every hit is inside `NAMES` or `PATH(…)`, or is a hash-only link.

- [ ] **Step 5: Run the English and Vietnamese motion checks**

Run (wt.sh): `node scripts/fx-checks.mjs http://127.0.0.1:8792`. Expected: `FX checks passed`.
Run (wt.sh): `FX_LOCALE=vi node --experimental-strip-types scripts/fx-checks.mjs http://127.0.0.1:8792`. Expected: `FX checks passed`, the same check count.

If a Vietnamese run fails on a layout figure that is English-specific (for example the width of a CTA), make the check read the value from the page instead of a constant. Never weaken a check.

- [ ] **Step 6: Gates and commit**

Run: `npm run lint && npm run typecheck && npm test`. Expected: pass. The full `test:browser` runs once, in Task 22.

```bash
git add package.json scripts/browser-check.mjs scripts/fx-checks.mjs scripts/identity-check.mjs
git commit -m "test(i18n): browser-check, fx-checks and identity-check cover the Vietnamese pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 22: README, and the final gates for Part 2 (M)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README**

Update or add these sections (plain prose, no class names):

1. **"Languages"** (new, after "Editing content"):
   - English at today's URLs, Vietnamese under `/vi/` with the same slugs;
   - one component tree: server components take `locale`, client components call `useLocale()`;
   - the views pattern (`src/views/`, `src/views/metadata.ts`, the wrappers in `src/app/(en)` and `src/app/(vi)/vi`);
   - adding a UI string: add it to `src/lib/i18n/en.ts` and `vi.ts`; `npm run typecheck` fails if one is missing;
   - the region redirect and the `sg_lang` cookie (worker/locale.ts);
   - the `?lang=` switch;
   - testing the redirect locally with `curl -H "x-sg-test-country: VN" http://127.0.0.1:<port>/about/` (the preview ignores its cached `request.cf`, which says VN on the owner's machine);
   - the Vietnamese font subsets and `unicode-range`;
   - one 404 in both languages.
2. **"Editing content"**:
   - every CMS entry has an English side and a Vietnamese side;
   - links, images, numbers and the order are copied from English and read-only in Vietnamese;
   - a save writes `content/…` and `content/vi/…`;
   - check-content refuses a missing Vietnamese file, a Vietnamese figure that differs from English, and English-only rules in Vietnamese ("minh họa" for the dashboard);
   - the owner's address and phone live only in Site identity.
3. **"What the build checks"**: the parity check, the Vietnamese honesty patterns and the NAP rule.
4. **"Tailwind and the docs"**: replace with "Tailwind scans `src/` only (`source("..")`), so documentation can quote class names freely".
5. **"What the CMS costs"**: measure the shared content chunk now:
   `node -e "const fs=require('fs'),z=require('zlib'),d='dist/_next/static/chunks/';for(const f of fs.readdirSync(d))if(f.endsWith('.js')){const s=fs.readFileSync(d+f);if(s.includes('Chúng tôi giúp bạn'))console.log(f,s.length,z.gzipSync(s).length)}"`
   Write the raw and gzip sizes, and that only the language a page uses is validated in the browser.

- [ ] **Step 2: The full gates, once**

```bash
cd "E:/Personal/clone website/spacegear-hero"
npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs
bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 rebuild
bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 run npm run check:seo -- http://127.0.0.1:8792
bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 run npm run test:browser -- http://127.0.0.1:8792
bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 run env FX_LOCALE=vi node --experimental-strip-types scripts/fx-checks.mjs http://127.0.0.1:8792
```

Expected:
- `Content valid: 12 routes; preview mode.`;
- `Export valid: 24 core pages, …`;
- `SEO crawl passed: 24 pages in English and Vietnamese, …`;
- `Browser checks passed: …`, with the Vietnamese profile lines and `Locale checks passed` lines in its report;
- `FX checks passed`.

Also run a production build check without deploying:

`SITE_MODE=production npm run build:production` in a temporary copy (`git worktree add ../spacegear-prodcheck HEAD`, with `npm ci` there), or ask the controller to run it.

Expected: check-content in production mode passes. The release values come from `release.env`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): two languages: editing, the Worker redirect, fonts, checks and costs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Report to the controller: the gate output, the measured costs, anything left for the owner (the headline at 92 px, if Task 20 flagged it).

---

## Spec coverage (self-review)

| Spec requirement (Part 2 and contact details) | Task |
|---|---|
| English at today's URLs, all 12 pages mirrored under `/vi/` with the same slugs | 18 |
| One component tree; pages and sections take a locale | 2, 12–15, 17 |
| Static `<html lang>` per language (multiple root layouts; `global-not-found` 404) | 18 |
| Switching language is a full page load; the curtain only within a language | 15 (plain `<a>`), 18 (one template per root layout) |
| One 404 that says it in both languages | 17, 18 |
| `run_worker_first` HTML only, with the exclusions; `/api/*` unchanged | 5 |
| 302 to the `/vi/` twin for VN or Accept-Language `vi`; query kept; no-store and Vary; crawlers not special | 5 (unit), 20 (preview) |
| `?lang=` → `Set-Cookie sg_lang` (1 year, Lax, Secure) and a 302 to the clean URL; never redirected once the cookie exists | 5, 20 |
| The switch in the desktop nav and the mobile menu; keyboard, labels, current marked | 15, 20 |
| hreflang en/vi/x-default; own canonical; sitemap with 24 URLs and `xhtml:link`; JSON-LD `inLanguage`; `og:locale` and alternate; robots unchanged | 18, 19 |
| check-seo for both languages (hreflang both ways, canonicals, one H1, visible no-JS) | 18, 19 |
| Sveltia i18n, `content/vi/` mirrors, field-level `i18n: true`/`duplicate`, keys checked against 0.230.1 | 10 |
| Loader per locale; check-content fails on a missing Vietnamese file or field, or a differing non-text field | 8 |
| Typed dictionary; TypeScript fails on a missing key | 6 |
| Vietnamese copy checked by the honesty scan (content and UI strings) | 1, 6, 7, 8 |
| Field limits widened (hero verbs and tail); layouts at 320/390/768/1440 on `/vi/` | 8, 20 |
| Vietnamese honesty patterns: prices and rates, counts, experience and founding, partners/awards/certifications/press, offices, timelines, results; a planted claim per family | 7 |
| NAP: `address` (localised) and `telephone` in Site identity; Contact, footer, Privacy and Terms; JSON-LD PostalAddress (no postal code) and telephone; owner facts in the honesty scan and check-content | 7, 11, 15, 17, 19 |
| Organization `name: "spacegear"`, `alternateName: "spacegear.tech"` (controller, from the GBP guide); visible title unchanged | 19 |
| Vietnamese Inter and JetBrains Mono subsets, OFL licence updated, `unicode-range` so English pages do not download them | 4, 9, 20 |
| No stacked diacritic clipped in masks; cursor labels (Xem/Kéo/Mở) fit | 20 |
| Tailwind `source("..")`, CSS-diff proof, unneeded `@source not` lines dropped | 3, 9 |
| Unit tests: Worker locale resolution, dictionary completeness, Vietnamese honesty plants, content parity | 5, 6, 7, 8 |
| browser-check on `/vi/` (home, contact, a service page; desktop, mobile, no-JS, reduced motion; hidden text, names, CLS), the switch and the redirect through the preview Worker | 20, 21 |
| fx-checks pass on `/vi/` | 21 |
| Controller items: the honesty scope for `content/vi` first; Unicode-aware edges; "đồng" only near numbers; hero grammar per language; cursor labels; dot thousands / comma decimals in Vietnamese body text, dashboard figures identical | 1, 7, 8, 12, 6 |

## Risks and decisions for the controller

1. **The switch links the English path with `?lang=vi`, not `/vi/…?lang=vi`.**
   - The spec excludes `/vi/*` from `run_worker_first`, so a `?lang=` on a Vietnamese URL would never reach the Worker.
   - With every switch link on the English path, the Worker sees both directions, sets the cookie and redirects to the clean twin. The Vietnamese pages still never invoke the Worker.
   - Visible behaviour is as specified.
2. **Parallel tasks share one working tree.** They therefore run fast gates only, and each wave's integration task builds once. For true parallel builds, give a wave its own worktree with `npm ci`. A `node_modules` junction does not work: Turbopack refuses junctions that point outside the project root.
3. **Client bundle.** Both languages' copy ships in the shared content chunk (about +8.6 KB gzip, cached). Only the language in use is validated at run time. The README records it (Task 22).
4. **The Vietnamese hero headline** is about 82 characters against 58 in English, at 92 px on desktop. Task 20 checks that it does not collide with the pitch. If it wraps to more lines than the owner likes, that is a copy or size decision for the owner, not a code fix.
5. **Cursor.** `Cursor.tsx` and its CSS belong to Part 1 (`feat/cursor-smooth`). This plan only changes the `data-cursor` labels and checks that "XEM" and "MỞ" fit the disc. If Part 1 renames the cursor's classes, adjust the selectors in Task 20's check after the merge.
6. **Sveltia reorder in two languages.** Dragging entries rewrites `order` (`i18n: duplicate`). The parity check catches a Vietnamese order that drifts from English. If the CMS ever writes only the English order, the build says which file to fix. This is untested in a live CMS session. The owner should drag one FAQ on a preview once.
7. **`wrangler types`** may need network access. If it does, Task 5 hand-adds `LOCALE_TEST_HEADER` to `worker-configuration.d.ts`.
8. **Secure cookie on `http://127.0.0.1`.** Chromium treats loopback as a secure context. If the preview refuses the cookie, Task 20 runs the switch check on `http://localhost:8792`.

