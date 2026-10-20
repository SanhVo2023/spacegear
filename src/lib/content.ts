export type Service = {
  slug: string; name: string; shortName: string; summary: string; buyerProblem: string;
  deliverables: string[]; process: string[]; faqs: { question: string; answer: string }[];
  relatedInsightSlugs: string[]; image: string; category: string;
};
export const SERVICES: Service[] = [
  {
    slug: "digital-transformation", name: "Digital Transformation Strategy", shortName: "Digital transformation",
    category: "Direction", image: "/images/suite/design-engine.webp",
    summary: "Find the friction. Set the priorities. Create a practical path from the way you work today to what comes next.",
    buyerProblem: "Digital change gets difficult when tools, processes and priorities move in different directions. We start with how work actually happens, then connect the business goals to decisions you can act on.",
    deliverables: ["A map of your current workflows and systems", "A prioritized opportunity shortlist", "An implementation roadmap with owners and dependencies", "Success criteria and a practical first initiative"],
    process: ["Understand the business challenge and current workflow.", "Compare improvement options, effort and dependencies.", "Agree the roadmap and the first measurable step."],
    faqs: [
      { question: "Do we need a transformation plan already?", answer: "No. Bring the problem you want to solve. We can start with discovery and help you decide what should change first." },
      { question: "Does transformation mean replacing everything?", answer: "No. The assessment considers what to keep, connect, improve or replace. A useful change may be a focused workflow improvement." }
    ], relatedInsightSlugs: []
  },
  {
    slug: "ai-strategy", name: "AI Strategy & Enablement", shortName: "AI strategy",
    category: "Direction", image: "/images/suite/neural-core.webp",
    summary: "Move from AI interest to an informed decision about where it can help, what it needs and how to begin.",
    buyerProblem: "A promising demonstration is not yet a business case. We connect potential AI use cases to available data, operational constraints and a clear way to evaluate whether the solution is useful.",
    deliverables: ["AI opportunity and readiness assessment", "Prioritized use cases and data requirements", "Evaluation criteria, risks and human review points", "A pilot plan and an enablement approach"],
    process: ["Explore decisions, tasks and information flows.", "Compare AI options against simpler alternatives.", "Define a pilot, evaluation process and adoption plan."],
    faqs: [
      { question: "What if our data is not ready?", answer: "That is a useful starting point. We identify the data and process work needed before an AI pilot can be evaluated responsibly." },
      { question: "Will you recommend AI for every problem?", answer: "No. Rules, better integration or a simpler workflow may be more appropriate. The recommendation follows the problem." }
    ], relatedInsightSlugs: []
  },
  {
    slug: "applied-ai", name: "Applied AI & Deep Learning", shortName: "Applied AI",
    category: "Delivery", image: "/images/suite/neural-net.webp",
    summary: "Turn data and unstructured information into useful software, with evaluation and human oversight built in.",
    buyerProblem: "Documents, images and operational data can contain useful information that is difficult to use consistently. We build and evaluate AI systems around a specific workflow, including the cases where a person needs to take over.",
    deliverables: ["A baseline and evaluation dataset", "A prototype for document intelligence, retrieval, forecasting or vision", "An integrated implementation with human review", "Monitoring, limitations and operating documentation"],
    process: ["Define the task, constraints and quality threshold.", "Compare approaches against a measurable baseline.", "Integrate, evaluate and prepare the system for operation."],
    faqs: [
      { question: "When is deep learning appropriate?", answer: "It can help with complex patterns in text, images or other data, when enough suitable data and evaluation capacity exist. We compare it with simpler methods before choosing an approach." },
      { question: "How do you handle incorrect outputs?", answer: "Use-case design includes evaluation, quality checks where appropriate, human review, and a clear path for exceptions. No model is treated as infallible." }
    ], relatedInsightSlugs: []
  },
  {
    slug: "automation-integration", name: "Automation & Systems Integration", shortName: "Automation & integration",
    category: "Connection", image: "/images/suite/scale-matrix.webp",
    summary: "Connect the tools you use and reduce repeated manual work, while keeping exceptions and control visible.",
    buyerProblem: "Copying information between disconnected tools consumes attention and introduces avoidable errors. We redesign the workflow, connect systems and make the handoffs easier to understand and manage.",
    deliverables: ["A redesigned workflow and integration map", "API connections and automated handoffs", "Exception handling and human approval steps", "Operational visibility and maintenance documentation"],
    process: ["Map the repeated work and its exceptions.", "Connect systems with explicit rules and ownership.", "Test the full workflow and prepare the handover."],
    faqs: [
      { question: "Can you work with our existing tools?", answer: "We assess their APIs, access controls and integration options first. Existing systems are part of the starting point, not an automatic reason to replace them." },
      { question: "What happens when an automated step fails?", answer: "The design includes error handling, safe retry behavior and a way for someone to review exceptions. These paths are tested alongside successful runs." }
    ], relatedInsightSlugs: []
  },
  {
    slug: "product-delivery", name: "Digital Product & Platform Delivery", shortName: "Product delivery",
    category: "Delivery", image: "/images/suite/shield-core.webp",
    summary: "Carry an idea through discovery, design and engineering into software people can use and improve.",
    buyerProblem: "A strategy becomes useful when it reaches a working system. We connect product decisions, user experience and implementation, with explicit scope, acceptance criteria and a plan for rollout.",
    deliverables: ["A defined problem, scope and user journey", "Product design and technical architecture", "A tested implementation and rollout plan", "Handover, documentation and an improvement backlog"],
    process: ["Define the users, problem and first useful release.", "Design and build in reviewable increments.", "Test, release and support adoption."],
    faqs: [
      { question: "Can we start with an existing project?", answer: "Yes. We can review the current product, code or delivery plan and discuss the work needed to move it forward." },
      { question: "Who owns the delivered work?", answer: "Ownership, access, licensing and handover are agreed in the engagement scope before work starts. The website does not substitute for that agreement." }
    ], relatedInsightSlugs: []
  }
];
export type Engagement = {
  name: string; short: string; label: string; description: string; img: string;
  stage: string; stageNo: string; deliverables: string[]; outcomes: string[]; featured: boolean;
};
export const ENGAGEMENTS: Engagement[] = [
  {
    name: "Assess & prioritize", short: "Assess", label: "Find the right starting point",
    description: "A Transformation Opportunity Assessment turns one business challenge into a clear set of options and a practical next step.",
    img: "/images/suite/design-engine.webp", stage: "Direction", stageNo: "01",
    deliverables: ["Current workflow and opportunity map", "Data and integration requirements", "Success criteria", "Recommended first pilot"],
    outcomes: ["A shared view of the problem", "Clear, agreed priorities", "Known data gaps", "A practical first step"],
    featured: true,
  },
  {
    name: "Validate & build", short: "Build", label: "Make it work",
    description: "Test the important assumptions, then design and deliver a solution around the way your business operates.",
    img: "/images/suite/shield-core.webp", stage: "Delivery", stageNo: "02",
    deliverables: ["Prototype and evaluation criteria", "Integrated, tested implementation", "Rollout plan", "Handover documentation"],
    outcomes: ["Evidence before larger investment", "A solution that fits the workflow", "Fewer manual handoffs", "A team ready to use it"],
    featured: false,
  },
  {
    name: "Embed & improve", short: "Improve", label: "Put it into daily use",
    description: "Support adoption, understand what happens in practice and improve the system as needs evolve.",
    img: "/images/suite/scale-matrix.webp", stage: "Adoption", stageNo: "03",
    deliverables: ["Adoption and operating guidance", "Performance and exception review", "Prioritized improvements", "Ongoing delivery support"],
    outcomes: ["Steady day-to-day use", "Fewer exceptions over time", "Visible performance", "A clear improvement backlog"],
    featured: false,
  },
];
export const ENGAGEMENTS_FOOTER = { text: "Not sure where to start? Tell us what you want to improve", href: "/contact/" };
export const USE_CASES = [
  { title: "Too much repeated work?", text: "Connect tools and automate the handoffs that keep pulling people away from useful work.", service: "automation-integration", image: "/images/suite/scale-matrix.webp" },
  { title: "Data that is hard to use?", text: "Make documents and disconnected information easier to find, understand and act on.", service: "applied-ai", image: "/images/suite/neural-net.webp" },
  { title: "Ideas stuck before delivery?", text: "Turn a promising direction into a clear scope, a tested solution and a practical rollout.", service: "product-delivery", image: "/images/suite/design-engine.webp" }
];
export const FAQS = [
  { question: "What does spacegear.tech do?", answer: "We help organizations change how work gets done: deciding where digital change and AI will help, building the systems, and supporting your team as they put them to use." },
  { question: "Where do we start?", answer: "Tell us what you would like to improve. If the next step is unclear, an Opportunity Assessment can map the workflow, identify options and recommend a first initiative. If you already have a brief, we can discuss delivery directly." },
  { question: "Do you work with our existing systems?", answer: "Yes. We start by understanding what is already in place. The right answer may be to improve a process, connect tools or extend a system, rather than replace everything." },
  { question: "Do we need our data ready before talking?", answer: "No. Understanding data quality, access and readiness can be part of the first engagement. You can start with the business problem." },
  { question: "How are AI solutions evaluated?", answer: "We agree what useful performance means, compare against a baseline and test relevant examples and exceptions. Human review and operating limits are designed around the use case." },
  { question: "How are scope and pricing agreed?", answer: "We discuss the objectives, constraints and deliverables first, then agree the scope and commercial terms. There are no software subscription tiers or fixed packages on this site." },
  { question: "Can you help after the first release?", answer: "Continuing improvement can include adoption, monitoring, exception review and further delivery. The level of support and responsibilities are agreed for the engagement." },
  { question: "Who do you work with?", answer: "Organizations of any size, industry or region. What matters is a real challenge you want to improve, not a sector or company-size requirement." },
];
export const INSIGHTS: { slug: string; title: string; published: boolean }[] = [];
export const CASE_STUDIES: { slug: string; title: string; published: boolean; approved: boolean }[] = [];

