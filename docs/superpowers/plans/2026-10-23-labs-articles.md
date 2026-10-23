# Labs articles (Part 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors publish Markdown articles ("Labs") in English and/or Vietnamese from `/admin/`. The site renders them at `/labs/<slug>/` and `/vi/labs/<slug>/`, each with an index, BlogPosting data, hreflang between translations, RSS per language, `/llms.txt`, and honesty and content checks. A language with no articles has no Labs pages at all.

**Architecture:**
- Articles are `content/articles/<slug>.md` (English) and `content/vi/articles/<slug>.md` (Vietnamese), with YAML front matter.
- They are read at build time from disk, like the legal pages (`src/lib/labs-files.ts`), and rendered with markdown-it with raw HTML off (`src/lib/markdown.ts`).
- The Labs route files are named `page.en-labs.tsx` / `page.vi-labs.tsx`. `next.config.ts` adds those extensions to `pageExtensions` only for the languages that have an article, so an empty language has no route. An empty `generateStaticParams` fails `output: "export"` (Part 2 research notes).
- Everything else uses Part 2's interfaces.

**Tech Stack:** Next.js 16.2.7 (`pageExtensions`, route handlers), markdown-it **15.0.2** (exact pin), js-yaml 4.2.0 (already a dependency), Sveltia CMS 0.230.1 (entry collection with i18n, `initial_locales: all`, slug options), node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-bilingual-labs-cursor-design.md`, Part 3. **Depends on Part 2** (`docs/superpowers/plans/2026-10-23-bilingual-site.md`) up to its Task 18 at least. Start after Part 2 Task 22, or after Task 21 if the controller wants overlap. Conventions, worktree, port 8792, the `wt.sh` helper, commit rules and the parallel-task rules are exactly Part 2's "Conventions for every task".

---

## Research notes (verified 2026-10-23)

- **No empty routes.**
  - `generateStaticParams` returning `[]` makes `next build` with `output: "export"` throw E87: `Page "/labs/[slug]" is missing "generateStaticParams()"…`. This was reproduced with a probe build (`artifacts/plan-probe-next`, Next 16.2.7 Turbopack).
  - The same probe proved the fix. Files named `page.en-labs.jsx` and `route.en-labs.js` (a route handler for `rss.xml`) became routes only when `next.config` listed `en-labs.jsx` and `en-labs.js` in `pageExtensions`. Without them, `/labs/` did not exist and the build passed.
  - Next's `next.config.ts` loader transpiles local `.ts` imports (`next/dist/build/next-config-ts/transpile-config.js`: an SWC require hook, or Node's native TypeScript resolver on Node ≥ 22.18). So `next.config.ts` can import `./src/lib/labs-files.ts` (erasable TypeScript, explicit `.ts` import paths).
- **markdown-it 15.0.2.**
  - It was published 2026-09-11, 42 days before this plan. 15.0.3 and 14.3.3 (2026-10-16) are under 14 days old. MIT licence. It ships its own types (`dist/markdown-it.d.mts`).
  - `npm install --save-exact --before=2026-10-09 markdown-it@15.0.2` resolves its dependencies to versions all published before 2026-10-09: argparse 3.0.2, entities 8.1.0, linkify-it 6.1.0, mdurl 2.1.0, punycode.js 2.3.1, uc.micro 3.0.0. That was checked in `artifacts/md-probe`.
  - A probe (`artifacts/md-probe/probe.mjs`) confirmed every piece the renderer uses:
    - `html: false` escapes `<b>` as text;
    - `.disable(["table", "strikethrough"])` works;
    - a core rule can set heading `id`s;
    - `renderer.rules.heading_close`, `link_open` and `image` can be overridden;
    - `env` reaches the rules, so links can be localized;
    - `validateLink` refuses `javascript:`;
    - a second instance with `html: true` exposes `html_block`/`html_inline` tokens for validation;
    - `token.map` gives line numbers.
- **Sveltia CMS 0.230.1.**
  - An entry collection with `folder: content/{{locale}}/articles`, `extension: md` and `format: frontmatter` (reads YAML, TOML or JSON front matter, writes YAML) puts the Markdown widget named `body` after the front matter (`body_field`, default `body`).
  - `i18n: { initial_locales: all }` (merged into the global options) lets an editor switch the Vietnamese version off for an English-only article.
  - **The default locale (English) can never be switched off** (bundle: the toggle is disabled when `locale === defaultLocale`). So a Vietnamese-only article keeps an English file with empty text fields. The loader reads an empty English title as "not published in English". The text fields are `required: false` in the CMS, and check-content enforces completeness per language.
  - `slug: { template: "{{title}}", editable: [create], pattern: [...] }` (`CollectionSlugOptions`) shows a slug field when the entry is created, prefilled from the title and editable then. With the default `i18n: duplicate`, the slug is shared by both languages. After the first save it cannot change, so published URLs stay put.
  - `datetime` takes `format`, `date_format: YYYY-MM-DD` and `time_format: false`. The Markdown widget takes `buttons` (heading-one…six, bold, italic, code, link, quote, lists, strikethrough), `editor_components` and `modes`.
- **js-yaml `JSON_SCHEMA`** keeps `2026-10-23` as a string, not a `Date`, so dates compare as text.
- **The old `articles` collection** (JSON link cards, no entries) is referenced by:
  - `content-model.ts`, `content.ts` (`ARTICLES`), `content-contract.ts` and `tests/fixtures/content-v1.d.ts`;
  - `samples.ts` (`SAMPLE_ARTICLES`), `sections/Labs.tsx`, `content-rules.mjs` (`stockImageProblems`);
  - `build-content-index.mjs` (`COLLECTIONS`), `public/admin/config.yml`, `scripts/admin-check.mjs` (`COLLECTIONS` labels);
  - the tests `content.test.mjs` (`PUBLIC_KEYS`, "testimonials and articles only hold publishable entries"), `content-loader.test.mjs` (articles slug test), `content-rules.test.mjs` (articles stock image), `cms-config.test.mjs`, and `content-exports.test.mjs` (export names, via the fixture).

## Interfaces from Part 2 used here (unchanged names)

`Locale`, `LOCALES`, `HTML_LANG`, `OG_LOCALE`, `localizedHref`, `alternatePaths`, `isSharedPath` (src/lib/i18n/locales.ts); `useLocale` (src/components/LocaleProvider.tsx); `dictionary`, `format`, `formatParts` (src/lib/i18n/dictionary.ts); `getContent` (src/lib/content.ts); `siteFor`, `SITE`, `BRAND_NAME`, `PublishedRoute`, `getPublishedRoutes` (src/lib/site.ts); `buildMetadata` (with `languages`, `type: "article"`, `image`, `publishedTime`, `modifiedTime`), `canonicalUrl`, `breadcrumbData`, `organizationData` (src/lib/seo.ts); `contentImage` (src/lib/content-images.ts); the views pattern (`src/views/*View.tsx` + `src/views/metadata.ts`, wrappers in `src/app/(en)` and `src/app/(vi)/vi`).

## New interfaces (this part)

```ts
// src/lib/labs-files.ts (Task 2): reads and checks the article files; fs + js-yaml only (next.config.ts imports it)
export type ArticleData = { title: string; summary: string; cover: string; coverAlt: string; date: string; updated: string | null; author: string; body: string };
export type ArticleFile = { slug: string; locale: Locale; file: string; data: ArticleData; filled: boolean };
export function readArticleFiles(root?: string): { files: ArticleFile[]; issues: string[] };
export function labsProblems(files: ArticleFile[], options?: { production?: boolean }): string[];
export function publishedArticles(files: ArticleFile[], locale: Locale): ArticleFile[];   // filled, newest first
export function labsLocales(root?: string): Locale[];                                     // languages with at least one published article

// src/lib/markdown.ts (Task 3)
export type RenderedMarkdown = { html: string; headings: { id: string; text: string; level: 2 | 3 | 4 }[]; words: number };
export function renderMarkdown(source: string, locale: Locale): RenderedMarkdown;
export function markdownProblems(source: string, file: string): string[];

// src/lib/labs.ts (Task 5): what the pages render
export type LabsArticle = ArticleData & { slug: string; locale: Locale; path: string; html: string; headings: RenderedMarkdown["headings"]; readingMinutes: number; languages: Partial<Record<Locale, string>> };
export function labsArticles(locale: Locale, root?: string): LabsArticle[];             // newest first
export function labsArticle(locale: Locale, slug: string, root?: string): LabsArticle | undefined;
export function labsRoutes(root?: string): PublishedRoute[];                            // index + articles, per language that has them
```

## File structure

| File | Responsibility |
|---|---|
| `src/lib/labs-files.ts` | Reads `content/articles/*.md` and `content/vi/articles/*.md`, validates front matter and the per-language rules, and lists which languages have articles |
| `src/lib/markdown.ts` | Markdown to HTML (h2–h4 with anchors, lists, links, images through `contentImage`, blockquote, code; no raw HTML) and its validation |
| `src/lib/labs.ts` | Rendered articles per language, their routes and language versions |
| `src/lib/labs-feed.ts` | RSS 2.0 per language and `/llms.txt` text |
| `src/views/LabsIndexView.tsx`, `src/views/LabsArticleView.tsx` | The two Labs pages (+ entries in `src/views/metadata.ts`) |
| `src/app/(en)/labs/page.en-labs.tsx`, `[slug]/page.en-labs.tsx`, `rss.xml/route.en-labs.ts` and the `vi` twins under `src/app/(vi)/vi/labs/` | Route files that exist only when their language has articles |
| `src/app/llms.txt/route.ts` | `/llms.txt` |
| `src/components/sections/Labs.tsx` | Home: the 3 newest articles in the page's language |
| `public/admin/config.yml` | The "Labs" collection (replaces "Articles") |
| `next.config.ts` | `pageExtensions` from `labsLocales()` |
| tests: `labs-files`, `markdown`, `labs-pages`, `labs-feed` (`.test.mjs`) | Unit tests |

## Task order, sizes and parallel groups

| # | Task | Size | Runs with | Depends on |
|---|---|---|---|---|
| 1 | Retire the JSON `articles` collection | M | first, alone | Part 2 |
| 2 | Article files: reading, front matter rules, check-content, honesty | M | ∥ 3, 4 | 1 |
| 3 | Markdown renderer (markdown-it 15.0.2) | M | ∥ 2, 4 | 1 |
| 4 | CMS "Labs" collection | M | ∥ 2, 3 | 1 |
| 5 | Labs pages: loader, views, gated routes, BlogPosting, metadata, prose styles | L | after 2, 3 | 2, 3 |
| 6 | Routes and packaging: sitemap with translations, `_redirects`, check-export | M | ∥ 7 | 5 |
| 7 | Home Labs section, RSS per language, `/llms.txt` | M | ∥ 6 | 5 |
| 8 | Checks: check-seo ("unknown `/labs/*` returns 404"), locale-checks and browser-check with probe articles | M | after 6, 7 | 6, 7 |
| 9 | README editor guide and final gates | M | last | 8 |

The site stays shippable after every task. Until editors publish an article no Labs route exists, and the home Labs section stays hidden, exactly as today.

---
### Task 1: Retire the JSON `articles` collection (M, first)

No entries exist, and the spec says Labs replaces it. The home Labs section renders nothing until Task 7, which is what it does today (it has no items).

**Files:**
- Modify:
  - `src/lib/content-model.ts`, `src/lib/content.ts`, `src/lib/content-contract.ts`, `src/lib/samples.ts`;
  - `src/components/sections/Labs.tsx`, `scripts/lib/content-rules.mjs`, `scripts/build-content-index.mjs`, `src/lib/content-index.generated.ts` (regenerated);
  - `public/admin/config.yml`, `scripts/admin-check.mjs`;
  - `src/lib/i18n/en.ts`, `src/lib/i18n/vi.ts`;
  - `tests/content.test.mjs`, `tests/content-loader.test.mjs`, `tests/content-rules.test.mjs`, `tests/fixtures/content-v1.json` (refresh).

- [ ] **Step 1: Change the tests first**

- `tests/content.test.mjs`: remove `"ARTICLES"` from `PUBLIC_KEYS`. Rename "testimonials and articles only hold publishable entries" to "testimonials only hold publishable entries" and delete its `for (const article of content.ARTICLES)` loop. Add:

```js
test("the old link-card articles collection is gone (Labs articles are Markdown files)", () => {
  assert.equal("ARTICLES" in content, false);
});
```

- `tests/content-loader.test.mjs`, "FAQ questions, engagement names and article slugs are unique…":
  - rename it to "FAQ questions and engagement names are unique, naming the file and the duplicate";
  - delete the `article` object and the `input.collections.articles = […]` lines;
  - delete the `content/articles/second-note.json…` line from the expected list.
- `tests/content-rules.test.mjs`, "testimonials and articles use their own images…":
  - rename it to "testimonials use their own photos, not the original site's stock art";
  - delete the `input.collections.articles = …` line and its expected message.

Run: `node --import tsx --test tests/content.test.mjs`
Expected: FAIL, "the old link-card articles collection is gone".

- [ ] **Step 2: Remove the collection from the model and the loader**

- `src/lib/content-model.ts`:
  - delete `export type Article = …;` and the comment line above it ("Render only real, permission-confirmed quotes and published articles.") becomes "Render only real, permission-confirmed quotes.";
  - remove `"articles"` from `COLLECTION_NAMES`;
  - delete the `articles: object({ … })` collection schema;
  - in `buildContent` delete `const articles = loadCollection(…"articles"…)`, `uniqueField(articles, "articles", "slug", issues, dir);`, `const ARTICLES: Article[] = …;` and `ARTICLES,` in the returned object.
- `src/lib/content.ts`: remove `Article` from the `export type { … }` list and delete `export const ARTICLES = content.ARTICLES;`.
- `src/lib/content-contract.ts`: delete the `Before.Article` and `Before.ARTICLES` lines. The fixture types stay frozen.
- `src/lib/samples.ts`: delete `SAMPLE_ARTICLES` and the `Article` import. The header comment becomes "Development-only preview data for the Testimonials layout."
- `scripts/lib/content-rules.mjs`: `stockImageProblems({ TESTIMONIALS })` keeps only the testimonials line. Its doc comment becomes "Testimonials use their own photos, not the original site's stock reviews."
- `scripts/build-content-index.mjs`: `COLLECTIONS` loses `"articles"`. Then run `npm run content:index`. Expected: `Wrote src/lib/content-index.generated.ts.`, with no `"articles"` key in either export.

- [ ] **Step 3: The home Labs section renders nothing for now** (`src/components/sections/Labs.tsx`, whole file)

```tsx
import type { Locale } from "@/lib/i18n/locales";

/**
 * The home page's Labs section. The link-card collection it showed was retired for Markdown articles (Labs, Part 3);
 * Task 7 renders the three newest articles in the page's language here. Until then it renders nothing, as it did
 * while there were no entries.
 */
