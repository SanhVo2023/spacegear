"use client";

import { usePathname } from "next/navigation";
import { useLocale, useNotFoundPage } from "@/components/LocaleProvider";
import { dictionary } from "@/lib/i18n/dictionary";
import { HTML_LANG, LOCALES, LOCALE_NAME, LOCALE_SHORT, switchHref } from "@/lib/i18n/locales";

/**
 * The EN/VI switch (desktop nav: "bar"; mobile menu: "menu"). Plain links, so switching is a full page load (each
 * language has its own root layout) and works without JavaScript: each links the English path with ?lang=, which
 * the Worker (worker/locale.ts) remembers in the sg_lang cookie before redirecting to the clean page in that
 * language. The current language is marked with aria-current. Each link's accessible name holds its visible text
 * ("VI – Tiếng Việt"); the bar shows only EN/VI, so English pages render no Vietnamese letter and never load the
 * Vietnamese font subset until the mobile menu opens. The 404 page has no single path, so its links go home.
 */
export default function LanguageSwitch({ variant }: { variant: "bar" | "menu" }) {
  const locale = useLocale();
  const notFound = useNotFoundPage();
  const pathname = usePathname() ?? "/";
  const bar = variant === "bar";
  return (
    <ul aria-label={dictionary(locale).nav.language} className={bar ? "hidden items-center gap-0.5 rounded-xl border border-line p-0.5 lg:flex" : "mt-2 flex gap-2 border-t border-line-soft px-1 pt-3"}>
      {LOCALES.map((target) => {
        const current = target === locale;
        const tone = current ? "bg-card-2 text-ink" : "text-mut-2 hover:text-ink";
        return (
          <li key={target}>
            <a
              href={switchHref(notFound ? "/" : pathname, target)}
              hrefLang={HTML_LANG[target]}
              lang={HTML_LANG[target]}
              aria-current={current ? "true" : undefined}
              aria-label={bar ? `${LOCALE_SHORT[target]} – ${LOCALE_NAME[target]}` : undefined}
              className={bar ? `grid h-8 min-w-9 place-items-center rounded-lg px-2 font-mono text-[11px] tracking-[0.12em] transition-colors ${tone}` : `block rounded-lg px-4 py-2.5 text-[13px] transition-colors hover:bg-card-2 ${tone}`}
            >
              {bar ? LOCALE_SHORT[target] : LOCALE_NAME[target]}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
