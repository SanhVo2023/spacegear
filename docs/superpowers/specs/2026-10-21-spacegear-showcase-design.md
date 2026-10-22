# spacegear.tech showcase upgrade — design

**Status:** approved by the owner on 2026-10-21 ("okie implement").
**Branch:** `feat/spacegear-showcase`, cut from `feat/spacegear-fidelity` at `b83d904`.
**Baseline:** the fidelity rebuild. It restores the original platform-clone sections, layout vocabulary and honest Spacegear copy. That baseline is now the floor, not the ceiling: the owner wants the site to "look sick and impressive", and it is mainly a showcase.

## Goals, in priority order

1. **The globe looks right and impressive.** Today the model has a weak light, city lights on the day side and blue-tinted clouds, so it looks blotchy and dark even on a GTX 1660 Ti.
2. **The overall look and motion are bold:** micro-interactions, keyframes, scroll-driven sequences.
3. **Assets load fast and in the right order.**
4. **A CMS** edits content and images without touching code.

## Non-goals (later)

- Deployment.
- New pages or sections.
- New copy beyond what the effects need. The intro counter and cursor labels are UI text, not claims.
- Blog/article authoring beyond what the CMS schema already holds.
- Analytics, i18n.

## Guardrails (unchanged from the fidelity rebuild)

- **No invented claims.** Copy comes from content files that pass the honesty tests.
- **Rendered markup never branches on `useReducedMotion()`.** Reduced motion is handled globally (`MotionProvider` `skipAnimations` + reduced-motion end-state CSS on `data-*` hooks).
- **Content stays visible without JavaScript and under reduced motion.** The hidden-text gate in `scripts/browser-check.mjs` must keep passing.
- **Accessibility holds.** Accessible names contain the visible text. Keyboard access, focus visibility and WCAG 2.2.2 (pausable motion) are kept. Custom cursor, smooth scroll and magnetic effects are pointer-fine desktop enhancements only. They never remove the native focus ring or change the tab order.
- **The CSP in `public/_headers` stays strict.** Any new need (for example `/admin`) gets its own scoped rule. The preview must keep serving the production headers.
- **All existing gates stay green:**
  - `lint`, `typecheck` and `test` must pass.
  - `build:cf`, `check:seo` and `test:browser` must pass.
  - `check:fidelity` stays a layout regression guard. Section heights may drift only where an effect adds height on purpose; the plan records any new tolerance.
