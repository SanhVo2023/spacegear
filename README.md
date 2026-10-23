# spacegear.tech

Digital transformation and AI consultancy website, in English and Vietnamese. Next.js exports 24 visible HTML pages, 12 in each language; Cloudflare Workers Static Assets serves them. A same-origin Worker sends first-time visitors from Vietnam to the Vietnamese pages, validates inquiries with Turnstile, stores them in D1 and queues owner notifications through Cloudflare Email Service.

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
npm run check:locale -- http://127.0.0.1:8787
npm run test:browser
npm run check:fidelity
```

The last four expect the local Cloudflare server. Install the pinned browser with `npx playwright install chromium`, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to a compatible Chromium executable. The SEO and browser commands also accept a URL (the SEO command also --production); `check:locale` needs one. It covers the Vietnamese pages and the language routing, and `test:browser` runs it too (see "Checks for the Vietnamese pages").

`check:fidelity` compares every home section with the original platform-clone build. Serve it with `npx next start -p 3101 -H 127.0.0.1` from that folder, alongside the local Cloudflare preview. The check writes side-by-side sheets to `artifacts/fidelity/`. A person reviews those sheets before release; the height check alone is not sign-off.

Tests cover durable capture, same-key races against local D1, transactional rollback, throttling, notification retries, publication guards, canonical routes, no-JavaScript content, reduced motion, responsive layout, keyboard navigation and the actual form's recovery behavior. Browser timings are local observations, not Lighthouse scores or field measurements.

## Editing content

Most of the site's copy is kept in [content/](content/) (English) and [content/vi/](content/vi/) (Vietnamese, the same files with the same names), as JSON and Markdown files that the editor at `/admin/` changes for you:

- the home page: the hero, the section headings and the copy of every home section, including the illustrative dashboard, the questions and answers, the team, the testimonials and the footer;
- the five services, which also fill each service page's introduction, title and description;
- the three engagements;
- the site name, description and social profiles, and the owner's address and phone number;
- the text sections of the privacy and terms pages.

Some copy still lives in the code, in the UI dictionary (`src/lib/i18n/en.ts` and `vi.ts`), and changing it needs a developer: the introductions of the About, Approach, Services and Contact pages, the fixed headings on the service pages (such as "What you receive"), the navigation labels, a few labels inside the home sections (such as the footer's "Discuss a project" link), the headers and notices of the privacy and terms pages, the form labels and messages, the 404 page, and the title and description of every page except the service pages (see "Languages").

Images that editors add go to `public/uploads/`. The site reads all of these files when it is built, so nothing is fetched while a visitor reads a page.

The editor is [Sveltia CMS](https://sveltiacms.app/) 0.230.1. A copy of it is kept in this repository (`public/admin/sveltia/`), so none of its code comes from another site; only its interface fonts load from jsDelivr, and on the live site it reads and saves through GitHub's API. `/admin/` is not linked from the site and is hidden from search engines.

There are two ways to edit: on the live site, signed in with GitHub, or on your own computer. Either way, every entry has an English side and a Vietnamese side (see "Editing in two languages").

### Edit on the live site

You need a GitHub account with write access to the repository [SanhVo2023/spacegear](https://github.com/SanhVo2023/spacegear), and a desktop browser.

1. Open https://spacegear.tech/admin/ and choose **Sign In with GitHub**. A small GitHub window opens. The first time, GitHub asks you to authorize "spacegear CMS"; the window then closes by itself.
2. Edit and **Save**. Each save is a commit to the `main` branch, made in your name.
3. The commit starts a build in Cloudflare Workers Builds. The build checks every file (see "What the build checks"), then builds and deploys the site; the change is live when that build finishes. If the check fails, the build stops and the live site keeps the previous version. The build log in the Cloudflare dashboard lists what to fix (see "Reading the content check"): fix it in the editor and save again.

Who can save: only GitHub accounts with write (push) access to the repository. Anyone can reach the sign-in button, but the CMS tells an account without that access that it has no access to the repository, and GitHub refuses its commits.

A sign-in lasts about 8 hours, because the GitHub tokens of this sign-in expire. After that, the CMS asks you to sign in again when it next loads, and a save made with the expired sign-in fails; sign in again before you save. **Sign Out** in the account menu removes the sign-in from this browser.

How it works and how it is set up: see "Editing from GitHub".

### Edit locally

You need Chrome or Edge on a desktop computer. The editor saves into a folder on your computer through a browser feature that Firefox and Safari lack, and it only works on `localhost` or `127.0.0.1`.

1. Build and start the preview: `npm run build:cf`, then `npm run preview:cf`. Use this preview rather than `npm run dev`, because it serves `/admin/` with the same security settings as the live site.
2. Open http://localhost:8787/admin/ (the `preview:cf` port; use your preview's port if you started it on another).
3. Choose **Work with Local Repository** and select this repository's root folder, the one that contains `.git`. The CMS saves files into the folder but never commits (Sveltia 0.230.1's local workflow has no Git support), so commit with Git.
4. Edit and **Save**. The CMS writes straight into `content/` and `public/uploads/`. It does not rebuild the site.
5. To see the change, rebuild (`npm run build:cf`) and restart the preview. The build checks every file (see "What the build checks"). If anything is wrong, it stops and lists what to fix (see "Reading the content check").
6. Review `git diff`, run `npm test` and commit. A copy edit that the build accepts also passes `npm test`.

The editor's own menus follow the browser language. Translations other than English would come from another site, which the editor's security settings block. If the editor reports a translation error, choose English in its settings.

On `localhost` the editor also offers **Sign In with GitHub**, but GitHub sign-in works only on https://spacegear.tech: use **Work with Local Repository** here.

### Editing in two languages

- **Two sides.** Every entry shows English on the left and Vietnamese on the right. A save writes the English file under `content/` and its Vietnamese twin under `content/vi/`, with the same name: `content/home.json` and `content/vi/home.json`, `content/faqs/…` and `content/vi/faqs/…`. Write both sides before you save.
- **Copied from English.** Links, images, numbers, switches, slugs, stage numbers, the phone number and the order are the same in both languages. They are edited on the English side; the Vietnamese side shows them read-only, and the CMS copies them over. Dragging entries into a new order therefore reorders both languages. This has not been tried in a live CMS session yet: after the first drag, check that the Vietnamese files changed too.
- **The same on both sides.** A text that holds no letter, such as a hero figure (`05`), a percentage of the sample dashboard (`62%`) or a badge (`5/5`), must read the same in Vietnamese as in English, even where the CMS lets you type it on the Vietnamese side. If a Vietnamese value ever differs where it must not, the build names the file and the field.
- **What the build refuses** in Vietnamese: a missing file, entry or field; a value that must stay as in English but differs, such as a figure of the sample dashboard or a link; a legal page with a different number of sections than its English twin; and everything it refuses in English, with Vietnamese words where a rule looks for words (the sample dashboard must say "minh họa" and "không phải kết quả của khách hàng"). See "What the build checks".
- **Contact details.** The owner's address and phone number live only in Site identity (`content/site.json` and `content/vi/site.json`). The address is written in each language: the full line that the site shows, and the street and the city for the structured data. The phone number is written once, in international format without spaces, and copied to Vietnamese; the site shows `0386 749 799` on Vietnamese pages and `+84 386 749 799` on English ones. The honesty scan refuses the address and the number anywhere else.
- **Writing Vietnamese.** Write natural Vietnamese, in full sentences with a subject and a predicate. Say a claim the way Vietnamese people say it instead of translating it word for word, and keep the facts exactly as in English, with nothing added. Body text writes thousands with a dot and decimals with a comma (`3.000`, `1,5`); the figures of the sample dashboard stay exactly as in English. The terms, the forms of address and worked examples are in [docs/i18n/glossary-vi.md](docs/i18n/glossary-vi.md).

### What the build checks

- No prices, invented metrics, clients, press, offices, ratings or experience claims, in any field of any content file, in either language (see "The honesty scan").
- The owner's address and phone number appear only in Site identity.
- `content/vi/` mirrors `content/`: the same files and entries, the same fields and list lengths. Only text may differ. Text that holds no letter in English (a figure, a count, a symbol) or follows a pattern stays exactly as in English, and so do links, images, colours, slugs, numbers, switches and choices (`src/lib/content-parity.ts`). Every rule below applies to the Vietnamese copy too.
- The counts on the page match the data: the "5/5" badges and the first hero figure count the services, and the "01/03" badge and the second hero figure count the engagements. The second hero figure's line names the engagements in list order.
- The team cards describe disciplines, not people. A card name of two to four words is refused when it reads like a person's name: it starts with a title such as "Dr", or every word is a capitalised name word ("Ada Lovelace", "J. Smith", "Nguyễn Văn An", "Ludwig van Beethoven") and none of them is a discipline word such as "Engineering", "Design" or "Data". So "Data Engineering", "Product Design" and "Applied AI" pass. If a real discipline is refused, write it in sentence case ("Brand storytelling") or with "&" ("Brand & Story"); a developer can also add the word to `DISCIPLINE_WORDS` in `scripts/lib/content-rules.mjs`. A real person goes in the founder card. Team cards may not use the original site's stock portraits (`/images/team/`), and testimonials may not use its stock reviews (`/images/reviews/`).
- The sample dashboard stays labelled: its section description must say "illustrative" and "not client results", and each of its cards must call itself illustrative, an example or a sample. In Vietnamese the description says "minh họa" and "không phải kết quả của khách hàng", and each card "minh họa", "ví dụ" or "mẫu".
- A testimonial is shown only after its permission box is ticked.
- Every link points at a page of the site (such as `/contact/`), optionally with a section or a query after it (`/#faq`, `/about/#team`, `/contact/?service=applied-ai`), or at a full `https://` address.
- Services and engagements cannot be added or removed in the CMS: each service has its own page, and the engagements are the three stages the page counts.
- The site uses some values to tell items apart, so they must be unique: questions, engagement names, the services that the work tiles point at, the name and company of each testimonial, and the items of each deliverables and outcomes list. Exactly one engagement is featured.
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

