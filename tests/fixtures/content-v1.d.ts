// Emitted by tsc from the pre-CMS src/lib/content.ts. Reference types for src/lib/content-contract.ts; never regenerate.
export type Service = {
    slug: string;
    name: string;
    shortName: string;
    summary: string;
    buyerProblem: string;
    deliverables: string[];
    process: string[];
    faqs: {
        question: string;
        answer: string;
    }[];
    relatedInsightSlugs: string[];
    image: string;
    category: string;
};
export declare const SERVICES: Service[];
export type Engagement = {
    name: string;
    short: string;
    img: string;
    stage: string;
    stageNo: string;
    deliverables: string[];
    outcomes: string[];
    featured: boolean;
};
export declare const ENGAGEMENTS: Engagement[];
export declare const ENGAGEMENTS_FOOTER: {
    text: string;
    href: string;
};
export declare const FAQS: {
    question: string;
    answer: string;
}[];
export declare const INSIGHTS: {
    slug: string;
    title: string;
    published: boolean;
}[];
export declare const CASE_STUDIES: {
    slug: string;
    title: string;
    published: boolean;
    approved: boolean;
}[];
export declare function serviceBySlug(slug: string): Service;
export type Stat = {
    value: string;
    unit: string;
    label: string;
    sub: string;
};
export declare const HOME: {
    eyebrow: {
        muted: string;
        strong: string;
    };
    headline: {
        lead: string;
        verbs: string[];
        tail: string;
    };
    pitch: {
        title: string;
        text: string;
    };
    cta: {
        label: string;
        href: string;
    };
    stats: Stat[];
    corner: {
        title: string;
        sub: string;
        href: string;
    };
    scrollHint: string;
    statement: string;
};
export type SectionCopy = {
    title: string;
    index: string;
    heading: string;
    description: string;
};
export declare const SECTIONS: {
    work: {
        title: string;
        index: string;
        heading: string;
        description: string;
    };
    services: {
        title: string;
        index: string;
        heading: string;
        description: string;
    };
    process: {
        title: string;
        index: string;
        heading: string;
        description: string;
    };
    analytics: {
        title: string;
        index: string;
        heading: string;
        description: string;
    };
    pricing: {
        title: string;
        index: string;
        heading: string;
        description: string;
    };
    faq: {
        title: string;
        index: string;
        heading: string;
        description: string;
    };
    team: {
        title: string;
        index: string;
        heading: string;
        description: string;
    };
    testimonials: {
        title: string;
        index: string;
        heading: string;
        description: string;
    };
    labs: {
        title: string;
        index: string;
        heading: string;
        description: string;
    };
};
export type WorkTile = {
    slug: string;
    name: string;
    img: string;
    desc: string;
    href: string;
};
export declare const WORK: {
    featured: {
        label: string;
        name: string;
        img: string;
        href: string;
    };
    lineup: {
        label: string;
        count: string;
        title: string;
        text: string;
        footer: string;
    };
    tiles: WorkTile[];
    assessment: {
        title: string;
        badge: string;
        note: string;
        chip: string;
        value: string;
        unit: string;
        progress: number;
        cta: string;
        href: string;
    };
};
export type Pillar = {
    no: string;
    slug: string;
    name: string;
    tag: string;
    glyph: string;
    img: string;
    desc: string;
};
export declare const PILLARS: Pillar[];
export declare const CORE_PANEL: {
    label: string;
    count: string;
    title: string;
    text: string;
    line: string;
    cta: string;
    href: string;
};
export type ProcessStep = {
    step: string;
    name?: string;
    desc: string;
    outputs: string[];
};
export declare const PROCESS_STEPS: ProcessStep[];
export declare const PROCESS_CTA: {
    title: string;
    text: string;
    cta: string;
    href: string;
};
export declare const APPROACH_STEPS: ProcessStep[];
export declare const MEASURE: {
    illustrative: boolean;
    imageCard: {
        img: string;
        accent: string;
        label: string;
    };
    workflow: {
        title: string;
        sub: string;
        center: string;
        segments: {
            label: string;
            value: number;
            color: string;
        }[];
    };
    stages: {
        name: string;
        note: string;
        status: string;
        detail: string;
        hands: number[];
    }[];
    stagesFooter: string;
    accuracy: {
        label: string;
        value: string;
        unit: string;
        sub: string;
    };
    throughput: {
        title: string;
        sub: string;
        legend: {
            value: string;
            label: string;
        }[];
    };
    readiness: {
        title: string;
        sub: string;
        score: string;
        scoreLabel: string;
        bars: {
            label: string;
            v: number;
        }[];
    };
    coverage: {
        tag: string;
        value: string;
        label: string;
        progress: number;
    };
    connectors: {
        tag: string;
        glyphs: string[];
    };
    ticker: string[];
    cta: {
        label: string;
        href: string;
    };
};
export declare const FAQ_CARD: {
    title: string;
    text: string;
    cta: string;
    href: string;
    img: string;
    imgAlt: string;
    badge: string;
};
export type Person = {
    name: string;
    role: string;
    img: string;
    imgAlt: string;
    bio: string;
    links: {
        label: string;
        href: string;
    }[];
};
export declare const FOUNDER: Person | null;
export declare const TEAM: {
    label: string;
    cta: {
        label: string;
        href: string;
    };
};
export declare const TEAM_ROLES: Person[];
export type Testimonial = {
    img: string;
    name: string;
    role: string;
    company: string;
    quote: string;
    permissionConfirmed: true;
};
export declare const TESTIMONIALS: Testimonial[];
export type Article = {
    slug: string;
    author: string;
    title: string;
    sub: string;
    img: string;
    href: string;
};
export declare const ARTICLES: Article[];
export type FooterLink = {
    label: string;
    href: string;
};
export declare const FOOTER: {
    badge: string;
    tagline: string;
    identity: string[];
    identityStrong: string;
    columns: FooterLink[][];
    quickStart: {
        title: string;
        text: string;
        note: string;
    };
    about: string;
};
