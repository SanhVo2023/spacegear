import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { formatPhone, telHref } from "@/lib/phone";
import { siteFor } from "@/lib/site";

/**
 * The owner's contact details (Site identity: content/site.json and content/vi/site.json), exactly as on Google
 * Business Profile: the address, the phone as a tel: link and, with `email` and a configured address, the email.
 * With `labels`, "Address:" and the like show; without, they are for screen readers only (the footer).
 */
export default function ContactDetails({ locale = "en", labels = false, email = false, className = "" }: { locale?: Locale; labels?: boolean; email?: boolean; className?: string }) {
  const site = siteFor(locale);
  const t = dictionary(locale).contactDetails;
  const label = (text: string) => <span className={labels ? "text-mut" : "sr-only"}>{text}: </span>;
  return (
    <address className={`not-italic ${className}`}>
      <span className="block">{label(t.address)}{site.address.full}</span>
      <span className="block">{label(t.phone)}<a href={telHref(site.telephone)} className="fx-underline transition-colors hover:text-flame">{formatPhone(site.telephone, locale)}</a></span>
      {email && site.contactEmail && <span className="block">{label(t.email)}<a href={`mailto:${site.contactEmail}`} className="fx-underline transition-colors hover:text-flame">{site.contactEmail}</a></span>}
    </address>
  );
}
