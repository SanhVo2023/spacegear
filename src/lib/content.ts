/** Shared content for the landing cards and their detail pages. */

export type Article = {
  slug: string;
  author: string;
  date: string;
  title: string;
  sub: string;
  img: string;
  body: string[];
};

export const ARTICLES: Article[] = [
  {
    slug: "ethical-ai-systems",
    author: "Bruce Sommers",
    date: "Monday, April 28, 2025",
    title: "Ethical AI Systems for Scalable Products",
    sub: "Why responsible AI isn’t optional in high-growth tech",
    img: "/images/labs/ethical-ai.webp",
    body: [
      "As infrastructure learns to make its own decisions, the question stops being “can it scale?” and becomes “should it?”. Responsible AI is no longer a compliance checkbox — it is a design constraint that shapes every layer of a modern platform.",
      "We bake fairness, transparency, and reversibility into the core of every automated decision. Models explain themselves, actions are auditable, and a human can always step back in. That discipline is what lets teams move fast without losing trust.",
      "The result is a system that grows responsibly: one that earns the confidence of customers, regulators, and the engineers who maintain it long after launch day.",
    ],
  },
  {
    slug: "zero-latency-infrastructure",
    author: "Leon Hartmann",
    date: "Wednesday, April 2, 2025",
    title: "Zero-Latency Infrastructure for Real-Time AI",
    sub: "Speed isn’t a feature — it’s the foundation of AI-based systems",
    img: "/images/labs/zero-latency.webp",
    body: [
      "Real-time AI lives or dies on milliseconds. When inference sits in the critical path of a user action, every hop, queue, and cold start is felt directly.",
      "We push compute to the edge, keep models warm, and route requests along the shortest viable path — continuously, automatically, as traffic shifts around the globe.",
      "Zero-latency isn’t a destination; it’s a posture. The platform is always tuning itself toward it.",
    ],
  },
  {
    slug: "observability-made-simple",
    author: "Rafael Noor",
    date: "Wednesday, March 5, 2025",
    title: "Automated Infrastructure Observability Made Simple",
    sub: "Why automation and observability should always go together",
    img: "/images/labs/observability.webp",
    body: [
      "You cannot automate what you cannot see. Observability and automation are two halves of the same loop: the system watches itself, then acts on what it learns.",
      "Metrics, traces, and logs feed a model of healthy behaviour. Drift from that model triggers a response before a human ever opens a dashboard.",
      "The payoff is calm operations — fewer pages, faster recovery, and a system that explains exactly what it did and why.",
    ],
  },
  {
    slug: "process-automation-small-teams",
    author: "Marius Ortega",
    date: "Sunday, March 2, 2025",
    title: "AI-Powered Process Automation for Small Teams",
    sub: "How small teams can do more with intelligent workflows",
    img: "/images/labs/process-automation.webp",
    body: [
      "Small teams win by refusing to do work a machine can do better. Intelligent workflows turn repetitive operations into background processes that simply happen.",
      "From provisioning to scaling to incident response, the platform handles the busywork so a handful of people can operate like a department.",
      "Leverage, not headcount, is how lean teams outpace much larger ones.",
    ],
  },
];

export type Product = {
  slug: string;
  name: string;
  tagline: string;
  img: string;
  gallery: string[];
  features: string[];
  specs: { label: string; value: string }[];
};

