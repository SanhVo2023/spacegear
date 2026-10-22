import { createElement } from "react";
import PageIntro from "@/components/PageIntro";
import { legalSectionElements } from "@/components/legal-sections";
import { Container } from "@/components/ui";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
export const metadata = buildMetadata({title:"Website Terms",description:"Terms for using the spacegear.tech website. Service scope, pricing, ownership and delivery commitments are agreed separately.",path:"/terms/"});
// Section text: content/legal/terms.md (editable in the CMS). The notice and the contact section depend on site settings.
export default function Terms() {
  const notice = !SITE.policiesApproved && <p className="policy-preview">Preview terms. The operator must approve the final website terms and necessary company facts before public launch.</p>;
  const contact = <section><h2>Contact</h2><p>{SITE.contactEmail ? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : "A verified contact address will be available before public launch."}</p></section>;
  return <main id="main" className="relative min-h-screen bg-bg"><section className="pt-32 pb-24"><Container><PageIntro eyebrow="Website information" title="Website terms." description="Information about using this website and discussing an engagement."/>{createElement("div", { className: "prose-card mt-12 max-w-3xl rounded-3xl border border-line bg-card/40 p-8 sm:p-10" }, notice, ...legalSectionElements("terms"), contact)}</Container></section></main>;
}
