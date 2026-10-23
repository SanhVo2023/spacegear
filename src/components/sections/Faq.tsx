"use client";

import { motion } from "motion/react";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import Parallax from "@/components/fx/Parallax";
import { ringText } from "@/components/ring-text";
import { useLocale } from "@/components/LocaleProvider";
import { Container, SectionHeader, FlameButton } from "@/components/ui";
import { getContent } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { localizedHref } from "@/lib/i18n/locales";

type QA = { question: string; answer: string };

const ICON_SPRING = { type: "spring", stiffness: 380, damping: 22 } as const;

/** Two short lines that cross into an X when open, while the whole icon spins half a turn (springs; at once
 *  under reduced motion, MotionProvider). `initial={false}`: an item that starts open renders its X at rest
 *  instead of spinning into it on hydration. */
function ToggleIcon({ open }: { open: boolean }) {
  return (
    <motion.span
      aria-hidden
      initial={false}
      className="relative grid h-5 w-5 shrink-0 place-items-center"
      animate={{ rotate: open ? 180 : 0 }}
      transition={ICON_SPRING}
    >
      <motion.span
        initial={false}
        className="absolute h-[2px] w-4 rounded-full bg-flame"
        animate={{ rotate: open ? 45 : 0, y: open ? 0 : -3 }}
        transition={ICON_SPRING}
      />
      <motion.span
        initial={false}
        className="absolute h-[2px] w-4 rounded-full bg-flame"
        animate={{ rotate: open ? -45 : 0, y: open ? 0 : 3 }}
        transition={ICON_SPRING}
      />
    </motion.span>
  );
}

/** Native <details> keeps every answer reachable without JavaScript; the shared
 *  `name` makes the group exclusive, like the original one-open accordion. */
function Item({ item, group, defaultOpen }: { item: QA; group: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      name={group}
      open={defaultOpen}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={`faq-item overflow-hidden rounded-xl border transition-colors duration-300 ${
        open ? "border-flame/40 bg-card-2/60" : "border-line bg-card/40 hover:bg-card-2/40"
      }`}
    >
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="text-[15px] text-ink">{item.question}</span>
        <ToggleIcon open={open} />
      </summary>
      <p className="max-w-xl px-5 pb-5 text-[13.5px] leading-relaxed text-mut-2">{item.answer}</p>
    </details>
  );
}

export function FaqAccordion({ items, group, firstOpen = true }: { items: QA[]; group: string; firstOpen?: boolean }) {
  return (
    <div className="faq-accordion space-y-3">
      {items.map((item, i) => (
        <Item key={item.question} item={item} group={group} defaultOpen={firstOpen && i === 0} />
      ))}
    </div>
  );
}

/** Rotating circular badge with an orange core (matches the footer mark). The copy is sized to close the
 *  circle exactly, its closing "·" one gap before the first letter. */
export function CircleBadge() {
  const { FAQ_CARD } = getContent(useLocale());
  // The badge's ring: its copy runs exactly once round the circle (ring-text.ts).
  const ring = ringText(FAQ_CARD.badge, 36, { size: 8 });
  return (
    <div aria-hidden className="relative h-20 w-20">
      <svg viewBox="0 0 100 100" className="spin-16 h-full w-full">
        <defs>
          <path id="faqCircle" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <text className="fill-ink/80 font-mono uppercase" style={{ fontSize: ring.fontSize, letterSpacing: ring.letterSpacing }}>
          <textPath href="#faqCircle" startOffset="0%" textLength={ring.textLength} lengthAdjust="spacing">{FAQ_CARD.badge}</textPath>
        </text>
      </svg>
      <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame shadow-[0_0_20px_rgba(250,110,67,0.6)]" />
    </div>
  );
}

export function StillQuestionsCard() {
  const locale = useLocale();
  const { FAQ_CARD } = getContent(locale);
  return (
    <div className="lg:sticky lg:top-28">
      <div className="overflow-hidden rounded-2xl border border-line bg-card/50">
        <div className="relative h-56 overflow-hidden">
          {/* the photo drifts gently in its frame on fine-pointer desktops; the frame keeps its h-56 box */}
          <Parallax className="absolute inset-0" amount={0.08}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...contentImage(FAQ_CARD.img)} alt={FAQ_CARD.imgAlt} loading="lazy" className="absolute inset-0 h-full w-full object-cover grayscale" />
          </Parallax>
          <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
          <div className="absolute bottom-3 right-3">
            <CircleBadge />
          </div>
        </div>
        <div className="p-7 text-center lg:text-left">
          <h3 className="display text-2xl text-ink">{FAQ_CARD.title}</h3>
          <p className="mt-3 text-[13.5px] leading-relaxed text-mut-2">{FAQ_CARD.text}</p>
          <div className="mt-6 flex justify-center lg:justify-start">
            <FlameButton href={localizedHref(FAQ_CARD.href, locale)}>{FAQ_CARD.cta}</FlameButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Faq() {
  const { FAQS, SECTIONS } = getContent(useLocale());
  return (
    <section id="faq" className="relative scroll-mt-2 py-24">
      <Container>
        <SectionHeader {...SECTIONS.faq} />
        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal delay={60}>
            <FaqAccordion items={FAQS} group="home-faq" />
          </Reveal>
          <Reveal delay={100}>
            <StillQuestionsCard />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