export const hasLabs = (_locale: Locale) => false;
export const HAS_LABS = false;

export default function Labs(_props: { locale?: Locale }) {
  return null;
}
```

Remove `labs.sample` from `src/lib/i18n/en.ts` and `vi.ts`. `labs.writtenBy` and `labs.read` stay; Task 7 uses them.

- [ ] **Step 4: The CMS and its browser check**

- `public/admin/config.yml`: delete the whole `- name: articles` collection, which Task 4 replaces with "Labs".
- `scripts/admin-check.mjs`: remove `"Articles"` from `COLLECTIONS`, and change "the eight collections" in its header comment to "the collections".

- [ ] **Step 5: Refresh the export names in the migration fixture** (README "The migration check")

Run: `node --import tsx --test tests/content-exports.test.mjs`
Expected: FAIL, because `ARTICLES` is no longer exported. That is a deliberate change.

Run: `node scripts/check-migration.mjs --refresh-structure`, then review `git diff tests/fixtures`. Only `exports` should lose `ARTICLES`, and `values` lose `ARTICLES`.

- [ ] **Step 6: Gates and commit**

Run: `npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs`
Expected: pass; `Content valid: 12 routes; preview mode.`

```bash
git add tests/fixtures/content-v1.json
git commit -m "test(fixtures): ARTICLES leaves the content exports (Labs articles replace the link cards)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add src/lib/content-model.ts src/lib/content.ts src/lib/content-contract.ts src/lib/samples.ts src/components/sections/Labs.tsx scripts/lib/content-rules.mjs scripts/build-content-index.mjs src/lib/content-index.generated.ts public/admin/config.yml scripts/admin-check.mjs src/lib/i18n/en.ts src/lib/i18n/vi.ts tests/content.test.mjs tests/content-loader.test.mjs tests/content-rules.test.mjs
git commit -m "refactor(content): retire the empty link-card articles collection; Labs articles replace it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Article files: reading, front matter rules, check-content, honesty (M, ∥ 3, 4)

**Files:**
- Create: `src/lib/labs-files.ts`, `tests/labs-files.test.mjs`
- Modify: `scripts/check-content.mjs`

