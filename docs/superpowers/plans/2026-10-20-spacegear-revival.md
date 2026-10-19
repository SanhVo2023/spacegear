# Spacegear Website Revival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:subagent-driven-development only if that execution approach is explicitly selected. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the existing Platform website as Spacegear's digital transformation and AI strategy/delivery consultancy, preserving its aesthetic and motion while delivering a fast, searchable Cloudflare-only website.

**Architecture:** Keep Next.js and export content pages to static HTML served by Cloudflare Workers Static Assets. A same-origin Worker handles inquiries with Turnstile, D1 and an email outbox. Repository content is the source for pages, navigation, metadata and sitemap.

**Tech Stack:** Existing Next.js 16/React 19/TypeScript/Tailwind/Motion/Three.js, Sharp, Cloudflare Workers/Static Assets/D1/Turnstile/email/Web Analytics. Pin compatible versions during implementation; do not upgrade the framework wholesale without a demonstrated need.

**Spec:** [Spacegear design brief](../specs/2026-10-20-spacegear-revival-design.md). Read with the [source audit](../../audits/2026-10-20-spacegear-site-audit.md).

## Global constraints

- Replace the old company and product identity throughout the website.
- Preserve the existing aesthetic and animations.
- Host and run the website exclusively on Cloudflare.
- Optimize speed, technical SEO and visibility in AI-assisted search.
- Clone the intended repository when its source URL is available.
- Never overwrite or discard the current uncommitted implementation. No remote is currently configured; a clone of HEAD alone would contain only the starter project.
- Spacegear is the working spelling. Final domain and company facts must be confirmed before publication; local previews may use explicitly marked configuration placeholders.
- Initial HTML contains visible headline, service descriptions, links and CTA. No opacity-zero dependency for essential copy; JavaScript and WebGL are enhancements.
- Narrow screens use the existing static cosmic direction with lightweight optional motion; no GLB request. Reduced motion means no continuous particle, marquee, rotating badge or scroll-scrub animation.
- No fictional testimonials, staff, company addresses, product claims, partnerships, performance statistics or subscription prices.
- The current scope is a plan. Implementation and public launch are later steps; do not treat this document as evidence that either has occurred.

## Review focus

1. A visitor loses JavaScript/WebGL or requests reduced motion: content and inquiry/contact routes remain usable; no continuous reduced-motion animation (Task 3).
2. A user retries after a timeout or email failure: exactly one durable inquiry is captured per idempotency key; clear recovery and notification status (Task 5).
3. A crawler opens an unknown or retired route: correct 404/410 or a meaningful one-hop redirect, never an indexable homepage fallback (Tasks 4 and 6).
4. No publishable client/team proof exists: useful, truthful pages still launch; no empty case-study routes, fake people or schema claims (Tasks 1, 2 and 6).
5. A visitor opens mobile navigation or tabs through the page at 200% zoom: links, controls, focus and long content remain reachable and legible (Tasks 3 and 7).

## File responsibilities

Existing files listed below were inspected. New files are proposed; implementation may split focused modules further without changing the contracts.

