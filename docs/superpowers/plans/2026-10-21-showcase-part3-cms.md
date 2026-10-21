# Showcase Part 3 (CMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors can change the site's copy and images through a git-based CMS at `/admin/` (Sveltia CMS, vendored), without touching code, while the exported site renders byte-for-byte the same HTML as before and every honesty, CSP and packaging gate stays green.

**Architecture:** All copy moves from `src/lib/content.ts` into `content/` (JSON singletons, one-file-per-entry folder collections with an `order` field, and Markdown legal pages). `src/lib/content.ts` becomes a typed loader: it imports the JSON statically (`with { type: "json" }`), validates it with a tiny in-repo schema layer (`src/lib/content-schema.ts`, no zod), derives the same values and exports the same names and types, so no component logic changes. A generated, committed `src/lib/content-index.generated.ts` lists the folder-collection entries, because the loader also runs in the browser bundle and in the Worker, where it cannot read a folder. `/admin/` is a static page that loads a pinned, integrity-checked copy of Sveltia CMS from `public/admin/sveltia/`, with its own CSP rule in `public/_headers`. CMS uploads go to `public/uploads/`; a sharp build step writes 640 and 1280 px WebP variants into a cache outside `public/` (`photo.jpg` → `photo.jpg.w640.webp`, see "Amendments" for Task 7), packaging ships them next to the originals under `/uploads/`, and `contentImage()` renders uploads through those variants.

**Tech Stack:** Next.js 16.2.7 static export (Turbopack), React 19.2, TypeScript 5.9, Node 22.14 (`--experimental-strip-types`, `node:test` + tsx), sharp 0.34, Sveltia CMS 0.230.1 (vendored `dist/` IIFE build; the pin moved from 0.250.0, see "Controller amendments"), js-yaml 4.2.0 (tests only), Cloudflare Workers Static Assets (`_headers`), Playwright (Chromium).

**Spec:** `docs/superpowers/specs/2026-10-21-spacegear-showcase-design.md`, Part 3, plus "Guardrails" and "Testing and verification".

---

## Research summary (read before Task 9)

**Version and distribution.** Pinned in Task 9: `0.230.1` (published 2026-10-07T11:00Z, at least 14 days old), tarball `https://registry.npmjs.org/@sveltia/cms/-/cms-0.230.1.tgz`, integrity `sha512-2iTmW3txB2ocqzEO6b/hkr9Txbw+AFMfmmmqarY3B0WrG5eikwXwYwFWB5CGoQMz1JT5RvcVnKINAWBcVfVRMg==`. Planning inspected `0.250.0` (latest on 2026-10-21, integrity `sha512-VDdYsC2zSiXGGvzgPIJMVyG9Yf3JsAFXr6OltZZnv7kTANHeOVS1hjuorUfa472rWO40l1bheKPOhEFtpdoNtg==`); the notes below hold for 0.230.1 unless they say otherwise. The package ships two builds:

| Build | Files | Usable unbundled? |
|---|---|---|
| `dist/sveltia-cms.js` (IIFE, auto-initializes) | 0.230.1: 2.25 MB + `dist/chunks/react-dom.js` (0.250.0: 2.5 MB + `dist/chunks/{git,qrcode,react-dom}.js` + `dist/chunks/assets/rolldown-runtime-*.js`) | **Yes.** This is the documented browser build (docs: plain `<script>`, "not distributed as an ES module"). It loads its chunks with `import(new URL("chunks/<name>.js", document.currentScript.src))` and only falls back to unpkg if that fails (functions `hH`/`_H` in 0.230.1, `DSe` in 0.250.0), so the chunks vendored next to it are used. |
| `npm/index.js` (ESM for bundlers) | 2.5 MB + 300 chunks + fonts/wasm | No: it has bare dynamic imports (`import("exifr/…")`, `import("@shikijs/langs/…")`) and JSON locale imports that need a bundler and the package's dependencies installed. |

**Decision:** vendor `dist/sveltia-cms.js`, `dist/chunks/**/*.js` and `LICENSE.txt` (no source maps) into `public/admin/sveltia/` with `scripts/vendor-sveltia.mjs`, which downloads the pinned tarball, verifies its sha512 integrity, extracts with a small built-in tar reader and records sha256 hashes in `scripts/sveltia-cms.lock.json`. `npm test` re-verifies the hashes offline. Sveltia is not installed into `node_modules`. (The CMS worktree has its own `node_modules`, installed with `npm ci`, because Turbopack rejects a `node_modules` junction that points outside the project root; see "Amendments made during execution".)

**What the bundle fetches at run time** (inspected in `dist/sveltia-cms.js` 0.250.0, and again in 0.230.1 in Task 9, which also booted it headless):
- `@font-face` rules for Source Sans 3, Noto Mono and Material Symbols (the UI icons) from `https://cdn.jsdelivr.net/fontsource/fonts/…`. Without them the icons render as words, so the admin CSP allows that one path for fonts.
- An update check, `fetch("https://unpkg.com/@sveltia/cms/package.json")`, on start and hourly (wrapped in try/catch). Blocked on purpose.
- Non-English UI strings from `https://unpkg.com/@sveltia/cms@<pinned version>/locales/<locale>.json`. Blocked: the CMS then shows an error and falls back to English (choose English in its settings).
- Optional libraries from unpkg, only when their feature is used: exifr (asset details), turndown (HTML paste in the rich-text editor), Immutable (custom preview templates), Leaflet/terra-draw (map field), PDF.js, SVGO, jSquash, the HEIC decoder, Shiki and Day.js locales. This config uses none of them: text fields are plain `string`/`text` widgets and image optimisation uses Chrome's native WebP encoder (`OffscreenCanvas.convertToBlob`).
- `https://api.github.com` with the GitHub backend (later). **Corrected in Task 9:** `https://www.githubstatus.com/api/v2/status.json` is fetched on the sign-in screen whenever `backend.name` is `github`, so also before "Work with Local Repository" (headless boot, see "Amendments", Task 9).
- No `eval` or `new Function` in the bundle.

**CSP for `/admin/*`** (sources: Sveltia's CSP guide, https://sveltiacms.app/en/docs/security#setting-up-content-security-policy, which lists `style-src 'self' 'unsafe-inline'`, `font-src 'self' https://cdn.jsdelivr.net`, `img-src 'self' blob: data:`, `media-src blob:`, `frame-src blob:`, `script-src 'self' https://unpkg.com`, `connect-src 'self' blob: data: https://unpkg.com`, `manifest-src blob:`, and states that Sveltia "does not require the `unsafe-eval` and `unsafe-inline` keywords in the `script-src` CSP directive"; plus the bundle inspection above):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' https://cdn.jsdelivr.net/fontsource/; connect-src 'self' blob: data:; media-src 'self' blob:; frame-src blob:; manifest-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`unpkg.com` is dropped from `script-src` and `connect-src` because the code is vendored; `font-src` is narrowed to the Fontsource path. Later, the GitHub backend adds `https://api.github.com https://www.githubstatus.com` to `connect-src` and `https://avatars.githubusercontent.com` to `img-src` (README, Task 11).

**`_headers` mechanics** (Cloudflare docs, https://developers.cloudflare.com/workers/static-assets/headers/, and the asset worker in `node_modules/miniflare/dist/src/workers/assets/assets.worker.js`, `attachCustomHeaders`): every matching rule applies in file order; a header set twice is joined with a comma (which would make the browser enforce **both** CSPs); `! Header-Name` removes a header set by an earlier rule. Within one rule, removals run before sets. So the `/admin/*` rule, placed after `/*`, removes `Content-Security-Policy` and `X-Robots-Tag` and sets its own. `/admin/*` matches `/admin/` (the splat may be empty). Lines are limited to 2,000 characters, rules to 100.

**Local workflow** (https://sveltiacms.app/en/docs/workflows/local): Chromium only (File System Access API), on `localhost`/`127.0.0.1`; "Work with Local Repository", then pick the folder that contains `.git`; no proxy server; edits are saved to files and the owner commits. The bundle accepts a `.git` **file** (linked worktree), but in-browser commits are not supported in linked worktrees, so saving works and committing is done with git. A backend must still be configured (`github` + any `owner/repo`); the local workflow never contacts it. The bundle reads `config.yml` from `<link rel="cms-config-url">` (default `/admin/config.yml`) and injects `<meta name="robots" content="noindex">` itself.

**Next 16 and JSON.** `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md`: "JSON Imports: Supported". Next's SWC parser options enable import attributes (`importAssertions: true`, `keepImportAttributes: true` in `next/dist/build/swc/options.js`). Probes in the planning scratchpad confirmed that `import x from "./a.json" with { type: "json" }` plus `.ts` specifiers work under `node --experimental-strip-types` (Node 22.14, no warning), tsx 4.23, esbuild 0.28 (the Worker bundle) and `tsc` 5.9 with both tsconfigs. Turbopack is first exercised by the Task 4 build; the fallback is in Task 4.

**Verified in planning (scratchpad prototypes, not in the repo):** the loader reproduces all 23 exports with identical values and key order (`JSON.stringify` equality); the type contract passes and fails on a drifted type; ESLint passes; 81 unit tests pass; `config.yml` validates against Sveltia 0.250.0's own JSON schema (`schema/sveltia-cms.json`, via ajv) and mirrors the content schemas (the committed config was re-validated against 0.230.1's schema in Task 9); the legal Markdown renders the same static markup and element tree as the JSX; the vendor script's tar reader extracts the six files listed in Task 9 with the hashes listed there; the HTML snapshot tool reports a build identical to itself.

---

## Conventions for every task

- **Worktree.** `E:\Personal\clone website\spacegear-cms`, branch `feat/showcase-cms` (cut from `feat/spacegear-showcase` by the controller), with its own `node_modules` from `npm ci` (Turbopack rejects a `node_modules` junction that points outside the project root). Install dependencies there with plain `npm install`. Preview port **8788**. Never touch the main worktree (`spacegear`, port 8787, Part 1) or `platform-clone`.
- **Read first:** `C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/showcase-conventions.md` (machine limits, lock helper, rules that must not regress), and `AGENTS.md` (read `node_modules/next/dist/docs/` before Next-specific code).
- **Bash prelude.** Shell state does not persist between Bash calls, so start every Bash call with:
  ```bash
  CMS="/e/Personal/clone website/spacegear-cms"; WT="C:/Users/thach/AppData/Local/Temp/claude/E--Personal-clone-website/81ce8a4b-3639-4a15-9c74-49abc7d95e2b/scratchpad/tasks/wt.sh"
  ```
  Commands below use `$CMS` and `$WT` and always `cd "$CMS"` first.
- **Heavy work goes through the lock** (Bash tool, `timeout: 600000`): `bash "$WT" "$CMS" 8788 rebuild` (stops the preview, `rm -rf dist/_next`, `npm run build:cf`, restarts the preview on 8788) and `bash "$WT" "$CMS" 8788 run <command>`. Never run `next dev`. Never leave a browser running.
- **Fast gates** (no lock): `cd "$CMS" && npm run lint && npm run typecheck && npm test`.
- **Heavy gates:** rebuild, then `bash "$WT" "$CMS" 8788 run npm run check:seo -- http://127.0.0.1:8788`, then `bash "$WT" "$CMS" 8788 run npm run test:browser -- http://127.0.0.1:8788`. `check:fidelity` is not part of this plan: the HTML identity check proves that nothing renders differently.
- **Rendered output must not change.** Tasks that touch rendering end with `node scripts/html-snapshot.mjs compare artifacts/html-baseline` after a rebuild. The expected result is `Rendered HTML identical to artifacts/html-baseline: 15 pages.` A difference is a bug to fix, never a reason to loosen the normalizer, except for a build-noise pattern that appears identically in both builds of the same page (record it under "Amendments").
  - **Client module ids** (format 3, after the Task 6b review) are Turbopack's, and they shift whenever the module set changes. Tasks 7, 9 and 10 add client modules, so their compare may report pages where only client module ids changed.
  - **Before rebuilding,** copy the saved build's chunks. Remove the old copy first, so stale chunks cannot be matched: `rm -rf artifacts/dist-before && mkdir -p artifacts/dist-before/_next/static && cp -r dist/_next/static/chunks artifacts/dist-before/_next/static/`.
  - **Then run** `node scripts/html-snapshot.mjs compare artifacts/html-baseline --explain-client-ids artifacts/dist-before`. It passes only when every changed id is explained: the same `$client` export at the same place in an otherwise identical page, with factory code identical in the two builds apart from module ids, each of which is explained the same way (see the merge notes).
  - Record the explained ids under "Amendments" and save the baseline again.
- **Line endings.** A fresh worktree on this machine is checked out with `core.autocrlf=true`, so existing files may be CRLF. The Edit tool handles that; anchors in this plan never span a line break. New files are written with LF. Every check this plan adds normalizes CRLF; the vendored Sveltia files are marked `-text -diff` in `.gitattributes` so their bytes never change.
- **Shared files** (Part 1 and Part 2 also edit them): `package.json`, `package-lock.json`, `public/_headers`, `scripts/package-site.mjs`, `scripts/check-export.mjs`, `scripts/check-seo.mjs`, `scripts/browser-check.mjs`, `scripts/build-production.mjs`. Every edit there is additive and fenced with `>>> CMS (showcase Part 3)` / `<<< CMS` comments, except the `build` script line in `package.json`.
- **Files Part 1 and 2 own:** `EarthScene.tsx`, `OrbitalCinematic.tsx`, the hero, `src/components/fx/`. This plan never edits them. Task 8 makes one-line, output-neutral edits to ten image render sites in section components; see "Merge notes".
- **Git.** `git status` before every commit; stage only the files the task lists; never push, merge, deploy or use bare `git stash`. Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Inside the task worktree, follow the Cockpit rules in `C:\Users\thach\.claude\CLAUDE.md` (`get_task`, `submit_progress`, `set_task_status`).
- **Throwaway scripts** go in `artifacts/` (gitignored) and are never committed.

## File map

**Create**
| Path | Purpose | Task |
|---|---|---|
| `tests/fixtures/content-v1.json` | Frozen values of every pre-CMS export (+ SITE identity, routes) | 1 |
| `tests/fixtures/content-v1.d.ts` | Frozen pre-CMS types, emitted by tsc | 1 |
| `scripts/html-snapshot.mjs` | Save/compare normalized `dist/**/*.html` | 1 |
| `src/lib/content-schema.ts` | Tiny schema layer (text, number, list, object, …) with `meta` | 2 |
| `tests/content-schema.test.mjs` | Schema unit tests | 2 |
| `src/lib/content-model.ts` | Content types, file schemas, `buildContent()` | 3 |
| `content/**/*.json` (35 files incl. 2 `.gitkeep`) | The content, generated once from the fixture | 3 |
| `scripts/build-content-index.mjs` | Writes/checks the entry index | 3 |
| `src/lib/content-index.generated.ts` | Static imports of every folder-collection entry (generated, committed) | 3 |
| `tests/helpers/content.mjs` | Reads `content/` into `buildContent()` input | 3 |
| `tests/content-loader.test.mjs`, `tests/content-index.test.mjs` | Loader and index tests | 3 |
| `src/lib/content-contract.ts` | Compile-time proof that every export kept its type | 4 |
| `tests/content-roundtrip.test.mjs` | Every export equals the fixture | 4 |
| `content/legal/privacy.md`, `content/legal/terms.md` | Legal page text | 5 |
| `src/lib/legal-markdown.ts`, `src/lib/legal.ts`, `src/components/legal-sections.ts` | Parse, read and render the legal Markdown | 5 |
| `tests/legal.test.mjs` | Parser tests | 5 |
| `scripts/lib/honesty.mjs` | Shared forbidden-claim patterns and content-tree scan | 6 |
| `scripts/build-upload-variants.mjs` | sharp: `.w640`/`.w1280` WebP variants of each upload, in `.cache/upload-variants/` with a hash manifest | 7 |
| `scripts/lib/content-assets.mjs` | Referenced images that are missing (exact case), and references to refuse | 7 |
| `scripts/lib/uploads.mjs` | Upload folder rules: allowed types and names, links, variant names and cache, shipping (added in execution) | 7 |
| `scripts/lib/exact-paths.mjs` | Exact-case lookups and wrong-case references (added in execution) | 7 |
| `src/lib/content-images.ts` | `contentImage()` srcset helper | 7 |
| `tests/uploads.test.mjs` | Variant script and helper tests | 7 |
| `.gitattributes` | Keep vendored bytes exact | 9 |
| `scripts/vendor-sveltia.mjs`, `scripts/sveltia-cms.lock.json` | Pinned, verified vendoring | 9 |
| `public/admin/sveltia/**` (3 files) | Vendored Sveltia CMS 0.230.1 | 9 |
| `public/admin/index.html`, `public/admin/config.yml` | Admin page and CMS configuration | 9 |
| `tests/admin.test.mjs`, `tests/cms-config.test.mjs` | Vendoring, page, headers and config-mirror tests | 9–10 |

**Modify**
| Path | Change | Task |
|---|---|---|
| `src/lib/content.ts` | Rewritten as the loader (same exports) | 4 |
| `src/lib/site.ts` | `name`, `description`, `socialProfiles` from `content/site.json` | 4 |
| `package.json` | Scripts `content:index`, `uploads:variants`, `cms:vendor`; `build` chain; devDependency `js-yaml` | 3, 4, 7, 9 |
| `package-lock.json` | Root devDependency `js-yaml` | 9 |
| `scripts/build-production.mjs` | CMS block: index + variants before check-content | 4, 7 |
| `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` | Sections from Markdown | 5 |
| `tests/content.test.mjs` | Shared patterns, content-tree scan, planted-price tests | 6 |
| `scripts/check-content.mjs` | Index freshness, validation, scans, images | 6, 7 |
| `.gitignore` | The variant cache (`/.cache/`), Sveltia temp files | 7 |
| `scripts/package-site.mjs`, `scripts/check-export.mjs` | CMS blocks: uploads (T7), admin (T10) | 7, 10 |
| 10 image render sites (listed in Task 8) | `src={x}` becomes `{...contentImage(x)}` | 8 |
| `public/_headers` | `/admin/*` rule | 10 |
| `scripts/check-seo.mjs`, `scripts/browser-check.mjs` | CMS blocks | 10 |
| `README.md`, `docs/operations/cloudflare-release.md` | Editing content, GitHub setup later | 11 |

## Where each export lives after the migration

| Export (unchanged name and type) | File | Notes |
|---|---|---|
| `SITE.name`, `.description`, `.socialProfiles` (in `site.ts`) | `content/site.json` | The rest of `SITE` stays environment-driven |
| `HOME` | `content/home.json` | |
| `SECTIONS` | `content/sections.json` | |
| `MEASURE` | `content/measure.json` | `illustrative` is fixed `true` (hidden in the CMS) |
| `FOOTER` | `content/footer.json` | |
| `WORK` | `content/work.json` | Tiles and featured tile store `slug`; `img`/`href` derived from the service |
| `CORE_PANEL`, `PILLARS` | `content/services-panel.json` (`panel`, `pillars`) | Pillar `img`/`desc` derived from the service |
| `PROCESS_STEPS`, `PROCESS_CTA` | `content/process.json` (`steps`, `cta`) | |
| `APPROACH_STEPS` | `content/approach.json` (`steps`) | |
| `ENGAGEMENTS_FOOTER` | `content/engagements-panel.json` (`footer`) | |
| `FAQ_CARD` | `content/faq-card.json` | |
| `TEAM`, `FOUNDER` | `content/team.json` (`label`, `cta`, `founder`) | `founder: null` until the owner adds a real person |
| `SERVICES` | `content/services/<slug>.json` | File name must equal the slug; no create/delete in the CMS |
| `ENGAGEMENTS` | `content/engagements/{assess,build,improve}.json` | No create/delete in the CMS |
| `FAQS` | `content/faqs/*.json` (8 files) | |
| `TEAM_ROLES` | `content/team-roles/*.json` (5 files) | `links` always empty |
| `TESTIMONIALS` | `content/testimonials/` (empty) | Only entries with `permissionConfirmed: true` render |
| `ARTICLES` | `content/articles/` (empty) | |
| privacy and terms sections | `content/legal/{privacy,terms}.md` | Preview notice and contact section stay in the pages (environment-driven) |
| `INSIGHTS`, `CASE_STUDIES` | stay in `content.ts` as empty arrays | Publication scaffolding, not in the spec's content model |
| `serviceBySlug` | `content.ts` | Same behaviour and error message |

---

### Task 1: Freeze the pre-CMS content and the rendered HTML

**Files:**
- Create: `tests/fixtures/content-v1.json`, `tests/fixtures/content-v1.d.ts` (both generated)
- Create: `scripts/html-snapshot.mjs`
- Throwaway: `artifacts/snapshot-content.mjs`

- [ ] **Step 1: Check the worktree.**
  ```bash
  cd "$CMS" && git branch --show-current && git status --short && ls node_modules/next/package.json
  ```
  Expected: `feat/showcase-cms`, no changes listed, `node_modules/next/package.json`.

- [ ] **Step 2: Snapshot every export of the current module.** Write `artifacts/snapshot-content.mjs`:
  ```js
  // Throwaway: freezes the pre-CMS exports. Run once, before any change to src/lib/content.ts.
  import fs from "node:fs";
  const content = await import("../src/lib/content.ts");
  const site = await import("../src/lib/site.ts");
  const values = Object.fromEntries(
    Object.entries(content)
      .filter(([, value]) => typeof value !== "function")
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  const fixture = {
    exports: Object.keys(content).sort(),
    values,
    site: { name: site.SITE.name, description: site.SITE.description, socialProfiles: site.SITE.socialProfiles, routes: site.getPublishedRoutes() },
  };
  fs.mkdirSync("tests/fixtures", { recursive: true });
  fs.writeFileSync("tests/fixtures/content-v1.json", `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`${fixture.exports.length} exports written to tests/fixtures/content-v1.json`);
  ```
  Run: `cd "$CMS" && node --import tsx artifacts/snapshot-content.mjs`
  Expected: `23 exports written to tests/fixtures/content-v1.json`.

- [ ] **Step 3: Freeze the types.**
  ```bash
  cd "$CMS" && node node_modules/typescript/bin/tsc src/lib/content.ts --declaration --emitDeclarationOnly --outDir artifacts/content-v1-types --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --strict \
    && { echo "// Emitted by tsc from the pre-CMS src/lib/content.ts. Reference types for src/lib/content-contract.ts; never regenerate."; cat artifacts/content-v1-types/content.d.ts; } > tests/fixtures/content-v1.d.ts \
    && grep -c "^export declare const" tests/fixtures/content-v1.d.ts && grep -c "^export type" tests/fixtures/content-v1.d.ts
  ```
  Expected: `22` and `11`.

- [ ] **Step 4: Write `scripts/html-snapshot.mjs`.**
  ```js
  // Proves that a change did not alter what the exported pages render. `save` writes a normalized
  // copy of every dist/**/*.html; `compare` normalizes the current dist/ the same way and reports
  // any page that differs. Normalizing removes what changes between builds of the same source:
  // the build ID, hashed chunk and media names, module ids, the number of chunks a page loads and
  // where the inline RSC payload is split into script tags.
  //   node scripts/html-snapshot.mjs save artifacts/html-baseline
  //   node scripts/html-snapshot.mjs compare artifacts/html-baseline
  import fs from "node:fs";
  import path from "node:path";

  const [mode, dir] = process.argv.slice(2);
  if (!["save", "compare"].includes(mode) || !dir) {
    console.error("Usage: node scripts/html-snapshot.mjs save|compare <snapshot-dir>");
    process.exit(2);
  }
  const root = "dist";
  const buildId = fs.existsSync(".next/BUILD_ID") ? fs.readFileSync(".next/BUILD_ID", "utf8").trim() : "";

  function normalize(html) {
    let out = buildId ? html.replaceAll(buildId, "BUILD_ID") : html;
    out = out
      .replace(/"\]\)<\/script><script>self\.__next_f\.push\(\[1,"/g, "")
      .replace(/\/_next\/static\/(chunks|media)\/[\w.~-]+?(\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico))(?=[\\"'\s)?#,])/g, "/_next/static/$1/HASH$2")
      .replace(/\bI\[\d+,/g, "I[ID,")
      .replace(/(?:\\"\/_next\/static\/chunks\/HASH\.js\\",?)+/g, '\\"CHUNKS\\",')
      .replace(/(?:<script src="\/_next\/static\/chunks\/HASH\.js" async=""><\/script>)+/g, "<script CHUNKS></script>")
      .replace(/(?:<link rel="preload" as="script" fetchPriority="low" href="\/_next\/static\/chunks\/HASH\.js"\/>)+/g, "<link CHUNKS/>");
    return out;
  }

  function htmlFiles(base) {
    const walk = (current) => fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".html") ? [path.relative(base, full).replaceAll("\\", "/")] : [];
    });
    return fs.existsSync(base) ? walk(base).sort() : [];
  }

  const current = htmlFiles(root);
  if (!current.length) {
    console.error("dist/ has no HTML files; build first.");
    process.exit(1);
  }
  if (mode === "save") {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const file of current) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, normalize(fs.readFileSync(path.join(root, file), "utf8")));
    }
    console.log(`Saved ${current.length} normalized pages to ${dir}.`);
  } else {
    const saved = htmlFiles(dir);
    const problems = [];
    for (const file of saved) {
      if (!current.includes(file)) {
        problems.push(`missing page: ${file}`);
        continue;
      }
      const before = fs.readFileSync(path.join(dir, file), "utf8");
      const after = normalize(fs.readFileSync(path.join(root, file), "utf8"));
      if (before === after) continue;
      let at = 0;
      while (before[at] === after[at]) at++;
      const context = (text) => JSON.stringify(text.slice(Math.max(0, at - 80), at + 120));
      problems.push(`changed page: ${file} at character ${at}\n  before: ${context(before)}\n  after:  ${context(after)}`);
    }
    const added = current.filter((file) => !saved.includes(file));
    if (added.length) console.log(`New pages (not in the snapshot): ${added.join(", ")}`);
    if (problems.length) {
      console.error(problems.join("\n"));
      process.exitCode = 1;
    } else console.log(`Rendered HTML identical to ${dir}: ${saved.length} pages.`);
  }
  ```

- [ ] **Step 5: Build the baseline and save it.**
  ```bash
  bash "$WT" "$CMS" 8788 rebuild
  ```
  Expected (tail): `Export valid: 12 core pages, …` then `preview up on :8788 (…spacegear-cms)`.
  ```bash
  cd "$CMS" && node scripts/html-snapshot.mjs save artifacts/html-baseline && node scripts/html-snapshot.mjs compare artifacts/html-baseline
  ```
  Expected: `Saved 15 normalized pages to artifacts/html-baseline.` and `Rendered HTML identical to artifacts/html-baseline: 15 pages.` Keep `artifacts/html-baseline/` for the whole plan (it is gitignored).

- [ ] **Step 6: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass (the existing suite; the fixture is data only).

- [ ] **Step 7: Commit.**
  ```bash
  cd "$CMS" && git add tests/fixtures/content-v1.json tests/fixtures/content-v1.d.ts scripts/html-snapshot.mjs && git commit -m "test(cms): freeze the pre-CMS content exports and add an HTML snapshot check" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 2: A tiny schema layer for content files

**Files:**
- Create: `src/lib/content-schema.ts`
- Test: `tests/content-schema.test.mjs`

> **Superseded during execution (Task 2 review).** The committed `src/lib/content-schema.ts` and `tests/content-schema.test.mjs` supersede the code blocks below, which show the first version (9 tests; the committed file has 14). Only the `HREF` and `IMAGE` lines in Step 3 are kept current, because Task 9's `config.yml` mirrors them. The changes are listed under "Amendments made during execution".

