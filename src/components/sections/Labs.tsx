import Link from "next/link";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import { Container, SectionHeader, GhostButton } from "@/components/ui";
import { ARTICLES } from "@/lib/content";

function ArticleCard({ a }: { a: (typeof ARTICLES)[number] }) {
  return (
    <Link
      href={`/labs/${a.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card/50 transition-colors hover:border-flame/40"
    >
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.img}
          alt={a.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2 font-mono text-[11px] text-mut-3">
          <span>Written by</span>
          <span className="text-mut">{a.author}</span>
        </div>
        <h3 className="mt-4 text-lg font-medium leading-snug text-ink transition-colors group-hover:text-ink-strong">
          {a.title}
        </h3>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-mut-2">
          {a.sub}
        </p>
        <span className="mt-5 inline-flex items-center gap-2 text-[13px] text-flame">
          Read article
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Link>
  );
}

export default function Labs() {
  return (
    <section id="labs" className="relative scroll-mt-24 py-24">
      <Container>
        <SectionHeader
          title="Platform Labs®"
          index="009"
          heading="Fresh takes on systems, workflows, and the tools behind today’s digital infrastructure."
          description="Stay ahead with cutting-edge trends and expert analyses driving the future of technology."
        />

        {/* desktop grid */}
        <div className="mt-12 hidden gap-4 sm:grid sm:grid-cols-2">
          {ARTICLES.map((a, i) => (
            <Reveal key={a.slug} delay={80 + i * 70}>
              <ArticleCard a={a} />
            </Reveal>
          ))}
        </div>

        {/* mobile: swipeable */}
        <SnapRow className="mt-10 sm:hidden" itemClassName="w-[85%]">
          {ARTICLES.map((a) => (
            <ArticleCard key={a.slug} a={a} />
          ))}
        </SnapRow>

        <Reveal delay={140}>
          <div className="mt-8 flex justify-center">
            <GhostButton href="/labs/ethical-ai-systems">
              More articles from Platform Labs®
            </GhostButton>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
