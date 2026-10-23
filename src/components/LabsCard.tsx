import Link from "next/link";
import { contentImage } from "@/lib/content-images";
import { dictionary, format } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { formatDate, type LabsArticle } from "@/lib/labs";

/**
 * One article as a card (the Labs index and the home section): cover, date and reading time, title, summary, author.
 * The whole card is the link. The look of the original site's Labs cards; the cover fills a fixed box, so it never
 * moves the text.
 */
export default function LabsCard({ article, locale, heading: Heading = "h2" }: { article: LabsArticle; locale: Locale; heading?: "h2" | "h3" }) {
  const t = dictionary(locale).labs;
  return (
    <Link prefetch={false} href={article.path} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card/50 transition-colors hover:border-flame/40">
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...contentImage(article.cover, "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw")} {...article.coverSize} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="font-mono text-[11px] text-mut-3">
          <time dateTime={article.date}>{formatDate(article.date, locale)}</time> · {format(t.readingTime, { n: article.readingMinutes })}
        </p>
        <Heading className="mt-4 text-lg font-medium leading-snug text-ink transition-colors group-hover:text-ink-strong">{article.title}</Heading>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-mut-2">{article.summary}</p>
        <p className="mt-5 flex items-center justify-between gap-2 text-[13px]">
          <span className="font-mono text-[11px] text-mut-3">{t.writtenBy} <span className="text-mut">{article.author}</span></span>
          <span className="inline-flex items-center gap-2 text-flame">{t.read}<span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span></span>
        </p>
      </div>
    </Link>
  );
}
