"use client";

import { motion } from "motion/react";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import { Container, SectionHeader, FlameButton } from "@/components/ui";

const FAQS = [
  {
    q: "What exactly is Platform?",
    a: "Platform is an AI-driven infrastructure layer that builds, runs, and scales your systems for you — so your team can focus on shipping products instead of managing servers.",
  },
  {
    q: "How does Platform’s AI actually work?",
    a: "A self-learning neural core continuously observes your stack, learns its patterns, and makes optimization decisions in milliseconds across deployment, scaling, and security.",
  },
  {
    q: "How long does implementation take?",
    a: "Most teams are connected in under a minute. One connection lets Platform analyze your tech stack and configure an ideal environment following industry best practices.",
  },
  {
    q: "What kind of support do you provide?",
    a: "Every plan includes responsive support, and Scale and above unlock 24/7 coverage with dedicated specialists for Enterprise customers.",
  },
  {
    q: "How does pricing work?",
    a: "Transparent monthly or yearly plans with no lock-in. Choose only what you need and scale up as you grow — yearly billing saves you 16%.",
  },
  {
    q: "Is Platform secure?",
    a: "Yes. An adaptive 24/7 security layer evolves with new threats, with custom security and private hosting available on Enterprise.",
  },
  {
    q: "Can Platform integrate with our existing tools?",
    a: "Platform connects to your current stack and partners, fitting into your workflows rather than forcing you to rebuild them.",
  },
  {
    q: "How is Platform different from traditional infrastructure?",
    a: "Traditional infrastructure is static and manual. Platform is a self-evolving system that thinks, learns, and adapts automatically.",
  },
];

/** Two short lines that cross into an X when open. */
function ToggleIcon({ open }: { open: boolean }) {
  return (
    <span className="relative grid h-5 w-5 shrink-0 place-items-center">
      <motion.span
        className="absolute h-[2px] w-4 rounded-full bg-flame"
        animate={{ rotate: open ? 45 : 0, y: open ? 0 : -3 }}
        transition={{ duration: 0.25 }}
      />
      <motion.span
        className="absolute h-[2px] w-4 rounded-full bg-flame"
        animate={{ rotate: open ? -45 : 0, y: open ? 0 : 3 }}
        transition={{ duration: 0.25 }}
      />
    </span>
  );
}

function Item({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors duration-300 ${
        open ? "border-flame/40 bg-card-2/60" : "border-line bg-card/40 hover:bg-card-2/40"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-[15px] text-ink">{q}</span>
        <ToggleIcon open={open} />
      </button>
      <div
        className={`grid transition-all duration-300 ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="max-w-xl px-5 pb-5 text-[13.5px] leading-relaxed text-mut-2">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Rotating circular badge with an orange core (matches the footer mark). */
function CircleBadge() {
  return (
    <div className="relative h-20 w-20">
      <motion.svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
      >
        <defs>
          <path id="faqCircle" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <text className="fill-ink/80 font-mono text-[8px] uppercase tracking-[0.16em]">
          <textPath href="#faqCircle" startOffset="0%">
            we run infrastructure · you lead innovation ·
          </textPath>
        </text>
      </motion.svg>
      <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame shadow-[0_0_20px_rgba(250,110,67,0.6)]" />
    </div>
  );
}

export default function Faq() {
  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader
          title="Questions & Answers"
          index="006"
          heading="Simple explanations to help you get started and move faster."
          description="Spend less time guessing and more time building."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* questions — one open at a time */}
          <Reveal delay={60}>
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <Item
                  key={f.q}
                  {...f}
                  open={open === i}
                  onToggle={() => setOpen((cur) => (cur === i ? -1 : i))}
                />
              ))}
            </div>
          </Reveal>

          {/* still have questions card */}
          <Reveal delay={100}>
            <div className="lg:sticky lg:top-28">
              <div className="overflow-hidden rounded-2xl border border-line bg-card/50">
                <div className="relative h-56 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/faq-team.webp"
                    alt="The Platform team"
                    className="h-full w-full object-cover grayscale"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
                  <div className="absolute bottom-3 right-3">
                    <CircleBadge />
                  </div>
                </div>
                <div className="p-7 text-center lg:text-left">
                  <h3 className="display text-2xl text-ink">
                    You still have questions?
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-mut-2">
                    Every team’s needs are different. Let our experts show you how
                    Platform can work for your specific requirements — let’s have a
                    chat and find the right solution for you.
                  </p>
                  <div className="mt-6 flex justify-center lg:justify-start">
                    <FlameButton href="/#contact">Let&apos;s have a chat</FlameButton>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