// ---------------------------------------------------------------------------
// Section content shaped to the original platform-clone layouts.
// Honesty rules (tests/content.test.mjs): no invented clients, staff, prices,
// timelines, offices, press or results. Illustrative figures are labelled
// where they render. See docs/superpowers/specs/2026-10-20-spacegear-fidelity-design.md.
// ---------------------------------------------------------------------------

export function serviceBySlug(slug: string): Service {
  const service = SERVICES.find((item) => item.slug === slug);
  if (!service) throw new Error(`Unknown service: ${slug}`);
  return service;
}

export type Stat = { value: string; unit: string; label: string; sub: string };
export const HOME = {
  eyebrow: { muted: "You bring the challenge,", strong: "we build the system." },
  headline: { lead: "The smarter way to", verbs: ["plan", "build", "scale"], tail: "your business." },
  pitch: { title: "Start with one challenge", text: "Tell us what you want to improve." },
  cta: { label: "Discuss a project", href: "/contact/" },
  stats: [
    { value: "05", unit: "", label: "Core services", sub: "From strategy to delivery" },
    { value: "03", unit: "", label: "Delivery stages", sub: "Direction to daily use" },
  ] as Stat[],
  corner: { title: "Applied AI & Deep Learning", sub: "// Featured service", href: "/services/applied-ai/" },
  scrollHint: "Scroll to explore ↓",
  statement: "We turn business challenges into working digital systems your team can use.",
};

