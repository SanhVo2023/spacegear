"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import { Container, SectionHeader } from "@/components/ui";

const TIERS = [
  {
    name: "Studio",
    plan: "Basic",
    price: 49,
    seats: "2",
    img: "/images/suite/design-engine.webp",
    features: [
      "Smart Deployment",
      "Basic Monitoring",
      "Core Security",
      "Email Support",
      "5 team seats",
      "Basic Analytics",
      "Standard API",
    ],
  },
  {
    name: "Scale",
    plan: "Advanced",
    price: 89,
    seats: "6",
    featured: true,
    img: "/images/suite/shield-core.webp",
    features: [
      "All Studio features",
      "AI optimization",
      "Advanced monitoring",
      "Enhanced security",
      "24/7 support",
      "Auto-scaling",
      "Full analytics",
      "Priority API",
    ],
  },
  {
    name: "Supreme",
    plan: "Enterprise",
    price: 249,
    seats: "100",
    img: "/images/suite/scale-matrix.webp",
    features: [
      "All Scale features",
      "Dedicated support",
      "Private hosting",
      "Custom security",
      "Training included",
      "Priority features",
      "Custom reporting",
      "Enterprise SLA",
    ],
  },
];

function Toggle({
  yearly,
  onToggle,
}: {
  yearly: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-2 text-[12px]">
      <span className={yearly ? "text-mut-3" : "text-ink"}>Monthly</span>
      <button
        onClick={() => onToggle(!yearly)}
        aria-label="Toggle billing period"
        className="relative h-5 w-9 rounded-full bg-card-3 transition-colors"
      >
        <motion.span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-flame"
          animate={{ left: yearly ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      <span className={yearly ? "text-ink" : "text-mut-3"}>Yearly</span>
    </div>
  );
}

function Cell({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col justify-center p-6 ${className}`}>
      {label && (
        <span className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

function TierRow({
  tier,
  selected,
  onSelect,
}: {
  tier: (typeof TIERS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const [yearly, setYearly] = useState(false);
  const price = yearly ? Math.round(tier.price * 0.84) : tier.price;
  return (
    <motion.div
      animate={{
        borderColor: selected ? "#fa6e43" : "#2a2b2e",
        boxShadow: selected
          ? "0 18px 50px -20px rgba(250,110,67,0.45)"
          : "0 0 0 0 rgba(0,0,0,0)",
        scale: selected ? 1.01 : 1,
      }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-1 overflow-hidden rounded-2xl border bg-card/40 md:grid-cols-2 lg:grid-cols-[220px_1fr_1fr_1.5fr_auto] lg:divide-x lg:divide-line-soft"
    >
      {/* image tile */}
      <div className="relative h-44 overflow-hidden lg:h-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tier.img}
          alt={tier.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e]/70 to-transparent" />
        <span className="absolute left-5 top-5 text-[15px] font-medium text-ink">
          {tier.name}
        </span>
        {tier.featured && (
          <span className="absolute right-4 top-4 rounded-full bg-flame/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-flame">
            Popular
          </span>
        )}
      </div>

      {/* price + toggle */}
      <Cell label="Price">
        <span className="display text-4xl text-ink">
          $
          <motion.span
            key={price}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block"
          >
            {price}
          </motion.span>
        </span>
        <Toggle yearly={yearly} onToggle={setYearly} />
        {yearly && <span className="mt-1 text-[11px] text-flame">Save 16%</span>}
      </Cell>

      {/* plan + seats stacked */}
      <div className="grid grid-rows-2 lg:divide-y lg:divide-line-soft">
        <Cell label="Plan">
          <span className="text-lg text-ink">{tier.plan}</span>
        </Cell>
        <Cell label="Seats">
          <span className="display text-2xl text-mut">{tier.seats}</span>
        </Cell>
      </div>

      {/* features */}
      <Cell label="Features">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tier.features.map((f) => (
            <li
              key={f}
              className="flex items-center gap-2 text-[12.5px] text-mut"
            >
              <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">
                ✓
              </span>
              {f}
            </li>
          ))}
        </ul>
      </Cell>

      {/* select */}
      <Cell>
        <motion.button
          onClick={onSelect}
          whileTap={{ scale: 0.96 }}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-medium transition-colors duration-300 ${
            selected
              ? "bg-flame text-[#161719]"
              : tier.featured
                ? "bg-flame/90 text-[#161719] hover:bg-flame"
                : "border border-line text-ink hover:border-flame hover:text-flame"
          }`}
        >
          <motion.span
            key={selected ? "on" : "off"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            {selected ? "✓" : "→"}
          </motion.span>
          {selected ? "Selected" : "Select Plan"}
        </motion.button>
      </Cell>
    </motion.div>
  );
}

export default function Pricing() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section id="pricing" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader
          title="Pricing"
          index="005"
          heading="Flexible, transparent plans. Built for clarity and growth."
          description="Scale at your own pace – choose only what you need, when you need it. Nothing extra, nothing locked in."
        />

        {/* desktop: stacked rows */}
        <div className="mt-12 hidden space-y-4 lg:block">
          {TIERS.map((t, i) => (
            <Reveal as="div" key={t.name} delay={80 + i * 80}>
              <TierRow
                tier={t}
                selected={selected === t.name}
                onSelect={() => setSelected(t.name)}
              />
            </Reveal>
          ))}
        </div>

        {/* mobile: swipeable tier cards */}
        <SnapRow className="mt-10 lg:hidden" itemClassName="w-[85%]">
          {TIERS.map((t) => (
            <TierRow
              key={t.name}
              tier={t}
              selected={selected === t.name}
              onSelect={() => setSelected(t.name)}
            />
          ))}
        </SnapRow>

        {selected && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center text-[13px] text-flame"
          >
            {selected} plan selected — book a demo to get started.
          </motion.p>
        )}

        <Reveal delay={120}>
          <div className="mt-8 flex items-center justify-center gap-4 sm:justify-end">
            <span className="text-[13px] text-mut-2">
              Contact sales for Enterprise Plan
            </span>
            <a
              href="#contact"
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
