import PageIntro from "@/components/PageIntro";
import ContactForm from "@/components/ContactForm";
import { CircleBadge } from "@/components/sections/Faq";
import { Container } from "@/components/ui";
import { FAQ_CARD, SERVICES } from "@/lib/content";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Discuss a Project", description: "Tell spacegear.tech what you want to improve. Start a conversation about digital transformation, AI, automation or software delivery.", path: "/contact/" });

export default function Contact() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro
            eyebrow="Let’s start a conversation"
            title="What would you like to improve?"
            description="A challenge, an idea or a project already in motion. Tell us where you are and what you want to make possible."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <aside className="overflow-hidden rounded-2xl border border-line bg-card/50">
              <div className="relative h-56 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FAQ_CARD.img} alt={FAQ_CARD.imgAlt} className="h-full w-full object-cover grayscale" />
                <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
                <div className="absolute bottom-3 right-3"><CircleBadge /></div>
              </div>
              <div className="p-7">
                <h2 className="display text-2xl text-ink">A useful next step starts here.</h2>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mut-2">You don’t need a finished brief or ready-to-use data. Share what you know, and we can work through the next questions together.</p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mut-2">We review your brief and respond about a suitable next step.</p>
                {SITE.contactEmail && (
                  <p className="mt-5"><a className="text-[13px] text-flame hover:underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></p>
                )}
              </div>
            </aside>
            <ContactForm services={SERVICES.map(({ slug, shortName }) => ({ slug, name: shortName }))} siteKey={SITE.turnstileSiteKey} />
          </div>
        </Container>
      </section>
    </main>
  );
}
