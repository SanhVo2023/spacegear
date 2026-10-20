"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader } from "@/components/ui";

const REVIEWS = [
  {
    img: "/images/reviews/r1.webp",
    name: "Maya Chen",
    role: "VP Engineering",
    company: "Altrix",
    quote:
      "Platform was always a step ahead — from edge strategy to responsible AI. They brought clarity, speed, and long-term thinking to every part of our build.",
  },
  {
    img: "/images/reviews/r2.webp",
    name: "Daniel Koenig",
    role: "Director of Systems",
    company: "Vanta",
    quote:
      "From the first call to final handoff, the team showed deep expertise in AI infrastructure. We moved off clunky legacy systems to a real-time architecture in weeks.",
  },
  {
    img: "/images/reviews/r3.webp",
    name: "Henrik Vogt",
    role: "Operation Director",
    company: "Northwind",
    quote:
      "We cut our response times by more than half and stopped firefighting. The platform tunes itself so my team can finally build instead of babysit servers.",
  },
  {
    img: "/images/reviews/r4.webp",
    name: "Sofia Marenko",
    role: "Head of Platform",
    company: "Lumen",
    quote:
      "The automation is genuinely intelligent. It catches issues before they page anyone, and it explains exactly what it did. That trust changed how we operate.",
  },
  {
    img: "/images/reviews/r5.webp",
    name: "Tomás Vidal",
    role: "CTO",
    company: "Hexa",
    quote:
      "Scaling used to mean a war room. Now capacity just matches demand and our cloud bill dropped 40%. It feels like cheating, in the best way.",
  },
  {
    img: "/images/reviews/r6.webp",
    name: "Amara Idris",
    role: "Lead SRE",
    company: "Cobalt",
    quote:
      "Observability and automation in one loop is the thing I always wanted and never had time to build. Platform shipped it, and our on-call got quiet.",
  },
  {
    img: "/images/reviews/r7.webp",
    name: "Felix Bauer",
    role: "Founder",
    company: "Driftwave",
    quote:
      "As a tiny team, leverage is everything. Platform lets four of us operate like forty without ever touching infrastructure plumbing.",
  },
];

export default function Testimonials() {
  const [i, setI] = useState(0);
  const r = REVIEWS[i];
  const go = (d: number) => setI((p) => (p + d + REVIEWS.length) % REVIEWS.length);

  return (
    <section id="testimonials" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader
          title="What Our Clients Say"
          index="008"
          heading="Trusted by teams, startups, and enterprises that value speed and simplicity."
          description="Real stories from people who use Platform daily – why they chose it, and how it changed their businesses."
        />

        <Reveal delay={100}>
          <div className="mt-12 overflow-hidden rounded-3xl border border-line bg-card/40">
            {/* featured quote */}
            <div className="grid lg:grid-cols-[300px_1fr_120px]">
              {/* portrait — swipe to change review */}
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(1);
                  else if (info.offset.x > 60) go(-1);
                }}
                className="relative order-first h-72 cursor-grab touch-pan-y overflow-hidden bg-[#0d0e10] active:cursor-grabbing lg:h-auto lg:cursor-default lg:border-r lg:border-line-soft"
              >
                <AnimatePresence mode="popLayout">
                  <motion.img
                    key={i}
                    src={r.img}
                    alt={r.name}
                    draggable={false}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover grayscale"
                  />
                </AnimatePresence>
                <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/60 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mut-2 backdrop-blur lg:hidden">
                  ‹ swipe ›
                </span>
              </motion.div>

              {/* quote */}
              <div className="flex flex-col justify-between p-8">
                <span className="display text-5xl leading-none text-flame">“</span>
                <AnimatePresence mode="wait">
                  <motion.blockquote
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-4 max-w-xl text-[clamp(16px,1.6vw,21px)] italic leading-relaxed text-ink"
                  >
                    {r.quote}
                  </motion.blockquote>
                </AnimatePresence>
                <div className="mt-8 flex items-end justify-between border-t border-line-soft pt-6">
                  <div>
                    <p className="display text-xl text-ink">{r.name}</p>
                    <p className="text-[12px] text-mut-3">{r.role}</p>
                  </div>
                  <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-mut-2">
                    {r.company}
                  </span>
                </div>
              </div>

              {/* arrows (desktop) */}
              <div className="hidden flex-col items-center justify-center gap-4 border-l border-line-soft lg:flex">
                <button
                  onClick={() => go(-1)}
                  aria-label="Previous"
                  className="grid h-10 w-10 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame"
                >
                  ←
                </button>
                <button
                  onClick={() => go(1)}
                  aria-label="Next"
                  className="grid h-10 w-10 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame"
                >
                  →
                </button>
              </div>
            </div>

            {/* reviews strip */}
            <div className="flex items-center gap-3 border-t border-line-soft px-5 py-4">
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-mut-3 sm:block">
                Reviews
              </span>
              <div className="flex items-center gap-1.5">
                {REVIEWS.map((_, k) => (
                  <span
                    key={k}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      k === i ? "w-5 bg-flame" : "w-1.5 bg-mut-3/50"
                    }`}
                  />
                ))}
              </div>
              {/* mobile arrows */}
              <div className="ml-auto flex gap-2 lg:hidden">
                <button onClick={() => go(-1)} aria-label="Previous" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">←</button>
                <button onClick={() => go(1)} aria-label="Next" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">→</button>
              </div>
            </div>

            {/* avatar thumbnails */}
            <div className="scrollbar-none flex gap-2 overflow-x-auto border-t border-line-soft p-3">
              {REVIEWS.map((rv, k) => (
                <button
                  key={k}
                  onClick={() => setI(k)}
                  aria-label={`Show ${rv.name}`}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition-all duration-300 ${
                    k === i
                      ? "border-flame ring-1 ring-flame"
                      : "border-line opacity-60 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={rv.img}
                    alt={rv.name}
                    className={`h-full w-full object-cover ${k === i ? "" : "grayscale"}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">Read more success stories</span>
            <a
              href="#"
              className="grid h-10 w-10 place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-1"
            >
              →
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
