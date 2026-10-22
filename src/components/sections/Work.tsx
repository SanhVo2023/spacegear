"use client";

import Link from "next/link";
import { Appear, AppearGroup, AppearItem, FillBar } from "@/components/motion";
import { Container, ArrowButton } from "@/components/ui";
import ScrollColorTitle from "@/components/ScrollColorTitle";
import StackCards from "@/components/StackCards";
import DotField from "@/components/DotField";
import Parallax from "@/components/fx/Parallax";
import ScrollDepth from "@/components/fx/ScrollDepth";
import Tilt from "@/components/fx/Tilt";
import { SECTIONS, WORK, type WorkTile } from "@/lib/content";

/** small animated drag-handle dots, top-right of each tile */
function GridDots() {
  return (
    <span aria-hidden className="grid grid-cols-3 gap-[3px] opacity-50 transition-opacity duration-300 group-hover:opacity-100">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

function ArrowBtn() {
  return <ArrowButton />;
}

/** Service tile with hover-revealed description + image zoom. Reused on service pages. On fine-pointer
 *  desktops the image also drifts inside its frame as the tile crosses the viewport (`still` leaves that out:
 *  the mobile card stack never shows at those widths). */
export function Tile({ name, img, desc, href, still = false }: WorkTile & { still?: boolean }) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img}
      alt=""
      loading="lazy"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-110"
    />
  );
  return (
    <Link prefetch={false} href={href} data-cursor="View" className="group relative block h-full overflow-hidden rounded-2xl border border-line">
      {still ? image : <Parallax className="absolute inset-0">{image}</Parallax>}
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
          {/* visible on mobile, hover/focus-revealed on desktop */}
          <p
            data-hover-reveal=""
            className="mb-3 max-w-[24ch] text-[12.5px] leading-relaxed text-mut-2 transition-all duration-[400ms] ease-out lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-visible:translate-y-0 lg:group-focus-visible:opacity-100"
          >
            {desc}
          </p>
          <ArrowBtn />
        </div>
      </div>
    </Link>
  );
}

