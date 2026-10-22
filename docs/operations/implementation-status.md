# Implementation status — 2026-10-20

## Implemented locally

- Public name and canonical origin: **spacegear.tech**, **https://spacegear.tech**, confirmed by the owner.
- Twelve static pages: home, services index, five service pages, approach, about, contact, privacy and terms.
- Consultancy narrative, five service capabilities, engagement models, labeled illustrative workflow and useful FAQs. Open audience; no staff roster, scale assertions, fictional customer proof or invented prices.
- Charcoal/orange palette, local Inter/JetBrains Mono, orbital globe and poster fallback, curved footer curtain, service accordions. Scroll color/rise, mobile card stack and orbital badge motion are preserved with CSS enhancements and reduced-motion fallbacks.
- Static HTML/JSON-LD/metadata, sitemap, robots, canonical 301s and retired/unknown 404s.
- Cloudflare Worker/D1/Turnstile inquiry implementation, atomic inquiry/outbox writes, stable retry keys, bounded validation/rate limiting, notification leases/retries and inert preview configuration.
- Explicit Cloudflare asset packaging. Original assets are preserved; only the allowed routes/assets enter dist. Production packaging requires a fresh checkout.
- Font licenses and branded favicon/social image.

## Verified evidence

Evidence files under artifacts are local and ignored. Reports are not public production claims.

- Next static compilation, Cloudflare package validation and both application/Worker TypeScript checks passed. The final build:cf run passed after review, responsive-layout and focus fixes. The preview contains 177 files / 5.67 MiB including retained unused hashed chunks from prior local builds; fresh production packaging will not include that history.
- ESLint passed for all first-party source, Worker, script, test and config files.
- npm test: **15/15 passed**, including real local D1 concurrent duplicates, conflicting writes and transactional rollback.
- Local D1 migration applied successfully. Wrangler deployment dry run passed; Worker bundle was 16.44 KiB, 5.79 KiB gzip. No remote deployment occurred. The production build gate was also exercised and correctly rejected missing contact/policy approval.
- SEO crawl: **12/12 pages**, unique titles/descriptions/canonicals, one H1, parseable schema, visible no-JavaScript content, internal links/images, 301 and unknown/retired 404 checks.
- Browser suite: **6 profiles**; 320/390px mobile, 768px tablet, desktop, reduced motion, no JavaScript; no overflow/errors; actual text bounds on all 12 routes fit 320px. Mobile/reduced-motion/no-JavaScript make no GLB request. Failed WebGL preserves copy/poster/CTA. Desktop rendering stops offscreen.
- Actual form component tested with isolated local verification/API fixtures: expired challenge, 503, lost response, input retention, same retry ID, success reset and status focus. No real inquiry or email was sent.
- Globe asset: **1,450,416 bytes**, down from **10,372,724 bytes**. Observed local desktop resource bytes roughly 2.24 MB; mobile roughly 0.40 MB. These are unthrottled local observations with browser-specific compression/cache behavior, not guaranteed production transfer or Lighthouse scores.
- Browser version used: Chromium 156.0.8078.4; automation package version is pinned. PLAYWRIGHT_CHROMIUM_EXECUTABLE selected the installed browser because the default matching download was unavailable.

## Independent review and fixes

A fresh, read-only whole-branch review found no critical issues and two important defects. Both were reproduced with failing regression tests and fixed: configured forms now remain disabled until hydration and defensively POST, preventing native GET disclosure of inquiry fields; outbox claims atomically recheck due time so a stale concurrent selection cannot bypass retry backoff. The updated 15-test suite passes. A final browser check exposed a focus scheduling race; feedback focus now runs after React commits the status, and the browser recovery check passes. A separately detected 320px long-heading clipping issue is also corrected and covered by actual text-bound checks.

## Fidelity rebuild (feat/spacegear-fidelity)

The branch restores the original platform-clone design (snapshot `c249c4d`) with Spacegear copy from `src/lib/content.ts`. This section supersedes the globe size, file counts and test totals above.

