# Spacegear website revival: design and delivery brief

Status: revision 2, proposed design, based on the local source audit and live site inspection. This revision sharpens positioning, the starting offer, homepage hierarchy, visual direction and measurement. No product implementation or deployment has occurred.

Evidence: [site audit](../../audits/2026-10-20-spacegear-site-audit.md). Execution: [implementation plan](../plans/2026-10-20-spacegear-revival.md).

Start with the [short strategy and discussion brief](2026-10-20-spacegear-decision-brief.md). All recommendations below remain proposals until the relevant business facts are supplied.

Repository update: the owner supplied `https://github.com/SanhVo2023/platform-design-contest`. GitHub API reports a public repository of size 0, default branch `main`; `git ls-remote` returned no refs. It currently contains no website source. Treat it as the proposed destination for the preserved local source, not evidence that the current local application is versioned there. Two clone attempts failed to connect to GitHub; the Cockpit fallback failed because the folder is unregistered. No clone or push has been completed.

## 1. Intent and fixed requirements

Transform the current Platform product website into the website of **Spacegear**, a digital transformation consultancy and technology-enabled strategy and delivery partner. Explain how Spacegear applies digital systems, AI, machine learning and deep learning to real business problems and carries the work from assessment into production and adoption.

User requirements:

- Replace the old company and product identity throughout the website.
- Preserve the existing aesthetic and animations.
- Host and run the website exclusively on Cloudflare.
- Optimize speed, technical SEO and visibility in AI-assisted search.
- Analyze the existing site before planning the rebuild.
- Clone the supplied repository when network access permits, then reconcile the preserved local source.

Planning assumptions, not confirmed company facts: spelling **Spacegear**; English first; B2B founders, business leaders, operations leaders and technology/data leaders; lead generation as the primary business goal; no country/industry specialization claimed until supplied. The final domain, legal entity, real team, contact details and client evidence remain owner inputs. These do not prevent building a local preview but must be resolved or omitted before publication.

Avoid: retaining SaaS pricing under a consultancy logo; substituting unsupported success statistics; publishing generated portraits as actual staff; keyword-stuffed copy; promising search rankings or AI citations; adding a chatbot simply because the company offers AI services.

## 2. Positioning and message

Working positioning statement:

> Spacegear is a digital transformation and AI consultancy that connects business strategy with hands-on delivery. We help organizations identify valuable opportunities, build practical digital and AI solutions, and embed them into everyday operations.

Proposed hero:

- Eyebrow: **Digital transformation & AI consulting**
- Headline: **Turn business challenges into working digital systems.**
- Supporting copy: **Spacegear helps you modernize operations, connect your data and put AI to work—from the first decision to systems your team can use and improve.**
- Primary CTA: **Discuss a project** → `/contact/`.
- Secondary CTA: **See how we work** → `/approach/`.
- Scroll statement: **A clear direction. A working solution. A team ready to use it.**

Keep “digital transformation consultancy” visible near the headline and in the page title/description. The headline can be expressive because surrounding text explicitly names the business.

Voice: direct, technically credible, business-oriented, specific about deliverables. Describe opportunities as opportunities, not guaranteed outcomes. Deep learning belongs in the relevant capability and use-case explanations; do not imply every business problem needs a neural network.

Positioning recommendation: lead with operational improvement and accountable delivery. The visible distinction is the sequence of useful artifacts: a prioritized decision, an evaluated implementation, and an adoption/handover plan. Do not present that as a unique market claim or an established Spacegear track record without evidence. Avoid claiming equal relevance to every industry and company size; choose the first audience before final copy and search priorities are approved.

## 3. Service architecture

