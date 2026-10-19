# Spacegear revival: audit of the existing website

Date: 20 October 2026. Scope: read-only analysis of the existing application and public deployment; planning documents and baseline screenshots only.

## Evidence and repository status

- Local project: `E:\Personal\clone website\platform-clone`.
- Public deployment discovered in `src/app/layout.tsx`: https://platform-clone-gilt.vercel.app/ . Opened successfully in Chrome; the web retrieval tool could not access it.
- Git branch: `master`; HEAD: `4f32c6e`, the initial Create Next App commit. `git remote -v` returned no remotes. The current implementation includes substantial pre-existing modified and untracked files. These must be preserved.
- No repository URL was provided. A remote clone has **not** been performed. Cloning the local Git history alone would omit the current uncommitted implementation. Do not treat that as a usable source clone.
- Cockpit `get_project_brief` returned “Folder is not registered in Cockpit” for both the workspace and application folders. Decision logging also failed for this reason. This is not a Cockpit task worktree; no task ID or acceptance criteria were supplied by the server.
- Stack from `package.json`: Next.js 16.2.7, React 19.2.4, TypeScript, Tailwind CSS 4, Motion 12.40.0, Three.js 0.184.0, React Three Fiber and Drei. These are declared versions/ranges, not a dependency security audit.
- Reviewed home, services, product and article routes; shared content; navigation/footer; motion primitives; hero and globe; asset pipeline and file sizes.
- Visual evidence: [desktop](spacegear-2026-10-20/desktop-before.png), [mobile viewport](spacegear-2026-10-20/mobile-before.png). Existing workspace screenshots were also inspected as historical references.

## What should survive

The visual language fits Spacegear well: charcoal backgrounds, orange accents, large tight headings, small monospace labels, orbital imagery, rounded panels, fine borders and generous spacing. The globe sequence, illuminated scroll statement, stacked work cards, section reveals and curtain footer distinguish the site.

Preserve those recognizable elements. Change their business meaning, the content model and conversion journey. Avoid redesigning every component merely to rename the business.

## Findings

| Priority | Evidence | Implication and planned response |
|---|---|---|
| P0 | `layout.tsx`, `Nav.tsx`, `Footer.tsx`, `ui.tsx` and section copy identify Platform/Platform B.V.; footer includes an Amsterdam address and `hello@platform.nl` | Replace the complete entity identity, metadata, contact details, social assets and legal copy. Only publish verified Spacegear facts. |
| P0 | `content.ts` describes five named products and invented-looking product specifications; pricing presents $49/$89/$249 subscriptions | Rebuild the offer around consulting and delivery services. Existing content is not evidence for Spacegear claims. |
| P0 | Hero and analytics contain uptime/performance/accuracy claims; marquee mentions 10M users, 200+ enterprise clients, an AWS partnership and TechCrunch | Remove unless independently substantiated for Spacegear. Reuse graphic treatments for delivery stages and evaluation criteria, not unsupported success metrics. |
| P0 | Footer newsletter `onSubmit` only prevents the default action; many CTAs end at the footer | Replace with a functioning inquiry journey with validation, durable storage, accessible success/error states and owner notification. |
| P0 | Live homepage DOM contains **29 links with `href="#"`** | Repair navigation, legal/social destinations and secondary actions. Remove destinations without real content. |
| P1 | Live homepage DOM has **no canonical link and no JSON-LD** | Add canonical URLs and relevant, truthful Organization/WebSite/Service/Article/BreadcrumbList data. |
| P1 | Root metadata uses the Vercel preview URL; detail metadata largely changes only the title | Set the final Spacegear origin, unique descriptions and social cards for every indexable route. |
| P1 | No sitemap or robots implementation found in the source inventory; no individual service routes, About, Contact or real policy routes | Build a crawlable multi-page consultancy site with real information architecture. Live robots/sitemap responses have not been independently verified. |
| P1 | `public/models/earth-4k.glb`: **10,372,724 bytes**, about 9.89 MiB; the hero imports this model | Optimize and defer the 3D enhancement; text and CTA must appear before the model. Preserve a poster fallback. File size is a measured asset size, not a measured network transfer. |
| P1 | `public/gen-raw/galaxy.png`: **27,303,335 bytes**, about 26.04 MiB, plus many other large PNG masters | Move masters out of the deployable public tree. This individual PNG exceeds the documented 25 MiB Workers Static Assets file limit. Do not deploy source art. |
| P1 | `Starfield.tsx` calls `draw()` under reduced motion, but `draw()` always schedules another animation frame | Reduced motion does not stop that loop. Fix the loop, respond to preference changes, and pause decorative animation offscreen/in background tabs. |
| P1 | `HeroCopy`, `Appear`, `Reveal` and scroll text initially hide/dim text and depend on client animation | Make primary content visible in initial HTML and when JavaScript fails. Enhance visible content with motion. Desktop hero also changes structure/height after mounting; measure its layout effects. |
| P1 | Many section files are client components; the hero has a 300vh pinned desktop sequence | Audit JS boundaries and scroll cost. Keep server-rendered copy separate from interactive controls. Retain desktop choreography with accessible mobile/reduced-motion behavior. |
| P1 | Desktop dropdown display relies on group hover; mobile toggle lacks expanded/controls state; several controls have placeholder behavior | Add keyboard operation, focus visibility, Escape handling, meaningful accessible names and accurate state. Preserve appearance. |
| P2 | Many native image elements have no responsive source set or explicit loading policy | Retain useful WebP optimization; add variants, dimensions/aspect ratios and below-fold lazy loading. Prioritize only the actual hero image. |
| P2 | Low-opacity text and dark muted tokens are common | Measure contrast and improve readable text while preserving the palette. Screenshots are not a WCAG audit. |
| P2 | README still recommends Vercel; no Wrangler/Cloudflare deployment configuration found | Document and implement a Cloudflare-only runtime and build/deploy path. Remove Vercel-specific deployment instructions. |

