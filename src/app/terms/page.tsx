import PageIntro from "@/components/PageIntro";
import { Container } from "@/components/ui";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
export const metadata = buildMetadata({title:"Website Terms",description:"Terms for using the spacegear.tech website. Service scope, pricing, ownership and delivery commitments are agreed separately.",path:"/terms/"});
export default function Terms() {
  return <main id="main" className="relative min-h-screen bg-bg"><section className="pt-32 pb-24"><Container><PageIntro eyebrow="Website information" title="Website terms." description="Information about using this website and discussing an engagement."/><div className="prose-card mt-12 max-w-3xl rounded-3xl border border-line bg-card/40 p-8 sm:p-10">
    {!SITE.policiesApproved && <p className="policy-preview">Preview terms. The operator must approve the final website terms and necessary company facts before public launch.</p>}
    <section><h2>Website content</h2><p>This website describes services and possible approaches to digital transformation, AI and software delivery. Illustrative workflows are examples, not reports of client results or guarantees.</p></section>
    <section><h2>Engagements</h2><p>An inquiry does not create an engagement. Scope, pricing, timescales, confidentiality, ownership, support and responsibilities are agreed separately in writing before work begins.</p></section>
    <section><h2>Appropriate use</h2><p>Use this website and its inquiry form lawfully. Do not submit malicious content, interfere with the service or attempt to access private inquiry records.</p></section>
    <section><h2>Third-party material</h2><p>Third-party software and assets remain subject to their applicable licenses. External links, where provided, are for relevant information and do not imply a partnership or endorsement.</p></section>
    <section><h2>Contact</h2><p>{SITE.contactEmail ? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : "A verified contact address will be available before public launch."}</p></section>
  </div></Container></section></main>;
}
