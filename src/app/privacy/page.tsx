import PageIntro from "@/components/PageIntro";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
export const metadata = buildMetadata({title:"Privacy",description:"How spacegear.tech handles information submitted through this website and how to contact us about that information.",path:"/privacy/"});
export default function Privacy() {
  return <main id="main"><PageIntro eyebrow="Website information" title="Privacy." description="How information submitted through this website is handled."/><div className="site-container prose-page">
    {!SITE.policiesApproved && <p className="policy-preview">Preview policy. The operator must confirm the contact details, retention period and data practices before public launch or collection of real inquiries.</p>}
    <section><h2>Information you provide</h2><p>The inquiry form asks for your name, email and a description of what you would like to improve. Company and service interest are optional. Please do not send confidential credentials, sensitive personal information or files through the form.</p></section>
    <section><h2>How it is used</h2><p>Submitted information is used to review your inquiry and respond about a suitable next step. Sending an inquiry does not subscribe you to a newsletter or marketing campaign.</p></section>
    <section><h2>Storage and service providers</h2><p>The website uses Cloudflare for hosting, inquiry processing and storage. Cloudflare Turnstile helps protect the form from automated abuse. If owner notifications are enabled, inquiry details are also sent through Cloudflare to the designated contact inbox.</p></section>
    <section><h2>Retention and access</h2><p>Inquiry records are accessible only to those responsible for responding. Closed inquiries that do not become an engagement are retained for up to 90 days, subject to applicable obligations. An engagement may require a separate record and agreement.</p></section>
    <section><h2>Website measurement</h2><p>When enabled, Cloudflare Web Analytics provides aggregate website and performance measurements. Inquiry text and email addresses are not included in analytics events. The website does not use advertising trackers.</p></section>
    <section><h2>Questions or requests</h2><p>{SITE.contactEmail ? <>Contact <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> about information you have submitted, including requests for access or deletion.</> : "A verified privacy contact will be provided before this website opens for real inquiries."}</p></section>
  </div></main>;
}
