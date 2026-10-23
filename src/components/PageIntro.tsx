import Link from "next/link";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, type Locale } from "@/lib/i18n/locales";

/** Inner-page header from the original /services page: back link, eyebrow, display H1, lead. */
export default function PageIntro({
  eyebrow,
  title,
  description,
  back,
  locale = "en",
}: {
  eyebrow: string;
  title: string;
  description: string;
  back?: { href: string; label: string };
  locale?: Locale;
}) {
  const link = back ?? { href: "/", label: dictionary(locale).pageIntro.back };
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link prefetch={false} href={localizedHref(link.href, locale)} className="fx-underline font-mono text-[12px] text-mut-2 transition-colors hover:text-flame">
          ← {link.label}
        </Link>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
          {eyebrow}
        </span>
      </div>
      <h1 className="display mt-6 max-w-3xl break-words text-[clamp(32px,6vw,72px)] text-ink">{title}</h1>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">{description}</p>
    </>
  );
}
