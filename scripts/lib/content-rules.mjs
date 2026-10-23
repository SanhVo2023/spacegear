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

/**
 * Words that name a discipline. A capitalised name made only of name-like words reads as a person
 * unless one of its words is here, so "Data Engineering" passes and "Ada Lovelace" does not. When
 * a real discipline is refused, add its word here (lowercase).
 */
export const DISCIPLINE_WORDS = new Set(`adoption advisory ai analytics applied architecture assurance automation backend business change
cloud communications compliance consulting content customer data delivery design development devops digital discovery enablement
engineering experience frontend governance growth infrastructure insights integration intelligence learning machine management
marketing ml mobile network operations platform process product program project quality reliability research science security
service services software strategy support systems technical testing training transformation ui user ux web writing`.split(/\s+/));
const HONORIFIC = /^(?:dr|mr|mrs|ms|mx|prof|sir|dame)\.?$/i;
/** A capitalised name word in any script ("Ada", "Anna-Lena", "O’Neil", "Nguyễn"), or an initial ("J."). */
const NAME_WORD = /^\p{Lu}\p{Ll}+(?:[-'’]\p{Lu}?\p{Ll}+)*$|^\p{Lu}\.$/u;
const PARTICLE = /^(?:van|von|de|da|di|du|del|der|le|la|bin|binti)$/;

/**
 * Whether a team-card name has the shape of a person's name: 2 to 4 words, and either an honorific
 * first ("Dr Smith"), or only capitalised name words and particles ("Ludwig van Beethoven",
 * "Nguyễn Văn An"), none of them a discipline word. "&", digits, acronyms ("AI") and lowercase
 * words ("Data engineering") never read as a person.
 */
export function readsLikePerson(name) {
  const words = name.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  if (HONORIFIC.test(words[0])) return true;
  if (!words.every((word) => NAME_WORD.test(word) || PARTICLE.test(word))) return false;
  return !words.some((word) => DISCIPLINE_WORDS.has(word.toLowerCase().replace(/[.'’]/g, "")));
}

/**
 * The team section shows disciplines, not invented people: a card's name may not read like a
 * person's name, and it may not use the original site's stock portraits (/images/team/). A real
 * person goes in the founder card (content/team.json), which needs a real name, photo and bio.
 */
export function teamProblems({ TEAM_ROLES }) {
  return TEAM_ROLES.flatMap((role) => [
    ...(readsLikePerson(role.name) ? [`content/team-roles: ${quote(role.name)} reads like a person's name, and team cards describe a discipline. If it is a discipline, write it in sentence case (such as "Brand storytelling") or with "&" (such as "Brand & Story"); a maintainer can also add its word to DISCIPLINE_WORDS in scripts/lib/content-rules.mjs. A real person goes in the founder card (content/team.json)`] : []),
    ...(/images\/team\//.test(role.img) ? [`content/team-roles: ${quote(role.name)} uses a stock portrait (${role.img}); use a discipline image instead`] : []),
  ]);
}

/** The words that label the sample dashboard, per language (Vietnamese writes "minh họa" with either tone placement). */
const ILLUSTRATIVE = {
  en: { section: [/illustrative/i, /not client results/i], sectionWords: '"illustrative" and "not client results"', card: /illustrative|example|sample/i, cardWords: "illustrative, an example or a sample", footer: /illustrative/i, footerWord: '"illustrative"' },
  vi: { section: [/minh h(?:ọa|oạ)/iu, /không phải kết quả của khách hàng/iu], sectionWords: '"minh họa" and "không phải kết quả của khách hàng"', card: /minh h(?:ọa|oạ)|ví dụ|mẫu/iu, cardWords: '"minh họa", "ví dụ" or "mẫu"', footer: /minh h(?:ọa|oạ)/iu, footerWord: '"minh họa"' },
};

/**
 * The sample dashboard shows made-up figures, so its section and each of its cards must say so: the
 * section description says "illustrative" and "not client results", each card names itself an
 * illustrative figure, an example or a sample, and the stages footer says "illustrative" (in Vietnamese:
 * "minh họa", "không phải kết quả của khách hàng", "ví dụ", "mẫu").
 */
export function illustrativeProblems({ SECTIONS, MEASURE }, locale = "en") {
  const words = ILLUSTRATIVE[locale];
  const problems = [];
  const description = SECTIONS.analytics.description;
  if (!words.section.every((pattern) => pattern.test(description))) {
    problems.push(`content/sections.json: analytics.description must say that the figures are illustrative and not client results (both words ${words.sectionWords}), because the dashboard shows sample data`);
  }
  for (const card of ["workflow", "accuracy", "throughput", "readiness", "coverage"]) {
    if (!words.card.test(JSON.stringify(MEASURE[card]))) problems.push(`content/measure.json: ${card} must call itself ${words.cardWords} in one of its texts`);
  }
  if (!words.footer.test(MEASURE.stagesFooter)) problems.push(`content/measure.json: stagesFooter must say ${words.footerWord}`);
  return problems;
}

/**
 * Testimonials use their own photos, not the original site's stock reviews. Only the testimonials
 * the site shows (permission confirmed) are in the export.
 */
export function stockImageProblems({ TESTIMONIALS }) {
  return TESTIMONIALS.filter((item) => /images\/reviews\//.test(item.img)).map((item) => `content/testimonials: the testimonial by ${quote(item.name)} uses a stock portrait (${item.img}); use the client's own approved photo`);
}

/**
 * Every link in the copy points at a page of this site or at a full address. `routes` are the
 * published pages ("/", "/services/", …). A query or fragment may follow the page ("/#faq",
 * "/about/#team", "/contact/?service=applied-ai"); only the path part must be a known page.
 */
export function linkProblems(content, routes) {
  const allowed = new Set(routes);
  const problems = [];
  const walk = (value, at) => {
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${at}[${index}]`));
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        const field = `${at}.${key}`;
        if (key === "href" && typeof child === "string") {
          const page = child.split(/[?#]/, 1)[0];
          if (!allowed.has(page) && !/^https?:\/\//.test(child)) problems.push(`link in export ${field}: ${quote(child)} is not a page of this site; use a page such as /contact/ or /#faq, or a full https:// address`);
        } else walk(child, field);
      }
    }
  };
  for (const [name, value] of Object.entries(content)) if (typeof value !== "function") walk(value, name);
  return problems;
}

/** Every rule above, in the order check-content prints them. A Vietnamese problem names its file under content/vi/. */
export function contentRuleProblems(content, routes, { locale = "en" } = {}) {
  const problems = [
    ...stageNumberProblems(content.ENGAGEMENTS),
    ...countProblems(content),
    ...teamProblems(content),
    ...illustrativeProblems(content, locale),
    ...stockImageProblems(content),
    ...linkProblems(content, routes),
  ];
  return locale === "en" ? problems : problems.map((problem) => problem.replace(/^content\//, "content/vi/").replace(/^link in export /, "link in Vietnamese export "));
}

/** The full address begins with the street line, so the page and the structured data never disagree. */
export function addressProblems(site, file) {
  const { full, street } = site.address ?? {};
  return typeof full === "string" && typeof street === "string" && !full.startsWith(street)
    ? [`${file}: address.full must begin with address.street (${quote(street)}), the street line that the structured data and Google Business Profile use`]
    : [];
}