| Service and URL | Buyer problem | Concrete scope and deliverables |
|---|---|---|
| Digital Transformation Strategy — `/services/digital-transformation/` | Unclear priorities and disconnected initiatives | Current-state assessment, process mapping, opportunity prioritization, business case, implementation roadmap and operating model |
| AI Strategy & Enablement — `/services/ai-strategy/` | AI interest without a viable adoption plan | Readiness assessment, use-case selection, data requirements, evaluation criteria, governance, pilot plan and team enablement |
| Applied AI & Deep Learning — `/services/applied-ai/` | Unstructured information, prediction or perception problems | Document intelligence, retrieval, forecasting or computer vision where justified; baseline comparisons, prototype, evaluation, deployment and monitoring plan |
| Automation & Systems Integration — `/services/automation-integration/` | Repetitive work and fragmented systems | Workflow redesign, integrations, human review points, exception handling, operational dashboards and documentation |
| Digital Product & Platform Delivery — `/services/product-delivery/` | Strategy cannot reach usable production software | Discovery, UX, architecture, implementation, testing, rollout, handover and iteration |

These are proposed offers. Each page must state who it helps, typical starting conditions, what Spacegear delivers, the delivery process, limitations/dependencies, relevant examples, FAQs and the next step. Do not claim certifications, partner status, delivery times or commercial terms that have not been established.

Engagement cards replace subscription pricing:

1. **Assess & prioritize** — agree a problem, baseline and roadmap.
2. **Validate & build** — prove a use case, then deliver a production-ready system.
3. **Embed & improve** — support adoption, measurement and continuing improvement.

Use “Scope agreed around your objectives” instead of invented package prices. Duration and pricing can be added later when the actual offers are known.

Recommended starting offer: **Transformation Opportunity Assessment**. The buyer brings one business challenge. Spacegear maps the current workflow, reviews available systems/data, compares improvement options, and proposes a prioritized roadmap plus a measurable first pilot. Deliverables: current-state map, opportunity shortlist, data/integration gaps, success criteria, and a recommended next step. Present this within “Assess & prioritize,” not as an additional service or free assessment promise. No public duration, fixed price or guaranteed result until the offer is operationally confirmed. Experienced buyers with a defined brief can go directly to a delivery discussion.

Present the five services through three simple buyer intentions on the homepage: **Choose the right next step** (transformation/AI strategy), **Build a working solution** (applied AI/product delivery), and **Connect and improve operations** (automation/integration). Keep the five distinct detail pages for clarity and search intent.

## 4. Information architecture and launch content

Primary navigation: **Services · Approach · About**, with **Discuss a project** as the persistent CTA. Add **Insights** when reviewed articles exist and **Work** when publishable project evidence exists. The mobile menu must expose the same destinations. Never show empty editorial or work indexes.

| Route | Purpose | Launch rule |
|---|---|---|
| `/` | Explain Spacegear and guide buyers to a relevant service/contact | Required |
| `/services/` and the five service detail routes above | Distinct buyer intents and indexable service information | Required; substantive, distinct copy |
| `/approach/` | Explain assess → prioritize → validate → deliver → adopt | Required; owners, deliverables and decision gates |
| `/about/` | Company purpose, working principles and verified people/facts | Required; omit unknown biographies/location claims |
| `/contact/` | Qualified inquiry form and verified contact route | Required |
| `/insights/`, `/insights/[slug]/` | Original, useful explanations linked to services | Target two reviewed articles at launch; if unavailable, defer the index, navigation and sitemap entries together |
| `/privacy/`, `/terms/` | Actual website/data-handling terms | Required before collecting inquiries; owner supplies or approves final factual/legal content |
| `/work/`, `/work/[slug]/` | Genuine case studies | Conditional; if none are verified, omit routes, navigation and sitemap entries |
| `/404.html` | Helpful missing-page response | Required; real HTTP 404 |

First editorial set: two substantial articles, “How to prioritize AI use cases for business value” and “From an AI pilot to production: what has to change.” Editorial content must be reviewed before publication; it must not hold a complete core website indefinitely or be replaced with placeholder posts. More content after launch: transformation roadmap, integration readiness, deep learning versus simpler approaches, data quality and AI evaluation. These are editorial hypotheses, not verified keyword-volume findings. Confirm target market, language, search intent and competing results before freezing content priorities.

Article template: short direct answer; clear sections; practical examples; explicit assumptions and limitations; source references; genuine author/reviewer when known; actual publication/update dates; related services; one useful CTA. No automated bulk content program.

