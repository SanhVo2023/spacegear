"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Appear, AppearGroup, AppearItem } from "@/components/motion";
import { Container, ArrowButton } from "@/components/ui";
import ScrollColorTitle from "@/components/ScrollColorTitle";
import StackCards from "@/components/StackCards";
import DotField from "@/components/DotField";

const CARDS = [
  {
    slug: "design-engine",
    name: "Design Engine",
    img: "/images/suite/design-engine.webp",
    desc: "Automated infrastructure architect that designs and adapts your perfect environment.",
  },
  {
    slug: "scale-matrix",
    name: "Scale Matrix",
    img: "/images/suite/scale-matrix.webp",
    desc: "Intelligent scaling system that grows and optimizes automatically with demand.",
  },
  {
    slug: "neural-net",
    name: "Neural Net",
    img: "/images/suite/neural-net.webp",
    desc: "Self-learning core that makes smart decisions in milliseconds.",
  },
  {
    slug: "shield-core",
    name: "Shield Core",
    img: "/images/suite/shield-core.webp",
    desc: "Proactive security system that evolves with every new threat.",
  },
];

/** small animated drag-handle dots, top-right of each tile */
function GridDots() {
  return (
    <span className="grid grid-cols-3 gap-[3px] opacity-50 transition-opacity duration-300 group-hover:opacity-100">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

function ArrowBtn() {
  return <ArrowButton />;
}

/** Product tile with hover-revealed description + image zoom. */
function Tile({
  name,
  img,
  desc,
  slug,
}: {
  name: string;
  img: string;
  desc: string;
  slug: string;
}) {
  return (
    <Link
      href={`/work/${slug}`}
      className="group relative block h-full overflow-hidden rounded-2xl border border-line"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img}
        alt={name}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-110"
      />
      {/* base gradient (legibility); a touch stronger on mobile where the desc is always shown */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f] via-[#0c0d0f]/30 to-transparent lg:via-transparent" />
      <div className="absolute inset-0 bg-[#0b0c0e]/0 transition-colors duration-500 group-hover:bg-[#0b0c0e]/65" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_70%_15%,rgba(250,110,67,0.22),transparent_72%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex h-full flex-col justify-between p-5 text-ink">
        <div className="flex items-start justify-between">
          <h3 className="text-[15px] font-medium drop-shadow">{name}</h3>
          <GridDots />
        </div>
        <div>
          {/* visible on mobile, hover-revealed on desktop */}
          <p className="mb-3 max-w-[24ch] text-[12.5px] leading-relaxed text-mut-2 transition-all duration-[400ms] ease-out lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
            {desc}
          </p>
          <ArrowBtn />
        </div>
      </div>
    </Link>
  );
}

export default function Work() {
  return (
    <section id="work" className="relative py-24">
      <Container>
        {/* header */}
        <ScrollColorTitle title="Our Work" />

        <Appear delay={0.05}>
          <div className="mt-8 grid gap-6 border-t border-line-soft pt-8 lg:grid-cols-[200px_1fr_240px]">
            <div className="font-mono text-[11px] leading-relaxed text-mut-3">
              <span className="text-mut">001</span>
              <br />
              plat<span className="text-flame">—</span>form
            </div>
            <h3 className="display max-w-md text-[clamp(22px,2.6vw,34px)] text-ink">
              Designed with purpose, automated for speed and built to help you
              move faster, with less friction.
            </h3>
            <p className="text-[12px] leading-relaxed text-mut-3">
              Every solution is designed to solve real problems, delivering
              practical value over mere aesthetics.
            </p>
          </div>
        </Appear>

        {/* bento (desktop) */}
        <AppearGroup
          className="mt-10 hidden auto-rows-[200px] gap-4 lg:grid lg:grid-cols-3 lg:[grid-auto-rows:200px]"
          stagger={0.07}
        >
          {/* Featured Neural Core — spans 2 cols, 2 rows */}
          <AppearItem className="sm:col-span-2 sm:row-span-2">
            <Link
              href="/work/neural-core"
              className="group relative block h-full min-h-[260px] overflow-hidden rounded-2xl border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/suite/neural-core.webp"
                alt="Neural Core"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/80 via-transparent to-[#0c0d0f]/40" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
                      Featured Product
                    </span>
                    <h3 className="display mt-1 text-2xl text-ink-strong">
                      Neural Core
                    </h3>
                  </div>
                  <GridDots />
                </div>
                <ArrowBtn />
              </div>
            </Link>
          </AppearItem>

          {/* Platform Suite orange panel — spans 2 rows */}
          <AppearItem className="sm:row-span-2">
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-flame p-6 text-[#161719]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_80%_10%,rgba(255,255,255,0.18),transparent_60%)]" />
              <div className="relative">
                <div className="flex items-center justify-between border-b border-[#161719]/20 pb-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
                    Product Lineup
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.2em]">4/8</span>
                </div>
                <h3 className="display mt-5 text-2xl leading-tight">
                  Platform Suite Neural-Powered Infrastructure
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[#5a2a17]">
                  A complete system of smart products that transform how
                  infrastructure thinks, learns, and evolves.
                </p>
              </div>
              {/* flowing dot matrix */}
              <DotField
                cols={6}
                rows={5}
                color="#161719"
                className="relative my-4 gap-y-3.5"
              />
              <div className="relative flex items-center gap-2 border-t border-[#161719]/20 pt-3">
                <span className="text-base">◉</span>
                <span className="text-[13px] font-medium">
                  Neural intelligence inside
                </span>
              </div>
            </div>
          </AppearItem>

          {/* product cards row */}
          {CARDS.slice(0, 3).map((c) => (
            <AppearItem key={c.name} className="h-full">
              <Tile {...c} />
            </AppearItem>
          ))}

          {/* Shield Core */}
          <AppearItem className="h-full">
            <Tile {...CARDS[3]} />
          </AppearItem>

          {/* animated neural placeholder */}
          <AppearItem className="hidden h-full sm:block">
            <div className="relative grid h-full place-items-center overflow-hidden rounded-2xl border border-line bg-card/40">
              <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(250,110,67,0.08),transparent_70%)]" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
                className="grid grid-cols-3 gap-2.5"
              >
                {Array.from({ length: 9 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="h-2 w-2 rounded-[3px] bg-flame/70"
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.12 }}
                  />
                ))}
              </motion.div>
            </div>
          </AppearItem>

          {/* Neural Core 4.0b beta */}
          <AppearItem className="h-full">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-line bg-card p-6">
              <div>
                <h3 className="display text-xl text-ink-strong">
                  Neural Core <span className="text-mut-2">4.0b</span>
                </h3>
                <p className="mt-1 text-[13px] text-flame">
                  Early beta access now available.
                </p>
                <div className="mt-4">
                  <span className="inline-block rounded-md bg-card-3 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-mut-2">
                    Development Progress
                  </span>
                  <p className="display mt-2 text-3xl text-mut">
                    84.7<span className="text-base text-mut-3">%</span>
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-3">
                    <motion.div
                      className="h-full rounded-full bg-flame"
                      initial={{ width: 0 }}
                      whileInView={{ width: "84.7%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ink">Join early beta</span>
                <ArrowBtn />
              </div>
            </div>
          </AppearItem>
        </AppearGroup>

        {/* mobile: curtain card-stack — Neural Core → products → Product Lineup,
            each card freezes while the next slides over */}
        <div className="mt-10 lg:hidden">
          <StackCards top={88} step={14} gap={64}>
            {/* Featured Neural Core */}
            <Link
              href="/work/neural-core"
              className="group relative block h-[46vh] overflow-hidden rounded-2xl border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/suite/neural-core.webp"
                alt="Neural Core"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/85 via-transparent to-[#0c0d0f]/30" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
                      Featured Product
                    </span>
                    <h3 className="display mt-1 text-2xl text-ink-strong">
                      Neural Core
                    </h3>
                  </div>
                  <GridDots />
                </div>
                <ArrowBtn />
              </div>
            </Link>

            {/* products */}
            {CARDS.map((c) => (
              <div key={c.slug} className="h-[46vh]">
                <Tile {...c} />
              </div>
            ))}

            {/* Platform Suite / Product Lineup */}
            <div className="flex h-[46vh] flex-col justify-between overflow-hidden rounded-2xl bg-flame p-6 text-[#161719]">
              <div>
                <div className="flex items-center justify-between border-b border-[#161719]/20 pb-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
                    Product Lineup
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.2em]">4/8</span>
                </div>
                <h3 className="display mt-4 text-2xl leading-tight">
                  Platform Suite Neural-Powered Infrastructure
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[#5a2a17]">
                  A complete system of smart products that transform how
                  infrastructure thinks, learns, and evolves.
                </p>
              </div>
              <DotField cols={6} rows={3} color="#161719" className="gap-y-3" />
              <div className="flex items-center gap-2 border-t border-[#161719]/20 pt-3">
                <span className="text-base">◉</span>
                <span className="text-[13px] font-medium">
                  Neural intelligence inside
                </span>
              </div>
            </div>
          </StackCards>

          {/* Beta card */}
          <div className="mt-4 rounded-2xl border border-line bg-card p-6">
            <h3 className="display text-xl text-ink-strong">
              Neural Core <span className="text-mut-2">4.0b</span>
            </h3>
            <p className="mt-1 text-[13px] text-flame">
              Early beta access now available.
            </p>
            <p className="display mt-3 text-3xl text-mut">
              84.7<span className="text-base text-mut-3">%</span>
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-3">
              <motion.div
                className="h-full rounded-full bg-flame"
                initial={{ width: 0 }}
                whileInView={{ width: "84.7%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
