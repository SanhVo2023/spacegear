// Content rules that check-content reports but the loader does not enforce, because they follow
// from how editors use the CMS, or from what the site promises about its copy. check-content runs
// them before every build, `npm run build:production` included, so they hold in GitHub mode too
// (Workers Builds runs only that command). They report problems and never change a file. Each
// function takes the loaded exports of src/lib/content.ts (or parts of them).

const pad = (count) => String(count).padStart(2, "0");
const quote = (value) => JSON.stringify(value);

/**
 * Engagements show their stage number ("01", "02", …) in list order. Dragging entries in the CMS
 * renumbers `order` but not the stage numbers, so each engagement's stageNo must be its position.
 * `engagements` is the ENGAGEMENTS export, already in list order.
 */
export function stageNumberProblems(engagements) {
  return engagements.flatMap(({ name, stageNo }, index) => {
    const expected = pad(index + 1);
    return stageNo === expected ? [] : [`content/engagements: "${name}" is number ${index + 1} in the list but its stage number is ${quote(stageNo)}; keep stage numbers in list order (01, 02, 03…): set it to "${expected}"`];
  });
}

/**
 * The counts on the page match the data: the hero stats, the "5/5" badges, the assessment badge
 * ("01/03") and one pillar per service. Editors type these counts, so nothing else keeps them true.
 */
export function countProblems({ HOME, WORK, CORE_PANEL, PILLARS, SERVICES, ENGAGEMENTS }) {
  const services = SERVICES.length;
  const engagements = ENGAGEMENTS.length;
  const problems = [];
  const expect = (where, actual, wanted, reason) => {
    if (actual !== wanted) problems.push(`${where} is ${quote(actual)}, but ${reason}: set it to ${quote(wanted)}`);
  };
  expect("content/home.json: stats[0].value", HOME.stats[0]?.value, pad(services), `the site has ${services} services`);
  expect("content/home.json: stats[1].value", HOME.stats[1]?.value, pad(engagements), `the site has ${engagements} engagements`);
  const names = ENGAGEMENTS.map((engagement) => engagement.short).join(", ");
  if (HOME.stats[1]?.sub.toLowerCase() !== names.toLowerCase()) {
    problems.push(`content/home.json: stats[1].sub is ${quote(HOME.stats[1]?.sub)}, but it names the engagements it counts, in list order: set it to ${quote(names)} (letter case is free)`);
  }
  expect("content/work.json: lineup.count", WORK.lineup.count, `${services}/${services}`, `the site has ${services} services`);
  expect("content/services-panel.json: panel.count", CORE_PANEL.count, `${services}/${services}`, `the site has ${services} services`);
  expect("content/work.json: assessment.badge", WORK.assessment.badge, `01/${pad(engagements)}`, `the assessment is the first of ${engagements} engagements`);
  const slugs = SERVICES.map((service) => service.slug);
  const pillars = PILLARS.map((pillar) => pillar.slug);
  if ([...pillars].sort().join() !== [...slugs].sort().join()) {
    problems.push(`content/services-panel.json: pillars: list every service once (${slugs.join(", ")}); now ${pillars.join(", ") || "none"}`);
  }
  return problems;
}

/** "First Last": two capitalised words, the shape of a person's name. */
const PERSON_NAME = /^[A-Z][a-z]+ [A-Z][a-z]+$/;

/**
 * The team section shows disciplines, not invented people: a card's name may not read like a
 * person's name, and it may not use the original site's stock portraits (/images/team/). A real
 * person goes in the founder card (content/team.json), which needs a real name, photo and bio.
 */
export function teamProblems({ TEAM_ROLES }) {
  return TEAM_ROLES.flatMap((role) => [
    ...(PERSON_NAME.test(role.name) ? [`content/team-roles: ${quote(role.name)} reads like a person's name; team cards describe a discipline (a person goes in the founder card in content/team.json)`] : []),
    ...(/images\/team\//.test(role.img) ? [`content/team-roles: ${quote(role.name)} uses a stock portrait (${role.img}); use a discipline image instead`] : []),
  ]);
}

/**
 * The sample dashboard shows made-up figures, so its section and each of its cards must say so: the
 * section description says "illustrative" and "not client results", each card names itself an
 * illustrative figure, an example or a sample, and the stages footer says "illustrative".
 */
export function illustrativeProblems({ SECTIONS, MEASURE }) {
  const problems = [];
  const description = SECTIONS.analytics.description;
  if (!/illustrative/i.test(description) || !/not client results/i.test(description)) {
    problems.push(`content/sections.json: analytics.description must say that the figures are illustrative and not client results (both words "illustrative" and "not client results"), because the dashboard shows sample data`);
  }
  for (const card of ["workflow", "accuracy", "throughput", "readiness", "coverage"]) {
    if (!/illustrative|example|sample/i.test(JSON.stringify(MEASURE[card]))) problems.push(`content/measure.json: ${card} must call itself illustrative, an example or a sample in one of its texts`);
  }
  if (!/illustrative/i.test(MEASURE.stagesFooter)) problems.push(`content/measure.json: stagesFooter must say "illustrative"`);
  return problems;
}

/**
 * Testimonials and articles use their own images, not the original site's stock reviews and labs
 * art. Only the testimonials the site shows (permission confirmed) are in the export.
 */
export function stockImageProblems({ TESTIMONIALS, ARTICLES }) {
  return [
    ...TESTIMONIALS.filter((item) => /images\/reviews\//.test(item.img)).map((item) => `content/testimonials: the testimonial by ${quote(item.name)} uses a stock portrait (${item.img}); use the client's own approved photo`),
    ...ARTICLES.filter((article) => /images\/labs\//.test(article.img)).map((article) => `content/articles: ${quote(article.title)} uses a stock image (${article.img}); use the article's own image`),
  ];
}

/**
 * Every link in the copy points at a page of this site or at a full address. `routes` are the
 * published pages ("/", "/services/", …); `/#<section>` links to a home section.
 */
export function linkProblems(content, routes) {
  const allowed = new Set([...routes, ...Object.keys(content.SECTIONS).map((id) => `/#${id}`)]);
  const problems = [];
  const walk = (value, at) => {
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${at}[${index}]`));
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        const field = `${at}.${key}`;
        if (key === "href" && typeof child === "string") {
          if (!allowed.has(child) && !/^https?:\/\//.test(child)) problems.push(`link in export ${field}: ${quote(child)} is not a page of this site; use a page such as /contact/ or /#faq, or a full https:// address`);
        } else walk(child, field);
      }
    }
  };
  for (const [name, value] of Object.entries(content)) if (typeof value !== "function") walk(value, name);
  return problems;
}

/** Every rule above, in the order check-content prints them. */
export function contentRuleProblems(content, routes) {
  return [
    ...stageNumberProblems(content.ENGAGEMENTS),
    ...countProblems(content),
    ...teamProblems(content),
    ...illustrativeProblems(content),
    ...stockImageProblems(content),
    ...linkProblems(content, routes),
  ];
}