Case-study template, when evidence exists: business context, baseline, intervention, delivery role, timeframe, result measurement and approval. If confidentiality applies, publish an approved anonymized study. Otherwise use clearly labeled example use cases on service pages, never disguise them as client work.

## 5. Homepage transformation map

| Existing component | Proposed Spacegear content | Visual treatment |
|---|---|---|
| `Nav.tsx` / shared `ui.tsx` brand labels | Spacegear wordmark and consultancy navigation | Keep floating glass/charcoal navigation and orange accent |
| `OrbitalCinematic.tsx` | New hero and transformation statement | Retain orbital storytelling and scroll choreography; immediate readable copy |
| `Work.tsx` | “Where we create value” use-case cards | Retain bento composition and card stack; examples labeled as such |
| `Services.tsx` | Five service pillars | Retain expanding panels; each service links to a full page |
| `Process.tsx` | Direction → working solution → adoption; full five-stage method on Approach | Retain animated sequence; replace automated infrastructure claims |
| `Analytics.tsx` | Delivery example and measurement criteria | Integrate into the value/proof section; show a labeled workflow illustration, not a large standalone dashboard of invented metrics |
| `Pricing.tsx` | Three engagement models | Keep card styling; remove billing toggle, seats and subscription prices |
| `Faq.tsx` | Consultancy questions | Retain accordion styling; answer ownership, starting point, data readiness, integration and delivery |
| `Team.tsx` | Verified founder/team material on About; concise delivery principles in the home approach section | Reuse the editorial layout where it helps; no mandatory long home section |
| `Testimonials.tsx` | Verified quotes only | Omit by default until evidence is supplied |
| `Labs.tsx` | Spacegear Insights | Retain article cards; replace placeholder expertise claims |
| `Footer.tsx` | Real sitemap, identity, contact and policies | Preserve curtain reveal and badge; remove inert newsletter and dead links |

Preferred home structure has seven purposeful sections: **hero → business challenges and service paths → evidence or clearly labeled delivery example → approach → engagement options → optional insights → FAQ and final inquiry/footer**. If insights are unavailable, six sections are sufficient. The existing measurement and team treatments become focused modules inside these sections or move to Approach/About; preserving the aesthetic does not require retaining every old section.

Homepage editorial outline:

1. Hero: say what Spacegear does and make the primary CTA available immediately. Avoid competing stats, product-release badges or a long animation before the offer.
2. “Where is your business getting stuck?”: three concise cards for repeated manual work, disconnected data/systems, and ideas that stall before production. Link each to a relevant service. The five capabilities live in a compact, scannable treatment beneath these needs.
3. “What delivery looks like”: lead with a genuine, authorized project when available. Otherwise show an explicitly labeled **Illustrative workflow**: documents → extraction → human review → system update, plus what would be measured. This is an explanatory visual, not a new interactive product or a fabricated customer result.
4. “From direction to daily use”: show three milestones and what the client receives at each. Link to the full five-stage approach and handover details.
5. “Start with the right engagement”: foreground the Opportunity Assessment and keep validation/build and ongoing improvement as the other routes. No price/billing toggles.
6. Optional Insights: two useful articles with actual publication details, never a carousel of filler.
7. FAQ and closing CTA: address starting conditions, existing tools, data readiness, ownership and delivery. Finish with **Tell us what you want to improve** and **Discuss a project**.

Proof rules: distinguish company client work, founder work performed elsewhere, internal products/prototypes, and conceptual illustrations. Label the role and context accurately. Quantified claims require a documented baseline, period, method and permission. Real screenshots/diagrams can support capability when permitted; no logo strip until the relevant relationship is verified.

## 6. Visual and motion contract

Retain charcoal `#161719`, orange `#fa6e43`, warm light text, Inter/monospace typographic pairing, rounded panels, thin borders and celestial imagery. Improve muted text where measured contrast fails. Replace all logos, brand badges, favicon and social imagery; maintain required third-party license notices outside marketing identity.

