"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "../lib/i18n/locales";

/**
 * The page's language for client components. Server components take a `locale` prop instead; client
 * components call useLocale(), so they need no new props and their English markup stays the same.
 * SiteShell (the root layouts and the 404) provides it. `notFound` marks the 404 page, which has no single
 * path (LanguageSwitch then links each language's home page).
 */
type LocaleState = { locale: Locale; notFound: boolean };
const LocaleContext = createContext<LocaleState>({ locale: DEFAULT_LOCALE, notFound: false });

export function LocaleProvider({ locale, notFound = false, children }: { locale: Locale; notFound?: boolean; children: ReactNode }) {
  return <LocaleContext value={{ locale, notFound }}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useNotFoundPage(): boolean {
  return useContext(LocaleContext).notFound;
}
