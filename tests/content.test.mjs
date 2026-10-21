import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { contentFiles, findForbidden, scanContentTree, scanExports, scanFile } from "../scripts/lib/honesty.mjs";
import { readContentInput } from "./helpers/content.mjs";

const content = await import("../src/lib/content.ts");
const { buildContent } = await import("../src/lib/content-model.ts");

const PUBLIC_KEYS = ["HOME", "SECTIONS", "WORK", "PILLARS", "CORE_PANEL", "PROCESS_STEPS", "PROCESS_CTA", "APPROACH_STEPS", "MEASURE", "ENGAGEMENTS", "ENGAGEMENTS_FOOTER", "FAQS", "FAQ_CARD", "TEAM", "TEAM_ROLES", "FOUNDER", "TESTIMONIALS", "ARTICLES", "FOOTER", "SERVICES", "serviceBySlug"];

test("every public content export exists", () => {
  for (const key of PUBLIC_KEYS) assert.ok(key in content, `${key} is exported`);
});

test("public content makes no unverified claims", () => {
  assert.deepEqual(scanExports(content), []);
});

// Claims the scan must catch in ordinary copy (from the Task 6 reviews), and copy it must let through.
const CLAIMS = [
  // Prices, also written with look-alike or invisible characters.
  "From ＄499 a month", "900 dollars", "900 pounds", "from 5k", "₫20,000,000", "20.000.000 đồng", "Price: 499", "₹9,999", "CHF 900",
  "hourly rate of 120", "499 per month", "49 a month", "49/mo", "＄４９９", "$４９９", "$\u{200B}499", "$\u{AD}499", "$\u{200E}499",
  "$\u{202A}499", "$\u{2061}499", "$\u{34F}499", "$\u{180E}499", "$\t499", "$\n499",
  // Clients, scale and results.
  "Trusted by 200 clients", "Trusted by 200\nclients", "200 customers", "40% faster delivery", "10× ROI", "ten times faster",
  "tripled conversion", "1M users", "Hundreds of clients", "dozens of enterprise clients", "100 projects delivered", "two hundred clients",
  "a team of thirty engineers", "trusted by Fortune 500", "98% Client satisfaction",
  // Experience and offices.
  "a decade of experience", "Since 2012", "Founded in 2015", "since the 1990s", "15yrs", "over ten years", "Offices in London and Singapore",
  "Our Hanoi office", "Headquartered in Saigon", "Our HQ in Hanoi",
  // Press, partners, ratings, awards and certifications.
  "As seen in Forbes", "Featured in TechCrunch", "Google Cloud Partner", "We are an AWS Advanced Tier Partner", "Award-winning agency",
  "rated 4.9/5", "5-star reviews", "#1 AI consultancy", "4.9★", "4.9 stars", "★★★★★", "ISO 27001 certified", "SOC 2 Type II", "SOC 2 certified",
  // Delivery timelines.
  "Delivered in 2 weeks", "launch in 30 days", "within 48 hours", "4-6 weeks", "We deliver every project within 2 weeks", "delivered in two weeks",
  "48-hour turnaround", "24h turnaround",
];
const ORDINARY = [
  "Digital transformation and AI consulting, from strategy to working systems.", "Step 01", "Phase 2", "Two weeks of discovery",
  "ISO 27001", "GDPR Article 6(1)(f)", "Next.js 16", "© 2026 spacegear.tech", "We reply within two working days.", "A 3-step process",
  "24/7 support", "Version 2.0", "Top 10 risks", "Plan for 2027", "Pricing is agreed per engagement", "No fixed price list", "back-office automation",
  "Data is stored in the EU", "Cloudflare Workers", "we partner with your team", "3 engagements: assess, build, improve", "under 16",
  "a featured engagement", "Pricing is based in part on scope", "We work with one team at a time", "Pick one of three engagements",
  // False positives found in the Task 6b review.
  "One team per project", "access per user", "One review per sprint", "thousands of documents", "millions of records",
  "decades-old systems", "HQ audio", "Our #1 rule", "You own 100% of the code", "4K display",
  // Near misses of the optional patterns.
  "a North Star metric", "Star schema", "We help you prepare for SOC 2", "Fortune favours the prepared", "a quick turnaround on feedback",
  "two teams review each release", "Leave your name and email and we’ll take you to a short brief.",
];

test("every probe claim is caught in ordinary copy, including look-alike and invisible characters", () => {
  for (const claim of CLAIMS) assert.notDeepEqual(findForbidden(claim, "content/faqs/x.json"), [], JSON.stringify(claim));
});