- New entries get a file name made from one of their fields, with the same rules as uploads: a question from its question, a team discipline from its name, and a testimonial from its company and name. A name that starts with `_` (`_underscore start` gives `_underscore-start.json`), or that contains `~` or the dotless `ı`, gives a file name that the build refuses. `npm run content:index` names the file; rename it to lowercase letters, digits, `-` and `_`, starting with a letter or a digit.
- If you add, rename or delete an entry file by hand, run `npm run content:index`. The build does this too.

#### Engagement stage numbers

The stage numbers of the engagements (01, 02, 03) must follow the list order. Dragging engagements into a new order does not renumber them. The content check then names each engagement and the number to set, for example `… is number 1 in the list but its stage number is "02"; … set it to "01"`. Change the stage numbers in the CMS and save.

#### Legal pages

`content/legal/privacy.md` and `content/legal/terms.md` hold the sections of the privacy and terms pages, and `content/vi/legal/` holds their Vietnamese versions, with the same number of sections. The CMS refuses to save anything that the build would refuse:

- The page starts with a `## ` heading, and every section starts with a line `## Heading`.
- Below each heading there is at least one plain paragraph. Paragraphs are separated by blank lines.
- No lists (lines that start with `-`, `+`, `*` or a number such as `1.`), no other heading levels (`#`, `###`), no `#` inside a heading, and no lines of only `-` or `=`.
- None of the characters `*`, `_`, `` ` ``, `<`, `>`, `[`, `]`, `\`, `|` or `~~`, and no codes such as `&amp;`.

Leave a blank line before each heading. The preview notice and the contact section come from the site settings, not from these files; the contact section also gives the owner's address and phone number from Site identity.

### Reading the content check

Every build runs the content check, and it also runs on its own: `node --experimental-strip-types scripts/check-content.mjs`. It prints every problem in one list (`Content check failed. Fix these problems:`), each with its file, its field and what to change, and then exits with an error.

- **Counting.** List positions start at 0: `deliverables[3]` is the fourth item, and `FAQS[1]` is the second question on the site. Line numbers in the legal pages start at 1.
- **Fields are named by their path in the file.** `work.heading` in `content/sections.json` is the `heading` inside `work`.
- **A file, or the copy as the site loads it.** A message that starts with `content/…` names a file. A message that says `export` names the copy as the site loads it, by its name in the code, such as `FAQS` (the questions) or `SERVICES` (the services), in the order of the site.

#### The honesty scan

[scripts/lib/honesty.mjs](scripts/lib/honesty.mjs) refuses claims that the site cannot back up: prices and rates, the original platform's metrics and old brand, counts of clients, users or staff, scale figures, multipliers, press and partner claims, ratings, awards and certifications, office locations, founding years and years of experience, delivery timelines, and client results. It reads every text of every file under `content/` (and so `content/vi/`), including fields the site does not show, and the copy as the site loads it in both languages; `npm test` also scans the UI dictionary. A figure split over several fields (a value with its unit and label, or a title with its text) is read as one phrase. The content check and `npm test` both run it.

Vietnamese has its own patterns for every one of these families, such as "15 triệu", "200.000đ", "hơn 50 khách hàng", "10 năm kinh nghiệm", "đối tác chính thức", "bàn giao trong 2 tuần" or "tăng 40%". Words are bounded by letters of any script, not only ASCII ones: "đồng" counts as money only after a number ("5.000.000 đồng", but not "hợp đồng" or "đồng ý"), and a Vietnamese word right after a number ("62 Xử lý") is not read as a unit such as "62x". A date ("tháng 10 năm 2026") is not a number of years. `tests/honesty-vi.test.mjs` plants a claim of each family and checks that the scan refuses it.

A problem looks like this:

```text
forbidden claim in content/faqs/scope-and-pricing.json: answer: a price ("$4")
forbidden claim in export FAQS[1].answer: a client or scale claim ("50 companies")
```

Each message names the file, or the copy as the site loads it, then the field, the kind of claim, and the text that matched, which may be only part of the claim. The same claim usually appears twice. Reword the copy: the CMS cannot switch a rule off.

A problem in a Vietnamese file names it (`content/vi/…`), and one in the Vietnamese copy as the site loads it starts with `forbidden claim in Vietnamese export`.

There are three exceptions. The illustrative dashboard (`content/measure.json` and `content/vi/measure.json`) may show percentages and figures such as 12k in its figure fields. The legal pages, in both languages, may state periods ("within 90 days", "tối đa 90 ngày") and name the services that process data. The owner's address and phone number may appear in Site identity's address and telephone fields, and nowhere else.

The scan is a safety net, not a review. Its known gaps are listed in the code: look-alike letters (a Cyrillic "Ѕ") and digits from other scripts, codes such as `&#36;`, a backslash-u escape written as text, a claim split over list items, and phrasings that its patterns do not list, in either language, such as "200 loyal clients", "a team of 30" or "five stars on Google".

