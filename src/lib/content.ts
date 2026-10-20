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
export const ENGAGEMENTS = [
  { name: "Assess & prioritize", label: "Find the right starting point", description: "A Transformation Opportunity Assessment turns one business challenge into a clear set of options and a practical next step.", deliverables: ["Current workflow and opportunity map", "Data and integration requirements", "Recommended first pilot"], featured: true },
  { name: "Validate & build", label: "Make it work", description: "Test the important assumptions, then design and deliver a solution around the way your business operates.", deliverables: ["Prototype and evaluation criteria", "Integrated, tested implementation", "Rollout and handover"], featured: false },
  { name: "Embed & improve", label: "Put it into daily use", description: "Support adoption, understand what happens in practice and improve the system as needs evolve.", deliverables: ["Adoption and operating guidance", "Performance and exception review", "Prioritized improvements"], featured: false }
];
export const USE_CASES = [
  { title: "Too much repeated work?", text: "Connect tools and automate the handoffs that keep pulling people away from useful work.", service: "automation-integration", image: "/images/suite/scale-matrix.webp" },
  { title: "Data that is hard to use?", text: "Make documents and disconnected information easier to find, understand and act on.", service: "applied-ai", image: "/images/suite/neural-net.webp" },
  { title: "Ideas stuck before delivery?", text: "Turn a promising direction into a clear scope, a tested solution and a practical rollout.", service: "product-delivery", image: "/images/suite/design-engine.webp" }
];
export const FAQS = [
  { question: "Where do we start?", answer: "Tell us what you would like to improve. If the next step is unclear, an Opportunity Assessment can map the workflow, identify options and recommend a first initiative. If you already have a brief, we can discuss delivery directly." },
  { question: "Do you work with our existing systems?", answer: "Yes. We start by understanding what is already in place. The right answer may be to improve a process, connect tools or extend a system, rather than replace everything." },
  { question: "Do we need our data ready before talking?", answer: "No. Understanding data quality, access and readiness can be part of the first engagement. You can start with the business problem." },
  { question: "How are AI solutions evaluated?", answer: "We agree what useful performance means, compare against a baseline and test relevant examples and exceptions. Human review and operating limits are designed around the use case." },
  { question: "How are scope and pricing agreed?", answer: "We discuss the objectives, constraints and deliverables first, then agree the scope and commercial terms. There are no software subscription tiers or fixed packages on this site." },
  { question: "Can you help after the first release?", answer: "Continuing improvement can include adoption, monitoring, exception review and further delivery. The level of support and responsibilities are agreed for the engagement." }
];
export const INSIGHTS: { slug: string; title: string; published: boolean }[] = [];
export const CASE_STUDIES: { slug: string; title: string; published: boolean; approved: boolean }[] = [];
