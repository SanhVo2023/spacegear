# Spacegear fidelity rebuild — design

Date: 20 October 2026. Branch: `feat/spacegear-fidelity`, created from Codex's `feat/spacegear-revival` (`a489cc6`). Status: approved by the owner in conversation; this document records that design.

## Problem

The owner asked for spacegear.tech to look very close to the original `platform-clone` website. Codex rebuilt the site instead of re-skinning it. Measured on the home page at 1440×900:

| | Original (`platform-clone`) | Codex (`feat/spacegear-revival`) |
|---|---|---|
| Page height | 13,655 px | 7,816 px |
| Sections | Hero + 9 content sections + 3-part footer | Hero + 6 sections + simple footer |
| Source diff (`c249c4d..a489cc6 -- src`) | — | 4,215 lines deleted, 862 added |
| Section component size | 150–350 lines each | 8–16 lines each |

What Codex removed or replaced:

- **Motion components:** `motion.tsx`, `Reveal`, `ScrollColorTitle`, `StackCards`, `SnapRow`, `DotField`, `Starfield` and `CurtainShell`.
- **Tailwind markup:** replaced by 472 lines of semantic CSS.
- **Globe:** all six 4096×2048 textures shrunk to 1536 px at WebP quality 70; stars cut from 7,000 to 1,800; the full galaxy image swapped for a 1600 px copy.
- **Hero:** orange keywords, stat counters, corner card and the pinned statement beat removed.
- **Section headers:** the giant grey-to-white scroll titles replaced by small eyebrows.
- **Section layouts:** Work bento became 3 cards; Services horizontal accordion became `<details>`; Process timeline and count-ups became text columns; Pricing rows became vertical cards; the FAQ photo card was removed.
- **Sections deleted:** Analytics, Team, Testimonials and Labs.
- **Footer:** the wordmark/newsletter footer was replaced.
- **Product art:** `prepare-assets.mjs` re-encoded every product image to 768 px.

## Approach

**Restore and re-skin.** Bring the original components back from the preserved snapshot `c249c4d` with their markup and class names unchanged. Move every piece of copy into `src/lib/content.ts`. Keep Codex's work that does not affect appearance. Rejected alternatives:

- **Patch Codex's components piece by piece.** Slow, and it keeps drifting from the original.
- **Use the original repo as the base and port the infrastructure.** Same result as restore-and-reskin, but a messier merge.

### Kept from Codex

- Static export to Cloudflare Workers Static Assets: `next.config.ts`, `wrangler.jsonc`, `scripts/package-site.mjs`, `scripts/check-export.mjs`.
- Inquiry Worker, D1 migration, Turnstile, and `ContactForm` logic.
- SEO: `lib/seo.ts`, canonical URLs, JSON-LD, sitemap, robots, the 12 routes and the 301 redirects.
- Local Inter and JetBrains Mono fonts.
- Publication guards (`lib/publication.ts`, `scripts/check-content.mjs`).
- All 15 node tests, the SEO crawl and the six-profile browser check.
- Globe runtime guards: WebGL error boundary, offscreen pause, data-saver opt-out, idle-time mount and the local Draco decoder.

## Content rules (owner decision: "build all, reword honestly")

Every original section returns with its original look. The copy is real Spacegear material or clearly labelled illustration. Nothing invents clients, staff, prices, timelines, offices, press coverage or results.

| Section (id) | Original | Spacegear version |
|---|---|---|
| Hero (`home`) | "You innovate, we automate." / "— The smarter way to build, run, and scale your business." / stats 97.8% & +31.2% / "Neural Network" card | "You bring the challenge, **we build the system.**" / "— The smarter way to **plan**, **build**, and **scale** your business." / stats **05** core services, **03** delivery stages / "Applied AI & Deep Learning" card → service page / statement "We turn business challenges into working digital systems your team can use." |
| Our Work → **What We Do** (`work`) | Product bento | Featured = Applied AI; orange "Service Lineup 5/5" panel; tiles = Digital Transformation, Automation & Integration, AI Strategy, Product Delivery; progress card = "Opportunity Assessment 01/03" |
| Our Services (`services`) | 4-column hover accordion + Core Services card | Same, with 5 columns (one per service) and "Core Services 5/5". Columns link to the service pages. |
| Our Process (`process`) | 4 step cards with timing count-ups | Assess, Prioritize, Build, Adopt. The count-up shows how many outputs each step produces, and those outputs are listed. |
| Smart Analytics → **What We Measure** (`analytics`) | Dashboard of platform metrics + press ticker | Same dashboard, labelled "Illustrative example — not client results". It shows a sample document workflow, workflow-stage dials instead of city clocks, and a capability ticker instead of press claims. |
| Pricing → **Engagements** (`pricing`) | $49/$89/$249 rows with billing toggle | Assess / Build / Improve rows with no prices. "Popular" becomes "Start here", and the toggle switches between Deliverables and Outcomes. |
| Questions & Answers (`faq`) | 8 items + photo card | 8 Spacegear FAQs + the same photo card |
| Meet the Team → **Who You Work With** (`team`) | 5 fictional staff | 5 role cards (strategy, AI & data, delivery, integration, adoption) with no headcount. A founder card is added when the owner supplies a name, photo and bio. |
| What Our Clients Say (`testimonials`) | 7 fictional quotes | Same component. It renders only real, permission-confirmed quotes; empty at launch. |
| Platform Labs → **Spacegear Labs** (`labs`) | 4 articles | Same component. It renders only real published articles; empty at launch. |
| Footer (`contact`) | Badge, giant wordmark, Amsterdam address, newsletter, socials | Badge, giant `space—gear™`, identity lines, a "Start with one challenge" form that carries name + email to the contact page through `sessionStorage` (never the URL), social icons only when real profiles exist, otherwise Privacy/Terms |