- **Every visual change is checked in a real GPU browser** (the owner's Chrome) as well as headless.

## Part 1 — Globe and hero

### Approach

A procedural `SphereGeometry` with a custom `ShaderMaterial`. Its texture maps are extracted from `assets/source/earth-4k.glb` by a new script.

Rejected alternatives:
- Patching the GLB materials still ships the 6.3 MB model plus Draco.
- A pre-rendered video or image sequence is not interactive and is heavy.

### Textures

A new script `scripts/build-globe-textures.mjs` (sharp) reads the source GLB and writes upright equirectangular maps to `public/textures/earth/`. The source images are stored south-up for the model's UVs; the script flips them so they match three's `SphereGeometry` UVs.

| Map | Content | Encoding |
|---|---|---|
| `day` | Blue Marble colour | WebP |
| `night` | City lights | WebP. Warm, boosted in the shader |
| `normal` | Normal map | WebP. If unusable, derive a bump map from the base colour |
| `spec` | Ocean mask | Derived from the roughness/metal map or from the base colour's ocean hue |
| `clouds` | Cloud coverage | Single-channel greyscale WebP from the cloud alpha |

There are three tiers:

| Tier | Resolution | Used for |
|---|---|---|
| `1k` | 1024 px | Mobile |
| `2k` | 2048 px | First frame on desktop |
| `4k` | 4096 px | Streamed after idle on capable desktops |

`assets/source/earth-4k.glb` stays as the source. `public/models/earth-hq.glb`, the Draco files and the GLTF/Draco loader code are removed once nothing uses them.

### Shader

- **Sun light.** A sun direction uniform lights the day side with Lambert shading and normal-mapped relief.
- **Terminator.** A soft day/night boundary (smoothstep), with a warm twilight band in brand orange (`#fa6e43`) along it.
- **Night side.** It shows only the night map's city lights: warm and slightly over-bright, so they read as glowing.
- **Oceans.** They get a specular glint (Blinn-Phong) from the `spec` mask.
- **Cloud shell.** A separate sphere at radius ≈1.01, rotating slightly faster than the surface and lit by the sun. Clouds fade on the night side, except for a faint moonlit rim. They cast a soft shadow onto the surface (the surface shader samples the cloud map offset along the sun direction).
- **Atmosphere.** A back-face shell with a fresnel rim (additive): blue on the day side, orange at the terminator, faint on the night side.
- **Colour.** Tone mapping and colour space stay consistent with the current scene: sRGB textures, ACES or AgX.

### Scene and motion

- **Stars and backdrop.** The existing star field and galaxy backdrop stay. Stars get a slight mouse parallax.
- **Cursor and drag.**
  - The globe tilts toward the cursor (spring-damped, max about 6°).
  - Pointer drag spins it with inertia, then it eases back to its idle rotation.
  - The drag must not block page scroll on touch, and is disabled on touch devices.
- **Scroll beats.** The three existing beats stay (globe right, then shrink to centre with the word-by-word statement, then the curtain slides over). Two things are added:
  - The sun direction sweeps with scroll progress, so the terminator crosses the visible face and the city lights come on as the globe reaches the centre.
  - The camera dollies in slowly.

### Intro

The intro is a loader:
- an overlay counter `00→100`, driven by real texture-loading progress via `THREE.LoadingManager`;
- then a reveal: the globe fades up from black with an atmosphere flare, and the hero headline lines rise out of a mask.

Rules:
- It plays once per session (`sessionStorage`), with a hard cap of about 2.5 s on top of loading. Past the cap the page reveals anyway.
- It is skipped for reduced motion, no-JS, `Save-Data` and repeat views.
- Without JS, the overlay is never shown. It is rendered hidden and only shown by JS.

### Devices

| Profile | Behaviour |
|---|---|
| Desktop, ≥1024 px, no reduced motion, WebGL2 | Full scene: 2K, then 4K |
| Phone or tablet | A lightweight 1K globe (fewer stars, dpr ≤ 1.5), when WebGL2 is available, `navigator.deviceMemory` is ≥ 4 or unknown, and Save-Data is off. Otherwise the current galaxy backdrop |
| Reduced motion or no WebGL2 | A static poster, re-captured from the new globe by `scripts/capture-hero-poster.mjs` |

### Budget

- Desktop hero first frame: ≤ about 900 KB of textures (2K set).
- Full 4K set: ≤ about 2.5 MB.
- No GLB, no Draco.
- Mobile: ≤ about 450 KB.
- Steady 60 fps on the owner's GPU at 1440p, and no long task over 100 ms after the intro.
- Measure and record the actual sizes and observations (local, unthrottled).

## Part 2 — Motion system

### Approach

The existing Motion (`motion/react`) is extended with small in-repo primitives, plus **Lenis** for smooth scrolling. GSAP is not added: two animation engines would be heavier and conflicting.

Primitives live in `src/components/fx/`. Each is client-only, cleans up its listeners and rAF, and is a no-op for reduced motion and coarse pointers.

### Primitives

- **`SmoothScroll`.** Lenis, desktop pointer-fine only. It must not be used for reduced motion or touch. It must keep anchor links and the deep-link tests working, along with `scroll-padding-top`, the CurtainShell footer-focus scroll and the hero's focus scroll-to-top.
- **`Cursor`.**
  - A dot plus ring with `mix-blend-mode: difference`. It morphs over interactive elements and shows contextual labels via a `data-cursor="View|Drag|Open"` attribute (UI text only).
  - The native cursor stays visible over text inputs.
  - It never covers focus rings and is hidden while keyboard navigation is active.
- **`Magnetic`.** CTA buttons and pills attract to the cursor (spring, max about 10 px), and the arrow glyph nudges.
- **`Spotlight` / `Tilt`.** Cards get a cursor-following radial highlight and a subtle 3D tilt (max about 4°). This applies to What We Do tiles, the What We Measure cards and engagement rows.
- **`SplitReveal`.**
  - The giant section titles split into characters that rise from a mask, from blur to sharp, staggered.
  - The existing grey→white fill keeps tracking the scroll.
  - The split is done on the client after hydration. The server renders the plain heading, so no-JS and screen readers get the whole word (`aria-label` on the heading, split spans `aria-hidden`).
- **`ScrollProgressRail`.** A right-side rail showing the current home section, with labels on hover/focus. It upgrades the existing "Home page sections" nav and stays keyboard-usable.
- **`Grain`.** A static SVG noise overlay at about 3–4% opacity, with `pointer-events: none`.

### Section effects (home)

| Section | Effect |
|---|---|
| What We Do | Image parallax inside tiles. Cards stack and scale on desktop scroll (mobile already stacks) |
| Services | An image sweep or clip reveal when a column expands. The dot matrix ripples on hover |
| Process | The timeline line draws, scrubbed by scroll. Dots ignite as they are passed. Cards lift in sequence |
| What We Measure | Charts and line paths draw on enter (bars already grow). Counters count up (they exist). The ticker speed and skew follow scroll velocity, and it still pauses on hover/focus |
| Engagements | Rows slide in, staggered. The toggle moves on a spring. The selected glow pulses once |
| Questions & Answers | The icon rotates and morphs. The photo card parallaxes |
| Footer | As the curtain opens, the giant wordmark's letters rise in sequence. Letters near the cursor push away (pointer-fine) |

### Site-wide micro-interactions

- The nav active pill slides between links (shared layout).
- Buttons get a sweep fill on hover.
- Links get an underline that draws in.
- Inputs get a focus glow.

### Page transitions

An orange curtain wipe between routes, using the View Transitions API. Read `node_modules/next/dist/docs/` for Next 16's supported way (React `ViewTransition` / the Next config flag). It must degrade to an instant navigation where unsupported.

### Limits

- Heavy effects run only on `(hover: hover) and (pointer: fine)` and ≥1024 px.
- Touch devices get the lighter subset: reveals and scroll draws only.
- No effect may cause layout shift (transform and opacity only).
- 60 fps target. The existing rAF-budget check in `browser-check.mjs` stays, or is revised with a stated reason.

## Part 3 — CMS (Sveltia CMS, git-based)

### Admin

- **Location.** `/admin` is a static page (`public/admin/index.html` + `config.yml`).
- **Sveltia CMS.** It loads from a pinned, vendored bundle, served from `/admin/`, rather than from a CDN at runtime.
- **CSP.** `/admin/*` gets its own CSP rule in `_headers`. It allows what Sveltia needs (`'unsafe-eval'` only if required; `connect-src` for api.github.com later). The site's CSP is unchanged.
- **Indexing and scope.** `/admin` is `noindex`, excluded from the sitemap and from the SEO crawl expectations, and is not linked from the site.
- **Packaging.** It is packaged by `scripts/package-site.mjs`.

### Content files

Content moves out of `src/lib/content.ts` into `content/`. `content.ts` becomes a typed loader that imports the files, validates them and exports the same names and types, so components do not change.

| Content | Storage |
|---|---|
| site, home, sections, footer, measure | One JSON file each |
| services, engagements, FAQs, team roles | Folder collections, one file per entry, with an `order` field |
| testimonials, articles | Folder collections (empty today) |
| privacy, terms | Markdown |

The CMS `config.yml` mirrors these schemas:
- Required fields, max lengths and select options for the service slugs.
- Testimonials need the `permissionConfirmed` boolean to render. That is unchanged.

### Honesty

- `tests/content.test.mjs` and `scripts/check-content.mjs` run against the loaded content, so a CMS edit that adds a price or an invented metric fails the build.
- The tests also scan the Markdown legal pages.

### Media

- **Uploads.** Images go to `public/uploads/`.
- **Build step.** A step (sharp) writes responsive WebP variants next to each upload (for example `-640`, `-1280`). Images are rendered from those variants.
- **Packaging.** `scripts/package-site.mjs` publishes `uploads/**` automatically.
- **Checks.** `check-export` keeps verifying that every referenced asset ships.

### Workflow

- **Today, local.** Open `/admin` on the local preview in Chrome, then choose "Work with local repository" (File System Access). Edits write straight into the repo files. Rebuild to see them.
- **Later, once the repo is on GitHub.**
  - GitHub backend.
  - A small OAuth endpoint in the existing Worker (`/api/auth`).
  - Cloudflare Workers Builds connected to the repo, so each CMS save redeploys.
  - This is documented in the README, not built until the repo exists.

## Testing and verification

- **Unit.** The content loader and schema validation, and the texture-script outputs (dimensions, sizes).
- **`browser-check.mjs`.**
  - No CSP violations.
  - The globe renders: a canvas exists and sampled pixels are not uniform.
  - The intro is skipped on the second visit, for reduced motion and for no-JS.
  - Cursor and smooth scroll are absent on touch and reduced-motion profiles.
  - Focus stays visible with the custom cursor.
  - The hidden-text gate passes.
  - `/admin` serves with its own CSP and `noindex`.
- **Real GPU.** Screenshots in the owner's Chrome (Claude in Chrome) at 1422×745 for the hero beats and the key sections.
- **`check:fidelity`.** It is re-run with the reference server. Heights stay within tolerance, apart from deliberate changes recorded in the plan.

## Delivery order

1. Part 1: globe and hero.
2. Part 2: motion.
3. Part 3: CMS. It is independent of Parts 1–2 apart from shared scripts, so it may run in parallel in its own worktree when memory allows.

Each part ends with full gates and a real-browser check. Nothing is merged, pushed or deployed without the owner.