export type SectionCopy = { title: string; index: string; heading: string; description: string };
export const SECTIONS = {
  work: { title: "What We Do", index: "001", heading: "Strategy and delivery under one roof, built to help you move faster with less friction.", description: "Each engagement starts with a real problem and aims to leave your team with something it can use." },
  services: { title: "Our Services", index: "002", heading: "Flexible services for modernizing operations and putting AI to work.", description: "Five capabilities that work on their own or together." },
  process: { title: "Our Process", index: "003", heading: "A clear path from the first conversation to daily use.", description: "Every stage produces something you can review and use." },
  analytics: { title: "What We Measure", index: "004", heading: "Know whether a change is working, with evidence you can act on.", description: "An illustrative example of the measures we agree before building — not client results." },
  pricing: { title: "Engagements", index: "005", heading: "Clear ways to work together. Scoped around your objectives.", description: "Start with one challenge or a defined project. Scope and terms are agreed before work begins." },
  faq: { title: "Questions & Answers", index: "006", heading: "Simple explanations to help you decide where to start.", description: "You don’t need every answer before starting a conversation." },
  team: { title: "Who You Work With", index: "007", heading: "The disciplines behind the work. Strategists, engineers and problem-solvers.", description: "You work directly with the people doing the thinking and the building." },
  testimonials: { title: "What Our Clients Say", index: "008", heading: "Stories from organizations we have worked with.", description: "Published with each client’s permission." },
  labs: { title: "Spacegear Labs", index: "009", heading: "Practical notes on transformation, AI and the systems behind everyday work.", description: "Explainers and field notes from our work." },
} satisfies Record<string, SectionCopy>;

