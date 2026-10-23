# spacegear.tech: bilingual site, Labs articles, smoother cursor, contact details

Status: approved by the owner on 2026-10-23 (brainstorming in chat). The live site is `master`, deployed to https://spacegear.tech by the Worker `spacegear-tech`.

## Owner decisions

1. **Languages.**
   - English keeps today's URLs (`/`, `/about/`, …). Vietnamese mirrors every page under `/vi/` (`/vi/`, `/vi/about/`, …).
   - On a visitor's first visit, the Worker sends people in Vietnam, or whose browser prefers Vietnamese, to the Vietnamese page. An EN/VI switch remembers their choice.
2. **Vietnamese copy.**
   - Claude writes it and it goes live straight away; the owner refines it later in the CMS.
   - Style rule: natural Vietnamese in full sentences with a subject and predicate. Claims are rewritten the way Vietnamese people say them; nothing is translated word for word.
   - Facts stay identical and no claim is added (the honesty rules apply in both languages).
   - Privacy and Terms are translated faithfully from the approved English.
3. **Cursor:** keep the custom cursor's look and make it feel instant.
4. **Contact details** (owner-supplied facts, 2026-10-23):
   - Address (vi): Số 11, đường B4, Khu đô thị Sala, phường An Khánh, TP. Hồ Chí Minh, Việt Nam
   - Address (en): 11 B4 Street, Sala Urban Area, An Khanh Ward, Ho Chi Minh City, Vietnam
   - Phone: 0386 749 799 (`tel:+84386749799`, international +84 386 749 799)
   - Email: admin@spacegear.tech (unchanged)
5. **A written guide for setting up Google Business Profile.**

## Order and branches

