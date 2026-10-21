# Showcase Part 3 (CMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors can change the site's copy and images through a git-based CMS at `/admin/` (Sveltia CMS, vendored), without touching code, while the exported site renders byte-for-byte the same HTML as before and every honesty, CSP and packaging gate stays green.

**Architecture:** All copy moves from `src/lib/content.ts` into `content/` (JSON singletons, one-file-per-entry folder collections with an `order` field, and Markdown legal pages). `src/lib/content.ts` becomes a typed loader: it imports the JSON statically (`with { type: "json" }`), validates it with a tiny in-repo schema layer (`src/lib/content-schema.ts`, no zod), derives the same values and exports the same names and types, so no component logic changes. A generated, committed `src/lib/content-index.generated.ts` lists the folder-collection entries, because the loader also runs in the browser bundle and in the Worker, where it cannot read a folder. `/admin/` is a static page that loads a pinned, integrity-checked copy of Sveltia CMS from `public/admin/sveltia/`, with its own CSP rule in `public/_headers`. CMS uploads go to `public/uploads/`; a sharp build step writes `-640`/`-1280` WebP variants next to them, and `contentImage()` renders uploads through those variants.

**Tech Stack:** Next.js 16.2.7 static export (Turbopack), React 19.2, TypeScript 5.9, Node 22.14 (`--experimental-strip-types`, `node:test` + tsx), sharp 0.34, Sveltia CMS 0.250.0 (vendored `dist/` IIFE build), js-yaml 4.2.0 (tests only), Cloudflare Workers Static Assets (`_headers`), Playwright (Chromium).

**Spec:** `docs/superpowers/specs/2026-10-21-spacegear-showcase-design.md`, Part 3, plus "Guardrails" and "Testing and verification".

---

## Research summary (read before Task 9)

**Version and distribution.** `npm view @sveltia/cms` (2026-10-21): latest `0.250.0`, tarball `https://registry.npmjs.org/@sveltia/cms/-/cms-0.250.0.tgz`, integrity `sha512-VDdYsC2zSiXGGvzgPIJMVyG9Yf3JsAFXr6OltZZnv7kTANHeOVS1hjuorUfa472rWO40l1bheKPOhEFtpdoNtg==`. The package ships two builds:

| Build | Files | Usable unbundled? |
|---|---|---|
| `dist/sveltia-cms.js` (IIFE, auto-initializes) | 2.5 MB + `dist/chunks/{git,qrcode,react-dom}.js` + `dist/chunks/assets/rolldown-runtime-*.js` | **Yes.** This is the documented browser build (docs: plain `<script>`, "not distributed as an ES module"). It loads its chunks with `import(new URL("chunks/<name>.js", document.currentScript.src))` and only falls back to unpkg if that fails (function `DSe` in the bundle), so the chunks vendored next to it are used. |
| `npm/index.js` (ESM for bundlers) | 2.5 MB + 300 chunks + fonts/wasm | No: it has bare dynamic imports (`import("exifr/…")`, `import("@shikijs/langs/…")`) and JSON locale imports that need a bundler and the package's dependencies installed. |