test("ordinary copy passes", () => {
  for (const text of ORDINARY) assert.deepEqual(findForbidden(text, "content/faqs/x.json"), [], text);
});

test("the sample dashboard may show figures in its figure fields only", () => {
  const measure = JSON.parse(fs.readFileSync("content/measure.json", "utf8"));
  assert.deepEqual(scanFile("content/measure.json", JSON.stringify(measure)), [], "the real dashboard passes");
  assert.deepEqual(findForbidden("62%", "content/measure.json", "workflow.center"), []);
  assert.deepEqual(findForbidden("12m → 2m", "MEASURE", "stages[0].detail"), []);
  const edited = {
    ...measure,
    ticker: ["Clients see 40% savings", ...measure.ticker.slice(1)],
    cta: { ...measure.cta, label: "Used by 2M people" },
    coverage: { ...measure.coverage, label: "Client satisfaction" },
  };
  const expected = [
    'ticker[0]: a result figure ("40%")',
    'cta: a price or scale figure ("2M")', // the { label, href } group, reported once
    'coverage: a client result claim ("Client satisfaction")',
  ];
  for (const problem of expected) assert.ok(scanFile("content/measure.json", JSON.stringify(edited)).includes(problem), problem);
  for (const problem of expected) assert.ok(scanExports({ MEASURE: edited }).includes(`MEASURE.${problem}`), `MEASURE.${problem}`);
  assert.notDeepEqual(findForbidden("62% faster", "FAQS"), [], "percentages are refused everywhere else");
});

test("the legal pages may state periods and name processors, but not founding years, promises or partner tiers", () => {
  const legal = "content/legal/terms.md";
  for (const text of ["We keep records for 2 years.", "Closed inquiries are deleted within 90 days.", "Notice is given at least 30 days in advance.", "Inquiries are stored with Amazon Web Services (AWS)."]) {
    assert.deepEqual(findForbidden(text, legal), [], text);
  }
  assert.notDeepEqual(findForbidden("We keep records for 2 years.", "content/faqs/x.json"), [], "outside the legal pages a period reads as a claim");
  for (const text of ["spacegear has served clients since 2012", "a decade of experience", "We deliver every project within 2 weeks", "We are an AWS Advanced Tier Partner"]) {
    assert.notDeepEqual(findForbidden(text, legal), [], text);
  }
  // Every processor the legal pages name passes in any file.
  const pages = ["privacy", "terms"].map((page) => fs.readFileSync(`content/legal/${page}.md`, "utf8")).join("\n");
  const processors = [...new Set(pages.match(/Cloudflare(?: [A-Z][a-z]+)*/g))];
  assert.ok(processors.length >= 3, processors.join(", "));
  for (const name of processors) assert.deepEqual(findForbidden(name, "content/faqs/x.json"), [], name);
});

test("JSON files and exports are scanned as decoded values: escapes, line breaks and tabs hide nothing", () => {
  const file = "content/faqs/x.json";
  assert.deepEqual(scanFile(file, '{"answer":"Saved us \\u0024200k."}'), ['answer: a price ("$2")', 'answer: a price or scale figure ("200k")']);
  assert.deepEqual(scanFile(file, '{"answer":"Trusted by 200\\nclients."}'), ['answer: a client or scale claim ("200\\nclients")']);
  assert.deepEqual(scanFile(file, '{"answer":"From $\\t499"}'), ['answer: a price ("$\\t4")']);
  assert.deepEqual(scanExports({ FAQS: [{ question: "Q?", answer: "Trusted by 200\nclients" }], HOME: { statement: "From $\n499" } }), [
    'FAQS[0].answer: a client or scale claim ("200\\nclients")',
    'HOME.statement: a price ("$\\n4")',
  ]);
  assert.deepEqual(scanFile(file, '{"answer":'), [], "a file that does not parse is left to the loader");
  assert.deepEqual(scanFile("content/legal/terms.md", "## A\n\n\\u0024"), [], "Markdown is scanned as written");
});

test("a figure split over value, unit and label fields is read as one claim, and the real stats pass", () => {
  const home = JSON.parse(fs.readFileSync("content/home.json", "utf8"));
  assert.deepEqual(scanFile("content/home.json", JSON.stringify(home)), [], `real stats: ${JSON.stringify(home.stats)}`);
  assert.deepEqual(scanExports({ HOME: content.HOME }), []);
  const cases = [
    [{ value: "200", unit: "", label: "Clients served", sub: "Since the start" }, 'stats[0]: a client or scale claim ("200 Clients")'],
    [{ value: "98", unit: "%", label: "Client satisfaction", sub: "Across projects" }, 'stats[0]: a client result claim ("Client satisfaction")'],
    [{ value: "98", unit: "%", label: "Satisfaction", sub: "Across projects" }, 'stats[0]: a result figure ("98%")'],
    [{ value: "12", unit: "", label: "Years in business", sub: "Founded long ago" }, 'stats[0]: an experience claim ("12 Years")'],
  ];
  for (const [stat, problem] of cases) {
    const edited = { ...home, stats: [stat, home.stats[1]] };
    assert.ok(scanFile("content/home.json", JSON.stringify(edited)).includes(problem), `${problem} in ${JSON.stringify(scanFile("content/home.json", JSON.stringify(edited)))}`);
    assert.ok(scanExports({ HOME: edited }).includes(`HOME.${problem}`), `HOME.${problem}`);
  }
});