Art direction: use the orbital globe as a signature opening, then shift toward clear diagrams and deliverables as visitors move into the business story. Orange emphasizes a decision, action or selected state; avoid making every sentence glow. The Spacegear wordmark should be typographic with one restrained orbital detail; do not copy the split Platform wordmark or add an unverified trademark symbol. Avoid astronaut/rocket stock imagery and an abundance of sci-fi product names. Retain the numbered section labels, adjusting numbering to the shorter narrative.

Three desktop scene beats: **orientation** (clear offer and globe), **connection** (the short scroll statement), **delivery** (content panel enters). Keep existing motion character, but no scroll-jacking or requirement to finish the cinematic to reach a service/contact page. After the hero, use quieter reveals; one dominant motion per section. Detailed workflow illustrations use the existing visual system without pretending to be live operational dashboards.

- Initial HTML contains visible headline, service descriptions, links and CTA. No opacity-zero dependency for essential copy; JavaScript and WebGL are enhancements.
- Keep a static poster behind the desktop scene until it is ready. Do not remount the hero copy or change its reserved geometry when the scene loads.
- Retain the cinematic desktop sequence for capable devices. Dynamically import 3D only after the primary content is usable; respect reduced motion and available data-saving signals. Never branch by crawler user agent.
- Narrow screens use the existing static cosmic direction with lightweight optional motion; no GLB request. Reduced motion means no continuous particle, marquee, rotating badge or scroll-scrub animation.
- Pause decorative rendering when offscreen or the tab is hidden. Cap rendering resolution; optimize textures/mesh and verify visual fidelity before replacing assets.
- Reserve image and canvas dimensions; favor opacity/transform over animated layout. Keep hover effects and text/card reveals that fit the performance budget.
- Links and controls remain operable by keyboard; menus expose expanded state, support Escape and return focus. Focused elements must not be hidden by the sticky navigation. Carousels must have a static/reduced-motion presentation and accessible controls.
- Test no JavaScript, failed WebGL, failed model loading, reduced motion, 320–390 px mobile widths, 768 px tablet, 1024 px breakpoint and 1440 px desktop, plus landscape/200% zoom.

## 7. Cloudflare-only architecture

**Recommended:** retain Next.js, add `output: 'export'`, generate route HTML at build time, and deploy `out/` with Cloudflare Workers Static Assets. One Worker entry handles only dynamic paths. Repository content is compiled during Cloudflare Workers Builds. Git hosting and search verification tools are development/discovery services, not alternative application hosts.

```mermaid
flowchart LR
  Visitor[Visitor or crawler] --> Edge[Cloudflare DNS / TLS / CDN]
  Edge --> Assets[Workers Static Assets: pre-rendered pages]
  Visitor --> Form[Contact form + Turnstile]
  Form --> API[Cloudflare Worker: /api/contact]
  API --> Verify[Turnstile verification]
  API --> D1[Cloudflare D1: inquiry + notification outbox]
  D1 --> Notify[Scheduled Worker: notification retries]
  Notify --> Email[Cloudflare email to verified owner]
  Git[Source repository] --> Build[Cloudflare Workers Builds]
  Build --> Assets
```

| Need | Cloudflare implementation | Scope |
|---|---|---|
| Hosting, TLS, edge caching | Workers Static Assets, Cloudflare DNS/CDN | Required |
| Form endpoint | Worker, same origin `/api/contact` | Required; not a Next.js POST handler in a static export |
| Inquiry storage | D1 with migrations and an outbox | Required; authoritative capture before success |
| Abuse protection | Turnstile + endpoint rate limiting | Required; server verification and clear retry behavior |
| Internal notifications | Cloudflare email; verify account eligibility, sender and owner destination | Required for launch unless owner deliberately operates from D1; never fake delivery |
| Media | Optimized static files initially; R2 if media volume warrants it | R2 optional, not a place for unnecessary public source masters |
| Image variants | Build-time Sharp initially; Cloudflare Images if editorial needs justify it | No third-party image CDN |
| Observability | Workers logs and Cloudflare Web Analytics; first-party vitals ingestion if needed | Avoid logging inquiry text/emails or tokens |
| Content | Versioned repository data/Markdown; rebuild on publish | No external CMS required |
| Optional future AI experience | Workers AI + Vectorize/AI Search over approved public content | Separate later phase; zero dependency for core pages or SEO |