export type WorkTile = { slug: string; name: string; img: string; desc: string; href: string };
function workTile(slug: string, name: string, img: string, desc: string): WorkTile {
  serviceBySlug(slug);
  return { slug, name, img, desc, href: `/services/${slug}/` };
}
export const WORK = {
  featured: { label: "Featured Service", name: "Applied AI", img: "/images/suite/neural-core.webp", href: "/services/applied-ai/" },
  lineup: {
    label: "Service Lineup", count: "5/5", title: "Strategy and Delivery Under One Roof",
    text: "Digital transformation, AI strategy, applied AI, automation and product delivery, connected from the first decision to daily use.",
    footer: "From direction to daily use",
  },
  tiles: [
    workTile("digital-transformation", "Digital Transformation", "/images/suite/design-engine.webp", "Find the friction, set priorities and plan a practical path forward."),
    workTile("automation-integration", "Automation & Integration", "/images/suite/scale-matrix.webp", "Connect your tools and remove repeated manual work."),
    workTile("ai-strategy", "AI Strategy", "/images/suite/neural-net.webp", "Decide where AI can help, what it needs and how to begin."),
    workTile("product-delivery", "Product Delivery", "/images/suite/shield-core.webp", "Carry an idea from discovery to software people use."),
  ],
  assessment: {
    title: "Opportunity Assessment", badge: "01/03", note: "The recommended first step.", chip: "Engagement stage",
    value: "01", unit: "/03", progress: 33.3, cta: "Start with an assessment", href: "/contact/",
  },
};

export type Pillar = { no: string; slug: string; name: string; tag: string; glyph: string; img: string; desc: string };
export const PILLARS: Pillar[] = [
  { no: "01", slug: "digital-transformation", name: "Digital Transformation", tag: "direction", glyph: "≈", img: "/images/suite/design-engine.webp", desc: serviceBySlug("digital-transformation").summary },
  { no: "02", slug: "ai-strategy", name: "AI Strategy", tag: "readiness", glyph: "◇", img: "/images/suite/neural-core.webp", desc: serviceBySlug("ai-strategy").summary },
  { no: "03", slug: "applied-ai", name: "Applied AI", tag: "intelligence", glyph: "◈", img: "/images/suite/neural-net.webp", desc: serviceBySlug("applied-ai").summary },
  { no: "04", slug: "automation-integration", name: "Automation", tag: "connection", glyph: "△", img: "/images/suite/scale-matrix.webp", desc: serviceBySlug("automation-integration").summary },
  { no: "05", slug: "product-delivery", name: "Product Delivery", tag: "delivery", glyph: "⬡", img: "/images/suite/shield-core.webp", desc: serviceBySlug("product-delivery").summary },
];
export const CORE_PANEL = {
  label: "Core Services", count: "5/5", title: "Modular, flexible services for modern digital operations",
  text: "We help you modernize how work gets done and put AI to practical use. spacegear.tech’s core capabilities include:",
  line: "Plan, build, connect and improve.", cta: "Explore Services in Depth", href: "/services/",
};

