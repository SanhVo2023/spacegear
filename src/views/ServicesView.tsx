import Link from "next/link";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { ArrowIcon, Container, CtaBand } from "@/components/ui";
import { getContent, serviceFor } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { breadcrumbData, webPageData } from "@/lib/seo";
import { servicesMetadata } from "@/views/metadata";

export default function ServicesView({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-20">
        <Container>
          <PageIntro eyebrow={t.services.eyebrow} title={t.services.heading} description={t.services.lead} locale={locale} />

          <div className="mt-12 space-y-4">
            {getContent(locale).PILLARS.map((pillar) => {
              const service = serviceFor(locale, pillar.slug);
              const href = localizedHref(`/services/${service.slug}/`, locale);
              return (
                <article
                  key={service.slug}
                  className="grid gap-6 overflow-hidden rounded-3xl border border-line bg-card/50 p-8 lg:grid-cols-[80px_1fr_320px] lg:items-center"
                >
                  <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                    <span className="display text-3xl text-flame">{pillar.no}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{pillar.tag}</span>
                  </div>
                  <div>
                    <h2 className="display text-2xl text-ink">
                      <Link prefetch={false} href={href} className="transition-colors hover:text-flame">{service.name}</Link>
                    </h2>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mut-2">{service.buyerProblem}</p>
                    <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                      {service.deliverables.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-[13px] text-mut">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-flame" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link prefetch={false} href={href} className="group mt-6 inline-flex items-center gap-2 text-[13px] text-flame">
                      {/* One text node with its trailing space, as the inline text rendered (no <!-- --> split). */}
                      {`${t.services.explore} `}<ArrowIcon />
                    </Link>
                  </div>
                  <div className="relative h-44 overflow-hidden rounded-2xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img {...contentImage(pillar.img)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                </article>
              );
            })}
          </div>

          <CtaBand title={t.services.ctaTitle} text={t.services.ctaText} locale={locale} />
        </Container>
      </section>
      <StructuredData data={breadcrumbData([{ name: t.nav.home, path: "/" }, { name: t.nav.services, path: "/services/" }], locale)} />
      <StructuredData data={webPageData(servicesMetadata(locale), locale)} />
    </main>
  );
}