## Languages

English keeps today's URLs. Vietnamese mirrors every page under `/vi/` with the same slugs: `/about/` and `/vi/about/`, `/services/applied-ai/` and `/vi/services/applied-ai/`.

### How the pages are built

- **One component tree.** Server components take a `locale` prop; client components call `useLocale()` (`src/components/LocaleProvider.tsx`), so their English markup did not change. Copy comes from `getContent(locale)` (`content/` or `content/vi/`, see `src/lib/content.ts`) and UI strings from `dictionary(locale)` (`src/lib/i18n/`). Content links stay English site paths such as `/contact/`; `localizedHref()` (`src/lib/i18n/locales.ts`) gives them the `/vi` prefix on Vietnamese pages.
- **Views.** Every page body is a view in `src/views/`, a server component that takes the language, and its title and description are in `src/views/metadata.ts`. The route files are thin wrappers that pass the language: `src/app/(en)/…` for English and `src/app/(vi)/vi/…` for Vietnamese. Each group has its own root layout, so every exported page has the right `<html lang>`. Moving between the two root layouts is a full page load, so the curtain transition plays only within a language.
- **A new UI string** goes into `src/lib/i18n/en.ts` and `src/lib/i18n/vi.ts` under the same key. `npm run typecheck` fails when a key is missing or extra in Vietnamese, and `tests/i18n-dictionary.test.mjs` checks lists, placeholders and the honesty scan. `format()` and `formatParts()` fill placeholders such as `{n}`.
- **One 404 for both languages.** `src/app/global-not-found.tsx` (`experimental.globalNotFound` in `next.config.ts`, since the site has two root layouts) serves every unknown URL in either language, in English first, then in Vietnamese.
- **Search engines.** Every page has its own canonical URL and hreflang links to both versions (`en`, `vi`, and `x-default` for English); `og:locale` names the page's language and `og:locale:alternate` the other. The sitemap lists all 24 pages with their language versions. In the structured data, the Organization is "spacegear" (alternate name "spacegear.tech") with the owner's address and phone number, and every page names its language (`inLanguage`).

