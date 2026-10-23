import PageIntro from "@/components/PageIntro";
import { ProcessSteps } from "@/components/sections/Process";
import { Container, CtaBand } from "@/components/ui";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";

export default function ApproachView({ locale }: { locale: Locale }) {
  const t = dictionary(locale).approach;
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro eyebrow={t.eyebrow} title={t.heading} description={t.lead} locale={locale} />
          <h2 className="sr-only">{t.stepsHeading}</h2>
          <ProcessSteps steps={getContent(locale).APPROACH_STEPS} gridClassName="md:grid-cols-2 xl:grid-cols-5" />
          <CtaBand title={t.ctaTitle} text={t.ctaText} locale={locale} />
        </Container>
      </section>
    </main>
  );
}
