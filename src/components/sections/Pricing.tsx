"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import { Container, SectionHeader } from "@/components/ui";
import { ENGAGEMENTS, ENGAGEMENTS_FOOTER, SECTIONS, type Engagement } from "@/lib/content";

/** Original billing toggle, repurposed: switch the list between deliverables and outcomes. */
function Toggle({ outcomes, onToggle }: { outcomes: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-[12px]">
      <span className={outcomes ? "text-mut-2" : "text-ink"}>Deliverables</span>
      <button
        type="button"
        role="switch"
        aria-checked={outcomes}
        aria-label="Show outcomes instead of deliverables"
        onClick={() => onToggle(!outcomes)}
        className="relative h-5 w-9 rounded-full bg-card-3 transition-colors"
      >
        <motion.span
          initial={false}
          className="absolute top-0.5 h-4 w-4 rounded-full bg-flame"
          animate={{ left: outcomes ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      <span className={outcomes ? "text-ink" : "text-mut-2"}>Outcomes</span>
    </div>
  );
}

function Cell({ label, children, className = "" }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col justify-center p-6 ${className}`}>
      {label && <span className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{label}</span>}
      {children}
    </div>
  );
}

function EngagementRow({ item, selected, onSelect }: { item: Engagement; selected: boolean; onSelect: () => void }) {
  const [outcomes, setOutcomes] = useState(false);
  const list = outcomes ? item.outcomes : item.deliverables;
  return (
    <motion.div
      initial={false}
      animate={{
        borderColor: selected ? "#fa6e43" : "#2a2b2e",
        boxShadow: selected ? "0 18px 50px -20px rgba(250,110,67,0.45)" : "0 0 0 0 rgba(0,0,0,0)",
        scale: selected ? 1.01 : 1,
      }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-1 overflow-hidden rounded-2xl border bg-card/40 md:grid-cols-2 lg:grid-cols-[220px_1fr_1fr_1.5fr_auto] lg:divide-x lg:divide-line-soft"
    >
      {/* image tile */}
      <div className="relative h-44 overflow-hidden lg:h-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.img} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e]/70 to-transparent" />
        <span className="absolute left-5 top-5 text-[15px] font-medium text-ink">{item.short}</span>
        {item.featured && (
          <span className="absolute right-4 top-4 rounded-full bg-flame/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-flame">
            Start here
          </span>
        )}
      </div>

      {/* stage + toggle (the original price cell) */}
      <Cell label="Stage">
        <span className="display text-4xl text-ink">{item.stageNo}</span>
        <Toggle outcomes={outcomes} onToggle={setOutcomes} />
      </Cell>

      {/* engagement + focus stacked (the original plan + seats cells) */}
      <div className="grid grid-rows-2 lg:divide-y lg:divide-line-soft">
        <Cell label="Engagement">
          <span className="text-lg text-ink">{item.name}</span>
        </Cell>
        <Cell label="Focus">
          <span className="display text-2xl text-mut">{item.stage}</span>
        </Cell>
      </div>

      {/* deliverables / outcomes */}
      <Cell label={outcomes ? "Outcomes" : "Deliverables"}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-live="polite">
          {list.map((entry) => (
            <li key={entry} className="flex items-center gap-2 text-[12.5px] text-mut">
              <span aria-hidden className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
              {entry}
            </li>
          ))}
        </ul>
      </Cell>

      {/* select */}
      <Cell>
        <motion.button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          whileTap={{ scale: 0.96 }}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-medium transition-colors duration-300 ${
            selected
              ? "bg-flame text-[#161719]"
              : item.featured
                ? "bg-flame/90 text-[#161719] hover:bg-flame"
                : "border border-line text-ink hover:border-flame hover:text-flame"
          }`}
        >
          <motion.span
            key={selected ? "on" : "off"}
            aria-hidden
            initial={selected ? { scale: 0.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            {selected ? "✓" : "→"}
          </motion.span>
          {selected ? "Selected" : "Select"}
        </motion.button>
      </Cell>
    </motion.div>
  );
}

export default function Pricing() {
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = ENGAGEMENTS.find((item) => item.name === selected);
  return (
    <section id="pricing" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader {...SECTIONS.pricing} />

        {/* desktop: stacked rows */}
        <div className="mt-12 hidden space-y-4 lg:block">
          {ENGAGEMENTS.map((item, i) => (
            <Reveal as="div" key={item.name} delay={80 + i * 80}>
              <EngagementRow item={item} selected={selected === item.name} onSelect={() => setSelected(item.name)} />
            </Reveal>
          ))}
        </div>

        {/* mobile: swipeable cards */}
        <SnapRow className="mt-10 lg:hidden" itemClassName="w-[85%]">
          {ENGAGEMENTS.map((item) => (
            <EngagementRow key={item.name} item={item} selected={selected === item.name} onSelect={() => setSelected(item.name)} />
          ))}
        </SnapRow>

        {chosen && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center text-[13px] text-flame">
            {chosen.short} selected —{" "}
            <Link prefetch={false} href="/contact/" className="underline underline-offset-4">tell us about your challenge</Link> to get started.
          </motion.p>
        )}

        <Reveal delay={120}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">{ENGAGEMENTS_FOOTER.text}</span>
            <Link
              prefetch={false}
              href={ENGAGEMENTS_FOOTER.href}
              aria-label="Discuss a project"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-1"
            >
              →
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
