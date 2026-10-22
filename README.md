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

Open http://localhost:8787 (the `preview:cf` port; use your preview's port if you started it on another). Preview is non-indexable and cannot send inquiries without explicit contact configuration. Only **dist/** is deployable; **out/** is an intermediate export containing preserved source assets. Packaging uses explicit route/asset lists. Production packaging requires a fresh checkout without an existing dist directory; local previews preserve existing files.

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

## Editing content

Most of the site's copy is kept in [content/](content/), as JSON and Markdown files that the editor at `/admin/` changes for you:

- the home page: the hero, the section headings and the copy of every home section, including the illustrative dashboard, the questions and answers, the team, the testimonials, the articles and the footer;
- the five services, which also fill each service page's introduction, title and description;
- the three engagements;
- the site name, description and social profiles;
- the text sections of the privacy and terms pages.

Some copy still lives in the code (`src/app/` and `src/components/`), and changing it needs a developer: the introductions of the About, Approach, Services and Contact pages, the fixed headings on the service pages (such as "What you receive"), the navigation labels, a few labels inside the home sections (such as the footer's "Discuss a project" link), the headers and notices of the privacy and terms pages, and the title and description of every page except the service pages.

Images that editors add go to `public/uploads/`. The site reads all of these files when it is built, so nothing is fetched while a visitor reads a page.

The editor is [Sveltia CMS](https://sveltiacms.app/) 0.230.1. A copy of it is kept in this repository (`public/admin/sveltia/`), so none of its code comes from another site; only its interface fonts load from jsDelivr. `/admin/` is not linked from the site and is hidden from search engines.

### Edit locally (today)

You need Chrome or Edge on a desktop computer. The editor saves into a folder on your computer through a browser feature that Firefox and Safari lack, and it only works on `localhost` or `127.0.0.1`.

1. Build and start the preview: `npm run build:cf`, then `npm run preview:cf`. Use this preview rather than `npm run dev`, because it serves `/admin/` with the same security settings as the live site.
2. Open http://localhost:8787/admin/ (the `preview:cf` port; use your preview's port if you started it on another).
3. Choose **Work with Local Repository** and select this repository's root folder, the one that contains `.git`. The CMS saves files into the folder but never commits (Sveltia 0.230.1's local workflow has no Git support), so commit with Git.
4. Edit and **Save**. The CMS writes straight into `content/` and `public/uploads/`. It does not rebuild the site.
5. To see the change, rebuild (`npm run build:cf`) and restart the preview. The build checks every file (see "What the build checks"). If anything is wrong, it stops and lists what to fix (see "Reading the content check").
6. Review `git diff`, run `npm test` and commit. A copy edit that the build accepts also passes `npm test`.

The editor's own menus follow the browser language. Translations other than English would come from another site, which the editor's security settings block. If the editor reports a translation error, choose English in its settings.

Later, editors will sign in with GitHub on the live site instead, and every save will be a commit that rebuilds the site (see "Setting up editing from GitHub").

### What the build checks

- No prices, invented metrics, clients, press, offices, ratings or experience claims, in any field of any content file (see "The honesty scan").
- The counts on the page match the data: the "5/5" badges and the first hero figure count the services, and the "01/03" badge and the second hero figure count the engagements. The second hero figure's line names the engagements in list order.
- The team cards describe disciplines, not people. A card name of two to four words is refused when it reads like a person's name: it starts with a title such as "Dr", or every word is a capitalised name word ("Ada Lovelace", "J. Smith", "Nguyễn Văn An", "Ludwig van Beethoven") and none of them is a discipline word such as "Engineering", "Design" or "Data". So "Data Engineering", "Product Design" and "Applied AI" pass. If a real discipline is refused, write it in sentence case ("Brand storytelling") or with "&" ("Brand & Story"); a developer can also add the word to `DISCIPLINE_WORDS` in `scripts/lib/content-rules.mjs`. A real person goes in the founder card. Team cards may not use the original site's stock portraits (`/images/team/`), and testimonials and articles may not use its stock reviews and labs images.
- The sample dashboard stays labelled: its section description must say "illustrative" and "not client results", and each of its cards must call itself illustrative, an example or a sample.
- A testimonial is shown only after its permission box is ticked.
- Every link points at a page of the site (such as `/contact/`), optionally with a section or a query after it (`/#faq`, `/about/#team`, `/contact/?service=applied-ai`), or at a full `https://` address.
- Services and engagements cannot be added or removed in the CMS: each service has its own page, and the engagements are the three stages the page counts.
- The site uses some values to tell items apart, so they must be unique: questions, engagement names, article slugs, the services that the work tiles point at, the name and company of each testimonial, and the items of each deliverables and outcomes list. Exactly one engagement is featured.
- Every image that a field points at must exist, with exactly that name and letter case.

#### Images and uploads

- **Formats.** Upload JPEG, PNG, AVIF, WebP or GIF files of up to 10 MiB. The CMS converts JPEG, PNG and AVIF to WebP (quality 85, at most 2560 × 2560 pixels). The conversion removes all hidden information stored in the file, such as the camera and the place where a photo was taken.
- **Animations.** GIF and WebP files are saved as they are, so animations keep playing. Use GIF or animated WebP for an animation: the CMS turns an animated PNG into a still image, and the build refuses an animated PNG or animated AVIF added outside the CMS.
- **HEIC** (the iPhone photo format) is refused when you upload it ("Failed to decode HEIC image"). Export the photo as JPEG first.
- **Location.** An upload must not record where it was taken (GPS), because uploads are published as they are. GIF and WebP files are saved unchanged, so a GIF or WebP that records a location keeps it, and the build refuses it: "contains location data (GPS in its … metadata), which would be published with the image: re-export it without location data and upload it again". A file whose hidden information cannot be read is refused in the same way.
- **File names.** The CMS renames uploads to lowercase letters without accents, digits, `-` and `_`. For example, `Ảnh đẹp.JPG` becomes `anh-dep.webp` and `Banner 1280.png` becomes `banner-1280.webp`. Names are cut to 60 characters, and a name that is already taken gets `-1`, `-2` and so on. Three cases slip through:
  - `~` is kept (`scan~2.jpg` becomes `scan~2.webp`);
  - a browser set to Turkish writes a dotless `ı` for `I` (`IMG_0042.JPG` becomes `ımg_0042.webp`);
  - a Windows device name such as `con.png`, `COM1.jpg` or `nul.webp` cannot be uploaded at all: the CMS fails and saves nothing.

  The build refuses the first two and suggests a name, for example `rename it, for example to scan-2.webp`. It is simpler to rename such a file before uploading it: use lowercase letters, digits, `-` and `_` only, for example `scan-2.jpg` or `img-0042.jpg`.
- **Smaller copies.** Every build makes smaller copies of each upload for faster pages; there is nothing to do (see "Upload variants").
- **Site images.** The images that shipped before the CMS stay in `public/images/`. Pick them under **Site images (read only)**, or type their path.
- **Nothing else.** Only image files may sit in `public/uploads/` (no SVG or other files), and on Windows a file's path must be shorter than 250 characters.

#### New entries and file names

- New entries get a file name made from one of their fields, with the same rules as uploads: a question from its question, a team discipline from its name, a testimonial from its company and name, and an article from its slug field. A name that starts with `_` (`_underscore start` gives `_underscore-start.json`), or that contains `~` or the dotless `ı`, gives a file name that the build refuses. `npm run content:index` names the file; rename it to lowercase letters, digits, `-` and `_`, starting with a letter or a digit.
- If you add, rename or delete an entry file by hand, run `npm run content:index`. The build does this too.

#### Engagement stage numbers

The stage numbers of the engagements (01, 02, 03) must follow the list order. Dragging engagements into a new order does not renumber them. The content check then names each engagement and the number to set, for example `… is number 1 in the list but its stage number is "02"; … set it to "01"`. Change the stage numbers in the CMS and save.

#### Legal pages

`content/legal/privacy.md` and `content/legal/terms.md` hold the sections of the privacy and terms pages. The CMS refuses to save anything that the build would refuse:

- The page starts with a `## ` heading, and every section starts with a line `## Heading`.
- Below each heading there is at least one plain paragraph. Paragraphs are separated by blank lines.
- No lists (lines that start with `-`, `+`, `*` or a number such as `1.`), no other heading levels (`#`, `###`), no `#` inside a heading, and no lines of only `-` or `=`.
- None of the characters `*`, `_`, `` ` ``, `<`, `>`, `[`, `]`, `\`, `|` or `~~`, and no codes such as `&amp;`.

Leave a blank line before each heading. The preview notice and the contact section come from the site settings, not from these files.

### Reading the content check

Every build runs the content check, and it also runs on its own: `node --experimental-strip-types scripts/check-content.mjs`. It prints every problem in one list (`Content check failed. Fix these problems:`), each with its file, its field and what to change, and then exits with an error.

- **Counting.** List positions start at 0: `deliverables[3]` is the fourth item, and `FAQS[1]` is the second question on the site. Line numbers in the legal pages start at 1.
- **Fields are named by their path in the file.** `work.heading` in `content/sections.json` is the `heading` inside `work`.
- **A file, or the copy as the site loads it.** A message that starts with `content/…` names a file. A message that says `export` names the copy as the site loads it, by its name in the code, such as `FAQS` (the questions) or `SERVICES` (the services), in the order of the site.

#### The honesty scan

[scripts/lib/honesty.mjs](scripts/lib/honesty.mjs) refuses claims that the site cannot back up: prices and rates, the original platform's metrics and old brand, counts of clients, users or staff, scale figures, multipliers, press and partner claims, ratings, awards and certifications, office locations, founding years and years of experience, delivery timelines, and client results. It reads every text of every file under `content/`, including fields the site does not show, and the copy as the site loads it. A figure split over several fields (a value with its unit and label, or a title with its text) is read as one phrase. The content check and `npm test` both run it.

A problem looks like this:

```text
forbidden claim in content/faqs/scope-and-pricing.json: answer: a price ("$4")
forbidden claim in export FAQS[1].answer: a client or scale claim ("50 companies")
```

Each message names the file, or the copy as the site loads it, then the field, the kind of claim, and the text that matched, which may be only part of the claim. The same claim usually appears twice. Reword the copy: the CMS cannot switch a rule off.

There are two exceptions. The illustrative dashboard (`content/measure.json`) may show percentages and figures such as 12k in its figure fields. The legal pages may state periods ("within 90 days") and name the services that process data.

The scan is a safety net, not a review. Its known gaps are listed in the code: Vietnamese phrasing (the site is English-only today), look-alike letters (a Cyrillic "Ѕ") and digits from other scripts, codes such as `&#36;`, a backslash-u escape written as text, a claim split over list items, and some phrasings such as "200 loyal clients", "a team of 30" or "five stars on Google".

## Maintaining the CMS

### The CMS configuration

The CMS configuration is [public/admin/config.yml](public/admin/config.yml). It mirrors [src/lib/content-model.ts](src/lib/content-model.ts), and `npm test` fails when the two drift apart. `npm test` also validates it against the vendored release's own schema (`node scripts/check-sveltia-config.mjs`; see "Upgrading Sveltia"). The CMS reads `config.yml` from the preview, so rebuild after changing it. The rules that the schemas cannot express, such as the counts and the illustrative labels, are in [scripts/lib/content-rules.mjs](scripts/lib/content-rules.mjs), which the content check runs (so `npm run build:production` enforces them too).

### Upload variants

- Every build (`scripts/build-upload-variants.mjs`) makes WebP copies of each upload except GIFs, at most 640 and 1280 px wide; a smaller image is not enlarged.
- The copies are kept in `.cache/upload-variants/` (ignored by Git), with a manifest that records each upload's SHA-1, so an unchanged upload is not encoded again. The build never changes or deletes anything in `public/uploads/`, and no upload name is reserved.
- Packaging ships the copies next to the upload under `/uploads/`: `photo.jpg` ships with `photo.jpg.w640.webp` and `photo.jpg.w1280.webp`.
- `contentImage()` in [src/lib/content-images.ts](src/lib/content-images.ts) renders an upload as `photo.jpg.w1280.webp`, with both copies in `srcset`, or as the original under `npm run dev`, which serves only `public/`. The section components do not use it yet (a later change switches them over), so for now pages show the original upload.
- Symbolic links, junctions and hard links are refused anywhere under `public/uploads/`, and are never followed.

### The admin Content-Security-Policy

| Directive | Value | Why |
|---|---|---|
| `script-src` | `'self'` | The vendored bundle and the chunk it loads next to itself. Sveltia needs no `unsafe-eval` or `unsafe-inline`. |
| `style-src` | `'self' 'unsafe-inline'` | Sveltia adds its styles at run time. |
| `font-src` | `'self' https://cdn.jsdelivr.net/fontsource/fonts/material-symbols-outlined:vf@5.3.8/latin-wght-normal.woff2 https://cdn.jsdelivr.net/fontsource/fonts/noto-mono@5.3.0/latin-400-normal.woff2 https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3:vf@5.3.0/latin-wght-normal.woff2` | The bundle's `@font-face` rules load its interface and icon fonts from these three files and no others. A source with a path and no trailing slash allows exactly that file. Without them, the icons show as words. |
| `img-src` | `'self' data: blob:` | Previews of new uploads, and inline icons. |
| `connect-src` | `'self' blob: data:` | The configuration and local files. |
| `media-src`, `frame-src`, `manifest-src` | `'self' blob:`, `blob:`, `'self' blob:` | As in Sveltia's CSP guide. |
| `default-src`, `object-src`, `base-uri`, `form-action`, `frame-ancestors` | `'self'`, `'none'`, `'self'`, `'self'`, `'none'` | Hardening, the same values as the site's own policy. `/admin/` also keeps the site's `X-Frame-Options: DENY` header, for browsers that ignore `frame-ancestors`. |

Two optional requests are blocked on purpose, and both fail quietly:

- the update check, `https://unpkg.com/@sveltia/cms/package.json`;
- the GitHub status check, `https://www.githubstatus.com/api/v2/status.json`, which Sveltia makes on the sign-in screen because the backend is GitHub. Version 0.230.1 has no setting to turn it off.

DevTools shows them as CSP errors. `npm run test:browser` accepts exactly these two and fails on any other blocked request.

Sources: [Sveltia's CSP guide](https://sveltiacms.app/en/docs/security#setting-up-content-security-policy) and the bundle itself (font URLs, update check, chunk loading). The CMS leaves the site's own CSP alone: `public/_headers` removes it for `/admin/*` only. The admin policy is pinned twice, in `public/_headers` and as `ADMIN_CSP` in [scripts/lib/headers.mjs](scripts/lib/headers.mjs). `npm test` and the export check in the build fail when the two differ, or when `/admin/` would get any other `Content-Security-Policy`, `X-Robots-Tag`, `X-Content-Type-Options` or `X-Frame-Options`.

### Uploads are sandboxed

`public/_headers` also has a `/uploads/*` rule. It replaces the site CSP with `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox` and sends `X-Content-Type-Options: nosniff` once.

- An image on a page is not affected. An `<img>` element ignores the headers of the image it loads, and the page's own CSP allows images from the site.
- Opened on its own (through a link or a typed address), an upload is a sandboxed document. It runs no script, loads nothing but images from the site, and is never read as any type other than its own. That also covers a file that only looks like an image, such as an HTML file disguised as a PNG.
- A missing upload's 404 page is shown unstyled, under the same rule.
- The export check (`UPLOADS_CSP` in `scripts/lib/headers.mjs`) and `npm run test:browser` both enforce the rule.

### Setting up editing from GitHub (later)

Not built yet. Once the code is in the GitHub repository (`SanhVo2023/platform-design-contest`):

1. **GitHub OAuth App.** Homepage `https://spacegear.tech`, callback `https://spacegear.tech/api/auth/callback`. Store the client ID as a Worker variable `GITHUB_CLIENT_ID` (in `vars` in `wrangler.jsonc`) and the secret with `wrangler secret put GITHUB_CLIENT_SECRET --env production`.
2. **OAuth endpoint in `worker/index.ts`**, before the `/api` 404 fallback (`assets.run_worker_first` already sends `/api/*` to the Worker). [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) implements this flow as a Cloudflare Worker and can be ported:
   - `GET /api/auth?provider=github&site_id=…&scope=repo`: create a random state, store it in an `HttpOnly; Secure; SameSite=Lax` cookie for 10 minutes and redirect to `https://github.com/login/oauth/authorize?client_id=…&scope=repo&state=…`.
   - `GET /api/auth/callback?code=…&state=…`: compare the state with the cookie, exchange the code at `https://github.com/login/oauth/access_token` (POST, `Accept: application/json`) and return a small HTML page. The page posts `authorizing:github` to `window.opener`, and when the CMS answers from `https://spacegear.tech` it replies `authorization:github:success:{"provider":"github","token":"…"}` to that origin only. Give the page its own CSP header with a hash for its inline script, because `_headers` rules do not apply to Worker responses.
   - **Types:** after adding `GITHUB_CLIENT_ID` to `wrangler.jsonc`, regenerate `worker-configuration.d.ts` with `npx wrangler types --strict-vars=false`. Secrets are not in the generated types: add `GITHUB_CLIENT_SECRET?: string` to `RuntimeEnv` in `worker/types.ts`, next to `TURNSTILE_SECRET_KEY`.
3. **`public/admin/config.yml`:** add `base_url: https://spacegear.tech` and `auth_endpoint: api/auth` under `backend`. Do not set `auth_type: pkce`: Sveltia 0.230.1 itself reports that PKCE is not supported with GitHub (`github_pkce_unsupported`).
4. **Admin CSP.** The CMS then talks to GitHub, so the policy needs:
   - `connect-src`: add `https://api.github.com` (the API) and `https://www.githubstatus.com` (the status check, which is then allowed instead of blocked);
   - `img-src`: add `https://avatars.githubusercontent.com`, the host of the user avatars.

   Sign-in happens in a popup window, so `form-action` stays `'self'`. The policy is pinned exactly, so change it in all of these places in one commit:
   - `public/_headers`;
   - `ADMIN_CSP` in [scripts/lib/headers.mjs](scripts/lib/headers.mjs);
   - the `connect-src` assertions in `tests/admin.test.mjs` and `tests/headers.test.mjs`;
   - in `scripts/admin-check.mjs`: remove the GitHub status check from `TOLERATED`, and accept responses from `https://www.githubstatus.com` in the check that allows nothing from another origin but the three font files.
5. **Cloudflare Workers Builds:** connect the repository and the `main` branch. Build command `npm run build:production`, with the production variables from [the release runbook](docs/operations/cloudflare-release.md); deploy command `npx wrangler deploy --env production`. Every CMS save is a commit, so it triggers a build. A content error fails the build, and the live site keeps the previous version. That build runs the content check, with every rule in "What the build checks", but not `npm test`.
6. **Optional:** protect `/admin/*` with Cloudflare Access. The CMS cannot write without a GitHub login, but Access also hides the page.

### Upgrading Sveltia

1. Pick a release that is at least 14 days old: this repository pins dependencies only after that.
2. In `SVELTIA` in `scripts/vendor-sveltia.mjs`, set `version`, `tarball` and `integrity` from `npm view @sveltia/cms@<version> dist.tarball dist.integrity`, and empty `files` and `schema`.
3. Run `npm run cms:vendor`. It downloads the tarball, checks its integrity, extracts the files into `public/admin/sveltia/` and the release's configuration schema into `scripts/sveltia-cms.schema.json`, and writes their hashes to `scripts/sveltia-cms.lock.json`. Review what it extracted.
4. Copy the hashes from the lock into `SVELTIA.files` and `SVELTIA.schema`, which are the second pin. Then `npm run cms:vendor -- --check` must print `Vendored @sveltia/cms@<version> matches scripts/sveltia-cms.lock.json and the pinned hashes.` The schema never ships: `/admin/` serves `SVELTIA.files` only.
5. Fonts and CSP. If the new bundle names other font files, `npm test` lists them. Put them in `ADMIN_FONTS` in `scripts/lib/headers.mjs` and in `font-src` in `public/_headers`, whose admin policy must stay exactly `ADMIN_CSP`. `npm test` also runs the changed file through Cloudflare's own `_headers` code (see "Upgrading wrangler or miniflare"). Read the release notes for new requests: the browser check fails on any blocked request other than the two above.
6. Run `node scripts/check-sveltia-config.mjs`. It validates `public/admin/config.yml` against the new schema, offline, with ajv; fix what it refuses. `npm test` runs the same check.
7. Some tests run Sveltia's own code, taken from the vendored bundle: how uploads and entries are named, and how a field pattern is applied (`tests/helpers/sveltia-names.mjs`). They find that code by exact text in the minified file. After an upgrade the text may move. Update the anchors, then check again that the names the CMS writes fit `UPLOAD_PATH` in `scripts/lib/uploads.mjs`.
8. Run `npm test`, rebuild, run `npm run check:seo` and `npm run test:browser`, and check `/admin/` in Chrome with the local workflow.

### Upgrading wrangler or miniflare

`tests/headers.test.mjs` runs Cloudflare's own `_headers` code from `node_modules` in a `vm` context: the parser from wrangler 4.151.2 and the asset worker from miniflare 5.20261019.0-beta, through `tests/helpers/wrangler-headers.mjs`. It compares them with the copy in `scripts/lib/headers.mjs` that the export check uses. Both versions are pinned exactly in `package.json`. If an upgrade moves that code, the test fails with "… no longer has …". Then check `scripts/lib/headers.mjs` against the new code and update the helper's slices.

### Tests and the live copy

`npm test` passes after any copy edit that the content check accepts, and fails when the content is invalid, as the build does. On the live `content/` it checks only what a valid edit keeps true: the content validates, its files are in the form the CMS writes, the entry index is current, the content rules and the honesty scan pass, the legal pages parse into sections, the export names and the routes are unchanged (from `tests/fixtures/content-v1.json`), and the types match exactly (`src/lib/content-contract.ts` against `tests/fixtures/content-v1.d.ts`, in `npm run typecheck`).

Tests that change entries by file name or position use a frozen sample instead, [tests/fixtures/sample-project/content/](tests/fixtures/sample-project/content/): a copy of `content/` as it was when the CMS landed. Temporary projects copy it with a matching entry index (`copySampleContent` in `tests/helpers/content.mjs`). The sample is never refreshed; change it only together with the tests that use it.

### The migration check

`node scripts/check-migration.mjs` proves that moving the copy into `content/` changed nothing. It compares what the site loads today with the copy frozen in `tests/fixtures/`:

- every export of `src/lib/content.ts`, key order included, and the same exports built from the files in `content/` (`content-v1.json`);
- the site name, description and social profiles;
- the privacy and terms text: the headings, the paragraphs per section and the full text (`legal-v1.json`, taken from the pages' code before the text moved);
- every JSON file in `content/`, as values (`content-files-v1.json`), so content the site does not show, such as a testimonial without permission, is compared too.

The export comparisons ran in `npm test` while the copy was being moved. The full-text legal comparison and the file comparison were added when the check moved out of `npm test`; they pass on the content as migrated. The check keeps passing until the first deliberate copy edit, and after that it is expected to fail: the CMS is working, not broken. Run it when a change must leave the copy alone and no copy has been edited since the fixture was taken, for example when this branch is merged, or when the loader or the content model is refactored.

A difference reads like this. Character positions count from 1, and list positions from 0 (`FAQS[0]` is the first question):

```text
  - src/lib/content.ts export FAQS differs from the frozen copy:
    FAQS[0].answer, from character 23: "We help organizations change how work gets done: deciding where digital …" before, "We help organizations decide where digital change and AI will help, buil…" now
```

Content that does not load (a validation or legal-page error, a broken file) stops the check with the problems, as the content check prints them. `node scripts/check-migration.mjs --help` lists the options.

**Refreshing the fixture.** To take a new reference point, for example after the merge or before a refactor, run `node scripts/check-migration.mjs --refresh`. It rewrites the values in the three fixture files from the current content, says what changed, and then runs the check. It keeps the export names and the routes, which `npm test` checks; after a deliberate change to them, run `--refresh-structure` instead. It warns when `tests/fixtures/` already has uncommitted changes. Review `git diff tests/fixtures` and commit it on its own, with the reason in the message. A changed export type is a separate case: `npm run typecheck` fails on the type contract. Then edit the matching type in `tests/fixtures/content-v1.d.ts` by hand, in the same commit as the change, and add a line to `src/lib/content-contract.ts` for a new export.

### The HTML snapshot

`scripts/html-snapshot.mjs` proves that a change does not alter what the exported pages render. It runs locally, not in `npm test`.

1. From a build of the code before the change, save the snapshot and keep that build's chunks:

   ```sh
   node scripts/html-snapshot.mjs save artifacts/html-baseline
   rm -rf artifacts/dist-before && mkdir -p artifacts/dist-before/_next/static && cp -r dist/_next/static/chunks artifacts/dist-before/_next/static/
   ```

   `save` replaces the folder, so it only accepts a folder inside `artifacts/`.
2. After the change, rebuild and compare:

   ```sh
   node scripts/html-snapshot.mjs compare artifacts/html-baseline --explain-client-ids artifacts/dist-before
   ```

   The expected result is `Rendered HTML identical to artifacts/html-baseline: 15 pages.` A page that is not in the snapshot, such as `admin/index.html`, is listed as new.

How to read the result:

- **Format 3** compares two parts of each page: the HTML without the inline React Server Components payload, and the React tree resolved from that payload. It masks the build ID, the hashed chunk and media names and the runs of chunk tags, and keeps the client module ids. `compare` refuses a folder saved in an older format.
- **Changed client ids.** Turbopack's client module ids shift whenever the set of modules changes, so a page can differ in its ids only. `compare` then lists each change (export, old id and new id, line). `--explain-client-ids <saved chunks>` (the `artifacts/dist-before` folder from step 1) passes such a page only when each changed id keeps its export and its place, and its factory code is identical apart from module ids that are explained in the same way in turn.
- **`--loose-client-ids`** ignores the ids and prints a warning. Use it only for a first look: it would not notice one client component swapped for another.
- Any other difference is a real change.
- Chunk names are masked, so also compare the chunk files themselves, for example `diff -r artifacts/dist-before/_next/static/chunks dist/_next/static/chunks`, which shows a changed stylesheet.

### What the CMS costs

No formal budget is set. Measured on this repository's build:

- **Browser.** The copy and its validation ship in one shared chunk of 35.8 KB (12.0 KB gzipped). The validation added about 13.6 KB (4.8 KB gzipped) and about 6 ms of script evaluation per full page load when the loader replaced the hand-written module.
- **Worker.** The Worker bundle includes the copy and validates it when it starts. Bundled with esbuild and not minified, it is about 62 KB (17 KB gzipped), against 19 KB before the CMS. Validation takes 6 to 7 ms per cold start.
- **Export.** `/admin/` adds 5 files and 2.39 MiB, nearly all of it the Sveltia bundle, which only `/admin/` loads. The export was 161 files and 13.92 MiB on the CMS branch; merged with the Part 1 globe, which removed the GLB and the Draco decoder, it is 173 files and 10.39 MiB.
- **Build time.** The upload variant step takes about 65 ms when there are no uploads. With twenty 12-megapixel JPEGs it took 9 s the first time and about 0.15 s when nothing had changed.

If a JavaScript budget is set later, the browser could load a pre-validated data module generated at build time instead.

### Tailwind and the docs

Tailwind CSS builds the site stylesheet from class names it finds in any file that Git does not ignore. `content/`, `public/admin/` and the vendored configuration schema are excluded (in `src/app/globals.css`), but `docs/`, the tests and this README are still scanned, so a utility class name written in prose, even inside backticks, adds a rule to the site stylesheet. Do not write class names in documentation, and after editing it, rebuild and compare the stylesheet. Limiting the scan to `src/` is recommended. It is not done yet: excluding `docs/` alone removed 27 rules (old class names quoted in earlier plans), and proving that none of them is used is a separate task.

## Hero globe

The home hero renders the Earth with a custom three.js shader from texture tiers in `public/textures/earth/`: 1k for phones and tablets, 2k for the desktop first frame, and 4k streamed after the intro and an idle moment on desktops with a hardware GPU, a mouse or trackpad, 8 GB of memory (or none reported) and no slow connection. Rebuild the tiers from the preserved model with `node scripts/build-globe-textures.mjs`. It reads `assets/source/earth-4k.glb` (or `public/models/earth-4k.glb` when the local copy is absent) and rewrites `src/components/globe/texture-manifest.ts`. Look-and-feel tunables live in `src/components/globe/constants.ts` and `LOOK` in `src/components/globe/materials.ts`. After a visual change, re-capture the desktop poster with the preview running: `node scripts/capture-hero-poster.mjs http://127.0.0.1:8787` (use your preview's port).

No model, decoder or WebAssembly ships: the export check refuses any `.glb` file and anything under `draco/`, in any letter case, and the site CSP has no `'wasm-unsafe-eval'` and allows workers from the site only.

## Content and release

- [Content](content/): most of the copy, as JSON and Markdown, edited through the CMS at /admin/ (see "Editing content", which also lists the copy that is still in the code). [src/lib/content.ts](src/lib/content.ts) loads and validates it.
- [Site configuration](src/lib/site.ts) and [.env.example](.env.example): identity and publication settings.
- [Cloudflare release runbook](docs/operations/cloudflare-release.md): bindings, gates, operations and rollback.
- [Source provenance](docs/operations/source-provenance.md): preserved source and clone status.
- [Implementation record](docs/operations/implementation-status.md): evidence and remaining dependencies.

The original checkout remains intact. The supplied GitHub destination was empty when inspected; cloning and Cloudflare account access were blocked by network access in this environment. No remote push or public deployment is claimed.
