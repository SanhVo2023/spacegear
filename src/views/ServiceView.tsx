import { notFound } from "next/navigation";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { Container, CtaBand, FlameButton, SectionHeader } from "@/components/ui";
import { ProcessSteps } from "@/components/sections/Process";
import { FaqAccordion, StillQuestionsCard } from "@/components/sections/Faq";
import { Tile } from "@/components/sections/Work";
import { getContent } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary, format } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { SITE } from "@/lib/site";
import { breadcrumbData, canonicalUrl } from "@/lib/seo";

export default function ServiceView({ locale, slug }: { locale: Locale; slug: string }) {
  const { PILLARS, SERVICES } = getContent(locale);
  const service = SERVICES.find((item) => item.slug === slug);
  if (!service) notFound();
  const t = dictionary(locale);
  const pillar = PILLARS.find((item) => item.slug === slug);
  const related = PILLARS.filter((item) => item.slug !== slug);
  const contact = `/contact/?service=${slug}`;

  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro eyebrow={service.category} title={service.name} description={service.summary} back={{ href: "/services/", label: t.nav.services }} locale={locale} />

          <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col justify-between gap-8 rounded-3xl border border-line bg-card/50 p-8">
              <div>
                <h2 className="display text-[clamp(26px,3vw,40px)] text-ink">{t.service.problemHeading}</h2>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">{service.buyerProblem}</p>
              </div>
              <FlameButton href={contact} locale={locale} className="w-fit">{t.service.discuss}</FlameButton>
            </div>
            <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
              <div className="flex items-center justify-between border-b border-line-soft pb-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">{t.service.receive}</span>
                <span className="font-mono text-[12px] tracking-[0.2em] text-flame">{String(service.deliverables.length).padStart(2, "0")}</span>
              </div>
              <ul className="space-y-3">
                {service.deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-mut">
                    <span aria-hidden className="mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              {pillar && (
                <div className="relative mt-auto h-40 overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img {...contentImage(pillar.img)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-24">
            <SectionHeader title={t.service.howTitle} index="001" heading={t.service.howHeading} description={t.service.howDescription} />
            <ProcessSteps steps={service.process.map((desc, i) => ({ step: format(t.process.step, { n: i + 1 }), desc, outputs: [] }))} gridClassName="md:grid-cols-3" />
          </div>

          <div className="mt-24">
            <SectionHeader title={t.service.faqTitle} index="002" heading={t.service.faqHeading} description={t.service.faqDescription} />
            <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <FaqAccordion items={service.faqs} group={`faq-${slug}`} />
              <StillQuestionsCard />
            </div>
          </div>

          <div className="mt-24">
            <SectionHeader title={t.service.relatedTitle} index="003" heading={t.service.relatedHeading} description={t.service.relatedDescription} />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <div key={item.slug} className="h-[260px]">
                  <Tile slug={item.slug} name={item.name} img={item.img} desc={item.desc} href={`/services/${item.slug}/`} />
                </div>
              ))}
            </div>
          </div>

          <CtaBand title={t.service.ctaTitle} text={t.service.ctaText} href={contact} locale={locale} />
        </Container>
      </section>
      <StructuredData data={{ "@context": "https://schema.org", "@type": "Service", name: service.name, description: service.summary, url: canonicalUrl(localizedHref(`/services/${slug}/`, locale)), provider: { "@id": `${SITE.origin}/#organization` } }} />
      <StructuredData data={breadcrumbData([{ name: t.nav.home, path: "/" }, { name: t.nav.services, path: "/services/" }, { name: service.name, path: `/services/${slug}/` }], locale)} />
    </main>
  );
}
