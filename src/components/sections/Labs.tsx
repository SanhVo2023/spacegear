import Link from "next/link";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import { Container, SectionHeader } from "@/components/ui";
import { ARTICLES, SECTIONS, type Article } from "@/lib/content";
import { SAMPLE_ARTICLES, SAMPLE_MARKER, SHOW_SAMPLES } from "@/lib/samples";

const USING_SAMPLES = ARTICLES.length === 0 && SHOW_SAMPLES;
const ITEMS = ARTICLES.length ? ARTICLES : USING_SAMPLES ? SAMPLE_ARTICLES : [];

function ArticleCard({ a }: { a: Article }) {
  const external = /^https?:\/\//.test(a.href);
  const className = "group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card/50 transition-colors hover:border-flame/40";
  const body = (
    <>
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2 font-mono text-[11px] text-mut-3">
          <span>Written by</span>
          <span className="text-mut">{a.author}</span>
        </div>
        <h3 className="mt-4 text-lg font-medium leading-snug text-ink transition-colors group-hover:text-ink-strong">{a.title}</h3>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-mut-2">{a.sub}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-[13px] text-flame">
          Read article
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </>
  );
  return external ? (
    <a href={a.href} target="_blank" rel="noopener noreferrer" className={className}>{body}</a>
  ) : (
    <Link prefetch={false} href={a.href} className={className}>{body}</Link>
  );
}

export default function Labs() {
  // Renders only real published articles (or dev samples).
  if (ITEMS.length === 0) return null;
  return (
    <section id="labs" data-sample={USING_SAMPLES ? SAMPLE_MARKER : undefined} className="relative scroll-mt-2 py-24">
      <Container>
        {USING_SAMPLES && <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-flame">Sample content — not a real article</p>}
        <SectionHeader {...SECTIONS.labs} />

        <div className="mt-12 hidden gap-4 sm:grid sm:grid-cols-2">
          {ITEMS.map((a, i) => (
            <Reveal key={a.slug} delay={80 + i * 70}>
              <ArticleCard a={a} />
            </Reveal>
          ))}
        </div>

        <SnapRow className="mt-10 sm:hidden" itemClassName="w-[85%]">
          {ITEMS.map((a) => (
            <ArticleCard key={a.slug} a={a} />
          ))}
        </SnapRow>
      </Container>
    </section>
  );
}
