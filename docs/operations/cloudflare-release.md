# Cloudflare release runbook

## Architecture and current state

Confirmed public name and canonical origin: **spacegear.tech**, **https://spacegear.tech**. Hosting/runtime are Cloudflare Workers Static Assets, Workers, D1, Turnstile and optional Cloudflare Email Service. Fonts and art are self hosted. Turnstile is the only external browser dependency, loaded on configured contact pages. The editor-only /admin/ page (Sveltia CMS, vendored) also loads its interface fonts from jsDelivr under its own CSP; see README.md, "The admin Content-Security-Policy".

Checked-in configuration is inert: no custom-domain route, public workers.dev URL, live inquiry capture or email sending. Local D1/Workers are testable without remote access. No Cloudflare account, zone, production D1 ID, Turnstile credentials or sender has been verified here.

## Launch inputs

1. Confirm the public contact email and private inquiry owner destination. Do not infer a mailbox.
2. Review the concrete privacy/terms pages against the actual legal entity, jurisdiction, retention/deletion process and contact facts. Keep company-scale marketing private; truthful required legal details remain a separate concern.
3. Verify account access and zone ownership. Check Cloudflare Access, WAF and crawler settings.
4. Provision separate preview/production D1 databases, pin IDs in their Wrangler environments, and apply the migration. Preview must never use production data.
5. Create the production Turnstile widget for spacegear.tech. The Worker verifies hostname and action contact. Store TURNSTILE_SECRET_KEY through `wrangler secret put TURNSTILE_SECRET_KEY --env production`; never commit it.
6. Verify the Cloudflare Email Service sender and fixed owner recipient. Actual authorized delivery must be tested before claiming notifications work. Alternatively leave sending disabled and explicitly operate D1 inquiries through daily owner review.

| Binding | Purpose |
|---|---|
| ASSETS | dist/ release package |
| DB | D1 inquiry/outbox/rate-limit database |
| EMAIL | Cloudflare Email Service binding |
| SITE_ORIGIN | Exact request origin: https://spacegear.tech |
| CONTACT_ENABLED | true only after challenge/capture configuration is verified |
| NOTIFICATIONS_ENABLED | true only after sending capability is verified |
| OWNER_EMAIL, SENDER_EMAIL | Fixed verified destinations, never chosen by user input |
| TURNSTILE_SECRET_KEY | Worker secret |

Production build variables: `npm run build:production` sets SITE_MODE=production and reads the public values from [release.env](../../release.env): NEXT_PUBLIC_SITE_URL=https://spacegear.tech, NEXT_PUBLIC_CONTACT_EMAIL=admin@spacegear.tech, the production NEXT_PUBLIC_TURNSTILE_SITE_KEY and POLICIES_APPROVED=true. Workers Builds therefore needs no build variables. A variable that is set, and not empty, in the build environment wins over its line in release.env (for example to build a copy for another origin); the build log names where each value came from. release.env accepts only these four public keys, so a secret cannot be committed through it; secrets stay Worker secrets. It is not named `.env.production` because Next.js would load that file into preview builds (`npm run build:cf`) too. Validation rejects missing facts and known dummy Turnstile keys; it does not independently verify email/domain ownership.

## Release sequence

1. Reconcile this preserved branch with the supplied GitHub repository when connectivity works. Review the source manifest and exact commit. Do not force-push over owner work.
2. Run npm ci, npm run lint, npm run typecheck, npm test, then npm run build:production (its variables come from release.env). Deploy **dist/**, never out/. Use a fresh checkout without dist for a production build to prevent stale output.
3. Run `wrangler deploy --dry-run --env production`; inspect bindings/size. Run `wrangler d1 migrations apply DB --remote --env production` against the verified database.
4. Add the production custom domain: routes with pattern spacegear.tech and custom_domain true. If www is actually used, configure a one-hop Cloudflare Redirect Rule to apex preserving path/query.
5. Connect Cloudflare Workers Builds to the reviewed repository/branch, using the same gates and build command.
6. Deploy the tested package using supported Wrangler authentication. Record Worker version ID, source commit, D1 ID, configuration and report hashes. Protect private remote previews with Cloudflare Access; noindex alone is not access control.
7. Run `node scripts/check-seo.mjs https://spacegear.tech --production`. Check TLS, canonical domain/301s, retired/unknown 404s, robots/sitemap, CSP, assets/fonts and caching. Production must have no preview noindex.
8. Submit an explicitly authorized test inquiry. Verify one inquiry/outbox row, the owner's operational access and retry semantics. Confirm actual email delivery if enabled. Handle test records under the agreed retention process.

Browser tests assert an inert preview form and use isolated fixtures for verification/API responses. They do not prove real production Turnstile or email delivery.

## Search and performance gates

Every core page needs distinct metadata, one H1, canonical URL, truthful JSON-LD, working links and visible initial HTML without JavaScript. Fictional /work/* and /labs/* routes return 404. No empty editorial routes or invented authors are published.

Target Lighthouse 100 SEO/accessibility/best practices and performance median >=95 with no run <90: three cold runs for home/service/contact on mobile and desktop. Record tool version/settings. Scores remain unmeasured here; custom checks are not equivalent to Lighthouse 100. Field LCP/INP/CLS need sufficient live traffic.

Enable Cloudflare Web Analytics after obtaining its site token, reviewing privacy copy and updating CSP for its exact script/connect origins. It does not provide arbitrary custom conversion events or UTM attribution. Measure accepted inquiries in D1, private follow-up counts and operational failures. Custom event collection is later scope.

Submit the sitemap using verified Google Search Console/Bing Webmaster Tools accounts after launch. Review discovery, WAF/bot decisions and business results at 30/60/90 days. Clear service descriptions, processes and structured data aid machine interpretation; no ranking or AI citation is guaranteed.

## Operations and recovery

Personal email is accepted; company/service are optional. No industry, location, size or budget screening. Requests are limited to 16 KiB and five valid attempts per minute per hashed client key. Keys expire after an hour and scheduled cleanup runs every five minutes.

Success means a committed D1 inquiry/outbox. Identical key/payload retries return the accepted record; changed content returns 409. Inserts are atomic. Success does not claim email delivery.

Outbox processing uses leases and at most five attempts with exponential backoff. Email is at-least-once: provider acceptance followed by lost acknowledgement can repeat a notification. Inquiry IDs identify duplicates. Privately inspect failed or stalled rows; never log briefs/emails.

Approve and implement final retention before public inquiries open. Current code cleans rate limits only; it does not automatically delete inquiries. Use the agreed review/deletion process for inquiry and linked outbox data.

Rollback with `wrangler rollback <verified-version-id> --env production`. Preserve D1/outbox data. If capture fails, disable it truthfully and keep the verified email fallback. Re-run smoke checks after rollback.

Primary references checked: [Static Assets routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/), [Turnstile verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Email Worker API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/).