test("no pattern is slow on long pathological input", () => {
  const n = 200_000;
  const inputs = [
    `1${" ".repeat(n)}x`, `${"1,".repeat(n / 2)}x`, `${"1.".repeat(n / 2)}x`, `${"1".repeat(n)}x`, `in${" ".repeat(n)}x`,
    `Google ${"a".repeat(n)}`, `price${" ".repeat(n)}x`, `deliver ${"a ".repeat(n / 2)}`, "1 per ".repeat(n / 6), "two-three ".repeat(n / 10),
  ];
  const start = performance.now();
  for (const text of inputs) findForbidden(text, "content/faqs/x.json");
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 3000, `${inputs.length} inputs of ${n} characters took ${elapsed.toFixed(0)} ms`);
});

test("no file under content/ makes an unverified claim, including fields the site does not render", () => {
  const files = contentFiles(".").map((file) => file.replaceAll("\\", "/"));
  for (const file of ["content/home.json", "content/faqs/what-we-do.json", "content/legal/privacy.md", "content/legal/terms.md"]) assert.ok(files.includes(file), `the scan covers ${file}`);
  assert.deepEqual(scanContentTree("."), []);
});

test("a price written into a content entry fails both scans (temporary copy, real tree untouched)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-honesty-"));
  const planted = "content/faqs/zz-planted-price.json";
  try {
    fs.cpSync("content", path.join(root, "content"), { recursive: true });
    const entry = { question: "What does it cost?", answer: "Packages start at $499 per month.", order: 99 };
    fs.writeFileSync(path.join(root, planted), JSON.stringify(entry, null, 2));
    assert.ok(scanContentTree(root).some((problem) => problem.startsWith(`${planted}: answer: a price`)), "the file scan flags it");
    const built = buildContent(readContentInput(root));
    assert.ok(scanExports(built).some((problem) => /^FAQS\[\d+\]\.answer: a price/.test(problem)), "the loaded-content scan flags it");
    assert.equal(fs.existsSync(planted), false, "the real content tree is untouched");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a price written into a legal page fails the file scan (temporary copy)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-honesty-"));
  try {
    fs.cpSync("content", path.join(root, "content"), { recursive: true });
    fs.appendFileSync(path.join(root, "content/legal/terms.md"), "\n## Fees\n\nProjects cost from 900 EUR.\n");
    assert.ok(scanContentTree(root).some((problem) => problem.startsWith("content/legal/terms.md: a price")));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// scripts/check-content.mjs runs before every build. It is run here on a temporary copy of the
// files it needs, from a folder without content/, so it must find the project from its own location.
test("check-content passes the committed content and lists every problem by file, field and fix, without a stack trace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacegear-check-"));
  try {
    for (const dir of ["content", "src/lib", "scripts/lib"]) fs.cpSync(dir, path.join(root, dir), { recursive: true });
    for (const file of ["scripts/check-content.mjs", "scripts/build-content-index.mjs"]) fs.copyFileSync(file, path.join(root, file));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    const env = { ...process.env, SITE_MODE: "preview", NEXT_PUBLIC_SHOW_SAMPLES: "" };
    const run = () => spawnSync(process.execPath, ["--experimental-strip-types", path.join(root, "scripts", "check-content.mjs")], { cwd: path.join(root, "src"), encoding: "utf8", env });
    const listed = (result) => result.stderr.split(/\r?\n/).filter((line) => line.startsWith("  - ")).map((line) => line.slice(4));
    const edit = (file, change) => {
      const full = path.join(root, file);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      change(data);
      fs.writeFileSync(full, JSON.stringify(data, null, 2));
    };

    let result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Content valid: 12 routes; preview mode\./);

    // A price in loaded copy: both scans name it.
    edit("content/faqs/what-we-do.json", (faq) => { faq.answer = "Packages start at $499 per month."; });
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^Content check failed\. Fix these problems:$/m);
    for (const problem of ['forbidden claim in export FAQS[0].answer: a price ("$4")', 'forbidden claim in content/faqs/what-we-do.json: answer: a price ("$4")']) {
      assert.ok(listed(result).includes(problem), `${problem}\n${result.stderr}`);
    }

    // Problems in several files are listed together, each with its file and fix.
    edit("content/home.json", (home) => { home.cta.label = ""; });
    edit("content/site.json", (site) => { site.socialProfiles = ["http://example.com/profile"]; });
    fs.writeFileSync(path.join(root, "content/faqs/zz-new.json"), JSON.stringify({ question: "A new question?", answer: "A new answer.", order: 98 }));
    const terms = path.join(root, "content/legal/terms.md");
    fs.appendFileSync(terms, "\n## Contact\n\nWrite to legal_team@example.com.\n");
    const termsLine = fs.readFileSync(terms, "utf8").split("\n").length - 1;
    result = run();
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /^\s+at /m, "no stack trace");
    for (const problem of [
      "src/lib/content-index.generated.ts is out of date: run npm run content:index",
      "content/home.json: cta.label: required",
      "content/site.json: socialProfiles[0]: use a full https:// profile address",
      `content/legal/terms.md, line ${termsLine}: "_" in "…ite to legal_team@example…": write the text without * _ \` < > [ ] \\ | ~~ or &…;`,
      'forbidden claim in content/faqs/what-we-do.json: answer: a price ("$4")',
    ]) assert.ok(listed(result).includes(problem), `${problem}\n${result.stderr}`);

    // A file that is not valid JSON is named from the project folder.
    fs.writeFileSync(path.join(root, "content/faqs/who-we-work-with.json"), '{ "question": ');
    result = run();
    assert.equal(result.status, 1);
    assert.ok(listed(result).some((problem) => problem.startsWith("content/faqs/who-we-work-with.json: ")), result.stderr);
    assert.doesNotMatch(result.stderr, /^\s+at /m, "no stack trace");

    // A missing file is a content problem: its message, from the project folder, without a stack.
    fs.rmSync(terms);
    result = run();
    assert.equal(result.status, 1);
    assert.ok(listed(result).includes("ENOENT: no such file or directory, open 'content/legal/terms.md'"), result.stderr);
    assert.doesNotMatch(result.stderr, /^\s+at /m, "no stack trace");

    // So is an entry file name the index refuses.
    fs.writeFileSync(path.join(root, "content/faqs/Bad.json"), "{}");
    result = run();
    assert.equal(result.status, 1);
    assert.ok(listed(result).includes("Rename content/faqs/Bad.json: entry file names use lowercase letters, digits, - and _ only."), result.stderr);
    assert.doesNotMatch(result.stderr, /^\s+at /m, "no stack trace");

    // A bug in the code keeps its stack, so it can be found.
    fs.writeFileSync(path.join(root, "src/lib/legal.ts"), 'export const LEGAL_PAGES = ["privacy"] as const;\nexport function legalSections(): never { throw new TypeError("boom"); }\n');
    result = run();
    assert.equal(result.status, 1);
    assert.ok(listed(result).includes("TypeError: boom"), result.stderr);
    assert.match(result.stderr, /^\s+at legalSections /m, "the stack is printed");

  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("hero copy keeps the original four-line headline rhythm", () => {
  const { HOME } = content;
  assert.equal(HOME.headline.verbs.length, 3);
  assert.deepEqual(HOME.headline.verbs, ["plan", "build", "scale"]);
  assert.ok(HOME.headline.verbs.every((verb) => verb.length <= 6), "hero verbs must stay short");
  assert.equal(HOME.stats.length, 2);
  assert.equal(HOME.cta.label, "Discuss a project");
  assert.ok(HOME.pitch.text.length <= 48, "pitch line fits on one line like the original");
});

