"use client";

import Link from "next/link";
import { motion } from "motion/react";
import Reveal from "@/components/Reveal";
import { FillBar, FillColumn } from "@/components/motion";
import { Container, SectionHeader } from "@/components/ui";
import { MEASURE, SECTIONS } from "@/lib/content";

const EASE = [0.16, 1, 0.3, 1] as const;

function Dial({ h, m }: { h: number; m: number }) {
  return (
    <svg viewBox="0 0 100 100" className="h-14 w-14" aria-hidden>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#2a2b2e" strokeWidth="2" />
      <line
        x1="50" y1="50" x2={50 + 26 * Math.cos((h - 90) * (Math.PI / 180))}
        y2={50 + 26 * Math.sin((h - 90) * (Math.PI / 180))}
        stroke="#e3dbd8" strokeWidth="3" strokeLinecap="round"
      />
      <line
        x1="50" y1="50" x2={50 + 38 * Math.cos((m - 90) * (Math.PI / 180))}
        y2={50 + 38 * Math.sin((m - 90) * (Math.PI / 180))}
        stroke="#fa6e43" strokeWidth="2.5" strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="3" fill="#fa6e43" />
    </svg>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card/55 p-6 ${className}`}>{children}</div>;
}

export default function Analytics() {
  const w = MEASURE.workflow;
  const conic = w.segments
    .map((s, i) => {
      const from = w.segments.slice(0, i).reduce((n, x) => n + x.value, 0);
      return `${s.color} ${from}% ${from + s.value}%`;
    })
    .join(", ");
  const [assisted, manual] = MEASURE.throughput.legend;

  return (
    <section id="analytics" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader {...SECTIONS.analytics} />

        {/* top row */}
        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_0.85fr_1.15fr]">
          <Reveal as="div">
            <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MEASURE.imageCard.img} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e] via-[#0b0c0e]/30 to-transparent" />
              <span className="absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                <span className="text-flame">{MEASURE.imageCard.accent}</span> {MEASURE.imageCard.label}
              </span>
              <span className="absolute bottom-5 left-5 text-[15px] font-medium text-flame">
                space<span className="text-ink">—</span>gear
              </span>
            </div>
          </Reveal>

          <Reveal as="div" delay={60}>
            <Card className="h-full">
              <h3 className="text-[14px] font-medium text-ink">{w.title}</h3>
              <p className="text-[12px] text-mut-2">{w.sub}</p>
              <div className="mt-5 flex items-center gap-5">
                <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${conic})` }}>
                  <div className="absolute inset-[13px] grid place-items-center rounded-full bg-card">
                    <span className="display text-xl text-ink-strong">{w.center}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {w.segments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-[12px]">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="flex-1 text-mut">{s.label}</span>
                      <span className="text-ink">{s.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal as="div" delay={120}>
            <Card className="h-full">
              <div className="grid grid-cols-3 gap-3">
                {MEASURE.stages.map((c) => (
                  <div key={c.name} className="flex flex-col items-center text-center">
                    <span className="text-[12px] text-ink">{c.name}</span>
                    <span className="font-mono text-[10px] text-mut-3">{c.note}</span>
                    <div className="my-2"><Dial h={c.hands[0]} m={c.hands[1]} /></div>
                    <span className="text-[11px] text-flame">{c.status}</span>
                    <span className="font-mono text-[10px] text-mut-2">{c.detail}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 border-t border-line-soft pt-3">
                <span className="h-1.5 w-1.5 rounded-full bg-flame pulse-dot" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-2">{MEASURE.stagesFooter}</span>
              </div>
            </Card>
          </Reveal>
        </div>

        {/* bottom row */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1.2fr_0.7fr]">
          <Reveal as="div">
            <Card className="flex h-full flex-col">
              <div className="flex flex-1 items-end gap-1.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <FillColumn key={i} value={35 + ((i * 37) % 60)} className="flex-1 rounded-sm bg-flame/80" duration={0.6} delay={i * 0.03} />
                ))}
              </div>
              <p className="mt-4 text-[12px] text-mut-2">{MEASURE.accuracy.label}</p>
              <p className="display mt-1 text-3xl text-ink-strong">
                {MEASURE.accuracy.value}<span className="text-base text-mut-2">{MEASURE.accuracy.unit}</span>
              </p>
              <p className="text-[12px] text-mut-2">{MEASURE.accuracy.sub}</p>
            </Card>
          </Reveal>

          <Reveal as="div" delay={60}>
            <Card className="flex h-full flex-col">
              <h3 className="text-[14px] font-medium text-ink">{MEASURE.throughput.title}</h3>
              <p className="text-[12px] text-mut-2">{MEASURE.throughput.sub}</p>
              <svg viewBox="0 0 200 90" preserveAspectRatio="none" className="mt-3 h-24 w-full" aria-hidden>
                <defs>
                  <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fa6e43" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#fa6e43" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="perfClip">
                    <motion.rect
                      data-fill-svg=""
                      x="0"
                      y="0"
                      height="90"
                      initial={{ width: 0 }}
                      whileInView={{ width: 200 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, ease: EASE }}
                    />
                  </clipPath>
                </defs>
                <g clipPath="url(#perfClip)">
                  <polygon fill="url(#perfFill)" points="0,70 33,55 66,60 100,38 133,42 166,18 200,8 200,90 0,90" />
                  <polyline fill="none" stroke="#5f5f66" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points="0,78 33,72 66,66 100,60 133,55 166,46 200,40" />
                  <polyline fill="none" stroke="#fa6e43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points="0,70 33,55 66,60 100,38 133,42 166,18 200,8" />
                </g>
              </svg>
              <div className="mt-auto flex gap-6 pt-3 text-[12px]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-flame" /> <span className="text-ink">{assisted.value}</span> <span className="text-mut-2">{assisted.label}</span></span>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mut-3" /> <span className="text-ink">{manual.value}</span> <span className="text-mut-2">{manual.label}</span></span>
              </div>
            </Card>
          </Reveal>

          <Reveal as="div" delay={120}>
            <Card className="flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-medium text-ink">{MEASURE.readiness.title}</h3>
                  <p className="text-[12px] text-mut-2">{MEASURE.readiness.sub}</p>
                </div>
                <div className="text-right">
                  <span className="display text-2xl text-flame">{MEASURE.readiness.score}</span>
                  <span className="text-[12px] text-mut-2">/100</span>
                  <p className="text-[10px] text-mut-2">{MEASURE.readiness.scoreLabel}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-1 items-end gap-3">
                {MEASURE.readiness.bars.map((e, i) => (
                  <div key={e.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end rounded-md bg-bg/60">
                      <FillColumn value={e.v} className="w-full rounded-md bg-flame/85" delay={i * 0.08} />
                    </div>
                    <span className="text-[10px] text-ink">{e.v}%</span>
                    <span className="font-mono text-[9px] text-mut-3">{e.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal as="div" delay={180}>
            <div className="flex h-full flex-col gap-4">
              <Card className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-3">{MEASURE.coverage.tag}</span>
                <p className="display mt-2 text-3xl text-ink-strong">{MEASURE.coverage.value}</p>
                <p className="text-[12px] text-mut-2">{MEASURE.coverage.label}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card-3">
                  <FillBar value={MEASURE.coverage.progress} className="h-full rounded-full bg-flame" duration={1} />
                </div>
              </Card>
              <Card className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-3">{MEASURE.connectors.tag}</span>
                <div aria-hidden className="mt-3 flex gap-2">
                  {MEASURE.connectors.glyphs.map((g) => (
                    <span key={g} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">{g}</span>
                  ))}
                </div>
              </Card>
            </div>
          </Reveal>
        </div>

        {/* capabilities marquee */}
        <Reveal delay={120}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card/40 py-4">
            <div className="marquee-track">
              {[...MEASURE.ticker, ...MEASURE.ticker].map((item, i) => (
                <span key={i} aria-hidden={i >= MEASURE.ticker.length} className="mx-4 flex items-center gap-3 text-[14px] text-mut-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-flame" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">{MEASURE.cta.label}</span>
            <Link
              prefetch={false}
              href={MEASURE.cta.href}
              aria-label={MEASURE.cta.label}
              className="grid h-10 w-10 place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-1"
            >
              →
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