- [ ] **Step 1: Write the failing test** `tests/content-schema.test.mjs`:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";

  const s = await import("../src/lib/content-schema.ts");

  const run = (schema, value) => {
    const issues = [];
    const result = schema(value, "", issues);
    return { result, issues };
  };

  test("text enforces required, max length, surrounding spaces and patterns", () => {
    const field = s.text({ max: 5 });
    assert.deepEqual(run(field, "hello"), { result: "hello", issues: [] });
    assert.match(run(field, "").issues[0], /required/);
    assert.match(run(field, "toolong").issues[0], /7 characters, the limit is 5/);
    assert.match(run(field, " hi").issues[0], /spaces/);
    assert.match(run(field, 42).issues[0], /expected text/);
    assert.deepEqual(run(s.text({ min: 0, max: 5 }), "").issues, [], "optional text may be empty");
    assert.match(run(s.slug(), "Not A Slug").issues[0], /lowercase/);
  });

  test("links accept site paths and https addresses only", () => {
    for (const ok of ["/", "/contact/", "/#faq", "/services/applied-ai/", "https://example.org/a?b=c"]) assert.deepEqual(run(s.href(), ok).issues, [], ok);
    for (const bad of ["contact", "http://example.org", "javascript:alert(1)", "/a b"]) assert.equal(run(s.href(), bad).issues.length, 1, bad);
  });

  test("images must live under /images/ or /uploads/ and cannot be a generated variant", () => {
    for (const ok of ["/images/suite/neural-net.webp", "/uploads/team-photo.webp", "/uploads/logo.svg"]) assert.deepEqual(run(s.image(), ok).issues, [], ok);
    for (const bad of ["/uploads/team-photo-640.webp", "/uploads/team-photo-1280.webp", "https://cdn.example.com/a.jpg", "/models/earth.glb"]) assert.equal(run(s.image(), bad).issues.length, 1, bad);
  });

  test("numbers, booleans, fixed flags and options", () => {
    assert.match(run(s.number({ min: 0, max: 100 }), 101).issues[0], /outside 0 to 100/);
    assert.match(run(s.number({ min: 1, max: 9, integer: true }), 1.5).issues[0], /whole number/);
    assert.match(run(s.number({ min: 0, max: 1 }), "1").issues[0], /expected a number/);
    assert.match(run(s.boolean(), "true").issues[0], /true or false/);
    assert.match(run(s.literal(true), false).issues[0], /must be true/);
    assert.match(run(s.oneOf(["a", "b"]), "c").issues[0], /choose one of a, b/);
  });

  test("lists check their size and every item, with the item's position in the message", () => {
    const field = s.list(s.text({ max: 3 }), { min: 1, max: 2 });
    assert.match(run(field, []).issues[0], /at least 1 item/);
    assert.match(run(field, ["a", "b", "c"]).issues[0], /3 items, the limit is 2/);
    assert.match(run(field, ["a", "toolong"]).issues[0], /^\[1\]: /);
  });

  test("objects return keys in schema order, refuse unknown keys and report missing ones", () => {
    const field = s.object({ first: s.text({ max: 9 }), second: s.number({ min: 0, max: 9 }) });
    const { result, issues } = run(field, { second: 2, first: "one" });
    assert.deepEqual(issues, []);
    assert.deepEqual(Object.keys(result), ["first", "second"], "key order follows the schema, not the file");
    assert.match(run(field, { first: "one", second: 2, extra: true }).issues[0], /^extra: unknown field/);
    assert.match(run(field, { first: "one" }).issues[0], /^second: missing/);
  });

  test("an optional group is null when absent, null or left empty", () => {
    const field = s.object({ founder: s.nullable(s.object({ name: s.text({ max: 9 }), links: s.list(s.text({ max: 9 }), { max: 2 }) })) });
    for (const value of [{}, { founder: null }, { founder: { name: "", links: [] } }]) assert.deepEqual(run(field, value), { result: { founder: null }, issues: [] }, JSON.stringify(value));
    assert.deepEqual(run(field, { founder: { name: "Ada", links: [] } }).result, { founder: { name: "Ada", links: [] } });
  });

  test("parseContent names the file and lists every problem at once", () => {
    const field = s.object({ a: s.text({ max: 1 }), b: s.text({ max: 1 }) });
    assert.throws(() => s.parseContent(field, { a: "", b: "xx" }, "content/x.json"), (error) => {
      assert.ok(error instanceof s.ContentError);
      assert.deepEqual(error.issues, ["content/x.json: a: required", "content/x.json: b: 2 characters, the limit is 1"]);
      return true;
    });
  });

  test("every schema exposes its rules as meta for the CMS mirror test", () => {
    assert.deepEqual(s.text({ min: 0, max: 4 }).meta, { kind: "text", format: "plain", min: 0, max: 4, pattern: undefined });
    assert.equal(s.list(s.boolean(), { max: 3 }).meta.item.meta.kind, "boolean");
    assert.deepEqual(Object.keys(s.object({ x: s.boolean() }).meta.shape), ["x"]);
  });
  ```

- [ ] **Step 2: Run it and see it fail.** `cd "$CMS" && node --import tsx --test tests/content-schema.test.mjs` → fails with `ERR_MODULE_NOT_FOUND … src/lib/content-schema.ts`.

- [ ] **Step 3: Implement `src/lib/content-schema.ts`.**
  ```ts
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
  export const HREF = /^(?:\/(?!\/)[\w.~/#?=&%-]*|https:\/\/[^\s"<>]+)$/;
  export const IMAGE = /^(?!\/uploads\/.*\.svg$)(?!\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*(?:con|prn|aux|nul|com\d|lpt\d)[./])\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)$/;
  export const COLOR = /^#[0-9a-fA-F]{6}$/;

  export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const at = (path: string, key: string | number) => (typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key);
  const where = (path: string) => path || "(file)";

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
      if (value.length < min) issues.push(`${where(path)}: ${min === 1 ? "required" : `needs at least ${min} characters`}`);
      if (value.length > max) issues.push(`${where(path)}: ${value.length} characters, the limit is ${max}`);
      if (value !== value.trim()) issues.push(`${where(path)}: remove the spaces at the start or the end`);
      if (pattern && value !== "" && !pattern.test(value)) issues.push(`${where(path)}: ${message ?? `must match ${pattern}`}`);
      return value;
    });
  }

  export const text = (options: TextOptions) => textOf("plain", options);
  export const slug = (max = 60) => textOf("slug", { max, pattern: SLUG, message: "use lowercase letters, digits and single hyphens" });
  export const href = () => textOf("href", { max: 200, pattern: HREF, message: "use a site path such as /contact/ or a full https:// address" });
  export const image = () => textOf("image", { max: 200, pattern: IMAGE, message: "use an image under /images/ or /uploads/ (not a generated -640 or -1280 variant)" });
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
        issues.push(`${where(path)}: choose one of ${values.join(", ")}`);
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
      if (value.length < min) issues.push(`${where(path)}: needs at least ${min} item${min === 1 ? "" : "s"}`);
      if (value.length > max) issues.push(`${where(path)}: ${value.length} items, the limit is ${max}`);
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

  const isEmpty = (value: unknown): boolean =>
    value === null || value === undefined || value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (isRecord(value) && Object.values(value).every(isEmpty));

  /** An optional group: null, a missing key or an all-empty group (a CMS "not added" value) all mean null. */
  export function nullable<T>(inner: Schema<T>): Schema<T | null> {
    return schema({ kind: "nullable", inner }, (value, path, issues) => (isEmpty(value) ? null : inner(value, path, issues)));
  }

  /** Validates one file's data and records its problems, prefixed with the file name. */
  export function check<T>(target: Schema<T>, value: unknown, file: string, issues: string[]): T {
    const local: string[] = [];
    const result = target(value, "", local);
    for (const issue of local) issues.push(`${file}: ${issue}`);
    return result;
  }

  /** Validates one file and throws a ContentError that lists every problem. */
  export function parseContent<T>(target: Schema<T>, value: unknown, file: string): T {
    const issues: string[] = [];
    const result = check(target, value, file, issues);
    if (issues.length) throw new ContentError(issues);
    return result;
  }
  ```

- [ ] **Step 4: Run it and see it pass.** `cd "$CMS" && node --import tsx --test tests/content-schema.test.mjs` → `# pass 9`, `# fail 0`.

- [ ] **Step 5: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass.

- [ ] **Step 6: Commit.**
  ```bash
  cd "$CMS" && git add src/lib/content-schema.ts tests/content-schema.test.mjs && git commit -m "feat(cms): add a small schema layer for content files" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 3: Content model, content files and the entry index

Nothing renders differently yet: `src/lib/content.ts` is untouched in this task.

> **Superseded in part.** The committed Task 3 files replace the code blocks below on the points listed under "Amendments made during execution" (Task 3 review follow-up): order checks, malformed service slugs, uniqueness, exactly one featured engagement, the index command and `readJson`.

**Files:**
- Create: `src/lib/content-model.ts`, `scripts/build-content-index.mjs`, `src/lib/content-index.generated.ts` (generated)
- Create: `content/**` (35 files, generated once from the fixture)
- Create: `tests/helpers/content.mjs`, `tests/content-loader.test.mjs`, `tests/content-index.test.mjs`
- Modify: `package.json` (script `content:index`)
- Throwaway: `artifacts/split-content.mjs`

- [ ] **Step 1: Write the test helper** `tests/helpers/content.mjs`:
  ```js
  // Reads content/ from disk into the shape buildContent() takes, so tests can validate a
  // modified copy of the content without touching the real tree.
  import fs from "node:fs";
  import path from "node:path";
  import { COLLECTIONS, listEntries } from "../../scripts/build-content-index.mjs";

  const { SINGLETON_FILES } = await import("../../src/lib/content-model.ts");

  export const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

  export function readContentInput(root = ".") {
    const input = Object.fromEntries(Object.entries(SINGLETON_FILES).map(([name, file]) => [name, readJson(path.join(root, file))]));
    input.collections = Object.fromEntries(COLLECTIONS.map((collection) => [
      collection,
      listEntries(root, collection).map((file) => ({ file, data: readJson(path.join(root, "content", collection, file)) })),
    ]));
    return input;
  }

  /** The exported values (not functions) of a content module or a buildContent() result, as one string. */
  export const publicText = (content) => JSON.stringify(Object.entries(content).filter(([, value]) => typeof value !== "function").map(([, value]) => value));
  ```

- [ ] **Step 2: Write the failing tests.** `tests/content-loader.test.mjs`:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { readContentInput, readJson } from "./helpers/content.mjs";

  const { buildContent } = await import("../src/lib/content-model.ts");
  const { ContentError } = await import("../src/lib/content-schema.ts");

  const fresh = () => readContentInput(".");
  const issuesOf = (input) => {
    try {
      buildContent(input);
    } catch (error) {
      if (error instanceof ContentError) return error.issues;
      throw error;
    }
    return [];
  };
  const entry = (input, collection, file) => input.collections[collection].find((item) => item.file === file).data;

  test("the committed content passes validation", () => {
    assert.deepEqual(issuesOf(fresh()), []);
  });

  test("buildContent reproduces every pre-CMS export from the files in content/", () => {
    const { values } = readJson("tests/fixtures/content-v1.json");
    const built = buildContent(fresh());
    assert.equal(Object.keys(built).length, 20);
    for (const [name, value] of Object.entries(built)) assert.equal(JSON.stringify(value), JSON.stringify(values[name]), name);
  });

  test("collection entries are ordered by their order field, not by file name", () => {
    const input = fresh();
    entry(input, "faqs", "what-we-do.json").order = 99;
    const { FAQS } = buildContent(input);
    assert.equal(FAQS.at(-1).question, "What does spacegear.tech do?");
    assert.ok(!("order" in FAQS[0]), "the CMS-only order field is not exported");
  });

  test("two entries cannot share an order number", () => {
    const input = fresh();
    entry(input, "faqs", "where-to-start.json").order = entry(input, "faqs", "what-we-do.json").order;
    assert.ok(issuesOf(input).some((issue) => /^content\/faqs\/.+: order \d+ is already used by/.test(issue)));
  });

  test("a service file must be named after its slug", () => {
    const input = fresh();
    input.collections.services[0] = { ...input.collections.services[0], file: "renamed.json" };
    assert.ok(issuesOf(input).some((issue) => issue.startsWith("content/services/renamed.json: rename the file to")));
  });

  test("tiles and pillars can only point at existing services", () => {
    const input = fresh();
    input.work.tiles[0].slug = "no-such-service";
    input.servicesPanel.pillars[0].slug = "no-such-service";
    const issues = issuesOf(input);
    assert.ok(issues.some((issue) => issue.startsWith('content/work.json: tiles[0].slug: "no-such-service" is not one of: ')));
    assert.ok(issues.some((issue) => issue.startsWith('content/services-panel.json: pillars[0].slug: "no-such-service" is not one of: ')));
  });

  test("service art and pillar summaries are derived from the service entry", () => {
    const input = fresh();
    const applied = entry(input, "services", "applied-ai.json");
    applied.image = "/images/suite/scale-matrix.webp";
    applied.summary = "A changed summary.";
    const { WORK, PILLARS } = buildContent(input);
    assert.equal(WORK.featured.img, "/images/suite/scale-matrix.webp");
    assert.equal(PILLARS.find((pillar) => pillar.slug === "applied-ai").desc, "A changed summary.");
  });

  test("unknown fields, empty required fields and over-long text are reported with their file", () => {
    const input = fresh();
    input.home.extra = "x";
    input.home.cta.label = "";
    input.sections.work.heading = "x".repeat(141);
    assert.deepEqual(issuesOf(input).sort(), [
      "content/home.json: cta.label: required",
      "content/home.json: extra: unknown field (remove it, or add it to src/lib/content-model.ts and public/admin/config.yml)",
      "content/sections.json: work.heading: 141 characters, the limit is 140",
    ]);
  });

  test("testimonials render only with permission confirmed", () => {
    const input = fresh();
    const quote = { img: "/uploads/client.webp", name: "Ada Client", role: "COO", company: "Example Ltd", quote: "They helped.", order: 1 };
    input.collections.testimonials = [
      { file: "a.json", data: { ...quote, permissionConfirmed: false } },
      { file: "b.json", data: { ...quote, name: "Bo Client", permissionConfirmed: true, order: 2 } },
    ];
    const { TESTIMONIALS } = buildContent(input);
    assert.deepEqual(TESTIMONIALS.map((item) => [item.name, item.permissionConfirmed]), [["Bo Client", true]]);
  });

  test("the founder card stays empty until it has real details", () => {
    const input = fresh();
    assert.equal(buildContent(input).FOUNDER, null);
    input.team.founder = { name: "", role: "", img: "", imgAlt: "", links: [], bio: "" };
    assert.equal(buildContent(input).FOUNDER, null, "an untouched CMS group counts as empty");
    input.team.founder = { name: "Real Name", role: "Founder", img: "/uploads/founder.webp", imgAlt: "Portrait", links: [], bio: "Bio." };
    assert.equal(buildContent(input).FOUNDER.name, "Real Name");
  });

  test("role cards cannot link to profiles", () => {
    const input = fresh();
    entry(input, "team-roles", "product-and-delivery.json").links = [{ label: "LinkedIn", href: "https://linkedin.com/in/x" }];
    assert.ok(issuesOf(input).some((issue) => issue.startsWith("content/team-roles/product-and-delivery.json: links: 1 item, the limit is 0")));
  });
  ```
  `tests/content-index.test.mjs`:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import fs from "node:fs";
  import os from "node:os";
  import path from "node:path";
  import { COLLECTIONS, INDEX_FILE, readIndex, renderIndex } from "../scripts/build-content-index.mjs";

  const { COLLECTION_NAMES } = await import("../src/lib/content-model.ts");

  test("the committed content index lists every entry file (run npm run content:index if not)", () => {
    assert.equal(readIndex("."), renderIndex("."), `${INDEX_FILE} is stale`);
  });

  test("the index covers exactly the model's folder collections", () => {
    assert.deepEqual(COLLECTIONS, [...COLLECTION_NAMES]);
  });

  test("the index skips dotfiles and non-JSON files, sorts by name and refuses unsafe names", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-index-"));
    try {
      const faqs = path.join(root, "content", "faqs");
      fs.mkdirSync(faqs, { recursive: true });
      for (const name of ["b.json", "a.json", ".gitkeep", "notes.txt"]) fs.writeFileSync(path.join(faqs, name), "{}");
      const index = renderIndex(root);
      assert.match(index, /import faqs_0 from "\.\.\/\.\.\/content\/faqs\/a\.json" with \{ type: "json" \};\nimport faqs_1 from "\.\.\/\.\.\/content\/faqs\/b\.json"/);
      assert.doesNotMatch(index, /gitkeep|notes/);
      assert.match(index, /"services": \[\],/, "a missing collection folder is an empty list");
      fs.writeFileSync(path.join(faqs, "Bad Name.json"), "{}");
      assert.throws(() => renderIndex(root), /Rename content\/faqs\/Bad Name\.json/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  ```

- [ ] **Step 3: Run them and see them fail.** `cd "$CMS" && node --import tsx --test tests/content-loader.test.mjs tests/content-index.test.mjs` → both fail with `ERR_MODULE_NOT_FOUND` (`build-content-index.mjs`, `content-model.ts`).

- [ ] **Step 4: Implement `src/lib/content-model.ts`.**
  ```ts
  // The content model behind the CMS: the public content types, one schema per file in
  // content/, and buildContent(), which validates those files and derives the values that
  // src/lib/content.ts exports. Service art and pillar summaries come from the service entries,
  // so every place a service appears shows the same image and text.
  // public/admin/config.yml mirrors these schemas field by field (tests/cms-config.test.mjs).
  // Erasable TypeScript only: scripts/check-content.mjs loads this under --experimental-strip-types.
  import { ContentError, boolean, check, color, href, image, list, literal, nullable, number, object, oneOf, slug, text } from "./content-schema.ts";
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
  // Render only real, permission-confirmed quotes and published articles.
  export type Testimonial = { img: string; name: string; role: string; company: string; quote: string; permissionConfirmed: true };
  export type Article = { slug: string; author: string; title: string; sub: string; img: string; href: string };
  export type FooterLink = { label: string; href: string };

  export const COLLECTION_NAMES = ["services", "engagements", "faqs", "team-roles", "testimonials", "articles"] as const;
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

  /** content/site.json (read by src/lib/site.ts; the rest of SITE comes from environment variables). */
  export const siteSchema = object({
    name: text({ max: 40 }),
    description: text({ max: 200 }),
    socialProfiles: list(text({ max: 200, pattern: /^https:\/\/\S+$/, message: "use a full https:// profile address" }), { max: 8 }),
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
          headline: object({ lead: text({ max: 30 }), verbs: list(text({ max: 6 }), { min: 3, max: 3 }), tail: text({ max: 24 }) }),
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
        articles: object({
          slug: slug(60), author: text({ max: 60 }), title: text({ max: 120 }), sub: text({ max: 200 }),
          img: image(), href: href(), order: order(),
        }),
      },
    };
  }

  type Loaded<T> = { file: string; entry: T };

  /** Validates every entry of a folder collection and sorts them by `order` (unique per collection). */
  function loadCollection<T extends { order: number }>(files: readonly CollectionFile[], name: CollectionName, entrySchema: Schema<T>, issues: string[]): Loaded<T>[] {
    const loaded = files.map(({ file, data }) => ({ file, entry: check(entrySchema, data, `content/${name}/${file}`, issues) }));
    const taken = new Map<number, string>();
    for (const { file, entry } of loaded) {
      if (entry.order < 1) continue;
      const other = taken.get(entry.order);
      if (other !== undefined) issues.push(`content/${name}/${file}: order ${entry.order} is already used by ${other}; give every entry its own number`);
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

  /** Validates all content and derives the exported values. Throws one ContentError listing every problem. */
  export function buildContent(input: ContentInput) {
    const issues: string[] = [];
    const services = loadCollection(input.collections.services, "services", contentSchemas([]).collections.services, issues);
    for (const { file, entry } of services) {
      if (entry.slug && file !== `${entry.slug}.json`) issues.push(`content/services/${file}: rename the file to ${entry.slug}.json (it must match the slug)`);
    }
    const schemas = contentSchemas(services.map(({ entry }) => entry.slug));
    const one = schemas.singletons;
    const home = check(one.home, input.home, SINGLETON_FILES.home, issues);
    const sections = check(one.sections, input.sections, SINGLETON_FILES.sections, issues);
    const work = check(one.work, input.work, SINGLETON_FILES.work, issues);
    const servicesPanel = check(one.servicesPanel, input.servicesPanel, SINGLETON_FILES.servicesPanel, issues);
    const processBlock = check(one.process, input.process, SINGLETON_FILES.process, issues);
    const approach = check(one.approach, input.approach, SINGLETON_FILES.approach, issues);
    const measure = check(one.measure, input.measure, SINGLETON_FILES.measure, issues);
    const engagementsPanel = check(one.engagementsPanel, input.engagementsPanel, SINGLETON_FILES.engagementsPanel, issues);
    const faqCard = check(one.faqCard, input.faqCard, SINGLETON_FILES.faqCard, issues);
    const team = check(one.team, input.team, SINGLETON_FILES.team, issues);
    const footer = check(one.footer, input.footer, SINGLETON_FILES.footer, issues);
    const many = schemas.collections;
    const engagements = loadCollection(input.collections.engagements, "engagements", many.engagements, issues);
    const faqs = loadCollection(input.collections.faqs, "faqs", many.faqs, issues);
    const roles = loadCollection(input.collections["team-roles"], "team-roles", many["team-roles"], issues);
    const testimonials = loadCollection(input.collections.testimonials, "testimonials", many.testimonials, issues);
    const articles = loadCollection(input.collections.articles, "articles", many.articles, issues);
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
    const ARTICLES: Article[] = articles.map(({ entry }) => withoutOrder(entry));
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
      ARTICLES,
      FOOTER: footer,
    };
  }
  ```

- [ ] **Step 5: Implement `scripts/build-content-index.mjs`.**
  ```js
  // Writes src/lib/content-index.generated.ts: one static JSON import per entry file of the
  // content/ folder collections. The typed loader (src/lib/content.ts) also runs in the browser
  // bundle and in the Worker, so it cannot list a folder at run time; this index lets it import
  // every entry at build time. Entries are listed in file-name order; the loader sorts them by
  // their `order` field. The build regenerates the index; `npm test` fails when it is stale.
  //   node scripts/build-content-index.mjs           write the index
  //   node scripts/build-content-index.mjs --check   exit 1 if the index is out of date
  import fs from "node:fs";
  import path from "node:path";
  import { pathToFileURL } from "node:url";

  export const COLLECTIONS = ["services", "engagements", "faqs", "team-roles", "testimonials", "articles"];
  export const INDEX_FILE = "src/lib/content-index.generated.ts";
  const ENTRY_NAME = /^[a-z0-9][a-z0-9_-]*\.json$/;

  /** Entry files of one folder collection, sorted by name. Dotfiles (.gitkeep) are skipped. */
  export function listEntries(root, collection) {
    const dir = path.join(root, "content", collection);
    if (!fs.existsSync(dir)) return [];
    const names = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && entry.name.endsWith(".json"))
      .map((entry) => entry.name);
    const bad = names.filter((name) => !ENTRY_NAME.test(name));
    if (bad.length) throw new Error(`Rename ${bad.map((name) => `content/${collection}/${name}`).join(", ")}: entry file names use lowercase letters, digits, - and _ only.`);
    return names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  export function renderIndex(root = ".") {
    const imports = [];
    const groups = [];
    for (const collection of COLLECTIONS) {
      const id = collection.replaceAll("-", "_");
      const rows = listEntries(root, collection).map((file, index) => {
        imports.push(`import ${id}_${index} from "../../content/${collection}/${file}" with { type: "json" };`);
        return `    { file: ${JSON.stringify(file)}, data: ${id}_${index} },`;
      });
      groups.push(rows.length ? `  ${JSON.stringify(collection)}: [\n${rows.join("\n")}\n  ],` : `  ${JSON.stringify(collection)}: [],`);
    }
    return [
      "// Generated by scripts/build-content-index.mjs. Do not edit by hand.",
      "// Lists every entry of the content/ folder collections so that src/lib/content.ts can import",
      "// them statically. Run `npm run content:index` after adding, renaming or removing an entry.",
      'import type { CollectionFile, CollectionName } from "./content-model.ts";',
      ...imports,
      "",
      "export const COLLECTION_FILES: Record<CollectionName, CollectionFile[]> = {",
      ...groups,
      "};",
      "",
    ].join("\n");
  }

  export function readIndex(root = ".") {
    const file = path.join(root, INDEX_FILE);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
  }

  if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const next = renderIndex(".");
    const fresh = readIndex(".") === next;
    if (process.argv.includes("--check")) {
      if (!fresh) { console.error(`${INDEX_FILE} is out of date. Run: npm run content:index`); process.exitCode = 1; }
      else console.log("Content index is up to date.");
    } else if (!fresh) {
      fs.writeFileSync(INDEX_FILE, next);
      console.log(`Wrote ${INDEX_FILE}.`);
    } else console.log("Content index is up to date.");
  }
  ```

- [ ] **Step 6: Generate `content/` from the frozen snapshot.** Write `artifacts/split-content.mjs`:
  ```js
  // Throwaway: writes content/ from the frozen snapshot of the pre-CMS module, so every value
  // (and its key order) is copied, never retyped.
  import fs from "node:fs";
  import path from "node:path";
  const { values: v, site } = JSON.parse(fs.readFileSync("tests/fixtures/content-v1.json", "utf8"));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  };
  const slugOf = (href) => href.split("/")[2];
  write("content/site.json", { name: site.name, description: site.description, socialProfiles: site.socialProfiles });
  write("content/home.json", v.HOME);
  write("content/sections.json", v.SECTIONS);
  write("content/work.json", {
    featured: { label: v.WORK.featured.label, name: v.WORK.featured.name, slug: slugOf(v.WORK.featured.href) },
    lineup: v.WORK.lineup,
    tiles: v.WORK.tiles.map(({ slug, name, desc }) => ({ slug, name, desc })),
    assessment: v.WORK.assessment,
  });
  write("content/services-panel.json", {
    panel: v.CORE_PANEL,
    pillars: v.PILLARS.map(({ no, slug, name, tag, glyph }) => ({ no, slug, name, tag, glyph })),
  });
  write("content/process.json", { steps: v.PROCESS_STEPS, cta: v.PROCESS_CTA });
  write("content/approach.json", { steps: v.APPROACH_STEPS });
  write("content/measure.json", v.MEASURE);
  write("content/engagements-panel.json", { footer: v.ENGAGEMENTS_FOOTER });
  write("content/faq-card.json", v.FAQ_CARD);
  write("content/team.json", { label: v.TEAM.label, cta: v.TEAM.cta, founder: v.FOUNDER });
  write("content/footer.json", v.FOOTER);
  const entries = (folder, items, names) => items.forEach((item, i) => write(`content/${folder}/${names[i]}.json`, { ...item, order: i + 1 }));
  entries("services", v.SERVICES, v.SERVICES.map((s) => s.slug));
  entries("engagements", v.ENGAGEMENTS, ["assess", "build", "improve"]);
  entries("faqs", v.FAQS, ["what-we-do", "where-to-start", "existing-systems", "data-readiness", "ai-evaluation", "scope-and-pricing", "after-release", "who-we-work-with"]);
  entries("team-roles", v.TEAM_ROLES, ["strategy-and-discovery", "ai-and-data-engineering", "product-and-delivery", "integration-and-automation", "adoption-and-support"]);
  for (const folder of ["testimonials", "articles"]) {
    fs.mkdirSync(`content/${folder}`, { recursive: true });
    fs.writeFileSync(`content/${folder}/.gitkeep`, "");
  }
  console.log("content/ written from tests/fixtures/content-v1.json");
  ```
  Run: `cd "$CMS" && node artifacts/split-content.mjs && find content -type f | wc -l`
  Expected: `content/ written from tests/fixtures/content-v1.json` and `35`. Spot check: `cat content/work.json` starts with `"featured": { "label": "Featured Service", "name": "Applied AI", "slug": "applied-ai" }` (pretty-printed) and `content/services/applied-ai.json` ends with `"relatedInsightSlugs": [],` then `"order": 3`.

- [ ] **Step 7: Add the script and generate the index.** In `package.json`, after the line `"check:fidelity": "node scripts/fidelity-compare.mjs"` add a comma and:
  ```json
      "content:index": "node scripts/build-content-index.mjs"
  ```
  Run: `cd "$CMS" && npm run content:index` → `Wrote src/lib/content-index.generated.ts.` Its first entries:
  ```ts
  import type { CollectionFile, CollectionName } from "./content-model.ts";
  import services_0 from "../../content/services/ai-strategy.json" with { type: "json" };
  ```
  and it ends with `  "testimonials": [],`, `  "articles": [],`, `};`.

- [ ] **Step 8: Run the tests and see them pass.** `cd "$CMS" && node --import tsx --test tests/content-loader.test.mjs tests/content-index.test.mjs` → `# pass 14`, `# fail 0`.

- [ ] **Step 9: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass (typecheck now covers the model and the generated index with its JSON imports).

- [ ] **Step 10: Commit.**
  ```bash
  cd "$CMS" && git add content src/lib/content-model.ts src/lib/content-index.generated.ts scripts/build-content-index.mjs tests/helpers/content.mjs tests/content-loader.test.mjs tests/content-index.test.mjs package.json && git status --short && git commit -m "feat(cms): move the copy into content/ with a validated content model" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```
  `git status --short` before the commit must list only those paths (`content/` shows 35 files including the two `.gitkeep`).

---

### Task 4: Switch `src/lib/content.ts` to the loader

**Files:**
- Modify: `src/lib/content.ts` (rewrite), `src/lib/site.ts`, `package.json` (`build`), `scripts/build-production.mjs`
- Create: `src/lib/content-contract.ts`, `tests/content-roundtrip.test.mjs`

- [ ] **Step 1: Write the safety net first.** `tests/content-roundtrip.test.mjs`:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import fs from "node:fs";

  // Frozen snapshot of src/lib/content.ts and src/lib/site.ts taken before the CMS migration.
  // Never regenerate it from the new loader; change it only together with a deliberate copy change.
  const fixture = JSON.parse(fs.readFileSync("tests/fixtures/content-v1.json", "utf8"));
  const content = await import("../src/lib/content.ts");
  const { SITE, getPublishedRoutes } = await import("../src/lib/site.ts");

  test("content.ts exports exactly the names it exported before the CMS", () => {
    assert.deepEqual(Object.keys(content).sort(), fixture.exports);
  });

  for (const name of Object.keys(fixture.values)) {
    test(`${name} is unchanged, key order included`, () => {
      assert.equal(JSON.stringify(content[name]), JSON.stringify(fixture.values[name]));
    });
  }

  test("serviceBySlug returns each service and rejects unknown slugs", () => {
    for (const service of fixture.values.SERVICES) assert.equal(JSON.stringify(content.serviceBySlug(service.slug)), JSON.stringify(service));
    assert.throws(() => content.serviceBySlug("no-such-service"), /Unknown service: no-such-service/);
  });

  test("the site identity and the published routes are unchanged", () => {
    assert.deepEqual({ name: SITE.name, description: SITE.description, socialProfiles: SITE.socialProfiles, routes: getPublishedRoutes() }, fixture.site);
  });
  ```
  `src/lib/content-contract.ts`:
  ```ts
  // Compile-time proof that the CMS loader kept the public content API: every export of
  // src/lib/content.ts still has the type it had before the migration. The reference types
  // (tests/fixtures/content-v1.d.ts) were emitted by tsc from the pre-CMS module. If a type
  // drifts, `npm run typecheck` fails on the matching line below.
  import type * as Before from "../../tests/fixtures/content-v1";
  import type * as After from "./content";

  type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
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
    Expect<Same<Before.Article, After.Article>>,
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
    Expect<Same<typeof Before.ARTICLES, typeof After.ARTICLES>>,
    Expect<Same<typeof Before.FOOTER, typeof After.FOOTER>>,
  ];
  ```

- [ ] **Step 2: See the safety net green on the old module.** `cd "$CMS" && node --import tsx --test tests/content-roundtrip.test.mjs && npm run typecheck` → `# pass 25`, `# fail 0`, typecheck clean. (This is a refactor: these tests must pass before and after; Step 5 makes the switch.)

- [ ] **Step 3: Rewrite `src/lib/content.ts`** (replace the whole file):
  ```ts
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
  ```
  The `.ts` extensions are required because `scripts/check-content.mjs` imports this module under `node --experimental-strip-types`, which does not resolve extensionless specifiers; `allowImportingTsExtensions` is already on in both tsconfigs.

- [ ] **Step 4: Read the site identity from `content/site.json`.** In `src/lib/site.ts`, replace the first line `import { SERVICES } from "./content";` with:
  ```ts
  import siteFile from "../../content/site.json" with { type: "json" };
  import { SERVICES } from "./content";
  import { siteSchema } from "./content-model";
  import { parseContent } from "./content-schema";

  // Identity copy comes from content/site.json (editable in the CMS); the rest comes from the environment.
  const site = parseContent(siteSchema, siteFile, "content/site.json");
  ```
  Then replace `  name: "spacegear.tech",` with `  name: site.name,`, replace the `  description: "Digital transformation and AI consulting, from strategy to working systems. Modernize operations, connect data and put AI to work.",` line with `  description: site.description,`, and replace `  socialProfiles: [] as string[],` with `  socialProfiles: site.socialProfiles,`. Nothing else in the file changes.

- [ ] **Step 5: See the safety net still green.** `cd "$CMS" && node --import tsx --test tests/content-roundtrip.test.mjs && npm run typecheck && node --experimental-strip-types scripts/check-content.mjs` → `# pass 25`; typecheck clean (both tsconfigs: the Worker config reaches `content.ts` through `src/lib/contact.ts`); `Content valid: 12 routes; preview mode.`