Do not add KV, Queues, Durable Objects or an AI gateway without a workload that needs them. The initial outbox can use D1 and a scheduled Worker. Cloudflare is the host of the **website**; this does not imply all Spacegear client AI/deep-learning projects can be trained or delivered entirely on Workers AI.

Alternatives considered: OpenNext on Workers is appropriate if runtime rendering/Server Actions become necessary; it adds adapter/runtime complexity this marketing site does not currently need. Rewriting in Astro could reduce baseline JavaScript, but introduces migration work and risks changing the existing motion. Preserve Next.js first and revisit only if measured performance cannot meet the agreed budget.

Export/routing contract: canonical paths end in `/`; Next.js `trailingSlash: true`; dynamic routes enumerate publishable slugs with `generateStaticParams` and `dynamicParams = false`. Cloudflare uses `html_handling: 'force-trailing-slash'`, `not_found_handling: '404-page'`, and Worker-first routing for `/api/*` and explicit legacy paths that need handler redirects. Do not use a universal SPA fallback. Configure redirects/security headers at Cloudflare or in emitted `_redirects`/`_headers`, not Next.js server configuration. Apply equivalent headers directly to Worker responses.

## 8. Conversion and inquiry contract

Primary CTA consistently opens `/contact/`, optionally preselecting a service. Fields: name, work email, company (optional), service interest (optional), and a short description of the challenge. Explain how submitted information will be used and link the real privacy policy. No newsletter enrollment or file uploads at launch.

Use **Discuss a project** throughout navigation, service pages and final CTA. On the form, prompt **What would you like to improve?**; submission button **Send inquiry**. State what happens next without an unconfirmed response-time guarantee: the team reviews the brief and responds about a suitable next step. Include a real email fallback when JavaScript or Turnstile is unavailable; do not imply the protected form works without its required verification. Do not add a third-party scheduling embed. Scheduling can follow a qualified inquiry.

`POST /api/contact` accepts a bounded JSON payload and a Turnstile token; only the configured site origin is accepted. Validate server-side, verify token success/hostname/action, rate-limit, and atomically store the inquiry and notification outbox row. Generate an idempotency key per submission attempt; the same key/body cannot create duplicate inquiries. Return success only after durable storage, even if notification is still pending.

Display specific field errors; preserve typed values after transient failure; allow retry with a fresh challenge token. Generic server errors must not leak internal data. Worker responses are `no-store`. Email failure must not erase a captured inquiry; use bounded retries and visible operational failure status. Send to the fixed verified owner address only, not a user-controlled recipient. No visitor autoresponder or bulk newsletter depends on Cloudflare beta availability at launch.

Keep inquiry data private; no public listing API. Provisional retention is 90 days for unqualified inquiries, configurable and confirmed before launch; do not delete data during this planning stage. Exclude personal data from analytics and logs. The website must accurately describe the final data practices.

## 9. Technical SEO and migration

- One final canonical production origin, confirmed by the owner. Build-time validation refuses a production release using the old Vercel domain, localhost or a placeholder domain.
- Unique titles, descriptions, canonical URL, Open Graph/Twitter metadata and a clear H1 for every indexable page. Service names appear naturally in page copy and links.
- Generate sitemap from the same published content source as routes; include only canonical 200 URLs and genuine modification dates. Robots permits intended public pages; private API/admin routes are not indexed. Staging is protected and carries `noindex` responses.
- Use semantic HTML and real `<a href>` links. Put important answers in visible text, not only images, canvas, animation or a chatbot.
- Add Organization/WebSite, Service, Article and BreadcrumbList JSON-LD only when supported by visible, verified facts. No Product/SoftwareApplication markup for consulting services; no invented reviews or AggregateRating. FAQ content is useful, but do not promise FAQ rich results.
- Audit all current paths. Map old routes to a new route only where the content is meaningfully equivalent; retired fictional products otherwise return 404/410. Never redirect every missing URL to home. Old hash links such as `/#pricing` cannot be handled by server redirects: update links and provide a temporary same-page anchor if compatibility is needed.
- If the old deployment/domain is controlled and has useful indexed URLs, configure one-hop permanent redirects to the equivalent production URLs and maintain them. If it is only a template preview, deindex/retire it when authorized. Do not claim old-domain search equity will transfer without that control.
- Check final HTTP status, canonical destination, redirect chain, sitemap, indexability and social unfurls on Cloudflare. Verify Search Console and Bing Webmaster Tools and submit the sitemap once the domain exists.