### The region redirect and the switch

`worker/locale.ts` runs for HTML navigations only. `assets.run_worker_first` in `wrangler.jsonc` sends every path to the Worker first except `/_next/`, `/images/`, `/textures/`, `/uploads/`, `/admin/`, `/vi/` and any path with a dot (every file). `/api/*` reaches the Worker as before. The rules:

- **First visit.** A visitor without the `sg_lang` cookie who opens an English page from Vietnam (`request.cf.country` is `VN`), or whose browser lists Vietnamese first in Accept-Language (`vi` or `vi-VN`; later entries do not count), gets a 302 to the page's `/vi/` twin, with the query kept. The Worker redirects only when the twin exists. The redirect carries `Cache-Control: no-store` and `Vary: Cookie, Accept-Language`, because `public/_headers` does not reach responses that the Worker makes.
- **Everyone else** gets the page as asked. Crawlers are not special: Googlebot from outside Vietnam sees English and finds `/vi/` through hreflang and the sitemap. A `/vi/` URL never reaches the Worker, so it is never moved.
- **The switch.** EN and VI sit in the desktop nav and in the phone menu. They are plain links, so they work without JavaScript: each links the English path with `?lang=en` or `?lang=vi` (`switchHref()`), because `/vi/` paths never reach the Worker. The Worker stores the choice in the `sg_lang` cookie (one year, `Path=/`, `SameSite=Lax`, and `Secure` everywhere but a plain-http loopback preview) and sends a 302 to the clean page in that language: its twin, or the language's home page when it has none. Other query parameters are kept. Once the cookie is set, the region rule never applies again.

**Testing the redirect locally.** `wrangler dev --local` takes `request.cf` from `node_modules/.mf/cf.json`, a copy that it caches from Cloudflare, and on the owner's machine that copy says `VN`. Without care, every English check against the preview would land on `/vi/`. So the top-level `vars` in `wrangler.jsonc` set `LOCALE_TEST_HEADER` to `"true"` (`env.production` sets it to `"false"`): with that value and a `localhost` or `127.0.0.1` `SITE_ORIGIN`, the Worker ignores `request.cf` and reads the country only from the `x-sg-test-country` header. Production never reads the header. Node's `fetch` sends `accept-language: *` and Playwright sends `en-US`, so the English checks stay in English. To try it:

```sh
curl -I -H "x-sg-test-country: VN" http://127.0.0.1:8787/about/
curl -I -H "accept-language: vi-VN,vi;q=0.9" http://127.0.0.1:8787/about/
curl -I -H "x-sg-test-country: VN" -H "cookie: sg_lang=en" http://127.0.0.1:8787/about/
curl -I "http://127.0.0.1:8787/about/?lang=vi"
```

The first two answer `302` with `Location: /vi/about/`, the third `200`, and the last `302` with `Set-Cookie: sg_lang=vi`. Use your preview's port.

### Fonts

Inter and JetBrains Mono each ship as two files: Google Fonts' latin subset and its vietnamese subset, of the same versions and metrics (OFL 1.1, `public/licenses/fonts.txt`). `src/app/fonts/fonts.ts` gives both files one family name, and the Vietnamese face carries Google's `unicode-range`, so a browser downloads it only for a page that shows Vietnamese letters: English pages never fetch it, and only the latin Inter is preloaded. The Vietnamese files add 10.3 KB (Inter) and 7.5 KB (JetBrains Mono). Because of the custom family name, next/font cannot build the metric-adjusted fallback faces or the CSS variables, so `src/app/fonts/fonts.css` declares them with the values next/font computed for these files. `tests/fonts.test.mjs` checks the pinned files, the families and ranges, the fallbacks and the font licence.

### Vietnamese-only styles

Vietnamese words stack marks above and below letters, so three rules in `src/app/globals.css` apply only to Vietnamese pages (`:lang(vi)`). English is unchanged.

- **Display titles** get a line height of 1.15 instead of 0.92. At 0.92 a descender ran into the marks of the line below ("g" over "ẫ", so "lẫn" read as "lẩn"). 1.15 is the least leading that keeps every mark clear on every Vietnamese page from 320 to 1440 px.
- **The hero headline** runs to six lines in Vietnamese at 1440 px (four in English), so its size follows the screen's height as well as its width: between 38 and 80 px (`clamp(38px, min(6vw, 9vh), 80px)`), with a line height of 1.05. The pinned hero's copy then fits under the nav from 1024 × 768 up, as the English copy does. **The owner has yet to confirm this size.**
- **The "Start here" badge** of the Engagements rows sits under the short name in the desktop image tile, where the longer Vietnamese badge would run into the name.

