"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import Reveal from "@/components/Reveal";
import type { Testimonial } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary, format } from "@/lib/i18n/dictionary";

const EASE = [0.16, 1, 0.3, 1] as const;
/** Stable React key for an entry (index keys would reuse nodes across entries). */
const keyOf = (t: Testimonial) => `${t.name}|${t.company}`;

/** Client half of the Testimonials section. It receives its entries as props
 *  from the server component, so dev-only sample data never enters a client bundle. */
export default function TestimonialsCarousel({ reviews: REVIEWS }: { reviews: Testimonial[] }) {
  const [i, setI] = useState(0);
  const strings = dictionary(useLocale());
  const t = strings.testimonials;
  if (REVIEWS.length === 0) return null;
  const r = REVIEWS[i];
  const go = (d: number) => setI((p) => (p + d + REVIEWS.length) % REVIEWS.length);

  return (
    <Reveal delay={100}>
      <div className="mt-12 overflow-hidden rounded-3xl border border-line bg-card/40">
        <div className="grid lg:grid-cols-[300px_1fr_120px]">
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
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.img
                key={keyOf(r)}
                {...contentImage(r.img)}
                alt={r.name}
                loading="lazy"
                decoding="async"
                draggable={false}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover grayscale"
              />
            </AnimatePresence>
            <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/60 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mut-2 backdrop-blur lg:hidden">{strings.team.swipe}</span>
          </motion.div>

          <div className="flex flex-col justify-between p-8">
            <span aria-hidden className="display text-5xl leading-none text-flame">“</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.blockquote
                key={keyOf(r)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="mt-4 max-w-xl text-[clamp(16px,1.6vw,21px)] italic leading-relaxed text-ink"
              >
                {r.quote}
              </motion.blockquote>
            </AnimatePresence>
            <div className="mt-8 flex items-end justify-between border-t border-line-soft pt-6">
              <div>
                <p className="display text-xl text-ink">{r.name}</p>
                <p className="text-[12px] text-mut-2">{r.role}</p>
              </div>
              <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-mut-2">{r.company}</span>
            </div>
          </div>

          <div className="hidden flex-col items-center justify-center gap-4 border-l border-line-soft lg:flex">
            <button type="button" onClick={() => go(-1)} aria-label={t.previous} className="grid h-10 w-10 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame">←</button>
            <button type="button" onClick={() => go(1)} aria-label={t.next} className="grid h-10 w-10 place-items-center rounded-lg text-mut-2 transition-colors hover:text-flame">→</button>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line-soft px-5 py-4">
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-mut-3 sm:block">{t.reviews}</span>
          <div aria-hidden className="flex items-center gap-1.5">
            {REVIEWS.map((rv, k) => (
              <span key={keyOf(rv)} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? "w-5 bg-flame" : "w-1.5 bg-mut-3/50"}`} />
            ))}
          </div>
          <div className="ml-auto flex gap-2 lg:hidden">
            <button type="button" onClick={() => go(-1)} aria-label={t.previous} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">←</button>
            <button type="button" onClick={() => go(1)} aria-label={t.next} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-mut-2">→</button>
          </div>
        </div>

        <div className="scrollbar-none flex gap-2 overflow-x-auto border-t border-line-soft p-3">
          {REVIEWS.map((rv, k) => (
            <button
              type="button"
              key={keyOf(rv)}
              onClick={() => setI(k)}
              aria-current={k === i ? "true" : undefined}
              aria-label={format(t.show, { name: rv.name })}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition-all duration-300 ${k === i ? "border-flame ring-1 ring-flame" : "border-line opacity-60 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...contentImage(rv.img)} alt="" loading="lazy" decoding="async" className={`h-full w-full object-cover ${k === i ? "" : "grayscale"}`} />
            </button>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
