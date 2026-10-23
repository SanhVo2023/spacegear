# Production deployments

## 2026-10-23: first launch of spacegear.tech

- **Worker:** `spacegear-tech` (`--env production`)
  - Version `87aa2c9c-f39c-47d6-9355-18d56609939a`, created 2026-10-23T02:37:33Z.
  - It is attached to the custom domain `spacegear.tech`, which replaces the Squarespace "Coming Soon" page.
- **Source:** `master` at `8ec97ea`, with the custom-domain route committed alongside this record.
  - Built with `npm run build:production` in a fresh checkout.
  - Export valid: 12 core pages, 181 files, 10.67 MiB.
- **Build variables:**
  - `NEXT_PUBLIC_SITE_URL=https://spacegear.tech`
  - `NEXT_PUBLIC_CONTACT_EMAIL=admin@spacegear.tech`
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAFg-V2bSRNV87fkb` (widget "spacegear.tech contact", managed mode)
  - `POLICIES_APPROVED=true` (the owner approved `content/legal/*.md` as written)
- **D1:** `spacegear-production` (APAC), id `b618e082-fb6d-4d78-9b85-c2a5bb350a7d`, migration `0001_inquiries` applied.
- **Inquiries:**
  - Capture is on (`CONTACT_ENABLED=true`), with the Worker secret `TURNSTILE_SECRET_KEY`.
  - Owner notifications are off (`NOTIFICATIONS_ENABLED=false`) until a sender is verified.
  - To read new inquiries: `npx wrangler d1 execute DB --remote --env production --command "SELECT id,name,email,company,service,created_at,status FROM inquiries ORDER BY created_at DESC LIMIT 20"`.
- **Checks on the live site:**
  - `check-seo --production` passed (12 pages, 12 internal paths, 8 images, no-JS content, 404s, canonical redirect).
  - `POST /api/contact` with an empty body returns 400 with field errors. A 503 would mean the secret or the database is missing.
- **Rollback:** `npx wrangler rollback <version-id> --env production`. The only earlier version, `0ff7c44c-…`, has no custom domain.
- **Open items:**
  - Turn on "Always Use HTTPS" (`http://` currently serves 200).
  - Add a `www` → apex Redirect Rule.
  - Restore the Google Workspace MX record (the zone has none) and fix SPF.

## 2026-10-23: cron and brand docs

- Version `4c09a23e-6168-4baf-a8f4-440d901999af`, built from `master` at `79f151a`. The site source is unchanged; the stylesheet is byte-identical.
- An account workers.dev subdomain `spacegear` was created through the API, so the `*/5 * * * *` cron (rate-limit cleanup, notification outbox) is now registered. The Worker keeps `workers_dev: false`, so the site is not served on workers.dev.
- Email DNS restored by the owner: MX `1 smtp.google.com`, SPF `v=spf1 include:_spf.google.com ~all`, and Google DKIM `google._domainkey` published.