| Files | Responsibility |
|---|---|
| `src/lib/site.ts` (new) | Single brand/site origin/contact/publication configuration; production validation |
| `src/lib/content.ts` (replace contents) | Typed service, insight, engagement, use-case and optional case-study content; retire the fictional product model |
| `src/lib/seo.ts`, `src/components/StructuredData.tsx` (new) | Metadata and escaped JSON-LD helpers |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` | Root metadata, shared styling, homepage composition |
| `src/components/Nav.tsx`, `src/components/ui.tsx`, `src/components/sections/*` | Existing visual language with Spacegear content and accessible controls |
| `src/components/sections/OrbitalCinematic.tsx`, `src/components/EarthScene.tsx`, `src/components/Starfield.tsx`, `src/components/motion.tsx`, `src/components/Reveal.tsx`, `src/components/CurtainShell.tsx`, `src/components/StackCards.tsx`, `src/components/ScrollColorTitle.tsx`, `src/components/DotField.tsx` | Motion behavior, visible initial content, capability fallbacks and render cost |
| `src/app/services/page.tsx`, `src/app/services/[slug]/page.tsx` (new detail route) | Service index and five static service pages |
| `src/app/approach/page.tsx`, `src/app/about/page.tsx`, `src/app/contact/page.tsx` (new) | Company and conversion pages |
| `src/app/insights/page.tsx`, `src/app/insights/[slug]/page.tsx` (new) | Insight index and substantive articles, replacing Labs |
| `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/not-found.tsx` (new) | Policies and useful missing-page content |
| `src/app/work/[slug]/page.tsx`, `src/app/labs/[slug]/page.tsx` | Remove fictional content; replace or retire deliberately using the URL inventory |
| `src/app/sitemap.ts`, `src/app/robots.ts` (new) | Build-time discovery files from published routes |
| `src/components/ContactForm.tsx`, `src/lib/contact.ts` (new) | Accessible form and shared request/result types |
| `worker/index.ts`, `worker/contact.ts`, `worker/notifications.ts`, `worker/redirects.ts`, `worker/types.ts` (new) | Worker entry, validation/capture, notification outbox and routing |
| `migrations/0001_inquiries.sql` (new) | Inquiry/outbox tables, idempotency key and uniqueness constraints |
| `next.config.ts`, `wrangler.jsonc`, `tsconfig.worker.json`, `package.json`, lockfile | Static export, typed Cloudflare bindings, commands and build dependencies |
| `public/_headers`, `public/_redirects` (new) | Static response policies and meaningful legacy mappings; generated where environment-specific |
| `assets/source/` (new), `scripts/opt-images.mjs`, `public/images/`, `public/models/`, `public/seo/`, `src/app/favicon.ico` | Preserve source art outside public output; optimized, branded deployable assets |
| `scripts/check-content.mjs`, `scripts/check-export.mjs`, `scripts/check-seo.mjs`, `scripts/audit-site.mjs` (new) | Publication validation, export and route/SEO/performance evidence |
| `tests/contact.test.ts`, `tests/notifications.test.ts`, `tests/routing.test.ts`, `tests/motion.spec.ts`, `tests/navigation.spec.ts` (new) | Meaningful failure/interaction coverage, not tests that repeat static copy |
| `README.md`, `docs/operations/cloudflare-release.md` (new operations doc) | Cloudflare-only build, environment setup, launch and rollback |

## Task 1: Preserve the source and define the truthful content model

**Files:** `src/lib/site.ts`, `src/lib/content.ts`, `scripts/check-content.mjs`; `docs/operations/source-provenance.md` (new).

**Interfaces:** `SITE` provides `name`, `description`, `origin`, `contactEmail?`, `legalName?`, `socialProfiles[]`, `publicationMode: 'preview' | 'production'`. `Service` provides `slug`, `name`, `summary`, `buyerProblem`, `deliverables[]`, `process[]`, `faqs[]`, `relatedInsightSlugs[]`. `Insight` provides `slug`, `title`, `summary`, structured body sections, optional verified author, ISO dates and sources. `CaseStudy` requires evidence/approval fields and explicit `published`; no default case studies are published. Exports: `SERVICES`, `INSIGHTS`, `ENGAGEMENTS`, `USE_CASES`, `CASE_STUDIES`.

- [ ] Record `git status --short`, `git diff --stat`, current commit/remotes, and a manifest of required untracked code/assets. Preserve existing work before branch changes. Do not stash/delete it silently or stage everything.
- [ ] Once the source URL is supplied, clone it into a new, verified-empty workspace subfolder and reconcile it with this local working tree. If credentials are required, request the exact clone command through Cockpit; never put tokens in the URL. Record the chosen source and differences. If the URL is still missing, keep local preview work explicitly based on this folder and mark remote cloning pending.
- [ ] Confirm or mark as preview-only the final spelling, domain, company/contact facts and service scope. Use the five service routes and hero copy from the spec as the proposal.
- [ ] Replace the product-centric content model with the interfaces above. Keep brand-sensitive strings centralized; remove Platform metadata, real-looking placeholders and obsolete offers from publishable data.
- [ ] Add publication validation that rejects unknown internal slugs, duplicate slugs, missing required copy, production placeholder origins, unverified case studies and absent launch contact facts. Missing optional testimonials/team biographies must result in omitted sections, not a failed local preview.
- [ ] Run `node scripts/check-content.mjs`: expected exit 0 for a complete preview dataset; a deliberately invalid production fixture must fail with named missing fields. Restore valid fixtures after verification.
- [ ] Commit only this task's deliberate changes: `chore: preserve source and define Spacegear content`.

**Done:** local source is safe, clone status is honest, and content can drive all future routes without inventing company facts.

## Task 2: Build the consultancy information architecture and replace the identity

**Files:** app pages and content/navigation/section files in the file map; brand assets; legacy route inventory in `docs/operations/source-provenance.md`.

**Interfaces:** `getPublishedRoutes(): { path: string; kind: string; lastModified?: string }[]` in `src/lib/site.ts` consumes the published content exports. Canonical paths end in `/`. Every page uses one H1 and links to valid routes. `generateStaticParams()` enumerates only published slugs; dynamic routes set `dynamicParams = false`.

- [ ] Implement home and five service pages using the specific buyer problems/deliverables in the spec. Keep the bento, expandable service cards and existing typography/layout vocabulary.
- [ ] Implement approach/about/contact shell, insight index and two reviewed insight articles, policies and not-found page. Policies must describe the actual form flow; preview copy must not be deployed as approved company/legal facts.
- [ ] Replace pricing with engagement cards; replace product/work metrics with labeled use cases and measurement criteria; omit testimonials and actual staff biographies until supplied. Keep capability examples distinct from evidence of client work.
- [ ] Update `Nav.tsx`, shared section labels in `ui.tsx`, footer, favicon, logo/badge and social images. Footer links resolve to actual pages or verified profiles; remove the inert newsletter.
- [ ] Inventory all five `/work/*` product paths, four `/labs/*` article paths and old section hashes. Record `replace`, `redirect` or `retire` with a content rationale. Do not redirect unrelated old product pages to a consulting service merely to avoid a 404.
- [ ] Run `node scripts/check-content.mjs` and `npx tsc --noEmit`; expected exit 0. Review rendered desktop/mobile copy against the spec; scan old identity without blanket-renaming legitimate generic uses of “platform.”
- [ ] Commit `feat: establish Spacegear consultancy pages and identity`.

**Done:** a coherent, truthful consultancy site replaces the old business in visible content and navigation, with no fake proof sections.

## Task 3: Preserve the motion while fixing readability, accessibility and asset cost

**Files:** existing motion/hero components, navigation, FAQ/card controls, global CSS, media pipeline and assets; `tests/motion.spec.ts`, `tests/navigation.spec.ts`.

**Interfaces:** `OrbitalCinematic` always renders the semantic hero once and upgrades only a decorative layer. Optional 3D receives progress and an explicit active/rendering state. Animation wrappers accept server-rendered children and must preserve visible HTML without JavaScript. Static and enhanced views use the same text and links.

- [ ] Capture before/after reference views at equivalent scroll positions, plus mobile and reduced-motion states. Include the globe hero, statement, bento cards, services, engagement cards and curtain footer.
- [ ] Add behavior checks that fail on the current defects: reduced-motion Starfield schedules no recurring frame; no-JS headline/service content is visible; disabling WebGL or failing the GLB still shows the poster/copy; phone-sized pages do not request GLBs.
- [ ] Decouple copy from scene mounting, reserve hero geometry and remove entry-opacity gating for essential text. Use a local poster immediately and dynamically import only the optional scene; inspect preloads to avoid accidental mobile downloads.
- [ ] Fix reduced-motion behavior across particles, dot fields, marquees, badges, parallax, scroll text and carousels. Pause offscreen/background loops and clean up listeners/animation frames. Review all reduced-motion preferences dynamically.
- [ ] Resolve the existing lint findings in `EarthScene.tsx`, `Starfield.tsx` and `OrbitalCinematic.tsx` during these changes: hook-returned texture mutation, render-time ref assignment, effect-driven mounting state, JSX comment text and the unused counter. Keep the lint rules enabled.
- [ ] Preserve raw masters under `assets/source/` outside the public output; update `scripts/opt-images.mjs`. Generate responsive image variants and an optimized globe, comparing visual fidelity. Use local codecs/fonts; remove unrelated third-party runtime asset requests. Keep the old master until the replacement is verified.
- [ ] Add keyboard-operable dropdowns, proper expanded/controls attributes, Escape/focus return, focus styles, accessible FAQ controls and reduced-motion carousel presentation. Check contrast, 200% zoom, long text and sticky-header overlap.
- [ ] Run motion/navigation behavior tests and inspect browser requests/frame behavior. Assert 0 mobile GLB requests, no hidden essential content with JavaScript disabled, and the asset budgets in the spec. A screenshot alone cannot prove these behaviors.
- [ ] Commit `perf: preserve Spacegear motion with accessible fallbacks`.

**Done:** the recognizable visuals survive and degrade cleanly; the 10 MB hero dependency is no longer on the initial content path.

## Task 4: Make the production artifact run entirely on Cloudflare

**Files:** `next.config.ts`, `wrangler.jsonc`, `worker/index.ts`, `worker/redirects.ts`, `worker/types.ts`, `tsconfig.worker.json`, `public/_headers`, `public/_redirects`, package scripts, `scripts/check-export.mjs`, `tests/routing.test.ts`, README.

**Interfaces:** Worker exports `fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>`. `Env` exposes `ASSETS`, `DB`, `TURNSTILE_SECRET_KEY`, site/origin configuration and only the chosen Cloudflare email binding. `/api/*` reaches Worker code before asset handling; normal pages are served as assets. No Next.js server is needed in production.

- [ ] Read the installed Next.js static export/metadata guides and current Cloudflare configuration schema. Add pinned Wrangler/build/test tooling only as required.
- [ ] Configure `output: 'export'`, `trailingSlash: true` and static params. Use responsive build-generated `<picture>` sources or a verified Cloudflare custom image loader; do not rely on the default Next.js image optimization server.
- [ ] Configure assets directory `./out`, binding `ASSETS`, `html_handling: 'force-trailing-slash'`, `not_found_handling: '404-page'` and `run_worker_first: ['/api/*', ...explicitLegacyHandlerPatterns]`. Pin the compatibility date chosen for implementation. Verify patterns do not intercept all normal static requests unnecessarily.
- [ ] Generate static headers and explicit redirects; set response headers separately for API/handler responses. Fingerprinted assets can be immutable; do not give unhashed HTML or robots/sitemap a year-long immutable policy. Verify update visibility across deployments.
- [ ] Add routing tests for direct deep links, slash normalization, `.html` variants, an unknown URL, unknown slug, old route mapping, asset request and navigation to an API path. Expect final canonical HTML 200, unknown content 404/410, intended single-hop permanent redirects and API method rejection rather than HTML fallback.
- [ ] Add package scripts `build:cf`, `preview:cf`, `check:export`, `test:workers`; build runs Next export and export validation. The export check rejects `gen-raw/`, oversized assets, source files/secrets and absent expected route HTML.
- [ ] Verify `npm run build:cf`, `npm run check:export`, `npm run test:workers`, then serve the production artifact with the local Cloudflare runtime. Expect zero test failures and no reliance on Vercel services. Never use `next start` as evidence for Workers compatibility.
- [ ] Commit `build: serve Spacegear with Cloudflare static assets and Worker routes`.

**Done:** a reproducible Cloudflare-compatible artifact exists, with real status codes and complete deep-link behavior.

## Task 5: Deliver a reliable consultation inquiry flow

**Files:** contact form/page, `src/lib/contact.ts`, `worker/contact.ts`, `worker/notifications.ts`, Worker entry/types, migration, `tests/contact.test.ts`, `tests/notifications.test.ts`, operations guide.

**Interfaces:** `ContactInput = { submissionId: string; name: string; email: string; company?: string; service?: string; message: string; turnstileToken: string; website?: string }`. `website` is a honeypot. Result is `{ ok: true; inquiryId: string }` or `{ ok: false; code: string; fieldErrors?: Record<string,string> }`. `handleContact(request, env): Promise<Response>`. `drainNotifications(env): Promise<{ sent: number; failed: number }>` runs on a schedule. Email transport is isolated behind `notifyOwner(inquiry, env): Promise<void>` so account-supported Cloudflare sending can be selected without changing capture semantics.

- [ ] Add local Worker integration tests with D1, mocked Turnstile and a non-sending email transport. Assert no write for invalid fields/origin/token; one inquiry/outbox pair for valid input; no duplication on retry; no success on database failure; accepted inquiry survives email failure.
- [ ] Validate a UUID submission ID, name 2–100 characters, email ≤254 characters with normal email syntax, company ≤200, message 20–3000, token ≤2048 and an allowed service slug. Limit body to 16 KiB. Allow common legitimate email domains; “work email” is a label, not a reason to reject valid users. Reject unexpected origins and populated honeypots.
- [ ] Verify Turnstile server-side, including configured hostname and action `contact`. Apply endpoint rate limiting, initially 5 attempts per 60 seconds per client key with bounded retention; document the actual Cloudflare mechanism and account support rather than assuming a universal plan feature.
- [ ] Create D1 inquiry/outbox tables. Atomically insert with a unique submission key and a normalized payload hash excluding the challenge token. Same key/same payload returns the original result; same key/different payload returns conflict. Concurrent duplicates must not create two inquiries.
- [ ] Return 202 for newly stored inquiry, 200 for a confirmed identical retry, 400 for fields, 403 for challenge/origin, 409 for key conflict, 413 for size, 429 for throttling, 503 for transient capture failure. All responses use `Cache-Control: no-store`. Keep responses non-sensitive.
- [ ] Implement outbox claim/lease, bounded retries and failed status. Retry transient notification failures at most 5 times; scheduled processing every 5 minutes is adequate for this small site. External email delivery is at-least-once unless the provider supports idempotency: include inquiry ID so an occasional repeated notification is identifiable. Alert/inspect failed rows without logging the inquiry body or email.
- [ ] Connect the accessible form. Load Turnstile on the contact journey, preserve inputs on failure, reset/reacquire tokens when needed, keep idempotency key stable on retry and generate a new key for a new successful inquiry. Show success as “Your inquiry has been received,” not “email delivered.”
- [ ] Verify owner notification capability through the actual account before launch. Current Cloudflare Email Sending documentation is beta; use supported sending to the verified owner, or explicitly operate captured inquiries from D1 until available. Do not substitute an external email provider or claim an inbox workflow works without testing. No unsolicited real test messages during planning.
- [ ] Run `npm run test:workers` and form browser checks for validation, network timeout, retry, double click, token expiry, DB failure and notification failure. Expected durable capture semantics match the tests above.
- [ ] Commit `feat: capture Spacegear consultation inquiries on Cloudflare`.

**Done:** inquiries are actionable and durable, failures are recoverable, and the owner has a verified way to receive/review them.

## Task 6: Implement and validate search foundations

**Files:** SEO helpers, structured data component, metadata in all app routes, sitemap/robots, publication configuration, route maps, `scripts/check-seo.mjs`.

**Interfaces:** `buildMetadata({ title, description, path, image? }): Metadata`; `canonicalUrl(path: string): string`; `getPublishedRoutes()` from Task 2. Structured-data serialization escapes `<` and uses only public verified fields; stable entity IDs derive from the confirmed origin.

- [ ] Implement distinct title/description/canonical/social metadata per template. Root title proposal: `Spacegear | Digital Transformation & AI Consulting`. Canonicals use final published paths; all Open Graph images are accessible and branded.
- [ ] Add truthful Organization/WebSite plus relevant Service, Article and BreadcrumbList data; omit missing facts and unsupported reviews. Service schema does not imply eligibility for a dedicated rich result.
- [ ] Generate static sitemap and robots from publishable routes. Verify exported metadata routes with the installed Next.js version; add explicit static configuration if required. Exclude drafts/unknown studies/private endpoints. Staging has environment-appropriate `noindex`; production does not inherit it.
- [ ] Implement `node scripts/check-seo.mjs <base-url>` to crawl all expected pages and check status codes, one canonical, unique titles/descriptions, H1s, broken links, image/OG responses, robots, sitemap and JSON-LD parseability. Unknown-route tests assert a real non-200 response.
- [ ] Test empty optional proof data: no fake testimonials, staff/author assertions or `/work/` sitemap entries. Verify all core content remains in the HTML response and visible without JavaScript.
- [ ] Compare export checks with Cloudflare responses, including legacy redirects and canonical origin normalization. Review actual WAF/robots/bot behavior; do not infer legitimate crawler access from spoofed user-agent requests alone.
- [ ] Define an editorial owner/review cadence and genuine bylines. Confirm target-market intent before expanding articles. Optionally add `llms.txt` only if there is a consuming tool requirement; do not treat it as an SEO score improvement.
- [ ] Run export/crawl validation, schema validation and supported rich-result tests; expect zero blocking errors. Register Search Console/Bing and submit sitemap only after domain ownership and launch configuration are available.
- [ ] Commit `feat: add Spacegear metadata structured data and discovery files`.

**Done:** the site explains the business clearly to people and crawlers, with complete technical discovery and no invented ranking claims.

## Task 7: Validate the full experience and launch on Cloudflare

**Files:** `scripts/audit-site.mjs`, browser behavior tests, performance report artifacts, `docs/operations/cloudflare-release.md`, README; fixes where measurements justify them.

**Interfaces:** audit command accepts an explicit target origin and emits versioned JSON/HTML reports with tool version, profile, timestamp and tested commit. Never report a synthetic score as a field metric. Deployment runbook names required bindings/vars, verifies the final domain and defines rollback.

- [ ] Run type checks, lint, production export, Worker tests and route/content validation. Resolve real failures; do not disable rules or remove checks to manufacture a green result.
- [ ] Inspect desktop, tablet and mobile visual references and all navigation, service links, article links, form states, legal links and 404 behavior. Exercise reduced motion, no JavaScript, failed WebGL, slow connection, keyboard-only use and 200% zoom. Check for a horizontal page overflow at 320/390 px.
- [ ] Run three cold Lighthouse audits per representative template on mobile and desktop using pinned settings. Target 100 in every category; gates are SEO/accessibility/best practices 100, performance median ≥95 and no run <90. Record scores and unresolved findings rather than averaging unrelated templates.
- [ ] Measure initial assets including prefetches, layout shifts at hero upgrade, long tasks during scroll, model payload and first interaction responsiveness. Enforce JS/transfer budgets from the spec or document the measured appearance/performance tradeoff before release.
- [ ] Produce a concrete preview release package: exact source commit, build artifacts, test reports, URL/status map, D1 migration, environment names, Cloudflare routing/caching/bot settings and rollback version. Protect preview and use separate preview/prod data/resources.
- [ ] Register the project in Cockpit if still absent. Route credentialed commands, domain/cloud changes and deployment through `request_owner_command` with exact executable/args and vault secret **names**, following the user's AGENTS instructions. Await results in Cockpit. Do not invent a command/account ID before the project and resources exist.
- [ ] Connect Cloudflare Workers Builds to the confirmed source repository; run the same checks in builds, then deploy the tested version to the confirmed domain. Set production bindings, verified contact destination, final canonical origin and crawler policy. Keep optional AI products disabled unless separately scoped.
- [ ] Smoke-test canonical home/service/article URLs, redirects, robots/sitemap, TLS, static cache behavior, 404s, inquiry capture and owner workflow on production with authorized test data. Submit the sitemap, then observe errors and discovery rather than assuming immediate indexing.
- [ ] Enable Cloudflare analytics and privacy-conscious vitals monitoring. Track LCP/INP/CLS at p75 by mobile/desktop when traffic is sufficient; review qualified inquiry rate, form failures, bot access and crawl coverage. Do not treat missing CrUX data as a passing score.
- [ ] Commit release documentation and record `submit_progress`. In a Cockpit task worktree, set status `review` once implementation evidence is ready, or note a concrete external blocker. Preserve the previous Worker version and captured inquiries for rollback.

**Done:** the deployed site meets the measured release gates, the owner can act on inquiries, and operational checks continue after launch.

## Plan review and current handoff

The design was independently checked using the brainstorming skill's builder-check prompt; result: **nothing important left**. This plan was checked against all design sections, the five review-focus conditions, route/content contracts, static export limitations and truthful publication fallbacks.

No implementation task above is marked complete. This planning stage produced the audit, design, plan and baseline screenshots. Remote cloning still requires the source repository URL; production setup also requires the final domain/company facts and a registered Cloudflare/Cockpit project. Local analysis and planning have proceeded without pretending those inputs exist.
