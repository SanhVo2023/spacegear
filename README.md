# spacegear.tech

Digital transformation and AI consultancy website. Next.js exports 12 visible HTML pages; Cloudflare Workers Static Assets serves them. A same-origin Worker validates inquiries with Turnstile, stores them in D1 and queues owner notifications through Cloudflare Email Service.

Customer eligibility is open across industries, regions and company sizes. Public copy and schema contain no company-scale claims or fictional clients, staff, testimonials or results.

## Local development

Use Node 22.14+ and npm. Run `npm ci`, then `npm run dev` for development.

For the actual Cloudflare runtime:

```sh
npm run build:cf
npm run db:migrate:local
npm run preview:cf
```

Open http://localhost:8787. Preview is non-indexable and cannot send inquiries without explicit contact configuration. Only **dist/** is deployable; **out/** is an intermediate export containing preserved source assets. Packaging uses explicit route/asset lists. Production packaging requires a fresh checkout without an existing dist directory; local previews preserve existing files.

If Windows restricts Wrangler's global config writes, set XDG_CONFIG_HOME to this checkout's .wrangler/config and WRANGLER_LOG_PATH to artifacts/wrangler-preview.log for local commands. Keep production authentication in the supported credential store.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build:cf
npm run check:seo
npm run test:browser
npm run check:fidelity
```

The last three expect the local Cloudflare server. Install the pinned browser with `npx playwright install chromium`, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to a compatible Chromium executable. The SEO command also accepts a URL and --production.

`check:fidelity` compares every home section with the original platform-clone build. Serve it with `npx next start -p 3101 -H 127.0.0.1` from that folder, alongside the local Cloudflare preview. The check writes side-by-side sheets to `artifacts/fidelity/`. A person reviews those sheets before release; the height check alone is not sign-off.

Tests cover durable capture, same-key races against local D1, transactional rollback, throttling, notification retries, publication guards, canonical routes, no-JavaScript content, reduced motion, responsive layout, keyboard navigation and the actual form's recovery behavior. Browser timings are local observations, not Lighthouse scores or field measurements.

## Content and release

- [Content](src/lib/content.ts): services, engagements, FAQs and illustrative use cases.
- [Site configuration](src/lib/site.ts) and [.env.example](.env.example): identity and publication settings.
- [Cloudflare release runbook](docs/operations/cloudflare-release.md): bindings, gates, operations and rollback.
- [Source provenance](docs/operations/source-provenance.md): preserved source and clone status.
- [Implementation record](docs/operations/implementation-status.md): evidence and remaining dependencies.

The original checkout remains intact. The supplied GitHub destination was empty when inspected; cloning and Cloudflare account access were blocked by network access in this environment. No remote push or public deployment is claimed.