Final review. A last whole-branch review found the following, and all of it is fixed:

- **CSP.** three's GLTF loader fetched the textures embedded in `earth-hq.glb` as `blob:` URLs, and `connect-src` blocked them. Under the shipped CSP, production would have shown a white, untextured globe that washed out the headline. `connect-src` then also allowed `blob:`. Superseded by Showcase Part 1 (below): the GLB and the Draco decoder are gone, `connect-src` no longer allows `blob:`, and `'wasm-unsafe-eval'` and `worker-src blob:` are removed too.
- **Preview headers.** Preview packaging appended a second `/*` rule for `X-Robots-Tag`, and the local preview then served only that header, so every earlier browser gate ran without the CSP. The tag now goes inside the existing `/*` rule, and production packaging is unchanged. `test:browser` now checks the CSP and nosniff headers, records CSP violations and blocked-texture errors on every route each profile visits, and checks that the globe's textures decode.
- **Lazy images.** Below-the-fold images are `loading="lazy"`, so React no longer preloads them. The hero preloads go through `ReactDOM.preload`, one per visitor: the poster with `fetchPriority="high"` on cinematic desktops, and the galaxy everywhere else. They are now first in the home `<head>`.
- **Accessibility.**
  - The engagement Select buttons have names that follow their visible text.
  - The capability ticker takes focus, so a keyboard or a tap can pause it.
  - `scroll-padding-top: 88px` keeps focused elements out from under the fixed nav, and anchors still land 96px from the top.
  - `/approach/` has an h2 between its h1 and the step h3s.
- **Hero stat.** The second stat reads "Ways to engage / Assess, build, improve", because its `03` counts the engagements.
- **Cleanup.**
  - Unused exports and engagement fields are gone.
  - Service art comes from `SERVICES[].image`. The What We Do featured card now shows `neural-net`, and the AI Strategy tile shows `neural-core`.
  - Unreferenced starter SVGs, fictional team photos, unused review photos, `space-bg.webp`, `seo/og.jpg` and `scripts/opt-images.mjs` are deleted.
- **Wider checks.** `check-export` scans every exported text file for old-identity strings. `check-fidelity` fails when a required section is missing from the original.

Gates from a clean build (`rm -rf out dist .next`) on 2026-10-21, after the final-review fixes:

- ESLint and both TypeScript checks: clean, no output.
- `npm test`: `# pass 29`, `# fail 0`.
- `Content valid: 12 routes; preview mode.`
- `Export valid: 12 core pages, 155 files, 11.47 MiB total.`
- `SEO crawl passed: 12 pages, 12 internal paths, 8 images, no-JS content, 404s and canonical redirect.`
- `Browser checks passed: 6 profiles; navigation, no-JS/reduced-motion, responsive layout and form recovery.` This run is under the enforced CSP.
- `check:fidelity` was **not** re-run after these fixes. The reference server on :3101 was stopped for low memory. Its last run, before the fixes, passed: every required section was `ok` on desktop and mobile, with height ratios 0.939–1.097. Instead, full-page screenshots of `/` at 1440×900 and 390×844 were compared before (`c52c575`) and after the fixes, by eye and with a pixel diff. Page heights are unchanged (11,290 px and 16,738 px). The only differences are:
  - the hero stat label;
  - the two swapped What We Do images;
  - animation frames (globe, ticker, pulsing dots, rotating badges).

Asset sizes and browser numbers. These are local, unthrottled observations, not Lighthouse scores or field data:

- `models/earth-hq.glb` 6,320,916 bytes; `images/hero-poster.webp` 85,116 bytes; `images/galaxy.webp` 305,952 bytes. (Showcase Part 1 replaced the GLB with texture tiers and re-captured the poster; its numbers are below.)
- Resource bytes per profile, after a full scroll: mobile-320 875 KiB, mobile-390 489 KiB, tablet 875 KiB, desktop 7,753 KiB, reduced motion 875 KiB, no JavaScript 731 KiB.
- CLS per profile: 0.005, 0.004, 0.003, 0.001, 0.000 and 0.000.