- [ ] **Step 1: Write the failing test** (`tests/labs-files.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanContentTree } from "../scripts/lib/honesty.mjs";

const { readArticleFiles, labsProblems, publishedArticles, labsLocales } = await import("../src/lib/labs-files.ts");

/** A temporary project holding only the given article files ({ "content/articles/a.md": text }). */
function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-labs-"));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}
const article = ({ title = "Measuring a document workflow", summary = "How we agree on the measures before we build.", cover = "/images/suite/neural-net.webp", coverAlt = "A neural network diagram", date = "2026-10-20", updated = "", author = "Lan Nguyen", body = "## Why measure\n\nA pilot needs a baseline." } = {}) =>
  `---\ntitle: ${JSON.stringify(title)}\nsummary: ${JSON.stringify(summary)}\ncover: ${cover}\ncoverAlt: ${JSON.stringify(coverAlt)}\ndate: ${date}\nupdated: ${JSON.stringify(updated)}\nauthor: ${JSON.stringify(author)}\n---\n\n${body}\n`;
const blank = (fields = {}) => article({ title: "", summary: "", coverAlt: "", body: "", ...fields });

test("reads both languages; the slug is the file name; dates stay text", () => {
  const root = project({ "content/articles/measuring.md": article(), "content/vi/articles/measuring.md": article({ title: "Đo lường một quy trình hồ sơ", summary: "Cách hai bên thống nhất chỉ số trước khi xây dựng.", coverAlt: "Sơ đồ mạng nơ-ron", body: "## Vì sao cần đo\n\nMột dự án thí điểm cần mốc cơ sở." }) });
  try {
    const { files, issues } = readArticleFiles(root);
    assert.deepEqual(issues, []);
    assert.deepEqual(files.map((f) => [f.locale, f.slug, f.filled, f.data.date, f.data.updated]), [["en", "measuring", true, "2026-10-20", null], ["vi", "measuring", true, "2026-10-20", null]]);
    assert.equal(files[0].data.body, "## Why measure\n\nA pilot needs a baseline.");
    assert.deepEqual(labsProblems(files), []);
    assert.deepEqual(labsLocales(root), ["en", "vi"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("an article may exist in one language: English only, or Vietnamese only (the CMS keeps an empty English file)", () => {
  const english = project({ "content/articles/only-en.md": article() });
  const vietnamese = project({ "content/articles/only-vi.md": blank(), "content/vi/articles/only-vi.md": article({ title: "Chỉ có tiếng Việt", summary: "Một bài viết chỉ có bản tiếng Việt.", coverAlt: "Sơ đồ", body: "## Mở đầu\n\nNội dung." }) });
  try {
    assert.deepEqual(labsLocales(english), ["en"]);
    assert.deepEqual(labsLocales(vietnamese), ["vi"]);
    const { files } = readArticleFiles(vietnamese);
    assert.deepEqual(labsProblems(files), []);
    assert.deepEqual(publishedArticles(files, "en"), []);
    assert.deepEqual(publishedArticles(files, "vi").map((f) => f.slug), ["only-vi"]);
  } finally { for (const root of [english, vietnamese]) fs.rmSync(root, { recursive: true, force: true }); }
});

test("no articles at all means no Labs language", () => {
  const root = project({});
  try { assert.deepEqual(labsLocales(root), []); } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("newest first, then by slug", () => {
  const root = project({ "content/articles/b.md": article({ date: "2026-09-01" }), "content/articles/a.md": article({ date: "2026-10-01" }), "content/articles/c.md": article({ date: "2026-10-01" }) });
  try { assert.deepEqual(publishedArticles(readArticleFiles(root).files, "en").map((f) => f.slug), ["a", "c", "b"]); } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("refuses half-filled languages, empty articles, a missing English file, shared fields that differ, bad dates, stock covers and bad names", () => {
  const root = project({
    "content/articles/half.md": article({ summary: "" }),
    "content/articles/empty.md": blank(),
    "content/vi/articles/vi-off.md": blank(),
    "content/articles/vi-off.md": article(),
    "content/vi/articles/no-english.md": article({ title: "Không có bản tiếng Anh" }),
    "content/articles/shared.md": article(),
    "content/vi/articles/shared.md": article({ title: "Chia sẻ", author: "Someone Else", date: "2026-10-21" }),
    "content/articles/dates.md": article({ date: "2026-02-30", updated: "2026-01-01" }),
    "content/articles/stock.md": article({ cover: "/images/labs/ethical-ai.webp" }),
    "content/articles/Bad Name.md": article(),
    "content/articles/zz-probe-x.md": article(),
  });
  try {
    const { files, issues } = readArticleFiles(root);
    const problems = [...issues, ...labsProblems(files, { production: true })];
    for (const expected of [
      "content/articles/half.md: summary is empty",
      "content/articles/empty.md: has no text in either language",
      "content/vi/articles/vi-off.md: has no Vietnamese text",
      "content/articles/no-english.md is missing",
      'content/vi/articles/shared.md: author is "Someone Else", but it must stay "Lan Nguyen"',
      'content/vi/articles/shared.md: date is "2026-10-21", but it must stay "2026-10-20"',
      "content/articles/dates.md: date 2026-02-30 is not a real date",
      "content/articles/dates.md: updated (2026-01-01) is before the publication date",
      "content/articles/stock.md: cover uses the original site's stock art",
      "content/articles/Bad Name.md: Labs articles are Markdown files named after their slug",
      "content/articles/zz-probe-x.md: zz-probe- articles are test fixtures and never ship",
    ]) assert.ok(problems.some((problem) => problem.startsWith(expected)), `${expected}\n${problems.join("\n")}`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("front matter is checked by the schema: unknown fields, lengths, image paths", () => {
  const root = project({ "content/articles/x.md": article({ cover: "/uploads/Photo.JPG" }).replace("author:", "extra: 1\nauthor:") });
  try {
    const { issues } = readArticleFiles(root);
    assert.ok(issues.some((issue) => issue.startsWith("content/articles/x.md: cover: use a lowercase file name")), issues.join("\n"));
    assert.ok(issues.some((issue) => issue.startsWith("content/articles/x.md: extra: unknown field")), issues.join("\n"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the honesty scan covers article front matter and bodies in both languages", () => {
  const root = project({
    "content/articles/claims.md": article({ summary: "Trusted by 200 clients." }),
    "content/vi/articles/claims.md": article({ title: "Tuyên bố", body: "## Kết quả\n\nTăng 30% doanh thu cho khách hàng." }),
  });
  try {
    const problems = scanContentTree(root);
    assert.ok(problems.some((problem) => problem.startsWith("content/articles/claims.md: a client or scale claim")), problems.join("\n"));
    assert.ok(problems.some((problem) => problem.startsWith("content/vi/articles/claims.md: a result figure")), problems.join("\n"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
```

Run: `node --import tsx --test tests/labs-files.test.mjs`
Expected: FAIL, `Cannot find module …/src/lib/labs-files.ts`. The honesty test would already pass, because the scan reads every `.md` under `content/`.

- [ ] **Step 2: Implement `src/lib/labs-files.ts`**

```ts
// The Labs articles as files (bilingual spec, Part 3): content/articles/<slug>.md (English) and
// content/vi/articles/<slug>.md (Vietnamese), Markdown with YAML front matter, written by the CMS ("Labs").
// The slug is the file name and both languages share it; an article may exist in one language only.
// Sveltia cannot switch its default language off, so it always writes the English file: a Vietnamese-only
// article has an English file whose text fields are empty. A file is "filled" in its language when its title is
// not empty, and then all its text must be. The cover, the dates and the author are shared and must match.
// Read at build time from disk, like the legal pages. next.config.ts imports labsLocales() to decide which Labs
// routes exist, so this module uses only fs, js-yaml and the erasable content schema.
import fs from "node:fs";
import path from "node:path";
import { JSON_SCHEMA, load } from "js-yaml";
import { check, image, nullable, object, text } from "./content-schema.ts";
import { LOCALES, type Locale } from "./i18n/locales.ts";

export type ArticleData = { title: string; summary: string; cover: string; coverAlt: string; date: string; updated: string | null; author: string; body: string };
export type ArticleFile = { slug: string; locale: Locale; file: string; data: ArticleData; filled: boolean };

/** Where each language's articles are. */
export const ARTICLE_DIRS: Record<Locale, string> = { en: "content/articles", vi: "content/vi/articles" };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;
const TEXT_FIELDS = ["title", "summary", "coverAlt", "body"] as const;
const SHARED_FIELDS = ["cover", "date", "updated", "author"] as const;

/** The front matter, in the order the CMS writes it. Text may be empty in a language the article is not written in. */
export const articleSchema = object({
  title: text({ min: 0, max: 120 }),
  summary: text({ min: 0, max: 200 }),
  cover: image(),
  coverAlt: text({ min: 0, max: 160 }),
  date: text({ max: 10, pattern: DATE, message: "use a date such as 2026-10-23" }),
  updated: nullable(text({ max: 10, pattern: DATE, message: "use a date such as 2026-10-23, or leave it empty" })),
  author: text({ max: 60 }),
});

const realDate = (value: string) => DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Every article file of both languages, parsed, with each field checked (problems name the file and the field). */
export function readArticleFiles(root: string = process.cwd()): { files: ArticleFile[]; issues: string[] } {
  const files: ArticleFile[] = [];
  const issues: string[] = [];
  for (const locale of LOCALES) {
    const dir = ARTICLE_DIRS[locale];
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full).filter((entry) => !entry.startsWith(".")).sort()) {
      const file = `${dir}/${name}`;
      if (!FILE.test(name)) {
        issues.push(`${file}: Labs articles are Markdown files named after their slug (lowercase letters, digits and single hyphens, ending in .md)`);
        continue;
      }
      const source = fs.readFileSync(path.join(full, name), "utf8").replace(/^\u{FEFF}/u, "");
      const match = FRONT_MATTER.exec(source);
      if (!match) {
        issues.push(`${file}: start the file with its front matter between two --- lines`);
        continue;
      }
      let front: unknown;
      try {
        front = load(match[1], { schema: JSON_SCHEMA });
      } catch (error) {
        issues.push(`${file}: the front matter is not valid YAML (${String((error as Error).message).split("\n")[0]})`);
        continue;
      }
      const fields = check(articleSchema, front, file, issues);
      const data: ArticleData = { ...fields, body: match[2].trim() };
      files.push({ slug: name.slice(0, -3), locale, file, data, filled: data.title !== "" });
    }
  }
  return { files, issues };
}

/** The rules across fields and languages. `production` refuses the zz-probe- test articles. */
export function labsProblems(files: ArticleFile[], { production = false }: { production?: boolean } = {}): string[] {
  const problems: string[] = [];
  const bySlug = new Map<string, Partial<Record<Locale, ArticleFile>>>();
  for (const item of files) bySlug.set(item.slug, { ...bySlug.get(item.slug), [item.locale]: item });
  for (const [slug, { en, vi }] of bySlug) {
    for (const item of [en, vi]) {
      if (!item) continue;
      const empty = TEXT_FIELDS.filter((field) => item.data[field] === "");
      if (item.filled && empty.length) problems.push(`${item.file}: ${empty.join(", ")} ${empty.length === 1 ? "is" : "are"} empty; an article needs a title, a summary, a cover description and its text`);
      if (!item.filled && empty.length < TEXT_FIELDS.length) problems.push(`${item.file}: the title is empty but other text is filled in; give the article a title, or empty its text in this language`);
      if (DATE.test(item.data.date) && !realDate(item.data.date)) problems.push(`${item.file}: date ${item.data.date} is not a real date`);
      if (item.data.updated && DATE.test(item.data.updated) && !realDate(item.data.updated)) problems.push(`${item.file}: updated ${item.data.updated} is not a real date`);
      if (item.data.updated && item.data.updated < item.data.date) problems.push(`${item.file}: updated (${item.data.updated}) is before the publication date (${item.data.date})`);
      if (/^\/images\/labs\//.test(item.data.cover)) problems.push(`${item.file}: cover uses the original site's stock art (${item.data.cover}); use the article's own image`);
      if (production && slug.startsWith("zz-probe-")) problems.push(`${item.file}: zz-probe- articles are test fixtures and never ship`);
    }
    if (vi && !vi.filled) problems.push(`${vi.file}: has no Vietnamese text; write it, or switch the Vietnamese version off in the CMS`);
    if (en && !en.filled && !vi?.filled) problems.push(`${en.file}: has no text in either language; write the article in English or Vietnamese`);
    if (!en && vi) problems.push(`${ARTICLE_DIRS.en}/${slug}.md is missing: the CMS keeps an English file for every article (with empty text for a Vietnamese-only one); open and save the article in the CMS`);
    if (en && vi) {
      for (const field of SHARED_FIELDS) {
        if (en.data[field] !== vi.data[field]) problems.push(`${vi.file}: ${field} is ${JSON.stringify(vi.data[field])}, but it must stay ${JSON.stringify(en.data[field])} as in ${en.file} (the cover, the dates and the author are the same in both languages)`);
      }
    }
  }
  return problems;
}

/** One language's published articles, newest first, then by slug. */
export function publishedArticles(files: ArticleFile[], locale: Locale): ArticleFile[] {
  return files.filter((item) => item.locale === locale && item.filled).sort((a, b) => (a.data.date === b.data.date ? (a.slug < b.slug ? -1 : 1) : a.data.date < b.data.date ? 1 : -1));
}

/** The languages that have at least one published article (next.config.ts: which Labs routes exist). Never throws: a broken file fails check-content, which runs before next build. */
export function labsLocales(root: string = process.cwd()): Locale[] {
  try {
    const { files } = readArticleFiles(root);
    return LOCALES.filter((locale) => files.some((item) => item.locale === locale && item.filled));
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Wire it into `scripts/check-content.mjs`**

```js
import { labsProblems, readArticleFiles } from "../src/lib/labs-files.ts";
```

After the legal-page loop add:

```js
// Labs articles (content/articles, content/vi/articles): front matter, the per-language rules and their covers.
await attempt(() => {
  const { files, issues } = readArticleFiles(ROOT);
  errors.push(...issues, ...labsProblems(files, { production: mode === "production" }));
  const covers = { LABS: files.map((item) => item.data.cover) };
  for (const problem of imageReferenceProblems(covers)) errors.push(`image path in a Labs article ${problem}`);
  for (const missing of missingImageFiles(covers, path.join(ROOT, "public"), CACHE_DIR)) errors.push(missing.endsWith(")") ? `missing image variant: ${missing}` : `missing image: public${missing}`);
});
```

- [ ] **Step 4: Run the tests, gates, commit**

Run: `node --import tsx --test tests/labs-files.test.mjs && npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs`
Expected: PASS; `Content valid: 12 routes; preview mode.` (no articles yet).

```bash
git add src/lib/labs-files.ts scripts/check-content.mjs tests/labs-files.test.mjs
git commit -m "feat(labs): read and check Markdown articles in both languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: The Markdown renderer, markdown-it 15.0.2 with raw HTML off (M, ∥ 2, 4)

**Files:**
- Modify: `package.json`, `package-lock.json` (the install), `src/lib/i18n/en.ts`, `src/lib/i18n/vi.ts` (`labs.anchor`)
- Create: `src/lib/markdown.ts`, `tests/markdown.test.mjs`

- [ ] **Step 1: Install the pinned version** (dependencies resolved from before 2026-10-09, so every package is at least 14 days old)

Run: `npm install --save-exact --before=2026-10-09 markdown-it@15.0.2`
Expected:
- `package.json` `dependencies` has `"markdown-it": "15.0.2"`;
- `npm ls markdown-it argparse entities linkify-it mdurl uc.micro punycode.js` shows markdown-it 15.0.2, argparse 3.0.2, entities 8.1.0, linkify-it 6.1.0, mdurl 2.1.0, uc.micro 3.0.0 and punycode.js 2.3.1;
- `git diff package-lock.json` adds only those 7 packages.

- [ ] **Step 2: Write the failing test** (`tests/markdown.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";

const { renderMarkdown, markdownProblems } = await import("../src/lib/markdown.ts");

test("headings h2–h4 get ids and an anchor; text is escaped; raw HTML is shown as text, never as markup", () => {
  const { html, headings } = renderMarkdown("## Vì sao cần đo Ấ\n\nA <b>bold</b> claim.\n\n### Vì sao cần đo Ấ\n", "vi");
  assert.deepEqual(headings, [{ id: "vi-sao-can-do-a", text: "Vì sao cần đo Ấ", level: 2 }, { id: "vi-sao-can-do-a-2", text: "Vì sao cần đo Ấ", level: 3 }]);
  assert.match(html, /<h2 id="vi-sao-can-do-a">Vì sao cần đo Ấ<a class="labs-anchor" href="#vi-sao-can-do-a" aria-label="Liên kết đến mục này: Vì sao cần đo Ấ">#<\/a><\/h2>/);
  assert.match(html, /A &lt;b&gt;bold&lt;\/b&gt; claim\./);
  assert.doesNotMatch(html, /<b>/);
});

test("links: site paths follow the language, https links get rel noopener noreferrer", () => {
  const { html } = renderMarkdown("[Liên hệ](/contact/) và [nguồn](https://example.org/a)", "vi");
  assert.match(html, /<a href="\/vi\/contact\/">Liên hệ<\/a>/);
  assert.match(html, /<a href="https:\/\/example\.org\/a" rel="noopener noreferrer">nguồn<\/a>/);
  assert.match(renderMarkdown("[Contact](/contact/)", "en").html, /<a href="\/contact\/">/);
});

test("images render through contentImage (upload variants), lazily, with their alt text", () => {
  const { html } = renderMarkdown("![A workflow diagram](/uploads/workflow.jpg)", "en");
  assert.match(html, /<img src="\/uploads\/workflow\.jpg\.w1280\.webp" srcset="\/uploads\/workflow\.jpg\.w640\.webp 640w, \/uploads\/workflow\.jpg\.w1280\.webp 1280w" sizes="\(min-width: 1024px\) 720px, 100vw" alt="A workflow diagram" loading="lazy" decoding="async">/);
});

test("lists, blockquotes and code render; tables and strikethrough stay text", () => {
  const { html } = renderMarkdown("- one\n- two\n\n> quote\n\n```js\nconst x = \"<script>\";\n```\n\n| a | b |\n|---|---|\n\n~~no~~", "en");
  assert.match(html, /<ul>\n<li>one<\/li>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<pre><code class="language-js">const x = &quot;&lt;script&gt;&quot;;/);
  assert.doesNotMatch(html, /<table|<s>|<del>/);
});

test("word count for the reading time", () => {
  assert.equal(renderMarkdown("## Title here\n\nOne two three four.", "en").words, 6);
});

test("validation: only h2–h4, no raw HTML, images need a site path and alt text, links are site paths or https", () => {
  const problems = markdownProblems("# Top\n\n##### Deep\n\n<div>x</div>\n\nText <span>y</span>\n\n![](/uploads/a.jpg)\n\n![Alt](https://cdn.example/a.jpg)\n\n[mail](mailto:a@b.co) [plain](http://example.org) [ok](/about/) [also](https://example.org)", "content/articles/x.md");
  for (const expected of [
    "content/articles/x.md, line 1: use headings ## to #### only (found #)",
    "content/articles/x.md, line 3: use headings ## to #### only (found #####)",
    "content/articles/x.md, line 5: raw HTML is not allowed",
    "content/articles/x.md, line 7: raw HTML is not allowed",
    "content/articles/x.md, line 9: the image needs a description",
    'content/articles/x.md, line 11: the image "https://cdn.example/a.jpg" must be an upload or a site image',
    'content/articles/x.md, line 13: the link "mailto:a@b.co" must be a site path such as /contact/ or a full https:// address',
    'content/articles/x.md, line 13: the link "http://example.org" must be a site path such as /contact/ or a full https:// address',
  ]) assert.ok(problems.includes(expected), `${expected}\n${problems.join("\n")}`);
  assert.equal(problems.length, 8);
  assert.deepEqual(markdownProblems("## Fine\n\nText with [a link](/about/) and ![alt](/images/suite/neural-net.webp).", "x.md"), []);
});
```

Run: `node --import tsx --test tests/markdown.test.mjs`
Expected: FAIL, `Cannot find module …/src/lib/markdown.ts`.

- [ ] **Step 3: Add the anchor label to the dictionary**

`en.ts` `labs`: `anchor: "Link to this section: {heading}",`. `vi.ts` `labs`: `anchor: "Liên kết đến mục này: {heading}",`.

- [ ] **Step 4: Implement `src/lib/markdown.ts`**

```ts
// Labs article bodies: Markdown to HTML at build time with markdown-it 15.0.2 (pinned), raw HTML off. Headings h2–h4
// get ids and an anchor link; site links follow the page's language; https links get rel="noopener noreferrer";
// images go through contentImage() (upload variants). Tables and strikethrough are off: the spec allows headings,
// lists, links, images, blockquotes and code. markdownProblems() refuses what the renderer would not show as
// intended, naming the file and the line. Server and build only.
import MarkdownIt from "markdown-it";
import { contentImage } from "./content-images.ts";
import { HREF, IMAGE } from "./content-schema.ts";
import { dictionary, format } from "./i18n/dictionary.ts";
import { localizedHref, type Locale } from "./i18n/locales.ts";

