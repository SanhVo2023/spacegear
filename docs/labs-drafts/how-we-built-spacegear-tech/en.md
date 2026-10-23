---
title: "How we built spacegear.tech with Claude Code agents"
summary: "Claude Code agents built most of spacegear.tech from specs and plans while I made the calls. Rebuilding the globe as a shader cut the desktop home page from 7,753 to 1,747 KiB."
cover: /uploads/labs/how-we-built-spacegear-tech/cover.webp
coverAlt: "The spacegear.tech shader globe: West Africa and the Atlantic in daylight, with a blue atmosphere against a starry sky"
date: 2026-10-23
updated: ""
author: "Sanh Võ"
---

spacegear.tech went live on 23 October 2026. Claude Code agents built most of it from written specs and plans, several at a time, while I made the decisions that needed a person. The change that mattered most was the hero globe: rebuilt as a shader, it stopped looking blotchy, and the desktop home page went from 7,753 KiB to 1,747 KiB in our browser check.

## The problem and the constraints

spacegear is a digital transformation and AI consultancy, and its site has to show that without inventing anything. On 20 October I set the ground rules: the domain is spacegear.tech, the audience is open to any industry, size or region, the site shows no signals of company size, and everything runs on Cloudflare. That evening Claude Code took over the build, and from then on it wrote all the code.

An honesty scanner in the build refuses prices, client counts, invented results, offices and delivery promises in any content file. This article went through it too.

## How we worked

One Claude Code session acted as the controller. For each phase it wrote a design spec for me to approve, then a plan of numbered tasks with exact files, tests and commands. Each task went to a fresh agent. Other agents checked the result against the spec and reviewed the code, and a fix round followed whenever a review found a real problem. Then the measured gates ran: lint, type checks, unit tests, an SEO crawl and a browser check in six profiles, from a 320-pixel phone to no JavaScript at all. The controller kept a ledger of every task's commits and reviews.

Work ran in parallel, each line on its own branch and folder: the globe and the CMS together, then the motion system when I asked to go faster. Builds and browser runs shared one lock.

Until 21 October most tasks went to Claude Sonnet, with Claude Opus on the hero and the final reviews. From 21 October every agent ran Claude Opus at extra-high effort, because I asked for it.

These decisions were mine:

- the name, the open audience and no public signals of company size;
- "build all, reword honestly": every section stays, and says only what is true;
- the order of priorities: the globe first, then bold motion, then loading, then a CMS;
- the logo concept, B · Shift;
- merging to the release branch, and the deploy;
- approving the privacy and terms pages, supplying the contact details and entering the production secret myself;
- the language plan: English at today's URLs, Vietnamese under /vi/, written by Claude and refined later by me.

## Step 1: honest content on solid foundations

When Claude Code took over, the site already had its foundations: 12 static pages on Cloudflare Workers Static Assets, a Worker that checks inquiries with Turnstile and stores them in D1, canonical URLs and structured data, and 15 tests. In this step we made every section honest and sturdy.

All the copy moved into one typed content file, with tests that enforce the honesty rules. Every section had to say something true. The engagements section lists three ways to work together, without prices. The dashboard section, What We Measure, is labelled as an illustrative example and not client results. The process timeline counts the outputs each step produces. Testimonials and Labs render only real entries, so both stayed hidden at launch.

![The Our Services section on the live site: five service columns, the first one open in orange, and a Core Services card](/uploads/labs/how-we-built-spacegear-tech/services.webp)

The invisible work mattered as much. Sentence-length grey text went from a contrast of 2.8:1 to 5.1:1. Content stays visible without JavaScript, and the browser check fails if any text in the page body is hidden in the no-JavaScript or reduced-motion profiles. By the end of this step the unit tests had grown from 15 to 29.

![The Our Process section: four step cards from Assess to Adopt on a timeline, each listing the outputs it produces](/uploads/labs/how-we-built-spacegear-tech/process.webp)

## Step 2: a globe that looks like the Earth

The globe was my first priority, and it looked blotchy and dark. Agents took the 3D model apart and found why: the alpha channel of its cloud layer was inverted, opaque where the sky is clear, so every clear-sky pixel drew a dark film over the surface.

We replaced the 6,320,916-byte model with a sphere and a custom shader: a sunlit day side, a soft terminator with a brand-orange twilight band, warm city lights, an ocean glint, relief, a cloud shell that casts shadows and a glowing atmosphere. As you scroll, the sun sweeps across, so the city lights come on as the globe reaches the centre.

![The hero halfway through its scroll: the globe in the centre with a lit crescent, an orange twilight band and city lights, while the statement fills in word by word](/uploads/labs/how-we-built-spacegear-tech/hero-centre.webp)

A script extracts five maps from the model in three sizes: 189,692 bytes for phones, 660,662 bytes for a desktop's first frame, and 2,182,272 bytes for the largest set, which streams in later only on desktops with a hardware graphics card and a mouse or trackpad. The model file and its decoder are gone, and so is the WebAssembly permission in the security policy.

On a desktop, the home page went from 7,753 KiB to 1,747 KiB, measured by the same browser check on a local preview: headless Chromium, one laptop, no throttling. These are lab observations, not Lighthouse scores or field data.

![Bar chart: the desktop home page went from 7,753 KiB with the model globe to 1,747 KiB with the shader globe, and the globe files for the first frame from 6,173 KiB to 645 KiB](/uploads/labs/how-we-built-spacegear-tech/chart-first-load-en.webp)

Phones and tablets now get a light globe of their own. It mounts only after the page has loaded and gone still.

![The phone hero at 390 pixels wide: the headline, the Discuss a project button and the light globe rising at the bottom](/uploads/labs/how-we-built-spacegear-tech/hero-phone.webp)

