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

## Editing content

All copy lives in [content/](content/) as JSON and Markdown files. Images that editors add go to `public/uploads/`. [src/lib/content.ts](src/lib/content.ts) loads and validates those files when the site is built, so the site never fetches content at run time.

The editor at `/admin/` is [Sveltia CMS](https://sveltiacms.app/) 0.230.1. It is vendored in `public/admin/sveltia/`, so no CMS code comes from a CDN. `/admin/` is not linked from the site, is marked `noindex` and has its own Content-Security-Policy.

### Edit locally (today)

The local workflow needs Chrome or Edge on a desktop computer. It uses the File System Access API, which Firefox and Safari lack, and it only works on `localhost` or `127.0.0.1`.

1. Build and start the preview: `npm run build:cf`, then `npm run preview:cf`. Use this preview rather than `npm run dev`, because it serves `/admin/` with the same headers as production.
2. Open http://localhost:8787/admin/.
3. Choose **Work with Local Repository** and select this repository's root folder, the one that contains `.git`. In a linked Git worktree the CMS can save files but cannot commit them, so commit with Git.
4. Edit and **Save**. The CMS writes straight into `content/` and `public/uploads/`. It does not rebuild the site.
5. To see the change, rebuild (`npm run build:cf`) and restart the preview. The build regenerates the entry index and the image variants, validates every file and runs the honesty scan. If anything is wrong, the build stops and lists what to fix (see "Reading the content check").
6. Review `git diff`, run `npm test` and commit.

The CMS interface follows the browser language. Translations other than English come from unpkg.com, which the admin CSP blocks. If the CMS reports a translation error, choose English in its settings.

### What the build enforces

- No prices, invented metrics, clients, press, offices, ratings or experience claims, in any field of any content file (see "The honesty scan").
- The counts on the page (5/5, 01/03, the hero stats) match the services and engagements.
- A testimonial is shown only after its permission box is ticked. Team cards describe disciplines, not people.
- Services and engagements cannot be added or removed in the CMS, because each service has its own page and is listed in the routes.
- The site uses some values to tell items apart, so they must be unique: FAQ questions, engagement names, article slugs, the services that work tiles point at, the name and company of each testimonial, and the items of each deliverables and outcomes list. Exactly one engagement is featured.
- Every image that a field points at must exist, with exactly that name and letter case.

#### Images and uploads

- **Formats.** Upload JPEG, PNG, AVIF, WebP or GIF, up to 10 MiB. The CMS converts JPEG, PNG and AVIF to WebP (quality 85, at most 2560 × 2560 pixels). It draws the image on a canvas to do this, which drops all metadata, camera and location data included.
- **Animations.** GIF and WebP files are saved as they are, so animations keep playing. Use GIF or animated WebP for an animation: the CMS turns an animated PNG into a still image, and the build refuses an animated PNG or an AVIF image sequence added outside the CMS.
- **HEIC** (the iPhone photo format) is refused when you upload it ("Failed to decode HEIC image"), because its decoder would have to come from unpkg.com, which the admin CSP blocks. Export the photo as JPEG first.
- **Location data.** An upload must not carry location data (GPS), because uploads are published as they are. Since WebP and GIF files are saved unchanged, a WebP or GIF with GPS data keeps it, and the build refuses the file: "contains location data (GPS in its … metadata), which would be published with the image: re-export it without location data and upload it again". A file whose metadata cannot be read is refused in the same way.
- **File names.** The CMS renames uploads to lowercase ASCII letters, digits, `-` and `_`. For example, `Ảnh đẹp.JPG` becomes `anh-dep.webp` and `Banner 1280.png` becomes `banner-1280.webp`. Names are cut to 60 characters, and a name that is already taken gets `-1`, `-2` and so on. Three cases slip through:
  - `~` is kept (`scan~2.jpg` becomes `scan~2.webp`);
  - a browser set to Turkish writes the dotless `ı` for `I` (`IMG_0042.JPG` becomes `ımg_0042.webp`);
  - a Windows device name such as `con.png`, `COM1.jpg` or `nul.webp` cannot be uploaded at all: the CMS fails and saves nothing.

  The build refuses the first two and suggests a name, for example `rename it, for example to scan-2.webp`. It is simpler to rename such a file before uploading it: use lowercase letters, digits, `-` and `_` only, for example `scan-2.jpg` or `img-0042.jpg`.
- **Variants.** Every build makes a 640 px and a 1280 px wide WebP copy of each upload, except GIFs. The copies are kept in `.cache/upload-variants/` (ignored by Git), recorded by each upload's SHA-1, so an unchanged upload is not encoded again. Packaging ships them next to the upload under `/uploads/`: `photo.jpg` ships with `photo.jpg.w640.webp` and `photo.jpg.w1280.webp`. No upload name is reserved, and the build never changes or deletes anything in `public/uploads/`. `contentImage()` in [src/lib/content-images.ts](src/lib/content-images.ts) renders an upload as `photo.jpg.w1280.webp` with both copies in `srcset`, or as the original under `npm run dev`, because the copies are not in `public/`. The section components do not use it yet (a later change switches them over), so for now pages show the original upload.
- **Site images.** The images that shipped before the CMS stay in `public/images/`. Pick them under **Site images (read only)** or type their path.
- **What else is refused.** Only images may sit in `public/uploads/`: no SVG, HTML or other file, no symbolic link, junction or hard link, and on Windows no path of 250 characters or more. Dotfiles such as `.gitkeep` are ignored and never ship.

#### New entries and file names

- New entries (questions, team disciplines, testimonials, articles) get a file name made from their title or name, with the same rules as uploads. A title that starts with `_` (`_underscore start` gives `_underscore-start.json`), or that contains `~` or the dotless `ı`, gives a file name that the build refuses. `npm run content:index` names the file. Rename it to lowercase letters, digits, `-` and `_`, starting with a letter or a digit.
- If you add, rename or delete an entry file by hand, run `npm run content:index`. The build does this too.

#### Engagement stage numbers

The stage numbers of the engagements (01, 02, 03) must follow the list order. Dragging engagements into a new order does not renumber them. The content check then names each engagement and the number to set, for example `… is number 1 in the list but its stage number is "02"; … set it to "01"`. Change the stage numbers in the CMS and save.

#### Legal pages

`content/legal/privacy.md` and `content/legal/terms.md` hold the sections of the privacy and terms pages. The CMS refuses to save anything that the build would refuse:

- The page starts with a `## ` heading, and every section starts with a line `## Heading`.
- Below each heading there is at least one plain paragraph. Paragraphs are separated by blank lines.
- No lists (lines that start with `-`, `+`, `*` or a number such as `1.`), no other heading levels (`#`, `###`), no `#` inside a heading, and no lines of only `-` or `=`.
- None of the characters `*`, `_`, `` ` ``, `<`, `>`, `[`, `]`, `\`, `|` or `~~`, and no HTML entities such as `&amp;`.

Leave a blank line before each heading. The preview notice and the contact section come from the site settings, not from these files.

#### The CMS configuration

The CMS configuration is [public/admin/config.yml](public/admin/config.yml). It mirrors [src/lib/content-model.ts](src/lib/content-model.ts), and `npm test` fails when the two drift apart. The CMS reads `config.yml` from the preview, so rebuild after changing it.

### Reading the content check

Every build runs the content check, and it also runs on its own: `node --experimental-strip-types scripts/check-content.mjs`. It prints every problem in one list (`Content check failed. Fix these problems:`), each with its file, its field and what to change, and then exits with an error.

- **List positions start at 0.** `deliverables[3]` is the fourth item, and `FAQS[1].answer` is the answer to the second question on the site.
- **Fields are named by their path in the file.** `work.heading` in `content/sections.json` is the `heading` inside `work`.
- **A file or an export.** A message that starts with `content/…` names a file. A message that names an export (`FAQS`, `SERVICES` and so on) describes the content as the site loads it, in the order of the site.

#### The honesty scan

[scripts/lib/honesty.mjs](scripts/lib/honesty.mjs) refuses claims that the site cannot back up: prices and rates, the original platform's metrics and old brand, counts of clients, users or staff, scale figures, multipliers, press and partner claims, ratings, awards and certifications, office locations, founding years and years of experience, delivery timelines, and client results. It reads every string of every file under `content/`, including fields the site does not show, and every export as the site loads it. A figure split over several fields (a value with its unit and label, or a title with its text) is read as one phrase. The content check and `npm test` both run it.

A problem looks like this:

```text
forbidden claim in content/faqs/scope-and-pricing.json: answer: a price ("$4")
forbidden claim in export FAQS[1].answer: a client or scale claim ("50 companies")
```

Each message names the file or the export, the field, the kind of claim, and the text that matched, which may be only part of the claim. The same claim usually appears twice, once for the file and once for the export. Reword the copy: the CMS cannot switch a rule off.

There are two exceptions. The illustrative dashboard (`content/measure.json`) may show percentages and figures such as 12k in its figure fields. The legal pages may state periods ("within 90 days") and name the services that process data.

The scan is a safety net, not a review. Its known gaps are listed in the code: Vietnamese phrasing (the site is English-only today), look-alike letters (a Cyrillic "Ѕ") and non-ASCII digits, HTML entities such as `&#36;`, a backslash-u escape written as text, a claim split over list items, and some phrasings such as "200 loyal clients", "a team of 30" or "five stars on Google".

### Edit from GitHub (later)

Not built yet. Once the code is in the GitHub repository (`SanhVo2023/platform-design-contest`):

1. **GitHub OAuth App.** Homepage `https://spacegear.tech`, callback `https://spacegear.tech/api/auth/callback`. Store the client ID as a Worker variable `GITHUB_CLIENT_ID` and the secret with `wrangler secret put GITHUB_CLIENT_SECRET --env production`.
2. **OAuth endpoint in `worker/index.ts`**, before the `/api` 404 fallback (`assets.run_worker_first` already sends `/api/*` to the Worker). [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) implements this flow as a Cloudflare Worker and can be ported:
   - `GET /api/auth?provider=github&site_id=…&scope=repo`: create a random state, store it in an `HttpOnly; Secure; SameSite=Lax` cookie for 10 minutes and redirect to `https://github.com/login/oauth/authorize?client_id=…&scope=repo&state=…`.
   - `GET /api/auth/callback?code=…&state=…`: compare the state with the cookie, exchange the code at `https://github.com/login/oauth/access_token` (POST, `Accept: application/json`) and return a small HTML page. The page posts `authorizing:github` to `window.opener`, and when the CMS answers from `https://spacegear.tech` it replies `authorization:github:success:{"provider":"github","token":"…"}` to that origin only. Give the page its own CSP header with a hash for its inline script, because `_headers` rules do not apply to Worker responses.
3. **`public/admin/config.yml`:** add `base_url: https://spacegear.tech` and `auth_endpoint: api/auth` under `backend`. Do not set `auth_type: pkce`: Sveltia 0.230.1 itself reports that PKCE is not supported with GitHub (`github_pkce_unsupported`).
4. **Admin CSP.** The CMS then talks to GitHub, so the policy needs:
   - `connect-src`: add `https://api.github.com` (the API) and `https://www.githubstatus.com` (the status check, which is then allowed instead of blocked);
   - `img-src`: add `https://avatars.githubusercontent.com`, the host of the user avatars.

   Sign-in happens in a popup window, so `form-action` stays `'self'`. The policy is pinned exactly, so change it in all of these places in one commit:
   - `public/_headers`;
   - `ADMIN_CSP` in [scripts/lib/headers.mjs](scripts/lib/headers.mjs);
   - the `connect-src` assertions in `tests/admin.test.mjs` and `tests/headers.test.mjs`;
   - `TOLERATED` in `scripts/admin-check.mjs`: remove the GitHub status check from it.
5. **Cloudflare Workers Builds:** connect the repository and the `main` branch. Build command `npm run build:production`, with the production variables from [the release runbook](docs/operations/cloudflare-release.md); deploy command `npx wrangler deploy --env production`. Every CMS save is a commit, so it triggers a build. A content error fails the build, and the live site keeps the previous version.
6. **Optional:** protect `/admin/*` with Cloudflare Access. The CMS cannot write without a GitHub login, but Access also hides the page.

## Maintaining the CMS

### The admin Content-Security-Policy

| Directive | Value | Why |
|---|---|---|
| `script-src` | `'self'` | The vendored bundle and the chunk it loads next to itself. Sveltia needs no `unsafe-eval` or `unsafe-inline`. |
| `style-src` | `'self' 'unsafe-inline'` | Sveltia adds its styles at run time. |
| `font-src` | `'self' https://cdn.jsdelivr.net/fontsource/fonts/material-symbols-outlined:vf@5.3.8/latin-wght-normal.woff2 https://cdn.jsdelivr.net/fontsource/fonts/noto-mono@5.3.0/latin-400-normal.woff2 https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3:vf@5.3.0/latin-wght-normal.woff2` | The bundle's `@font-face` rules load its interface and icon fonts from these three files and no others. A source with a path and no trailing slash allows exactly that file. Without them, the icons show as words. |
| `img-src` | `'self' data: blob:` | Previews of new uploads, and inline icons. |
| `connect-src` | `'self' blob: data:` | The configuration and local files. |
| `media-src`, `frame-src`, `manifest-src` | `'self' blob:`, `blob:`, `'self' blob:` | As in Sveltia's CSP guide. |
| `default-src`, `object-src`, `base-uri`, `form-action`, `frame-ancestors` | `'self'`, `'none'`, `'self'`, `'self'`, `'none'` | Hardening, as on the site. |

Two optional requests are blocked on purpose, and both fail quietly:

- the update check, `https://unpkg.com/@sveltia/cms/package.json`;
- the GitHub status check, `https://www.githubstatus.com/api/v2/status.json`, which Sveltia makes on the sign-in screen because the backend is GitHub. Version 0.230.1 has no setting to turn it off.

DevTools shows them as CSP errors. `npm run test:browser` accepts exactly these two and fails on any other blocked request.

Sources: [Sveltia's CSP guide](https://sveltiacms.app/en/docs/security#setting-up-content-security-policy) and the bundle itself (font URLs, update check, chunk loading). The site's own CSP is unchanged: `public/_headers` removes it for `/admin/*` only. The admin policy is pinned twice, in `public/_headers` and as `ADMIN_CSP` in [scripts/lib/headers.mjs](scripts/lib/headers.mjs). `npm test` and the export check in the build fail when the two differ, or when `/admin/` would get any other `Content-Security-Policy`, `X-Robots-Tag`, `X-Content-Type-Options` or `X-Frame-Options`.

### Uploads are sandboxed

`public/_headers` also has a `/uploads/*` rule. It replaces the site CSP with `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox` and sends `X-Content-Type-Options: nosniff` once.

- An image on a page is not affected. An `<img>` element ignores the headers of the image it loads, and the page's own CSP allows images from the site.
- Opened on its own (through a link or a typed address), an upload is a sandboxed document. It runs no script, loads nothing but images from the site, and is never read as any type other than its own. That also covers a file that only looks like an image, such as an HTML file disguised as a PNG.
- A missing upload's 404 page is shown unstyled, under the same rule.
- The export check (`UPLOADS_CSP` in `scripts/lib/headers.mjs`) and `npm run test:browser` both enforce the rule.

### Upgrading Sveltia

1. Pick a release that is at least 14 days old: this repository pins dependencies only after that.
2. In `SVELTIA` in `scripts/vendor-sveltia.mjs`, set `version`, `tarball` and `integrity` from `npm view @sveltia/cms@<version> dist.tarball dist.integrity`, and empty `files`.
3. Run `npm run cms:vendor`. It downloads the tarball, checks its integrity, extracts the files into `public/admin/sveltia/` and writes their hashes to `scripts/sveltia-cms.lock.json`. Review what it extracted.
4. Copy the hashes from the lock into `SVELTIA.files`, which is the second pin. Then `npm run cms:vendor -- --check` must print `Vendored @sveltia/cms@<version> matches scripts/sveltia-cms.lock.json and the pinned hashes.`
5. Fonts and CSP. If the new bundle names other font files, `npm test` lists them. Put them in `ADMIN_FONTS` in `scripts/lib/headers.mjs` and in `font-src` in `public/_headers`, whose admin policy must stay exactly `ADMIN_CSP`. `npm test` also runs the changed file through Cloudflare's own `_headers` code (see "Upgrading wrangler or miniflare"). Read the release notes for new requests: the browser check fails on any blocked request other than the two above.
6. Validate `public/admin/config.yml` against the new release's own schema, `schema/sveltia-cms.json` in the npm tarball (draft-07, for example with ajv), and fix what it refuses.
7. Some tests run Sveltia's own code, taken from the vendored bundle: how uploads and entries are named, and how a field pattern is applied (`tests/helpers/sveltia-names.mjs`). They find that code by exact text in the minified file. After an upgrade the text may move. Update the anchors, then check again that the names the CMS writes fit `UPLOAD_PATH` in `scripts/lib/uploads.mjs`.
8. Run `npm test`, rebuild, run `npm run check:seo` and `npm run test:browser`, and check `/admin/` in Chrome with the local workflow.

### Upgrading wrangler or miniflare

`tests/headers.test.mjs` runs Cloudflare's own `_headers` code from `node_modules` in a `vm` context: the parser from wrangler 4.151.2 and the asset worker from miniflare 5.20261019.0-beta, through `tests/helpers/wrangler-headers.mjs`. It compares them with the copy in `scripts/lib/headers.mjs` that the export check uses. Both versions are pinned exactly in `package.json`. If an upgrade moves that code, the test fails with "… no longer has …". Then check `scripts/lib/headers.mjs` against the new code and update the helper's slices.

### The migration check

`node scripts/check-migration.mjs` proves that moving the copy into `content/` changed nothing. It compares what the site loads today with the copy frozen before the CMS:

- every export of `src/lib/content.ts`, key order included, and the same exports built from the files in `content/` (`tests/fixtures/content-v1.json`);
- the site name, description and social profiles;
- the privacy and terms text: the headings, the paragraphs per section and the full text (`tests/fixtures/legal-v1.json`, taken from the pages before the text moved).

The same comparisons ran in `npm test` while the copy was being moved, and the check keeps passing until the first deliberate copy edit. After that it is expected to fail: the CMS is working, not broken. Run it when a change must leave the copy alone and no copy has been edited since the fixture was taken, for example when this branch is merged, or when the loader or the content model is refactored. A difference reads like this:

```text
  - src/lib/content.ts export FAQS differs from the frozen copy:
    FAQS[0].answer, from character 23: "We help organizations change how work gets done: deciding where digital …" before, "We help organizations decide where digital change and AI will help, buil…" now
```

`npm test` does not run it. `npm test` keeps what a copy edit cannot break: the export names and the routes (from `content-v1.json`), the exact type contract (`src/lib/content-contract.ts` against `tests/fixtures/content-v1.d.ts`, in `npm run typecheck`), the schema and uniqueness rules, the honesty scan, the index check and the structural checks of the legal pages.

**Refreshing the fixture.** To take a new reference point, for example after the merge or before a refactor, run `node scripts/check-migration.mjs --refresh`. It rewrites `tests/fixtures/content-v1.json` (values, export names, site identity and routes) and `tests/fixtures/legal-v1.json` from the current content, then runs the check. Review `git diff tests/fixtures` and commit it on its own, with the reason in the message. A changed export type is a separate case: `npm run typecheck` fails on the type contract. Then edit the matching type in `tests/fixtures/content-v1.d.ts` by hand, in the same commit as the change, and add a line to `src/lib/content-contract.ts` for a new export.

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
- **Export.** `/admin/` adds 5 files and 2.39 MiB, nearly all of it the Sveltia bundle, which only `/admin/` loads. The export is 161 files and 13.92 MiB.
- **Build time.** The upload variant step takes about 65 ms when there are no uploads. With twenty 12-megapixel JPEGs it took 9 s the first time and about 0.15 s when nothing had changed.

If a JavaScript budget is set later, the browser could load a pre-validated data module generated at build time instead.

### Tailwind and the docs

Tailwind CSS builds the site stylesheet from class names it finds in any file that Git does not ignore. `content/` and `public/admin/` are excluded (in `src/app/globals.css`), but `docs/` and this README are still scanned. A utility class name written in prose, even inside backticks, adds a rule to the site stylesheet. Do not write class names in documentation, and after editing it, rebuild and compare the stylesheet. A later change on the main branch will limit the scan to `src/`.

## Content and release

- [Content](content/): all copy as JSON and Markdown, edited through the CMS at /admin/ (see "Editing content"). [src/lib/content.ts](src/lib/content.ts) loads and validates it.
- [Site configuration](src/lib/site.ts) and [.env.example](.env.example): identity and publication settings.
- [Cloudflare release runbook](docs/operations/cloudflare-release.md): bindings, gates, operations and rollback.
- [Source provenance](docs/operations/source-provenance.md): preserved source and clone status.
- [Implementation record](docs/operations/implementation-status.md): evidence and remaining dependencies.

The original checkout remains intact. The supplied GitHub destination was empty when inspected; cloning and Cloudflare account access were blocked by network access in this environment. No remote push or public deployment is claimed.
