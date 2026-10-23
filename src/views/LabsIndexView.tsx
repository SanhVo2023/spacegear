import LabsCard from "@/components/LabsCard";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { Container } from "@/components/ui";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { labsArticles } from "@/lib/labs";
import { breadcrumbData, webPageData } from "@/lib/seo";
import { labsIndexMetadata } from "@/views/metadata";

/** /labs/ and /vi/labs/: every article of the language, newest first. It exists only when the language has one. */
export default function LabsIndexView({ locale }: { locale: Locale }) {
  const { SECTIONS } = getContent(locale);
  const t = dictionary(locale);
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro eyebrow={SECTIONS.labs.title} title={SECTIONS.labs.heading} description={SECTIONS.labs.description} locale={locale} />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labsArticles(locale).map((article) => (
              <li key={article.slug}><LabsCard article={article} locale={locale} /></li>
            ))}
          </ul>
          <p className="mt-10 text-[13px] text-mut-2">
            <a className="fx-underline text-flame" href={localizedHref("/labs/rss.xml", locale)}>{t.labs.feed}</a>
          </p>
        </Container>
      </section>
      <StructuredData data={breadcrumbData([{ name: t.nav.home, path: "/" }, { name: SECTIONS.labs.title, path: "/labs/" }], locale)} />
      <StructuredData data={webPageData(labsIndexMetadata(locale), locale)} />
    </main>
  );
}