Search-intent ownership (hypotheses to validate for the selected market): transformation consulting belongs to `/services/digital-transformation/`; readiness/roadmaps to `/services/ai-strategy/`; AI implementation and appropriate ML/deep-learning use cases to `/services/applied-ai/`; workflow/integration to `/services/automation-integration/`; software product delivery to `/services/product-delivery/`. The services index summarizes and connects; it must not repeat five near-identical landing pages. Articles answer narrower research questions and link to the relevant service instead of competing for the same primary intent. Do not add city/industry doorway pages without actual differentiated expertise and demand.

Language decision before route/content freeze: English-only remains the preview assumption. If another language is required at launch, agree the language scope first, then use separate stable locale URLs, a visible language switch, reciprocal `hreflang` and self-referencing canonicals. Do not auto-redirect by IP or publish an unfinished translation. A second language expands copy, review and QA scope; no translated routes are promised in the current estimate. [Google localized-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions)

## 10. AI-assisted search visibility

The objective is understandable, retrievable, credible content. There is no universal “AI SEO score.” Google states that its AI features use normal SEO foundations and require no special AI schema/text files; inclusion is not guaranteed. [Google guidance](https://developers.google.com/search/docs/appearance/ai-features)

Maintain consistent Spacegear name, description, real people and confirmed company facts across the site and genuine external profiles. Write direct answers to buyer questions; link explanations to services, examples and sources. Publish original expertise and actual project evidence rather than generic summaries.

At Cloudflare, distinguish search/indexing and user-requested agent access from model training. Audit robots, WAF, managed bot settings and challenges together; a permissive robots file alone does not prove access. Start from the goal of allowing legitimate public search/retrieval, while keeping abuse protection and private paths protected. Training policy is a separate owner choice. Avoid user-agent spoofing as proof of verified crawler access. [Cloudflare classifications](https://developers.cloudflare.com/bots/concepts/bot/)

An optional `llms.txt` may summarize published public material if a real consuming tool needs it. It is not a launch gate or a replacement for normal content. Do not serve a hidden, keyword-heavy alternate page to AI agents. Track actual referred visits, qualified inquiries and sampled citations, clearly distinguishing these from guaranteed visibility.

## 11. Performance and quality acceptance

Target **100** in each Lighthouse category. For a release decision, use these explicit gates, and record any exception rather than calling an unmeasured or lower score “maximum.”

| Measure | Release target | Evidence |
|---|---|---|
| Lighthouse SEO | 100 | All representative templates, mobile and desktop |
| Lighthouse accessibility | 100 automated score plus manual keyboard/zoom/contrast checks | Automated score alone is not WCAG conformance |
| Lighthouse best practices | 100 | No unresolved material findings |
| Lighthouse performance | 100 target; at least 95 median with no run below 90 | Three cold runs per representative template/profile; pinned tool version and settings |
| LCP | ≤2.5 s field p75; aim ≤2.0 s in the defined lab profile | Real-user field data after launch; synthetic result labeled separately |
| INP | ≤200 ms field p75 | Interaction/RUM measurement, not a Lighthouse navigation score |
| CLS | ≤0.1 field p75; aim ≤0.05 in lab | Include hero hydration, fonts and below-fold interactions |
| Broken/placeholder internal links | 0 | Crawl all published routes |
| Indexable routes with unique canonical/title/description | 100% | Inspect exported HTML and production HTTP |
| Structured data | 0 validation errors; all claims match visible content | Schema validator and supported rich-result tests |
| Brand cleanup | 0 unintended old-brand/product/company references in rendered site/assets/metadata | Source/content and browser audit |
| Contact | Durable capture, no duplicate retry, recoverable failure, verified owner workflow | Local integration tests and authorized deployment smoke test |

Initial engineering budgets, to be checked on the first production build: compressed initial JS ≤200 KiB per marketing route before optional 3D; initial home transfer ≤750 KiB before 3D; mobile hero poster ≤150 KiB; desktop 3D enhancement including model/textures/extra code ≤3 MiB total, model aim ≤2 MiB. Count automatic prefetching and shared runtime bytes. If a budget cannot be met without losing essential appearance, measure and present the tradeoff explicitly; do not hide downloads just to improve a score.

Measure the home, service index, one service detail, approach, about and contact; add insight index/article and work templates when published. Run against a production build on Cloudflare with normal animation behavior and the same content for crawlers and people. Also test genuine mobile/reduced-motion fallbacks. Lighthouse is a diagnostic, not a ranking guarantee. Field Core Web Vitals require real traffic; an unavailable CrUX report is not a pass. [Core Web Vitals definitions](https://web.dev/articles/vitals)

Business measurement: track accepted inquiries, the owner's qualified-inquiry count, qualified/accepted share and inquiry failures. A qualified inquiry has a real business need aligned to a service, a reachable contact and a plausible next conversation; budget may be unknown. D1 capture is the source for accepted inquiries. Use Cloudflare Web Analytics for visits and performance; do not claim it supplies custom conversion events or campaign attribution. Its current FAQ says custom events and UTM collection are unsupported. Additional CTA/form-start events, if needed after launch, use a small first-party Worker endpoint and Analytics Engine with an allowlisted payload and no personal data. They remain optional and do not add a launch dependency. Report inquiry counts per visit only as an approximate aggregate ratio across separately collected systems, not a person-level funnel. [Cloudflare Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/), [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/get-started/)

Operating cadence: owner reviews incoming/failed inquiries each working day; weekly during the first month, check capture failures, top service pages and qualification; at 30/60/90 days, review search queries, useful content, actual referrals and performance trends. Establish a real baseline before promising conversion or ranking gains. Search Console inclusion and real visits are stronger evidence than synthetic AI prompt checks alone.

## 12. Delivery sequence and owner inputs

1. Preserve the current source and prepare the supplied empty repository as its future destination; confirm audience, starting offer, brand/domain and working branch.
2. Build one representative vertical slice: home hero/narrative, one service page and contact shell on a local Cloudflare production-style preview. Resolve motion fidelity and initial asset budgets here before duplicating the patterns.
3. Extend the validated design to the remaining service/company pages; add the working inquiry flow, complete identity replacement and truthful proof modules.
4. Complete metadata, schema, redirects, image/model optimization, accessibility and release verification across all core routes.
5. Launch the core site on the confirmed domain. Core scope is 12 indexable pages (home, services index, five service pages, approach, about, contact and two policy pages), plus 404 and machine-readable discovery files. Add the insight index and two articles when reviewed; optional work pages only when evidence is ready.
6. Improve editorial depth and conversion from observed data. Defer CMS/admin dashboards, chatbot, complex ROI calculators, newsletter campaigns and additional languages unless separately agreed.

Planning estimate: roughly 10–15 focused engineering/editorial working days for one implementer once content and account inputs are available, plus observation after launch. This is a provisional effort estimate, not a committed delivery date. Content preparation and model optimization are the largest uncertainties.

Owner inputs needed before public launch: exact brand spelling and final domain; legal/company/contact details; real people and evidence that may be published; target market/language priorities; Cloudflare project/domain/email eligibility and a verified owner destination. The repository URL is now known; remote access and local-source reconciliation remain operational work. No secrets belong in this document or chat. Use Cockpit owner-command workflows for credentialed/deployment actions after the project is registered.

Launch rollback: retain the previous known-good Worker/assets version, use additive D1 migrations, and never roll back by deleting captured inquiries. Post-launch checks: immediate HTTP/form/robots smoke tests; first-week crawl/error review; review field vitals after sufficient data accumulates, normally across a 28-day reporting window. Track qualified inquiry rate and content usefulness alongside technical scores.
