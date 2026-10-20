"use client";

import { motion } from "motion/react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader } from "@/components/ui";

const HEALTH = [
  { label: "Optimal", value: 66, color: "#fa6e43" },
  { label: "Stable", value: 25, color: "#888891" },
  { label: "Issues", value: 9, color: "#434346" },
];

const CITIES = [
  { city: "Amsterdam", tz: "UTC +1", status: "Enhanced", latency: "24ms → 11ms", t: [300, 65] },
  { city: "New York", tz: "UTC -4", status: "Optimized", latency: "37ms → 19ms", t: [210, 150] },
  { city: "Dubai", tz: "UTC +6", status: "Scaling", latency: "In Progress", t: [120, 20] },
];

const EVOLUTION = [
  { label: "Integration", v: 38 },
  { label: "Efficiency", v: 79 },
  { label: "Security", v: 92 },
  { label: "Scaling", v: 84 },
  { label: "Uptime", v: 98 },
];

const ACHIEVEMENTS = [
  "10M+ Active Users",
  "500K+ Deployments",
  "1B+ API Calls",
  "1.2B+ Daily Requests",
  "Featured in TechCrunch",
  "AWS Partnership Announced",
  "200+ Enterprise Clients",
  "47% Cost Reduction",
];

const EASE = [0.16, 1, 0.3, 1] as const;

