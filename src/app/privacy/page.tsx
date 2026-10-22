import { createElement } from "react";
import PageIntro from "@/components/PageIntro";
import { legalSectionElements } from "@/components/legal-sections";
import { Container } from "@/components/ui";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
export const metadata = buildMetadata({title:"Privacy",description:"How spacegear.tech handles information submitted through this website and how to contact us about that information.",path:"/privacy/"});
// Section text: content/legal/privacy.md (editable in the CMS). The notice and the contact section depend on site settings.
export default function Privacy() {
  const notice = !SITE.policiesApproved && <p className="policy-preview">Preview policy. The operator must confirm the contact details, retention period and data practices before public launch or collection of real inquiries.</p>;
  const contact = <section><h2>Questions or requests</h2><p>{SITE.contactEmail ? <>Contact <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> about information you have submitted, including requests for access or deletion.</> : "A verified privacy contact will be provided before this website opens for real inquiries."}</p></section>;
  return <main id="main" className="relative min-h-screen bg-bg"><section className="pt-32 pb-24"><Container><PageIntro eyebrow="Website information" title="Privacy." description="How information submitted through this website is handled."/>{createElement("div", { className: "prose-card mt-12 max-w-3xl rounded-3xl border border-line bg-card/40 p-8 sm:p-10" }, notice, ...legalSectionElements("privacy"), contact)}</Container></section></main>;
}
