// The owner's phone number on the page: national in Vietnamese ("0386 749 799"), international in English
// ("+84 386 749 799"), and always the E.164 number in tel: links (bilingual spec, decision 4).
import type { Locale } from "./i18n/locales.ts";

export function formatPhone(e164: string, locale: Locale): string {
  const match = /^\+84(\d{3})(\d{3})(\d{3})$/.exec(e164);
  if (!match) return e164;
  const [, a, b, c] = match;
  return locale === "vi" ? `0${a} ${b} ${c}` : `+84 ${a} ${b} ${c}`;
}

export const telHref = (e164: string) => `tel:${e164}`;