### Checks for the Vietnamese pages

- **`npm run check:locale -- <base URL>`** (`scripts/locale-checks.mjs`, 17 checks) runs against the preview and reads the routes from its sitemap. On every `/vi/` page at 320, 390, 768, 1024 and 1440 px it checks that no stacked mark is cut by a mask or a clipping box and that no mark runs into the line above or below it; that nothing overflows; that the hero headline keeps clear of the pitch and fits the screen; that the cursor's labels (Xem, Kéo, Mở) fit the orange disc; that no English string or sentence shows on a Vietnamese page, with and without JavaScript; and that Vietnamese pages link only to Vietnamese pages. It also checks the fonts (English pages never download the Vietnamese subsets, and every Vietnamese letter is drawn by the site's own fonts), the switch (by keyboard, with and without JavaScript, and in the phone menu) and the redirect (the country, the browser language, the cookie, and `/vi/` never moved).
- **`npm run test:browser`** runs the same checks and adds four Vietnamese profiles (desktop, phone at 390 px, reduced motion and no JavaScript) on `/vi/`, `/vi/contact/` and `/vi/services/applied-ai/`: clean hydration, layout shift under 0.05, the headline in its word masks, and accessible names that hold the visible text. Its hidden-text sweeps cover every `/vi/` page, and the identity check expects the logo link to be named "Trang chủ spacegear" there.
- **`FX_LOCALE=vi node --experimental-strip-types scripts/fx-checks.mjs <base URL>`** runs the motion checks on the Vietnamese pages with the Vietnamese copy and UI strings. `test:browser` runs only the English set.
- **`npm run check:seo`** crawls both languages: hreflang both ways, canonicals, one H1 and visible content without JavaScript.
- **`npm test`** covers the language rules without a browser: the Worker's decisions (`tests/worker-locale.test.mjs`), the path rules, the dictionary, the content parity, the fonts, the phone formats, the routes and the Vietnamese honesty patterns.

## Maintaining the CMS

### The CMS configuration

The CMS configuration is [public/admin/config.yml](public/admin/config.yml). It mirrors [src/lib/content-model.ts](src/lib/content-model.ts), and `npm test` fails when the two drift apart. `npm test` also validates it against the vendored release's own schema (`node scripts/check-sveltia-config.mjs`; see "Upgrading Sveltia"). The CMS reads `config.yml` from the preview, so rebuild after changing it. The rules that the schemas cannot express, such as the counts and the illustrative labels, are in [scripts/lib/content-rules.mjs](scripts/lib/content-rules.mjs), which the content check runs (so `npm run build:production` enforces them too).

Both languages are set up in its `i18n` block: locales `en` and `vi`, English the default, and every file and folder path written with `{{locale}}` (such as `content/{{locale}}/home.json`). With `omit_default_locale_from_file_path`, Sveltia 0.230.1 drops `{{locale}}/` from the English path, so English stays in `content/` and Vietnamese goes to `content/vi/`. Every field sets `i18n` itself: `true` (translated) or `duplicate` (copied from English, read-only in Vietnamese). `tests/cms-config.test.mjs` checks every field, and the content check refuses a Vietnamese file that differs from English in anything but its text.

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
| `img-src` | `'self' data: blob: https://avatars.githubusercontent.com` | Previews of new uploads, inline icons, and the signed-in editor's GitHub avatar. |
| `connect-src` | `'self' blob: data: https://api.github.com https://www.githubstatus.com` | The configuration and local files; GitHub's REST and GraphQL API, which also serves the files' contents; GitHub's status, which Sveltia checks on the sign-in screen. |
| `media-src`, `frame-src`, `manifest-src` | `'self' blob:`, `blob:`, `'self' blob:` | As in Sveltia's CSP guide. |
| `default-src`, `object-src`, `base-uri`, `form-action`, `frame-ancestors` | `'self'`, `'none'`, `'self'`, `'self'`, `'none'` | Hardening, the same values as the site's own policy. `/admin/` also keeps the site's `X-Frame-Options: DENY` header, for browsers that ignore `frame-ancestors`. |

The GitHub sources are exactly what the vendored bundle's GitHub backend uses. Its API root is `https://api.github.com` (REST, and GraphQL at `/graphql`), and it reads file contents through the API as blobs (`/repos/…/git/blobs/…`), so it needs neither `raw.githubusercontent.com` nor `uploads.github.com`; an upload is saved as part of the commit, through the API. The avatar address comes from GitHub's `GET /user` answer, on `avatars.githubusercontent.com`. Sign-in happens in a popup window (see "Editing from GitHub"), so `form-action` stays `'self'` and nothing is framed. `npm test` checks these sources against the bundle's own text.

One optional request is blocked on purpose and fails quietly: the update check, `https://unpkg.com/@sveltia/cms/package.json`. DevTools shows it as a CSP error. `npm run test:browser` accepts exactly this one and fails on any other blocked request. It also checks that the GitHub status check is allowed (answered from a fixture), and that the local workflow calls nothing else on GitHub.