- [ ] **Step 6: Regenerate the index in every build.** In `package.json` replace
  ```json
      "build": "node --experimental-strip-types scripts/check-content.mjs && next build",
  ```
  with
  ```json
      "build": "node scripts/build-content-index.mjs && node --experimental-strip-types scripts/check-content.mjs && next build",
  ```
  In `scripts/build-production.mjs`, insert before the line that starts with `const checks=spawnSync(`:
  ```js
  // >>> CMS (showcase Part 3): index the content entries first, as npm run build does.
  for(const script of ["scripts/build-content-index.mjs"]){const step=spawnSync(process.execPath,[script],{env,stdio:"inherit"});if(step.status!==0)process.exit(step.status||1);}
  // <<< CMS
  ```

- [ ] **Step 7: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass.

- [ ] **Step 8: Build and prove the HTML is unchanged.**
  ```bash
  bash "$WT" "$CMS" 8788 rebuild
  cd "$CMS" && node scripts/html-snapshot.mjs compare artifacts/html-baseline
  ```
  Expected: the build log contains `Content index is up to date.` and `Content valid: 12 routes; preview mode.`; the preview starts (its Worker bundle now includes the JSON content); then `Rendered HTML identical to artifacts/html-baseline: 15 pages.`
  **If `next build` rejects the import attributes** (an error naming `with` or `type: "json"`): Turbopack is the only tool that has not been probed. Keep the attributes (Node requires them for `check-content`) and retry once with `next build --webpack` in the `build` script to confirm it is Turbopack-specific; if so, record it under "Amendments", stop and report to the controller with the error text rather than switching bundlers silently.

- [ ] **Step 9: Commit.**
  ```bash
  cd "$CMS" && git add src/lib/content.ts src/lib/site.ts src/lib/content-contract.ts tests/content-roundtrip.test.mjs package.json scripts/build-production.mjs && git commit -m "feat(cms): load the site copy from content/ through a typed, validated loader" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 5: Legal pages from Markdown

The privacy and terms text lives in the page JSX today. It moves to `content/legal/*.md`, read at build time (server components, static export: nothing is fetched at run time). The preview notice and the contact section stay in the pages because they depend on environment settings. The pages build the sections with `createElement` and spread them into the card, so both the HTML and the inline RSC payload keep the exact element tree of the hand-written JSX (no wrapper component, no keys, no nested arrays). A planning probe rendered the old JSX and the new code with `renderToStaticMarkup`: identical markup and identical child lists.

**Files:**
- Create: `content/legal/privacy.md`, `content/legal/terms.md`, `src/lib/legal-markdown.ts`, `src/lib/legal.ts`, `src/components/legal-sections.ts`
- Test: `tests/legal.test.mjs`
- Modify: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`

- [ ] **Step 1: Write the failing test** `tests/legal.test.mjs`:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";

  const { parseLegalMarkdown } = await import("../src/lib/legal-markdown.ts");
  const { legalSections } = await import("../src/lib/legal.ts");

  test("the privacy page keeps its five sections", () => {
    assert.deepEqual(legalSections("privacy").map((section) => section.heading), [
      "Information you provide", "How it is used", "Storage and service providers", "Retention and access", "Website measurement",
    ]);
  });

  test("the terms page keeps its four sections", () => {
    assert.deepEqual(legalSections("terms").map((section) => section.heading), [
      "Website content", "Engagements", "Appropriate use", "Third-party material",
    ]);
  });

  test("every legal section has one plain paragraph today", () => {
    for (const page of ["privacy", "terms"]) for (const section of legalSections(page)) assert.equal(section.paragraphs.length, 1, `${page}: ${section.heading}`);
  });

  test("soft line breaks join with one space; CRLF and an empty front matter block are accepted", () => {
    const sections = parseLegalMarkdown("---\r\n---\r\n## Heading\r\n\r\nFirst line\r\nsecond line.\r\n\r\nNext paragraph.\r\n", "x.md");
    assert.deepEqual(sections, [{ heading: "Heading", paragraphs: ["First line second line.", "Next paragraph."] }]);
  });

  test("anything beyond headings and plain paragraphs is rejected", () => {
    for (const source of [
      "Intro before any heading.\n\n## Heading\n\nText.",
      "# Title\n\nText.",
      "## Heading\n\n### Sub\n\nText.",
      "## Heading\n\nText with **bold**.",
      "## Heading\n\nA [link](https://example.com).",
      "## Heading\n\n- a list item",
      "## Heading\n\n1. a numbered item",
      "## Heading\n\n<script>alert(1)</script>",
      "## Heading\n\nText &amp; more.",
      "## Heading\n\nText\n## Not a heading inside a paragraph",
      "## Empty section",
      "",
    ]) assert.throws(() => parseLegalMarkdown(source, "bad.md"), /Invalid legal page/, JSON.stringify(source));
  });
  ```

- [ ] **Step 2: Run it and see it fail.** `cd "$CMS" && node --import tsx --test tests/legal.test.mjs` → `ERR_MODULE_NOT_FOUND … legal-markdown.ts`.

- [ ] **Step 3: Write the Markdown** (text copied verbatim from the current pages; one paragraph per line). `content/legal/privacy.md`:
  ```markdown
  ## Information you provide

  The inquiry form asks for your name, email and a description of what you would like to improve. Company and service interest are optional. Please do not send confidential credentials, sensitive personal information or files through the form.

  ## How it is used

  Submitted information is used to review your inquiry and respond about a suitable next step. Sending an inquiry does not subscribe you to a newsletter or marketing campaign.

  ## Storage and service providers

  The website uses Cloudflare for hosting, inquiry processing and storage. Cloudflare Turnstile helps protect the form from automated abuse. If owner notifications are enabled, inquiry details are also sent through Cloudflare to the designated contact inbox.

  ## Retention and access

  Inquiry records are accessible only to those responsible for responding. Closed inquiries that do not become an engagement are retained for up to 90 days, subject to applicable obligations. An engagement may require a separate record and agreement.

  ## Website measurement

  When enabled, Cloudflare Web Analytics provides aggregate website and performance measurements. Inquiry text and email addresses are not included in analytics events. The website does not use advertising trackers.
  ```
  `content/legal/terms.md`:
  ```markdown
  ## Website content

  This website describes services and possible approaches to digital transformation, AI and software delivery. Illustrative workflows are examples, not reports of client results or guarantees.

  ## Engagements

  An inquiry does not create an engagement. Scope, pricing, timescales, confidentiality, ownership, support and responsibilities are agreed separately in writing before work begins.

  ## Appropriate use

  Use this website and its inquiry form lawfully. Do not submit malicious content, interfere with the service or attempt to access private inquiry records.

  ## Third-party material

  Third-party software and assets remain subject to their applicable licenses. External links, where provided, are for relevant information and do not imply a partnership or endorsement.
  ```

- [ ] **Step 4: Implement the parser** `src/lib/legal-markdown.ts`:
  ````ts
  // Parses the restricted Markdown of the legal pages in content/legal/: "## " headings that open
  // sections, followed by plain paragraphs separated by blank lines. Anything else (lists, links,
  // emphasis, HTML, other heading levels) is rejected, so an edit can never render raw Markdown
  // or markup on the page. Erasable TypeScript only (also loaded by scripts/check-content.mjs).
  export type LegalSection = { heading: string; paragraphs: string[] };

  const INLINE_SYNTAX = /[*_`<>[\]\\|]|&#?\w+;/;
  const BLOCK_SYNTAX = /^(?:#|[-+*]\s|\d+[.)]\s|>|```|~~~|[-=]{3,}$)/;

  export function parseLegalMarkdown(source: string, file: string): LegalSection[] {
    const body = source.replace(/\r\n?/g, "\n").replace(/^---\n(?:[\s\S]*?\n)?---\n/, "").trim();
    const sections: LegalSection[] = [];
    const errors: string[] = [];
    body.split(/\n\s*\n/).forEach((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const where = `${file}, block ${index + 1}`;
      if (lines[0]?.startsWith("## ")) {
        const heading = lines.shift()!.slice(3).trim();
        if (!heading) errors.push(`${where}: the heading is empty`);
        if (INLINE_SYNTAX.test(heading)) errors.push(`${where}: remove the formatting from the heading "${heading}"`);
        sections.push({ heading, paragraphs: [] });
        if (!lines.length) return;
      }
      for (const line of lines) {
        if (BLOCK_SYNTAX.test(line)) errors.push(`${where}: only "## " headings and plain paragraphs are supported ("${line.slice(0, 40)}")`);
      }
      const paragraph = lines.join(" ");
      if (INLINE_SYNTAX.test(paragraph)) errors.push(`${where}: remove Markdown or HTML formatting (* _ \` < > [ ] \\ | or &entities;)`);
      const current = sections.at(-1);
      if (!current) errors.push(`${where}: start the page with a "## " heading`);
      else current.paragraphs.push(paragraph);
    });
    for (const section of sections) if (!section.paragraphs.length) errors.push(`${file}: the section "${section.heading}" has no text`);
    if (!sections.length && !errors.length) errors.push(`${file}: no sections found`);
    if (errors.length) throw new Error(`Invalid legal page:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
    return sections;
  }
  ````
  The reader `src/lib/legal.ts`:
  ```ts
  // Reads the legal pages from content/legal/*.md at build time (server components only; the
  // static export inlines the text, so nothing is fetched at run time).
  import fs from "node:fs";
  import path from "node:path";
  import { parseLegalMarkdown } from "./legal-markdown.ts";
  import type { LegalSection } from "./legal-markdown.ts";

  export type { LegalSection };
  export const LEGAL_PAGES = ["privacy", "terms"] as const;
  export type LegalPage = (typeof LEGAL_PAGES)[number];

  export function legalSections(page: LegalPage): LegalSection[] {
    const file = `content/legal/${page}.md`;
    return parseLegalMarkdown(fs.readFileSync(path.join(process.cwd(), file), "utf8"), file);
  }
  ```
  `process.cwd()` is the project root in `next build` (the pattern Next's own docs use for build-time file reads, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`) and in tests.

- [ ] **Step 5: Run the test and see it pass.** `cd "$CMS" && node --import tsx --test tests/legal.test.mjs` → `# pass 5`.

- [ ] **Step 6: Render the sections.** Create `src/components/legal-sections.ts`:
  ```ts
  // The legal page sections from content/legal/<page>.md as plain elements. Pages spread them into
  // the prose card with createElement, so the HTML and the RSC payload stay exactly what the
  // hand-written JSX produced: no wrapper component, no keys, no nested arrays.
  import { createElement, type ReactElement } from "react";
  import { legalSections, type LegalPage } from "@/lib/legal";

  export function legalSectionElements(page: LegalPage): ReactElement[] {
    return legalSections(page).map(({ heading, paragraphs }) =>
      createElement("section", null, createElement("h2", null, heading), ...paragraphs.map((paragraph) => createElement("p", null, paragraph))));
  }
  ```
  Replace `src/app/privacy/page.tsx` with:
  ```tsx
  import { createElement } from "react";
  import PageIntro from "@/components/PageIntro";
  import { legalSectionElements } from "@/components/legal-sections";
  import { Container } from "@/components/ui";
  import { SITE } from "@/lib/site";
  import { buildMetadata } from "@/lib/seo";
  export const metadata = buildMetadata({title:"Privacy",description:"How spacegear.tech handles information submitted through this website and how to contact us about that information.",path:"/privacy/"});
  // Section text: content/legal/privacy.md (editable in the CMS). The notice and the contact section depend on site settings.
  export default function Privacy() {
    const notice = !SITE.policiesApproved && <p className="policy-preview">Preview policy. The operator must confirm the contact details, retention period and data practices before public launch or collection of real inquiries.</p>;
    const contact = <section><h2>Questions or requests</h2><p>{SITE.contactEmail ? <>Contact <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> about information you have submitted, including requests for access or deletion.</> : "A verified privacy contact will be provided before this website opens for real inquiries."}</p></section>;
    return <main id="main" className="relative min-h-screen bg-bg"><section className="pt-32 pb-24"><Container><PageIntro eyebrow="Website information" title="Privacy." description="How information submitted through this website is handled."/>{createElement("div", { className: "prose-card mt-12 max-w-3xl rounded-3xl border border-line bg-card/40 p-8 sm:p-10" }, notice, ...legalSectionElements("privacy"), contact)}</Container></section></main>;
  }
  ```
  Replace `src/app/terms/page.tsx` with:
  ```tsx
  import { createElement } from "react";
  import PageIntro from "@/components/PageIntro";
  import { legalSectionElements } from "@/components/legal-sections";
  import { Container } from "@/components/ui";
  import { SITE } from "@/lib/site";
  import { buildMetadata } from "@/lib/seo";
  export const metadata = buildMetadata({title:"Website Terms",description:"Terms for using the spacegear.tech website. Service scope, pricing, ownership and delivery commitments are agreed separately.",path:"/terms/"});
  // Section text: content/legal/terms.md (editable in the CMS). The notice and the contact section depend on site settings.
  export default function Terms() {
    const notice = !SITE.policiesApproved && <p className="policy-preview">Preview terms. The operator must approve the final website terms and necessary company facts before public launch.</p>;
    const contact = <section><h2>Contact</h2><p>{SITE.contactEmail ? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : "A verified contact address will be available before public launch."}</p></section>;
    return <main id="main" className="relative min-h-screen bg-bg"><section className="pt-32 pb-24"><Container><PageIntro eyebrow="Website information" title="Website terms." description="Information about using this website and discussing an engagement."/>{createElement("div", { className: "prose-card mt-12 max-w-3xl rounded-3xl border border-line bg-card/40 p-8 sm:p-10" }, notice, ...legalSectionElements("terms"), contact)}</Container></section></main>;
  }
  ```

- [ ] **Step 7: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass.

- [ ] **Step 8: Build and prove the HTML is unchanged.**
  ```bash
  bash "$WT" "$CMS" 8788 rebuild
  cd "$CMS" && node scripts/html-snapshot.mjs compare artifacts/html-baseline
  ```
  Expected: `Rendered HTML identical to artifacts/html-baseline: 15 pages.` If only `privacy/index.html` or `terms/index.html` differ inside a `self.__next_f.push` payload, the element tree changed (for example an array became nested): fix the page, do not normalize it away.

- [ ] **Step 9: Commit.**
  ```bash
  cd "$CMS" && git add content/legal src/lib/legal-markdown.ts src/lib/legal.ts src/components/legal-sections.ts src/app/privacy/page.tsx src/app/terms/page.tsx tests/legal.test.mjs && git commit -m "feat(cms): keep the privacy and terms text in Markdown under content/legal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 6: Honesty checks on the loaded content and on every content file

The forbidden-claim patterns move to one shared module. `npm test` and `scripts/check-content.mjs` (which runs in every build) scan both the loaded exports and the raw text of every JSON and Markdown file under `content/`, so a CMS edit that adds a price fails the build even in a field the site does not render.

**Files:**
- Create: `scripts/lib/honesty.mjs`
- Modify: `tests/content.test.mjs`, `scripts/check-content.mjs`

- [ ] **Step 1: Change the tests first.** In `tests/content.test.mjs`:
  1. Replace the two import lines at the top (`import { test } from "node:test";` and `import assert from "node:assert/strict";`) with:
     ```js
     import { test } from "node:test";
     import assert from "node:assert/strict";
     import fs from "node:fs";
     import os from "node:os";
     import path from "node:path";
     import { FORBIDDEN, contentFiles, findForbidden, scanContentTree } from "../scripts/lib/honesty.mjs";
     import { publicText, readContentInput } from "./helpers/content.mjs";
     ```
  2. Replace `const content = await import("../src/lib/content.ts");` with:
     ```js
     const content = await import("../src/lib/content.ts");
     const { buildContent } = await import("../src/lib/content-model.ts");
     ```
  3. Delete the whole local `const FORBIDDEN = [ … ];` block (13 entries; they move to `scripts/lib/honesty.mjs` unchanged).
  4. Replace the test `public content makes no unverified claims` with these four tests:
     ```js
     test("public content makes no unverified claims", () => {
       const text = publicText(content);
       for (const [pattern, what] of FORBIDDEN) assert.doesNotMatch(text, pattern, `content contains ${what}`);
     });

     test("no file under content/ makes an unverified claim, including fields the site does not render", () => {
       const files = contentFiles(".").map((file) => file.replaceAll("\\", "/"));
       for (const file of ["content/home.json", "content/faqs/what-we-do.json", "content/legal/privacy.md", "content/legal/terms.md"]) assert.ok(files.includes(file), `the scan covers ${file}`);
       assert.deepEqual(scanContentTree("."), []);
     });

     test("a price written into a content entry fails both scans (temporary copy, real tree untouched)", () => {
       const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-honesty-"));
       const planted = "content/faqs/zz-planted-price.json";
       try {
         fs.cpSync("content", path.join(root, "content"), { recursive: true });
         const entry = { question: "What does it cost?", answer: "Packages start at $499 per month.", order: 99 };
         fs.writeFileSync(path.join(root, planted), JSON.stringify(entry, null, 2));
         assert.ok(scanContentTree(root).some((problem) => problem.startsWith(`${planted}: a price`)), "the file scan flags it");
         const built = buildContent(readContentInput(root));
         assert.ok(findForbidden(publicText(built)).some((problem) => problem.startsWith("a price")), "the loaded-content scan flags it");
         assert.equal(fs.existsSync(planted), false, "the real content tree is untouched");
       } finally { fs.rmSync(root, { recursive: true, force: true }); }
     });

     test("a price written into a legal page fails the file scan (temporary copy)", () => {
       const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-honesty-"));
       try {
         fs.cpSync("content", path.join(root, "content"), { recursive: true });
         fs.appendFileSync(path.join(root, "content/legal/terms.md"), "\n## Fees\n\nProjects cost from 900 EUR.\n");
         assert.ok(scanContentTree(root).some((problem) => problem.startsWith("content/legal/terms.md: a price")));
       } finally { fs.rmSync(root, { recursive: true, force: true }); }
     });
     ```
  The other tests in the file stay exactly as they are.

- [ ] **Step 2: Run it and see it fail.** `cd "$CMS" && node --import tsx --test tests/content.test.mjs` → `ERR_MODULE_NOT_FOUND … scripts/lib/honesty.mjs`.

- [ ] **Step 3: Implement `scripts/lib/honesty.mjs`.**
  ```js
  // Claims public copy must never make: invented prices, the original site's metrics, press or
  // partnerships, scale, offices, experience or multipliers, and the old identity. Shared by
  // tests/content.test.mjs and scripts/check-content.mjs, which run it on the loaded content and
  // on every file under content/ (JSON and Markdown alike), so a CMS edit cannot slip one in.
  import fs from "node:fs";
  import path from "node:path";

  export const FORBIDDEN = [
    [/\$\s?\d/, "a price"],
    [/97\.8|31\.2|84\.7/, "an original platform metric"],
    [/TechCrunch|\bAWS\b/, "an unverified press or partnership claim"],
    [/Enterprise Clients|Active Users|API Calls/i, "an unverified scale claim"],
    [/Platform®|Platform B\.V\.|Platform Labs|plat—form/, "the old brand"],
    [/Book a Demo/i, "the old call to action"],
    [/®/, "a registered-trademark sign (use ™ until the mark is registered)"],
    [/Amsterdam|New York|Dubai|Keizersgracht/, "an office location"],
    [/\b\d+(?:\.\d+)?\s?[MKB]\+/, "a scale figure"],
    [/[€£¥]|\b(?:USD|EUR|GBP|VND)\b|per (?:month|year|seat)|\/\s?(?:mo|yr)\b/i, "a price"],
    [/\b\d[\d,]*\+(?!\d)/, "a scale figure"],
    [/\b\d+\s?(?:\+\s?)?years?\b/i, "an experience claim"],
    [/\b\d+x\b/i, "a multiplier claim"],
  ];

  /** Every forbidden claim in `text`, as "<what> (<match>)". */
  export function findForbidden(text) {
    return FORBIDDEN.flatMap(([pattern, what]) => {
      const hit = text.match(pattern);
      return hit ? [`${what} ("${hit[0]}")`] : [];
    });
  }

  /** Every editable content file (JSON or Markdown) under <root>/content, dotfiles excluded. */
  export function contentFiles(root = ".") {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name.startsWith(".")) return [];
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(?:json|md)$/.test(entry.name) ? [full] : [];
    });
    const dir = path.join(root, "content");
    return fs.existsSync(dir) ? walk(dir).sort() : [];
  }

  /** Scans the raw text of every content file, so fields the site does not render are checked too. */
  export function scanContentTree(root = ".") {
    return contentFiles(root).flatMap((file) => {
      const name = path.relative(root, file).replaceAll("\\", "/");
      return findForbidden(fs.readFileSync(file, "utf8")).map((problem) => `${name}: ${problem}`);
    });
  }
  ```

- [ ] **Step 4: Run it and see it pass.** `cd "$CMS" && node --import tsx --test tests/content.test.mjs` → `# pass 17`, `# fail 0`.

