import Link from "next/link";
import { SERVICES } from "@/lib/content";
import { buildMetadata, breadcrumbData } from "@/lib/seo";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
export const metadata = buildMetadata({ title: "Services", description: "Explore digital transformation strategy, AI consulting, applied AI and deep learning, automation, integration and digital product delivery.", path: "/services/" });
export default function ServicesPage() {
  return <main id="main"><PageIntro eyebrow="Strategy & delivery" title="A clear direction. The capability to deliver." description="Choose the right next step, build a working solution, or connect and improve operations. Start with the problem you want to solve."/>
    <div className="site-container service-index">{SERVICES.map((service, i) => <article className="service-index-card" key={service.slug}><div><span className="eyebrow">{service.category}</span><h2><Link prefetch={false} href={`/services/${service.slug}/`}>{service.name}</Link></h2><p>{service.summary}</p><Link prefetch={false} className="text-link" href={`/services/${service.slug}/`}>Explore this service <span aria-hidden="true">↗</span></Link></div><span className="service-index-no" aria-hidden="true">0{i+1}</span></article>)}</div>
    <StructuredData data={breadcrumbData([{name:"Home",path:"/"},{name:"Services",path:"/services/"}])}/></main>;
}