Sign-off checklist. Each side-by-side sheet was reviewed by eye, original against candidate. Hero beats 2–3, the nav states, the dropdown, the mobile menu, the tile hover and the footer curtain at 1440×1000 were also checked with matching screenshots of both sites. Content differences are expected.

- [x] Nav: pill bar, 0.3 alpha at the top and 0.85 after scrolling, as in the original; orange `space—gear™` with a light dash; Services ▾ dropdown; ghost "Discuss a project" button; hamburger panel on mobile.
- [x] Hero, desktop beat 1: globe on the right, sun haze top left, star field; four-line headline; pitch and calendar CTA; `05`/`03` stats; corner card; "Scroll to explore" pill.
- [x] Hero, beats 2–3: the globe shrinks to the centre, the statement fills word by word, and then the rounded curtain panel slides over. The statement runs to five lines against the original's four because the copy is longer.
- [x] Hero, mobile: galaxy backdrop, centred copy, statement below.
- [x] What We Do: grey→white title, `001 / space—gear` row, 2×2 featured card, orange lineup panel, four tiles with hover zoom and description, pulsing tile, assessment card with a 33% bar, stacking cards on mobile. Hover descriptions sit lower in the tile than the original's because they are three lines instead of four; the layout is the same.
- [x] Our Services: five columns, one expanded with its image; Core Services `5/5` card.
- [x] Our Process: timeline with four dots, four cards with output counts, CTA banner.
- [x] What We Measure: illustrative header, three-card top row, four-card bottom row with bars, marquee, arrow CTA. Before sign-off, the bottom row was 328 px against the original's 280 px because two longer tags wrapped. Commit `444baf6` fixed this, and the row is now 280 px.
- [x] Engagements: three rows ("Start here" on Assess), stage and toggle, stacked cells, two-column ✓ list, selected glow, swipe carousel on mobile.
- [x] Questions & Answers: eight items, the first open with the orange ×; sticky grayscale photo card with the rotating badge.
- [x] Who You Work With: carousel card with dots, name/role/bio, image column, arrows. The original's social icon column is absent until real profiles exist.
- [x] Footer: three bentos, rotating badge, giant wordmark inside its cell, link columns with dot headers, quick-start form, bottom bar (Privacy/Terms in place of social icons), curtain reveal at 1440×1000.

Known follow-ups (not blockers):

- Process CountUp briefly shows N→0→N as it enters view; the fade-in masks it.
- SnapRow dots have 6 px targets, generic labels and no `aria-current`. This is inherited from the original.
- Work tile descriptions are hover-only at ≥lg, so touch devices in landscape (iPad) do not see them.
- The footer curtain flash on the contact page's first paint is original behaviour.
- The unlayered `* { border-color }` rule from the original stylesheet overrides Tailwind border-colour utilities, so `focus:border-flame` on the footer inputs has no effect, as in the original. Focus stays visible through the global `:focus-visible` outline.
- Owner decision: touch tablets in landscape (for example an iPad at 1180×820) download the 6.3 MB globe, because the desktop query checks only width and motion. Adding `(hover: hover)` would skip it there, but it would also change the hero on touch laptops. (Since Showcase Part 1 such a tablet gets the cinematic hero with the 2k set, 660,662 bytes, and never the 4k set, which needs a fine pointer.)
- Owner decision: on Save-Data desktops, the hero reserves the cinematic's 300vh before hydration and then collapses to the static hero.

Remaining owner inputs:

- Founder name, photo and bio for the team card.
- Real, permission-confirmed testimonials and published articles.
- Social profile URLs.
- Switching ™ to ® once the mark is registered.
- Confirming the hero line "The smarter way to plan, build, and scale your business".
- Confirming the hero stat wording "Ways to engage / Assess, build, improve".
- Confirming the process commitments on /about/ and the service pages: "We evaluate AI against simpler alternatives", "Make handover part of delivery", and "Scope, access, responsibilities and acceptance criteria are agreed before delivery".
- The contact email and policy approval listed below.