export type ProcessStep = { step: string; name?: string; desc: string; outputs: string[] };
export const PROCESS_STEPS: ProcessStep[] = [
  { step: "Step 1", name: "Assess", desc: "We map the current workflow, systems, constraints and people involved, and agree the problem before choosing a solution.", outputs: ["Current-state map", "Problem definition"] },
  { step: "Step 2", name: "Prioritize", desc: "We compare opportunities by value, feasibility and dependencies, then agree a baseline and what success means.", outputs: ["Opportunity shortlist", "Success criteria", "Roadmap"] },
  { step: "Step 3", name: "Build", desc: "We test the riskiest assumptions first, then design and engineer in reviewable increments around the real workflow.", outputs: ["Evaluated prototype", "Tested implementation"] },
  { step: "Step 4", name: "Adopt", desc: "We support rollout and handover, document how the system runs, and agree how to measure and improve it.", outputs: ["Rollout plan", "Operating guide", "Improvement backlog"] },
];
export const PROCESS_CTA = { title: "Want to see how this applies to your work?", text: "Questions about our process? We’re happy to talk it through.", cta: "Discuss a project", href: "/contact/" };
export const APPROACH_STEPS: ProcessStep[] = [
  { step: "Stage 1", name: "Assess", desc: "Understand the work. Map the current workflow, systems, constraints and people involved. Agree the problem before choosing a solution.", outputs: ["Current-state map", "Problem definition"] },
  { step: "Stage 2", name: "Prioritize", desc: "Choose a useful next step. Compare opportunities by value, feasibility and dependencies. Agree a baseline and what success would mean.", outputs: ["Opportunity shortlist", "Delivery roadmap"] },
  { step: "Stage 3", name: "Validate", desc: "Test the important assumptions with a prototype or a focused pilot, compare results with a baseline and decide what deserves further investment.", outputs: ["Evaluation evidence", "Go/no-go decision"] },
  { step: "Stage 4", name: "Deliver", desc: "Build around the real workflow. Design and engineer in reviewable increments, and test integrations, exceptions and the user experience before rollout.", outputs: ["Tested implementation", "Rollout plan"] },
  { step: "Stage 5", name: "Adopt", desc: "Prepare for everyday use. Document operation and ownership, support the handover and agree how to measure and improve the system.", outputs: ["Operating guidance", "Improvement backlog"] },
];

// Illustrative dashboard: the kind of measures agreed for a document workflow.
// Rendered under SECTIONS.analytics, whose description says "not client results".
export const MEASURE = {
  illustrative: true,
  imageCard: { img: "/images/suite/shield-core.webp", accent: "Illustrative", label: "Example" },
  workflow: {
    title: "Document Workflow", sub: "Sample run · illustrative", center: "62%",
    segments: [
      { label: "Auto-processed", value: 62, color: "#fa6e43" },
      { label: "Human review", value: 29, color: "#888891" },
      { label: "Exceptions", value: 9, color: "#434346" },
    ],
  },
  stages: [
    { name: "Intake", note: "Step 01", status: "Automated", detail: "12m → 2m", hands: [300, 65] },
    { name: "Extraction", note: "Step 02", status: "Assisted", detail: "9m → 3m", hands: [210, 150] },
    { name: "Review", note: "Step 03", status: "Human-led", detail: "Kept in control", hands: [120, 20] },
  ],
  stagesFooter: "Time per case · illustrative",
  accuracy: { label: "Accuracy vs. baseline", value: "94.6", unit: "%", sub: "Example target" },
  throughput: { title: "Cases Handled", sub: "Assisted vs. manual · example", legend: [{ value: "+68%", label: "Assisted" }, { value: "Base", label: "Manual" }] },
  readiness: {
    title: "Rollout Readiness", sub: "Where a pilot might stand · example", score: "82", scoreLabel: "Readiness score",
    bars: [{ label: "Data", v: 38 }, { label: "Integration", v: 79 }, { label: "Review", v: 92 }, { label: "Training", v: 84 }, { label: "Monitoring", v: 96 }],
  },
  coverage: { tag: "Example evaluation set", value: "99.1%", label: "Test-case coverage", progress: 99.1 },
  connectors: { tag: "Connects with your stack", glyphs: ["◇", "◎", "△", "⬡"] },
  ticker: ["Workflow mapping", "Data readiness review", "AI evaluation", "Human-in-the-loop review", "Systems integration", "Rollout & training", "Monitoring & improvement", "Product delivery"],
  cta: { label: "See how we evaluate AI", href: "/services/applied-ai/" },
};

