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

- **CSP.** three's GLTF loader fetches the textures embedded in `earth-hq.glb` as `blob:` URLs, and `connect-src` blocked them. Under the shipped CSP, production would have shown a white, untextured globe that washed out the headline. `connect-src` now also allows `blob:`; nothing else was loosened.
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

- `models/earth-hq.glb` 6,320,916 bytes; `images/hero-poster.webp` 85,116 bytes; `images/galaxy.webp` 305,952 bytes.
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
- Owner decision: touch tablets in landscape (for example an iPad at 1180×820) download the 6.3 MB globe, because the desktop query checks only width and motion. Adding `(hover: hover)` would skip it there, but it would also change the hero on touch laptops.
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