A development-only sample mode (`NEXT_PUBLIC_SHOW_SAMPLES=true` with `next dev`) lets the owner preview the Testimonials and Labs layouts using the original art. Production builds cannot include it: the check is gated on `NODE_ENV`, `check-export` greps for a sample marker, and `check-export` already rejects `images/team|reviews|labs`.

**Wordmark (owner decision):** `space—gear` in flame orange with an ink em dash, styled exactly like `plat—form`. It uses **™, not ®**, because ® is only lawful for a registered mark; switch to ® once the mark is registered. The site's prose and metadata name stays `spacegear.tech`, the confirmed public name.

**Headline note:** the approved verbs "modernize, automate, scale" wrap to six lines at 92 px and break the hero composition. "Plan, build, and scale" keeps the original four-line rhythm and matches the offer: strategy, then delivery, then scale. Flag this to the owner.

## Deliberate deviations from the original (no visible change unless stated)

1. **Accessible text contrast.** Sentence-length text that used `text-mut-3` (#5f5f66, 2.8:1) uses `text-mut-2` (#888891, 5.1:1). Decorative mono labels keep `mut-3`. *Slightly brighter small text.*
2. **Ambient loops run as CSS keyframes, not JavaScript:** the dot matrices, rotating badges and the pulsing tile. They cost no JS frames and stop under reduced motion.
3. **Desktop hero poster.** A still frame of the globe sits under the WebGL canvas. It is the loading state and the fallback when WebGL fails.
4. **Keyboard access, same look.** Dropdowns open on hover *and* focus, and Escape closes them. The mobile menu and FAQ use native `<details>`, which also works without JavaScript.
5. **Content stays visible without JavaScript.** A `<noscript>` stylesheet resets entrance states (`data-reveal`, `data-scroll-word`, `data-fill*`). Count-ups render their final value on the server.
6. **Reduced motion** shows the static hero and skips entrance animations. *Same layout, no motion.*
7. **Globe asset.** Surface textures stay at full 4096 px. Only the two cloud textures drop to 2048 px (≈3.7 MB total, versus 10.4 MB original and 1.45 MB in Codex's version), and the result must be visually indistinguishable in the fidelity sheets.

## Architecture

- **Shell:** `layout.tsx` contains Nav + `CurtainShell` (footer pinned behind content on desktop) + `MotionProvider` (`MotionConfig reducedMotion="user"`) + `NoScriptStyles`. Every page renders a `<main id="main">`.
- **Home page:** `OrbitalCinematic` (300vh pinned 3D sequence on desktop, static galaxy hero otherwise), then the rounded "curtain" panel holding the nine sections in original order.
- **Content:** all copy and data live in `src/lib/content.ts`, typed. `tests/content.test.mjs` enforces the honesty rules: no `$` prices, no old metrics or press claims, illustrative label present, publishable-only testimonials and articles.
- **Inner pages** are built from the original vocabulary: `PageIntro` (back link + eyebrow + display H1), `SectionHeader`, `ProcessSteps`, `FaqAccordion`, `StillQuestionsCard`, `Tile`, `CtaBand`. The services index uses the original `/services` page layout.
- **CSS:** `globals.css` is the original stylesheet plus a "Spacegear additions" block. Codex's semantic CSS moves to `legacy.css` inside `@layer components`, so Tailwind utilities win, and is deleted once no markup uses it.

## Verification

- `scripts/fidelity-compare.mjs` (`npm run check:fidelity`) runs the original build (`platform-clone`, `next start` on :3101) against the candidate (Cloudflare preview on :8787) at 1440×900 and 390×844. It captures each section by id, writes side-by-side sheets to `artifacts/fidelity/`, and fails when a section is missing or its height differs by more than 15%. The mobile `services` tolerance is 30% because there are 5 services instead of 4.
- Existing gates must stay green: `lint`, `typecheck`, `test` (plus the new content test), `build:cf`, `check:seo` and `test:browser`. The browser check gains:
  - a no-JS transparency assertion
  - a quick-start footer → contact pre-fill test
  - snap-carousel exclusion in the 320 px clip test
  - targeting a closed-by-default FAQ item
- **Sign-off:** a person reviews every side-by-side sheet against the signature-element checklist in the plan's final task.

## Out of scope

- Article pages: Labs links point to real URLs once articles exist.
- Founder content: needs the owner's input.
- Any copy beyond what is listed above, and Cloudflare account and production launch work. Codex's launch gates remain.
