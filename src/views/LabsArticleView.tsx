import { notFound } from "next/navigation";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { Container, CtaBand } from "@/components/ui";
import { getContent } from "@/lib/content";
import { contentImage } from "@/lib/content-images";
import { dictionary, format } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { formatDate, labsArticle } from "@/lib/labs";
import { blogPostingData, breadcrumbData, webPageData } from "@/lib/seo";
import { labsArticleMetadata } from "@/views/metadata";

/**
 * One Labs article. Its body is HTML that markdown-it rendered at build time from the CMS file, with raw HTML off
 * (src/lib/markdown.ts), styled by .labs-prose (globals.css). The cover and every body image carry their width and
 * height (src/lib/image-size.ts), so the text never moves while they load.
 */
export default function LabsArticleView({ locale, slug }: { locale: Locale; slug: string }) {
  const article = labsArticle(locale, slug);
  if (!article) notFound();
  const { SECTIONS } = getContent(locale);
  const t = dictionary(locale);
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <article className="pt-32 pb-24">
        <Container>
          <PageIntro
            eyebrow={`${formatDate(article.date, locale)} · ${format(t.labs.readingTime, { n: article.readingMinutes })}`}
            title={article.title}
            description={article.summary}
            back={{ href: "/labs/", label: SECTIONS.labs.title }}
            locale={locale}
            titleClassName="labs-title text-[clamp(32px,4.6vw,56px)]"
          />
          <p className="mt-4 font-mono text-[12px] text-mut-2">
            {t.labs.writtenBy} <span className="text-mut">{article.author}</span>
            {article.updated ? <> · {t.labs.updated} <time dateTime={article.updated}>{formatDate(article.updated, locale)}</time></> : null}
          </p>
          <figure className="mt-10 max-w-4xl overflow-hidden rounded-3xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...contentImage(article.cover, "(min-width: 1024px) 896px, 100vw")} {...article.coverSize} alt={article.coverAlt} className="block h-auto w-full" />
          </figure>
          <div className="labs-prose mt-12" dangerouslySetInnerHTML={{ __html: article.html }} />
          <CtaBand title={t.service.ctaTitle} text={t.service.ctaText} locale={locale} />
        </Container>
      </article>
      <StructuredData data={blogPostingData(article)} />
      <StructuredData data={breadcrumbData([{ name: t.nav.home, path: "/" }, { name: SECTIONS.labs.title, path: "/labs/" }, { name: article.title, path: `/labs/${slug}/` }], locale)} />
      <StructuredData data={webPageData(labsArticleMetadata(locale, slug), locale)} />
    </main>
  );
}
