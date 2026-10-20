import Link from "next/link";
import type { ReactNode } from "react";
import Reveal from "@/components/Reveal";
import ScrollColorTitle from "@/components/ScrollColorTitle";

/** Clean diagonal ↗ glyph (no emoji). */
function DiagArrow() {
  return (
    <svg viewBox="0 0 16 16" className="h-full w-full" fill="none" aria-hidden>
      <path
        d="M4.5 11.5 11.5 4.5M11.5 4.5H6M11.5 4.5V10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Framer-signature arrow: on parent `group` hover, the arrow slides out to the
 * top-right while a second copy slides in from the bottom-left. Lives in an
 * overflow-hidden box so the swap is masked.
 */
export function ArrowIcon({ size = 14 }: { size?: number }) {
  return (
    <span
      className="relative inline-block overflow-hidden"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:translate-x-[150%] group-hover:-translate-y-[150%]">
        <DiagArrow />
      </span>
      <span className="absolute inset-0 -translate-x-[150%] translate-y-[150%] transition-transform duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:translate-x-0 group-hover:translate-y-0">
        <DiagArrow />
      </span>
    </span>
  );
}

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1240px] px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

/* Eyebrow row used at the top of every numbered section:  • Label ... 00x */
export function SectionTag({
  label,
  index,
}: {
  label: string;
  index: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft pb-4">
      <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
        {label}
      </span>
      <span className="font-mono text-[11px] tracking-[0.2em] text-mut-3">
        {index}
      </span>
    </div>
  );
}

/**
 * Standard section header hierarchy (matches "Our Work"):
 *  - large faint section title
 *  - a row: [00x / space—gear] · main heading · right-aligned blurb
 */
export function SectionHeader({
  title,
  index,
  heading,
  description,
}: {
  title: string;
  index: string;
  heading: string;
  description: string;
}) {
  return (
    <>
      <ScrollColorTitle title={title} />
      <Reveal delay={60}>
        <div className="mt-8 grid gap-6 border-t border-line-soft pt-8 lg:grid-cols-[200px_1fr_240px]">
          <div className="font-mono text-[11px] leading-relaxed text-mut-3">
            <span className="text-mut">{index}</span>
            <br />
            space<span className="text-flame">—</span>gear
          </div>
          <h3 className="display max-w-xl text-[clamp(22px,2.8vw,36px)] text-ink">
            {heading}
          </h3>
          <p className="text-[12px] leading-relaxed text-mut-2">{description}</p>
        </div>
      </Reveal>
    </>
  );
}

export function FlameButton({
  children,
  href = "/contact/",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl bg-flame px-5 py-[14px] text-[13px] font-medium text-[#161719] transition-all duration-300 hover:brightness-110 hover:shadow-[0_10px_30px_-8px_rgba(250,110,67,0.6)] ${className}`}
    >
      {children}
      <ArrowIcon />
    </Link>
  );
}

export function GhostButton({
  children,
  href = "/",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card-2/60 px-5 py-[14px] text-[13px] font-medium text-ink transition-colors duration-300 hover:border-mut-3 hover:bg-card-3/60 ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-card/50 ${className}`}>
      {children}
    </div>
  );
}

/** Standard flame square CTA arrow, used across cards/sections. */
export function ArrowButton({ className = "" }: { className?: string }) {
  return (
    <span
      className={`grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-flame text-[#161719] ${className}`}
    >
      <span className="relative block h-4 w-4 overflow-hidden">
        <svg
          viewBox="0 0 16 16"
          className="absolute inset-0 h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:translate-x-[150%]"
          fill="none"
          aria-hidden
        >
          <path
            d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg
          viewBox="0 0 16 16"
          className="absolute inset-0 h-4 w-4 -translate-x-[150%] transition-transform duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:translate-x-0"
          fill="none"
          aria-hidden
        >
          <path
            d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}

/** 3×3 drag-handle dots shown at the corner of tiles. */
export function GridDots() {
  return (
    <span className="grid grid-cols-3 gap-[3px] text-current opacity-50 transition-opacity duration-300 group-hover:opacity-100">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

/** Closing call-to-action band (from the original /services page). */
export function CtaBand({
  title,
  text,
  cta = "Discuss a project",
  href = "/contact/",
}: {
  title: string;
  text: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-line bg-card/40 p-10 text-center">
      <h2 className="display text-3xl text-ink">{title}</h2>
      <p className="max-w-md text-[14px] text-mut-2">{text}</p>
      <FlameButton href={href}>{cta}</FlameButton>
    </div>
  );
}