- [ ] **Step 5: Upgrade `scripts/check-content.mjs`** (replace the whole file):
  ```js
  import fs from "node:fs";
  import { validatePublication } from "../src/lib/publication.ts";
  import { parseContent } from "../src/lib/content-schema.ts";
  import { siteSchema } from "../src/lib/content-model.ts";
  import { LEGAL_PAGES, legalSections } from "../src/lib/legal.ts";
  import { INDEX_FILE, readIndex, renderIndex } from "./build-content-index.mjs";
  import { findForbidden, scanContentTree } from "./lib/honesty.mjs";
  const mode = process.argv.includes("--production") ? "production" : process.env.SITE_MODE || "preview";
  const errors = [];
  // The CMS writes content/; the build regenerates the entry index first, so a stale index means
  // this script ran on its own: `npm run content:index` fixes it.
  if (readIndex(".") !== renderIndex(".")) errors.push(`${INDEX_FILE} is out of date: run npm run content:index`);
  // Loading the module validates every content file and lists all problems at once.
  let content;
  try {
    content = await import("../src/lib/content.ts");
    parseContent(siteSchema, JSON.parse(fs.readFileSync("content/site.json", "utf8")), "content/site.json");
    for (const page of LEGAL_PAGES) legalSections(page);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  const { SERVICES, CASE_STUDIES } = content;
  const routes = ["/", "/services/", ...SERVICES.map((s) => `/services/${s.slug}/`), ...["about", "approach", "contact", "privacy", "terms"].map((s) => `/${s}/`)];
  errors.push(...validatePublication({ mode, origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8787", contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL, policiesApproved: process.env.POLICIES_APPROVED === "true" }, routes));
  for (const service of SERVICES) {
    if (!service.summary || !service.buyerProblem || !service.deliverables.length || !service.faqs.length) errors.push(`incomplete service: ${service.slug}`);
  }
  if (CASE_STUDIES.some((study) => study.published && !study.approved)) errors.push("unverified published case study");
  // Honesty: no invented prices, metrics, press, scale or offices, in the loaded copy or in any file under content/.
  const values = Object.entries(content).filter(([, value]) => typeof value !== "function").map(([, value]) => value);
  for (const problem of findForbidden(JSON.stringify(values))) errors.push(`content contains ${problem}`);
  for (const problem of scanContentTree(".")) errors.push(`forbidden claim in ${problem}`);
  // `next build` always inlines NODE_ENV=production; sample mode exists only under `next dev`.
  if (process.env.NEXT_PUBLIC_SHOW_SAMPLES === "true") errors.push("sample sections are only available under `next dev`; unset NEXT_PUBLIC_SHOW_SAMPLES to build");
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
  else console.log(`Content valid: ${routes.length} routes; ${mode} mode.`);
  ```
  Run: `cd "$CMS" && node --experimental-strip-types scripts/check-content.mjs` → `Content valid: 12 routes; preview mode.` (plus Node's type-stripping warning on stderr). In planning, the same script printed `content contains a price ("$9")` and `forbidden claim in content/home.json: a price ("$9")` for a planted price, and `Content check failed. Fix these fields: - content/home.json: cta.label: required` for an emptied required field. Do not plant anything in the real tree to repeat that; the Step 1 tests cover it on temporary copies.

- [ ] **Step 6: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass. No rebuild is needed: nothing renders differently, and Task 7 rebuilds with this script in the chain.

- [ ] **Step 7: Commit.**
  ```bash
  cd "$CMS" && git add scripts/lib/honesty.mjs tests/content.test.mjs scripts/check-content.mjs && git commit -m "test(cms): scan the loaded copy and every content file for invented claims in tests and builds" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 7: Upload variants pipeline

> **Superseded during execution (Task 7 and its review).** The committed `scripts/build-upload-variants.mjs`, `scripts/lib/uploads.mjs`, `scripts/lib/content-assets.mjs`, `scripts/lib/exact-paths.mjs`, `src/lib/content-images.ts`, `tests/uploads.test.mjs` and the fenced blocks supersede the code blocks below. Variants are no longer written next to the uploads under reserved `-640`/`-1280` names. They go to `.cache/upload-variants/` as `photo.jpg.w640.webp` and `photo.jpg.w1280.webp`, are current only while a manifest's SHA-1 of the original matches, and are shipped next to the originals by `package-site`. See "Amendments made during execution".

CMS uploads land in `public/uploads/`. Before `next build`, `scripts/build-upload-variants.mjs` writes `<name>-640.webp` and `<name>-1280.webp` next to each raster upload (never upscaled; idempotent by modification time). Variants are build output and gitignored, so their names are reserved: content may not point at one, and a stale variant whose original was deleted is reported, never deleted (it could be a real upload). `contentImage()` turns an upload into a `srcset`; site images under `/images/` keep their exact markup. The CMS also re-encodes uploads to WebP in Chrome (Task 9), which drops camera metadata such as GPS.

**Files:**
- Create: `scripts/build-upload-variants.mjs`, `scripts/lib/content-assets.mjs`, `src/lib/content-images.ts`
- Test: `tests/uploads.test.mjs`
- Modify: `package.json`, `scripts/build-production.mjs`, `scripts/check-content.mjs`, `scripts/package-site.mjs`, `scripts/check-export.mjs`, `.gitignore`

- [ ] **Step 1: Write the failing test** `tests/uploads.test.mjs`:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import fs from "node:fs";
  import os from "node:os";
  import path from "node:path";
  import sharp from "sharp";
  import { buildUploadVariants, variantFile, WIDTHS } from "../scripts/build-upload-variants.mjs";
  import { missingImageFiles, referencedImages } from "../scripts/lib/content-assets.mjs";

  const { contentImage, UPLOAD_WIDTHS } = await import("../src/lib/content-images.ts");

  // libvips keeps recently used files open, which blocks deleting them on Windows.
  sharp.cache(false);
  const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-uploads-"));
  const solid = (width, height) => sharp({ create: { width, height, channels: 3, background: "#fa6e43" } });

  test("each upload gets WebP variants at 640 and 1280 px, never wider than the original", async () => {
    const dir = tempDir();
    try {
      await solid(2000, 1000).jpeg().toFile(path.join(dir, "wide.jpg"));
      await solid(900, 900).png().toFile(path.join(dir, "small.png"));
      const result = await buildUploadVariants(dir);
      assert.deepEqual(result.errors, []);
      assert.equal(result.written.length, 4);
      const width = async (file) => (await sharp(path.join(dir, file)).metadata()).width;
      assert.equal(await width("wide-640.webp"), 640);
      assert.equal(await width("wide-1280.webp"), 1280);
      assert.equal(await width("small-640.webp"), 640);
      assert.equal(await width("small-1280.webp"), 900, "no upscaling");
      assert.equal((await sharp(path.join(dir, "wide-1280.webp")).metadata()).format, "webp");
    } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
  });

  test("a second run skips up-to-date variants and rewrites only those older than their original", async () => {
    const dir = tempDir();
    try {
      const original = path.join(dir, "photo.webp");
      await solid(1600, 900).webp().toFile(original);
      await buildUploadVariants(dir);
      const again = await buildUploadVariants(dir);
      assert.deepEqual([again.written.length, again.upToDate.length], [0, 2]);
      const later = new Date(Date.now() + 5000);
      fs.utimesSync(original, later, later);
      const touched = await buildUploadVariants(dir);
      assert.deepEqual([touched.written.length, touched.upToDate.length], [2, 0]);
    } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
  });

  test("dotfiles are ignored, stale variants are reported and colliding names are refused", async () => {
    const dir = tempDir();
    try {
      fs.writeFileSync(path.join(dir, ".gitkeep"), "");
      fs.writeFileSync(path.join(dir, ".sveltia-tmp-123"), "partial");
      await solid(800, 600).webp().toFile(path.join(dir, "gone-640.webp"));
      const stale = await buildUploadVariants(dir);
      assert.deepEqual([stale.originals, stale.written.length, stale.stale.map((file) => path.basename(file))], [0, 0, ["gone-640.webp"]]);
      await solid(800, 600).jpeg().toFile(path.join(dir, "team.jpg"));
      await solid(800, 600).png().toFile(path.join(dir, "team.png"));
      const clash = await buildUploadVariants(dir);
      assert.equal(clash.errors.length, 1);
      assert.match(clash.errors[0], /share a name/);
      assert.equal(fs.existsSync(path.join(dir, "team-640.webp")), false, "nothing is written while names collide");
    } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
  });

  test("a missing uploads folder is not an error", async () => {
    const result = await buildUploadVariants(path.join(os.tmpdir(), "spacegear-no-such-folder"));
    assert.deepEqual([result.originals, result.errors], [0, []]);
  });

  test("contentImage builds a srcset from the same variant names the script writes", () => {
    assert.deepEqual([...UPLOAD_WIDTHS], WIDTHS);
    const props = contentImage("/uploads/team/photo.jpg");
    assert.deepEqual(props, {
      src: "/uploads/team/photo-1280.webp",
      srcSet: "/uploads/team/photo-640.webp 640w, /uploads/team/photo-1280.webp 1280w",
      sizes: "(min-width: 1024px) 50vw, 100vw",
    });
    for (const width of WIDTHS) assert.ok(props.srcSet.includes(variantFile("/uploads/team/photo.jpg", width)));
  });

  test("site images, SVG and GIF render unchanged (src only)", () => {
    for (const src of ["/images/suite/neural-net.webp", "/uploads/logo.svg", "/uploads/loop.gif"]) assert.deepEqual(contentImage(src), { src });
  });

  test("content image checks find missing files and missing variants", () => {
    const dir = tempDir();
    try {
      fs.mkdirSync(path.join(dir, "uploads"));
      fs.writeFileSync(path.join(dir, "uploads", "a.webp"), "");
      fs.writeFileSync(path.join(dir, "uploads", "a-640.webp"), "");
      const values = { card: { img: "/uploads/a.webp" }, list: [{ img: "/images/missing.webp" }], href: "/contact/" };
      assert.deepEqual(referencedImages(values), ["/images/missing.webp", "/uploads/a.webp"]);
      assert.deepEqual(missingImageFiles(values, dir), ["/images/missing.webp", "/uploads/a-1280.webp (run npm run uploads:variants)"]);
    } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
  });
  ```

- [ ] **Step 2: Run it and see it fail.** `cd "$CMS" && node --import tsx --test tests/uploads.test.mjs` → `ERR_MODULE_NOT_FOUND … build-upload-variants.mjs`.

- [ ] **Step 3: Implement `scripts/build-upload-variants.mjs`.**
  ```js
  // Writes responsive WebP variants next to every image the CMS uploads to public/uploads/:
  //   public/uploads/team-photo.webp -> team-photo-640.webp and team-photo-1280.webp
  // A variant is never wider than its original. The step is idempotent: a variant newer than its
  // original is left alone. Variants are build output (.gitignore), so names ending in -640.webp or
  // -1280.webp are reserved for them. src/lib/content-images.ts turns an upload into a srcset of
  // these files, and scripts/package-site.mjs ships uploads/** with the site.
  //   node scripts/build-upload-variants.mjs
  import fs from "node:fs/promises";
  import path from "node:path";
  import { pathToFileURL } from "node:url";

  export const UPLOADS_DIR = "public/uploads";
  export const WIDTHS = [640, 1280];
  export const RASTER = /\.(?:jpe?g|png|webp|avif)$/i;
  export const VARIANT = /-(?:640|1280)\.webp$/i;

  const stem = (file) => file.replace(/\.[^./\\]+$/, "");
  export const variantFile = (original, width) => `${stem(original)}-${width}.webp`;
  export const variantFiles = (original) => WIDTHS.map((width) => variantFile(original, width));

  async function listFiles(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    const files = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // .gitkeep and the CMS's .sveltia-tmp-* files
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...(await listFiles(full)));
      else if (entry.isFile()) files.push(full);
    }
    return files;
  }

  export async function buildUploadVariants(dir = UPLOADS_DIR) {
    const files = await listFiles(dir);
    const originals = files.filter((file) => RASTER.test(file) && !VARIANT.test(file)).sort();
    const result = { originals: originals.length, written: [], upToDate: [], stale: [], errors: [] };
    const stems = new Map();
    for (const original of originals) {
      const key = stem(original).toLowerCase();
      if (stems.has(key)) result.errors.push(`${original} and ${stems.get(key)} share a name, so their variants would collide; rename one of them`);
      else stems.set(key, original);
    }
    const expected = new Set(originals.flatMap(variantFiles).map((file) => file.toLowerCase()));
    for (const file of files) if (VARIANT.test(file) && !expected.has(file.toLowerCase())) result.stale.push(file);
    if (result.errors.length) return result;
    let sharp;
    for (const original of originals) {
      const source = await fs.stat(original);
      for (const width of WIDTHS) {
        const out = variantFile(original, width);
        const existing = await fs.stat(out).catch(() => null);
        if (existing && existing.mtimeMs >= source.mtimeMs) {
          result.upToDate.push(out);
          continue;
        }
        if (!sharp) {
          sharp = (await import("sharp")).default;
          sharp.cache(false); // do not keep uploads open (Windows locks open files)
        }
        await sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
        result.written.push(out);
      }
    }
    return result;
  }

  if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const result = await buildUploadVariants();
    for (const file of result.stale) console.warn(`Stale variant with no original (safe to delete): ${file}`);
    if (result.errors.length) {
      console.error(result.errors.join("\n"));
      process.exitCode = 1;
    } else {
      console.log(`Upload variants: ${result.originals} originals, ${result.written.length} written, ${result.upToDate.length} up to date.`);
    }
  }
  ```
  `scripts/lib/content-assets.mjs`:
  ```js
  // Every local image the loaded content references, and the ones missing from public/ (for a CMS
  // upload, its generated -640/-1280 WebP variants count too). Used by scripts/check-content.mjs.
  import fs from "node:fs";
  import path from "node:path";
  import { RASTER, variantFiles } from "../build-upload-variants.mjs";

  export function referencedImages(values) {
    const found = new Set();
    const walk = (value) => {
      if (typeof value === "string") {
        if (/^\/(?:images|uploads)\//.test(value)) found.add(value);
      } else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(values);
    return [...found].sort();
  }

  export function missingImageFiles(values, publicDir = "public") {
    const missing = [];
    for (const src of referencedImages(values)) {
      const file = path.join(publicDir, src);
      if (!fs.existsSync(file)) {
        missing.push(src);
        continue;
      }
      if (src.startsWith("/uploads/") && RASTER.test(src)) {
        for (const variant of variantFiles(file)) {
          if (!fs.existsSync(variant)) missing.push(`/${path.relative(publicDir, variant).replaceAll("\\", "/")} (run npm run uploads:variants)`);
        }
      }
    }
    return missing;
  }
  ```
  `src/lib/content-images.ts`:
  ```ts
  // Image attributes for content images. A CMS upload (/uploads/…) renders from the WebP variants
  // that scripts/build-upload-variants.mjs writes next to it; site images (/images/…) and vector or
  // animated files render as before, so their markup does not change.
  export const UPLOAD_WIDTHS = [640, 1280] as const;
  export const DEFAULT_SIZES = "(min-width: 1024px) 50vw, 100vw";
  const RASTER_UPLOAD = /^(\/uploads\/.+)\.(?:jpe?g|png|webp|avif)$/i;

  export type ContentImageProps = { src: string; srcSet?: string; sizes?: string };

  /** Spread onto an <img> in place of `src`: `<img {...contentImage(item.img)} alt="" />`. */
  export function contentImage(src: string, sizes: string = DEFAULT_SIZES): ContentImageProps {
    const match = RASTER_UPLOAD.exec(src);
    if (!match) return { src };
    const stem = match[1];
    const largest = UPLOAD_WIDTHS[UPLOAD_WIDTHS.length - 1];
    return {
      src: `${stem}-${largest}.webp`,
      srcSet: UPLOAD_WIDTHS.map((width) => `${stem}-${width}.webp ${width}w`).join(", "),
      sizes,
    };
  }
  ```

- [ ] **Step 4: Run it and see it pass.** `cd "$CMS" && node --import tsx --test tests/uploads.test.mjs` → `# pass 7`, `# fail 0`.

- [ ] **Step 5: Wire the step into the build.**
  - `package.json`: replace the `build` line with
    ```json
        "build": "node scripts/build-content-index.mjs && node scripts/build-upload-variants.mjs && node --experimental-strip-types scripts/check-content.mjs && next build",
    ```
    and after `"content:index": "node scripts/build-content-index.mjs"` add a comma and `"uploads:variants": "node scripts/build-upload-variants.mjs"`.
  - `scripts/build-production.mjs`: in the CMS block, replace `["scripts/build-content-index.mjs"]` with `["scripts/build-content-index.mjs","scripts/build-upload-variants.mjs"]` and the comment with `// >>> CMS (showcase Part 3): index the content entries and write the upload variants first, as npm run build does.`
  - `scripts/check-content.mjs`: add `import { missingImageFiles } from "./lib/content-assets.mjs";` after the `honesty.mjs` import, and insert before the `// \`next build\` always inlines` comment:
    ```js
    // Every image the content points at must exist (a CMS upload also needs its generated variants).
    for (const missing of missingImageFiles(values, "public")) errors.push(`missing image: public${missing}`);
    ```
  - `.gitignore`: append
    ```
    # CMS: upload variants are build output (scripts/build-upload-variants.mjs); Sveltia's temporary save files
    /public/uploads/**/*-640.webp
    /public/uploads/**/*-1280.webp
    .sveltia-tmp-*
    ```

- [ ] **Step 6: Ship uploads.** In `scripts/package-site.mjs`, insert before the line `let headers=await fs.readFile("public/_headers","utf8");`:
  ```js
  // >>> CMS (showcase Part 3): ship every CMS upload with its generated variants (dotfiles such as
  // .gitkeep or the CMS's .sveltia-tmp-* never ship), and /admin/ (the vendored Sveltia CMS).
  const shipFolder=async(name)=>{const from=path.join(source,name);try{await fs.access(from);}catch{return false;}await fs.cp(from,path.join(target,name),{recursive:true,filter:file=>!path.basename(file).startsWith(".")});return true;};
  await shipFolder("uploads");
  // <<< CMS
  ```
  In `scripts/check-export.mjs`, insert before the last line (the one starting `if(errors.length){console.error(errors.join(`):
  ```js
  // >>> CMS (showcase Part 3): every /uploads/ file a page or chunk names must ship (srcset variants
  // included), and /admin/ ships whole: page, config, the locked Sveltia files and its own _headers rule.
  const uploadRef=/\/uploads\/[\w./-]+?\.(?:webp|png|jpe?g|avif|gif|svg)/g;
  async function scanUploads(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),relative=path.relative(root,file).replaceAll("\\","/");if(entry.isDirectory()){if(relative!=="admin")await scanUploads(file);}else if(/\.(html|txt|js)$/.test(entry.name))for(const m of (await fs.readFile(file,"utf8")).matchAll(uploadRef))await need(m[0],relative);}}
  await scanUploads(root);
  // <<< CMS
  ```

- [ ] **Step 7: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass. Also `cd "$CMS" && npm run uploads:variants` → `Upload variants: 0 originals, 0 written, 0 up to date.`

- [ ] **Step 8: Build and prove the HTML is unchanged.**
  ```bash
  bash "$WT" "$CMS" 8788 rebuild
  cd "$CMS" && node scripts/html-snapshot.mjs compare artifacts/html-baseline
  ```
  Expected: the build log shows `Upload variants: 0 originals, …` and `Export valid: 12 core pages, …`; then `Rendered HTML identical to artifacts/html-baseline: 15 pages.`

- [ ] **Step 9: Commit.**
  ```bash
  cd "$CMS" && git add scripts/build-upload-variants.mjs scripts/lib/content-assets.mjs src/lib/content-images.ts tests/uploads.test.mjs package.json scripts/build-production.mjs scripts/check-content.mjs scripts/package-site.mjs scripts/check-export.mjs .gitignore && git commit -m "feat(cms): build responsive WebP variants for uploads and ship them" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 8: Render content images through their variants

The only task that edits section components. Each edit replaces `src={X}` with `{...contentImage(X)}` at the same attribute position. For every current image (all under `/images/`) `contentImage()` returns `{ src }` only, so the markup is unchanged; an upload gets `src`, `srcSet` and `sizes`. These lines are also likely to be touched by Part 2 (section effects); see "Merge notes". The controller may defer this task until Part 2 has merged; nothing else depends on it.

**Files:** (Modify) `src/components/sections/Analytics.tsx`, `Faq.tsx`, `Labs.tsx`, `Pricing.tsx`, `Services.tsx`, `Team.tsx`, `TestimonialsCarousel.tsx`, `Work.tsx`, `src/app/contact/page.tsx`, `src/app/services/page.tsx`

- [ ] **Step 1: Add the import and replace the `src` attribute in each file.** In every file, add `import { contentImage } from "@/lib/content-images";` on its own line directly after the file's `@/lib/content` import (in `TestimonialsCarousel.tsx` after `import type { Testimonial } from "@/lib/content";`). Then make these replacements (each `old` is unique in its file unless marked):

  | File | Old | New |
  |---|---|---|
  | `Analytics.tsx` | `<img src={MEASURE.imageCard.img} alt=""` | `<img {...contentImage(MEASURE.imageCard.img)} alt=""` |
  | `Faq.tsx` | `<img src={FAQ_CARD.img} alt={FAQ_CARD.imgAlt} loading="lazy"` | `<img {...contentImage(FAQ_CARD.img)} alt={FAQ_CARD.imgAlt} loading="lazy"` |
  | `Labs.tsx` | `<img src={a.img} alt=""` | `<img {...contentImage(a.img)} alt=""` |
  | `Pricing.tsx` | `<img src={item.img} alt=""` | `<img {...contentImage(item.img)} alt=""` |
  | `Services.tsx` | `<img src={s.img} alt=""` | `<img {...contentImage(s.img)} alt=""` |
  | `Team.tsx` | the line `src={m.img}` (inside `<motion.img`) | `{...contentImage(m.img)}` (same indentation) |
  | `TestimonialsCarousel.tsx` | the line `src={r.img}` (inside `<motion.img`) | `{...contentImage(r.img)}` (same indentation) |
  | `TestimonialsCarousel.tsx` | `<img src={rv.img} alt=""` | `<img {...contentImage(rv.img)} alt=""` |
  | `Work.tsx` | the line `src={img}` (inside `Tile`'s `<img`) | `{...contentImage(img)}` (same indentation) |
  | `Work.tsx` (two occurrences, replace all) | `<img src={f.img} alt=""` | `<img {...contentImage(f.img)} alt=""` |
  | `src/app/contact/page.tsx` | `<img src={FAQ_CARD.img} alt={FAQ_CARD.imgAlt} className=` | `<img {...contentImage(FAQ_CARD.img)} alt={FAQ_CARD.imgAlt} className=` |
  | `src/app/services/page.tsx` | `<img src={pillar.img} alt=""` | `<img {...contentImage(pillar.img)} alt=""` |

  Check that no content image is left: `cd "$CMS" && grep -rnE "src=\{(MEASURE|FAQ_CARD|a|item|s|m|r|rv|img|f|pillar)(\.img|\.imageCard\.img)?\}" src/components/sections src/app` → no output. (`OrbitalCinematic.tsx` keeps its literal `/images/galaxy.webp` and poster paths; they are not content.)

- [ ] **Step 2: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass.

- [ ] **Step 3: Build and prove the HTML is unchanged.**
  ```bash
  bash "$WT" "$CMS" 8788 rebuild
  cd "$CMS" && node scripts/html-snapshot.mjs compare artifacts/html-baseline
  ```
  Expected: `Rendered HTML identical to artifacts/html-baseline: 15 pages.`

- [ ] **Step 4: End-to-end check with a temporary upload (not committed).**
  ```bash
  cd "$CMS" && mkdir -p public/uploads && cp public/images/faq-team.webp public/uploads/e2e-check.webp \
    && sed -i 's#"img": "/images/faq-team.webp"#"img": "/uploads/e2e-check.webp"#' content/faq-card.json && grep -c e2e-check content/faq-card.json
  bash "$WT" "$CMS" 8788 rebuild
  cd "$CMS" && grep -ioE 'srcset="/uploads/e2e-check\.webp\.w640\.webp 640w, /uploads/e2e-check\.webp\.w1280\.webp 1280w"' dist/index.html dist/contact/index.html && ls dist/uploads
  ```
  Expected: `1`; the rebuild passes (`Upload variants: 1 originals, 2 written, 0 up to date, 0 removed.`, `Content valid…`, `Uploads shipped: 3 files.`, `Export valid…`); one `srcSet=…` match in each of the two pages; `ls` lists `e2e-check.webp  e2e-check.webp.w1280.webp  e2e-check.webp.w640.webp`.
  Revert, then rebuild and compare:
  ```bash
  cd "$CMS" && git checkout -- content/faq-card.json && rm -f public/uploads/e2e-check.webp && git status --short public content
  bash "$WT" "$CMS" 8788 rebuild
  cd "$CMS" && node scripts/html-snapshot.mjs compare artifacts/html-baseline
  ```
  Expected: `git status` shows nothing under `public` or `content` (the empty `public/uploads/` folder is invisible to git); the rebuild's variant step removes the two cached variants (`… 2 removed.`) and packaging empties `dist/uploads/`; then `Rendered HTML identical to artifacts/html-baseline: 15 pages.`

- [ ] **Step 5: Commit.**
  ```bash
  cd "$CMS" && git status --short && git add src/components/sections/Analytics.tsx src/components/sections/Faq.tsx src/components/sections/Labs.tsx src/components/sections/Pricing.tsx src/components/sections/Services.tsx src/components/sections/Team.tsx src/components/sections/TestimonialsCarousel.tsx src/components/sections/Work.tsx src/app/contact/page.tsx src/app/services/page.tsx && git commit -m "feat(cms): render uploaded images from their responsive variants" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 9: Vendor Sveltia CMS and add the admin page

**Files:**
- Create: `.gitattributes`, `scripts/vendor-sveltia.mjs`, `scripts/sveltia-cms.lock.json` (generated), `public/admin/sveltia/**` (generated), `public/admin/index.html`, `public/admin/config.yml`
- Test: `tests/admin.test.mjs`, `tests/cms-config.test.mjs`
- Modify: `package.json` (script `cms:vendor`, devDependency `js-yaml`), `package-lock.json`

- [ ] **Step 1: Declare the YAML parser the config test uses.** `js-yaml@4.2.0` is already in the CMS worktree's own `node_modules` (through ESLint); declare it with a plain install:
  ```bash
  cd "$CMS" && npm install --save-dev --save-exact js-yaml@4.2.0 && git diff --stat package.json package-lock.json && node --input-type=module -e "import('js-yaml').then((m) => console.log(typeof m.load))"
  ```
  Expected: `package.json` gains `"js-yaml": "4.2.0"` under `devDependencies`; the lockfile diff is a few lines (the root `devDependencies` entry and possibly the `dev` flag of `node_modules/js-yaml`); then `function`. If the lockfile diff touches unrelated packages, or the registry is unreachable, run `git checkout -- package.json package-lock.json` and add the two lines by hand instead: `"js-yaml": "4.2.0"` in `package.json` `devDependencies`, and the same line in `package-lock.json` under `packages[""].devDependencies` (keep keys alphabetical). Record which way was used under "Amendments".

- [ ] **Step 2: Write the failing tests.** `tests/admin.test.mjs`:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import fs from "node:fs";
  import { SVELTIA, verifyVendored } from "../scripts/vendor-sveltia.mjs";

  test("the vendored Sveltia CMS is byte for byte the pinned release", () => {
    assert.deepEqual(verifyVendored("."), []);
    const lock = JSON.parse(fs.readFileSync("scripts/sveltia-cms.lock.json", "utf8"));
    assert.equal(lock.version, SVELTIA.version);
    assert.ok("sveltia-cms.js" in lock.files, "the browser bundle");
    assert.ok(Object.keys(lock.files).some((file) => file.startsWith("chunks/")), "the lazy chunks it imports next to itself");
    assert.ok(!Object.keys(lock.files).some((file) => file.endsWith(".map")), "no source maps");
  });

  test("the admin page loads only the vendored bundle and is never indexed", () => {
    const html = fs.readFileSync("public/admin/index.html", "utf8");
    assert.deepEqual([...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]), ['<script src="/admin/sveltia/sveltia-cms.js">'], "one external script, no inline code");
    assert.match(html, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.match(html, /<link rel="cms-config-url" type="application\/yaml" href="\/admin\/config\.yml" \/>/);
    assert.doesNotMatch(html, /https?:\/\//, "no third-party address in the page");
  });
  ```
  `tests/cms-config.test.mjs`:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import fs from "node:fs";
  import { load } from "js-yaml";

  const { contentSchemas, SINGLETON_FILES, COLLECTION_NAMES } = await import("../src/lib/content-model.ts");
  const { SERVICES } = await import("../src/lib/content.ts");
  const config = load(fs.readFileSync("public/admin/config.yml", "utf8"));
  const schemas = contentSchemas(SERVICES.map((service) => service.slug));
  const pages = config.collections.find((collection) => collection.name === "pages");

  // One CMS field must express exactly the rule its schema enforces.
  function mirrorField(schema, field, where) {
    const meta = schema.meta;
    const required = field.required !== false;
    switch (meta.kind) {
      case "text": {
        assert.ok((meta.format === "image" ? ["image"] : ["string", "text"]).includes(field.widget), `${where}: widget ${field.widget} for ${meta.format} text`);
        assert.equal(required, meta.min > 0, `${where}: required`);
        if (field.widget !== "image") assert.equal(field.maxlength, meta.max, `${where}: maxlength`);
        assert.equal(field.pattern?.[0], meta.pattern?.source, `${where}: pattern`);
        return;
      }
      case "number":
        assert.equal(field.widget, "number", `${where}: widget`);
        assert.deepEqual([field.min, field.max, field.value_type], [meta.min, meta.max, meta.integer ? "int" : "float"], `${where}: bounds`);
        return;
      case "boolean":
        assert.equal(field.widget, "boolean", `${where}: widget`);
        return;
      case "literal":
        assert.deepEqual([field.widget, field.default], ["hidden", meta.value], `${where}: fixed value`);
        return;
      case "oneOf":
        assert.equal(field.widget, "select", `${where}: widget`);
        assert.deepEqual(field.options, [...meta.values], `${where}: options`);
        return;
      case "nullable":
        assert.equal(required, false, `${where}: optional`);
        return mirrorField(meta.inner, { ...field, required: undefined }, where);
      case "object":
        assert.equal(field.widget, "object", `${where}: widget`);
        return mirrorFields(meta.shape, field.fields, where);
      case "list": {
        if (meta.max === 0) {
          assert.deepEqual([field.widget, field.default], ["hidden", []], `${where}: always empty`);
          return;
        }
        assert.equal(field.widget, "list", `${where}: widget`);
        assert.equal(required, meta.min > 0, `${where}: required`);
        assert.deepEqual([field.min, field.max], [meta.min > 0 ? meta.min : undefined, meta.max], `${where}: list size`);
        if (meta.item.meta.kind === "object") return mirrorFields(meta.item.meta.shape, field.fields, `${where}[]`);
        assert.ok(field.field, `${where}: a list of single values uses "field"`);
        return mirrorField(meta.item, field.field, `${where}[]`);
      }
    }
  }

  function mirrorFields(shape, fields, where) {
    assert.deepEqual(fields.map((field) => field.name), Object.keys(shape), `${where}: CMS fields follow the schema keys, in order`);
    for (const field of fields) mirrorField(shape[field.name], field, `${where}.${field.name}`);
  }

  test("every content file has a CMS entry whose fields mirror its schema", () => {
    const files = new Map(pages.files.map((file) => [file.file, file]));
    mirrorFields(schemas.site.meta.shape, files.get("content/site.json").fields, "content/site.json");
    for (const [name, file] of Object.entries(SINGLETON_FILES)) {
      assert.ok(files.has(file), `${file} is editable in the CMS`);
      mirrorFields(schemas.singletons[name].meta.shape, files.get(file).fields, file);
    }
    assert.equal(pages.files.length, Object.keys(SINGLETON_FILES).length + 1, "no CMS entry for an unknown file");
  });

  test("every folder collection mirrors its entry schema", () => {
    for (const name of COLLECTION_NAMES) {
      const collection = config.collections.find((item) => item.name === name);
      assert.ok(collection, `${name} is a CMS collection`);
      assert.deepEqual([collection.folder, collection.extension, collection.format], [`content/${name}`, "json", "json"], `${name}: folder and format`);
      assert.ok(fs.existsSync(collection.folder), `${collection.folder} exists`);
      mirrorFields(schemas.collections[name].meta.shape, collection.fields, `content/${name}`);
    }
  });

  test("services keep their pages: no creating, deleting or renaming them in the CMS", () => {
    const services = config.collections.find((item) => item.name === "services");
    assert.deepEqual([services.create, services.delete, services.duplicate], [false, false, false]);
    assert.equal(services.fields.find((field) => field.name === "slug").readonly, true);
  });

  test("legal pages are Markdown files with a single body field", () => {
    const legal = config.collections.find((item) => item.name === "legal");
    assert.deepEqual(legal.files.map((file) => file.file), ["content/legal/privacy.md", "content/legal/terms.md"]);
    for (const file of legal.files) {
      assert.ok(fs.existsSync(file.file), `${file.file} exists`);
      assert.deepEqual(file.fields.map((field) => field.name), ["body"]);
    }
  });

  test("uploads go to public/uploads and are served from /uploads", () => {
    assert.equal(config.media_folder, "public/uploads");
    assert.equal(config.public_folder, "/uploads");
    assert.equal(config.media_libraries.stock_assets, false, "no third-party stock photo providers");
    assert.deepEqual(config.asset_collections.map((item) => [item.media_folder, item.public_folder, item.readonly]), [["public/images", "/images", true]]);
  });
  ```
  Run: `cd "$CMS" && node --import tsx --test tests/admin.test.mjs tests/cms-config.test.mjs` → both fail (`vendor-sveltia.mjs` missing; `public/admin/config.yml` missing).

- [ ] **Step 3: Keep vendored bytes exact.** Create `.gitattributes` (before vendoring, so the files are added without line-ending conversion):
  ```
  # Vendored Sveltia CMS release: keep the published bytes (scripts/vendor-sveltia.mjs checks their hashes).
  public/admin/sveltia/** -text -diff
  ```

- [ ] **Step 4: Write `scripts/vendor-sveltia.mjs`.**
  ```js
  // Vendors a pinned Sveltia CMS release into public/admin/sveltia/ so /admin/ never loads CMS
  // code from a CDN. It downloads the npm tarball, checks its sha512 integrity against the pin
  // below, and extracts the browser bundle (dist/sveltia-cms.js), the lazy chunks it imports
  // relative to its own URL (dist/chunks/**) and the MIT licence. Source maps stay out (check-export
  // rejects *.map files), so the trailing sourceMappingURL comments are dropped as well.
  //   node scripts/vendor-sveltia.mjs          download and rewrite the vendored files + lock
  //   node scripts/vendor-sveltia.mjs --check  verify the vendored files against the lock (offline)
  // To upgrade: set version, tarball and integrity from `npm view @sveltia/cms@<v> dist.tarball dist.integrity`.
  import crypto from "node:crypto";
  import fs from "node:fs";
  import path from "node:path";
  import zlib from "node:zlib";
  import { pathToFileURL } from "node:url";

  export const SVELTIA = {
    name: "@sveltia/cms",
    version: "0.230.1",
    tarball: "https://registry.npmjs.org/@sveltia/cms/-/cms-0.230.1.tgz",
    integrity: "sha512-2iTmW3txB2ocqzEO6b/hkr9Txbw+AFMfmmmqarY3B0WrG5eikwXwYwFWB5CGoQMz1JT5RvcVnKINAWBcVfVRMg==",
  };
  export const TARGET = "public/admin/sveltia";
  export const LOCK = "scripts/sveltia-cms.lock.json";
  const WANTED = /^package\/(?:dist\/sveltia-cms\.js|dist\/chunks\/.+\.js|LICENSE\.txt)$/;

  const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

  /** Minimal ustar reader (with pax `path` records): returns Map<name, Buffer> of regular files. */
  export function untar(buffer) {
    const files = new Map();
    let offset = 0;
    let paxPath = null;
    while (offset + 512 <= buffer.length) {
      const header = buffer.subarray(offset, offset + 512);
      if (header.every((byte) => byte === 0)) break;
      const field = (start, length) => header.subarray(start, start + length).toString("utf8").replace(/\0[\s\S]*$/, "");
      const size = parseInt(field(124, 12).trim() || "0", 8);
      const type = field(156, 1) || "0";
      const prefix = field(345, 155);
      let name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
      const body = buffer.subarray(offset + 512, offset + 512 + size);
      offset += 512 + Math.ceil(size / 512) * 512;
      if (type === "x") { paxPath = body.toString("utf8").match(/^\d+ path=(.+)$/m)?.[1] ?? null; continue; }
      if (type === "g") continue;
      if (paxPath) { name = paxPath; paxPath = null; }
      if (type === "0") files.set(name, Buffer.from(body));
    }
    return files;
  }

  /** Picks the vendored files out of the tarball and strips their sourceMappingURL comments. */
  export function extractVendored(tgz) {
    const integrity = `sha512-${crypto.createHash("sha512").update(tgz).digest("base64")}`;
    if (integrity !== SVELTIA.integrity) throw new Error(`Integrity mismatch for ${SVELTIA.name}@${SVELTIA.version}: expected ${SVELTIA.integrity}, got ${integrity}`);
    const out = new Map();
    for (const [name, body] of untar(zlib.gunzipSync(tgz))) {
      if (!WANTED.test(name)) continue;
      const relative = name.replace(/^package\/(?:dist\/)?/, "");
      out.set(relative, relative.endsWith(".js") ? Buffer.from(body.toString("utf8").replace(/\n?\/\/# sourceMappingURL=\S+\s*$/, "\n")) : body);
    }
    if (!out.has("sveltia-cms.js")) throw new Error("The tarball has no dist/sveltia-cms.js");
    return new Map([...out].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }

  function listFiles(dir, base = dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).replaceAll("\\", "/")];
    });
  }

  /** Offline check used by `npm test`: the vendored files are exactly the locked release. */
  export function verifyVendored(root = ".") {
    const lockFile = path.join(root, LOCK);
    if (!fs.existsSync(lockFile)) return [`${LOCK} is missing; run npm run cms:vendor`];
    const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    const problems = [];
    if (lock.version !== SVELTIA.version || lock.integrity !== SVELTIA.integrity) problems.push(`${LOCK} does not match the pin in scripts/vendor-sveltia.mjs; run npm run cms:vendor`);
    for (const [relative, hash] of Object.entries(lock.files)) {
      const file = path.join(root, TARGET, relative);
      if (!fs.existsSync(file)) problems.push(`missing ${TARGET}/${relative}`);
      else if (sha256(fs.readFileSync(file)) !== hash) problems.push(`${TARGET}/${relative} differs from the vendored release`);
    }
    for (const relative of listFiles(path.join(root, TARGET))) if (!(relative in lock.files)) problems.push(`unexpected file ${TARGET}/${relative}`);
    return problems;
  }

  async function vendor() {
    const response = await fetch(SVELTIA.tarball);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${SVELTIA.tarball}`);
    const files = extractVendored(Buffer.from(await response.arrayBuffer()));
    fs.rmSync(TARGET, { recursive: true, force: true });
    const hashes = {};
    for (const [relative, data] of files) {
      const file = path.join(TARGET, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data);
      hashes[relative] = sha256(data);
    }
    fs.writeFileSync(LOCK, `${JSON.stringify({ ...SVELTIA, files: hashes }, null, 2)}\n`);
    console.log(`Vendored ${SVELTIA.name}@${SVELTIA.version}: ${files.size} files in ${TARGET}/.`);
  }

  if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    if (process.argv.includes("--check")) {
      const problems = verifyVendored(".");
      if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
      else console.log(`Vendored ${SVELTIA.name}@${SVELTIA.version} matches ${LOCK}.`);
    } else await vendor();
  }
  ```
  In `package.json`, after `"uploads:variants": "node scripts/build-upload-variants.mjs"` add a comma and `"cms:vendor": "node scripts/vendor-sveltia.mjs"`.

- [ ] **Step 5: Vendor the pinned release.** `cd "$CMS" && npm run cms:vendor && cat scripts/sveltia-cms.lock.json && npm run cms:vendor -- --check`
  Expected (0.230.1, Task 9): `Vendored @sveltia/cms@0.230.1: 3 files in public/admin/sveltia/.`, then exactly this lock, then `Vendored @sveltia/cms@0.230.1 matches scripts/sveltia-cms.lock.json.`
  ```json
  {
    "name": "@sveltia/cms",
    "version": "0.230.1",
    "tarball": "https://registry.npmjs.org/@sveltia/cms/-/cms-0.230.1.tgz",
    "integrity": "sha512-2iTmW3txB2ocqzEO6b/hkr9Txbw+AFMfmmmqarY3B0WrG5eikwXwYwFWB5CGoQMz1JT5RvcVnKINAWBcVfVRMg==",
    "files": {
      "LICENSE.txt": "dcbe3c626d85741f6fabefed0b34d07a2e92c032f63aa21c0279062363859c32",
      "chunks/react-dom.js": "9b5ffe4f9241b1885d9da326f3401e9727d628bfbecb0cb32b027cda25d5bfeb",
      "sveltia-cms.js": "d3eff7b0ba761ee1d06e9f581304075a575757de4cbd7ec1179b95873f6f4fc7"
    }
  }
  ```
  Sizes (0.230.1, source map comments removed): `sveltia-cms.js` 2,250,499 bytes, `chunks/react-dom.js` 213,847, `LICENSE.txt` 1,071. (0.250.0 had `sveltia-cms.js` 2,586,436, `chunks/react-dom.js` 213,151, `chunks/git.js` 167,074, `chunks/qrcode.js` 23,497 and a 911-byte `rolldown-runtime`.) An integrity error means the registry served different bytes: stop and report.

- [ ] **Step 6: Write the admin page** `public/admin/index.html`:
  ```html
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex, nofollow" />
      <title>Content · spacegear.tech</title>
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <link rel="cms-config-url" type="application/yaml" href="/admin/config.yml" />
    </head>
    <body>
      <!-- Sveltia CMS, vendored by scripts/vendor-sveltia.mjs. Not linked from the site; see README.md, "Editing content". -->
      <script src="/admin/sveltia/sveltia-cms.js"></script>
    </body>
  </html>
  ```

- [ ] **Step 7: Write the CMS configuration** `public/admin/config.yml` (validated in planning against Sveltia 0.250.0's `schema/sveltia-cms.json` and by the mirror test). **Superseded by the committed file**, which validates against 0.230.1's schema; the block below is the planning draft. The differences are listed under "Amendments", Task 9 (no `auto_increment`, a hidden `order`, the legal `pattern`, `use_emoji_autocomplete: false`, per-format transformations, explicit slug options):
  ```yaml
  # Sveltia CMS configuration for spacegear.tech, served at /admin/config.yml.
  #
  # Today (local): build and start the preview, open http://127.0.0.1:8787/admin/ in Chrome or Edge,
  # choose "Work with Local Repository" and pick the repository folder. Saves write straight into
  # content/ and public/uploads/; rebuild to see them on the preview. See README.md, "Editing content".
  #
  # Every field mirrors a rule in src/lib/content-model.ts (names, order, required, lengths, options,
  # list sizes); tests/cms-config.test.mjs fails when the two drift apart. The build validates every
  # file again and runs the honesty checks (no prices, invented metrics, clients or offices).

  backend:
    name: github
    # The owner-supplied destination, empty until the code is imported. The local workflow never
    # contacts it; README.md explains the GitHub setup (OAuth at /api/auth, Workers Builds).
    repo: SanhVo2023/platform-design-contest
    branch: main

  app_title: spacegear.tech content
  logo:
    src: /icon.svg
  show_preview_links: false
  editor:
    preview: false

  media_folder: public/uploads
  public_folder: /uploads
  media_libraries:
    default:
      config:
        max_file_size: 10485760
        slugify_filename: true
        # Chrome re-encodes uploads as WebP in the browser, which also drops camera metadata (GPS).
        transformations:
          raster_image:
            format: webp
            quality: 85
            width: 2560
            height: 2560
    stock_assets: false

  # The images that shipped before the CMS stay where they are; pick them here or type their path.
  asset_collections:
    - name: site-images
      label: Site images (read only)
      media_folder: public/images
      public_folder: /images
      readonly: true

  slug:
    encoding: ascii
    clean_accents: true
    maxlength: 60

  output:
    json:
      indent_style: space
      indent_size: 2

  collections:
    - name: pages
      label: Site and sections
      label_singular: Block
      icon: web
      description: One file per block of the site. Counts such as 5/5 or 01/03 must match the services and engagements.
      files:
        - name: site
          label: Site identity
          file: content/site.json
          fields:
            - { name: name, label: Site name, widget: string, maxlength: 40 }
            - { name: description, label: Default description, widget: text, maxlength: 200 }
            - name: socialProfiles
              label: Social profiles
              widget: list
              required: false
              max: 8
              field: { name: url, label: Profile address, widget: string, maxlength: 200, pattern: ['^https:\/\/\S+$', "Use a full https:// profile address"] }

        - name: home
          label: "Home: hero"
          file: content/home.json
          fields:
            - name: eyebrow
              label: Eyebrow
              widget: object
              fields:
                - { name: muted, label: Muted part, widget: string, maxlength: 40 }
                - { name: strong, label: Strong part, widget: string, maxlength: 40 }
            - name: headline
              label: Headline
              widget: object
              fields:
                - { name: lead, label: Lead, widget: string, maxlength: 30 }
                - name: verbs
                  label: Verbs (three short words)
                  widget: list
                  min: 3
                  max: 3
                  field: { name: verb, label: Verb, widget: string, maxlength: 6 }
                - { name: tail, label: Tail, widget: string, maxlength: 24 }
            - name: pitch
              label: Pitch
              widget: object
              fields:
                - { name: title, label: Title, widget: string, maxlength: 40 }
                - { name: text, label: Text (one line), widget: string, maxlength: 48 }
            - &link_cta
              name: cta
              label: Button
              widget: object
              fields:
                - &link_label { name: label, label: Label, widget: string, maxlength: 30 }
                - &link_href { name: href, label: Link, widget: string, maxlength: 200, hint: "A site path such as /contact/ or /#faq, or a full https:// address.", pattern: ['^(?:\/(?!\/)[\w.~/#?=&%-]*|https:\/\/[^\s"<>]+)$', "Use a site path such as /contact/ or a full https:// address"] }
            - name: stats
              label: Stats
              hint: The first counts the services, the second counts the engagements and names them.
              widget: list
              min: 2
              max: 2
              fields:
                - { name: value, label: Value, widget: string, maxlength: 4 }
                - { name: unit, label: Unit, widget: string, maxlength: 4, required: false }
                - { name: label, label: Label, widget: string, maxlength: 24 }
                - { name: sub, label: Sub-label, widget: string, maxlength: 40 }
            - name: corner
              label: Featured corner link
              widget: object
              fields:
                - { name: title, label: Title, widget: string, maxlength: 40 }
                - { name: sub, label: Sub-label, widget: string, maxlength: 30 }
                - *link_href
            - { name: scrollHint, label: Scroll hint, widget: string, maxlength: 30 }
            - { name: statement, label: Statement, widget: text, maxlength: 120 }

        - name: sections
          label: Section headers
          file: content/sections.json
          fields:
            - name: work
              label: What We Do
              widget: object
              fields: &section_fields
                - { name: title, label: Title, widget: string, maxlength: 30 }
                - { name: index, label: Index, widget: string, maxlength: 3, pattern: ['^\d{3}$', "Use three digits, such as 004"] }
                - { name: heading, label: Heading, widget: text, maxlength: 140 }
                - { name: description, label: Description, widget: text, maxlength: 160 }
            - { name: services, label: Our Services, widget: object, fields: *section_fields }
            - { name: process, label: Our Process, widget: object, fields: *section_fields }
            - { name: analytics, label: What We Measure, widget: object, fields: *section_fields, hint: "The description must keep saying the figures are illustrative, not client results." }
            - { name: pricing, label: Engagements, widget: object, fields: *section_fields }
            - { name: faq, label: Questions & Answers, widget: object, fields: *section_fields }
            - { name: team, label: Who You Work With, widget: object, fields: *section_fields }
            - { name: testimonials, label: What Our Clients Say, widget: object, fields: *section_fields }
            - { name: labs, label: Spacegear Labs, widget: object, fields: *section_fields }

        - name: work
          label: "Home: What We Do"
          file: content/work.json
          fields:
            - name: featured
              label: Featured service tile
              hint: Its image comes from the service entry.
              widget: object
              fields:
                - { name: label, label: Label, widget: string, maxlength: 30 }
                - { name: name, label: Name, widget: string, maxlength: 30 }
                - &service_slug { name: slug, label: Service, widget: select, options: [digital-transformation, ai-strategy, applied-ai, automation-integration, product-delivery] }
            - name: lineup
              label: Service lineup card
              widget: object
              fields:
                - { name: label, label: Label, widget: string, maxlength: 30 }
                - &count { name: count, label: Count, widget: string, maxlength: 7, hint: "Must match the number of services, such as 5/5.", pattern: ['^\d+\/\d+$', "Use a count such as 5/5"] }
                - { name: title, label: Title, widget: string, maxlength: 60 }
                - { name: text, label: Text, widget: text, maxlength: 200 }
                - { name: footer, label: Footer, widget: string, maxlength: 40 }
            - name: tiles
              label: Service tiles
              hint: Four tiles. Images and links come from the service entries.
              widget: list
              min: 4
              max: 4
              summary: "{{fields.name}}"
              fields:
                - *service_slug
                - { name: name, label: Name, widget: string, maxlength: 30 }
                - { name: desc, label: Description, widget: text, maxlength: 120 }
            - name: assessment
              label: Assessment card
              widget: object
              fields:
                - { name: title, label: Title, widget: string, maxlength: 40 }
                - { name: badge, label: Badge, widget: string, maxlength: 7, hint: "01 over the number of engagements, such as 01/03.", pattern: ['^\d+\/\d+$', "Use a count such as 5/5"] }
                - { name: note, label: Note, widget: string, maxlength: 60 }
                - { name: chip, label: Chip, widget: string, maxlength: 30 }
                - { name: value, label: Value, widget: string, maxlength: 4 }
                - { name: unit, label: Unit, widget: string, maxlength: 6 }
                - { name: progress, label: Progress (%), widget: number, value_type: float, min: 0, max: 100 }
                - { name: cta, label: Button label, widget: string, maxlength: 40 }
                - *link_href

        - name: services-panel
          label: "Home: Our Services panel"
          file: content/services-panel.json
          fields:
            - name: panel
              label: Core services card
              widget: object
              fields:
                - { name: label, label: Label, widget: string, maxlength: 30 }
                - *count
                - { name: title, label: Title, widget: string, maxlength: 80 }
                - { name: text, label: Text, widget: text, maxlength: 200 }
                - { name: line, label: Closing line, widget: string, maxlength: 60 }
                - { name: cta, label: Button label, widget: string, maxlength: 40 }
                - *link_href
            - name: pillars
              label: Service pillars
              hint: One per service. Image and description come from the service entry.
              widget: list
              min: 1
              max: 12
              summary: "{{fields.no}} {{fields.name}}"
              fields:
                - { name: no, label: Number, widget: string, maxlength: 2, pattern: ['^\d{2}$', "Use two digits, such as 03"] }
                - *service_slug
                - { name: name, label: Name, widget: string, maxlength: 30 }
                - { name: tag, label: Tag, widget: string, maxlength: 20 }
                - { name: glyph, label: Glyph, widget: string, maxlength: 2 }

        - name: process
          label: "Home: Our Process"
          file: content/process.json
          fields:
            - &process_steps
              name: steps
              label: Steps
              hint: Each step lists real outputs, never timings.
              widget: list
              min: 1
              max: 8
              summary: "{{fields.step}}: {{fields.name}}"
              fields:
                - { name: step, label: Step label, widget: string, maxlength: 12 }
                - { name: name, label: Name, widget: string, maxlength: 20 }
                - { name: desc, label: Description, widget: text, maxlength: 220 }
                - name: outputs
                  label: Outputs
                  widget: list
                  min: 1
                  max: 6
                  field: { name: output, label: Output, widget: string, maxlength: 40 }
            - name: cta
              label: Call to action
              widget: object
              fields:
                - { name: title, label: Title, widget: string, maxlength: 80 }
                - { name: text, label: Text, widget: text, maxlength: 120 }
                - { name: cta, label: Button label, widget: string, maxlength: 30 }
                - *link_href

        - name: approach
          label: "Page: Approach"
          file: content/approach.json
          fields:
            - *process_steps

        - name: measure
          label: "Home: What We Measure"
          file: content/measure.json
          fields:
            - { name: illustrative, widget: hidden, default: true }
            - name: imageCard
              label: Image card
              hint: This dashboard is an illustrative example. Every card must keep saying illustrative, example or sample.
              widget: object
              fields:
                - &image_field { name: img, label: Image, widget: image, choose_url: true, hint: "Upload a new image, pick one under Site images, or type a path such as /images/suite/neural-net.webp.", pattern: ['^(?!\/uploads\/.*\.svg$)(?!\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*(?:con|prn|aux|nul|com\d|lpt\d)[./])\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)$', "Use a lowercase file name (letters, digits, - or _) ending in .webp, .png, .jpg, .jpeg, .avif or .gif under /images/ or /uploads/ (.svg only under /images/), not a Windows device name such as con or nul"] }
                - { name: accent, label: Accent, widget: string, maxlength: 20 }
                - { name: label, label: Label, widget: string, maxlength: 20 }
            - name: workflow
              label: Workflow card
              widget: object
              fields:
                - { name: title, label: Title, widget: string, maxlength: 30 }
                - { name: sub, label: Sub-title, widget: string, maxlength: 40, hint: "Keep the word illustrative, example or sample." }
                - { name: center, label: Centre value, widget: string, maxlength: 6 }
                - name: segments
                  label: Segments
                  widget: list
                  min: 1
                  max: 6
                  summary: "{{fields.label}}"
                  fields:
                    - { name: label, label: Label, widget: string, maxlength: 24 }
                    - { name: value, label: Value (%), widget: number, value_type: float, min: 0, max: 100 }
                    - { name: color, label: Colour, widget: string, maxlength: 7, pattern: ['^#[0-9a-fA-F]{6}$', "Use a hex colour such as #fa6e43"] }
            - name: stages
              label: Stages
              widget: list
              min: 1
              max: 6
              summary: "{{fields.name}}"
              fields:
                - { name: name, label: Name, widget: string, maxlength: 20 }
                - { name: note, label: Note, widget: string, maxlength: 12 }
                - { name: status, label: Status, widget: string, maxlength: 16 }
                - { name: detail, label: Detail, widget: string, maxlength: 24 }
                - name: hands
                  label: Dial hands (degrees)
                  widget: list
                  min: 2
                  max: 2
                  field: { name: angle, label: Angle, widget: number, value_type: float, min: 0, max: 360 }
            - { name: stagesFooter, label: Stages footer, widget: string, maxlength: 40, hint: "Keep the word illustrative." }
            - name: accuracy
              label: Accuracy card
              widget: object
              fields:
                - { name: label, label: Label, widget: string, maxlength: 30 }
                - { name: value, label: Value, widget: string, maxlength: 6 }
                - { name: unit, label: Unit, widget: string, maxlength: 3, required: false }
                - { name: sub, label: Sub-label, widget: string, maxlength: 24, hint: "Keep the word example." }
            - name: throughput
              label: Throughput card
              widget: object
              fields:
                - { name: title, label: Title, widget: string, maxlength: 24 }
                - { name: sub, label: Sub-title, widget: string, maxlength: 40, hint: "Keep the word example." }
                - name: legend
                  label: Legend
                  widget: list
                  min: 1
                  max: 4
                  fields:
                    - { name: value, label: Value, widget: string, maxlength: 8 }
                    - { name: label, label: Label, widget: string, maxlength: 16 }
            - name: readiness
              label: Readiness card
              widget: object
              fields:
                - { name: title, label: Title, widget: string, maxlength: 30 }
                - { name: sub, label: Sub-title, widget: string, maxlength: 50, hint: "Keep the word example." }
                - { name: score, label: Score, widget: string, maxlength: 4 }
                - { name: scoreLabel, label: Score label, widget: string, maxlength: 24 }
                - name: bars
                  label: Bars
                  widget: list
                  min: 1
                  max: 8
                  summary: "{{fields.label}}"
                  fields:
                    - { name: label, label: Label, widget: string, maxlength: 16 }
                    - { name: v, label: Value (%), widget: number, value_type: float, min: 0, max: 100 }
            - name: coverage
              label: Coverage card
              widget: object
              fields:
                - { name: tag, label: Tag, widget: string, maxlength: 30, hint: "Keep the word example." }
                - { name: value, label: Value, widget: string, maxlength: 8 }
                - { name: label, label: Label, widget: string, maxlength: 30 }
                - { name: progress, label: Progress (%), widget: number, value_type: float, min: 0, max: 100 }
            - name: connectors
              label: Connectors card
              widget: object
              fields:
                - { name: tag, label: Tag, widget: string, maxlength: 30 }
                - name: glyphs
                  label: Glyphs
                  widget: list
                  min: 1
                  max: 8
                  field: { name: glyph, label: Glyph, widget: string, maxlength: 2 }
            - name: ticker
              label: Ticker
              widget: list
              min: 1
              max: 16
              field: { name: item, label: Item, widget: string, maxlength: 40 }
            - *link_cta

        - name: engagements-panel
          label: "Home: Engagements footer"
          file: content/engagements-panel.json
          fields:
            - name: footer
              label: Footer link
              widget: object
              fields:
                - { name: text, label: Text, widget: string, maxlength: 80 }
                - *link_href

        - name: faq-card
          label: "Home: Questions card"
          file: content/faq-card.json
          fields:
            - { name: title, label: Title, widget: string, maxlength: 40 }
            - { name: text, label: Text, widget: text, maxlength: 200 }
            - { name: cta, label: Button label, widget: string, maxlength: 30 }
            - *link_href
            - *image_field
            - &image_alt { name: imgAlt, label: Image description, widget: string, maxlength: 120, required: false, hint: "Describe the image for screen readers; leave empty if it is decorative." }
            - { name: badge, label: Badge, widget: string, maxlength: 60 }

        - name: team
          label: "Home: Who You Work With"
          file: content/team.json
          fields:
            - { name: label, label: Label, widget: string, maxlength: 30 }
            - *link_cta
            - name: founder
              label: Founder card
              hint: Add only a real person with their own photo and bio. The card then leads the carousel.
              widget: object
              required: false
              fields:
                - { name: name, label: Name, widget: string, maxlength: 40 }
                - { name: role, label: Role, widget: string, maxlength: 20 }
                - *image_field
                - *image_alt
                - name: links
                  label: Profile links
                  widget: list
                  required: false
                  max: 4
                  fields:
                    - *link_label
                    - *link_href
                - { name: bio, label: Bio, widget: text, maxlength: 240 }

        - name: footer
          label: Footer
          file: content/footer.json
          fields:
            - { name: badge, label: Badge, widget: string, maxlength: 60 }
            - { name: tagline, label: Tagline, widget: string, maxlength: 80 }
            - name: identity
              label: Identity lines
              widget: list
              min: 1
              max: 3
              field: { name: line, label: Line, widget: string, maxlength: 30 }
            - { name: identityStrong, label: Identity name, widget: string, maxlength: 30 }
            - name: columns
              label: Link columns
              widget: list
              min: 1
              max: 3
              field:
                name: links
                label: Links
                widget: list
                min: 1
                max: 12
                summary: "{{fields.label}}"
                fields:
                  - *link_label
                  - *link_href
            - name: quickStart
              label: Quick start form
              widget: object
              fields:
                - { name: title, label: Title, widget: string, maxlength: 40 }
                - { name: text, label: Text, widget: text, maxlength: 100 }
                - { name: note, label: Note, widget: string, maxlength: 80 }
            - { name: about, label: About line, widget: text, maxlength: 120 }

    - name: services
      label: Services
      label_singular: Service
      icon: design_services
      description: The five services. Each has its own page, so services cannot be added or removed here.
      folder: content/services
      extension: json
      format: json
      identifier_field: name
      create: false
      delete: false
      duplicate: false
      reorder: true
      sortable_fields: { fields: [order, name], default: { field: order } }
      fields:
        - { name: slug, label: Slug, widget: string, maxlength: 40, readonly: true, hint: "Part of the page address. It must match the file name.", pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', "Use lowercase letters, digits and single hyphens"] }
        - { name: name, label: Name, widget: string, maxlength: 60 }
        - { name: shortName, label: Short name, widget: string, maxlength: 40 }
        - { name: category, label: Category, widget: string, maxlength: 20 }
        - { name: image, label: Image, widget: image, choose_url: true, hint: "Shown wherever the service appears.", pattern: ['^(?!\/uploads\/.*\.svg$)(?!\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*(?:con|prn|aux|nul|com\d|lpt\d)[./])\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)$', "Use a lowercase file name (letters, digits, - or _) ending in .webp, .png, .jpg, .jpeg, .avif or .gif under /images/ or /uploads/ (.svg only under /images/), not a Windows device name such as con or nul"] }
        - { name: summary, label: Summary, widget: text, maxlength: 160 }
        - { name: buyerProblem, label: Buyer problem, widget: text, maxlength: 320 }
        - name: deliverables
          label: Deliverables
          widget: list
          min: 1
          max: 8
          field: { name: deliverable, label: Deliverable, widget: string, maxlength: 100 }
        - name: process
          label: Process
          widget: list
          min: 1
          max: 6
          field: { name: step, label: Step, widget: string, maxlength: 100 }
        - name: faqs
          label: Questions
          widget: list
          min: 1
          max: 6
          summary: "{{fields.question}}"
          fields:
            - { name: question, label: Question, widget: string, maxlength: 80 }
            - { name: answer, label: Answer, widget: text, maxlength: 300 }
        - { name: relatedInsightSlugs, widget: hidden, default: [] }
        - &order { name: order, label: Order, widget: number, value_type: int, min: 1, max: 999, auto_increment: true, hint: "Position in lists; drag entries in the list view to reorder." }

    - name: engagements
      label: Engagements
      label_singular: Engagement
      icon: handshake
      description: The three ways to engage. Exactly one is featured; no prices or durations.
      folder: content/engagements
      extension: json
      format: json
      identifier_field: name
      create: false
      delete: false
      duplicate: false
      reorder: true
      sortable_fields: { fields: [order, name], default: { field: order } }
      fields:
        - { name: name, label: Name, widget: string, maxlength: 40 }
        - { name: short, label: Short name, widget: string, maxlength: 12, hint: "The hero's second stat lists these short names." }
        - *image_field
        - { name: stage, label: Stage, widget: string, maxlength: 20 }
        - { name: stageNo, label: Stage number, widget: string, maxlength: 2, pattern: ['^\d{2}$', "Use two digits, such as 02"] }
        - name: deliverables
          label: Deliverables
          widget: list
          min: 3
          max: 6
          field: { name: deliverable, label: Deliverable, widget: string, maxlength: 60 }
        - name: outcomes
          label: Outcomes
          widget: list
          min: 3
          max: 6
          field: { name: outcome, label: Outcome, widget: string, maxlength: 60 }
        - { name: featured, label: Featured, widget: boolean, default: false, hint: "Exactly one engagement is featured." }
        - *order

    - name: faqs
      label: Questions & Answers
      label_singular: Question
      icon: help
      folder: content/faqs
      extension: json
      format: json
      identifier_field: question
      slug: "{{question}}"
      reorder: true
      sortable_fields: { fields: [order, question], default: { field: order } }
      fields:
        - { name: question, label: Question, widget: string, maxlength: 100 }
        - { name: answer, label: Answer, widget: text, maxlength: 400 }
        - *order

    - name: team-roles
      label: Team disciplines
      label_singular: Discipline
      icon: groups
      description: Disciplines, not people. Role cards never name or link to individuals.
      folder: content/team-roles
      extension: json
      format: json
      identifier_field: name
      slug: "{{name}}"
      reorder: true
      sortable_fields: { fields: [order, name], default: { field: order } }
      fields:
        - { name: name, label: Discipline, widget: string, maxlength: 40 }
        - { name: role, label: Role, widget: string, maxlength: 20 }
        - *image_field
        - *image_alt
        - { name: links, widget: hidden, default: [] }
        - { name: bio, label: Description, widget: text, maxlength: 240 }
        - *order

    - name: testimonials
      label: Testimonials
      label_singular: Testimonial
      icon: format_quote
      description: Real quotes only. A quote renders only after its permission box is ticked.
      folder: content/testimonials
      extension: json
      format: json
      identifier_field: name
      slug: "{{company}}-{{name}}"
      summary: "{{name}}, {{company}}"
      reorder: true
      sortable_fields: { fields: [order, name], default: { field: order } }
      fields:
        - { name: img, label: Photo, widget: image, choose_url: true, hint: "The client's own approved photo, uploaded here.", pattern: ['^(?!\/uploads\/.*\.svg$)(?!\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*(?:con|prn|aux|nul|com\d|lpt\d)[./])\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)$', "Use a lowercase file name (letters, digits, - or _) ending in .webp, .png, .jpg, .jpeg, .avif or .gif under /images/ or /uploads/ (.svg only under /images/), not a Windows device name such as con or nul"] }
        - { name: name, label: Name, widget: string, maxlength: 60 }
        - { name: role, label: Role, widget: string, maxlength: 60 }
        - { name: company, label: Company, widget: string, maxlength: 80 }
        - { name: quote, label: Quote, widget: text, maxlength: 400 }
        - { name: permissionConfirmed, label: The client gave written permission to publish this quote, widget: boolean, default: false }
        - *order

    - name: articles
      label: Articles
      label_singular: Article
      icon: article
      description: Published articles that the Labs section links to.
      folder: content/articles
      extension: json
      format: json
      identifier_field: title
      slug: "{{slug}}"
      reorder: true
      sortable_fields: { fields: [order, title], default: { field: order } }
      fields:
        - { name: slug, label: Slug, widget: string, maxlength: 60, pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', "Use lowercase letters, digits and single hyphens"] }
        - { name: author, label: Author, widget: string, maxlength: 60 }
        - { name: title, label: Title, widget: string, maxlength: 120 }
        - { name: sub, label: Summary, widget: text, maxlength: 200 }
        - { name: img, label: Image, widget: image, choose_url: true, hint: "The article's own image, uploaded here.", pattern: ['^(?!\/uploads\/.*\.svg$)(?!\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*(?:con|prn|aux|nul|com\d|lpt\d)[./])\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)$', "Use a lowercase file name (letters, digits, - or _) ending in .webp, .png, .jpg, .jpeg, .avif or .gif under /images/ or /uploads/ (.svg only under /images/), not a Windows device name such as con or nul"] }
        - *link_href
        - *order

    - name: legal
      label: Legal pages
      icon: gavel
      description: The preview notice and the contact section are added by the site from its settings.
      files:
        - name: privacy
          label: Privacy
          file: content/legal/privacy.md
          fields:
            - &legal_body { name: body, label: Sections, widget: text, hint: "Start each section with a line '## Heading', then plain paragraphs separated by blank lines. No other formatting." }
        - name: terms
          label: Website terms
          file: content/legal/terms.md
          fields:
            - *legal_body
  ```
  Notes: the patterns are the `source` of the schema regexes (`SLUG`, `HREF`, `IMAGE`, `COLOR`, the count and digit patterns), and Sveltia compiles them with `new RegExp(source)` (no flags), so they behave the same in the editor and in the build. A `.md` file whose only field is `body` is saved without front matter (Sveltia data-output docs). Plain `text` widgets avoid the rich-text editor and the libraries it lazy-loads from unpkg.

  **Upload names and formats (from the Task 7 review).** Settle these three points in this task and record each decision under "Amendments":
  1. **Characters that `slugify_filename` keeps.**
     - Sveltia's ASCII slugify keeps `~`, so `scan~2.webp` is saved as is. `UPLOAD_PATH` (`scripts/lib/uploads.mjs`) then fails the build with "rename it".
     - Check in Chrome which characters survive an upload. Try `scan~2.webp`, and a name with `I`/`ı` under a Turkish browser locale, where lowercasing differs.
     - The README's rename advice (Task 11 Step 1) must name `~` and the Turkish dotless `ı` as characters to remove before uploading.
  2. **`raster_image` and animation.** `transformations.raster_image` re-encodes GIF and WebP uploads through a canvas, so an animated upload becomes a still image before the build sees it. The build itself keeps animated WebP and GIF. Choose one:
     - **Per-format keys** (`jpeg`, `png`, `avif` only): GIF and WebP uploads keep their animation, but WebP originals then keep their EXIF/GPS metadata. Only the generated variants drop it, and the original ships too.
     - **Keep `raster_image`:** accept that animations become stills, and say so in the README.
  3. **`filename_template`.** The variant cache reserves no upload names, so `filename_template: "{{filename}}-{{uuid_short}}"` is not needed to avoid `-640`/`-1280` names. Add it only if unique file names are wanted, for example so that re-uploading `photo.jpg` never replaces the earlier file, and record why.

- [ ] **Step 8: Run the tests and see them pass.** `cd "$CMS" && node --import tsx --test tests/admin.test.mjs tests/cms-config.test.mjs` → `# pass 7`, `# fail 0`.

- [ ] **Step 9: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass (ESLint does not lint `public/`).

- [ ] **Step 10: Commit.** Check that git stored the vendored files without conversion: `git add` then `git ls-files --eol public/admin/sveltia | head -3` shows `attr/-text -diff`.
  ```bash
  cd "$CMS" && git add .gitattributes scripts/vendor-sveltia.mjs scripts/sveltia-cms.lock.json public/admin package.json package-lock.json tests/admin.test.mjs tests/cms-config.test.mjs && git ls-files --eol public/admin/sveltia | head -3 && git commit -m "feat(cms): vendor Sveltia CMS 0.230.1 and add the /admin page and CMS configuration" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 10: Admin headers, packaging and checks

**Files:**
- Modify: `public/_headers`, `scripts/package-site.mjs`, `scripts/check-export.mjs`, `scripts/check-seo.mjs`, `scripts/browser-check.mjs`
- Test: `tests/admin.test.mjs` (extend)

- [ ] **Step 1: Write the failing header tests.** Append to `tests/admin.test.mjs`:
  ```js
  // Mirrors the Cloudflare _headers format: "/path" lines open a rule, "  Name: value" sets, "  ! Name" removes.
  function headerRules(text) {
    const rules = new Map();
    let rule = null;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (!/^\s/.test(line)) {
        rule = { set: {}, unset: [] };
        rules.set(line.trim(), rule);
      } else if (line.trim().startsWith("! ")) rule.unset.push(line.trim().slice(2).toLowerCase());
      else {
        const [, name, value] = line.trim().match(/^([^:]+):\s*(.+)$/);
        rule.set[name.trim().toLowerCase()] = value.trim();
      }
    }
    return rules;
  }
  const directives = (csp) => Object.fromEntries(csp.split(";").map((part) => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));

  test("/admin/* swaps the site CSP for its own scoped policy and is noindex", () => {
    const rules = headerRules(fs.readFileSync("public/_headers", "utf8"));
    const paths = [...rules.keys()];
    assert.ok(rules.has("/admin/*") && paths.indexOf("/*") < paths.indexOf("/admin/*"), "the admin rule comes after /* so its removals apply");
    const admin = rules.get("/admin/*");
    assert.deepEqual(admin.unset.sort(), ["content-security-policy", "x-robots-tag"]);
    assert.equal(admin.set["x-robots-tag"], "noindex, nofollow");
    const csp = directives(admin.set["content-security-policy"]);
    assert.deepEqual(csp["script-src"], ["'self'"], "only the vendored bundle: no inline code, no eval, no CDN");
    assert.deepEqual(csp["font-src"], ["'self'", "https://cdn.jsdelivr.net/fontsource/"], "the bundle's UI and icon fonts");
    assert.deepEqual(csp["connect-src"], ["'self'", "blob:", "data:"], "no API or CDN until the GitHub setup");
    for (const [name, values] of Object.entries(csp)) assert.ok(!values.some((value) => /unpkg\.com|'unsafe-eval'|^\*$|^https:$/.test(value)), `${name} allows no CDN code, eval or wildcard`);
    assert.deepEqual([csp["object-src"], csp["frame-ancestors"], csp["base-uri"]], [["'none'"], ["'none'"], ["'self'"]]);
  });

  test("the site CSP gains nothing from the CMS", () => {
    const site = headerRules(fs.readFileSync("public/_headers", "utf8")).get("/*").set["content-security-policy"];
    assert.doesNotMatch(site, /jsdelivr|unpkg|api\.github\.com|'unsafe-eval'/);
  });
  ```
  Run: `cd "$CMS" && node --import tsx --test tests/admin.test.mjs` → the `/admin/*` test fails (`the admin rule comes after /*…`).

- [ ] **Step 2: Add the admin rule.** Append to `public/_headers` (after the `/api/*` rule; keep one blank line before it):
  ```
  # >>> CMS (showcase Part 3): /admin/ runs the vendored Sveltia CMS. It swaps the site CSP for its own
  # and is never indexed. Each directive is explained in README.md, "The admin Content-Security-Policy".
  /admin/*
    ! Content-Security-Policy
    ! X-Robots-Tag
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' https://cdn.jsdelivr.net/fontsource/; connect-src 'self' blob: data:; media-src 'self' blob:; frame-src blob:; manifest-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
    X-Robots-Tag: noindex, nofollow
  # <<< CMS
  ```
  The `/*` rule is not touched. `X-Robots-Tag` is removed and set again so the preview's packaging-time `noindex, nofollow` on `/*` is not doubled. A planning simulation of the asset worker's header logic gave, in both preview and production mode: `/admin/` → admin CSP only, `X-Robots-Tag: noindex, nofollow`, `X-Frame-Options: DENY` kept; `/` and `/privacy/` → the site CSP unchanged.
  Run: `cd "$CMS" && node --import tsx --test tests/admin.test.mjs` → `# pass 4`.

- [ ] **Step 3: Ship `/admin/`.** **Changed in Task 7:** `shipFolder` and the line `await shipFolder("uploads");` do not exist. Task 7 ships uploads with `shipUploads` (scripts/lib/uploads.mjs), which only copies upload images and their variants, so it cannot ship `/admin/`. In `scripts/package-site.mjs`, inside the CMS block, directly after the line that starts with ``console.log(`Uploads shipped:``, add:
  ```js
  try{await fs.access("out/admin");}catch{throw new Error("out/admin is missing: public/admin/ must be exported with the site.");}
  await fs.cp("out/admin",path.join(target,"admin"),{recursive:true,filter:file=>!path.basename(file).startsWith(".")});
  ```
  `/admin/` holds only committed files (the page, `config.yml` and the hash-locked Sveltia files; editors cannot add files there), so copying it from `out/` as planned is fine. Dotfiles are skipped as before. Also update the CMS block's comment to mention `/admin/`.

- [ ] **Step 4: Check the shipped admin.** In `scripts/check-export.mjs`, inside the CMS block, after the line `await scanUploads(root);` add:
  ```js
  const sveltiaLock=JSON.parse(await fs.readFile("scripts/sveltia-cms.lock.json","utf8"));
  for(const file of ["admin/index.html","admin/config.yml",...Object.keys(sveltiaLock.files).map(name=>`admin/sveltia/${name}`)])await fs.access(path.join(root,file)).catch(()=>errors.push(`Missing CMS file: ${file}`));
  const adminHtml=await fs.readFile(path.join(root,"admin/index.html"),"utf8").catch(()=>"");
  if(!adminHtml.includes('<meta name="robots" content="noindex'))errors.push("admin/index.html must carry a robots noindex meta tag");
  if(/<script(?![^>]*\ssrc=)[^>]*>/.test(adminHtml))errors.push("admin/index.html must not use inline scripts (its CSP allows script-src 'self' only)");
  if(!/^\/admin\/\*\r?$/m.test(await fs.readFile(path.join(root,"_headers"),"utf8")))errors.push("dist/_headers has no /admin/* rule");
  ```
  The existing scans already cover the admin files: the old-identity scan reads the vendored JS (0.230.1 contains none of those strings, nor does `config.yml` or `index.html`; checked in Task 9), and `admin/index.html`'s only local reference, `/icon.svg`, ships.

- [ ] **Step 5: Assert noindex and no links in the SEO crawl.** In `scripts/check-seo.mjs`, insert before the line `  for (const path of [...links, ...assets]) assert.equal(`:
  ```js
    // >>> CMS (showcase Part 3): /admin/ is for editors only: never in the sitemap, never linked, always noindex.
    assert.ok(!routes.some(route => route.startsWith("/admin")), "the sitemap must not list /admin/");
    assert.ok(![...links].some(link => link.startsWith("/admin")), "no page may link to /admin/");
    const admin = await fetch(new URL("/admin/", base));
    assert.equal(admin.status, 200, "/admin/ is served");
    assert.match(admin.headers.get("x-robots-tag") || "", /noindex/, "/admin/ sends X-Robots-Tag: noindex in every publication mode");
    assert.match(await admin.text(), /<meta name="robots" content="noindex/, "/admin/ carries a robots noindex meta tag");
    // <<< CMS
  ```
  `robots.txt` is unchanged on purpose: crawlers must be able to fetch `/admin/` to see its `noindex`.

- [ ] **Step 6: Browser checks.** In `scripts/browser-check.mjs`:
  1. Directly after the line `assert.ok(homeHeaders.has("x-content-type-options"), "/ serves X-Content-Type-Options");` insert:
     ```js
     // >>> CMS (showcase Part 3): /admin/ gets its own CSP and noindex; every site page keeps the site CSP.
     const headerRules = new Map();
     {
       let rule = null;
       for (const line of (await fs.readFile("public/_headers", "utf8")).split(/\r?\n/)) {
         if (!line.trim() || line.trim().startsWith("#")) continue;
         if (!/^\s/.test(line)) { rule = {}; headerRules.set(line.trim(), rule); continue; }
         const header = line.trim().match(/^([^!:\s][^:]*):\s*(.+)$/);
         if (rule && header) rule[header[1].trim().toLowerCase()] = header[2].trim();
       }
     }
     const siteCsp = headerRules.get("/*")?.["content-security-policy"];
     const adminCsp = headerRules.get("/admin/*")?.["content-security-policy"];
     assert.ok(siteCsp && adminCsp && siteCsp !== adminCsp, "public/_headers defines the site CSP and a separate /admin/* CSP");
     for (const route of routes) assert.equal((await fetch(new URL(route, base))).headers.get("content-security-policy"), siteCsp, `${route}: serves exactly the site CSP`);
     const adminResponse = await fetch(new URL("/admin/", base));
     assert.equal(adminResponse.status, 200, "/admin/ is served");
     assert.equal(adminResponse.headers.get("content-security-policy"), adminCsp, "/admin/ serves its own CSP instead of the site's");
     assert.equal(adminResponse.headers.get("x-robots-tag"), "noindex, nofollow", "/admin/ is noindex over HTTP");
     assert.match(await adminResponse.text(), /<meta name="robots" content="noindex/, "/admin/ is noindex in its HTML");
     // <<< CMS
     ```
  2. Insert before the line `  await fs.writeFile("artifacts/browser-report.json", JSON.stringify(report, null, 2));`:
     ```js
       // >>> CMS (showcase Part 3): the vendored Sveltia CMS boots at /admin/ under its own CSP.
       {
         const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
         const blocked = [], pageErrors = [];
         await context.exposeBinding("__adminCsp", (_source, entry) => blocked.push(entry));
         await context.addInitScript(() => document.addEventListener("securitypolicyviolation", e => window.__adminCsp?.(`${e.effectiveDirective} blocked ${e.blockedURI || "(inline)"}`)));
         const admin = await context.newPage();
         admin.on("pageerror", error => pageErrors.push(error.message));
         await admin.goto(`${base}/admin/`, { waitUntil: "load" });
         await admin.getByRole("button", { name: /Work with Local Repository|Sign In with GitHub/ }).first().waitFor({ timeout: 30000 });
         await admin.waitForTimeout(1000);
         // Sveltia asks unpkg.com whether a newer release exists; the admin CSP blocks that optional request on purpose.
         const unexpected = blocked.filter(entry => !/^connect-src blocked https:\/\/unpkg\.com\//.test(entry));
         assert.deepEqual(unexpected, [], "/admin/: the CMS loads everything it needs under its CSP");
         assert.deepEqual(pageErrors, [], "/admin/: no page errors");
         await admin.screenshot({ path: "artifacts/admin.png" });
         report.interactions.push(`/admin/: Sveltia CMS sign-in renders under its scoped CSP (${blocked.length} optional unpkg request(s) blocked by design)`);
         await context.close();
       }
       // <<< CMS
     ```
  The `en-US` locale keeps the check deterministic (other locales fetch UI strings from unpkg). Sveltia stops with an error screen on an invalid configuration, so the button wait also proves `config.yml` loads.

- [ ] **Step 7: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass.

- [ ] **Step 8: Heavy gates.**
  ```bash
  bash "$WT" "$CMS" 8788 rebuild
  curl -sI http://127.0.0.1:8788/admin/ | grep -iE "^(content-security-policy|x-robots-tag):"
  curl -sI http://127.0.0.1:8788/ | grep -iE "^content-security-policy:"
  bash "$WT" "$CMS" 8788 run npm run check:seo -- http://127.0.0.1:8788
  bash "$WT" "$CMS" 8788 run npm run test:browser -- http://127.0.0.1:8788
  cd "$CMS" && node scripts/html-snapshot.mjs compare artifacts/html-baseline
  ```
  Expected:
  - Rebuild ends with `Export valid: 12 core pages, …` (the CMS checks pass) and the preview starts.
  - `/admin/` shows `content-security-policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; …` and `x-robots-tag: noindex, nofollow`; `/` shows the unchanged site policy (`… 'wasm-unsafe-eval' https://challenges.cloudflare.com; …`).
  - `SEO crawl passed: 12 pages, …`.
  - `Browser checks passed: 6 profiles; …`; `artifacts/admin.png` shows the Sveltia sign-in screen with "Work with Local Repository" and real icons (not icon names as text).
  - `New pages (not in the snapshot): admin/index.html` and `Rendered HTML identical to artifacts/html-baseline: 15 pages.`

- [ ] **Step 9: Real-browser check (controller or owner, in Chrome on the desktop).** Open `http://127.0.0.1:8788/admin/`, choose **Work with Local Repository**, select `E:\Personal\clone website\spacegear-cms`. Expected: the collections "Site and sections", "Services", "Engagements", "Questions & Answers", "Team disciplines", "Testimonials", "Articles" and "Legal pages" are listed; "Questions & Answers" shows eight entries in site order; DevTools shows no CSP errors other than the blocked unpkg update check. Edit one FAQ answer, save, run `git -C "E:/Personal/clone website/spacegear-cms" diff --stat content/faqs` (one file changed), then revert with `git -C "E:/Personal/clone website/spacegear-cms" checkout -- content/faqs`. (Automation cannot pick a folder in the native dialog, so this step is manual.)

- [ ] **Step 10: Commit.**
  ```bash
  cd "$CMS" && git add public/_headers scripts/package-site.mjs scripts/check-export.mjs scripts/check-seo.mjs scripts/browser-check.mjs tests/admin.test.mjs && git commit -m "feat(cms): serve /admin with its own CSP and noindex, package it and check it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 11: Documentation and final gates

**Files:** Modify `README.md`, `docs/operations/cloudflare-release.md`

- [ ] **Step 1: README.** Replace the bullet `- [Content](src/lib/content.ts): services, engagements, FAQs and illustrative use cases.` with `- [Content](content/): all copy as JSON and Markdown, edited through the CMS at /admin/ (see "Editing content"). [src/lib/content.ts](src/lib/content.ts) loads and validates it.` Then insert this section before `## Content and release`:
  ````markdown
  ## Editing content

  All copy lives in [content/](content/) as JSON and Markdown; images added by editors go to `public/uploads/`. [src/lib/content.ts](src/lib/content.ts) loads and validates those files at build time, so the site never fetches content at run time. The editor at `/admin/` is [Sveltia CMS](https://sveltiacms.app/) 0.230.1, vendored in `public/admin/sveltia/` (no CMS code comes from a CDN). `/admin/` is not linked from the site, is `noindex` and has its own Content-Security-Policy.

  ### Edit locally (today)

  1. Build and start the preview: `npm run build:cf`, then `npm run preview:cf`.
  2. Open http://127.0.0.1:8787/admin/ in Chrome or Edge. The local workflow needs the File System Access API, which Firefox and Safari lack.
  3. Choose **Work with Local Repository** and select this repository's root folder (the one that contains `.git`). In a linked Git worktree the CMS saves files but cannot commit them; commit with Git.
  4. Edit and **Save**. The CMS writes straight into `content/` and `public/uploads/`.
  5. Rebuild (`npm run build:cf`) and restart the preview to see the change. The build regenerates the entry index and the image variants, validates every file and runs the honesty checks; a problem stops the build with a list of the fields to fix.
  6. Review `git diff`, run `npm test` and commit.

  What the build enforces:
  - No prices, invented metrics, clients, press, offices or experience claims, in any field of any content file (`tests/content.test.mjs`, `scripts/check-content.mjs`).
  - The counts on the page (5/5, 01/03, the hero stats) match the services and engagements.
  - A testimonial renders only after its permission box is ticked. Team cards describe disciplines, not people.
  - Services and engagements cannot be added or removed in the CMS: each service has its own page and route lists.
  - Images: upload JPEG, PNG or WebP (not HEIC). Chrome re-encodes uploads as WebP, which drops camera metadata, and the build makes 640 px and 1280 px variants of each one (kept in `.cache/upload-variants/` and shipped next to the upload as `<name>.w640.webp` and `<name>.w1280.webp`; no upload name is reserved). Names use lowercase letters, digits, `-` and `_`: rename a file with any other character, such as `~` or the Turkish dotless `ı`, before uploading it (Task 9 records which characters the CMS keeps). The images that shipped before the CMS stay in `public/images/`: pick them under **Site images** or type their path.
  - Legal pages (`content/legal/*.md`) accept `## ` headings and plain paragraphs only. The preview notice and the contact section come from the site settings.

  If you add, rename or delete an entry file by hand, run `npm run content:index`. The CMS configuration is [public/admin/config.yml](public/admin/config.yml); it mirrors [src/lib/content-model.ts](src/lib/content-model.ts), and `npm test` fails when they drift. The CMS reads `config.yml` from the preview, so rebuild after changing it.

  The CMS interface follows the browser language. Translations other than English come from unpkg.com, which the admin CSP blocks; if the CMS reports a translation error, choose English in its settings.

  #### The admin Content-Security-Policy

  | Directive | Value | Why |
  |---|---|---|
  | `script-src` | `'self'` | The vendored bundle and the chunks it loads next to itself. Sveltia needs no `unsafe-eval` or `unsafe-inline`. |
  | `style-src` | `'self' 'unsafe-inline'` | Sveltia injects its styles at run time. |
  | `font-src` | `'self' https://cdn.jsdelivr.net/fontsource/` | The bundle's `@font-face` rules load its UI and icon fonts from Fontsource on jsDelivr. |
  | `img-src` | `'self' data: blob:` | Previews of new uploads and inline icons. |
  | `connect-src` | `'self' blob: data:` | The configuration and local files. Sveltia's optional update check to unpkg.com is blocked on purpose. |
  | `media-src`, `frame-src`, `manifest-src` | `'self' blob:`, `blob:`, `'self' blob:` | As in Sveltia's CSP guide. |
  | `object-src`, `base-uri`, `form-action`, `frame-ancestors` | `'none'`, `'self'`, `'self'`, `'none'` | Hardening, as on the site. |

  Sources: [Sveltia's CSP guide](https://sveltiacms.app/en/docs/security#setting-up-content-security-policy) and the bundle itself (font URLs, update check, chunk loading). The site's own CSP is unchanged; `public/_headers` removes it for `/admin/*` only.

  To upgrade Sveltia: set `version`, `tarball` and `integrity` in `scripts/vendor-sveltia.mjs` from `npm view @sveltia/cms@<version> dist.tarball dist.integrity`, run `npm run cms:vendor`, then `npm test` and `npm run test:browser`. Check the release notes for new CSP needs.

  ### Edit from GitHub (later)

  Not built yet. Once the code is in the GitHub repository (`SanhVo2023/platform-design-contest`):

  1. **GitHub OAuth App.** Homepage `https://spacegear.tech`, callback `https://spacegear.tech/api/auth/callback`. Store the client ID as a Worker variable `GITHUB_CLIENT_ID` and the secret with `wrangler secret put GITHUB_CLIENT_SECRET --env production`.
  2. **OAuth endpoint in `worker/index.ts`**, before the `/api` 404 fallback (`assets.run_worker_first` already sends `/api/*` to the Worker). [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) implements this flow as a Cloudflare Worker and can be ported:
     - `GET /api/auth?provider=github&site_id=…&scope=repo`: create a random state, store it in an `HttpOnly; Secure; SameSite=Lax` cookie for 10 minutes and redirect to `https://github.com/login/oauth/authorize?client_id=…&scope=repo&state=…`.
     - `GET /api/auth/callback?code=…&state=…`: compare the state with the cookie, exchange the code at `https://github.com/login/oauth/access_token` (POST, `Accept: application/json`) and return a small HTML page. It posts `authorizing:github` to `window.opener`, and when the CMS answers from `https://spacegear.tech` it replies `authorization:github:success:{"provider":"github","token":"…"}` to that origin only. Give the page its own CSP header with a hash for its inline script: `_headers` rules do not apply to Worker responses.
  3. **`public/admin/config.yml`:** add `base_url: https://spacegear.tech` and `auth_endpoint: api/auth` under `backend`.
  4. **Admin CSP:** add `https://api.github.com https://www.githubstatus.com` to `connect-src` and `https://avatars.githubusercontent.com` to `img-src`; update `tests/admin.test.mjs` and the `/admin/` check in `scripts/browser-check.mjs`.
  5. **Cloudflare Workers Builds:** connect the repository and the `main` branch; build command `npm run build:production` with the production variables from [the release runbook](docs/operations/cloudflare-release.md); deploy command `npx wrangler deploy --env production`. Every CMS save is a commit, so it triggers a build; a content error fails the build and the live site keeps the previous version.
  6. **Optional:** protect `/admin/*` with Cloudflare Access. The CMS cannot write without a GitHub login, but Access also hides the page.
  ````
- [ ] **Step 2: Release runbook.** In `docs/operations/cloudflare-release.md`, after the sentence `Fonts and art are self hosted. Turnstile is the only external browser dependency, loaded on configured contact pages.` add ` The editor-only /admin/ page (Sveltia CMS, vendored) also loads its interface fonts from jsDelivr under its own CSP; see README.md, "Editing content".`

- [ ] **Step 3: Final gates.**
  ```bash
  cd "$CMS" && npm run lint && npm run typecheck && npm test && node scripts/vendor-sveltia.mjs --check && node scripts/build-content-index.mjs --check
  cd "$CMS" && node scripts/html-snapshot.mjs compare artifacts/html-baseline
  ```
  Expected: all pass; `Vendored @sveltia/cms@0.230.1 matches scripts/sveltia-cms.lock.json.`; `Content index is up to date.`; the HTML compare result from Task 10 still holds (docs do not change the build, so no rebuild is needed).

- [ ] **Step 4: Commit and hand off.**
  ```bash
  cd "$CMS" && git add README.md docs/operations/cloudflare-release.md && git commit -m "docs(cms): explain local content editing and the later GitHub setup" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -12 && git status --short
  ```
  Expected: 11 new commits on `feat/showcase-cms`, a clean tree. Call Cockpit `submit_progress` (summary, files, next steps: the controller merges after Part 1, see "Merge notes") and `set_task_status` `review`.

---

## Merge notes (for the controller, merging `feat/showcase-cms` after Part 1)

- **`src/lib/content.ts` is rewritten.** If Part 1 changed or added copy there (for example intro text), port the change into the matching `content/*.json` file, extend `content-model.ts` and `config.yml` if a field was added, then update `tests/fixtures/content-v1.json` (and `content-v1.d.ts` for a new export) for that deliberate change only, and record it under "Amendments". `npm test` (round-trip and mirror tests) shows exactly what is missing.
- **Fenced blocks** (`>>> CMS (showcase Part 3)` … `<<< CMS`) in `public/_headers` (end of file), `scripts/package-site.mjs` (before `let headers=`), `scripts/check-export.mjs` (before the last line), `scripts/check-seo.mjs` (before the broken-resource loop), `scripts/browser-check.mjs` (after the `x-content-type-options` assertion, and before the report is written) and `scripts/build-production.mjs` (before `const checks=`). They do not overlap Part 1's expected edits (model/Draco removal in the asset allowlists, globe assertions).
- **`check-export.mjs`'s CMS block reads two things Part 1 owns** (Task 7 review):
  - It drops the excluded-asset rule's errors for uploads by their message prefix, `Excluded source/template asset: uploads/`, because upload names are checked by the upload rules instead. If Part 1 rewords that message, update the prefix.
  - Its letter-case check reads every page, payload and chunk (except `admin/`) for local asset paths, and names any that differ in case from the file that ships. Part 1's own references are covered too; on Windows, `need` alone would accept them.
- **`package.json`:** the `build` line changes (index + variants before check-content); three scripts are added at the end of `scripts`; `js-yaml` is a new devDependency. Re-run `npm install --package-lock-only` after resolving a lockfile conflict.
- **Task 8's ten one-line edits** sit in section components that Part 2 will animate. When Part 2 rewrites one of those `<img>` elements, keep `{...contentImage(x)}` in place of `src={x}` (the Step 1 grep finds any missed site).
- **The site CSP** in `/*` can change independently (for example if Part 1 drops `'wasm-unsafe-eval'` with Draco); the admin rule removes whatever it is. `browser-check` compares each page with the current `/*` value, so no expectation needs updating.
- **HTML baseline across the merge** (Part 1 changes the hero markup on purpose, so the Part 3 baseline does not carry over):
  1. In the main worktree, before merging, save the baseline from Part 1's final build: `git show feat/showcase-cms:scripts/html-snapshot.mjs > artifacts/html-snapshot.mjs && node artifacts/html-snapshot.mjs save artifacts/html-baseline`. The script is not on `feat/spacegear-showcase` yet, and its `save` guard only accepts folders under the `artifacts/` next to the script, so run a copy from `artifacts/`. That folder is gitignored, so the copy cannot block the merge. Also keep that build's chunks for step 2, removing any older copy first: `rm -rf artifacts/dist-pre-merge && mkdir -p artifacts/dist-pre-merge/_next/static && cp -r dist/_next/static/chunks artifacts/dist-pre-merge/_next/static/`.
  2. Merge `feat/showcase-cms`, rebuild, run the heavy gates once, and run `node scripts/html-snapshot.mjs compare artifacts/html-baseline`. **Expect identical, or only `"$module"` changes**:
     - Part 3 is output-neutral and Task 8 is deferred.
     - Turbopack's client module ids are not stable across branches; they shift whenever the module set changes. The Task 6b re-review found that 2 of 28 ids differed between this branch and the main worktree (`Pricing.tsx` 44815 / 89176, `ContactForm.tsx` 26675 / 65254), with byte-identical source and factory code.
     - A page that differs only in ids is listed with each change (export, old id → new id, line). Re-run `node scripts/html-snapshot.mjs compare artifacts/html-baseline --explain-client-ids artifacts/dist-pre-merge`.
     - The ids are **explained** when all of these hold:
       - the pages are identical apart from the ids;
       - each changed id has the same `$client` export name at the same place;
       - its factory code is identical in the two builds apart from module ids;
       - every module id that differs maps one to one to a module that is explained the same way, recursively. Such an id can be the module's own id, which merged factories register as `e.s([...], id)`, an import (`e.i(N)`), or another export registration.

       `--explain-client-ids` checks exactly this and passes only then.
     - **Fallback** if it still refuses an id while the pages are identical apart from ids, and the reason names a module id:
       1. Diff the two factories (`moduleFactory` in `scripts/html-snapshot.mjs`, or the chunks directly).
       2. Confirm that every differing token is a module id and that each maps to a module that is itself the same code.
       3. Record the pairs under "Amendments", or escalate. Any other difference is a real change.
     - `--loose-client-ids` only drops the ids (with a warning), for a first look.
  3. Once the compare passes (identical, or every id change explained), save the baseline again from the merged build and keep it for the remaining work.
- **The format-3 `scripts/html-snapshot.mjs` lands on this branch first** (`b387688`, then `33545bc` after the Task 6b review).
  - The copy that step 1 runs from `artifacts/` is therefore format 3. It compares the markup plus the resolved RSC tree, keeps client module ids, and writes a `.format` marker.
  - `compare` refuses format-1 folders (no marker) and format-2 folders, so save the pre-merge baseline with that copy, not with an older one.
  - If the post-merge compare reports only changed `"$module"` ids (the module set changed), explain them with `--explain-client-ids` as in step 2. Then re-save the baseline.

## Amendments made during execution

(Executors record here every deviation, failed expectation or extra normalization, with the reason.)

- **Task 1, `node_modules`.** The first rebuild failed: `TurbopackInternalError: Symlink [project]/node_modules is invalid, it points out of the filesystem root`. The worktree's own `package-lock.json` makes it Turbopack's root, and the junction pointed to the main worktree's `node_modules`, outside that root. The controller removed the junction and ran `npm ci` in the CMS worktree (452 packages). Install dependencies there with plain `npm install`; the conventions, the research summary, Task 9 Step 1 and risks 2 and 10 now say so. `next.config.ts` is unchanged: a `turbopack.root` on the parent folder also builds, but it changes the `next/font` class hashes (below) and would reach the main worktree with the merge.
- **Task 1, `scripts/html-snapshot.mjs` hardening** (Task 1 review; verified red, then green):
  1. `compare` fails with `<dir> has no saved pages; run save first.` (exit 1) when the snapshot folder is missing or empty, instead of passing with 0 pages.
  2. `save` only replaces a folder strictly inside this worktree's `artifacts/` (resolved path). It refuses `.`, `src`, `dist`, `artifacts` itself and anything outside, with exit 2, before deleting anything.
  3. Without `.next/BUILD_ID`, the build ID comes from the page's own `\"b\":\"…\"` value in the RSC payload (it occurs once per page).
  4. `normalize` turns CRLF into LF first.

  All four are output-neutral: re-saving the baseline with the hardened script gives byte-identical files. A second rebuild with no changes (new build ID) compares identical: `Rendered HTML identical to artifacts/html-baseline: 15 pages.`
- **`next/font` class hashes are deliberately not masked.** Names such as `inter_381028bd-module__L_xBwa__variable` and `mono_14708230-module__eivcfq__variable` derive from the module path relative to Turbopack's root. A trial build with `turbopack.root` on the parent folder changed exactly these two hashes on every page and nothing else. So a baseline is valid only for the project root and `node_modules` layout it was built with. The Task 1 baseline, built after `npm ci`, is byte-identical to the planning snapshot.
- **The normalizer assumes Turbopack's flat chunk names** (`/_next/static/chunks/<name>.js|.css`, `/_next/static/media/<name>.<ext>`, no subfolders; checked in the Task 1 build). The chunk patterns do not match nested paths such as webpack's `chunks/app/…`. A `next build --webpack` build (Task 4's diagnostic retry) therefore cannot be compared with this baseline. If the bundler is ever switched, re-save the baseline from a webpack build of the unchanged source, and re-check the patterns, before comparing.
- **Task 2 review follow-up** (one commit after `7cff37a`; each change seen red, then green). The committed `src/lib/content-schema.ts` and `tests/content-schema.test.mjs` (14 tests) supersede Task 2's code blocks; only the `HREF` and `IMAGE` lines there are kept current.
  1. **Links.** `HREF` refuses protocol-relative `//host`: `^(?:\/(?!\/)[\w.~/#?=&%-]*|https:\/\/[^\s"<>]+)$`. Tests pin these refusals:
     - links: `//host`, `data:`, `JAVASCRIPT:` and `mailto:`. Refusing `mailto:` is deliberate, because the only contact address is `SITE.contactEmail`, which is env-gated;
     - images: `/uploads/../x.webp` and `data:image/svg+xml,…`;
     - numbers: `JSON.parse("1e999")` (Infinity);
     - objects: a `__proto__` key is an unknown field, and nothing is polluted.
  2. **Images.** `IMAGE` now requires:
     - lowercase names: folders and file names use `[a-z0-9_-]` only, so no dots and no uppercase;
     - lowercase extensions;
     - SVG only under `/images/`, because an SVG served from `/uploads/` is an active same-origin document.

     The pattern is `^(?!\/uploads\/.*-(?:640|1280)\.webp$)(?!\/uploads\/.*\.svg$)\/(?:images|uploads)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)$`. Every current image path, in the fixture and in `public/images/`, already fits. The message says what is required: "use a lowercase file name (letters, digits, - or _) ending in .webp, .png, .jpg, .jpeg, .avif or .gif under /images/ or /uploads/ (.svg only under /images/), not a -640 or -1280 variant".
  3. **Optional groups.** The `nullable` JSDoc now says that `false` and `0` count as content, so a group with a boolean or number field is never "not added"; a test covers it. `isEmpty` stops at 64 nested levels with a `ContentError` (`<path>: nested more than 64 levels deep`) instead of a `RangeError`. `check` re-throws that error with the file name and keeps the problems found so far.
  4. **Messages.**
     - Counts read `1 item` / `N items`, and the same for characters.
     - `oneOf` repeats the value: `"x" is not one of: a, b`.
     - A whitespace-only required text says `required`. So does an empty text with `min > 1`, which used to say `needs at least N characters`.
  5. **Length.** Text length counts code points (`[...value].length`), so an emoji is one character.

  **Plan edits:**
  - Task 3's loader tests now expect `"no-such-service" is not one of: ` and `links: 1 item, the limit is 0`.
  - Task 9's `config.yml` has the new `&link_href` pattern, and the new pattern and message in all four image fields. The extracted `config.yml` still parses with js-yaml, and its 12 href and 8 image fields (aliases resolved) equal `HREF.source` and `IMAGE.source`.
  - Task 7's `contentImage("/uploads/logo.svg")` test stays as it is: the helper does not validate, and only the schema refuses that path.

  **For Task 9:**
  1. Check how Sveltia 0.230.1's string widget counts `maxlength` (code points or UTF-16 units). Sveltia is the reference: if it counts UTF-16 units, change `textOf` to match and record that here.
  2. Check that `slugify_filename: true` writes names that `IMAGE` accepts (lowercase ASCII letters, digits, `-`, `_`). If it keeps uppercase or non-ASCII letters, record it here, because the image field would then refuse those uploads with the message above.
- **Task 3 review follow-up** (one commit after `71b6c98`; each change seen red, then green). On the points below, these committed files supersede Task 3's code blocks: `src/lib/content-model.ts`, `scripts/build-content-index.mjs`, `tests/helpers/content.mjs`, `tests/content-loader.test.mjs` and `tests/content-index.test.mjs`.
  1. **Order.** The duplicate-order check skips any entry whose `order` is not a positive whole number (`!Number.isInteger(entry.order) || entry.order < 1`). The schema already reports that entry. So a missing order no longer also says `order undefined is already used by …`.
  2. **Service slugs.** Only a slug that is a string and passes `SLUG` gets the "rename the file" check and joins the slugs that tiles and pillars may name. A malformed slug is reported by the schema alone. A missing slug is never read as `"undefined"`, which `SLUG` would accept.
  3. **Uniqueness rule.** `buildContent` refuses repeated values that the site uses to tell items apart, as React keys and as the selected engagement (`Pricing.tsx` finds it by `name`). Empty and missing values are left to the schema. Each message names the file and the duplicate:
     - **Across a collection:** FAQ `question`, engagement `name` and article `slug`. The later entry in display order is reported, for example `content/faqs/where-to-start.json: question "…" is already used by what-we-do.json; give every entry its own question`.
     - **Within one entry:** a service's `deliverables`, and an engagement's `deliverables` and `outcomes`, for example `content/engagements/build.json: deliverables[3]: "…" repeats deliverables[1]; make every item different`. The review listed only the deliverables. `outcomes` was added because `Pricing.tsx` renders it with the same `<li key={entry}>`.
  4. **Exactly one featured engagement.** Task 9's `config.yml` hint already promises this rule.
     - With none featured: `content/engagements: no engagement is featured; set featured on exactly one`.
     - For every featured entry after the first: `content/engagements/<file>: featured is already set on <first file>; set featured on exactly one engagement`.
  5. **Index command** (`scripts/build-content-index.mjs`):
     - The `.json` extension matches in any case, so `X.JSON` is refused by the name rule instead of being skipped silently.
     - Paths resolve from the script's own location, through the new export `ROOT`, not from the cwd. `ROOT` is also the default `root` of `renderIndex` and `readIndex`.
     - A bad entry name prints as a single line and exits 1, with no stack trace.
     - A new test runs a temporary copy from a folder that has no `content/`. Each run gives the expected result:
       - `--check` passes;
       - after an entry is added, `--check` exits 1 with `Run: npm run content:index`;
       - writing the index brings it up to date;
       - a bad entry name prints only the message.
  6. **`readJson`** (test helper) rethrows a JSON syntax error as `SyntaxError("<file>: <message>")`.
  7. **Ordering test.** It reads the moved FAQ's question from the input instead of the literal.

  The two Task 3 test files now hold 21 tests (14 before). The content files and the generated index are unchanged.
- **Task 6** (`3617bed` for the Task 5 parser follow-ups, `22eda15` for Task 6; review follow-ups `b387688`, `a73e8d0`, `0a39f83`; Task 6b fix round `33545bc`, `e51c260`, `b55a995`). These committed files supersede Task 6's code blocks:
  - `scripts/lib/honesty.mjs`, `scripts/check-content.mjs`, `scripts/lib/project-path.mjs`, `scripts/html-snapshot.mjs`;
  - `tests/content.test.mjs`, `tests/html-snapshot.test.mjs`;
  - from `0a39f83`: `src/lib/content-model.ts`, `src/lib/legal-markdown.ts`, `scripts/build-content-index.mjs`, `tests/legal.test.mjs` and `tests/content-loader.test.mjs`.
  1. **Legal parser** (`3617bed`, `0a39f83`):
     - a `## ` line starts a block even without a blank line before it. The split uses the `m` flag, so `$` means end of line;
     - each problem names the file, the line and the character in context. Every problem is listed in `LegalPageError.issues`;
     - an empty heading reports "the heading is empty". `#` is refused in heading text, and `~~` joins the refused inline syntax;
     - a bare `-`, `=` or `1.` line is refused too;
     - "start the page with a heading" is reported once;
     - `INLINE_SYNTAX` is exported, and the signature is `legalSections(page, root = process.cwd())`;
     - a leading byte order mark is ignored, and the context excerpt never splits a surrogate pair.
  2. **Task 6 carry items** (`22eda15`):
     - `tests/content.test.mjs` held 18 tests, not 17: an extra test runs `check-content` on a temporary copy, from a folder without `content/`;
     - `check-content` runs every check and prints one list (`Content check failed. Fix these problems:`), then exits 1;
     - it validates `content/site.json` with `siteSchema` and the legal pages, uses `ROOT` throughout, and prints Node's absolute paths from the project folder;
     - `buildContent` refuses work tiles that repeat a slug (`Work.tsx` keys tiles by slug) and testimonials that repeat the carousel's `name|company` key;
     - "no engagement is featured" is skipped when an entry's file has no true/false `featured`.
  3. **The +622 B chunk split.** The uniqueness checks added about 0.6 KB to `content-model.ts`, which ships in the client bundle.
     - Turbopack split the root layout's 46,857 B chunk into 11,687 B + 35,792 B. The export went from 155 files to 156.
     - The layout gained one async `["$","script","script-N",…]` element, and React outlined the RSC rows differently, so the row ids shifted.
     - The format-1 snapshot reported all 15 pages changed. The markup and the resolved React tree were identical.
  4. **New gate: format 2** (`b387688`). `html-snapshot.mjs` compares, for each page:
     - the HTML with only the `self.__next_f.push([1,"…"])` scripts removed. JSON-LD, the RSC bootstrap, the noModule polyfill and the chunk tags stay;
     - the RSC tree, resolved from row 0. Text rows are decoded by UTF-8 byte length; `I`/`HL`/`HC`/`E`/`W`/`D` rows and hints are read; `$<hex>`, `$L`, `$@`, `$W` and `$Q` references are resolved; client references are reduced to the export name and async flag; only exact layout chunk-script elements are dropped.

     Unknown reference forms, missing rows and unknown row tags throw.

     **Corrected in format 3 (item 8):**
     - Format 2 walked path references (`$<hex>:k:k`) by raw array keys, so React's own form `"$0:props:children:0:props:data"` threw.
     - It also marked any reference into a row that was being resolved as a cycle, so two same-row references to different targets compared equal.
     - Format 3 resolves paths the way React writes them and marks a cycle only for a containing value.

     Proof of the gate:
     - the synthetic plant tests in `tests/html-snapshot.test.mjs` (8 tests);
     - 10 reviewer plants on real pages (RSC text, markup attributes, HTML-only and RSC-only JSON-LD, an I-row export name, an HL hint, an RSC className, a chunk-script prop, the noModule script). All were caught.

     Baseline migration:
     - `artifacts/html-baseline` was renamed to `artifacts/html-baseline-v1`. It is format 1 and normalized: the build ID, the I-row ids and the chunk names were masked, so it could not be converted.
     - `f1224a3` was rebuilt in a detached checkout; the branch was not moved. That build compared identical to v1 under format 1, 15 pages. Its format-2 snapshot is `artifacts/html-baseline-t5`.
     - The HEAD build compared identical to it under format 2, 15 pages. Only then was `artifacts/html-baseline` saved from HEAD in format 2.

     Later tasks that touch client code must rebuild and compare. The expected result is still `Rendered HTML identical to artifacts/html-baseline: 15 pages.`
  5. **Honesty coverage** (`a73e8d0`):
     - **Folding:** text is folded before scanning: NFKC, then the class `[\u{AD}\u{200B}-\u{200D}\u{2060}\u{FEFF}]` removed. The Task 6b round replaced the class with `\p{Cf}` plus U+034F (item 8).
     - **Decoded JSON:** JSON files were scanned raw and decoded (`scannedText`, `JSON.stringify(JSON.parse(src))`). That kept `\n`, `\t` and `\r` as escapes. Item 8 replaces it with a field-by-field scan of the decoded values.
     - **New patterns:** the reviewer's set (`proposal.mjs`), plus `pounds` and a Unicode-bounded `đồng`. It covers currencies, rates, k/M figures, client and scale counts, percentages, multipliers, founding years and decades, offices, press, partner tiers, ratings and awards, and delivery timelines.
     - **Scopes:**
       - the `%` and k/M rules skip `content/measure.json` and `MEASURE`;
       - the experience and timeline rules skip `content/legal/`;
       - the `AWS` rule skips `content/legal/`, so a listed processor passes.
     - **Per-export scan:** loaded content is scanned export by export (`scanExports`). `check-content` prints `forbidden claim in export <NAME>: …` and `forbidden claim in <file>: …`.
     - **Tests:** all 41 probe claims are caught; 26 ordinary phrases pass; the real tree and the exports have zero hits; the Cloudflare processors named in the legal pages pass in any file.
     - **Still not caught:** HTML entities such as `&#36;` (React renders them as text, and the legal parser refuses entities) and a literal backslash-u text.
  6. **Review minors** (`0a39f83`):
     - `check-content` keeps the stack of a genuine code bug. These stay bare: `issues` lists, `SyntaxError` (a broken `site.json` now throws one), `ERR_MODULE_NOT_FOUND` and `ENOENT`;
     - the index's refused entry names are an `EntryNameError` with `issues`;
     - `fromRoot` is case-insensitive on win32.
  7. **Test counts:** 94 before Task 6, then 107 (`22eda15`), 115 (`b387688`), 119 (`a73e8d0`) and 121 (`0a39f83`).
  8. **Task 6b fix round** (after the second review; each fix turned the reviewer's probe in `scratchpad/t6b-review/` green).
     - **HTML snapshot format 3** (`33545bc`):
       - **Path references** are resolved as React's Flight server writes them:
         - `type`/`key`/`props`/`_owner` name items 1–4 of an `["$",…]` element;
         - a path that walks through another reference follows that reference, with its own path, first;
         - a path through a `$W`/`$Q`/`$@` value throws.
       - **Cycles:** a reference is a cycle only when its row and path contain the value being resolved. Any other reference, also one into the same row, is resolved from the row's raw value.
       - **Client identity:** client references keep their module id (`"$module"`). `compare --loose-client-ids` drops the ids and warns; it is for triaging a changed module set, for example at the merge. Item 9 adds `--explain-client-ids`.
       - **Other changes:** hints are sorted (by their masked form); the build ID is the page's own row-0 `"b"`, and `.next/BUILD_ID` is not read; the dead `I[…]` and escaped chunk-list masks are gone, since the first one also masked markup text.
       - **Format refusal:** `compare` refuses format-1 and format-2 folders.
       - **Tests:** React's real dedupe output, from Next's compiled Flight server inside the test; same-row targets differ; cycles; inner references; both client-swap probes; hint order; markup `I[42,`; the CLI flags. The reviewer's `plants.mjs` gives 0 wrong results, its blind-spot probes are now caught, and `normalize-all.mjs` gives 0 throws.
     - **Baseline chain:**
       1. The reviewer's rebuild of `962ceb8` in `dist/` was confirmed identical to `html-baseline` (renamed `artifacts/html-baseline-v2`) and to `html-baseline-t5` under the saved format-2 script.
       2. The format-3 `artifacts/html-baseline` was saved from that same `dist/`.
       3. After the fixes, the rebuild compared identical under format 3, 15 pages.

       The site output did not change in this round.
     - **Honesty** (`e51c260`):
       - **Decoded fields:** JSON files and exports are scanned as decoded string values, field by field, and problems name their field. Escaped line breaks and tabs no longer hide claims. Object keys are not scanned, because every schema has fixed field names.
       - **Figure groups:** every object with a `value`, `unit`, `label` or `score` is also read as one text: `<value><unit> <score> <label> <scoreLabel> <sub> <title> <note> <tag>`. The real `HOME.stats` ("05 Core services", "03 Ways to engage") pass.
       - **ReDoS:** `(?<![\w.,])` lookbehinds and bounded quantifiers make every pattern linear. The reviewer's 1 MB shapes take 46–73 ms each (before: 8–19 s at 100 KB); 18 more shapes for the new rules take ≤ 73 ms. A 200 KB regression test runs in `npm test`.
       - **False positives fixed:**
         - a "per X" price needs a number;
         - "hundreds/thousands/millions of" needs a client noun;
         - narrow exclusions for "decades-old", "HQ audio", "Our #1 rule", "100% of the code/IP/work" and "4K display".
       - **Scopes:**
         - in `measure.json` and `MEASURE`, only the figure fields (`FIGURE_FIELD`) skip the `%` and k/M rules;
         - in `content/legal/`, only the "N years" and generic period rules and the bare `AWS` rule skip. Founding years, decades, delivery promises ("We deliver every project within 2 weeks") and partner tiers stay refused there.
       - **Folding:** NFKC, then `\p{Cf}` and U+034F are removed. Invisible characters in source are written as `\u{…}` escapes.
       - **New patterns, each with positive and negative tests:**
         - star ratings;
         - ISO/SOC certifications (a bare "ISO 27001" passes);
         - "Fortune N";
         - N-hour/N-day turnarounds;
         - spelled-out client and team counts;
         - client results ("Client satisfaction"), which also closes the dashboard's figure-plus-label gap.
     - **check-content** (`b55a995`):
       - a `SyntaxError` is a content problem only when its message names a `content/` file;
       - a TypeScript syntax error in code keeps its stack and names the `src/lib` module that does not parse (Node's error does not name it);
       - `pathsFromRoot` (`scripts/lib/project-path.mjs`) takes the platform, and a test covers case folding.
     - **Known limitations (documented, not fixed):**
       - Vietnamese phrasing: the site is English-only today; revisit when Vietnamese copy is planned;
       - look-alike letters (Cyrillic "Ѕince") and non-ASCII digits (Arabic-Indic "٤٩٩");
       - HTML entities such as `&#36;`;
       - a literal backslash-u text;
       - a claim split over list items (`["Since", "2012"]`);
       - copy in JSON keys (refused by the schemas anyway);
       - older bypasses: unlisted adjectives ("200 loyal clients"), "200 plus", "1 million users", "10,000 people", "served 120 organisations", "a team of 30" / "30-strong", "five stars on Google", "ISO/IEC 27001", "MVP in a month", "90-day plan".
     - **Test counts:** 126 after `33545bc`, 129 after `e51c260`, 130 after `b55a995`.
  9. **Task 6b re-review** (`d7d808e`, `e7d7a3d`, `deff22e`). Only `scripts/` and tests changed, so no rebuild was needed; the format-3 compare of the existing build stayed identical.
     - **Client module ids across branches:** see the merge notes and the "Rendered output must not change" convention. `compare` now lists the changed ids. `--explain-client-ids <dist of the saved build>` checks the export, the place and the factory code. A factory can serve several ids (`},18140,10542,…,t=>{`).
       - Checked read-only against the main worktree's build: `Pricing` 44815 / 89176 and `ContactForm` 26675 / 65254 have byte-identical factories.
     - **Resolver budget:** at most 1,000,000 resolved values. The 22-level doubling DAG now fails in 0.4 s instead of resolving in 9.6 s.
     - **Honesty, narrower rules:**
       - **Client results:** need a figure next to them, or a stated satisfaction rate. "Analyse customer satisfaction surveys" and "Customers served by your support team" pass; "98% Client satisfaction" and "Customers served: 10,000" do not.
       - **SOC 2:** "SOC 2 report" passes.
       - **Partner claims:** no "and", "or" or comma may sit between the vendor and "partner", and "select" and "preferred" are no longer tiers.
       - **Figures that are not claims:** model sizes ("Llama 3 70B", "7B and 13B parameter models"), "128k context" and "100% remotely" pass.
       - **Still flagged outside the legal pages:** "6–12 weeks" and "within 90 days". Also still flagged: "3 projects" and "2 teams" (digit plus a scale noun).
     - **Title and sub or text:** a group with a title and a sub or text is now read as one phrase, so `{ title: "Trusted by 200", sub: "companies across Asia" }` is caught. This adds no hits on the real tree or the ordinary-phrase list.
     - **check-content:** blames a `src/lib` module only when `stripTypeScriptTypes` fails on it with the same code and message. `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` (enum, namespace) in loaded code gets the file prefix too.
  10. **Task 6b final round** (`82d82f9`, `26f1562`). Only `scripts/` and tests changed, so no rebuild was needed; the format-3 compare stayed identical.
     - **Self ids:** 6 of the 21 client factories register their exports under their own id (`e.s([...], id)`: 10403 Tile, 18140, 60719, 648 ProcessSteps, 71829, 84834), so a pure id shift used to fail `--explain-client-ids`.
       - `explainModule` now compares factories token by token. A differing number counts only as a module reference (after `x.i(`, `x.r(`, `x.A(`… or `],`), and each differing pair must map one to one to a module that is the same, checked recursively. This covers the module's own id and shifted dependencies alike.
       - Reviewer plants (`explain-plants.mjs`): the Tile shift with identical code is now explained. A one-character change, a dependency changed to another module, a component swap, an export rename and a swapped factory are still refused.
       - On the real chunks, every client id explains against its own build, and a consistent shift of Pricing and its dependency 43476 is explained.
     - **Honesty, reopened bypasses closed:**
       - **Model sizes:** excused only as a B/M parameter count right after a model name (with `\b`) and an optional version, never before an audience or revenue noun. "Gemma 1M" therefore passes by design: it has the shape of a model size.
       - **Sizing exclusions:** "parameters"/"models" excuse B sizes only; the context exclusion is the plain "k context window"; "tokens" is no longer excused.
       - **SOC 2:** "our SOC 2 …" and "SOC 2 report available / on request" are caught.
       - **Partners:** "a select partner", "preferred/select partner of|for" and "<Vendor>'s … partner" are caught.
       - **Results:** `honesty-round3.mjs` regressions against `0913b94` went from 17 to 1 ("Gemma 1M"). The reviewer's 1 MB ReDoS shapes take at most 221 ms.
- **Task 7** (`70f1c43`). These committed files supersede Task 7's code blocks: `scripts/build-upload-variants.mjs`, `scripts/lib/uploads.mjs` (new), `scripts/lib/content-assets.mjs`, `tests/uploads.test.mjs` and the fenced blocks. `src/lib/content-images.ts` is as planned. The plan's 7 tests are kept (one assertion added: no temporary file is left), plus 15 new ones; `npm test` went from 133 to 155 tests.
  1. **Shared rules module** `scripts/lib/uploads.mjs`: `WIDTHS`, `RASTER`, `VARIANT`, `variantFile(s)`, `UPLOAD_EXTENSIONS`, `UPLOAD_PATH`, a listing that never follows links, the file-signature check, `uploadProblems` and `shipUploads`. `build-upload-variants.mjs` re-exports the names the plan gives it. `content-assets.mjs` imports from `scripts/lib/` only, so the check-content temp-copy test, which copies `scripts/lib`, still works. `package-site` and `check-export` import the module too.
  2. **Idempotency by modification time, made robust.** Each variant is stamped with its original's mtime (`utimes`) and counts as current only when it is a regular file within 1 ms of that time. The plan's rule ("variant newer than its original") kept stale variants when an original was replaced by a file with an older mtime (`cp -p`, unzip); a test covers that. Variants are written to a temporary dotfile `.<variant>.<pid>.tmp` next to them and renamed into place, so a failed or interrupted run never leaves a partial variant that would count as current. `.gitignore` also ignores `/public/uploads/**/.*.tmp`.
  3. **Decoding.** sharp is loaded only when a variant has to be written, with `sharp.cache(false)`. Settings: `autoOrient: true` (the sharp 0.34 constructor form of `rotate()`); `toColourspace("srgb")` (sharp already converts with the embedded profile and drops it; tests cover Display P3 and CMYK); WebP quality 80; a 120 s timeout; `limitInputPixels: MAX_INPUT_PIXELS`, sharp's own default of 268,402,689 px, set explicitly.
     - The size is read from the header first: `metadata()` with `limitInputPixels: false`, because `metadata()` itself refuses an over-limit header and then gives no size to report. An animated WebP counts every frame.
     - Too large (a decompression bomb claims a huge size), unreadable, truncated: each is a listed problem, never a crash. The other uploads still get variants, and the command exits 1.
  4. **Animations.**
     - An animated WebP gets animated variants (`animated: true`); every frame is kept.
     - A GIF gets no variants and ships as it is; `contentImage()` returns `src` only, as planned.
     - An animated PNG (`acTL` before `IDAT`) and an AVIF sequence (`avis` brand) are refused, because sharp reads only their first frame.
     - An AVIF with several images (a collection, not an animation) uses its first image.
  5. **Names.** The variant step processes only uploads whose path matches `UPLOAD_PATH`: `^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif)$`, the schema's `IMAGE` rule without the `/uploads/` prefix. A test checks that the two agree. Other names (capitals, spaces, `..`, non-ASCII, bidi characters, `[ ]`) get no variants, nothing is written outside the folder, and check-content asks for a rename.
     - A file named like a variant is never an original. With no original it is reported, never processed or deleted. The plan's "(safe to delete)" note is replaced, because it may be a real upload: "delete it if its original was removed, or rename it if it is an upload".
  6. **Links** (symbolic links and junctions) are refused anywhere under `public/uploads/`, dot-named ones included, and so is a linked uploads folder. They are never followed. This matters because `next build` follows links when it copies `public/` into `out/` (`next/dist/lib/recursive-copy.js` calls `stat` on links): a linked file would reach `out/` as a regular file, and a linked folder would be copied whole. File symlinks need developer mode on this Windows machine, so the tests use junctions and skip the file-link case when the OS refuses with `EPERM`.
  7. **`package-site` ships uploads from `public/uploads/`, not `out/uploads/`** (a deviation from the plan's `shipFolder`), for the reason in item 6. `shipUploads` empties `dist/uploads/` first, so a deleted upload never lingers, then copies only regular files that match `UPLOAD_PATH`, variants included. It logs `Uploads shipped: N files.` **Task 10:** `shipFolder` does not exist; ship `/admin/` with its own copy.
  8. **check-content** (from `ROOT`; the plan passed a cwd-relative `"public"`):
     - `uploadProblems` lists: links; anything that is not a regular file; any extension other than the six (SVG, HTML and the rest); names outside `UPLOAD_PATH`; and bytes that do not match the extension (WebP, PNG, JPEG, AVIF and GIF signatures). Dotfiles and dot-folders are exempt; they are never processed or shipped.
     - `imageReferenceProblems` refuses any content string under `/images/` or `/uploads/`, links included, that is not a plain path (`..`, `.`, a dotfile, an empty segment, `%`, `\` or other characters) or that names a `-640`/`-1280` upload variant. Each problem names its place, for example `image path in export FAQ_CARD.img: …`. A refused path is not looked up on disk. The schema already refuses both in image fields; this covers the other fields.
     - `missingImageFiles` is as planned.
  9. **check-export** (fenced): the plan's `scanUploads`, plus `Unsafe upload path …` for a `/./` or `/../` segment, which a browser would resolve elsewhere, and `Not an upload that may ship: uploads/…` for any shipped file outside `UPLOAD_PATH`.
  10. **`tests/content.test.mjs`:** the check-content temp-copy test also copies `public/images/`, because check-content now checks that referenced images exist.
  11. **Results:**
      - `check-content` on the real tree: `Content valid: 12 routes; preview mode.`
      - The build log shows `Upload variants: 0 originals, 0 written, 0 up to date.`, `Uploads shipped: 0 files.` and `Export valid: 12 core pages, 156 files, 11.53 MiB total.`
      - `compare --explain-client-ids`: `Rendered HTML identical to artifacts/html-baseline: 15 pages.` The chunk file names are identical too, because `content-images.ts` has no importer until Task 8. No ids needed explaining, and the baseline was not re-saved.
      - `check:seo` and `test:browser` pass.
      - A final rebuild on `70f1c43` gave the same results; the 8788 preview serves that build.
      - A planted `.svg`, `.html` and junction in `public/uploads/` were refused by the variant step and check-content. A temp-copy package shipped only the image and its variants, and check-export passed. A planted SVG in `dist/uploads/`, a missing upload and a `/../` path were each refused by check-export.
  12. **Time added to a build:** the variant step's process takes 66 ms with no `public/uploads/` and 61 ms with only a `.gitkeep` (median of 9; a bare `node -e ""` takes 50 ms). For 20 noisy 4032 × 3024 JPEGs (155.5 MiB, a worst case for size), the first run takes 8.5 s (40 variants), a re-run with everything current 7 ms, and a re-run after one original changed 390 ms.
  13. **Known limitations:**
      - A hard link cannot be told from a regular file (git does not store hard links).
      - The check-then-copy window in `shipUploads` is not guarded.
      - The variant step decodes by content, so a mislabelled but valid image gets variants; check-content refuses it in the same build.
      - Risk 8 (`1280w` descriptors) is unchanged.
  14. **For Task 9:** an upload whose name is outside `UPLOAD_PATH` now fails the build, not only its image field. Check that `slugify_filename` writes such names.
- **Task 7 review fix round** (`3c21f12`). Where they differ, this supersedes items 2, 5, 7, 8 and 9 of the Task 7 entry above; the committed files supersede everything. The reviewer's probes are in `scratchpad/t7-review/`; the same cases, run against the new API, are in `artifacts/t7/probe-after.mjs`.
  1. **Variants live in a cache, not in `public/uploads/`.** The reviewer found that a real `hero-1280.webp` next to `hero.webp` was silently overwritten and, being gitignored, never committed.
     - **Layout:** variants are written to `.cache/upload-variants/files/<rel>.w640.webp` and `.w1280.webp`, with `manifest.json` beside `files/`. `/.cache/` is gitignored; the three `public/uploads` ignore lines are gone.
     - **Names** keep the original's extension: `photo.jpg.w640.webp`, where the reviewer suggested `photo.w640.webp`. That way `team.jpg` and `team.png` never collide, and the "share a name" error is gone. No upload can have such a name, because upload names have no dot before the extension.
     - **Nothing is reserved.** An upload named `-640`/`-1280` is an ordinary upload: `IMAGE` lost its `-640`/`-1280` lookahead, and the rule "a variant-named file is never an original" is gone. Content may still not point at a `.w640.webp`/`.w1280.webp` name (`imageReferenceProblems`, with its own message); the schema refuses it anyway, because of the dots.
     - **Shipping:** `package-site` calls `shipUploads("public/uploads", dist/uploads, ".cache/upload-variants")`. It copies the originals plus the cached variants whose manifest SHA-1 matches the original's current bytes. URLs stay under `/uploads/`, so Task 10's `/uploads/*` rule covers the variants.
     - **Pruning:** every run deletes, in the cache only, the variants of deleted or failing uploads, foreign files, links (removed, never followed) and a killed run's temporary files. Temporary files go first, even when the run then stops on a problem.
       - A cache folder that is a link or a file is refused.
       - `buildUploadVariants` requires a `cacheDir` for any folder other than `public/uploads/`, so a test can never prune the project's cache.
       - No `.cache/` is created when there is nothing to cache.
     - **`contentImage()`:** `/uploads/x.jpg` → `src` `/uploads/x.jpg.w1280.webp`, plus the srcset. It returns `{ src }` only when `NODE_ENV === "development"`, as `samples.ts` already does, because `next dev` serves only `public/`. This was the one drawback of the cache design: without it, uploads would 404 under `next dev`. Exported markup is unaffected.
     - **Reviewer's probe after the fix:** `hero-1280.webp` is unchanged (1280 × 400), with no errors and `uploadProblems` `[]`. Shipped: `hero-1280.webp`, `hero-1280.webp.w640.webp`, `hero-1280.webp.w1280.webp`, `hero.webp`, `hero.webp.w640.webp` and `hero.webp.w1280.webp`.
  2. **Content hash** (minor 1).
     - The manifest is `{ recipe, uploads: { "<rel>": { sha1, size } } }`. A variant is current only when the SHA-1 matches and the variant is a regular file. A changed `RECIPE` (the encoding) rebuilds everything.
     - There is no mtime pre-check: hashing is cheap enough.
     - **The reviewer's same-mtime probe:** before the fix, 0 written and the variant stayed red, `[254, 0, 1]`. After it, 2 written and `[2, 0, 255]`.
     - **Timing**, 20 × 12 MP JPEGs (4000 × 3000 noise, 150.7 MiB, 7.5 MiB each):
       - SHA-1 of all 20: 145–149 ms;
       - re-run with everything current: 146 ms;
       - one photo changed: 561 ms;
       - packaging, which hashes again: 331 ms;
       - first run: 9.0 s.
     - With no uploads, the step takes 64 ms against 46 ms for a bare `node -e ""` (median of 9).
  3. **Uploads regex** (minor 2): `UPLOAD_REF` is now `(?<![\w.:/%-])\/uploads\/[\w./-]+\.(?:webp|png|jpe?g|avif|gif|svg)(?![\w.-])`, flags `gi`, in `scripts/lib/uploads.mjs`, with tests. On the reviewer's sample, the old regex hit `/uploads/2024/05/case-study.png` (inside an external URL) and `/uploads/a.webp` (truncating `a.webpx`); the new one finds neither.
  4. **The excluded-asset rule** (minor 3): main's line 4 is unchanged. The fenced block drops that rule's `uploads/` errors by their message prefix (see the merge notes). In the plant check, `uploads/earth-4k.webp` and `uploads/galaxy-small-640.webp` shipped and `check-export` passed.
  5. **Windows device names** (minor 4): `con`, `prn`, `aux`, `nul`, `com0`–`com9` and `lpt0`–`lpt9`, as any folder name or file stem, are refused by `UPLOAD_PATH`, `SITE_IMAGE_PATH` and `IMAGE`.
     - `com10`, `icon`, `con-1` and `console/` pass.
     - The list includes `0`, which Windows reserves too; Git's list has 1–9 only.
     - The schema message now ends "not a Windows device name such as con or nul". The `IMAGE` line in Task 2 Step 3 and the four Task 9 `config.yml` image patterns and messages are updated in this plan.
  6. **Letter case** (minor 5):
     - `imageReferenceProblems` requires `/uploads/` paths to match `UPLOAD_PATH`, and `/images/` paths `SITE_IMAGE_PATH` (the lowercase `IMAGE` rule without its prefix).
     - `missingImageFiles` uses `existsExact`, which reads the real directory listing.
     - In `check-export`, `scanUploads` checks references by exact name (`exactIndex`). `wrongCaseReferences` flags every local asset path in pages, payloads and chunks (not `admin/`) that ships in another letter case. This also covers Part 1's `need` without editing it: in the plant check, `/images/Faq-Team.webp` passed `need` on Windows and was caught.
  7. **`dist/uploads/` is re-checked** (minor 6) with `uploadProblems(…, { variants: true })`:
     - originals follow the upload rules (type, bytes, name);
     - a variant must be WebP and its original must be there.
  8. **Hard links** (minor 7): a file with `nlink > 1` is refused by the variant step and check-content, and never shipped. `fs.linkSync` works on NTFS, so this is tested here.
  9. **Temporary files** (minor 8): `.<variant>.<pid>.tmp` under `files/` and `manifest.json.<pid>.tmp` are removed at the start of each run. Two variant steps running at once would remove each other's temporary files; builds are serialized.
  10. **Tests** (minor 9):
      - The file-symlink case now reports `t.skip("file symlinks need developer mode on Windows")`.
      - New tests kill the `isFile()` mutant (a folder where a variant belongs is replaced) and the decode-time `limitInputPixels: false` mutant (`writeVariant` is exported and refuses an image over the limit).
      - `artifacts/t7/mutate.mjs` plants 16 mutants; all are killed except "ship variants of any original", which is equivalent, because a GIF has no manifest entry.
      - `tests/uploads.test.mjs` holds 28 tests, 1 of them skipped on this machine. `npm test`: 161 tests, 160 pass, 1 skipped.
  11. **Results:**
      - Lint, typecheck and `npm test` pass; `Content valid: 12 routes; preview mode.`
      - Rebuild on `3c21f12`: `Upload variants: 0 originals, 0 written, 0 up to date, 0 removed.`, `Uploads shipped: 0 files.`, `Export valid: 12 core pages, 156 files, 11.53 MiB total.`
      - `compare --explain-client-ids`: `Rendered HTML identical to artifacts/html-baseline: 15 pages.` One chunk was renamed (`1tn7orqpia2l5.js` → `1maa5m20t8jpc.js`): the shared chunk with `content-schema.ts`, which now holds the new `IMAGE` rule and message, plus the minifier's renamed locals. No client module id changed, so nothing needed explaining, and the baseline was not re-saved.
      - `check:seo` and `test:browser` pass.
      - **Plant check** (temp copy, removed afterwards; nothing planted in the worktree):
        - Planted: `logo.svg`, `page.html`, `con.webp` and a hard-linked `linked.jpg`, next to `hero.webp` and `hero-1280.webp`, `earth-4k.webp`, `galaxy-small-640.webp` and `team/photo.jpg`.
        - The variant step refused the hard link.
        - check-content listed all four plants.
        - `package-site` shipped the five real uploads with their ten variants and none of the plants. The editor's `hero-1280.webp` shipped byte-identical (SHA-1 `d6accd1d…`).
        - `check-export` passed.
        - Then, planted straight into `dist/`, these were each refused: an SVG, a fake PNG, an orphan variant, `/uploads/Hero.webp` and `/images/Faq-Team.webp`. An external `…/wp-content/uploads/…` link and `/uploads/a.webpx` were not flagged.
- **Task 7 re-review round** (`a53e7d0`). Only `scripts/` and tests changed; `src/` did not, so no rebuild was needed (the 8788 preview still serves the `3c21f12` build, whose rendered HTML compared identical). The reviewer's probes are `scratchpad/t7-review/probe-cache.mjs` and `probe-distdot.mjs`. A copy of the cache probe with one cleanup line adapted is `artifacts/t7/review2/probe-cache-after.mjs`: after the fix, `files/` is a real folder, so the probe's `unlinkSync` of it would throw.
  1. **Links in the cache are never followed** (Important).
     - `files/` and `manifest.json` are `lstat`ed first. A link there, or the wrong kind of entry, is removed: the cache is ours, and the link is never followed.
     - `cacheFolderProblem(cacheDir, root)` checks every folder from the project down to the cache (`.cache/`, `.cache/upload-variants/`), or, for a cache outside the project, its parent and itself. A link or a non-folder there is refused before anything is written.
     - `isRealFile` reaches cached variants and the manifest only through real folders, so packaging never reads through a link either.
     - **Probe 4b** (a `files/` junction to a folder holding `keep.txt` and `sub/notes.md`): before, `removed: ["keep.txt", "sub/notes.md"]` and the folder then held the variants. After, `removed: ["files"]` (the link) and both files survive.
     - **Probe 4c** (the cache's parent is a junction): before, the cache was written into the junction's target. After, it is refused (`dotcache: is a link (symbolic link or junction); the variant cache and the folders above it must be real folders, …`) and nothing is written.
     - Tests cover a junction at `files/` and at `manifest.json`, a `.cache` junction under a project root, a non-folder in the chain, and a `files/` junction that appears after the variant step. That last one points at real copies of the variants, which are still not shipped.
  2. **Variant fingerprints** (minor 1).
     - The manifest records `variants: { "640": { size, sha1 }, "1280": … }` for every upload, and `RECIPE` became `v2`, so older manifests rebuild once.
     - A variant counts as current, in the variant step and in `currentVariants` when packaging, only when its size and SHA-1 match the record.
     - **Probe 3b** (the 1280 variant cut to 64 bytes): before, 2 up to date, shipped at 64 bytes and undecodable. After, 1 written and 1 up to date, shipped at 1,726 bytes, and it decodes.
     - Packaged before the variant step repairs it, the upload ships without its variants.
     - A test also flips one byte at the same size.
  3. **Nothing hidden ships** (minor 2). With `variants: true` (dist mode; the option keeps the name the reviewer's probes use), `uploadProblems` lists dot entries too and refuses any file with a dot segment.
     - **The reviewer's case:** before, `dist/uploads/.env` and `dist/uploads/.hidden/page.html` passed. After: `dist/uploads/.env: is hidden (a dotfile or inside a dot-folder), and nothing hidden may ship: remove it`, and the same for `.hidden/page.html`. `x.map` stays refused as a non-image.
     - Public mode still exempts dotfiles, which never ship.
  4. **Long Windows paths** (minor 3).
     - Variants are now encoded to memory (`toBuffer()`) and written by Node, which handles long paths. libvips can neither write nor read paths of 260 characters or more here: a 315-character write and read both failed in a probe.
     - An upload whose own path is 250 characters or more gets `its path is N characters long, and the image library cannot open paths of 250 or more on Windows: shorten the folder or file names`, on win32 only.
     - **Probe 6:** before, a 274-character cache path failed with "unable to open for write … export it again as WebP, PNG, JPEG or AVIF". After, the probe's 259-character original gets the "shorten the folder or file names" problem.
     - A test (win32 only) shows a 245-character upload with a cache path of 260 or more getting its variants, and a 252-character upload getting the problem.
  5. **Task 9 notes** (minor 5) are in Task 9 Step 7's own text: `~` and the Turkish `ı` with `slugify_filename`, `raster_image` versus animation and metadata, and that `filename_template` is no longer needed. The Task 11 README rename advice names `~` and `ı`.
  6. **Mutation check:** `artifacts/t7/review2/mutate3.mjs` runs this round's 12 mutants against `tests/uploads.test.mjs`. 10 are killed; 2 are equivalent:
     - "isRealFile follows links": `lstat` of a link is neither a folder nor a file, so the type checks refuse it anyway;
     - "manifest link not removed up front": `writeManifest` removes it before renaming into place.
  7. **Gates and checks:**
     - Lint and typecheck are clean. `npm test`: 165 tests, 164 pass, 1 skipped (file symlinks need developer mode on Windows).
     - `check-content`: `Content valid: 12 routes; preview mode.` `check-export` passes on the current `dist/`.
     - **Temp-copy packaging run:** `hero.webp` and `hero-1280.webp` shipped with 4 variants and `check-export` passed. A cached variant truncated afterwards was not shipped, along with its sibling, because the upload ships without variants until they are current. A planted `dist/uploads/.env` and `.hidden/page.html` were refused. The next variant step rewrote only the damaged file (1 written, 3 up to date).
- **Task 9** (`7799d31`, `15685c7`, `8b3fb86`, `6fd9ea9`, `981aaa6`, `f662b61`). These committed files supersede Task 9's code blocks: `scripts/vendor-sveltia.mjs`, `scripts/sveltia-cms.lock.json`, `public/admin/config.yml`, `tests/admin.test.mjs` and `tests/cms-config.test.mjs`. New: `tests/cms-upload-names.test.mjs` with `tests/helpers/sveltia-names.mjs`, `tests/upload-checks.test.mjs` and `tests/helpers/project-temp.mjs`. `npm test` went from 165 to 189 tests (188 pass, 1 skipped).
  1. **Pin `@sveltia/cms@0.230.1`** (controller amendment), published 2026-10-07T11:00Z.
     - `npm view @sveltia/cms@0.230.1`: integrity `sha512-2iTmW3txB2ocqzEO6b/hkr9Txbw+AFMfmmmqarY3B0WrG5eikwXwYwFWB5CGoQMz1JT5RvcVnKINAWBcVfVRMg==`, shasum `d38cba36b78421d6401639cb6adbc3780f0f04f5`. `npm run cms:vendor` downloaded the tarball and verified it; the Task 7 reviewer's copy of the tarball has the same sha512.
     - 0.230.1 ships only one chunk, so 3 files are vendored. Hashes (sha256, after the trailing `sourceMappingURL` comment is removed): `LICENSE.txt` `dcbe3c62…` (1,071 B), `chunks/react-dom.js` `9b5ffe4f…` (213,847 B), `sveltia-cms.js` `d3eff7b0…` (2,250,499 B). They match an independent cut of the reviewer's extracted copy.
     - `.gitattributes` came first; `git check-attr` gives `text: unset` and `diff: unset`, and `git ls-files --eol` shows `i/lf w/lf attr/-text`.
  2. **`js-yaml`** was declared with `npm install --save-dev --save-exact js-yaml@4.2.0` (released 2026-05-31). npm also moved `esbuild` into alphabetical order in both files; that move was undone, so each file gains one line.
  3. **Vendor script** (deviations from Step 4):
     - The `sourceMappingURL` comment is removed from the bytes read as latin1, which maps each byte to one character, instead of a UTF-8 round trip that could change bytes.
     - Paths resolve from the script's own folder (`ROOT`), as in the other scripts.
     - New tests: the ustar and pax reader, and a tarball with other bytes is refused (`Integrity mismatch for @sveltia/cms@0.230.1`). The vendored bundle must also name itself as `0.230.1` and carry no `sourceMappingURL`.
  4. **Schema validation.** `public/admin/config.yml` is valid against 0.230.1's own `schema/sveltia-cms.json` (ajv 6.15.0, draft-07, `artifacts/t9/validate-config.mjs`; the schema is in the npm tarball, not vendored).
     - The plan's Step 7 draft fails that schema in one way only: `auto_increment` on `&order`, which 0.230.1's `NumberField` does not have (`additionalProperties: false`). Without that key the draft is valid.
     - Planted errors are caught: `use_emoji_autocomplete` at the top level, or on a number field.
     - Booted headless (below), the CMS logs no configuration warning.
  5. **`order` is a hidden field.** 0.230.1 has no `auto_increment`, but with `reorder: true` it numbers entries itself (bundle functions `P3` and `m5`): a new or duplicated entry gets the highest `order` plus one when it is saved, and dragging or deleting entries renumbers them 1, 2, 3… A visible required number field would be checked before that number is set, so editors would have to type a number that is then replaced.
     - The mirror test accepts `widget: hidden` for `order` only in a collection with `reorder: true`, and requires the schema to be a whole number from 1.
     - The CMS writes `order` as the first key of the JSON. So the first CMS save of an entry also moves `order` from the end to the top (seen in the headless edit). The loader orders keys by schema, so the site does not change. Moving `order` first in the 21 committed entry files would make those diffs one line; that is left to the controller.
  6. **Legal pages** (controller amendment):
     - `&legal_body` stays `widget: text`; a test pins it.
     - Its `pattern` is ``^(?![\s\S]*(?:<INLINE_SYNTAX.source>))##[ \t]+\S``: a `## ` heading with text first, and none of the parser's inline syntax anywhere. The test builds the expected string from `INLINE_SYNTAX`, which `0a39f83` already exports, so the two cannot drift. The test also checks that the CMS rule and the parser agree on today's pages, on a good sample and on 13 refused samples.
     - Sveltia tests a field pattern with `new RegExp(source)` (no flags) against the **trimmed** value (bundle function `Aje`).
     - The hint now says "Leave a blank line before each heading".
     - Headless, an edit that adds `*bold*` shows the pattern message and saves nothing. A plain edit saves `privacy.md` with no front matter, as the bundle's writer does for a file whose only field is `body` (`ZAe`).
  7. **`use_emoji_autocomplete: false`** (controller amendment). In 0.230.1 this is an option on each string, text, markdown and rich-text field; the schema refuses it at the top level, and `field_defaults` covers only rich text. It is set on all 135 string and text fields, and a test requires it on every one.
  8. **Uploads.**
     - `slugify_filename: true`, and the `slug` options written out: `encoding: ascii`, `clean_accents: true`, `sanitize_replacement: "-"`, `trim: true`, `lowercase: true`, `maxlength: 60`. All exist in 0.230.1's schema.
     - **Per-format transformations** (controller decision): `jpeg`, `png`, `avif` and `heic` become WebP at quality 85, at most 2560 × 2560. `gif` and `webp` are left out, so animations survive.
       - The bundle picks a transformation as `o[sniffed format] ?? o[declared format] ?? raster_image` (`Zxe`). The conversion draws on a canvas, which drops all metadata.
     - **HEIC** is in 0.230.1. Its decoder comes from unpkg (`@discourse/heic`, through a blob worker), which the site and admin CSPs block, so a HEIC upload is refused at upload time ("Failed to decode HEIC image", then shown as invalid). Without the key, 0.230.1 would save the raw `.heic`, because its upload check accepts unknown MIME types, and only the build would refuse it.
     - **No `filename_template`.** A taken name already gets `-1`, `-2`… (`Mj`), and a file with identical bytes reuses the existing name. So an upload never replaces another by accident, and names stay readable.
     - **Names, from the bundle's own code** (`tests/cms-upload-names.test.mjs` runs `oK`, `RV`, sanitize-filename and the transliteration tables, taken from the vendored file into a vm context):

       | Original | Saved as |
       |---|---|
       | `Banner 1280.png` | `banner-1280.webp` |
       | `Ảnh đẹp.JPG` | `anh-dep.webp` |
       | `résumé (final).webp` | `resume-final.webp` |
       | `scan~2.jpg` | `scan~2.webp`: `~` survives ASCII slugs (`[^\w-~]`), and the build refuses the name |
       | `IMG_0042.JPG` with Turkish case rules | `ımg_0042.webp`: `toLocaleLowerCase()` uses the browser's language; refused |
       | `con.png`, `COM1.jpg`, `nul.webp` | none: sanitize-filename empties the name and `RV` then throws a TypeError, so nothing is saved (headless: page error, no upload dialog) |
       | emoji or CJK only | a random 12-hex-character id |
       | over 60 characters | cut to 60 |

     - **The same in headless Chromium** (asset library, with an Origin Private File System folder standing in for the native picker):
       - The six samples were saved as `banner-1280.webp`, `anh-dep.webp` (its GPS EXIF stripped), `resume-final.webp` (byte-identical, GPS EXIF kept), `spinner-anim.gif` and `loop-anim.webp` (both byte-identical, 3 frames each) and `scan~2.webp`.
       - Run on those files, check-content's rules list exactly `scan~2.webp` (rename) and `resume-final.webp` (location data).
       - Playwright's `tr-TR` locale and `--lang=tr` did not change `"I".toLocaleLowerCase()` in headless Chromium, so the Turkish case is shown only by the vm test.
     - **Answers to the Task 2 items "For Task 9":**
       1. Sveltia's `maxlength` counts code points of the trimmed value (`[...d.trim()].length`, function `UQ`), the same as `textOf` for any valid value (the schema refuses outer spaces). `textOf` is unchanged.
       2. `slugify_filename` writes names that `IMAGE` accepts, except the `~` and Turkish cases above.
  9. **Location data (controller decision for animated uploads).** `check-content` now runs `locationProblems` (`scripts/lib/uploads.mjs`). It refuses any upload under `public/uploads/` that contains location data (wording: "contains location data … re-export it without location data and upload it again"):
     - an EXIF GPS section with any tag but `GPSVersionID`, read from sharp's `metadata().exif` in either byte order, with or without the `Exif\0\0` prefix;
     - an XMP `exif:GPS…` property other than `GPSVersionID`, under any prefix bound to the EXIF namespace;
     - for GIF, which sharp does not read, the XMP packet in the file's bytes.

     It also refuses an image whose metadata cannot be read, or whose EXIF is damaged. sharp is loaded lazily through a shared `loadSharp()`, which the variant step now imports too. Files are read into memory, so long Windows paths are fine.
     - **Not read:** ImageMagick's hex "Raw profile type exif" PNG text chunks, and JPEG Extended XMP.
  10. **Rename advice.** For a name outside `UPLOAD_PATH`, the message now suggests a name that fits and says what is wrong, for example `rename it, for example to scan-2.webp: upload names use … (not allowed here: "~")`. Other cases: `"ı", the dotless i that a Turkish-language browser writes for I`; capital letters; spaces; `"." before the extension`; `"con", a Windows device name`; and `U+202E` for invisible characters. The Task 7 test's expected message was updated.
  11. **Temporary projects.** The check-content tests that copy the project and add uploads now create it in `artifacts/test-projects/`, because sharp must resolve from this repository's `node_modules`.
  12. **Tailwind source detection** (`f662b61`). The first rebuild compared identical in HTML (chunk names are masked), but the chunk file comparison found the site stylesheet renamed. Tailwind v4 scans every file that git does not ignore, so the vendored bundle added eleven unused utilities (`.collapse`, `.table-cell`, `.line-through`…), +590 B. `@source not "../../public/admin";` in `src/app/globals.css` (fenced) fixes it, and a test pins it.
  13. **Results** on `f662b61`:
      - Lint and typecheck clean. `npm test`: 189 tests, 188 pass, 1 skipped. `Content valid: 12 routes; preview mode.` `Vendored @sveltia/cms@0.230.1 matches scripts/sveltia-cms.lock.json.`
      - Rebuild: `Upload variants: 0 originals…`, `Uploads shipped: 0 files.`, `Export valid: 12 core pages, 156 files, 11.53 MiB total.` `out/admin/` is exported, and `dist/admin/` is not shipped (Task 10).
      - All 19 chunks are byte-identical to the build before Task 9. `compare --explain-client-ids`: `Rendered HTML identical to artifacts/html-baseline: 15 pages.` The baseline was not re-saved.
      - `check:seo` and `test:browser` pass.
  14. **For Task 10:**
      - Until `/admin/` ships, the preview answers 404 there.
      - Headless boot under the planned admin CSP: the sign-in screen renders with its icon font, with no page errors. The CSP blocks two requests: the unpkg update check (expected) and `https://www.githubstatus.com/api/v2/status.json`. **Task 10's browser check as written allows only `connect-src blocked https://unpkg.com/` and would fail on the second.** Either allow `https://www.githubstatus.com` in `connect-src` now, or accept that violation in the check.
      - Under today's site CSP the page also boots, but the jsDelivr fonts and a `data:` fetch are blocked too, and the icons show as words.
      - Sveltia adds its own `<meta name="robots" content="noindex">` next to the page's `noindex, nofollow`.
      - The update check finds 0.250.1 when it is not blocked, and logs a console warning.

## Risks and open questions

1. **Turbopack and `with { type: "json" }`** is the one combination not probed in planning (all other tools were). Task 4 Step 8 exercises it first, before anything depends on it, and says what to do on failure.
2. **Fonts come from jsDelivr at run time on `/admin/` only.** The CMS code is vendored, but the IIFE bundle hard-codes its Fontsource URLs; blocking them turns the Material Symbols icons into words. The admin CSP allows only `https://cdn.jsdelivr.net/fontsource/` for fonts. Fully self-hosting fonts would need the npm build bundled with esbuild and `@sveltia/cms` plus its dependencies installed into `node_modules`; left for later.
3. **Sveltia 0.250.0 was released on 2026-10-21**, the day of this plan, and the project releases several times a week. The controller pinned 0.230.1 (2026-10-07) instead, a release at least 14 days old. The pin is verified (integrity, hashes, schema validation of `config.yml`); upgrades follow the README procedure.
4. **Blocked optional requests.** The update check logs a CSP error in DevTools (harmless, try/catch in the bundle). A non-English browser gets an error about translations and falls back to English. HEIC uploads, maps, PDF thumbnails and code highlighting are unavailable; none is used.
5. **Linked worktree.** The local workflow saves into a linked worktree but cannot commit from the browser (Sveltia limitation); the owner commits with git.
6. **New entries** created in the CMS need the index regenerated; every build does that, and `npm test` names the stale index if someone tests before building.
7. **Upload variants are build output**, kept in the gitignored `.cache/upload-variants/` and pruned there by every build (the cache is the build's own, so nothing an editor made is ever deleted). Under `next dev` uploads render from the original, because the variants are not under `public/`. Original uploads ship too (`uploads/**`, per the spec); the Chrome-side WebP re-encode strips camera metadata, but a file added outside the CMS keeps its metadata.
8. **`srcset` descriptors** for uploads narrower than 1280 px still say `1280w` (the variant is the original width); the browser may pick it slightly early. Harmless.
9. **Task 8** edits files Part 2 will rework (see "Merge notes"); it can be deferred.
10. **`js-yaml`** was already installed through ESLint; Task 9 only declares it (plain `npm install` in the CMS worktree's own `node_modules`), with a manual fallback.

## Deviations from the spec, with reasons

- **More JSON singletons than the spec lists** (site, home, sections, footer, measure, plus `work`, `services-panel`, `process`, `approach`, `engagements-panel`, `faq-card`, `team`): those exports had to live somewhere, and one file per page block matches what an editor sees.
- **`INSIGHTS` and `CASE_STUDIES` stay in code** as empty arrays: they are publication scaffolding, not content, and the spec's model does not include them.
- **Privacy and terms**: the section text is Markdown; the preview notice and the contact paragraph stay in the pages because they depend on environment settings.
- **Fonts from jsDelivr on `/admin/`** (risk 2).
- **Component edits** (Task 8): required by "images are rendered from those variants", made output-neutral for every current image.
- **Variants are gitignored build output** and regenerated by every build, rather than committed.
- **`js-yaml` devDependency**, for the test that proves `config.yml` mirrors the schemas.

## Self-review

**Spec coverage (Part 3 and its tests):**
- `/admin` static page + `config.yml`: Task 9. Pinned, vendored bundle served from `/admin/`: Task 9 (integrity-checked, hash-locked, re-verified by `npm test`).
- `/admin/*` CSP rule, `unsafe-eval` not needed, `connect-src` for GitHub later: Task 10 (rule and tests), Task 11 (README, later additions). Site CSP unchanged: Task 10 tests and browser check.
- Noindex, excluded from the sitemap and SEO expectations, not linked: Tasks 9–10 (meta tag, header, `check-seo` assertions, `check-export`).
- Packaged by `package-site.mjs`: Task 10 (admin), Task 7 (uploads).
- Content in `content/`, typed loader with the same names and types, validation without zod: Tasks 2–4 (round-trip values with key order, compile-time type contract).
- Folder collections with `order`; testimonials and articles empty; privacy and terms in Markdown: Tasks 3 and 5.
- `config.yml` mirrors the schemas (required, max lengths, service-slug selects, `permissionConfirmed`, lists, images): Task 9 plus the mirror test.
- Honesty tests and `check-content` run on the loaded content and scan the Markdown and every CMS-editable file; a planted price fails without touching the real tree: Task 6.
- Uploads to `public/uploads/`; sharp variants, idempotent; srcset helper; `uploads/**` packaged; `check-export` verifies referenced uploads: Tasks 7–8 (with an end-to-end upload check).
- Workflow docs (local today; GitHub backend, `/api/auth`, Workers Builds later, not built): Task 11.
- Tests: loader and validation (Tasks 2–3), round-trip (Task 4), variant script (Task 7), browser checks for `/admin/` CSP, noindex and site CSP (Task 10). Before/after HTML diff of all exported pages: Task 1 baseline, compared in Tasks 4, 5, 7, 8 and 10.

**Placeholder scan:** no "TBD", "TODO", "similar to" or unspecified steps; every created file has complete content; the generated files (fixture, `.d.ts`, `content/**`, the index, the lock, the vendored files) have exact generation commands and expected output, and the lock's hashes are given in full.

**Type and name consistency:** `buildContent`, `contentSchemas`, `siteSchema`, `SINGLETON_FILES`, `COLLECTION_NAMES`, `CollectionFile`, `CollectionName` (content-model); `COLLECTIONS`, `INDEX_FILE`, `listEntries`, `renderIndex`, `readIndex` (build-content-index); `COLLECTION_FILES` (generated index); `parseContent`, `check`, `ContentError`, `SLUG`, `HREF`, `IMAGE`, `COLOR` (content-schema); `FORBIDDEN`, `findForbidden`, `contentFiles`, `scanContentTree` (honesty); `WIDTHS`, `RASTER`, `VARIANT`, `variantFile`, `variantFiles`, `buildUploadVariants` (variants); `referencedImages`, `missingImageFiles` (content-assets); `contentImage`, `UPLOAD_WIDTHS` (content-images); `LEGAL_PAGES`, `legalSections`, `parseLegalMarkdown`, `legalSectionElements` (legal); `SVELTIA`, `TARGET`, `LOCK`, `untar`, `extractVendored`, `verifyVendored` (vendor). Each is defined once and used with the same name and signature in the tasks that import it; the prototypes of every module and test ran together in planning (81 tests green, ESLint and tsc clean).

## Controller amendments (before execution, 2026-10-21)

- **Sveltia pin:** use `@sveltia/cms@0.230.1` (published 2026-10-07), not 0.250.0, which was published the same day as planning. The rule for this repo is that a pinned dependency must be at least 14 days old, the same rule Part 2 applied to Lenis. In Task 9:
  - Recompute the tarball `sha512` from `npm view @sveltia/cms@0.230.1 dist.integrity`.
  - Recompute the file list and the sha256 hashes of the extracted files.
  - Re-validate `config.yml` against 0.230.1's own JSON schema, if the package ships one. If not, record what was checked instead.
  - Update every 0.250.0 mention, including the README.

  If 0.230.1 lacks something the config needs, stop and report it rather than moving to a newer version.
- **Task 8 is deferred.** It edits section components that Part 2 reworks. It runs after Part 2, in the main worktree (`feat/spacegear-showcase`, port 8787), against the components as they are then. Tasks 1–7 and 9–11 run in `spacegear-cms` on `feat/showcase-cms` (port 8788).
- **Order:** Part 3 runs in parallel with Part 1. The controller merges `feat/showcase-cms` into `feat/spacegear-showcase` after Part 1 finishes, following the merge notes above, including their HTML-baseline order (save in the main worktree before the merge, compare after it).
- **Uploaded SVGs (from the Task 2 re-review).** The schema refuses references to `/uploads/*.svg`, but the media library can still upload one, and `shipFolder("uploads")` would ship it. Do both of these:
  - **Task 7:** `shipFolder("uploads")` ships only `.webp`, `.png`, `.jpg`, `.jpeg`, `.avif` and `.gif`. `check-content` fails on any other file under `public/uploads/` (dotfiles such as `.gitkeep` excepted). Add tests for both.
  - **Task 10:** add a `/uploads/*` rule to `public/_headers`: `! Content-Security-Policy`, then `Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox`. Also add `X-Content-Type-Options: nosniff`, which `/*` already sets. The header check in `check-export` and the browser check must assert it. It does not affect `<img>` rendering on site pages.
- **Frozen-fixture value tests must not block CMS editing** (from the Task 3 review).
  - **Problem:** `content-loader.test.mjs` and Task 4's `content-roundtrip.test.mjs` require content values to equal `tests/fixtures/content-v1.json`. Once editors use the CMS, every legitimate copy edit would turn `npm test` red.
  - **Tasks 4–10:** keep the tests as written. They prove the migration changed nothing.
  - **Task 11:**
    - Move every value-equality assertion against the fixture out of `npm test` into a one-off `scripts/check-migration.mjs`. The same goes for the HTML snapshot comparison, which is local-only anyway.
    - Keep these in `npm test`: the compile-time type contract against `content-v1.d.ts`, the key and shape checks, the schema and uniqueness rules, the honesty scan and the index freshness check.
    - In the README, say that `check-migration` documents the original migration, and that it is expected to fail after deliberate copy edits.
  - **Uniqueness gaps, out of scope for now:** some list values used as React keys are still not checked: the Analytics labels and glyphs, process `step`, pillar `no`, and footer link hrefs. A duplicate only causes a React key warning; there is no build or data failure.
- **Task 4 review: client validation is accepted as is.**
  - **Cost:**
    - The content validation (schema plus `buildContent`) ships in a shared client chunk: +13.6 KB raw, +4.8 KB gzip. That is about 2 % of mobile JS.
    - It costs about +6 ms of evaluation per full page load.
    - The Worker bundle grows from about 20 KB to 61 KB and runs `buildContent` at cold start (about 6–7 ms).
  - **Why accepted:** `buildContent` also normalises and derives values. Skipping it in the browser would break hydration.
  - **Later option:** a generated, pre-validated data module, if a JS budget is ever set.
  - **Folded into Task 5:**
    - Tighten `Same` in `content-contract.ts` to the exact-equality form, so an added optional key and `any` are also caught.
    - Fix the `content.ts` header comment: validation also runs in the browser and the Worker.
  - **Task 6 must** validate `content/site.json` in `check-content`, and print content errors without a stack trace.
- **Task 5 review follow-ups.**
  - **Legal parser** (Task 6 does this first, as its own commit):
    - A `## ` heading line starts a new block even without a blank line before it: `split(/\n\s*\n|\n(?=[ \t]*##(?:[ \t]|$))/)`.
    - Error messages give the file, the **line number** and the offending character, with context.
    - An empty `## ` reports "the heading is empty".
    - Reject `#` inside headings, and add `~~` to `INLINE_SYNTAX`.
    - Add tests for the rejections that are not covered yet, and assert the message text in a few cases.
    - `legalSections(page, root = process.cwd())`.
    - Do not add `import "server-only"` to `legal.ts`.
  - **Task 9:**
    - `&legal_body` stays `widget: text`. Pin it with a test (`field.widget === "text"`), because the markdown and rich-text widgets write `\` escapes that the parser rejects.
    - Add a CMS `pattern` that mirrors the parser's rules: start with `## ` and use no inline syntax. Export `INLINE_SYNTAX` and add a mirror test.
    - Extend the hint with "Leave a blank line before each heading".
    - Set `use_emoji_autocomplete: false`.
  - **Task 11:** move the literal legal-copy assertions in `tests/legal.test.mjs` (exact headings, section counts, "one plain paragraph today") into `scripts/check-migration.mjs`, along with a full-text equality check against the pre-CMS copy. `npm test` keeps only the structural checks.
