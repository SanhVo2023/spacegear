import Link from "next/link";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { ArrowIcon, Container, CtaBand } from "@/components/ui";
import { PILLARS, serviceBySlug } from "@/lib/content";
import { buildMetadata, breadcrumbData } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Services", description: "Explore digital transformation strategy, AI consulting, applied AI and deep learning, automation, integration and digital product delivery.", path: "/services/" });

export default function ServicesPage() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-20">
        <Container>
          <PageIntro
            eyebrow="Strategy & delivery"
            title="Flexible services for modernizing operations and putting AI to work."
            description="Five capabilities — plan, build, connect and improve — that work on their own or together, from the first decision to daily use."
          />

          <div className="mt-12 space-y-4">
            {PILLARS.map((pillar) => {
              const service = serviceBySlug(pillar.slug);
              const href = `/services/${service.slug}/`;
              return (
                <article
                  key={service.slug}
                  className="grid gap-6 overflow-hidden rounded-3xl border border-line bg-card/50 p-8 lg:grid-cols-[80px_1fr_320px] lg:items-center"
                >
                  <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                    <span className="display text-3xl text-flame">{pillar.no}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{pillar.tag}</span>
                  </div>
                  <div>
                    <h2 className="display text-2xl text-ink">
                      <Link prefetch={false} href={href} className="transition-colors hover:text-flame">{service.name}</Link>
                    </h2>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mut-2">{service.buyerProblem}</p>
                    <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                      {service.deliverables.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-[13px] text-mut">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-flame" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link prefetch={false} href={href} className="group mt-6 inline-flex items-center gap-2 text-[13px] text-flame">
                      Explore this service <ArrowIcon />
                    </Link>
                  </div>
                  <div className="relative h-44 overflow-hidden rounded-2xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pillar.img} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                </article>
              );
            })}
          </div>

          <CtaBand title="Plan, build, connect and improve." text="See how the services work together for your organization." />
        </Container>
      </section>
      <StructuredData data={breadcrumbData([{ name: "Home", path: "/" }, { name: "Services", path: "/services/" }])} />
    </main>
  );
}