test("every section header has a title, a three-digit index, a heading and a description", () => {
  for (const [id, copy] of Object.entries(content.SECTIONS)) {
    for (const field of ["title", "index", "heading", "description"]) assert.ok(copy[field], `${id}.${field}`);
    assert.match(copy.index, /^\d{3}$/, `${id}.index`);
  }
});

test("illustrative measures are labelled as such", () => {
  assert.equal(content.MEASURE.illustrative, true);
  assert.match(content.SECTIONS.analytics.description, /illustrative/i);
  assert.match(content.SECTIONS.analytics.description, /not client results/i);
});

test("work tiles and service pillars point at real service pages", () => {
  const slugs = new Set(content.SERVICES.map((service) => service.slug));
  assert.equal(content.WORK.tiles.length, 4);
  for (const tile of content.WORK.tiles) assert.ok(slugs.has(tile.slug), tile.slug);
  assert.deepEqual(content.PILLARS.map((pillar) => pillar.slug).sort(), [...slugs].sort(), "one pillar per service");
  const art = (slug) => content.serviceBySlug(slug).image;
  for (const item of [...content.WORK.tiles, ...content.PILLARS]) assert.equal(item.img, art(item.slug), `${item.slug} uses its service image`);
  assert.equal(content.WORK.featured.img, art(content.WORK.featured.href.split("/")[2]), "featured tile uses its service image");
});

