import Link from "next/link";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import { Container, SectionHeader } from "@/components/ui";
import { getContent, type Article } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { SAMPLE_ARTICLES, SAMPLE_MARKER, SHOW_SAMPLES } from "@/lib/samples";

/** The entries the section shows in `locale`: real published articles, or the dev samples. */
function labsFor(locale: Locale) {
  const { ARTICLES } = getContent(locale);
  const usingSamples = ARTICLES.length === 0 && SHOW_SAMPLES;
  return { usingSamples, items: ARTICLES.length ? ARTICLES : usingSamples ? SAMPLE_ARTICLES : [] };
}
/** Whether the section renders in `locale` (the home progress rail lists it only then). */
export const hasLabs = (locale: Locale) => labsFor(locale).items.length > 0;
export const HAS_LABS = hasLabs("en");

function ArticleCard({ a, locale }: { a: Article; locale: Locale }) {
  const t = dictionary(locale).labs;
  const external = /^https?:\/\//.test(a.href);
  const className = "group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card/50 transition-colors hover:border-flame/40";
  const body = (
    <>
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...contentImage(a.img)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2 font-mono text-[11px] text-mut-3">
          <span>{t.writtenBy}</span>
          <span className="text-mut">{a.author}</span>
        </div>
        <h3 className="mt-4 text-lg font-medium leading-snug text-ink transition-colors group-hover:text-ink-strong">{a.title}</h3>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-mut-2">{a.sub}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-[13px] text-flame">
          {t.read}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </>
  );
  return external ? (
    <a href={a.href} target="_blank" rel="noopener noreferrer" className={className}>{body}</a>
  ) : (
    <Link prefetch={false} href={localizedHref(a.href, locale)} className={className}>{body}</Link>
  );
}

export default function Labs({ locale = "en" }: { locale?: Locale }) {
  // Renders only real published articles (or dev samples).
  const { usingSamples, items } = labsFor(locale);
  if (items.length === 0) return null;
  return (
    <section id="labs" data-sample={usingSamples ? SAMPLE_MARKER : undefined} className="relative scroll-mt-2 py-24">
      <Container>
        {usingSamples && <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-flame">{dictionary(locale).labs.sample}</p>}
        <SectionHeader {...getContent(locale).SECTIONS.labs} />

        <div className="mt-12 hidden gap-4 sm:grid sm:grid-cols-2">
          {items.map((a, i) => (
            <Reveal key={a.slug} delay={80 + i * 70}>
              <ArticleCard a={a} locale={locale} />
            </Reveal>
          ))}
        </div>

        <SnapRow className="mt-10 sm:hidden" itemClassName="w-[85%]">
          {items.map((a) => (
            <ArticleCard key={a.slug} a={a} locale={locale} />
          ))}
        </SnapRow>
      </Container>
    </section>
  );
}