Sources: [Sveltia's CSP guide](https://sveltiacms.app/en/docs/security#setting-up-content-security-policy) and the bundle itself (font URLs, update check, chunk loading, GitHub API root and status check). The CMS leaves the site's own CSP alone: `public/_headers` removes it for `/admin/*` only. The admin policy is pinned twice, in `public/_headers` and as `ADMIN_CSP` in [scripts/lib/headers.mjs](scripts/lib/headers.mjs). `npm test` and the export check in the build fail when the two differ, or when `/admin/` would get any other `Content-Security-Policy`, `X-Robots-Tag`, `X-Content-Type-Options` or `X-Frame-Options`.

### Uploads are sandboxed

`public/_headers` also has a `/uploads/*` rule. It replaces the site CSP with `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox` and sends `X-Content-Type-Options: nosniff` once.

- An image on a page is not affected. An `<img>` element ignores the headers of the image it loads, and the page's own CSP allows images from the site.
- Opened on its own (through a link or a typed address), an upload is a sandboxed document. It runs no script, loads nothing but images from the site, and is never read as any type other than its own. That also covers a file that only looks like an image, such as an HTML file disguised as a PNG.
- A missing upload's 404 page is shown unstyled, under the same rule.
- The export check (`UPLOADS_CSP` in `scripts/lib/headers.mjs`) and `npm run test:browser` both enforce the rule.

### Editing from GitHub

Editors sign in on https://spacegear.tech/admin/ with GitHub (see "Edit on the live site"). The pieces:

- **The CMS** ([public/admin/config.yml](public/admin/config.yml)): backend `github`, repository `SanhVo2023/spacegear`, branch `main`, `base_url: https://spacegear.tech` and `auth_endpoint: api/auth`, so the CMS opens `https://spacegear.tech/api/auth` in a popup. There is no `auth_type: pkce`: Sveltia 0.230.1 reports that PKCE is not supported with GitHub (`github_pkce_unsupported`).
- **The sign-in endpoints** ([worker/github-auth.ts](worker/github-auth.ts), a port of [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth)'s flow into this site's Worker; `assets.run_worker_first` sends `/api/*` to it):
  - `GET /api/auth?provider=github&…` makes a random state, keeps it in the cookie `__Secure-cms-oauth-state` (`HttpOnly; Secure; SameSite=Lax; Path=/api/auth`, 10 minutes) and sends the popup to GitHub's authorize page, with the callback `https://spacegear.tech/api/auth/callback` (from `SITE_ORIGIN`).
  - `GET /api/auth/callback?code=…&state=…` compares the state with the cookie in constant time and clears the cookie, then exchanges the code at `https://github.com/login/oauth/access_token`. GitHub reports a refused code with status 200 and an `error` field; that counts as a failure. It returns a small page that posts `authorizing:github` to the window that opened it. When that window answers from exactly `SITE_ORIGIN`, the page sends `authorization:github:success:{"provider":"github","token":"…"}` to that origin only, or `authorization:github:error:{…}` with a short message and one of Sveltia's error codes. Only the access token goes to the CMS; GitHub's refresh token is dropped, so a sign-in lasts as long as the access token, about 8 hours.
  - The page has its own headers, because `public/_headers` covers only the files in `dist/`, not Worker responses: `Content-Security-Policy: default-src 'none'; script-src 'sha256-…'` (the hash of its one inline script, which is the same text in every response; `npm test` recomputes it), plus `base-uri`, `form-action` and `frame-ancestors 'none'`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `X-Frame-Options: DENY`.
  - Only `GET` on `SITE_ORIGIN` is served (others get 405 or 403), only the provider `github` (400), and without `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` both routes answer 503 "GitHub sign-in is not configured.". The code, the token and the secret are never logged.
- **The scope** is the Worker's choice, not the CMS's: `public_repo`, which is enough to commit to a public repository. Sveltia asks for `repo,user`, but `repo` would also open every private repository of the editor, and `user` would allow changes to the editor's GitHub profile; the CMS only reads the public profile (name, login, avatar), which needs no scope. If the repository ever becomes private, set `GITHUB_OAUTH_SCOPE` to `repo` in `wrangler.jsonc`; any other value means `public_repo`.
- **Who can save:** GitHub decides. A commit needs write (push) access to `SanhVo2023/spacegear`. To add an editor, invite their GitHub account as a collaborator with write access; to remove one, remove that access.
- **The Worker variables** (`env.production.vars` in `wrangler.jsonc`): `GITHUB_CLIENT_ID`, the public client ID of the OAuth App "spacegear CMS", and `GITHUB_OAUTH_SCOPE`. Local previews keep the client ID empty, so they never start a real GitHub sign-in: on `localhost`, use **Work with Local Repository**. After changing `vars`, regenerate `worker-configuration.d.ts` with `npx wrangler types --strict-vars=false`. The secret `GITHUB_CLIENT_SECRET` is not in `wrangler.jsonc` or the generated types: it is typed in `RuntimeEnv` in [worker/types.ts](worker/types.ts).
- **The admin CSP** allows GitHub's API, its status check and the avatars (see "The admin Content-Security-Policy").

What a save does: the CMS commits the changed files to `main` through GitHub's API, in the editor's name. Cloudflare Workers Builds sees the commit and runs `npm run build:production`, which takes its public values from `release.env`. That build runs the content check, with every rule in "What the build checks", but not `npm test`. If it passes, Workers Builds deploys with `npx wrangler deploy --env production`. A content error fails the build, and the live site keeps the previous version.

**One-time setup by the owner.** Done: the GitHub OAuth App "spacegear CMS" (homepage `https://spacegear.tech`, callback `https://spacegear.tech/api/auth/callback`, expiring user tokens), its client ID in `wrangler.jsonc`, and the repository `SanhVo2023/spacegear` with `main`. Still to do:

1. **The client secret.** In GitHub, Settings, Developer settings, OAuth Apps, "spacegear CMS": generate a client secret. In the Cloudflare dashboard, Workers & Pages, `spacegear-tech`, Settings, Variables and Secrets: add `GITHUB_CLIENT_SECRET` with the type **Secret**. (With Wrangler instead: `npx wrangler secret put GITHUB_CLIENT_SECRET --env production`.) A secret stays across deploys; `vars` come from `wrangler.jsonc` on every deploy.
2. **Workers Builds.** In the same Worker, Settings, Build: connect the GitHub repository `SanhVo2023/spacegear`, production branch `main`, root directory `/`, build command `npm run build:production`, deploy command `npx wrangler deploy --env production`. No build variables are needed (`release.env`). Turn off builds for other branches: the CMS commits to `main` only.
3. **Check it.** Push or merge to `main` and wait for the build to deploy. Open https://spacegear.tech/admin/, choose **Sign In with GitHub**, approve "spacegear CMS", make a small edit and save. A commit appears on `main`, a new build starts, and the change is live when it finishes.
4. **Optional:** protect `/admin/*` (only that path, not `/api/*`, which also serves the contact form) with Cloudflare Access. The CMS cannot write without a GitHub sign-in, but Access also hides the page.

### Upgrading Sveltia

1. Pick a release that is at least 14 days old: this repository pins dependencies only after that.
2. In `SVELTIA` in `scripts/vendor-sveltia.mjs`, set `version`, `tarball` and `integrity` from `npm view @sveltia/cms@<version> dist.tarball dist.integrity`, and empty `files` and `schema`.
3. Run `npm run cms:vendor`. It downloads the tarball, checks its integrity, extracts the files into `public/admin/sveltia/` and the release's configuration schema into `scripts/sveltia-cms.schema.json`, and writes their hashes to `scripts/sveltia-cms.lock.json`. Review what it extracted.
4. Copy the hashes from the lock into `SVELTIA.files` and `SVELTIA.schema`, which are the second pin. Then `npm run cms:vendor -- --check` must print `Vendored @sveltia/cms@<version> matches scripts/sveltia-cms.lock.json and the pinned hashes.` The schema never ships: `/admin/` serves `SVELTIA.files` only.
5. Fonts and CSP. If the new bundle names other font files, `npm test` lists them. Put them in `ADMIN_FONTS` in `scripts/lib/headers.mjs` and in `font-src` in `public/_headers`, whose admin policy must stay exactly `ADMIN_CSP`. `npm test` also runs the changed file through Cloudflare's own `_headers` code (see "Upgrading wrangler or miniflare"). Read the release notes for new requests: the browser check fails on any blocked request other than the update check, and `npm test` fails when the bundle's GitHub API root or status check moves.
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

   The expected result is `Rendered HTML identical to artifacts/html-baseline: 28 pages.` (both languages, the 404 pages and `/admin/`). A page that is not in the snapshot is listed as new.

How to read the result:

- **Format 3** compares two parts of each page: the HTML without the inline React Server Components payload, and the React tree resolved from that payload. It masks the build ID, the hashed chunk and media names and the runs of chunk tags, and keeps the client module ids. `compare` refuses a folder saved in an older format.
- **Changed client ids.** Turbopack's client module ids shift whenever the set of modules changes, so a page can differ in its ids only. `compare` then lists each change (export, old id and new id, line). `--explain-client-ids <saved chunks>` (the `artifacts/dist-before` folder from step 1) passes such a page only when each changed id keeps its export and its place, and its factory code is identical apart from module ids that are explained in the same way in turn.
- **`--loose-client-ids`** ignores the ids and prints a warning. Use it only for a first look: it would not notice one client component swapped for another.
- Any other difference is a real change.
- Chunk names are masked, so also compare the chunk files themselves, for example `diff -r artifacts/dist-before/_next/static/chunks dist/_next/static/chunks`, which shows a changed stylesheet.

### What the CMS costs

No formal budget is set. Measured on this repository's build:

- **Browser.** The copy and its validation ship in one shared chunk of 35.8 KB (12.0 KB gzipped). The validation added about 13.6 KB (4.8 KB gzipped) and about 6 ms of script evaluation per full page load when the loader replaced the hand-written module.
- **Both languages in the browser.** Client components read their copy through `getContent(locale)`, so both languages' content ships in that shared chunk, and every page, English or Vietnamese, loads it once; it is cached across pages. The Vietnamese content added 8.0 KB gzipped when it arrived (measured on the first bilingual build). Since then the UI dictionary, in both languages, has joined the same chunk: it is now 91.7 KB (27.0 KB gzipped), against 40.1 KB (13.8 KB gzipped) just before the bilingual work. All client chunks together grew from 1 974 KB to 2 034 KB (572 KB to 588 KB gzipped). Only the language a page uses is validated in the browser: `getContent` builds a language the first time it is asked for.
- **Worker.** The Worker bundle includes the copy and validates it when it starts. Bundled with esbuild and not minified, it is about 62 KB (17 KB gzipped), against 19 KB before the CMS. Validation takes 6 to 7 ms per cold start. With both languages' copy and the UI dictionary (the contact form answers in the visitor's language) it is 155 KB (38 KB gzipped), against 75 KB (20 KB gzipped) before the bilingual work, measured the same way; the Worker still validates only the English copy when it starts.
- **Export.** `/admin/` adds 5 files and 2.39 MiB, nearly all of it the Sveltia bundle, which only `/admin/` loads. The export was 161 files and 13.92 MiB on the CMS branch; merged with the Part 1 globe, which removed the GLB and the Draco decoder, it is 173 files and 10.39 MiB. With the Vietnamese pages and font subsets it is 319 files and 13.28 MiB (24 pages).
- **Build time.** The upload variant step takes about 65 ms when there are no uploads. With twenty 12-megapixel JPEGs it took 9 s the first time and about 0.15 s when nothing had changed.

