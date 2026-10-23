// The legal page sections from content/legal/<page>.md as plain elements. Pages spread them into
// the prose card with createElement, so the HTML and the RSC payload stay exactly what the
// hand-written JSX produced: no wrapper component, no keys, no nested arrays.
import { createElement, type ReactElement } from "react";
import { legalSections, type LegalPage } from "@/lib/legal";
import type { Locale } from "@/lib/i18n/locales";

export function legalSectionElements(page: LegalPage, locale: Locale = "en"): ReactElement[] {
  return legalSections(page, undefined, locale).map(({ heading, paragraphs }) =>
    createElement("section", null, createElement("h2", null, heading), ...paragraphs.map((paragraph) => createElement("p", null, paragraph))));
}
