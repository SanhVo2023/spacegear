# Spacegear: refined direction and decisions

> Implementation update, 2026-10-20: the owner confirmed **spacegear.tech** as the public name and domain and authorized continuation into implementation. This supersedes the working-name/domain and plan-only statements below. The open audience, private company scale, Cloudflare-only stack and Cockpit bypass remain in force. See [implementation status](../../operations/implementation-status.md) for actual completion and launch dependencies.

Revision 3, 20 October 2026. The owner confirmed an open customer audience, no public company-scale signals, and direct work without Cockpit. Other proposed offers and experience claims remain subject to real company facts.

## The recommendation

Position Spacegear as a **digital transformation and AI partner that stays through delivery and adoption**. Give business buyers a clear reason to start a conversation: identify the right opportunity, turn it into a working system, and help their team use it.

Keep the site's charcoal/orange palette, orbital hero, strong typography and signature motion. Make the pages much more specific about the work the company does and what a client receives.

The first version of the plan was strongest on engineering. This revision strengthens the offer, buyer journey, evidence, visual hierarchy and practical launch sequence.

## Confirmed direction and remaining proposals

| Decision | My recommendation until you steer it | Why it matters |
|---|---|---|
| Customer audience — confirmed | Welcome inquiries across industries, company sizes and regions. Organize copy around problems and services, with no customer-segment eligibility rules. English is still the preview language. | Keeps the audience open while making the work understandable. No first sector, company-size range or country needs to be selected before writing the site. |
| Public company scale — confirmed | Use Spacegear and “we” without headcount, revenue, office counts, team-size labels or a staff roster. Keep the About page centered on purpose, method and relevant evidence. | Keeps company scale private. Do not imply a larger team, international offices or unsupported delivery capacity. |
| First engagement | Lead with a **Transformation Opportunity Assessment**, while allowing buyers with a defined project to discuss delivery directly. | Gives an interested visitor a useful, understandable starting point without committing to a large transformation program. |
| Evidence at launch | Feature real projects, permitted founder experience or internal products, clearly labeled by context and role. | Lets the website demonstrate capability honestly. A founder's previous work can be valuable, but should not be presented as a Spacegear client engagement. |

Brand spelling, domain and necessary company/contact details must also be settled before publication. Required policy and contact facts remain accurate without turning them into scale-related marketing. No public pricing, promised timeline or response SLA should be invented to fill a layout. The assessment offer and available proof are still proposals/input needs; the audience decision is settled.

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

Each service page owns a distinct problem/service search intent. Useful articles answer narrower questions and support those pages. Research search demand across the chosen publishing language without requiring a narrow customer segment. Avoid manufacturing dozens of near-duplicate industry or city pages.

Target 100 in the Lighthouse categories; retain the documented performance gates and real-world Core Web Vitals checks. Search/AI visibility depends on content relevance, credibility and access as well as technical quality. Google requires no special AI markup for its AI search features. [Google guidance](https://developers.google.com/search/docs/appearance/ai-features)

Measure accepted inquiries, replies and resulting conversations alongside page performance. The form has no sector, location, headcount or budget screening; company and service interest remain optional, and the email field accepts personal or business addresses. Keep spam protection and input validation. Cloudflare Web Analytics does not currently provide custom conversion events or UTM collection; start with D1 inquiry counts and a private follow-up record, then add a small Cloudflare Analytics Engine integration only if needed. [Cloudflare FAQ](https://developers.cloudflare.com/web-analytics/faq/)

## Repository and next handoff

You supplied [SanhVo2023/platform-design-contest](https://github.com/SanhVo2023/platform-design-contest). GitHub API metadata reports it is empty and Git advertises no refs. The local `platform-clone` folder remains the source of the website we reviewed. It contains substantial uncommitted work that must be preserved before importing it into a new repository.

Three direct clone attempts, including one after the owner's latest instruction, failed to connect to GitHub. The earlier Cockpit fallback failed; the owner has now explicitly removed Cockpit from the workflow. Continue with direct tools under the available permissions. Cockpit registration is not a prerequisite. No clone, source upload, push, deployment or application edit has been completed in this refinement stage.

The audience and scale decisions are now recorded. Keep the assessment as the recommended starting offer and use only real, permitted evidence; illustrative workflows are sufficient when project proof is not yet available. Further audience selection is not a planning or build blocker.

- [Complete design and architecture](2026-10-20-spacegear-revival-design.md)
- [Implementation checklist](../plans/2026-10-20-spacegear-revival.md)
- [Original audit with repository update](../../audits/2026-10-20-spacegear-site-audit.md)
