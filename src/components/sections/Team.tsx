"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader } from "@/components/ui";
import { FOUNDER, SECTIONS, TEAM, TEAM_ROLES } from "@/lib/content";
import { contentImage } from "@/lib/content-images";

const MEMBERS = FOUNDER ? [FOUNDER, ...TEAM_ROLES] : TEAM_ROLES;
const EASE = [0.16, 1, 0.3, 1] as const;

export default function Team() {
  const [i, setI] = useState(0);
  const m = MEMBERS[i];
  const go = (d: number) => setI((p) => (p + d + MEMBERS.length) % MEMBERS.length);

  return (
    <section id="team" className="relative scroll-mt-2 py-24">
      <Container>
        <SectionHeader {...SECTIONS.team} />

        <Reveal delay={100}>
          <div className="mt-12 overflow-hidden rounded-3xl border border-line bg-card/40">
            <div className="grid lg:grid-cols-[1fr_400px_92px]">
              {/* LEFT: header + name/role + bio */}
              <div className="flex flex-col border-b border-line-soft lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-line-soft px-7 py-5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{TEAM.label}</span>
                  <div aria-hidden className="flex items-center gap-1.5">
                    {MEMBERS.map((_, k) => (
                      <span key={k} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? "w-5 bg-flame" : "w-1.5 bg-mut-3/50"}`} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-7" aria-live="polite">
                  {/* initial={false}: the first card renders in place (no-JS visible, no load animation) */}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`h${i}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, ease: EASE }}
                    >
                      <span className="sr-only">Role {i + 1} of {MEMBERS.length}</span>
                      <h3 className="display text-[clamp(24px,2.4vw,34px)] text-ink">{m.name}</h3>
                      <p className="mt-1 text-[13px] text-flame">{m.role}</p>
                    </motion.div>
                  </AnimatePresence>

                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={`b${i}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, ease: EASE, delay: 0.05 }}
                      className="mt-10 max-w-md text-[13px] leading-relaxed text-mut-2"
                    >
                      {m.bio}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* CENTER: image — swipe to change; fixed 3:4 cell */}
              <motion.div
                drag="x"
                data-cursor="Drag"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(1);
                  else if (info.offset.x > 60) go(-1);
                }}
                className="relative order-first h-[480px] cursor-grab touch-pan-y overflow-hidden bg-[#0d0e10] active:cursor-grabbing lg:order-none lg:h-[540px]"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.img
                    key={i}
                    {...contentImage(m.img)}
                    alt={m.imgAlt}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  />
                </AnimatePresence>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card/30 to-transparent" />
                <span aria-hidden className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/60 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mut-2 backdrop-blur lg:hidden">
                  ‹ swipe ›
                </span>
              </motion.div>

              {/* RIGHT: arrows (+ real profile links when a person has them) */}
              <div className="flex flex-row items-center justify-between border-t border-line-soft lg:flex-col lg:justify-start lg:border-l lg:border-t-0">
                <div className="flex gap-2 p-5 lg:w-full lg:justify-center lg:gap-3 lg:border-b lg:border-line-soft">
                  <button type="button" onClick={() => go(-1)} aria-label="Previous role" className="grid h-9 w-9 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame">←</button>
                  <button type="button" onClick={() => go(1)} aria-label="Next role" className="grid h-9 w-9 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame">→</button>
                </div>
                {m.links.length > 0 && (
                  <div className="flex gap-3 p-5 lg:mt-6 lg:flex-col lg:gap-5">
                    {m.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.label}
                        className="grid h-7 w-7 place-items-center rounded text-[13px] text-mut-3 transition-colors hover:text-flame"
                      >
                        {link.label.slice(0, 2).toLowerCase()}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">{TEAM.cta.label}</span>
            <Link
              prefetch={false}
              href={TEAM.cta.href}
              aria-label={TEAM.cta.label}
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
