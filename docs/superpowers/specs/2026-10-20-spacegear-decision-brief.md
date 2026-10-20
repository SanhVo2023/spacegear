# Spacegear: refined direction and decisions

Revision 2, 20 October 2026. This is a proposal for discussion, not a claim about existing company capabilities, clients or results.

## The recommendation

Position Spacegear as a **digital transformation and AI partner that stays through delivery and adoption**. Give business buyers a clear reason to start a conversation: identify the right opportunity, turn it into a working system, and help their team use it.

Keep the site's charcoal/orange palette, orbital hero, strong typography and signature motion. Make the pages much more specific about the work the company does and what a client receives.

The first version of the plan was strongest on engineering. This revision strengthens the offer, buyer journey, evidence, visual hierarchy and practical launch sequence.

## Three decisions worth discussing

| Decision | My recommendation until you steer it | Why it matters |
|---|---|---|
| First customer and market | Start with businesses that have a concrete operational problem, existing systems/data and a sponsor who can own implementation. Pick the first sector, company-size range and country from your strongest real experience. English is only a preview assumption. | Determines the examples, language, service emphasis, search intent and credibility needed. “Every business globally” would make the copy vague. |
| First engagement | Lead with a **Transformation Opportunity Assessment**, while allowing buyers with a defined project to discuss delivery directly. | Gives an interested visitor a useful, understandable starting point without committing to a large transformation program. |
| Evidence at launch | Feature real projects, permitted founder experience or internal products, clearly labeled by context and role. | Lets the website demonstrate capability honestly. A founder's previous work can be valuable, but should not be presented as a Spacegear client engagement. |

Brand spelling, domain and real company/contact details must also be settled before publication. They do not require reopening the entire design. No public pricing, promised timeline or response SLA should be invented to fill a layout.

## Proposed first screen

**Digital transformation & AI consulting**

> **Turn business challenges into working digital systems.**

Spacegear helps you modernize operations, connect your data and put AI to work—from the first decision to systems your team can use and improve.

**Discuss a project** · **See how we work**

The globe remains the visual signature. The headline, business description and CTA are visible immediately. A scroll transition introduces: **A clear direction. A working solution. A team ready to use it.**

## Make the offer easy to understand

The homepage groups the work around three buyer intentions:

- **Choose the right next step:** digital transformation and AI strategy.
- **Build a working solution:** applied AI, deep learning where justified, and digital product delivery.
- **Connect and improve operations:** automation, integrations and operational adoption.

The five detailed service pages remain. They explain different problems and deliverables, with links between related services. Business outcomes lead; the relevant technologies explain how the work gets done.

The recommended starting assessment produces a current-workflow map, opportunity shortlist, data/integration gaps, success criteria and a recommended first pilot. Confirm the commercial scope before publishing a price or duration. This is one entry into the business, not an extra standalone software product.

## A shorter, stronger homepage

| Section | Visitor question it answers | Content and visual direction |
|---|---|---|
| 1. Hero | What do you do? | Clear positioning and two CTAs; orbital cinematic with immediate readable copy |
| 2. Challenges and services | Can you help with my problem? | Manual work, disconnected systems/data, stalled delivery; existing bento/expanding-card treatment |
| 3. Evidence or delivery example | What does your work look like? | A real permitted project, or a plainly labeled illustrative workflow; no fabricated results |
| 4. Approach | How would we work together? | Direction → working solution → adoption, with concrete deliverables and a link to the full method |
| 5. Engagements | Where do we start? | Assessment, validation/build and continuing improvement; reused pricing-card aesthetic |
| 6. Optional insights | How do you think about these problems? | Two useful reviewed articles; omit this section until ready |
| 7. FAQ and inquiry | What do I need to do next? | Answer buying concerns and finish with “Tell us what you want to improve” |

This consolidates the old measurement dashboard and long team section into purposeful modules or dedicated pages. It keeps the design vocabulary while improving the reading sequence. If no articles are ready, the six-section version remains complete.

Visual polish: a restrained Spacegear wordmark; orange used for actions and emphasis; clear diagrams after the cosmic opening; quieter motion below the hero; readable muted text; consistent spacing and image crops. No mandatory rocket imagery, sci-fi product names, floating fake metrics or repeated “AI-powered” claims.

## Delivery and search strategy

Keep Next.js and export the marketing pages to Cloudflare Workers Static Assets. Use a same-origin Worker with D1 and Turnstile for inquiries. Verify the Cloudflare owner-notification path. No alternative hosting or external email provider is part of the proposal.

Build a representative home/service/contact slice first and measure it in a local Cloudflare runtime before expanding the patterns. Core launch is 12 indexable pages plus the 404 and discovery files. Add insights and client work only when the material is ready. Keep a chatbot, CMS, newsletter campaign system and extra languages out of the initial build unless you choose them.

Each service page owns a distinct buyer/search intent. Useful articles answer narrower questions and support those service pages. Confirm the first market before final keyword research and any localized copy. Avoid manufacturing dozens of near-duplicate industry or city pages.

Target 100 in the Lighthouse categories; retain the documented performance gates and real-world Core Web Vitals checks. Search/AI visibility depends on content relevance, credibility and access as well as technical quality. Google requires no special AI markup for its AI search features. [Google guidance](https://developers.google.com/search/docs/appearance/ai-features)

Measure accepted inquiries and qualified conversations alongside page performance. Cloudflare Web Analytics does not currently provide custom conversion events or UTM collection; start with D1 inquiry counts and owner qualification, then add a small Cloudflare Analytics Engine integration only if needed. [Cloudflare FAQ](https://developers.cloudflare.com/web-analytics/faq/)

## Repository and next handoff

You supplied [SanhVo2023/platform-design-contest](https://github.com/SanhVo2023/platform-design-contest). GitHub API metadata reports it is empty and Git advertises no refs. The local `platform-clone` folder remains the source of the website we reviewed. It contains substantial uncommitted work that must be preserved before importing it into a new repository.

Two attempts to clone the supplied URL failed to connect to GitHub. The owner-command fallback could not be queued because Cockpit does not recognize this folder. No clone, source upload, push, deployment or application edit has been completed in this refinement stage.

The two most useful inputs now are your first customer/market and the real work we can show. The assessment offer and visual direction above are my recommendations, and the detailed plan can be implemented once the business direction is settled.

- [Complete design and architecture](2026-10-20-spacegear-revival-design.md)
- [Implementation checklist](../plans/2026-10-20-spacegear-revival.md)
- [Original audit with repository update](../../audits/2026-10-20-spacegear-site-audit.md)