export type RenderedMarkdown = { html: string; headings: { id: string; text: string; level: 2 | 3 | 4 }[]; words: number };
type Env = { locale: Locale; headings: RenderedMarkdown["headings"]; words: number };
type Token = ReturnType<MarkdownIt["parse"]>[number];

const IMAGE_SIZES = "(min-width: 1024px) 720px, 100vw";
const md = new MarkdownIt("default", { html: false, linkify: false, typographer: false }).disable(["table", "strikethrough"]);
/** Only for validation: with html on, raw HTML shows up as html_block and html_inline tokens. */
const raw = new MarkdownIt("default", { html: true });

/** An ASCII id from heading text, Vietnamese included ("Vì sao cần đo Ấ" → "vi-sao-can-do-a"). */
const slugify = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
const plain = (token: Token) => (token.children ?? []).filter((child) => child.type === "text" || child.type === "code_inline").map((child) => child.content).join("");

md.core.ruler.push("labs_headings", (state) => {
  const env = state.env as Env;
  const seen = new Map<string, number>();
  env.headings = [];
  env.words = 0;
  state.tokens.forEach((token, index) => {
    if (token.type === "inline") env.words += plain(token).split(/\s+/).filter(Boolean).length;
    if (token.type !== "heading_open") return;
    const text = plain(state.tokens[index + 1]);
    const base = slugify(text);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;
    token.attrSet("id", id);
    const level = Number(token.tag.slice(1));
    if (level >= 2 && level <= 4) env.headings.push({ id, text, level: level as 2 | 3 | 4 });
  });
});
md.renderer.rules.heading_close = (tokens, index, _options, env: Env) => {
  const id = tokens[index - 2].attrGet("id") ?? "";
  const label = format(dictionary(env.locale).labs.anchor, { heading: plain(tokens[index - 1]) });
  return `<a class="labs-anchor" href="#${md.utils.escapeHtml(id)}" aria-label="${md.utils.escapeHtml(label)}">#</a></${tokens[index].tag}>\n`;
};
md.renderer.rules.link_open = (tokens, index, options, env: Env, self) => {
  const token = tokens[index];
  const href = token.attrGet("href") ?? "";
  if (href.startsWith("https://")) token.attrSet("rel", "noopener noreferrer");
  else if (href.startsWith("/")) token.attrSet("href", localizedHref(href, env.locale));
  return self.renderToken(tokens, index, options);
};
md.renderer.rules.image = (tokens, index) => {
  const token = tokens[index];
  const image = contentImage(token.attrGet("src") ?? "", IMAGE_SIZES);
  const attrs = [`src="${md.utils.escapeHtml(image.src)}"`, image.srcSet ? `srcset="${md.utils.escapeHtml(image.srcSet)}"` : "", image.sizes ? `sizes="${md.utils.escapeHtml(image.sizes)}"` : "", `alt="${md.utils.escapeHtml(token.content)}"`, 'loading="lazy"', 'decoding="async"'].filter(Boolean);
  return `<img ${attrs.join(" ")}>`;
};

/** An article body as HTML, with its headings (for anchors) and its word count (for the reading time). */
export function renderMarkdown(source: string, locale: Locale): RenderedMarkdown {
  const env: Env = { locale, headings: [], words: 0 };
  const html = md.render(source, env);
  return { html, headings: env.headings, words: env.words };
}

/** What an article body may not contain, as "<file>, line <n>: <problem>". */
export function markdownProblems(source: string, file: string): string[] {
  const problems: string[] = [];
  const at = (token: Token, parent?: Token) => `${file}, line ${((token.map ?? parent?.map)?.[0] ?? 0) + 1}`;
  for (const token of md.parse(source, {})) {
    if (token.type === "heading_open" && !["h2", "h3", "h4"].includes(token.tag)) problems.push(`${at(token)}: use headings ## to #### only (found ${"#".repeat(Number(token.tag.slice(1)))})`);
    if (token.type !== "inline") continue;
    for (const child of token.children ?? []) {
      if (child.type === "image") {
        const src = child.attrGet("src") ?? "";
        if (!child.content.trim()) problems.push(`${at(child, token)}: the image needs a description (the text in ![…])`);
        if (!IMAGE.test(src)) problems.push(`${at(child, token)}: the image ${JSON.stringify(src)} must be an upload or a site image (/uploads/… or /images/…)`);
      }
      if (child.type === "link_open") {
        const href = child.attrGet("href") ?? "";
        if (!HREF.test(href)) problems.push(`${at(child, token)}: the link ${JSON.stringify(href)} must be a site path such as /contact/ or a full https:// address`);
      }
    }
  }
  for (const token of raw.parse(source, {})) {
    const inline = (token.children ?? []).some((child) => child.type === "html_inline");
    if (token.type === "html_block" || inline) problems.push(`${at(token)}: raw HTML is not allowed; write it in Markdown`);
  }
  return problems;
}
```

- [ ] **Step 5: Run the tests and gates, commit**

Run: `node --import tsx --test tests/markdown.test.mjs tests/i18n-dictionary.test.mjs && npm run lint && npm run typecheck && npm test`
Expected: PASS. If an expected line number in the validation test is off by the blank-line count, check `token.map` for that token type and fix the test's line, not the rule.

```bash
git add package.json package-lock.json src/lib/markdown.ts src/lib/i18n/en.ts src/lib/i18n/vi.ts tests/markdown.test.mjs
git commit -m "feat(labs): Markdown renderer (markdown-it 15.0.2, raw HTML off) with heading anchors and localized links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: The CMS "Labs" collection (M, ∥ 2, 3)

**Files:**
- Modify: `public/admin/config.yml`, `tests/cms-config.test.mjs`, `scripts/admin-check.mjs`

- [ ] **Step 1: Write the failing test** (`tests/cms-config.test.mjs`)

Part 2's i18n test requires `collection.i18n === true` and no `initial_locales` on every collection. Labs is the one exception, so change the two lines in that test:

```js
    if (collection.name === "labs") assert.deepEqual(collection.i18n, { initial_locales: "all" }, "labs: Vietnamese is optional per article");
    else assert.equal(collection.i18n, true, `${collection.name}: i18n`);
```

and wrap the `initial_locales` assertion in `if (collection.name !== "labs")`. Then add:

```js
const { articleSchema } = await import("../src/lib/labs-files.ts");
const { IMAGE, SLUG } = await import("../src/lib/content-schema.ts");

test("Labs: Markdown articles in content/articles and content/vi/articles; English always kept, Vietnamese optional; the slug fixed after the first save", () => {
  const labs = config.collections.find((collection) => collection.name === "labs");
  assert.deepEqual([labs.label, labs.folder, labs.extension, labs.format, labs.create], ["Labs", "content/{{locale}}/articles", "md", "frontmatter", true]);
  assert.deepEqual(labs.slug, { template: "{{title}}", editable: ["create"], pattern: [SLUG.source, "Use lowercase letters, digits and single hyphens"] });
  assert.deepEqual(labs.sortable_fields, { fields: ["date", "title"], default: { field: "date", direction: "descending" } });
  assert.deepEqual(labs.fields.map((field) => [field.name, field.widget, field.i18n, field.required ?? true]), [
    ["title", "string", true, false], ["summary", "text", true, false], ["cover", "image", "duplicate", true], ["coverAlt", "string", true, false],
    ["date", "datetime", "duplicate", true], ["updated", "datetime", "duplicate", false], ["author", "string", "duplicate", true], ["body", "markdown", true, false],
  ]);
  const shape = articleSchema.meta.shape;
  for (const name of ["title", "summary", "coverAlt", "author"]) assert.equal(labs.fields.find((field) => field.name === name).maxlength, shape[name].meta.max, `${name}: maxlength`);
  assert.equal(labs.fields.find((field) => field.name === "cover").pattern[0], IMAGE.source);
  for (const name of ["date", "updated"]) assert.deepEqual(["format", "time_format"].map((key) => labs.fields.find((field) => field.name === name)[key]), ["YYYY-MM-DD", false], name);
  const body = labs.fields.find((field) => field.name === "body");
  assert.deepEqual(body.buttons, ["bold", "italic", "code", "link", "heading-two", "heading-three", "heading-four", "quote", "bulleted-list", "numbered-list"]);
  assert.deepEqual(body.editor_components, ["image", "code-block"]);
  for (const field of labs.fields.filter((item) => ["string", "text", "markdown"].includes(item.widget))) assert.equal(field.use_emoji_autocomplete, false, field.name);
});
```

Run: `node --import tsx --test tests/cms-config.test.mjs`
Expected: FAIL (`labs` is undefined).

- [ ] **Step 2: Add the collection** (`public/admin/config.yml`, where `articles` was)

```yaml
  # Labs (bilingual spec, Part 3): Markdown articles at /labs/<slug>/ and /vi/labs/<slug>/. English is always
  # saved (Sveltia keeps the default language): for an article in Vietnamese only, leave the English title,
  # summary, cover description and text empty. Switch "Vietnamese" off for an English-only article. The cover, the
  # dates and the author are shared. Each save is a commit; the article is live about 3 minutes later.
  # scripts/check-content.mjs checks every article (src/lib/labs-files.ts, src/lib/markdown.ts) and the honesty rules.
  - name: labs
    label: Labs
    label_singular: Article
    icon: article
    description: Articles in English and/or Vietnamese. Leave the English text empty for a Vietnamese-only article; switch Vietnamese off for an English-only one. No raw HTML.
    folder: content/{{locale}}/articles
    extension: md
    format: frontmatter
    identifier_field: title
    create: true
    i18n:
      initial_locales: all
    slug:
      template: "{{title}}"
      editable: [create]
      pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', "Use lowercase letters, digits and single hyphens"]
    sortable_fields: { fields: [date, title], default: { field: date, direction: descending } }
    fields:
      - { name: title, label: Title, widget: string, maxlength: 120, required: false, i18n: true, use_emoji_autocomplete: false }
      - { name: summary, label: Summary, widget: text, maxlength: 200, required: false, i18n: true, hint: "One or two sentences for the index, the home page and search results.", use_emoji_autocomplete: false }
      - { name: cover, label: Cover image, widget: image, choose_url: true, i18n: duplicate, hint: "The article's own image, uploaded here; it is also the social preview.", pattern: ['^(?!\/uploads\/.*\.svg$)(?!\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*(?:con|prn|aux|nul|com\d|lpt\d)[./])\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)$', "Use a lowercase file name (letters, digits, - or _) ending in .webp, .png, .jpg, .jpeg, .avif or .gif under /images/ or /uploads/ (.svg only under /images/), not a Windows device name such as con or nul"] }
      - { name: coverAlt, label: Cover description, widget: string, maxlength: 160, required: false, i18n: true, hint: "Describe the cover for screen readers.", use_emoji_autocomplete: false }
      - { name: date, label: Published, widget: datetime, format: YYYY-MM-DD, time_format: false, i18n: duplicate }
      - { name: updated, label: Updated, widget: datetime, format: YYYY-MM-DD, time_format: false, required: false, i18n: duplicate, hint: "Only when the article changed in substance." }
      - { name: author, label: Author, widget: string, maxlength: 60, i18n: duplicate, hint: "A real person's name.", use_emoji_autocomplete: false }
      - name: body
        label: Article
        widget: markdown
        required: false
        i18n: true
        hint: "Headings ## to ####, lists, links, images (with a description), quotes and code. No raw HTML."
        buttons: [bold, italic, code, link, heading-two, heading-three, heading-four, quote, bulleted-list, numbered-list]
        editor_components: [image, code-block]
        modes: [rich_text, raw]
        use_emoji_autocomplete: false
```

- [ ] **Step 3: The browser check's collection list**

`scripts/admin-check.mjs`: insert `"Labs"` into `COLLECTIONS` where `"Articles"` was (before `"Legal pages"`).

- [ ] **Step 4: Run the tests and gates, commit**

Run: `node --import tsx --test tests/cms-config.test.mjs && npm run lint && npm run typecheck && npm test`
Expected: PASS. In particular, "config.yml is valid for the vendored release's own schema" proves that every Labs key is a 0.230.1 option.