| Part | Branch / worktree | Depends on |
|---|---|---|
| 1. Cursor | `feat/cursor-smooth` in `spacegear-motion` | — |
| 2. Bilingual site + contact details | `feat/bilingual` in `spacegear-hero` | — |
| 3. Labs articles | `feat/bilingual` (after Part 2's routing and content loader land) | Part 2 |
| Guide: Google Business Profile | `docs/operations/google-business-profile.md` on `feat/bilingual` | — |

- Each part is merged into `master` and deployed separately, after its gates pass.
- No push or deploy happens without the controller's check.
- Port 8787 stays off-limits.

## Part 1: smoother cursor

**Problem.** `src/components/fx/Cursor.tsx` hides the system pointer and draws its own. Three things make it feel laggy:
- The dot moves through a Motion value, so the style is written on the next animation frame: at least one frame behind the real pointer.
- The ring follows on a spring (stiffness 480, damping 38, mass 0.6) and visibly trails.
- `.fx-cursor` uses `mix-blend-mode: difference` over the WebGL globe, which forces the compositor to blend every frame.

**Design.**
- **Dot.** Write its transform directly in the input handler. Use `pointerrawupdate` where it exists (Chromium), otherwise `pointermove`, and the last coalesced point. Use `translate3d`, with no Motion batching.
- **Ring.** A critically damped follower that settles in about 100 ms, and snaps on large jumps (more than about 300 px, for example when re-entering the window). It is driven by the existing idle-loop helper, so it stops requesting frames once settled.
- **Blending.** Remove `mix-blend-mode`. For contrast on light and dark grounds, the white dot and ring get a thin dark outline (`box-shadow`). The labelled orange disc keeps its look.
- **Layers.** `will-change: transform` and `contain: layout style` on the moving layers only.
- **Kept as is:** labels (View/Drag/Open), the text state, hiding on keyboard or touch, forced colours (no cursor), the route-change re-check, z-index 110, and the view-transition naming.
- **Measured, before and after** (headless desktop profile, pointer moving over the hero globe and the page):
  - event-to-paint latency of the dot (target: painted in the first frame after the event);
  - the ring's settle time;
  - dropped frames.
- **fx-checks:** the dot follows within one frame, and the ring settles under 150 ms.

## Part 2: bilingual site

### Routing and `<html lang>`
- English pages stay where they are. Vietnamese copies of all 12 pages are added under `/vi/`, with the same slugs (for example `/vi/services/applied-ai/`).
- **One component tree serves both languages.** Pages and sections take a locale. Component markup is never duplicated per language.
- **The static HTML carries the right language** (`<html lang="en">` or `<html lang="vi">`). The plan picks the mechanism: Next 16 multiple root layouts through route groups (then a `global-not-found` 404), or an equivalent the docs in `node_modules/next/dist/docs/` support with `output: "export"`.
- Switching language is a full page load. The page curtain only runs within one language.
- **404:** one page that says it in both languages.

### Region redirect (Worker)
- `assets.run_worker_first` covers HTML navigations only. It excludes `/_next/*`, `/images/*`, `/textures/*`, `/uploads/*`, `/admin/*`, `/vi/*` and any path with a file extension. `/api/*` keeps its current handling.
- **When the Worker redirects:**
  - A GET or HEAD request for an English page, with no `sg_lang` cookie, gets a 302 to its `/vi/` twin when `request.cf.country === "VN"`, or when the first `Accept-Language` entry is `vi` (or `vi-*`).
  - Query strings are kept.
  - The response carries `Cache-Control: no-store` and `Vary: Cookie, Accept-Language`.
  - Crawlers are not treated specially. Googlebot from outside Vietnam sees English and finds `/vi/` through hreflang and the sitemap.
- **The switch works without JavaScript:**
  - EN/VI links go to the twin page with `?lang=en` or `?lang=vi`.
  - The Worker answers those with `Set-Cookie: sg_lang=<lang>; Path=/; Max-Age=31536000; SameSite=Lax; Secure` and a 302 to the clean URL.
  - An explicit `/vi/…` or English URL is never redirected once the cookie exists.
- **Placement:** the switch sits in the desktop nav and the mobile menu. It is keyboard reachable, labelled ("English" / "Tiếng Việt"), and marks the current language.

### SEO
- Every page carries `<link rel="alternate" hreflang="en|vi|x-default">` (x-default = English) and its own canonical.
- The sitemap lists all 24 URLs with `xhtml:link` alternates.
- JSON-LD gets `inLanguage`, and Open Graph gets `og:locale` (`en_US` / `vi_VN`) and `og:locale:alternate`.
- `robots.txt` is unchanged apart from the sitemap.
- `check-seo` checks both languages: hreflang points both ways, canonicals, one H1, and visible no-JS content.

### Content
- **CMS i18n.**
  - Sveltia `i18n` with `locales: [en, vi]`, `default_locale: en`, `structure: multiple_folders` (or the per-collection equivalent), and `omit_default_locale_from_file_path: true`.
  - English files stay exactly where they are. Vietnamese files mirror them under `content/vi/` (for example `content/vi/home.json`, `content/vi/legal/privacy.md`).
  - Text fields are `i18n: true`. Images, links, numbers, slugs and order are `i18n: duplicate`.
  - The plan confirms the exact keys against the vendored 0.230.1 schema (`scripts/sveltia-cms.schema.json`) and bundle.
- **Loader.** `src/lib/content.ts` exposes the same data per locale, with the same shapes and names under a locale. Vietnamese must be complete: `check-content` fails on a missing Vietnamese file or field, or on a non-text field that differs from English.
- **UI strings in code** (nav labels, buttons, form labels and messages, aria labels, 404, metadata defaults, cursor labels) move to a typed dictionary `src/lib/i18n/` with `en` and `vi`. TypeScript must fail when a key is missing in either language.
- **Vietnamese copy** is written to the style rule above. Every Vietnamese text is checked by the honesty scan.
- **Field limits.** CMS fields whose limits only fit English (for example the hero verbs, max 6) are widened where Vietnamese needs it. The layouts are checked at 320, 390, 768 and 1440 px for `/vi/`.

### Honesty scan in Vietnamese
`scripts/lib/honesty.mjs` learns Vietnamese claim patterns, each with tests that plant a claim and expect a refusal:
- prices and rates (triệu, tỷ, đồng, VNĐ, /tháng, /giờ);
- counts of khách hàng, dự án, doanh nghiệp, nhân sự or chuyên gia;
- năm kinh nghiệm, and founding years (thành lập năm …);
- đối tác, giải thưởng, chứng nhận, báo chí;
- văn phòng or chi nhánh claims;
- delivery timelines (trong N ngày/tuần);
- results with figures (tăng/giảm N%, gấp N lần).

The owner-supplied contact details (decision 4) are allowed only in the site-identity fields that hold them.

### Contact details (NAP)
- **CMS.** `content/site.json` (Site identity) gets `address` (localised: en and vi strings) and `telephone` (shared, E.164 `+84386749799`).
- **Shown on the site:**
  - the Contact page: a `tel:` link, the address and the email;
  - the footer contact block;
  - the Privacy and Terms contact sections.
- **JSON-LD.** Organization gains `address` (PostalAddress: `streetAddress`, `addressLocality` "Ho Chi Minh City" / "Thành phố Hồ Chí Minh", `addressCountry` "VN"; no postal code, because none was given) and `telephone`.
- The honesty scan and `check-content` treat these fields as owner facts.

### Fonts and diacritics
- Add Vietnamese subsets of Inter and JetBrains Mono (self-hosted, OFL; update `public/licenses/fonts.txt`). Today's `inter-latin.woff2` lacks 53 of 56 Vietnamese letters.
- Use `unicode-range` so English pages don't download the Vietnamese subset.
- Masked text (hero word masks, SplitReveal) must not clip stacked diacritics (Ấ, Ở, Ữ). Check line boxes and mask padding on `/vi/`.

### Tailwind scope
Switch to `@import "tailwindcss" source("..");` (scan `src/` only). With it, specs, plans and content can no longer add utilities. Confirm the shipped stylesheet loses only rules no source file uses, and drop the `@source not` lines this makes unnecessary.

### Tests and gates
- Unit tests:
  - locale resolution in the Worker (country, Accept-Language, cookie, `?lang`, exclusions);
  - dictionary completeness;
  - Vietnamese honesty plants;
  - content parity between locales.
- **`browser-check` on `/vi/`:** at least home, contact and one service page, in the desktop, mobile, no-JS and reduced-motion profiles (hidden-text gate, accessible names, CLS). Plus the switch and the redirect against the preview Worker, simulating the country with a header the preview honours only in local mode.
- **`check-seo`** for both languages.
- **fx-checks** pass on `/vi/`.

## Part 3: Labs articles (bilingual)

- **CMS collection "Labs"** (`label: Labs`). It replaces today's `articles` link-card schema; no entries exist.
- **Files.** `content/articles/<slug>.md` (en) and `content/vi/articles/<slug>.md` (vi): Markdown with front matter. The slug is shared between languages. An article may exist in only one language.
- **Fields:**
  - `title`, `summary` (≤ 200 chars), and `body` (Markdown: headings h2–h4, lists, links, images, blockquote, code; no raw HTML);
  - `cover` image and `coverAlt`;
  - `date` (published), optional `updated`;
  - `author` (a real person's name).

  Text fields are per language. `cover`, `date`, `updated` and `author` are shared.
- **Pages.**
  - An index at `/labs/` and `/vi/labs/`, newest first, and an article page at `/labs/<slug>/` and `/vi/labs/<slug>/`.
  - A language that has no articles gets neither page (no empty editorial routes). The plan works out how to do this with `output: "export"`.
  - `check-seo`'s "fictional `/labs/*` returns 404" rule becomes "unknown `/labs/*` returns 404".
- **Rendering.**
  - Markdown becomes HTML at build time with a small, well-known renderer, pinned and at least 14 days old, with raw HTML off.
  - Headings get anchors, and an estimated reading time is shown.
  - Images go through `contentImage()` (upload variants). External links get `rel="noopener noreferrer"`.
- **Home.** The Labs section shows the 3 newest articles in the page's language and links to the index. It stays hidden when there are none (as today).
- **SEO/GEO:**
  - `BlogPosting` JSON-LD (headline, description, author `Person`, datePublished/dateModified, image, inLanguage, publisher Organization);
  - OG image = cover;
  - hreflang between the two translations when both exist;
  - sitemap entries;
  - RSS per language (`/labs/rss.xml`, `/vi/labs/rss.xml`);
  - `/llms.txt` listing the key pages and articles in both languages.
- **Honesty and content checks** cover article front matter and bodies in both languages.
- **Publishing.** `/admin/` → Labs → New → write English and/or Vietnamese → Save. That makes a commit, Workers Builds deploys it, and the article is live in about 3 minutes.

## Guide: Google Business Profile
`docs/operations/google-business-profile.md`, written in natural Vietnamese. It covers:
- creating and verifying the profile (business.google.com; the current verification methods, including video);
- the choice between a storefront and a service-area business, with Google's rule: if clients are not received at the address during business hours, hide the address and set a service area;
- business name exactly "spacegear" (no keyword stuffing), category suggestions, description, services, hours, phone, the website link with UTM, photos and logo from `docs/brand/`;
- keeping name, address and phone identical with the website (the exact strings above);
- reviews, posts and Q&A etiquette;
- linking Search Console;
- Bing Places import;
- what not to do (fake reviews, virtual offices, keyword names).

## Out of scope
More languages; machine translation at runtime; per-article categories or tags; comments; a newsletter.