## Still required for a public launch

- The confirmed public/contact destination email (asked; unanswered).
- Review of concrete privacy/terms and an actual retention/deletion procedure.
- Accessible Cloudflare account/zone, production D1, Turnstile widget/secret, supported sender and verified owner workflow.
- GitHub source reconciliation. The supplied repository was empty at inspection; direct clone attempts failed. This work is in the preserved local Git worktree, not a claimed remote clone.
- Lighthouse's required three cold audits per representative template/profile, full live accessibility/production security checks, field Web Vitals after traffic, and domain-level crawler/WAF review.
- Real production build/configuration, deployment, smoke tests, Search Console/Bing submission and optional Cloudflare Web Analytics token.

Cloudflare plugin discovery returned no available connector. Wrangler whoami failed to connect in this environment. No account absence is inferred, no secret was printed, and no public deployment or real email delivery is claimed.

## Execution decisions

Work stays on feat/spacegear-revival in the sibling worktree; the original platform-clone working tree remains untouched. Direct tools are used under the owner's Cockpit bypass. Source deletion was rejected by environment policy, so original art is preserved and packaging uses an allowlist. Package history is not silently removed. Production launches require a fresh checkout and explicit publication variables.

Numerical SEO/AI-search/ranking guarantees are not claimed. The implemented search foundations are testable; public indexing and model citations depend on external systems.

## Showcase Part 1: globe and hero (feat/spacegear-showcase)

