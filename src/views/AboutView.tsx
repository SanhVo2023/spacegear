import PageIntro from "@/components/PageIntro";
import DotField from "@/components/DotField";
import Team from "@/components/sections/Team";
import { Container, CtaBand } from "@/components/ui";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";

export default function AboutView({ locale }: { locale: Locale }) {
  const t = dictionary(locale).about;
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-12">
        <Container>
          <PageIntro eyebrow={t.eyebrow} title={t.heading} description={t.lead} locale={locale} />
          <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-line bg-card/50 p-8">
              <h2 className="display text-[clamp(26px,3vw,40px)] text-ink">{t.contextHeading}</h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">{t.contextParagraphs[0]}</p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">{t.contextParagraphs[1]}</p>
            </div>
            <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
              <div className="flex items-center justify-between border-b border-line-soft pb-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{t.principlesLabel}</span>
                <span className="font-mono text-[12px] tracking-[0.2em] text-flame">0{t.principles.length}</span>
              </div>
              <ul className="space-y-3">
                {t.principles.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[13.5px] text-mut">
                    <span aria-hidden className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <DotField cols={5} rows={3} className="mt-auto gap-y-4 px-1" />
            </div>
          </div>
        </Container>
      </section>
      <Team />
      <section className="pb-24">
        <Container>
          <CtaBand title={t.ctaTitle} text={t.ctaText} cta={t.ctaButton} href="/approach/" locale={locale} />
        </Container>
      </section>
    </main>
  );
}