If a JavaScript budget is set later, the browser could load a pre-validated data module generated at build time instead.

### Tailwind and the docs

Tailwind scans `src/` only (`source("..")` in `src/app/globals.css`), so documentation, tests, content and the CMS files can quote class names freely: they add nothing to the site stylesheet. Limiting the scan removed 37 utilities that only the docs and plans quoted, and added none.

## Hero globe

The home hero renders the Earth with a custom three.js shader from texture tiers in `public/textures/earth/`: 1k for phones and tablets, 2k for the desktop first frame, and 4k streamed after the intro and an idle moment on desktops with a hardware GPU, a mouse or trackpad, 8 GB of memory (or none reported) and no slow connection. Rebuild the tiers from the preserved model with `node scripts/build-globe-textures.mjs`. It reads `assets/source/earth-4k.glb` (or `public/models/earth-4k.glb` when the local copy is absent) and rewrites `src/components/globe/texture-manifest.ts`. Look-and-feel tunables live in `src/components/globe/constants.ts` and `LOOK` in `src/components/globe/materials.ts`. After a visual change, re-capture the desktop poster with the preview running: `node scripts/capture-hero-poster.mjs http://127.0.0.1:8787` (use your preview's port).

No model, decoder or WebAssembly ships: the export check refuses any `.glb` file and anything under `draco/`, in any letter case, and the site CSP has no `'wasm-unsafe-eval'` and allows workers from the site only.

## Motion system

Effects live in `src/components/fx/`: Motion plus Lenis 1.3.26 (no GSAP).

- **Who gets what.** Heavy effects (smooth scroll, cursor, magnetic buttons, tilt and spotlight, split titles, the home progress rail, grain, the footer letters) run only after hydration on `(hover: hover) and (pointer: fine)` at ≥1024 px with motion allowed (`useFx()`, `html[data-fx]`). Lenis and the cursor load on demand there, so phones, tablets, touch screens and reduced motion never download them. Reveals and scroll draws run wherever motion is allowed (`html[data-fx-motion]`). Without JavaScript or under reduced motion, everything shows its end state.
- **Rules.** Markup branches only on `useFx()` / `useMotionOK()` (false on the server and during hydration), never on `useReducedMotion()`. Effects animate transform and opacity (SVG draws animate stroke dashes). An idle page requests no animation frames. Scroll-linked layers are promoted the first time they come near the viewport, not at page load.
- **Cursor labels.** Set `data-cursor` on an element to a label from the dictionary's `cursor` strings (View, Drag or Open; Xem, Kéo or Mở on Vietnamese pages) to show that label in the custom cursor.
- **Scroll locks.** Set `data-scroll-lock` on `<html>` (`setScrollLock()` in `src/components/fx/scroll-lock.ts`) to pause smooth scrolling.
- **Page transitions.** `experimental.viewTransition` plus React `<ViewTransition>` (`src/app/(en)/template.tsx`, `src/app/(vi)/template.tsx`, `src/components/fx/PageTransition.tsx`): an orange curtain, instant where unsupported or under reduced motion. Switching language is a full page load, without the curtain.
- **Browser fallbacks.** Chromium 111–124 (View Transitions without transition classes) shows a plain crossfade, with the nav hidden for about 250 ms. Safari before 16.4 and Firefox before 128 (no registered custom properties) snap the Services columns open instead of sliding them. Safari's swipe-back gesture can play its own animation and then the curtain.
- **Checks.** `scripts/fx-checks.mjs` runs inside `npm run test:browser`, or alone with `node scripts/fx-checks.mjs http://127.0.0.1:8787` (use your preview's port). `FX_ONLY=<pattern>` narrows a lone run to the matching desktop checks, and `FX_LOCALE=vi` runs them on the Vietnamese pages (see "Checks for the Vietnamese pages").

## Content and release

- [Content](content/): most of the copy, as JSON and Markdown, in English and (under `content/vi/`) Vietnamese, edited through the CMS at /admin/ (see "Editing content", which also lists the copy that is still in the code). [src/lib/content.ts](src/lib/content.ts) loads and validates it.
- [UI dictionary](src/lib/i18n/) and [Vietnamese glossary](docs/i18n/glossary-vi.md): the strings that live in code, in both languages, and the terms and voice of the Vietnamese copy (see "Languages").
- [Site configuration](src/lib/site.ts) and [.env.example](.env.example): identity and publication settings.
- [Cloudflare release runbook](docs/operations/cloudflare-release.md): bindings, gates, operations and rollback.
- [Source provenance](docs/operations/source-provenance.md): preserved source and clone status.
- [Implementation record](docs/operations/implementation-status.md): evidence and remaining dependencies.

The original checkout remains intact. The supplied GitHub destination was empty when inspected; cloning and Cloudflare account access were blocked by network access in this environment. No remote push or public deployment is claimed.