```bash
git add public/admin/config.yml tests/cms-config.test.mjs scripts/admin-check.mjs
git commit -m "feat(cms): the Labs collection: Markdown articles in English and/or Vietnamese

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Labs pages: loader, views, gated routes, BlogPosting, metadata, prose styles (L; after Tasks 2 and 3)

**Files:**
- Create:
  - `src/lib/labs.ts`, `src/components/LabsCard.tsx`;
  - `src/views/LabsIndexView.tsx`, `src/views/LabsArticleView.tsx`;
  - `src/app/(en)/labs/page.en-labs.tsx`, `src/app/(en)/labs/[slug]/page.en-labs.tsx`;
  - `src/app/(vi)/vi/labs/page.vi-labs.tsx`, `src/app/(vi)/vi/labs/[slug]/page.vi-labs.tsx`;
  - `tests/labs-pages.test.mjs`.
- Modify: `next.config.ts`, `src/views/metadata.ts`, `src/lib/seo.ts` (`feed`, `blogPostingData`), `src/lib/i18n/en.ts`, `src/lib/i18n/vi.ts`, `src/app/globals.css` (`.labs-prose`), `scripts/check-content.mjs` (body validation)

- [ ] **Step 1: Write the failing test** (`tests/labs-pages.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { labsArticles, labsArticle, labsRoutes, formatDate } = await import("../src/lib/labs.ts");
const { blogPostingData } = await import("../src/lib/seo.ts");
const { default: nextConfig } = await import("../next.config.ts");

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-labs-pages-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}
const md = (title, body, extra = {}) => `---\ntitle: ${JSON.stringify(title)}\nsummary: ${JSON.stringify(extra.summary ?? "A short summary of the article.")}\ncover: /uploads/cover.jpg\ncoverAlt: ${JSON.stringify(title ? "A cover" : "")}\ndate: ${extra.date ?? "2026-10-20"}\nupdated: ""\nauthor: "Lan Nguyen"\n---\n\n${body}\n`;
const blankEnglish = `---\ntitle: ""\nsummary: ""\ncover: /uploads/cover.jpg\ncoverAlt: ""\ndate: 2026-10-21\nupdated: ""\nauthor: "Lan Nguyen"\n---\n`;