export const FAQ_CARD = {
  title: "You still have questions?",
  text: "Every organization’s situation is different. Tell us what you’re working on and we’ll suggest a sensible next step. No finished brief required.",
  cta: "Let’s have a chat", href: "/contact/",
  img: "/images/faq-team.webp", imgAlt: "People discussing a project around a table",
  badge: "we build the systems · you lead the change ·",
};

export type Person = { name: string; role: string; img: string; imgAlt: string; bio: string; links: { label: string; href: string }[] };
// Add the founder's real name, photo (public/images/people/), role, bio and
// profile links here when the owner supplies them; the card then leads the carousel.
export const FOUNDER: Person | null = null;
export const TEAM = { label: "How we work with you", cta: { label: "More about how we work", href: "/about/" } };
export const TEAM_ROLES: Person[] = [
  { name: "Strategy & Discovery", role: "Direction", img: "/images/suite/design-engine.webp", imgAlt: "", links: [], bio: "We start with how work actually happens, mapping workflows, systems and constraints so the first recommendation is grounded in your reality." },
  { name: "AI & Data Engineering", role: "Applied AI", img: "/images/suite/neural-net.webp", imgAlt: "", links: [], bio: "We evaluate AI against simpler alternatives, build with a measurable baseline and design the points where a person stays in control." },
  { name: "Product & Delivery", role: "Build", img: "/images/suite/shield-core.webp", imgAlt: "", links: [], bio: "We turn decisions into working software in reviewable increments, with explicit scope, acceptance criteria and a rollout plan." },
  { name: "Integration & Automation", role: "Connect", img: "/images/suite/scale-matrix.webp", imgAlt: "", links: [], bio: "We connect the tools you already use and remove repeated manual work, keeping exceptions visible and handoffs clear." },
  { name: "Adoption & Support", role: "Improve", img: "/images/suite/neural-core.webp", imgAlt: "", links: [], bio: "We prepare the handover, support everyday use and keep improving the system as your needs change." },
];

// Render only real, permission-confirmed quotes and published articles.
export type Testimonial = { img: string; name: string; role: string; company: string; quote: string; permissionConfirmed: true };
export const TESTIMONIALS: Testimonial[] = [];
export type Article = { slug: string; author: string; title: string; sub: string; img: string; href: string };
export const ARTICLES: Article[] = [];

export type FooterLink = { label: string; href: string };
export const FOOTER = {
  badge: "we build the systems · you lead the change ·",
  tagline: "The smarter way to plan, build and scale your business.",
  identity: ["Digital transformation", "& AI consulting"],
  identityStrong: "spacegear.tech",
  columns: [
    [
      { label: "Home", href: "/" }, { label: "What We Do", href: "/#work" }, { label: "Services", href: "/services/" },
      { label: "Process", href: "/#process" }, { label: "What We Measure", href: "/#analytics" }, { label: "Engagements", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" }, { label: "Who You Work With", href: "/#team" },
    ],
    [
      { label: "Approach", href: "/approach/" }, { label: "About", href: "/about/" }, { label: "Contact", href: "/contact/" },
      { label: "Applied AI", href: "/services/applied-ai/" }, { label: "Automation", href: "/services/automation-integration/" },
      { label: "Product Delivery", href: "/services/product-delivery/" }, { label: "Privacy", href: "/privacy/" }, { label: "Terms", href: "/terms/" },
    ],
  ] as FooterLink[][],
  quickStart: { title: "Start with one challenge", text: "Leave your name and email and we’ll take you to a short brief.", note: "We only use these details to respond to you." },
  about: "helps organizations turn business challenges into working digital systems.",
};