function LineupPanel({ variant }: { variant: "desktop" | "mobile" }) {
  const l = WORK.lineup;
  const header = (
    <div className="flex items-center justify-between border-b border-[#161719]/20 pb-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{l.label}</span>
      <span className="font-mono text-[11px] tracking-[0.2em]">{l.count}</span>
    </div>
  );
  if (variant === "mobile") {
    return (
      <div className="flex h-[46vh] flex-col justify-between overflow-hidden rounded-2xl bg-flame p-6 text-[#161719]">
        <div>
          {header}
          <h3 className="display mt-4 text-2xl leading-tight">{l.title}</h3>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a2a17]">{l.text}</p>
        </div>
        <DotField cols={6} rows={3} color="#161719" className="gap-y-3" />
        <div className="flex items-center gap-2 border-t border-[#161719]/20 pt-3">
          <span aria-hidden className="text-base">◉</span>
          <span className="text-[13px] font-medium">{l.footer}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-flame p-6 text-[#161719]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_80%_10%,rgba(255,255,255,0.18),transparent_60%)]" />
      <div className="relative">
        {header}
        <h3 className="display mt-5 text-2xl leading-tight">{l.title}</h3>
        <p className="mt-3 text-[13px] leading-relaxed text-[#5a2a17]">{l.text}</p>
      </div>
      {/* flowing dot matrix */}
      <DotField cols={6} rows={5} color="#161719" className="relative my-4 gap-y-3.5" />
      <div className="relative flex items-center gap-2 border-t border-[#161719]/20 pt-3">
        <span aria-hidden className="text-base">◉</span>
        <span className="text-[13px] font-medium">{l.footer}</span>
      </div>
    </div>
  );
}

function AssessmentCard({ variant }: { variant: "desktop" | "mobile" }) {
  const a = WORK.assessment;
  const title = (
    <>
      <h3 className="display text-xl text-ink-strong">
        {a.title} <span className="text-mut-2">{a.badge}</span>
      </h3>
      <p className="mt-1 text-[13px] text-flame">{a.note}</p>
    </>
  );
  const bar = <FillBar value={a.progress} className="h-full rounded-full bg-flame" />;
  if (variant === "mobile") {
    return (
      <div className="mt-4 rounded-2xl border border-line bg-card p-6">
        {title}
        <p className="display mt-3 text-3xl text-mut">
          {a.value}<span className="text-base text-mut-3">{a.unit}</span>
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-3">{bar}</div>
        <Link prefetch={false} href={a.href} className="group mt-4 flex items-center justify-between">
          <span className="text-[13px] text-ink">{a.cta}</span>
          <ArrowBtn />
        </Link>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-line bg-card p-6">
      <div>
        {title}
        <div className="mt-4">
          <span className="inline-block rounded-md bg-card-3 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-mut-2">{a.chip}</span>
          <p className="display mt-2 text-3xl text-mut">
            {a.value}<span className="text-base text-mut-3">{a.unit}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-3">{bar}</div>
        </div>
      </div>
      <Link prefetch={false} href={a.href} className="group flex items-center justify-between">
        <span className="text-[13px] text-ink">{a.cta}</span>
        <ArrowBtn />
      </Link>
    </div>
  );
}

export default function Work() {
  const copy = SECTIONS.work;
  const f = WORK.featured;
  return (
    <section id="work" className="relative py-24">
      <Container>
        {/* header */}
        <ScrollColorTitle title={copy.title} />

        <Appear delay={0.05}>
          <div className="mt-8 grid gap-6 border-t border-line-soft pt-8 lg:grid-cols-[200px_1fr_240px]">
            <div className="font-mono text-[11px] leading-relaxed text-mut-3">
              <span className="text-mut">{copy.index}</span>
              <br />
              spacegear
            </div>
            <h3 className="display max-w-md text-[clamp(22px,2.6vw,34px)] text-ink">{copy.heading}</h3>
            <p className="text-[12px] leading-relaxed text-mut-2">{copy.description}</p>
          </div>
        </Appear>

        {/* bento (desktop): on fine-pointer desktops each item lags and shrinks as it leaves through the top,
            so the row below slides over it (ScrollDepth, transforms only) */}
        <AppearGroup className="mt-10 hidden auto-rows-[200px] gap-4 lg:grid lg:grid-cols-3 lg:[grid-auto-rows:200px]" stagger={0.07}>
          {/* featured service — spans 2 cols, 2 rows */}
          <AppearItem className="sm:col-span-2 sm:row-span-2">
            <ScrollDepth className="h-full">
              <Tilt spotlight className="h-full rounded-2xl">
                <Link prefetch={false} href={f.href} data-cursor="View" className="group relative block h-full min-h-[260px] overflow-hidden rounded-2xl border border-line">
                  <Parallax className="absolute inset-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
                  </Parallax>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/80 via-transparent to-[#0c0d0f]/40" />
                  <div className="relative flex h-full flex-col justify-between p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{f.label}</span>
                        <h3 className="display mt-1 text-2xl text-ink-strong">{f.name}</h3>
                      </div>
                      <GridDots />
                    </div>
                    <ArrowBtn />
                  </div>
                </Link>
              </Tilt>
            </ScrollDepth>
          </AppearItem>

          {/* service lineup orange panel — spans 2 rows */}
          <AppearItem className="sm:row-span-2">
            <ScrollDepth className="h-full">
              <LineupPanel variant="desktop" />
            </ScrollDepth>
          </AppearItem>

          {WORK.tiles.map((tile) => (
            <AppearItem key={tile.slug} className="h-full">
              <ScrollDepth className="h-full">
                <Tilt spotlight className="h-full rounded-2xl">
                  <Tile {...tile} />
                </Tilt>
              </ScrollDepth>
            </AppearItem>
          ))}

          {/* animated neural placeholder */}
          <AppearItem className="hidden h-full sm:block">
            <ScrollDepth className="h-full">
              <div aria-hidden className="relative grid h-full place-items-center overflow-hidden rounded-2xl border border-line bg-card/40">
                <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(250,110,67,0.08),transparent_70%)]" />
                <div className="spin-26 grid grid-cols-3 gap-2.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i} className="tile-pulse h-2 w-2 rounded-[3px] bg-flame/70" style={{ animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
              </div>
            </ScrollDepth>
          </AppearItem>

          <AppearItem className="h-full">
            <ScrollDepth className="h-full">
              <AssessmentCard variant="desktop" />
            </ScrollDepth>
          </AppearItem>
        </AppearGroup>

        {/* mobile: curtain card-stack — featured → services → lineup, each card freezes while the next slides over */}
        <div className="mt-10 lg:hidden">
          <StackCards top={88} step={14} gap={64}>
            <Link prefetch={false} href={f.href} className="group relative block h-[46vh] overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d0f]/85 via-transparent to-[#0c0d0f]/30" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{f.label}</span>
                    <h3 className="display mt-1 text-2xl text-ink-strong">{f.name}</h3>
                  </div>
                  <GridDots />
                </div>
                <ArrowBtn />
              </div>
            </Link>

            {WORK.tiles.map((tile) => (
              <div key={tile.slug} className="h-[46vh]">
                <Tile {...tile} still />
              </div>
            ))}

            <LineupPanel variant="mobile" />
          </StackCards>

          <AssessmentCard variant="mobile" />
        </div>
      </Container>
    </section>
  );
}