The current hero already selects a static backdrop for narrow screens and reduced motion, and the curtain footer falls back to normal flow when necessary. These are good foundations to retain and complete.

## Baseline checks and limits

- `npx tsc --noEmit`: passed, exit code 0.
- `npm run build`: passed, exit code 0. Next.js compiled and generated the existing static/SSG pages. This validates the existing Next.js build, not the proposed Cloudflare deployment or static-export configuration.
- `npm run lint`: failed, exit code 1, with four errors and one warning. Details are recorded below. Initial runs were interrupted when the tool session changed; the final results above are from completed replacement runs.
- Browser: desktop hero eventually rendered the globe and copy; mobile hero and opening the mobile menu were inspected. A Three.js clock deprecation warning was observed; no broader console-clean claim is made.
- Lighthouse, PageSpeed Insights, CrUX, Search Console, keyword demand, backlink profile and conversion analytics were **not** measured. No current numerical SEO/performance score is claimed.
- A brief first-load capture showed only the decorative backdrop before the hero finished appearing. This is a reason to measure and improve initial rendering, not an LCP result.
- Not all interactions and breakpoints were exercised. The implementation plan specifies full checks before release.

## Recommended implementation direction

Keep Next.js and the existing visual components. Export marketing pages to static HTML; serve them through Cloudflare Workers Static Assets. Use a separate Worker entry in the same deployment for `/api/contact`, with D1 and Turnstile. Store content in the repository, with builds on Cloudflare. Use Cloudflare email capabilities for internal notifications after account/domain verification; do not make beta email availability a prerequisite for rendering the site.

Next.js static export is documented in the installed `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`. It supports build-time HTML and client interactions, but not Server Actions, runtime POST route handlers, default runtime image optimization, or Next.js server redirects. The plan places dynamic behavior and redirects at Cloudflare instead.

## Research sources checked

- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/): assets and Worker code can ship together; assets are cached and served across Cloudflare's network.
- [Cloudflare SSG routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/): explicit HTML routing, real 404 responses and navigation behavior.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): deployable asset size constraints.
- [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/): OpenNext is the alternative if runtime Next.js features are later needed.
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/): browser token plus mandatory server verification.
- [Cloudflare email sending](https://developers.cloudflare.com/email-service/get-started/send-emails/): current Cloudflare sending path; documentation labels sending beta, so account eligibility needs checking.
- [Cloudflare bot classifications](https://developers.cloudflare.com/bots/concepts/bot/): distinguish search, agent activity and training when configuring crawler access.
- [Google AI features](https://developers.google.com/search/docs/appearance/ai-features): conventional SEO applies; no special AI schema or AI text file is required for Google's AI features.
- [Core Web Vitals](https://web.dev/articles/vitals): LCP, INP and CLS; field assessment at the 75th percentile, separately for mobile and desktop.

## Final verification note

Completed baseline checks: build and TypeScript pass; lint fails with these existing findings:

| File | Location | Finding |
|---|---|---|
| `src/components/EarthScene.tsx` | 144 | `react-hooks/immutability`: mutating a texture returned by a hook |
| `src/components/Starfield.tsx` | 25 | `react-hooks/refs`: updating a ref during render |
| `src/components/Starfield.tsx` | 46 | Unused variable `t` warning |
| `src/components/sections/OrbitalCinematic.tsx` | 158 | `react-hooks/set-state-in-effect`: synchronous state update inside an effect |
| `src/components/sections/OrbitalCinematic.tsx` | 256 | `react/jsx-no-comment-textnodes`: comment-like text in JSX children |

The design was reviewed independently with the builder-check prompt; the reviewer reported “nothing important left.” Documentation and screenshot files were added; existing application code was not changed. Cockpit progress submission was attempted and returned the same unregistered-folder error. No deployment or remote clone has been performed.
