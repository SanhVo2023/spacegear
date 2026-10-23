import Link from "next/link";
import LabsCard from "@/components/LabsCard";
import Reveal from "@/components/Reveal";
import SnapRow from "@/components/SnapRow";
import Tilt from "@/components/fx/Tilt";
import { Container, SectionHeader } from "@/components/ui";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";
import { labsArticles } from "@/lib/labs";

/** Whether the section renders in `locale`: only when the language has an article (the home rail lists it only then). */
export const hasLabs = (locale: Locale) => labsArticles(locale).length > 0;
export const HAS_LABS = hasLabs("en");

/**
 * The home page's Labs section: the three newest articles in the page's language and a link to all of them. It is
 * not rendered in a language without articles. The cards reveal on scroll (Reveal) and tilt toward the pointer on
 * fine-pointer desktops (Tilt, gated by useFx), like the Work tiles; neither changes the markup.
 */
export default function Labs({ locale = "en" }: { locale?: Locale }) {
  const articles = labsArticles(locale).slice(0, 3);
  if (articles.length === 0) return null;
  const t = dictionary(locale).labs;
  return (
    <section id="labs" className="relative scroll-mt-2 py-24">
      <Container>
        <SectionHeader {...getContent(locale).SECTIONS.labs} />
        <div className="mt-12 hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article, i) => (
            <Reveal key={article.slug} delay={80 + i * 70} className="h-full">
              <Tilt spotlight max={3} className="h-full rounded-3xl">
                <LabsCard article={article} locale={locale} heading="h3" />
              </Tilt>
            </Reveal>
          ))}
        </div>
        <SnapRow className="mt-10 sm:hidden" itemClassName="w-[85%]">
          {articles.map((article) => <LabsCard key={article.slug} article={article} locale={locale} heading="h3" />)}
        </SnapRow>
        <p className="mt-8 text-right">
          <Link prefetch={false} href={localizedHref("/labs/", locale)} className="fx-underline text-[13px] text-flame">{t.allArticles} <span aria-hidden>→</span></Link>
        </p>
      </Container>
    </section>
  );
}