export const PRODUCTS: Product[] = [
  {
    slug: "neural-core",
    name: "Neural Core",
    tagline:
      "Transform how your infrastructure thinks and evolves — AI-driven automation with intelligent scaling in one self-evolving system.",
    img: "/images/suite/neural-core.webp",
    gallery: [
      "/images/suite/neural-core.webp",
      "/images/suite/neural-net.webp",
      "/images/suite/shield-core.webp",
    ],
    features: [
      "Self-learning decision engine",
      "Millisecond inference at the edge",
      "Adaptive scaling under load",
      "Continuous self-optimization",
    ],
    specs: [
      { label: "Latency", value: "3 ms" },
      { label: "Uptime", value: "99.9%" },
      { label: "Model", value: "Gemini 2.5 Pro" },
      { label: "Release", value: "4.0b" },
    ],
  },
  {
    slug: "design-engine",
    name: "Design Engine",
    tagline:
      "An automated infrastructure architect that designs and adapts your perfect environment.",
    img: "/images/suite/design-engine.webp",
    gallery: ["/images/suite/design-engine.webp", "/images/suite/scale-matrix.webp"],
    features: [
      "Best-practice environment provisioning",
      "Topology-aware configuration",
      "Drift detection & repair",
      "One-connection setup",
    ],
    specs: [
      { label: "Setup", value: "30 s" },
      { label: "Templates", value: "120+" },
      { label: "Clouds", value: "Multi" },
      { label: "Mode", value: "Automated" },
    ],
  },
  {
    slug: "scale-matrix",
    name: "Scale Matrix",
    tagline:
      "An intelligent scaling system that grows and optimizes automatically with demand.",
    img: "/images/suite/scale-matrix.webp",
    gallery: ["/images/suite/scale-matrix.webp", "/images/suite/neural-net.webp"],
    features: [
      "Predictive autoscaling",
      "Cost-aware capacity planning",
      "Zero-downtime resizing",
      "Global load distribution",
    ],
    specs: [
      { label: "Scale", value: "8/8" },
      { label: "Savings", value: "47%" },
      { label: "Regions", value: "Global" },
      { label: "Mode", value: "Predictive" },
    ],
  },
  {
    slug: "neural-net",
    name: "Neural Net",
    tagline: "A self-learning core that makes smart decisions in milliseconds.",
    img: "/images/suite/neural-net.webp",
    gallery: ["/images/suite/neural-net.webp", "/images/suite/shield-core.webp"],
    features: [
      "Online learning loop",
      "Anomaly detection",
      "Explainable decisions",
      "Hardware-accelerated inference",
    ],
    specs: [
      { label: "Inference", value: "< 5 ms" },
      { label: "Accuracy", value: "99.6%" },
      { label: "Learning", value: "Online" },
      { label: "Mode", value: "Adaptive" },
    ],
  },
  {
    slug: "shield-core",
    name: "Shield Core",
    tagline: "A proactive security system that evolves with every new threat.",
    img: "/images/suite/shield-core.webp",
    gallery: ["/images/suite/shield-core.webp", "/images/suite/design-engine.webp"],
    features: [
      "Adaptive 24/7 threat detection",
      "Per-layer defense",
      "Automated response",
      "Private hosting options",
    ],
    specs: [
      { label: "Detection", value: "10 s" },
      { label: "Coverage", value: "24/7" },
      { label: "Layers", value: "All" },
      { label: "Mode", value: "Proactive" },
    ],
  },
];

export type Service = {
  no: string;
  slug: string;
  name: string;
  tag: string;
  glyph: string;
  img: string;
  desc: string;
  long: string;
  bullets: string[];
};

export const SERVICES: Service[] = [
  {
    no: "01",
    slug: "neural-network",
    name: "Neural Network",
    tag: "learning",
    glyph: "≈",
    img: "/images/suite/neural-net.webp",
    desc: "A self-learning intelligence core that observes, learns, and makes smart decisions in milliseconds to optimize your operations.",
    long: "Our learning layer turns telemetry into action. It models your stack’s healthy behaviour, then makes thousands of small optimizations per minute — quietly keeping performance high and cost low.",
    bullets: [
      "Continuous online learning",
      "Millisecond decisioning",
      "Self-tuning performance",
      "Explainable actions",
    ],
  },
  {
    no: "02",
    slug: "design-intelligence",
    name: "Design Intelligence",
    tag: "architecture",
    glyph: "◇",
    img: "/images/suite/design-engine.webp",
    desc: "Automated architecture that designs, adapts, and provisions the perfect environment for every workload.",
    long: "Describe intent; the platform designs the architecture. It provisions best-practice environments, adapts topology to workloads, and repairs drift before it becomes an incident.",
    bullets: [
      "Intent-based provisioning",
      "Best-practice templates",
      "Drift detection & repair",
      "Multi-cloud aware",
    ],
  },
  {
    no: "03",
    slug: "security-ai",
    name: "Security AI",
    tag: "protection",
    glyph: "◈",
    img: "/images/suite/shield-core.webp",
    desc: "A proactive defense layer that evolves with new threats and guards every layer of your stack, 24/7.",
    long: "Security that learns. It watches every layer, recognizes new attack patterns as they emerge, and neutralizes threats automatically — long before they reach you.",
    bullets: [
      "Adaptive threat detection",
      "Per-layer defense",
      "Automated response",
      "Continuous evolution",
    ],
  },
  {
    no: "04",
    slug: "smart-scale",
    name: "Smart Scale",
    tag: "growth",
    glyph: "△",
    img: "/images/suite/scale-matrix.webp",
    desc: "Intelligent scaling that grows and optimizes automatically, so capacity always matches demand.",
    long: "Capacity that anticipates. Predictive autoscaling reads demand before it spikes, resizes without downtime, and balances load across regions — all while keeping spend in check.",
    bullets: [
      "Predictive autoscaling",
      "Cost-aware planning",
      "Zero-downtime resizing",
      "Global distribution",
    ],
  },
];
