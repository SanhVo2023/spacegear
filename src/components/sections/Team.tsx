"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader } from "@/components/ui";

const MEMBERS = [
  {
    name: "Sarah Bennett",
    role: "Director of Engineering",
    img: "/images/team/sarah.webp",
    bio: "As Director of Engineering, I lead the teams that build the intelligent systems of tomorrow. We architect robust, scalable infrastructure that harnesses AI to solve complex challenges and unlock new opportunities for growth.",
  },
  {
    name: "Tygo Brouwer",
    role: "Chief Data Scientist",
    img: "/images/team/tygo.webp",
    bio: "As Chief Data Scientist, I focus on building robust, scalable systems that turn raw signal into reliable intelligence — from model design to production pipelines that stay fast and trustworthy as they grow.",
  },
  {
    name: "Philip van der Bosch",
    role: "Founder & Head of Operations",
    img: "/images/team/philip.webp",
    bio: "As Head of Operations, I drive our mission of pioneering AI-powered infrastructure, turning complexity into clarity and staying hands-on from vision to delivery so we keep every promise.",
  },
  {
    name: "Maya Okafor",
    role: "Head of Product",
    img: "/images/team/maya.webp",
    bio: "As Head of Product, I translate hard infrastructure problems into experiences teams actually love to use, keeping us honest about the outcomes that matter most to our customers.",
  },
  {
    name: "Daniel Reyes",
    role: "Principal Infrastructure Engineer",
    img: "/images/team/daniel.webp",
    bio: "As Principal Infrastructure Engineer, I obsess over the systems beneath the systems — resilient, observable, and fast by default, even at planet scale.",
  },
];

const SOCIALS = ["in", "𝕏", "◎", "✆"];

export default function Team() {
  const [i, setI] = useState(0);
  const m = MEMBERS[i];
  const go = (d: number) => setI((p) => (p + d + MEMBERS.length) % MEMBERS.length);

  return (
    <section id="team" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader
          title="Meet the Team"
          index="007"
          heading="Get to know the team behind the work. Makers, thinkers, and problem-solvers."
          description="We shape Platform every day, focusing on clear decisions and getting things done right."
        />

        <Reveal delay={100}>
          <div className="mt-12 overflow-hidden rounded-3xl border border-line bg-card/40">
            <div className="grid lg:grid-cols-[1fr_400px_92px]">
              {/* LEFT: header + name/role + bio */}
              <div className="flex flex-col border-b border-line-soft lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-line-soft px-7 py-5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
                    Team Platform
                  </span>
                  <div className="flex items-center gap-1.5">
                    {MEMBERS.map((_, k) => (
                      <span
                        key={k}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          k === i ? "w-5 bg-flame" : "w-1.5 bg-mut-3/50"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-7">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`h${i}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <h3 className="display text-[clamp(24px,2.4vw,34px)] text-ink">
                        {m.name}
                      </h3>
                      <p className="mt-1 text-[13px] text-flame">{m.role}</p>
                    </motion.div>
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`b${i}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                      className="mt-10 max-w-md text-[13px] leading-relaxed text-mut-2"
                    >
                      {m.bio}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* CENTER: portrait — swipe to change member; fixed 3:4 cell shows full head-and-shoulders */}
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(1);
                  else if (info.offset.x > 60) go(-1);
                }}
                className="relative order-first h-[480px] cursor-grab touch-pan-y overflow-hidden bg-[#0d0e10] active:cursor-grabbing lg:order-none lg:h-[540px]"
              >
                <AnimatePresence mode="popLayout">
                  <motion.img
                    key={i}
                    src={m.img}
                    alt={m.name}
                    draggable={false}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  />
                </AnimatePresence>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card/30 to-transparent" />
                <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/60 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mut-2 backdrop-blur lg:hidden">
                  ‹ swipe ›
                </span>
              </motion.div>

              {/* RIGHT: arrows + socials */}
              <div className="flex flex-row items-center justify-between border-t border-line-soft lg:flex-col lg:justify-start lg:border-l lg:border-t-0">
                <div className="flex gap-2 p-5 lg:w-full lg:justify-center lg:gap-3 lg:border-b lg:border-line-soft">
                  <button
                    onClick={() => go(-1)}
                    aria-label="Previous"
                    className="grid h-9 w-9 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => go(1)}
                    aria-label="Next"
                    className="grid h-9 w-9 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame"
                  >
                    →
                  </button>
                </div>
                <div className="flex gap-3 p-5 lg:mt-6 lg:flex-col lg:gap-5">
                  {SOCIALS.map((s, k) => (
                    <a
                      key={k}
                      href="#"
                      className="grid h-7 w-7 place-items-center rounded text-[13px] text-mut-3 transition-colors hover:text-flame"
                    >
                      {s}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">Join our Slack community</span>
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