function Clock({ h, m }: { h: number; m: number }) {
  return (
    <svg viewBox="0 0 100 100" className="h-14 w-14">
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
  return (
    <div className={`rounded-2xl border border-line bg-card/55 p-6 ${className}`}>
      {children}
    </div>
  );
}

export default function Analytics() {
  return (
    <section id="analytics" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader
          title="Smart Analytics"
          index="004"
          heading="Monitor performance with actionable data insights."
          description="Real-time metrics that help you make better decisions, faster."
        />

        {/* top row */}
        <div className="mt-12 grid gap-4 lg:grid-cols-[1.25fr_0.85fr_1.15fr]">
          {/* AI card */}
          <Reveal as="div">
            <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/suite/shield-core.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e] via-[#0b0c0e]/30 to-transparent" />
              <span className="absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                <span className="text-flame">AI</span> Powered Analytics
              </span>
              <span className="absolute bottom-5 left-5 text-[15px] font-medium text-flame">
                plat<span className="text-ink">—</span>form
              </span>
            </div>
          </Reveal>

          {/* System Health donut */}
          <Reveal as="div" delay={60}>
            <Card className="h-full">
              <h3 className="text-[14px] font-medium text-ink">System Health</h3>
              <p className="text-[12px] text-mut-3">Real-time platform vitals</p>
              <div className="mt-5 flex items-center gap-5">
                <div
                  className="relative h-28 w-28 shrink-0 rounded-full"
                  style={{ background: "conic-gradient(#fa6e43 0 66%, #888891 66% 91%, #434346 91% 100%)" }}
                >
                  <div className="absolute inset-[13px] grid place-items-center rounded-full bg-card">
                    <span className="display text-xl text-ink-strong">66%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {HEALTH.map((h) => (
                    <div key={h.label} className="flex items-center gap-2 text-[12px]">
                      <span className="h-2 w-2 rounded-full" style={{ background: h.color }} />
                      <span className="flex-1 text-mut">{h.label}</span>
                      <span className="text-ink">{h.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>

          {/* Global status — clocks */}
          <Reveal as="div" delay={120}>
            <Card className="h-full">
              <div className="grid grid-cols-3 gap-3">
                {CITIES.map((c) => (
                  <div key={c.city} className="flex flex-col items-center text-center">
                    <span className="text-[12px] text-ink">{c.city}</span>
                    <span className="font-mono text-[10px] text-mut-3">{c.tz}</span>
                    <div className="my-2">
                      <Clock h={c.t[0]} m={c.t[1]} />
                    </div>
                    <span className="text-[11px] text-flame">{c.status}</span>
                    <span className="font-mono text-[10px] text-mut-2">{c.latency}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 border-t border-line-soft pt-3">
                <span className="h-1.5 w-1.5 rounded-full bg-flame pulse-dot" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-2">
                  Response Time Optimization
                </span>
              </div>
            </Card>
          </Reveal>
        </div>

        {/* bottom row */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr_0.7fr]">
          {/* 30-day monitoring bars */}
          <Reveal as="div">
            <Card className="flex h-full flex-col">
              <div className="flex flex-1 items-end gap-1.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="flex-1 rounded-sm bg-flame/80"
                    initial={{ height: 0 }}
                    whileInView={{ height: `${35 + ((i * 37) % 60)}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: EASE, delay: i * 0.03 }}
                  />
                ))}
              </div>
              <p className="mt-4 text-[12px] text-mut-3">30-day monitoring</p>
              <p className="display mt-1 text-3xl text-ink-strong">
                97.8<span className="text-base text-mut-2">%</span>
              </p>
              <p className="text-[12px] text-mut-3">Uptime</p>
            </Card>
          </Reveal>

          {/* Performance line chart */}
          <Reveal as="div" delay={60}>
            <Card className="flex h-full flex-col">
              <h3 className="text-[14px] font-medium text-ink">Performance</h3>
              <p className="text-[12px] text-mut-3">Current performance metrics</p>
              <svg
                viewBox="0 0 200 90"
                preserveAspectRatio="none"
                className="mt-3 h-24 w-full"
              >
                <defs>
                  <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fa6e43" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#fa6e43" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="perfClip">
                    <motion.rect
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
                  <polygon
                    fill="url(#perfFill)"
                    points="0,70 33,55 66,60 100,38 133,42 166,18 200,8 200,90 0,90"
                  />
                  <polyline
                    fill="none"
                    stroke="#5f5f66"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    points="0,78 33,72 66,66 100,60 133,55 166,46 200,40"
                  />
                  <polyline
                    fill="none"
                    stroke="#fa6e43"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points="0,70 33,55 66,60 100,38 133,42 166,18 200,8"
                  />
                </g>
              </svg>
              <div className="mt-auto flex gap-6 pt-3 text-[12px]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-flame" /> <span className="text-ink">97%</span> <span className="text-mut-3">Optimized</span></span>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mut-3" /> <span className="text-ink">51%</span> <span className="text-mut-3">Standard</span></span>
              </div>
            </Card>
          </Reveal>

          {/* System Evolution bars */}
          <Reveal as="div" delay={120}>
            <Card className="flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-medium text-ink">System Evolution</h3>
                  <p className="text-[12px] text-mut-3">The pulse of progress</p>
                </div>
                <div className="text-right">
                  <span className="display text-2xl text-flame">86</span>
                  <span className="text-[12px] text-mut-3">/100</span>
                  <p className="text-[10px] text-mut-3">Evolution Score</p>
                </div>
              </div>
              <div className="mt-4 flex flex-1 items-end gap-3">
                {EVOLUTION.map((e, i) => (
                  <div key={e.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end rounded-md bg-bg/60">
                      <motion.div
                        className="w-full rounded-md bg-flame/85"
                        initial={{ height: 0 }}
                        whileInView={{ height: `${e.v}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: EASE, delay: i * 0.08 }}
                      />
                    </div>
                    <span className="text-[10px] text-ink">{e.v}%</span>
                    <span className="font-mono text-[9px] text-mut-3">{e.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          {/* Core capacity + integration */}
          <Reveal as="div" delay={180}>
            <div className="flex h-full flex-col gap-4">
              <Card className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-3">
                  Gemini 2.5 Pro
                </span>
                <p className="display mt-2 text-3xl text-ink-strong">99.6%</p>
                <p className="text-[12px] text-mut-3">Core Capacity</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card-3">
                  <motion.div
                    className="h-full rounded-full bg-flame"
                    initial={{ width: 0 }}
                    whileInView={{ width: "99.6%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: EASE }}
                  />
                </div>
              </Card>
              <Card className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-3">
                  Integration Partners
                </span>
                <div className="mt-3 flex gap-2">
                  {["◇", "◎", "△", "⬡"].map((g, i) => (
                    <span key={i} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">
                      {g}
                    </span>
                  ))}
                </div>
              </Card>
            </div>
          </Reveal>
        </div>

        {/* achievements marquee */}
        <Reveal delay={120}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card/40 py-4">
            <div className="marquee-track">
              {[...ACHIEVEMENTS, ...ACHIEVEMENTS].map((a, i) => (
                <span key={i} className="mx-4 flex items-center gap-3 text-[14px] text-mut-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-flame" />
                  {a}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">Explore more statistics</span>
            <a href="#" className="grid h-10 w-10 place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-1">
              →
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
