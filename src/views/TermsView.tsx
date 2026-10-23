import { createElement } from "react";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import ContactDetails from "@/components/ContactDetails";
import { legalSectionElements } from "@/components/legal-sections";
import { Container } from "@/components/ui";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SITE } from "@/lib/site";
import { webPageData } from "@/lib/seo";
import { termsMetadata } from "@/views/metadata";

// Section text: content/legal/terms.md and content/vi/legal/terms.md (editable in the CMS). The notice and the
// contact section depend on site settings; the contact section also gives the owner's address and phone.
export default function TermsView({ locale }: { locale: Locale }) {
  const t = dictionary(locale).terms;
  const notice = !SITE.policiesApproved && <p className="policy-preview">{t.notice}</p>;
  const contact = <section><h2>{t.contactHeading}</h2><p>{SITE.contactEmail ? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : t.contactPending}</p><ContactDetails locale={locale} labels /></section>;
  return <main id="main" className="relative min-h-screen bg-bg"><section className="pt-32 pb-24"><Container><PageIntro eyebrow={t.eyebrow} title={t.heading} description={t.lead} locale={locale}/>{createElement("div", { className: "prose-card mt-12 max-w-3xl rounded-3xl border border-line bg-card/40 p-8 sm:p-10" }, notice, ...legalSectionElements("terms", locale), contact)}</Container></section><StructuredData data={webPageData(termsMetadata(locale), locale)} /></main>;
}