- The hero globe is a procedural sphere with custom GLSL (day/night terminator, brand-orange twilight, warm city lights, ocean glint, relief, cloud shell with shadows, fresnel atmosphere), ACES Filmic at exposure 1.2 with sRGB output. The GLB, the Draco decoder, `scripts/opt-globe.mjs` and `@react-three/drei` are gone; `check-export` fails if a GLB or Draco file ships, in any letter case.
- Texture tiers from `scripts/build-globe-textures.mjs` (WebP): 1k 189,692 B, 2k 660,662 B, 4k 2,182,272 B. The desktop first frame adds the existing 305,952 B galaxy. The previous desktop globe download was 6,320,916 B (GLB) plus the Draco decoder.
- The source model's cloud alpha is inverted (opaque where the sky is clear); the old material drew it as a dark film, which caused the blotchy look.
- First-visit intro (desktop only, once per tab session), skipped for reduced motion, no JavaScript, Save-Data, slow connections, deep links and repeat views; it reveals at most 2.5 s after the globe is ready and at most 4 s after first paint, and a CSS failsafe hides it if its script never runs.
- Devices: desktops show the 2k set, then stream the 4k set after the intro and an idle callback when the GPU is hardware, the pointer is fine (a mouse or trackpad), the texture limit is at least 4096, memory is 8 GB or unreported and the connection is not slow. Phones and tablets show a 1k globe when they have WebGL2, 4 GB or unreported memory, no Save-Data and no slow connection, mounted only after the load event once the page is still; otherwise the galaxy. Reduced motion, no JavaScript, Save-Data and missing WebGL2 on desktop show the re-captured poster (2400 px wide, 141,374 B, and a 3840 px candidate of 248,044 B for high-density screens and tall windows).
- CSP: with the GLB and Draco gone, the site policy no longer allows `blob:` in `connect-src`, `'wasm-unsafe-eval'` in `script-src` or `blob:` in `worker-src` (now `'self'` only). A probe under the served policy (2k then 4k texture loading, the `<img>` decode fallback, the static poster, and the real Turnstile widget on `/contact/` with Cloudflare's always-pass test key) saw no violation, no worker and no WebAssembly call; positive controls confirmed that a `blob:` fetch, a WebAssembly compile and a `blob:` worker are each blocked and reported. `img-src` keeps `blob:` for the `<img>` decode fallback.

Measured on 2026-10-22 on the merged branch, local preview, headless Chromium 156.0.8078.4 with the integrated AMD GPU (ANGLE D3D11), unthrottled. These are local lab observations, not Lighthouse scores or field data. Bytes are `resourceBytes` in `artifacts/browser-report.json`: the encoded body bytes of the resource entries of the profile's home page at the point where browser-check records them, so profiles whose flows differ are not directly comparable. `textures` counts globe texture requests over the whole profile; desktop and mobile-390 load the home page twice (a reload, and a return from `/services/`), so they request each map twice. The table is the first of the two final `test:browser` runs. The second recorded the same bytes; its LCP and long tasks differed, as they do from run to run on this loaded machine (desktop LCP 260 ms, reduced-motion LCP 1,268 ms).

| Profile | Bytes | JS | Texture requests | CLS | LCP | Long tasks |
|---|---|---|---|---|---|---|
| mobile-320 | 1,338,924 | 476,748 | 5 (1k) | 0.002 | 416 ms | 2 (longest 127 ms) |
| mobile-390 | 908,518 | 476,748 | 10 (1k, twice) | 0.002 | 172 ms | 0 |
| tablet | 1,338,924 | 476,748 | 5 (1k) | 0.001 | 252 ms | 1 (54 ms) |
| desktop | 1,788,612 | 476,748 | 10 (2k, twice) | < 0.001 | 340 ms | 2 (longest 89 ms) |
| reduced motion | 741,363 | 233,457 | 0 | 0 | 792 ms | 0 |
| no JavaScript | 500,345 | 0 | 0 | 0 | none recorded | 0 |

- Desktop resource bytes: 1,788,612 B, against 7,753 KiB recorded for the GLB globe in the fidelity section above.
- The 4k stream on a page that reports a capable desktop GPU (`scripts/globe-stream.mjs`): 2,182,272 B, each map fetched once; the globe maps take 29.3 MiB of GPU memory at 2k and 117.3 MiB at 4k, and all the page's textures together peak at 178.8 MiB during the swap and hold 149.5 MiB after it; no long task over 100 ms while it streams apart from the first 4k upload's.
- The first 4k upload's long task may take 120 ms. On 2026-10-22, with the machine loaded by other jobs, the first measurement went over it in three of four clean runs after the merge (135, 153 and 170 ms, 126–163 ms of it inside the `texSubImage2D` call). Measured again on a fresh page in the same browser, each was under 50 ms. `browser-check` now measures it again before failing, and fails only when both measurements are over; a first upload made 120 ms slower fails both (151 ms, then 147 ms).
- Not measured here: frame rate and long tasks on the owner's GPU (GTX 1660 Ti) and whether the 4k swap is visible there. The controller runs that pass in the owner's Chrome.

## Showcase Part 3: content and CMS (merged into feat/spacegear-showcase)

- `feat/showcase-cms` is merged into `feat/spacegear-showcase` (merge commit `489ea02`); `master` is untouched. The copy lives in `content/` as JSON and Markdown and is validated at build time by `src/lib/content.ts`; Sveltia CMS 0.230.1 is vendored at `/admin/` under its own CSP, and uploads under `/uploads/` are served sandboxed. See README.md, "Editing content" and "Maintaining the CMS".
- One merge conflict, in `scripts/check-export.mjs` (the CMS checks sat after the Draco line that Part 1 removed); both sides' checks are kept. The exported pages render the same as before the merge apart from the new `admin/index.html`; one client module id was renumbered, with the same export, place and factory code. The site stylesheet is byte-identical to the pre-merge one, after rewording two class-like words in the CMS plan and a test.
- After the merge, `test:browser` reads the hero copy it selects by (the CTA's label and link, the corner card's link) from `content/home.json`, so a valid CMS edit does not fail it; this was checked on a build with an edited CTA label, headline tail and corner link.
- The export is 173 files and 10.39 MiB (Part 1 alone: 167 files, 7.94 MiB).
- Rendering CMS uploads through their 640 px and 1280 px variants (CMS plan Task 8) is deferred until after Part 2; until then an upload renders as its original.
- Still to do with the owner: the manual check of `/admin/` in Chrome or Edge.