test("articles per language with their versions, reading time and rendered body; routes only for languages that have articles", () => {
  const root = project({
    "content/articles/both.md": md("Both languages", "## Start\n\n" + "word ".repeat(450)),
    "content/vi/articles/both.md": md("Cả hai ngôn ngữ", "## Mở đầu\n\nNội dung."),
    "content/articles/english.md": md("English only", "## Only\n\nText.", { date: "2026-10-22" }),
    "content/articles/vietnamese.md": blankEnglish,
    "content/vi/articles/vietnamese.md": md("Chỉ tiếng Việt", "## Riêng\n\nNội dung.", { date: "2026-10-21" }),
  });
  try {
    assert.deepEqual(labsArticles("en", root).map((a) => a.slug), ["english", "both"]);
    assert.deepEqual(labsArticles("vi", root).map((a) => a.slug), ["vietnamese", "both"]);
    const both = labsArticle("en", "both", root);
    assert.deepEqual(both.languages, { en: "/labs/both/", vi: "/vi/labs/both/" });
    assert.equal(both.path, "/labs/both/");
    assert.equal(both.readingMinutes, 2);
    assert.match(both.html, /<h2 id="start">/);
    assert.deepEqual(labsArticle("vi", "vietnamese", root).languages, { vi: "/vi/labs/vietnamese/" });
    assert.equal(labsArticle("en", "vietnamese", root), undefined);
    const routes = labsRoutes(root).map((r) => [r.path, r.kind, r.locale, r.alternates]);
    assert.deepEqual(routes[0], ["/labs/", "labs", "en", { en: "/labs/", vi: "/vi/labs/" }]);
    assert.ok(routes.some(([p, , , alt]) => p === "/labs/english/" && JSON.stringify(alt) === JSON.stringify({ en: "/labs/english/" })));
    assert.equal(routes.length, 6);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  const empty = project({ "content/articles/x.md": md("English only", "Text.") });
  try { assert.deepEqual(labsRoutes(empty).map((r) => r.locale), ["en", "en"], "no Vietnamese Labs pages without a Vietnamese article"); } finally { fs.rmSync(empty, { recursive: true, force: true }); }
});

test("BlogPosting: headline, description, author Person, dates, image, language, publisher", () => {
  const root = project({ "content/articles/both.md": md("Both languages", "Text."), "content/vi/articles/both.md": md("Cả hai", "Nội dung.") });
  try {
    const data = blogPostingData(labsArticle("vi", "both", root));
    assert.deepEqual(data, {
      "@context": "https://schema.org", "@type": "BlogPosting", "@id": "https://spacegear.tech/vi/labs/both/#article", mainEntityOfPage: "https://spacegear.tech/vi/labs/both/", url: "https://spacegear.tech/vi/labs/both/",
      headline: "Cả hai", description: "A short summary of the article.", inLanguage: "vi", author: { "@type": "Person", name: "Lan Nguyen" },
      datePublished: "2026-10-20", dateModified: "2026-10-20", image: "https://spacegear.tech/uploads/cover.jpg.w1280.webp", publisher: { "@id": "https://spacegear.tech/#organization" },
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("dates read naturally in each language", () => {
  assert.equal(formatDate("2026-10-23", "en"), "October 23, 2026");
  assert.equal(formatDate("2026-10-23", "vi"), "23 tháng 10, 2026");
});

test("the Labs routes exist only for languages with articles (pageExtensions), and the route files are twins", () => {
  assert.deepEqual(nextConfig.pageExtensions, ["tsx", "ts", "jsx", "js"], "no article is committed, so no Labs route");
  for (const page of ["labs/page", "labs/[slug]/page"]) {
    const english = fs.readFileSync(`src/app/(en)/${page}.en-labs.tsx`, "utf8");
    assert.equal(fs.readFileSync(`src/app/(vi)/vi/${page}.vi-labs.tsx`, "utf8"), english.replaceAll('"en"', '"vi"'), page);
  }
});
```

Run: `node --import tsx --test tests/labs-pages.test.mjs`
Expected: FAIL, `Cannot find module …/src/lib/labs.ts`.

(The expected `formatDate` strings are those of Node's ICU at plan time. If the build machine's ICU writes them differently, use what `Intl.DateTimeFormat` prints there; the format call is the contract.)

- [ ] **Step 2: `src/lib/labs.ts`**

```ts
// The Labs articles the pages render (server and build only): one language's published files with their Markdown
// rendered, the reading time, and the paths of every language version (hreflang, the switch, the sitemap).
import { publishedArticles, readArticleFiles, type ArticleData } from "./labs-files.ts";
import { renderMarkdown, type RenderedMarkdown } from "./markdown.ts";
import { HTML_LANG, LOCALES, localizedHref, type Locale } from "./i18n/locales.ts";
import type { PublishedRoute } from "./site.ts";

export type LabsArticle = ArticleData & {
  slug: string; locale: Locale; path: string; html: string; headings: RenderedMarkdown["headings"]; readingMinutes: number;
  /** The paths of the article in every language it is published in (always includes its own). */
  languages: Partial<Record<Locale, string>>;
};
const WORDS_PER_MINUTE = 220;
const cache = new Map<string, LabsArticle[]>();

/** One language's published articles, newest first. */
export function labsArticles(locale: Locale, root: string = process.cwd()): LabsArticle[] {
  const key = `${root}\n${locale}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { files } = readArticleFiles(root);
  const versions = (slug: string) => Object.fromEntries(LOCALES.filter((other) => files.some((item) => item.slug === slug && item.locale === other && item.filled)).map((other) => [other, localizedHref(`/labs/${slug}/`, other)]));
  const list = publishedArticles(files, locale).map((item): LabsArticle => {
    const rendered = renderMarkdown(item.data.body, locale);
    return {
      ...item.data, slug: item.slug, locale, path: localizedHref(`/labs/${item.slug}/`, locale), html: rendered.html, headings: rendered.headings,
      readingMinutes: Math.max(1, Math.round(rendered.words / WORDS_PER_MINUTE)), languages: versions(item.slug),
    };
  });
  cache.set(key, list);
  return list;
}

export function labsArticle(locale: Locale, slug: string, root?: string): LabsArticle | undefined {
  return labsArticles(locale, root).find((item) => item.slug === slug);
}

/** The Labs index and articles of every language that has articles, English first (sitemap, check-seo). */
export function labsRoutes(root: string = process.cwd()): PublishedRoute[] {
  const languages = LOCALES.filter((locale) => labsArticles(locale, root).length > 0);
  const index = Object.fromEntries(languages.map((locale) => [locale, localizedHref("/labs/", locale)]));
  return languages.flatMap((locale) => [
    { path: localizedHref("/labs/", locale), kind: "labs" as const, locale, alternates: index },
    ...labsArticles(locale, root).map((item) => ({ path: item.path, kind: "article" as const, locale, alternates: item.languages })),
  ]);
}

/** "October 23, 2026" / "23 tháng 10, 2026". */
export function formatDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(HTML_LANG[locale], { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
```

- [ ] **Step 3: Dictionary keys** (`labs` in `en.ts` / `vi.ts`)

```ts
    readingTime: "{n} min read",
    updated: "Updated",
    feed: "Follow Labs by RSS",
    allArticles: "All articles",
```

```ts
    readingTime: "{n} phút đọc",
    updated: "Cập nhật",
    feed: "Theo dõi Labs qua RSS",
    allArticles: "Tất cả bài viết",
```

- [ ] **Step 4: `src/lib/seo.ts`: the feed link and BlogPosting**

Add `feed?: string` to `MetadataInput`. In `buildMetadata`, when it is set, add `types: { "application/rss+xml": [{ url: canonicalUrl(feed), title: SITE.name }] }` to `alternates`. Then add:

```ts
import type { LabsArticle } from "./labs";
import { contentImage } from "./content-images";

/** A Labs article's structured data; the publisher is the site's Organization (organizationData, on every page). */
export function blogPostingData(article: LabsArticle) {
  const url = canonicalUrl(article.path);
  return {
    "@context": "https://schema.org", "@type": "BlogPosting", "@id": `${url}#article`, mainEntityOfPage: url, url,
    headline: article.title, description: article.summary, inLanguage: HTML_LANG[article.locale],
    author: { "@type": "Person", name: article.author },
    datePublished: article.date, dateModified: article.updated ?? article.date,
    image: canonicalUrl(contentImage(article.cover).src),
    publisher: { "@id": `${SITE.origin}/#organization` },
  };
}
```

- [ ] **Step 5: `src/views/metadata.ts`: the Labs pages**

```ts
import { labsArticle, labsArticles } from "@/lib/labs";
import { contentImage } from "@/lib/content-images";
import { LOCALES, localizedHref } from "@/lib/i18n/locales";

export function labsIndexMetadata(locale: Locale) {
  const { SECTIONS } = getContent(locale);
  const languages = Object.fromEntries(LOCALES.filter((other) => labsArticles(other).length > 0).map((other) => [other, localizedHref("/labs/", other)]));
  return buildMetadata({ title: SECTIONS.labs.title, description: SECTIONS.labs.description, path: "/labs/", locale, languages, feed: localizedHref("/labs/rss.xml", locale) });
}
export function labsStaticParams(locale: Locale) {
  return labsArticles(locale).map(({ slug }) => ({ slug }));
}
export function labsArticleMetadata(locale: Locale, slug: string) {
  const article = labsArticle(locale, slug);
  if (!article) notFound();
  return buildMetadata({
    title: article.title, description: article.summary, path: `/labs/${slug}/`, locale, languages: article.languages, type: "article",
    image: { url: contentImage(article.cover).src, alt: article.coverAlt }, publishedTime: article.date, modifiedTime: article.updated ?? article.date,
    feed: localizedHref("/labs/rss.xml", locale),
  });
}
```

- [ ] **Step 6: `src/components/LabsCard.tsx`** (server; the index and the home section use it)

```tsx
import Link from "next/link";
import { contentImage } from "@/lib/content-images";
import { dictionary, format } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { formatDate, type LabsArticle } from "@/lib/labs";

/** One article as a card: cover, date and reading time, title, summary, author. The whole card is the link. */
export default function LabsCard({ article, locale, heading: Heading = "h2" }: { article: LabsArticle; locale: Locale; heading?: "h2" | "h3" }) {
  const t = dictionary(locale).labs;
  return (
    <Link prefetch={false} href={article.path} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card/50 transition-colors hover:border-flame/40">
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...contentImage(article.cover, "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw")} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="font-mono text-[11px] text-mut-3">
          <time dateTime={article.date}>{formatDate(article.date, locale)}</time> · {format(t.readingTime, { n: article.readingMinutes })}
        </p>
        <Heading className="mt-4 text-lg font-medium leading-snug text-ink transition-colors group-hover:text-ink-strong">{article.title}</Heading>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-mut-2">{article.summary}</p>
        <p className="mt-5 flex items-center justify-between gap-2 text-[13px]">
          <span className="font-mono text-[11px] text-mut-3">{t.writtenBy} <span className="text-mut">{article.author}</span></span>
          <span className="inline-flex items-center gap-2 text-flame">{t.read}<span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span></span>
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 7: The views**

`src/views/LabsIndexView.tsx`:

```tsx
import LabsCard from "@/components/LabsCard";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { Container } from "@/components/ui";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { labsArticles } from "@/lib/labs";
import { breadcrumbData } from "@/lib/seo";

/** /labs/ and /vi/labs/: every article of the language, newest first. It exists only when the language has one. */
export default function LabsIndexView({ locale }: { locale: Locale }) {
  const { SECTIONS } = getContent(locale);
  const t = dictionary(locale);
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro eyebrow={SECTIONS.labs.title} title={SECTIONS.labs.heading} description={SECTIONS.labs.description} locale={locale} />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labsArticles(locale).map((article) => (
              <li key={article.slug}><LabsCard article={article} locale={locale} /></li>
            ))}
          </ul>
          <p className="mt-10 text-[13px] text-mut-2">
            <a className="fx-underline text-flame" href={localizedHref("/labs/rss.xml", locale)}>{t.labs.feed}</a>
          </p>
        </Container>
      </section>
      <StructuredData data={breadcrumbData([{ name: t.nav.home, path: "/" }, { name: SECTIONS.labs.title, path: "/labs/" }], locale)} />
    </main>
  );
}
```

`src/views/LabsArticleView.tsx`:

```tsx
import { notFound } from "next/navigation";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { Container, CtaBand } from "@/components/ui";
import { getContent } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary, format } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { formatDate, labsArticle } from "@/lib/labs";
import { blogPostingData, breadcrumbData } from "@/lib/seo";

/** One Labs article. Its body is HTML that markdown-it rendered at build time from the CMS file, with raw HTML off. */
export default function LabsArticleView({ locale, slug }: { locale: Locale; slug: string }) {
  const article = labsArticle(locale, slug);
  if (!article) notFound();
  const { SECTIONS } = getContent(locale);
  const t = dictionary(locale);
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <article className="pt-32 pb-24">
        <Container>
          <PageIntro
            eyebrow={`${formatDate(article.date, locale)} · ${format(t.labs.readingTime, { n: article.readingMinutes })}`}
            title={article.title}
            description={article.summary}
            back={{ href: "/labs/", label: SECTIONS.labs.title }}
            locale={locale}
          />
          <p className="mt-4 font-mono text-[12px] text-mut-2">
            {t.labs.writtenBy} <span className="text-mut">{article.author}</span>
            {article.updated ? <> · {t.labs.updated} <time dateTime={article.updated}>{formatDate(article.updated, locale)}</time></> : null}
          </p>
          <figure className="mt-10 max-w-4xl overflow-hidden rounded-3xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...contentImage(article.cover, "(min-width: 1024px) 896px, 100vw")} alt={article.coverAlt} className="h-auto w-full object-cover" />
          </figure>
          <div className="labs-prose mt-12 max-w-3xl" dangerouslySetInnerHTML={{ __html: article.html }} />
          <CtaBand title={t.service.ctaTitle} text={t.service.ctaText} locale={locale} />
        </Container>
      </article>
      <StructuredData data={blogPostingData(article)} />
      <StructuredData data={breadcrumbData([{ name: t.nav.home, path: "/" }, { name: SECTIONS.labs.title, path: "/labs/" }, { name: article.title, path: `/labs/${slug}/` }], locale)} />
    </main>
  );
}
```

- [ ] **Step 8: The route files and `next.config.ts`**

`src/app/(en)/labs/page.en-labs.tsx`:

```tsx
import LabsIndexView from "@/views/LabsIndexView";
import { labsIndexMetadata } from "@/views/metadata";

// A route only when English has an article (next.config.ts lists the en-labs extensions only then).
export const metadata = labsIndexMetadata("en");
export default function Page() {
  return <LabsIndexView locale="en" />;
}
```

`src/app/(en)/labs/[slug]/page.en-labs.tsx`:

```tsx
import LabsArticleView from "@/views/LabsArticleView";
import { labsArticleMetadata, labsStaticParams } from "@/views/metadata";

// A route only when English has an article (next.config.ts lists the en-labs extensions only then).
export const dynamicParams = false;
export function generateStaticParams() { return labsStaticParams("en"); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return labsArticleMetadata("en", (await params).slug); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <LabsArticleView locale="en" slug={(await params).slug} />;
}
```

The Vietnamese twins are the same text with `"vi"`:

```bash
mkdir -p "src/app/(vi)/vi/labs/[slug]"
sed 's/"en"/"vi"/g; s/English has/Vietnamese has/; s/en-labs/vi-labs/' "src/app/(en)/labs/page.en-labs.tsx" > "src/app/(vi)/vi/labs/page.vi-labs.tsx"
sed 's/"en"/"vi"/g; s/English has/Vietnamese has/; s/en-labs/vi-labs/' "src/app/(en)/labs/[slug]/page.en-labs.tsx" > "src/app/(vi)/vi/labs/[slug]/page.vi-labs.tsx"
```

Then make the twin test in Step 1 compare after the same three replacements. Change its last loop to:

```js
    assert.equal(fs.readFileSync(`src/app/(vi)/vi/${page}.vi-labs.tsx`, "utf8"), english.replaceAll('"en"', '"vi"').replace("English has", "Vietnamese has").replace("en-labs", "vi-labs"), page);
```

`next.config.ts` (whole file):

```ts
import type { NextConfig } from "next";
import { labsLocales } from "./src/lib/labs-files.ts";

// Labs pages exist only for a language that has at least one published article (bilingual spec, Part 3): their
// route files are named page.<locale>-labs.tsx and route.<locale>-labs.ts and become routes only when their language
// is listed here. An empty generateStaticParams would fail `output: "export"` (Next's E87).
const labs = labsLocales();

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  pageExtensions: ["tsx", "ts", "jsx", "js", ...labs.flatMap((locale) => [`${locale}-labs.tsx`, `${locale}-labs.ts`])],
  // === FX === React <ViewTransition> on route navigations (the page curtain, src/components/fx/PageTransition.tsx).
  // globalNotFound: one 404 (src/app/global-not-found.tsx) for the two root layouts, written to 404.html.
  experimental: { viewTransition: true, globalNotFound: true },
};

export default nextConfig;
```

- [ ] **Step 9: The article body styles** (`src/app/globals.css`, at the end)

```css
/* Labs article bodies (src/views/LabsArticleView.tsx): HTML that markdown-it rendered from the CMS (h2–h4, lists,
   links, images, quotes, code). Line heights leave room for stacked Vietnamese accents. */
.labs-prose { color: var(--color-mut); font-size: 16px; line-height: 1.75; }
.labs-prose > * + * { margin-top: 1.1em; }
.labs-prose h2, .labs-prose h3, .labs-prose h4 { color: var(--color-ink); font-weight: 500; letter-spacing: -0.02em; line-height: 1.25; margin-top: 2em; scroll-margin-top: 96px; }
.labs-prose h2 { font-size: clamp(24px, 2.6vw, 32px); }
.labs-prose h3 { font-size: clamp(20px, 2vw, 24px); }
.labs-prose h4 { font-size: 18px; }
.labs-prose .labs-anchor { margin-left: 0.4em; color: var(--color-mut-3); text-decoration: none; }
.labs-prose .labs-anchor:hover { color: var(--color-flame); }
.labs-prose a:not(.labs-anchor) { color: var(--color-flame); text-decoration: underline; text-underline-offset: 3px; }
.labs-prose ul, .labs-prose ol { padding-left: 1.4em; }
.labs-prose ul { list-style: disc; }
.labs-prose ol { list-style: decimal; }
.labs-prose li + li { margin-top: 0.4em; }
.labs-prose blockquote { border-left: 2px solid var(--color-flame); padding-left: 1em; color: var(--color-ink); }
.labs-prose code { font-family: var(--font-mono); font-size: 0.9em; background: var(--color-card-2); border-radius: 6px; padding: 0.1em 0.35em; }
.labs-prose pre { overflow-x: auto; background: var(--color-card); border: 1px solid var(--color-line); border-radius: 14px; padding: 1em 1.2em; }
.labs-prose pre code { background: none; padding: 0; }
.labs-prose img { width: 100%; height: auto; border-radius: 16px; border: 1px solid var(--color-line); }
```

- [ ] **Step 10: Validate article bodies in check-content**

In the Labs block that Task 2 added to `scripts/check-content.mjs`, add `import { markdownProblems } from "../src/lib/markdown.ts";` and:

```js
  for (const item of files) errors.push(...markdownProblems(item.data.body, item.file));
  const bodyImages = { LABS: files.flatMap((item) => [...item.data.body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((match) => match[1])) };
  for (const missing of missingImageFiles(bodyImages, path.join(ROOT, "public"), CACHE_DIR)) errors.push(missing.endsWith(")") ? `missing image variant: ${missing}` : `missing image: public${missing}`);
```

Links in article bodies to unknown site pages are not refused here: a path in another language's Labs may not exist yet. check-seo's crawl finds any broken link (Task 8).

- [ ] **Step 11: Tests and gates, commit**

Run: `node --import tsx --test tests/labs-pages.test.mjs tests/labs-files.test.mjs tests/markdown.test.mjs tests/routes.test.mjs && npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs`
Expected: PASS. With no committed article, `nextConfig.pageExtensions` is the default list. Task 8 proves the pages with probe articles in a real build.

```bash
git add src/lib/labs.ts src/components/LabsCard.tsx src/views/LabsIndexView.tsx src/views/LabsArticleView.tsx src/views/metadata.ts src/lib/seo.ts src/lib/i18n/en.ts src/lib/i18n/vi.ts src/app/globals.css "src/app/(en)/labs" "src/app/(vi)/vi/labs" next.config.ts scripts/check-content.mjs tests/labs-pages.test.mjs
git commit -m "feat(labs): article and index pages per language, routed only when the language has articles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Sitemap with translations, packaging, check-export (M, ∥ Task 7)

**Files:**
- Modify: `src/app/sitemap.ts`, `scripts/package-site.mjs`, `scripts/check-export.mjs`

- [ ] **Step 1: The sitemap lists the Labs pages**

```ts
import { labsRoutes } from "@/lib/labs";
…
  return [...getPublishedRoutes(), ...labsRoutes()].map(({ path, alternates }) => ({
```

(the rest as in Part 2; `alternates` holds only the versions that exist, and x-default only when there is an English one). `getPublishedRoutes()` stays the 24 core pages that `tests/content-exports.test.mjs` pins. Labs routes come from the content, so editors can add them.

- [ ] **Step 2: `scripts/package-site.mjs`**

Ship `labs` when it exists, `llms.txt`, and the 301s for every exported page:

```js
const exists=async p=>fs.access(p).then(()=>true,()=>false);
// The Labs folders exist only for a language with articles (next.config.ts); /vi/labs ships inside "vi".
const optionalRoots=["labs"];
for(const name of optionalRoots)if(await exists(path.join(source,name)))roots.push(name);
```

Put this before the copy loop, and add `llms\.txt|` to the root-files pattern: `/^(index\.(html|txt)|404\.html|robots\.txt|sitemap\.xml|llms\.txt|manifest\.webmanifest|__next\..*\.txt)$/`.

For the redirects, add the Labs pages found in `out/`:

```js
const labsPages=async dir=>(await exists(path.join(source,dir)))?[dir,...(await fs.readdir(path.join(source,dir),{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>`${dir}/${e.name}`)]:[];
routes.push(...await labsPages("labs"),...await labsPages("vi/labs"));
```

(change `const routes` to `let`/`push`-able if needed).

- [ ] **Step 3: `scripts/check-export.mjs`**

After the core route loop, check every exported Labs page, its feed and `llms.txt`:

```js
// Labs (Part 3): exist only for a language with articles; each page has one H1, a canonical and its lang, and the
// index has its RSS feed. /llms.txt always ships.
for(const [dir,lang] of [["labs","en"],["vi/labs","vi"]]){
  const index=path.join(root,dir,"index.html");
  const hasIndex=await fs.access(index).then(()=>true,()=>false);
  const hasFeed=await fs.access(path.join(root,dir,"rss.xml")).then(()=>true,()=>false);
  if(hasIndex!==hasFeed)errors.push(`${dir}: the index and rss.xml ship together (index ${hasIndex}, feed ${hasFeed})`);
  if(!hasIndex)continue;
  const pages=[dir,...(await fs.readdir(path.join(root,dir),{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>`${dir}/${e.name}`)];
  for(const page of pages){const html=await fs.readFile(path.join(root,page,"index.html"),"utf8").catch(()=>"");if((html.match(/<h1(?:\s|>)/g)||[]).length!==1)errors.push(`H1 count: ${page}`);if(!html.includes('rel="canonical"'))errors.push(`No canonical: ${page}`);if(!html.includes(`<html lang="${lang}"`))errors.push(`html lang is not ${lang}: ${page}`);}
  const feed=await fs.readFile(path.join(root,dir,"rss.xml"),"utf8");
  if(!feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>')||!feed.includes('<rss version="2.0"'))errors.push(`${dir}/rss.xml is not an RSS 2.0 document`);
  if((feed.match(/<item>/g)||[]).length!==pages.length-1)errors.push(`${dir}/rss.xml has ${(feed.match(/<item>/g)||[]).length} items for ${pages.length-1} articles`);
}
await fs.access(path.join(root,"llms.txt")).catch(()=>errors.push("Missing llms.txt"));
```

- [ ] **Step 4: Gates and commit**

Run: `npm run lint && npm run typecheck && npm test`. Expected: pass. Building with no article, after Task 7 has landed, gives `Export valid: 24 core pages…` with `llms.txt` present. Task 8 builds with probe articles.

```bash
git add src/app/sitemap.ts scripts/package-site.mjs scripts/check-export.mjs
git commit -m "feat(labs): sitemap entries with their translations; package and check the Labs pages, feeds and llms.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: The home Labs section, RSS per language, `/llms.txt` (M, ∥ Task 6)

**Files:**
- Create:
  - `src/lib/labs-feed.ts`;
  - `src/app/(en)/labs/rss.xml/route.en-labs.ts`, `src/app/(vi)/vi/labs/rss.xml/route.vi-labs.ts`;
  - `src/app/llms.txt/route.ts`;
  - `tests/labs-feed.test.mjs`.
- Modify: `src/components/sections/Labs.tsx`

- [ ] **Step 1: Write the failing test** (`tests/labs-feed.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findForbidden } from "../scripts/lib/honesty.mjs";

const { rssFeed, llmsText } = await import("../src/lib/labs-feed.ts");

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-feed-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}
const md = (title, date) => `---\ntitle: ${JSON.stringify(title)}\nsummary: "Notes & <tips> for a pilot."\ncover: /images/suite/neural-net.webp\ncoverAlt: "A diagram"\ndate: ${date}\nupdated: ""\nauthor: "Lan Nguyen"\n---\n\n## Start\n\nText.\n`;

test("RSS 2.0 per language: channel, self link, newest first, escaped text", () => {
  const root = project({ "content/articles/a.md": md("First & best", "2026-10-01"), "content/articles/b.md": md("Second", "2026-10-15") });
  try {
    const xml = rssFeed("en", root);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">'));
    assert.match(xml, /<atom:link href="https:\/\/spacegear\.tech\/labs\/rss\.xml" rel="self" type="application\/rss\+xml"\/>/);
    assert.match(xml, /<language>en<\/language>/);
    assert.ok(xml.indexOf("<title>Second</title>") < xml.indexOf("<title>First &amp; best</title>"), "newest first");
    assert.match(xml, /<description>Notes &amp; &lt;tips&gt; for a pilot\.<\/description>/);
    assert.match(xml, /<pubDate>Thu, 15 Oct 2026 00:00:00 GMT<\/pubDate>/);
    assert.match(xml, /<guid isPermaLink="true">https:\/\/spacegear\.tech\/labs\/b\/<\/guid>/);
    assert.match(xml, /<dc:creator>Lan Nguyen<\/dc:creator>/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("llms.txt names the key pages in both languages and every article, and makes no claim", () => {
  const root = project({ "content/vi/articles/a.md": md("Bài viết", "2026-10-01"), "content/articles/a.md": `---\ntitle: ""\nsummary: ""\ncover: /images/suite/neural-net.webp\ncoverAlt: ""\ndate: 2026-10-01\nupdated: ""\nauthor: "Lan Nguyen"\n---\n` });
  try {
    const text = llmsText(root);
    assert.match(text, /^# spacegear\.tech\n\n> /);
    for (const url of ["https://spacegear.tech/", "https://spacegear.tech/services/applied-ai/", "https://spacegear.tech/contact/", "https://spacegear.tech/vi/", "https://spacegear.tech/vi/contact/", "https://spacegear.tech/vi/labs/a/"]) assert.ok(text.includes(`](${url})`), url);
    assert.doesNotMatch(text, /\]\(https:\/\/spacegear\.tech\/labs\//, "no English Labs entries without English articles");
    assert.deepEqual(findForbidden(text, "llms.txt"), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
```

Run: `node --import tsx --test tests/labs-feed.test.mjs`
Expected: FAIL, `Cannot find module …/src/lib/labs-feed.ts`.

- [ ] **Step 2: `src/lib/labs-feed.ts`**

```ts
// Machine-readable lists: RSS 2.0 per language for the Labs articles (/labs/rss.xml, /vi/labs/rss.xml), and
// /llms.txt (llmstxt.org): the key pages in both languages and every article, from the CMS copy (no new claims).
import { getContent } from "./content";
import { dictionary } from "./i18n/dictionary";
import { HTML_LANG, LOCALES, localizedHref, type Locale } from "./i18n/locales";
import { labsArticles } from "./labs";
import { canonicalUrl } from "./seo";
import { SITE, siteFor } from "./site";

const xml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const rfc822 = (date: string) => new Date(`${date}T00:00:00Z`).toUTCString();

export function rssFeed(locale: Locale, root?: string): string {
  const { SECTIONS } = getContent(locale);
  const articles = labsArticles(locale, root);
  const items = articles.map((article) => {
    const url = canonicalUrl(article.path);
    return `<item><title>${xml(article.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${rfc822(article.date)}</pubDate><description>${xml(article.summary)}</description><dc:creator>${xml(article.author)}</dc:creator></item>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "<channel>",
    `<title>${xml(`${SECTIONS.labs.title} · ${SITE.name}`)}</title>`,
    `<link>${canonicalUrl(localizedHref("/labs/", locale))}</link>`,
    `<description>${xml(SECTIONS.labs.description)}</description>`,
    `<language>${HTML_LANG[locale]}</language>`,
    `<atom:link href="${canonicalUrl(localizedHref("/labs/rss.xml", locale))}" rel="self" type="application/rss+xml"/>`,
    ...(articles[0] ? [`<lastBuildDate>${rfc822(articles[0].updated ?? articles[0].date)}</lastBuildDate>`] : []),
    ...items,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function llmsText(root?: string): string {
  const line = (title: string, path: string, text: string) => `- [${title}](${canonicalUrl(path)}): ${text}`;
  const sections = LOCALES.flatMap((locale) => {
    const t = dictionary(locale);
    const { SERVICES } = getContent(locale);
    const at = (path: string) => localizedHref(path, locale);
    const pages = [
      line(t.nav.home, at("/"), t.meta.homeDescription),
      line(t.services.title, at("/services/"), t.services.description),
      ...SERVICES.map((service) => line(service.name, at(`/services/${service.slug}/`), service.summary)),
      line(t.approach.title, at("/approach/"), t.approach.description),
      line(t.about.title, at("/about/"), t.about.description),
      line(t.contact.title, at("/contact/"), t.contact.description),
      line(t.privacy.title, at("/privacy/"), t.privacy.description),
      line(t.terms.title, at("/terms/"), t.terms.description),
    ];
    const articles = labsArticles(locale, root).map((article) => line(article.title, article.path, article.summary));
    const heading = locale === "en" ? "Pages" : "Trang tiếng Việt";
    return [`## ${heading}`, "", ...pages, "", ...(articles.length ? [`## Labs${locale === "en" ? "" : " (tiếng Việt)"}`, "", ...articles, ""] : [])];
  });
  return [`# ${SITE.name}`, "", `> ${siteFor("en").description}`, "", `${SITE.name} is in English and in Vietnamese (under /vi/).`, "", ...sections].join("\n");
}
```

- [ ] **Step 3: The route handlers**

`src/app/(en)/labs/rss.xml/route.en-labs.ts`:

```ts
import { rssFeed } from "@/lib/labs-feed";

// /labs/rss.xml, only when English has an article (next.config.ts lists the en-labs extensions only then).
export const dynamic = "force-static";
export function GET() {
  return new Response(rssFeed("en"), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
```

`src/app/(vi)/vi/labs/rss.xml/route.vi-labs.ts`: the same with `"vi"`, "Vietnamese has" and `vi-labs`.

`src/app/llms.txt/route.ts`:

```ts
import { llmsText } from "@/lib/labs-feed";

// /llms.txt (llmstxt.org): the key pages in both languages and every Labs article.
export const dynamic = "force-static";
export function GET() {
  return new Response(llmsText(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
```

- [ ] **Step 4: The home Labs section** (`src/components/sections/Labs.tsx`, whole file)

```tsx
import Link from "next/link";
import LabsCard from "@/components/LabsCard";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import { Container, SectionHeader } from "@/components/ui";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { labsArticles } from "@/lib/labs";

/** Whether the section renders in `locale`: only when the language has an article (the home rail lists it only then). */
export const hasLabs = (locale: Locale) => labsArticles(locale).length > 0;
export const HAS_LABS = hasLabs("en");

/** The home page's Labs section: the three newest articles in the page's language and a link to all of them. */
export default function Labs({ locale = "en" }: { locale?: Locale }) {
  const articles = labsArticles(locale).slice(0, 3);
  if (articles.length === 0) return null;
  const t = dictionary(locale).labs;
  return (
    <section id="labs" className="relative scroll-mt-2 py-24">
      <Container>
        <SectionHeader {...getContent(locale).SECTIONS.labs} />
        <div className="mt-12 hidden gap-4 sm:grid sm:grid-cols-3">
          {articles.map((article, i) => (
            <Reveal key={article.slug} delay={80 + i * 70}>
              <LabsCard article={article} locale={locale} heading="h3" />
            </Reveal>
          ))}
        </div>
        <SnapRow className="mt-10 sm:hidden" itemClassName="w-[85%]">
          {articles.map((article) => <LabsCard key={article.slug} article={article} locale={locale} heading="h3" />)}
        </SnapRow>
        <p className="mt-8 text-right">
          <Link prefetch={false} href={localizedHref("/labs/", locale)} className="fx-underline text-[13px] text-flame">{t.allArticles} →</Link>
        </p>
      </Container>
    </section>
  );
}
```

- [ ] **Step 5: Tests and gates, commit**

Run: `node --import tsx --test tests/labs-feed.test.mjs tests/labs-pages.test.mjs && npm run lint && npm run typecheck && npm test`
Expected: PASS. If the pubDate weekday in the test differs, the date is wrong, not the test: 2026-10-15 is a Thursday.

```bash
git add src/lib/labs-feed.ts "src/app/(en)/labs/rss.xml" "src/app/(vi)/vi/labs/rss.xml" src/app/llms.txt/route.ts src/components/sections/Labs.tsx tests/labs-feed.test.mjs
git commit -m "feat(labs): home section with the newest articles, RSS per language and /llms.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Checks: check-seo, locale-checks and browser-check, proven with probe articles (M; after Tasks 6 and 7)

**Files:**
- Modify: `scripts/check-seo.mjs`, `scripts/locale-checks.mjs`
- Scratch (never committed): `content/articles/zz-probe-*.md`, `content/vi/articles/zz-probe-*.md`

- [ ] **Step 1: check-seo: "unknown `/labs/*` returns 404", and Labs pages in the crawl**

1. Route count. `assert.equal(routes.length, 24, …)` becomes:

```js
const core = routes.filter(route => !/^\/(?:vi\/)?labs\//.test(route));
assert.equal(core.length, 24, "core sitemap route count (12 pages in English and Vietnamese)");
```

2. hreflang. A Labs page names only the versions that exist; x-default only when there is an English one. Replace the fixed hreflang assertion with:

```js
    const isLabs = /^\/(?:vi\/)?labs\//.test(route);
    const own = new URL(route, canonicalOrigin).href;
    assert.equal(data.hreflang[locale], own, `${route}: hreflang names the page itself`);
    if (!isLabs) assert.deepEqual(Object.keys(data.hreflang).sort(), ["en", "vi", "x-default"], `${route}: both versions and x-default`);
    if (data.hreflang.en) assert.equal(data.hreflang["x-default"], data.hreflang.en, `${route}: x-default is the English version`);
    else assert.equal(data.hreflang["x-default"], undefined, `${route}: no x-default without an English version`);
    versions.set(route, JSON.stringify(data.hreflang));
```

   The reciprocity loop after the crawl visits every version a page names:

```js
  for (const [route, links] of versions) {
    for (const href of Object.values(JSON.parse(links))) {
      const twin = new URL(href).pathname;
      assert.equal(versions.get(twin), links, `${route} and ${twin} name each other the same way`);
    }
  }
```

   In the sitemap loop, accept `["en", "x-default"]` or `["vi"]` for Labs entries:

```js
    const where = entry.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "";
    if (!/\/labs\//.test(where)) assert.deepEqual(languages, ["en", "vi", "x-default"], `sitemap alternates for ${where}`);
    else assert.ok(languages.length > 0, `sitemap alternates for ${where}`);
```

3. og:locale:alternate on a Labs page lists only the languages that exist: `assert.deepEqual(data.ogAlternate, isLabs ? …)`. Compute the expected value from `data.hreflang` minus the page's own language and `x-default`.
4. The 404 rule becomes "unknown `/labs/*` returns 404":

```js
  for (const route of ["/unknown-page/", "/vi/unknown-page/", "/labs/no-such-article/", "/vi/labs/no-such-article/", "/work/old-demo/", "/api/unknown"])
```

   Also: when `/labs/` is not in the sitemap, `/labs/` itself returns 404, and likewise `/vi/labs/`:

```js
  for (const index of ["/labs/", "/vi/labs/"]) if (!routes.includes(index)) assert.equal((await fetch(new URL(index, base))).status, 404, `${index} does not exist without articles in its language`);
```

5. Feeds and llms.txt:

```js
  for (const [index, feed] of [["/labs/", "/labs/rss.xml"], ["/vi/labs/", "/vi/labs/rss.xml"]]) {
    const response = await fetch(new URL(feed, base));
    assert.equal(response.status, routes.includes(index) ? 200 : 404, `${feed} exists exactly when ${index} does`);
  }
  const llms = await (await fetch(new URL("/llms.txt", base))).text();
  for (const route of routes) if (/\/labs\/[^/]+\/$/.test(route) || route === "/" || route === "/vi/") assert.ok(llms.includes(`](${new URL(route, canonicalOrigin).href})`), `/llms.txt lists ${route}`);
```

- [ ] **Step 2: locale-checks: Vietnamese Labs pages, when they exist**

In `scripts/locale-checks.mjs`, read the sitemap at the start of `localeChecks`, and add every `/vi/labs/…` route to the leak and width lists:

```js
  const sitemap = await (await fetch(new URL("/sitemap.xml", base))).text();
  const viRoutes = [...VI_ROUTES, ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).filter((p) => p.startsWith("/vi/labs/"))];
```

and use `viRoutes` instead of `VI_ROUTES` in sections 2 and 4. Also add: a visitor from Vietnam on an English-only article stays on it (its twin is missing). If the sitemap has an English Labs article with no `vi` alternate, fetch it with `x-sg-test-country: VN` and expect 200.

- [ ] **Step 3: Probe run A: one English-only article** (not committed; `zz-probe-` is refused in production by check-content)

```bash
cd "E:/Personal/clone website/spacegear-hero"
cat > content/articles/zz-probe-english.md <<'EOF'
---
title: "Probe: how we write down a baseline"
summary: "A test article for the Labs pages. It is never committed."
cover: /images/suite/neural-net.webp
coverAlt: "A neural network diagram"
date: 2026-10-23
updated: ""
author: "Probe Author"
---

## Why a baseline

Before a pilot, both sides write down how the work is done today.

### What we record

- The steps of the workflow
- Who reviews the result

> A baseline is agreed, not assumed.

![A neural network diagram](/images/suite/neural-net.webp)

See [how we work](/approach/) or [the source](https://example.org/notes).
EOF
bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 rebuild
for p in /labs/ /labs/zz-probe-english/ /labs/rss.xml /vi/labs/ /vi/labs/zz-probe-english/ /vi/labs/rss.xml; do printf "%s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8792$p"; done
curl -s -o /dev/null -w "%{http_code}\n" -H "x-sg-test-country: VN" http://127.0.0.1:8792/labs/zz-probe-english/
bash "<wt.sh>" "E:/Personal/clone website/spacegear-hero" 8792 run npm run check:seo -- http://127.0.0.1:8792
```

Expected:
- `/labs/`, the article and `/labs/rss.xml` are `200`; the three `/vi/labs/` paths are `404`;
- the visitor from Vietnam gets `200` (no Vietnamese twin, no redirect);
- the build log shows `Export valid: 24 core pages…`;
- check-seo passes: 26 routes, the article's hreflang only `en` + `x-default`.

Also check the article page in a browser at 390 px and 1440 px (wt.sh run of a short Playwright script, or `test:browser`'s 320 px sweep in Task 9):
- the anchors are present;
- the image is lazy;
- `https://example.org` has `rel="noopener noreferrer"`;
- the home page shows the Labs section in English only;
- the `/vi/` home shows none.

- [ ] **Step 4: Probe run B: both languages, and a Vietnamese-only article**

Add `content/vi/articles/zz-probe-english.md` with the same cover, date and author and Vietnamese text. Then add `content/articles/zz-probe-vietnamese.md` with empty English text fields and `content/vi/articles/zz-probe-vietnamese.md` filled in. For example:

```bash
cat > content/vi/articles/zz-probe-english.md <<'EOF'
---
title: "Bài thử: cách chúng tôi ghi lại mốc cơ sở"
summary: "Đây là bài viết thử cho các trang Labs và không bao giờ được commit."
cover: /images/suite/neural-net.webp
coverAlt: "Sơ đồ mạng nơ-ron"
date: 2026-10-23
updated: ""
author: "Probe Author"
---

## Vì sao cần mốc cơ sở

Trước khi thí điểm, hai bên cùng ghi lại cách công việc đang được thực hiện.
EOF
cat > content/articles/zz-probe-vietnamese.md <<'EOF'
---
title: ""
summary: ""
cover: /images/suite/neural-net.webp
coverAlt: ""
date: 2026-10-22
updated: ""
author: "Probe Author"
---
EOF
cat > content/vi/articles/zz-probe-vietnamese.md <<'EOF'
---
title: "Bài thử chỉ có tiếng Việt"
summary: "Bài viết này chỉ có bản tiếng Việt."
cover: /images/suite/neural-net.webp
coverAlt: "Sơ đồ mạng nơ-ron"
date: 2026-10-22
updated: ""
author: "Probe Author"
---

## Mở đầu

Nội dung thử nghiệm Ấ Ở Ữ.
EOF
```

Rebuild. Run check-seo and `node --experimental-strip-types scripts/locale-checks.mjs http://127.0.0.1:8792` (wt.sh). Expected:
- both pass;
- `/vi/labs/` and `/vi/labs/rss.xml` are `200` (two items);
- the English article names both versions;
- the Vietnamese-only article names only `vi` and has no x-default;
- the Vietnamese home shows its Labs section;
- the masks check covers `/vi/labs/` titles;
- no English leaks on the Vietnamese Labs pages.

- [ ] **Step 5: Remove the probes, rebuild clean**

```bash
cd "E:/Personal/clone website/spacegear-hero"
rm content/articles/zz-probe-english.md content/articles/zz-probe-vietnamese.md content/vi/articles/zz-probe-english.md content/vi/articles/zz-probe-vietnamese.md
git status --short content
```

Expected: `git status` shows nothing under `content/`. Rebuild (wt.sh). Expected:
- `/labs/` and `/vi/labs/` are `404` again;
- check-seo passes with 24 routes.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-seo.mjs scripts/locale-checks.mjs
git commit -m "test(labs): unknown /labs/* is 404; Labs pages, feeds and llms.txt in the SEO crawl and the locale checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Report the probe runs' outputs (status codes, check-seo and locale-check lines).

### Task 9: The editor guide in the README, and the final gates for Part 3 (M)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: "Publishing a Labs article"** (new README section under "Editing content")

Cover, in short numbered steps:
1. Open `/admin/` (live: sign in with GitHub; local: Work with Local Repository), then choose **Labs → New**.
2. **Title.** The address (slug) is filled from it. You can edit it now, never after the first save (the page address would break). It is lowercase letters, digits and hyphens.
3. **Summary** (up to 200 characters), **Cover image** (upload the article's own image), **Cover description** (for screen readers), **Published** date, **Author** (a real person's name).
4. **Article.**
   - Use headings ## to ####, lists, links, quotes, code and images; every image needs a description.
   - No raw HTML.
   - Site links such as `/contact/` follow the page's language by themselves.
5. **Vietnamese.**
   - Write the Vietnamese side in the right-hand pane. The cover, the dates and the author are copied from English.
   - For an English-only article, switch Vietnamese off in the pane's menu.
   - For a Vietnamese-only article, leave the English title, summary, cover description and text empty.
6. **Save.** That is a commit to `main`; Workers Builds deploys it and the article is live in about 3 minutes, at `/labs/<slug>/` and/or `/vi/labs/<slug>/`.
   - The home page's Labs section shows the three newest articles.
   - `/labs/rss.xml`, `/vi/labs/rss.xml`, the sitemap and `/llms.txt` list them.
7. **What the build refuses**, with the messages' meaning:
   - a half-filled language;
   - a missing title;
   - shared fields that differ;
   - a heading `#` or `#####`;
   - raw HTML;
   - an image without a description;
   - a link that is not a site path or `https://`;
   - invented claims (the honesty rules apply to articles in both languages);
   - a `zz-probe-` article in a production build.
8. **Updating an article.**
   - Change it and set **Updated**, only for a change in substance.
   - Renaming is not possible. Make a new article and delete the old one; the old address then returns 404.

Also update "What the build checks" (Labs files, Markdown, both languages) and "Languages" (Labs pages exist only for a language with articles: the `pageExtensions` gate in `next.config.ts`).

- [ ] **Step 2: Final gates, once**

```bash
cd "E:/Personal/clone website/spacegear-hero"
npm run lint && npm run typecheck && npm test && node --experimental-strip-types scripts/check-content.mjs
bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 rebuild
bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 run npm run check:seo -- http://127.0.0.1:8792
bash "C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh" "E:/Personal/clone website/spacegear-hero" 8792 run npm run test:browser -- http://127.0.0.1:8792
```

Expected:
- `Content valid: 12 routes; preview mode.`;
- `Export valid: 24 core pages…` with `llms.txt`;
- check-seo passes on 24 pages; `/labs/no-such-article/` and `/vi/labs/no-such-article/` are 404;
- `Browser checks passed` (the CMS lists "Labs").

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): publishing a Labs article in English and/or Vietnamese

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage (self-review)

| Spec requirement (Part 3) | Task |
|---|---|
| CMS collection "Labs" (`label: Labs`) replacing the `articles` link-card schema | 1, 4 |
| Files `content/articles/<slug>.md` and `content/vi/articles/<slug>.md`, Markdown with front matter, shared slug, one language allowed | 2, 4 |
| Fields `title`, `summary` (≤ 200), `body` (h2–h4, lists, links, images, blockquote, code; no raw HTML), `cover`, `coverAlt`, `date`, optional `updated`, `author`; text per language, `cover`/`date`/`updated`/`author` shared | 2, 3, 4 |
| `/labs/` and `/vi/labs/` (newest first), `/labs/<slug>/` and `/vi/labs/<slug>/` | 5 |
| A language without articles gets neither page (works with `output: "export"`) | 2 (`labsLocales`), 5 (`pageExtensions`), 8 (probe runs) |
| check-seo: "unknown `/labs/*` returns 404" | 8 |
| Markdown at build time with a small, well-known renderer, pinned, ≥ 14 days old, raw HTML off | 3 (markdown-it 15.0.2) |
| Heading anchors, estimated reading time, images through `contentImage()`, `rel="noopener noreferrer"` on external links | 3, 5 |
| Home: the 3 newest in the page's language, link to the index, hidden when none | 7 |
| BlogPosting JSON-LD (headline, description, author Person, dates, image, inLanguage, publisher Organization); OG image = cover; hreflang between existing translations; sitemap entries | 5, 6 |
| RSS per language (`/labs/rss.xml`, `/vi/labs/rss.xml`); `/llms.txt` with key pages and articles in both languages | 7 |
| Honesty and content checks over article front matter and bodies in both languages | 2 (tests and check-content), 5 (Markdown validation) |
| Publishing: `/admin/` → Labs → New → English and/or Vietnamese → Save → live in about 3 minutes | 4, 9 |

## Risks and decisions for the controller

1. **Vietnamese-only articles keep an empty English file.** Sveltia 0.230.1 cannot switch off its default language. The loader and check-content treat an English file with an empty title as "not in English". The README explains this to editors. The alternative is two separate collections, which would lose the shared cover, dates and author.
2. **The slug** comes from the English title at creation, through `slug.editable: [create]`. For a Vietnamese-only article the editor types it. Verify once in a live CMS session on the preview that the slug field shows on "New" and that both language files get the same name. Task 4's schema check proves only that the options exist.
3. **`next.config.ts` imports a TypeScript module.** Next's own loader handles that: an SWC require hook, or Node's native TypeScript resolver on Node ≥ 22.18. If Workers Builds' Node behaves differently, the fallback is to inline the `labsLocales()` file scan (about 15 lines) in `next.config.ts`.
4. **Probe articles** (Task 8) are the only way to prove the pages in a real build without publishing invented content. They are written into the shared working tree for two builds and then deleted. `zz-probe-` slugs fail check-content in production mode, so they can never ship by accident.
5. **Reading time** uses 220 words a minute in both languages (Vietnamese words are syllables, so it slightly overestimates). This is a display estimate, not a claim.