test("process steps count real outputs instead of invented timings", () => {
  for (const step of [...content.PROCESS_STEPS, ...content.APPROACH_STEPS]) {
    assert.ok(step.outputs.length >= 1, step.step);
    for (const key of Object.keys(step)) assert.ok(["step", "name", "desc", "outputs"].includes(key), `${step.step} has unexpected key ${key}`);
  }
});

test("engagements carry no prices and exactly one starting point", () => {
  for (const engagement of content.ENGAGEMENTS) {
    for (const key of Object.keys(engagement)) assert.ok(["name", "short", "img", "stage", "stageNo", "deliverables", "outcomes", "featured"].includes(key), `${engagement.name} has unexpected key ${key}`);
    assert.ok(engagement.deliverables.length >= 3 && engagement.outcomes.length >= 3, engagement.name);
  }
  assert.equal(content.ENGAGEMENTS.filter((engagement) => engagement.featured).length, 1);
});

test("the team section shows roles, not invented people", () => {
  for (const role of content.TEAM_ROLES) {
    assert.doesNotMatch(role.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/, `${role.name} looks like a person's name`);
    assert.doesNotMatch(role.img, /images\/team\//, "role cards must not use the stock portraits");
    assert.equal(role.links.length, 0, `${role.name} must not link to invented profiles`);
  }
  if (content.FOUNDER) assert.ok(content.FOUNDER.name && content.FOUNDER.img && content.FOUNDER.bio, "founder card needs a real name, photo and bio");
});

test("testimonials and articles only hold publishable entries", () => {
  for (const item of content.TESTIMONIALS) {
    assert.equal(item.permissionConfirmed, true);
    assert.ok(item.name && item.company && item.quote && item.img);
    assert.doesNotMatch(item.img, /images\/reviews\//, "use the client's own approved photo");
  }
  for (const article of content.ARTICLES) {
    assert.ok(article.href && article.title && article.author);
    assert.doesNotMatch(article.img, /images\/labs\//, "use the article's own image");
  }
});

test("sample preview data is not part of public content", () => {
  for (const key of Object.keys(content)) assert.doesNotMatch(key, /SAMPLE/);
});

test("every illustrative card says so", () => {
  for (const key of ["workflow", "accuracy", "throughput", "readiness", "coverage"]) {
    assert.match(JSON.stringify(content.MEASURE[key]), /illustrative|example|sample/i, `MEASURE.${key} is labelled`);
  }
  assert.match(content.MEASURE.stagesFooter, /illustrative/i);
});

test("displayed counts match the data", () => {
  const n = content.SERVICES.length;
  const pad = (v) => String(v).padStart(2, "0");
  assert.equal(content.HOME.stats[0].value, pad(n));
  assert.equal(content.HOME.stats[1].value, pad(content.ENGAGEMENTS.length));
  assert.equal(content.HOME.stats[1].sub.toLowerCase(), content.ENGAGEMENTS.map((e) => e.short.toLowerCase()).join(", "), "the second hero stat names the engagements it counts");
  assert.equal(content.WORK.lineup.count, `${n}/${n}`);
  assert.equal(content.CORE_PANEL.count, `${n}/${n}`);
  assert.equal(content.PILLARS.length, n);
  assert.equal(content.WORK.assessment.badge, `01/${pad(content.ENGAGEMENTS.length)}`);
});

test("internal links point at real pages", () => {
  const hrefs = [];
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (key === "href" && typeof child === "string") hrefs.push(child);
        else walk(child);
      }
    }
  };
  for (const value of Object.values(content)) if (typeof value !== "function") walk(value);
  const allowed = new Set(["/", "/services/", "/approach/", "/about/", "/contact/", "/privacy/", "/terms/"]);
  for (const service of content.SERVICES) allowed.add(`/services/${service.slug}/`);
  for (const id of Object.keys(content.SECTIONS)) allowed.add(`/#${id}`);
  assert.ok(hrefs.length > 0, "found hrefs");
  for (const href of hrefs) assert.ok(allowed.has(href) || /^https?:\/\//.test(href), `${href} is not a real page`);
});
