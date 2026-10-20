"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import DotField from "@/components/DotField";
import { Container, SectionHeader, FlameButton } from "@/components/ui";

const SERVICES = [
  {
    no: "01",
    name: "Neural Network",
    tag: "learning",
    glyph: "≈",
    img: "/images/suite/neural-net.webp",
    desc: "A self-learning intelligence core that observes, learns, and makes smart decisions in milliseconds to optimize your operations.",
  },
  {
    no: "02",
    name: "Design Intelligence",
    tag: "architecture",
    glyph: "◇",
    img: "/images/suite/design-engine.webp",
    desc: "Automated architecture that designs, adapts, and provisions the perfect environment for every workload.",
  },
  {
    no: "03",
    name: "Security AI",
    tag: "protection",
    glyph: "◈",
    img: "/images/suite/shield-core.webp",
    desc: "A proactive defense layer that evolves with new threats and guards every layer of your stack, 24/7.",
  },
  {
    no: "04",
    name: "Smart Scale",
    tag: "growth",
    glyph: "△",
    img: "/images/suite/scale-matrix.webp",
    desc: "Intelligent scaling that grows and optimizes automatically, so capacity always matches demand.",
  },
];

function CorePanel() {
  return (
    <div className="flex h-full flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
      <div className="flex items-center justify-between border-b border-line-soft pb-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
          Core Services
        </span>
        <span className="font-mono text-[12px] tracking-[0.2em] text-flame">
          4/4
        </span>
      </div>
      <h3 className="display text-[clamp(22px,2.4vw,32px)] text-ink">
        Modular, flexible solutions for modern digital infrastructure
      </h3>
      <p className="text-[13px] leading-relaxed text-mut-2">
        We create future-proof systems that scale seamlessly and adapt to your
        business needs. Platform’s key capabilities include:
      </p>
      {/* animated dot matrix */}
      <DotField cols={5} rows={5} className="my-2 gap-y-5 px-1" />
      <div className="mt-auto flex items-center gap-3">
        <span className="grid h-6 w-6 place-items-center rounded bg-card-3 text-flame">
          ⠿
        </span>
        <span className="text-[13px] font-medium text-ink">
          Design, optimize, scale, and secure.
        </span>
      </div>
      <FlameButton href="/services" className="w-full">
        Explore Services in Depth
      </FlameButton>
    </div>
  );
}

export default function Services() {
  const [active, setActive] = useState(0);

  return (
    <section id="services" className="relative scroll-mt-24 py-24">
      <div className="pointer-events-none absolute right-0 top-20 h-[420px] w-[420px] flame-glow opacity-40 blur-sm" />
      <Container className="relative">
        <SectionHeader
          title="Our Services"
          index="002"
          heading="Flexible solutions for building modern digital infrastructure."
          description="Future-proof systems that scale seamlessly and adapt to your needs."
        />

        {/* Desktop: horizontal accordion */}
        <Reveal delay={100}>
          <div className="mt-12 hidden gap-3 lg:flex lg:h-[520px]">
            <div className="flex flex-1 gap-3">
              {SERVICES.map((s, i) => {
                const isActive = i === active;
                return (
                  <div
                    key={s.no}
                    onMouseEnter={() => setActive(i)}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isActive
                        ? "flex-[2.6] border-flame bg-flame"
                        : "flex-[0.8] border-line bg-card/50 hover:bg-card-2"
                    }`}
                  >
                    {/* top row: arrow + number */}
                    <div className="flex items-center gap-3 p-5">
                      <span
                        className={`text-lg ${
                          isActive ? "text-[#161719]" : "text-mut-2"
                        }`}
                      >
                        {isActive ? "↗" : "↓"}
                      </span>
                      <span
                        className={`display text-3xl ${
                          isActive ? "text-[#161719]" : "text-mut-3"
                        }`}
                      >
                        {s.no}
                      </span>
                    </div>

                    {/* active content */}
                    <div
                      className={`px-5 transition-opacity duration-300 ${
                        isActive ? "opacity-100" : "pointer-events-none opacity-0"
                      }`}
                    >
                      <h3 className="text-xl font-medium text-[#161719]">
                        {s.name}
                      </h3>
                      <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[#5a2a17]">
                        {s.desc}
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.img}
                        alt={s.name}
                        className="mt-5 h-48 w-full max-w-sm rounded-xl object-cover"
                      />
                    </div>

                    {/* bottom tag */}
                    <div className="absolute bottom-5 left-5">
                      <div
                        className={`text-lg ${
                          isActive ? "text-[#161719]" : "text-mut-3"
                        }`}
                      >
                        {isActive && <span className="block">{s.glyph}</span>}
                      </div>
                      <span
                        className={`mt-1 block text-[13px] ${
                          isActive ? "font-medium text-[#161719]" : "text-mut-2"
                        }`}
                      >
                        {s.tag}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="w-[34%]">
              <CorePanel />
            </div>
          </div>
        </Reveal>

        {/* Mobile: stacked list */}
        <div className="mt-10 space-y-3 lg:hidden">
          {SERVICES.map((s, i) => (
            <Reveal as="div" key={s.no} delay={60 + i * 50}>
              <div className="rounded-2xl border border-line bg-card/50 p-5">
                <div className="flex items-center justify-between">
                  <span className="display text-2xl text-flame">{s.no}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">
                    {s.tag}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-medium text-ink">{s.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-mut-2">
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
          <Reveal as="div" delay={300}>
            <CorePanel />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
