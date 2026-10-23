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

## 2026-10-24: Vietnamese site, Labs and the first article

- **Worker:** `spacegear-tech` (`--env production`), version `eea3a169-414e-4875-9f8a-166f843cc441`.
  - Deployed with Wrangler from this worktree after the owner signed in to the spacegear account. `account_id` is pinned in `wrangler.jsonc`, so another account's session cannot deploy here.
  - The version before it, `14b1baf1-fb58-47c3-a88a-8f10c4dfecd2` (2026-10-23, a secret change on the first release), is the rollback target: `npx wrangler rollback 14b1baf1-fb58-47c3-a88a-8f10c4dfecd2 --env production` returns to the English-only site.
- **Source:** `master` at `bc96d92`, built with `npm ci`, `rm -rf .next dist` and `npm run build:production` (the values in `release.env`).
  - Export valid: 24 core pages, 1 English and 1 Vietnamese Labs article, 407 files, 16.18 MiB. The upload sent 231 files; 174 were already there.
- **New on the live site:**
  - Vietnamese under `/vi/`. A visitor from Vietnam, or one whose browser asks for Vietnamese, is sent from an English page to its `/vi/` twin; the language switch sets the cookie `sg_lang` for one year.
  - Labs: `/labs/`, `/vi/labs/`, the article "How we built spacegear.tech with Claude Code agents" in both languages, an RSS feed per language and `/llms.txt`.
  - The cursor update, the address and phone number, and GitHub sign-in for the CMS.
  - No new D1 migration.
- **Checks on the live site:**
  - `check-seo --production` passed: 28 pages (24 core, 4 Labs), hreflang both ways, 58 internal paths, 23 images, no-JS content, feeds and `llms.txt`, 404s and the canonical redirect. It ran with the crawl fix in `7466739`: from a Vietnamese IP the crawl must choose English by cookie.
  - From this machine (in Vietnam), `/` answers 302 to `/vi/`, and so does `Accept-Language: vi`. `/?lang=en` answers 302 to `/` and sets `sg_lang=en; Max-Age=31536000; SameSite=Lax; Secure`; with that cookie `/` is 200 in English. `/about/` goes to `/vi/about/`.
  - The Labs pages and the cover image return 200; both feeds are `application/rss+xml; charset=utf-8`; `/labs/nope/` is 404.
  - `GET /api/auth?provider=github` answers 302 to GitHub's authorize page, so the client secret is set. `POST /api/contact` with `{}` returns 400.
  - `http://` and `www.` both answer 301 to `https://spacegear.tech/`, so the first launch's two open items are done.
- **Open items:**
  - Workers Builds is still not connected; this deploy ran from Wrangler. Once it is connected, each push to `main` deploys.
  - Bump markdown-it to 15.0.3 on or after 2026-10-30.
  - Delete the empty `_domainkey` TXT record.