**Decision:** vendor `dist/sveltia-cms.js`, `dist/chunks/**/*.js` and `LICENSE.txt` (no source maps) into `public/admin/sveltia/` with `scripts/vendor-sveltia.mjs`, which downloads the pinned tarball, verifies its sha512 integrity, extracts with a small built-in tar reader and records sha256 hashes in `scripts/sveltia-cms.lock.json`. `npm test` re-verifies the hashes offline. Nothing is installed into `node_modules` (the CMS worktree shares the main worktree's `node_modules` through a junction).

**What the bundle fetches at run time** (inspected in `dist/sveltia-cms.js` 0.250.0):
- `@font-face` rules for Source Sans 3, Noto Mono and Material Symbols (the UI icons) from `https://cdn.jsdelivr.net/fontsource/fonts/…`. Without them the icons render as words, so the admin CSP allows that one path for fonts.
- An update check, `fetch("https://unpkg.com/@sveltia/cms/package.json")`, on start and hourly (wrapped in try/catch). Blocked on purpose.
- Non-English UI strings from `https://unpkg.com/@sveltia/cms@0.250.0/locales/<locale>.json`. Blocked: the CMS then shows an error and falls back to English (choose English in its settings).
- Optional libraries from unpkg, only when their feature is used: exifr (asset details), turndown (HTML paste in the rich-text editor), Immutable (custom preview templates), Leaflet/terra-draw (map field), PDF.js, SVGO, jSquash, the HEIC decoder, Shiki and Day.js locales. This config uses none of them: text fields are plain `string`/`text` widgets and image optimisation uses Chrome's native WebP encoder (`OffscreenCanvas.convertToBlob`).
- `https://api.github.com` and `https://www.githubstatus.com` only with the GitHub backend (later).
- No `eval` or `new Function` in the bundle.

**CSP for `/admin/*`** (sources: Sveltia's CSP guide, https://sveltiacms.app/en/docs/security#setting-up-content-security-policy, which lists `style-src 'self' 'unsafe-inline'`, `font-src 'self' https://cdn.jsdelivr.net`, `img-src 'self' blob: data:`, `media-src blob:`, `frame-src blob:`, `script-src 'self' https://unpkg.com`, `connect-src 'self' blob: data: https://unpkg.com`, `manifest-src blob:`, and states that Sveltia "does not require the `unsafe-eval` and `unsafe-inline` keywords in the `script-src` CSP directive"; plus the bundle inspection above):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' https://cdn.jsdelivr.net/fontsource/; connect-src 'self' blob: data:; media-src 'self' blob:; frame-src blob:; manifest-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`unpkg.com` is dropped from `script-src` and `connect-src` because the code is vendored; `font-src` is narrowed to the Fontsource path. Later, the GitHub backend adds `https://api.github.com https://www.githubstatus.com` to `connect-src` and `https://avatars.githubusercontent.com` to `img-src` (README, Task 11).

**`_headers` mechanics** (Cloudflare docs, https://developers.cloudflare.com/workers/static-assets/headers/, and the asset worker in `node_modules/miniflare/dist/src/workers/assets/assets.worker.js`, `attachCustomHeaders`): every matching rule applies in file order; a header set twice is joined with a comma (which would make the browser enforce **both** CSPs); `! Header-Name` removes a header set by an earlier rule. Within one rule, removals run before sets. So the `/admin/*` rule, placed after `/*`, removes `Content-Security-Policy` and `X-Robots-Tag` and sets its own. `/admin/*` matches `/admin/` (the splat may be empty). Lines are limited to 2,000 characters, rules to 100.

**Local workflow** (https://sveltiacms.app/en/docs/workflows/local): Chromium only (File System Access API), on `localhost`/`127.0.0.1`; "Work with Local Repository", then pick the folder that contains `.git`; no proxy server; edits are saved to files and the owner commits. The bundle accepts a `.git` **file** (linked worktree), but in-browser commits are not supported in linked worktrees, so saving works and committing is done with git. A backend must still be configured (`github` + any `owner/repo`); the local workflow never contacts it. The bundle reads `config.yml` from `<link rel="cms-config-url">` (default `/admin/config.yml`) and injects `<meta name="robots" content="noindex">` itself.

**Next 16 and JSON.** `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md`: "JSON Imports: Supported". Next's SWC parser options enable import attributes (`importAssertions: true`, `keepImportAttributes: true` in `next/dist/build/swc/options.js`). Probes in the planning scratchpad confirmed that `import x from "./a.json" with { type: "json" }` plus `.ts` specifiers work under `node --experimental-strip-types` (Node 22.14, no warning), tsx 4.23, esbuild 0.28 (the Worker bundle) and `tsc` 5.9 with both tsconfigs. Turbopack is first exercised by the Task 4 build; the fallback is in Task 4.

**Verified in planning (scratchpad prototypes, not in the repo):** the loader reproduces all 23 exports with identical values and key order (`JSON.stringify` equality); the type contract passes and fails on a drifted type; ESLint passes; 81 unit tests pass; `config.yml` validates against Sveltia 0.250.0's own JSON schema (`schema/sveltia-cms.json`, via ajv) and mirrors the content schemas; the legal Markdown renders the same static markup and element tree as the JSX; the vendor script's tar reader extracts the six files listed in Task 9 with the hashes listed there; the HTML snapshot tool reports a build identical to itself.

---

## Conventions for every task

- **Worktree.** `E:\Personal\clone website\spacegear-cms`, branch `feat/showcase-cms` (cut from `feat/spacegear-showcase` by the controller), `node_modules` junctioned to the main worktree's. Preview port **8788**. Never touch the main worktree (`spacegear`, port 8787, Part 1) or `platform-clone`.
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
| `scripts/build-upload-variants.mjs` | sharp: `-640`/`-1280` WebP variants of each upload | 7 |
| `scripts/lib/content-assets.mjs` | Referenced images that are missing | 7 |
| `src/lib/content-images.ts` | `contentImage()` srcset helper | 7 |
| `tests/uploads.test.mjs` | Variant script and helper tests | 7 |
| `.gitattributes` | Keep vendored bytes exact | 9 |
| `scripts/vendor-sveltia.mjs`, `scripts/sveltia-cms.lock.json` | Pinned, verified vendoring | 9 |
| `public/admin/sveltia/**` (6 files) | Vendored Sveltia CMS 0.250.0 | 9 |
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
| `.gitignore` | Upload variants, Sveltia temp files | 7 |
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
  export const HREF = /^(?:\/[\w.~/#?=&%-]*|https:\/\/[^\s"<>]+)$/;
  export const IMAGE = /^(?!\/uploads\/.*-(?:640|1280)\.webp$)\/(?:images|uploads)\/(?:[\w-]+\/)*[\w.-]+\.(?:webp|png|jpe?g|avif|gif|svg)$/;
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
    assert.ok(issues.some((issue) => issue.startsWith("content/work.json: tiles[0].slug: choose one of")));
    assert.ok(issues.some((issue) => issue.startsWith("content/services-panel.json: pillars[0].slug: choose one of")));
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
    assert.ok(issuesOf(input).some((issue) => issue.startsWith("content/team-roles/product-and-delivery.json: links: 1 items, the limit is 0")));
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
  cd "$CMS" && grep -ioE 'srcset="/uploads/e2e-check-640\.webp 640w, /uploads/e2e-check-1280\.webp 1280w"' dist/index.html dist/contact/index.html && ls dist/uploads
  ```
  Expected: `1`; the rebuild passes (`Upload variants: 1 originals, 2 written, 0 up to date.`, `Content valid…`, `Export valid…`); one `srcSet=…` match in each of the two pages; `ls` lists `e2e-check-1280.webp  e2e-check-640.webp  e2e-check.webp`.
  Revert, then rebuild and compare:
  ```bash
  cd "$CMS" && git checkout -- content/faq-card.json && rm -f public/uploads/e2e-check*.webp && rm -rf dist/uploads && git status --short public content
  bash "$WT" "$CMS" 8788 rebuild
  cd "$CMS" && node scripts/html-snapshot.mjs compare artifacts/html-baseline
  ```
  Expected: `git status` shows nothing under `public` or `content` (variants are gitignored and deleted; the empty `public/uploads/` folder is invisible to git); then `Rendered HTML identical to artifacts/html-baseline: 15 pages.` (`rm -rf dist/uploads` is needed because preview packaging keeps old files in `dist/`.)

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

- [ ] **Step 1: Declare the YAML parser the config test uses.** `js-yaml@4.2.0` is already in `node_modules` (through ESLint); declare it without touching `node_modules`, which is shared with the main worktree:
  ```bash
  cd "$CMS" && npm install --save-dev --save-exact --package-lock-only js-yaml@4.2.0 && git diff --stat package.json package-lock.json && node --input-type=module -e "import('js-yaml').then((m) => console.log(typeof m.load))"
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
    version: "0.250.0",
    tarball: "https://registry.npmjs.org/@sveltia/cms/-/cms-0.250.0.tgz",
    integrity: "sha512-VDdYsC2zSiXGGvzgPIJMVyG9Yf3JsAFXr6OltZZnv7kTANHeOVS1hjuorUfa472rWO40l1bheKPOhEFtpdoNtg==",
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
  Expected: `Vendored @sveltia/cms@0.250.0: 6 files in public/admin/sveltia/.`, then exactly this lock (hashes computed in planning from the same tarball), then `Vendored @sveltia/cms@0.250.0 matches scripts/sveltia-cms.lock.json.`
  ```json
  {
    "name": "@sveltia/cms",
    "version": "0.250.0",
    "tarball": "https://registry.npmjs.org/@sveltia/cms/-/cms-0.250.0.tgz",
    "integrity": "sha512-VDdYsC2zSiXGGvzgPIJMVyG9Yf3JsAFXr6OltZZnv7kTANHeOVS1hjuorUfa472rWO40l1bheKPOhEFtpdoNtg==",
    "files": {
      "LICENSE.txt": "dcbe3c626d85741f6fabefed0b34d07a2e92c032f63aa21c0279062363859c32",
      "chunks/assets/rolldown-runtime-BWaJ3C7D.js": "d0e9044430006c5bb48f477501a5af465f0a6377d2fcd7495aa215b8b75aaee3",
      "chunks/git.js": "26d6684db7c102fea569335338deede109f97839f9c7681122de4881ab7afd51",
      "chunks/qrcode.js": "5433cb7316cc764966ee5c089515220d5b7bb16e42369578e30fe9a8e1d532e4",
      "chunks/react-dom.js": "257c2d34a3b0a1ebb86422ccaddde42a30d9708f9df5c72276cb6a43bdfa1642",
      "sveltia-cms.js": "0a87824fe797d03154fdae61b617692db6c54b2c8ac11033de940799f4d4b926"
    }
  }
  ```
  Sizes: `sveltia-cms.js` 2,586,436 bytes, `chunks/react-dom.js` 213,151, `chunks/git.js` 167,074, `chunks/qrcode.js` 23,497, `rolldown-runtime` 911, `LICENSE.txt` 1,071. An integrity error means the registry served different bytes: stop and report.

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

- [ ] **Step 7: Write the CMS configuration** `public/admin/config.yml` (validated in planning against Sveltia 0.250.0's `schema/sveltia-cms.json` and by the mirror test):
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
                - &link_href { name: href, label: Link, widget: string, maxlength: 200, hint: "A site path such as /contact/ or /#faq, or a full https:// address.", pattern: ['^(?:\/[\w.~/#?=&%-]*|https:\/\/[^\s"<>]+)$', "Use a site path such as /contact/ or a full https:// address"] }
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
                - &image_field { name: img, label: Image, widget: image, choose_url: true, hint: "Upload a new image, pick one under Site images, or type a path such as /images/suite/neural-net.webp.", pattern: ['^(?!\/uploads\/.*-(?:640|1280)\.webp$)\/(?:images|uploads)\/(?:[\w-]+\/)*[\w.-]+\.(?:webp|png|jpe?g|avif|gif|svg)$', "Use an image under /images/ or /uploads/ (not a generated -640 or -1280 variant)"] }
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
        - { name: image, label: Image, widget: image, choose_url: true, hint: "Shown wherever the service appears.", pattern: ['^(?!\/uploads\/.*-(?:640|1280)\.webp$)\/(?:images|uploads)\/(?:[\w-]+\/)*[\w.-]+\.(?:webp|png|jpe?g|avif|gif|svg)$', "Use an image under /images/ or /uploads/ (not a generated -640 or -1280 variant)"] }
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
        - { name: img, label: Photo, widget: image, choose_url: true, hint: "The client's own approved photo, uploaded here.", pattern: ['^(?!\/uploads\/.*-(?:640|1280)\.webp$)\/(?:images|uploads)\/(?:[\w-]+\/)*[\w.-]+\.(?:webp|png|jpe?g|avif|gif|svg)$', "Use an image under /images/ or /uploads/ (not a generated -640 or -1280 variant)"] }
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
        - { name: img, label: Image, widget: image, choose_url: true, hint: "The article's own image, uploaded here.", pattern: ['^(?!\/uploads\/.*-(?:640|1280)\.webp$)\/(?:images|uploads)\/(?:[\w-]+\/)*[\w.-]+\.(?:webp|png|jpe?g|avif|gif|svg)$', "Use an image under /images/ or /uploads/ (not a generated -640 or -1280 variant)"] }
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

- [ ] **Step 8: Run the tests and see them pass.** `cd "$CMS" && node --import tsx --test tests/admin.test.mjs tests/cms-config.test.mjs` → `# pass 7`, `# fail 0`.

- [ ] **Step 9: Fast gates.** `cd "$CMS" && npm run lint && npm run typecheck && npm test` → all pass (ESLint does not lint `public/`).

- [ ] **Step 10: Commit.** Check that git stored the vendored files without conversion: `git add` then `git ls-files --eol public/admin/sveltia | head -3` shows `attr/-text -diff`.
  ```bash
  cd "$CMS" && git add .gitattributes scripts/vendor-sveltia.mjs scripts/sveltia-cms.lock.json public/admin package.json package-lock.json tests/admin.test.mjs tests/cms-config.test.mjs && git ls-files --eol public/admin/sveltia | head -3 && git commit -m "feat(cms): vendor Sveltia CMS 0.250.0 and add the /admin page and CMS configuration" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
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

- [ ] **Step 3: Ship `/admin/`.** In `scripts/package-site.mjs`, inside the CMS block, after the line `await shipFolder("uploads");` add:
  ```js
  if(!await shipFolder("admin"))throw new Error("out/admin is missing: public/admin/ must be exported with the site.");
  ```

- [ ] **Step 4: Check the shipped admin.** In `scripts/check-export.mjs`, inside the CMS block, after the line `await scanUploads(root);` add:
  ```js
  const sveltiaLock=JSON.parse(await fs.readFile("scripts/sveltia-cms.lock.json","utf8"));
  for(const file of ["admin/index.html","admin/config.yml",...Object.keys(sveltiaLock.files).map(name=>`admin/sveltia/${name}`)])await fs.access(path.join(root,file)).catch(()=>errors.push(`Missing CMS file: ${file}`));
  const adminHtml=await fs.readFile(path.join(root,"admin/index.html"),"utf8").catch(()=>"");
  if(!adminHtml.includes('<meta name="robots" content="noindex'))errors.push("admin/index.html must carry a robots noindex meta tag");
  if(/<script(?![^>]*\ssrc=)[^>]*>/.test(adminHtml))errors.push("admin/index.html must not use inline scripts (its CSP allows script-src 'self' only)");
  if(!/^\/admin\/\*\r?$/m.test(await fs.readFile(path.join(root,"_headers"),"utf8")))errors.push("dist/_headers has no /admin/* rule");
  ```
  The existing scans already cover the admin files: the old-identity scan reads the vendored JS (0.250.0 contains none of those strings; checked in planning), and `admin/index.html`'s only local reference, `/icon.svg`, ships.

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

  All copy lives in [content/](content/) as JSON and Markdown; images added by editors go to `public/uploads/`. [src/lib/content.ts](src/lib/content.ts) loads and validates those files at build time, so the site never fetches content at run time. The editor at `/admin/` is [Sveltia CMS](https://sveltiacms.app/) 0.250.0, vendored in `public/admin/sveltia/` (no CMS code comes from a CDN). `/admin/` is not linked from the site, is `noindex` and has its own Content-Security-Policy.

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
  - Images: upload JPEG, PNG or WebP (not HEIC). Chrome re-encodes uploads as WebP, which drops camera metadata, and the build writes 640 px and 1280 px variants next to each one (`-640.webp`, `-1280.webp`; these names are reserved). The images that shipped before the CMS stay in `public/images/`: pick them under **Site images** or type their path.
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
  Expected: all pass; `Vendored @sveltia/cms@0.250.0 matches scripts/sveltia-cms.lock.json.`; `Content index is up to date.`; the HTML compare result from Task 10 still holds (docs do not change the build, so no rebuild is needed).

- [ ] **Step 4: Commit and hand off.**
  ```bash
  cd "$CMS" && git add README.md docs/operations/cloudflare-release.md && git commit -m "docs(cms): explain local content editing and the later GitHub setup" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -12 && git status --short
  ```
  Expected: 11 new commits on `feat/showcase-cms`, a clean tree. Call Cockpit `submit_progress` (summary, files, next steps: the controller merges after Part 1, see "Merge notes") and `set_task_status` `review`.

---

## Merge notes (for the controller, merging `feat/showcase-cms` after Part 1)

- **`src/lib/content.ts` is rewritten.** If Part 1 changed or added copy there (for example intro text), port the change into the matching `content/*.json` file, extend `content-model.ts` and `config.yml` if a field was added, then update `tests/fixtures/content-v1.json` (and `content-v1.d.ts` for a new export) for that deliberate change only, and record it under "Amendments". `npm test` (round-trip and mirror tests) shows exactly what is missing.
- **Fenced blocks** (`>>> CMS (showcase Part 3)` … `<<< CMS`) in `public/_headers` (end of file), `scripts/package-site.mjs` (before `let headers=`), `scripts/check-export.mjs` (before the last line), `scripts/check-seo.mjs` (before the broken-resource loop), `scripts/browser-check.mjs` (after the `x-content-type-options` assertion, and before the report is written) and `scripts/build-production.mjs` (before `const checks=`). They do not overlap Part 1's expected edits (model/Draco removal in the asset allowlists, globe assertions).
- **`package.json`:** the `build` line changes (index + variants before check-content); three scripts are added at the end of `scripts`; `js-yaml` is a new devDependency. Re-run `npm install --package-lock-only` after resolving a lockfile conflict.
- **Task 8's ten one-line edits** sit in section components that Part 2 will animate. When Part 2 rewrites one of those `<img>` elements, keep `{...contentImage(x)}` in place of `src={x}` (the Step 1 grep finds any missed site).
- **The site CSP** in `/*` can change independently (for example if Part 1 drops `'wasm-unsafe-eval'` with Draco); the admin rule removes whatever it is. `browser-check` compares each page with the current `/*` value, so no expectation needs updating.
- After merging, rebuild and run the heavy gates once; the HTML baseline must then be re-saved from the merged build (Part 1 changes the hero markup on purpose).

## Amendments made during execution

(Executors record here every deviation, failed expectation or extra normalization, with the reason.)

## Risks and open questions

1. **Turbopack and `with { type: "json" }`** is the one combination not probed in planning (all other tools were). Task 4 Step 8 exercises it first, before anything depends on it, and says what to do on failure.
2. **Fonts come from jsDelivr at run time on `/admin/` only.** The CMS code is vendored, but the IIFE bundle hard-codes its Fontsource URLs; blocking them turns the Material Symbols icons into words. The admin CSP allows only `https://cdn.jsdelivr.net/fontsource/` for fonts. Fully self-hosting fonts would need the npm build bundled with esbuild and `@sveltia/cms` plus its dependencies installed into the shared `node_modules`; left for later.
3. **Sveltia 0.250.0 was released on 2026-10-21**, the day of this plan, and the project releases several times a week. The pin is verified (integrity, hashes, schema validation of `config.yml`); upgrades follow the README procedure.
4. **Blocked optional requests.** The update check logs a CSP error in DevTools (harmless, try/catch in the bundle). A non-English browser gets an error about translations and falls back to English. HEIC uploads, maps, PDF thumbnails and code highlighting are unavailable; none is used.
5. **Linked worktree.** The local workflow saves into a linked worktree but cannot commit from the browser (Sveltia limitation); the owner commits with git.
6. **New entries** created in the CMS need the index regenerated; every build does that, and `npm test` names the stale index if someone tests before building.
7. **Upload variants are build output** (gitignored). Stale variants are reported, not deleted. Original uploads ship too (`uploads/**`, per the spec); the Chrome-side WebP re-encode strips camera metadata, but a file added outside the CMS keeps its metadata.
8. **`srcset` descriptors** for uploads narrower than 1280 px still say `1280w` (the variant is the original width); the browser may pick it slightly early. Harmless.
9. **Task 8** edits files Part 2 will rework (see "Merge notes"); it can be deferred.
10. **`js-yaml`** was already installed through ESLint; Task 9 only declares it (`--package-lock-only`), with a manual fallback.

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
- **Order:** Part 3 runs in parallel with Part 1. The controller merges `feat/showcase-cms` into `feat/spacegear-showcase` after Part 1 finishes, following the merge notes above, and re-saves the HTML baseline after the merge.
