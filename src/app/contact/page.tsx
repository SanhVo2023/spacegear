import PageIntro from "@/components/PageIntro";
import ContactForm from "@/components/ContactForm";
import { SERVICES } from "@/lib/content";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
export const metadata=buildMetadata({title:"Discuss a Project",description:"Tell spacegear.tech what you want to improve. Start a conversation about digital transformation, AI, automation or software delivery.",path:"/contact/"});
export default function Contact() {
  return <main id="main"><PageIntro eyebrow="Let’s start a conversation" title="What would you like to improve?" description="A challenge, an idea or a project already in motion. Tell us where you are and what you want to make possible."/>
    <div className="site-container contact-grid"><aside className="contact-aside"><h2>A useful next step<br/>starts here.</h2><p>You don’t need a finished brief or ready-to-use data. Share what you know, and we can work through the next questions together.</p><p>We review your brief and respond about a suitable next step.</p>{SITE.contactEmail&&<p><a className="text-link" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></p>}</aside><ContactForm services={SERVICES.map(({slug,shortName})=>({slug,name:shortName}))} siteKey={SITE.turnstileSiteKey}/></div>
  </main>;
}