## Step 3: motion with rules

Next came the motion system: smooth scrolling, a custom cursor, magnetic buttons, titles that rise letter by letter, an orange curtain between pages, charts that draw as you reach them, and footer letters that rise as the curtain opens.

![The What We Measure section: an illustrative dashboard with a workflow chart, stage dials and bar charts, labelled as an example and not client results](/uploads/labs/how-we-built-spacegear-tech/measure.webp)

The rules mattered more than the effects. Heavy effects run only on desktops with a mouse or trackpad, 1,024 pixels or wider, with motion allowed. Phones, tablets and reduced-motion visitors never download the smooth scroller or the cursor. Without JavaScript, everything shows its end state. Effects animate only transform and opacity. At the end the desktop profile measured no layout shift and no long tasks, and motion added no height to any section.

![The footer with the giant spacegear wordmark after its letters have risen, the link columns and the Start with one challenge form](/uploads/labs/how-we-built-spacegear-tech/footer-wordmark.webp)

## Step 4: a logo and a content editor

I asked for a real identity to replace the placeholder dash wordmark. An agent worked through a logo-design process and stopped at its checkpoint for me to choose. I chose B · Shift: a planet split along the old dash, its halves slid apart, "the moment a business shifts gear". The name is drawn, not typed. The ™ appears only on the footer wordmark, and the scanner refuses the registered-trademark sign until the mark is registered. A trademark search is still on my list.

![The spacegear logo in orange on a dark ground: the horizontal lockup, the stacked lockup, the split-planet symbol and the wordmark](/uploads/labs/how-we-built-spacegear-tech/logo.webp)

![The logo's construction: one planet cut along its equator, the cut and the shift each 0.26 of the radius, and the name aligned to the cut](/uploads/labs/how-we-built-spacegear-tech/logo-construction.webp)

At the same time, the copy moved out of the code into JSON and Markdown files that Sveltia CMS 0.230.1 edits at /admin/. The CMS refuses uploads that carry GPS location data and writes 640 and 1,280 pixel WebP versions of every image. A snapshot check compared every rendered page before and after the move: identical.

![The sign-in screen of the spacegear.tech content editor at /admin/, with the split-planet symbol and two sign-in buttons](/uploads/labs/how-we-built-spacegear-tech/admin-sign-in.webp)

Signing in with GitHub on this live screen is merged and goes out with the next deploy.

## Step 5: launch

On 22 October I chose to merge the work into the release branch, and on 23 October I asked for the deploy. A Cloudflare Worker now serves spacegear.tech: 12 core pages and 181 files, 10.67 MiB in all. The production SEO check passed on the live domain. Inquiry capture is on; email notifications stay off until a sender is verified.

![The live spacegear.tech hero on a desktop: the headline The smarter way to plan, build, and scale your business over the daylit globe](/uploads/labs/how-we-built-spacegear-tech/hero-desktop.webp)

## The grind

Between 20 and 23 October, Claude Code made 222 commits on the release line, not counting merges: 70 start with "fix" and 67 with "feat". In the globe and CMS work, 17 of the 20 tasks that had a quality review needed at least one fix round. Some of those rounds:

- **A white globe, caught before launch.** A whole-branch review found that the security policy blocked the model's embedded textures, so production would have shown a white globe that washed out the headline. Worse, a second header rule had stripped the policy from the local preview, so every earlier browser check ran without it. Now the browser check asserts the policy on every route.
- **A gate that cried wolf.** About 0.6 kilobytes of new validation made the bundler split a chunk, and the HTML snapshot reported all 15 pages as changed, although the markup was identical. We rebuilt the gate to compare the resolved React tree instead.
- **A flaky timer.** The first upload of the largest texture set may take 120 ms. On a busy machine, three of four clean runs measured 135, 153 and 170 ms, then under 50 ms on a fresh page. The check now measures twice before failing.
- **Small numbers, real fixes.** Hovering a Services card shifted the layout (CLS 0.02 to 0.04); now it is 0. The card spotlight dropped small grey text to a contrast of 3.81:1; it now stays at 4.57:1. Over the hero, 14 layers used to be promoted for the GPU at page load; now none are.
- **Docs that became CSS.** Tailwind scans every file Git tracks, so class names quoted in plans became site styles; excluding the docs removed 27 rules. The bilingual branch now scans the source folder only.
- **The cursor.** I wanted to keep the custom cursor, but make it feel instant. We assumed the dot lagged a frame. The measurement said no: the dot was already painted in the first frame after each event. What did change is the ring. A critically damped follower replaced the spring, and its settle time went from 234–358 ms to 67–114 ms across seven cases. The blend mode over the globe is gone, and the hover disc is a faint white fill. With this change the unit tests reached 309, up from 15 when Claude Code took over. It is merged and goes live with the next deploy.

![Bar chart: the cursor ring's settle time in seven cases, from 234 to 358 ms with the old spring down to 67 to 114 ms with the new follower](/uploads/labs/how-we-built-spacegear-tech/chart-cursor-en.webp)

## What we'd do differently

- **Look in a real browser on a schedule.** Only one look check ran on a desktop graphics card; most later checks by eye are still on my list.
- **Measure the premise before planning the fix.** The cursor plan assumed a lag that wasn't there.
- **Keep documentation out of the build from day one.** Plan prose should never ship as CSS.
- **Say what each number is.** Every record here states its conditions.

## What's next

The bilingual site is in progress: Vietnamese copy for every content file, a /vi/ mirror with a region redirect and a language switch, and Vietnamese patterns for the honesty scanner. So is spacegear Labs, the section this article was written for. Neither is live yet.

If you want a similar build, with the decisions kept on your side, [tell us what you want to improve](/contact/).
