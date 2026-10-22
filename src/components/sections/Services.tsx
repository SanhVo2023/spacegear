"use client";

import Link from "next/link";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import DotField from "@/components/DotField";
import { Container, SectionHeader, FlameButton } from "@/components/ui";
import { CORE_PANEL, PILLARS, SECTIONS } from "@/lib/content";

function CorePanel() {
  return (
    <div className="flex h-full flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
      <div className="flex items-center justify-between border-b border-line-soft pb-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{CORE_PANEL.label}</span>
        <span className="font-mono text-[12px] tracking-[0.2em] text-flame">{CORE_PANEL.count}</span>
      </div>
      <h3 className="display text-[clamp(22px,2.4vw,32px)] text-ink">{CORE_PANEL.title}</h3>
      <p className="text-[13px] leading-relaxed text-mut-2">{CORE_PANEL.text}</p>
      {/* animated dot matrix */}
      <DotField cols={5} rows={5} className="my-2 gap-y-5 px-1" />
      <div className="mt-auto flex items-center gap-3">
        <span aria-hidden className="grid h-6 w-6 place-items-center rounded bg-card-3 text-flame">⠿</span>
        <span className="text-[13px] font-medium text-ink">{CORE_PANEL.line}</span>
      </div>
      <FlameButton href={CORE_PANEL.href} className="w-full">{CORE_PANEL.cta}</FlameButton>
    </div>
  );
}

export default function Services() {
  const [active, setActive] = useState(0);

  return (
    <section id="services" className="relative scroll-mt-2 py-24">
      <div className="pointer-events-none absolute right-0 top-20 h-[420px] w-[420px] flame-glow opacity-40 blur-sm" />
      <Container className="relative">
        <SectionHeader {...SECTIONS.services} />

        {/* Desktop: horizontal accordion — opens on hover (original) and on keyboard focus */}
        <Reveal delay={100}>
          <div className="mt-12 hidden gap-3 lg:flex lg:h-[520px]">
            <div className="flex flex-1 gap-3">
              {PILLARS.map((s, i) => {
                const isActive = i === active;
                return (
                  <Link
                    prefetch={false}
                    key={s.no}
                    href={`/services/${s.slug}/`}
                    data-cursor="Open"
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isActive ? "flex-[2.6] border-flame bg-flame" : "flex-[0.8] border-line bg-card/50 hover:bg-card-2"
                    }`}
                  >
                    {/* top row: arrow + number */}
                    <div className="flex items-center gap-3 p-5">
                      <span aria-hidden className={`text-lg ${isActive ? "text-[#161719]" : "text-mut-2"}`}>{isActive ? "↗" : "↓"}</span>
                      <span className={`display text-3xl ${isActive ? "text-[#161719]" : "text-mut-3"}`}>{s.no}</span>
                    </div>

                    {/* active content */}
                    <div data-hover-reveal="" className={`px-5 transition-opacity duration-300 ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                      <h3 className="text-xl font-medium text-[#161719]">{s.name}</h3>
                      <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[#5a2a17]">{s.desc}</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.img} alt="" loading="lazy" decoding="async" className="mt-5 h-48 w-full max-w-sm rounded-xl object-cover" />
                    </div>

                    {/* bottom tag */}
                    <div className="absolute bottom-5 left-5">
                      <div aria-hidden className={`text-lg ${isActive ? "text-[#161719]" : "text-mut-3"}`}>
                        {isActive && <span className="block">{s.glyph}</span>}
                      </div>
                      <span className={`mt-1 block text-[13px] ${isActive ? "font-medium text-[#161719]" : "text-mut-2"}`}>{s.tag}</span>
                    </div>
                  </Link>
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
          {PILLARS.map((s, i) => (
            <Reveal as="div" key={s.no} delay={60 + i * 50}>
              <Link prefetch={false} href={`/services/${s.slug}/`} className="block rounded-2xl border border-line bg-card/50 p-5">
                <div className="flex items-center justify-between">
                  <span className="display text-2xl text-flame">{s.no}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{s.tag}</span>
                </div>
                <h3 className="mt-3 text-lg font-medium text-ink">{s.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-mut-2">{s.desc}</p>
              </Link>
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
