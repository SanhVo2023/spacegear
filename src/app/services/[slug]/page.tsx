import Link from "next/link";
import { notFound } from "next/navigation";
import { SERVICES } from "@/lib/content";
import { SITE } from "@/lib/site";
import { buildMetadata, breadcrumbData, canonicalUrl } from "@/lib/seo";
import PageIntro from "@/components/PageIntro";
import StructuredData from "@/components/StructuredData";
import { FaqAccordion } from "@/components/sections/Faq";
export const dynamicParams = false;
export function generateStaticParams() { return SERVICES.map(({slug}) => ({slug})); }
export async function generateMetadata({params}: {params: Promise<{slug:string}>}) {
  const {slug} = await params; const service = SERVICES.find((item) => item.slug === slug); if (!service) notFound();
  return buildMetadata({ title: service.name, description: service.summary, path: `/services/${slug}/` });
}
export default async function ServicePage({params}: {params: Promise<{slug:string}>}) {
  const {slug} = await params; const service = SERVICES.find((item) => item.slug === slug); if (!service) notFound();
  return <main id="main"><PageIntro eyebrow={service.category} title={service.name} description={service.summary}/>
    <div className="site-container detail-content">
      <div className="detail-split"><div><h2>Start with the work<br/>you want to improve.</h2><p>{service.buyerProblem}</p><Link prefetch={false} className="button button-primary" href={`/contact/?service=${slug}`}>Discuss a project <span aria-hidden="true">↗</span></Link></div><aside className="deliverables"><p className="eyebrow">What you receive</p><ul>{service.deliverables.map((item)=><li key={item}>{item}</li>)}</ul></aside></div>
      <section className="detail-section"><h2>From first conversation<br/>to a useful outcome.</h2><ol className="detail-steps">{service.process.map((item,i)=><li key={item}><span>0{i+1}</span><p>{item}</p></li>)}</ol><p>Scope, access, responsibilities and acceptance criteria are agreed before delivery. The approach depends on your systems, data and operating constraints.</p></section>
      <section className="detail-section faq-grid"><h2>A few useful answers.</h2><FaqAccordion items={service.faqs} group={`faq-${slug}`}/></section>
      <section className="related-services"><h2>Connected capabilities</h2><div>{SERVICES.filter((item)=>item.slug!==slug).map((item)=><Link prefetch={false} href={`/services/${item.slug}/`} key={item.slug}>{item.shortName}<span aria-hidden="true">↗</span></Link>)}</div></section>
    </div>
    <StructuredData data={{"@context":"https://schema.org","@type":"Service",name:service.name,description:service.summary,url:canonicalUrl(`/services/${slug}/`),provider:{"@id":`${SITE.origin}/#organization`}}}/>
    <StructuredData data={breadcrumbData([{name:"Home",path:"/"},{name:"Services",path:"/services/"},{name:service.name,path:`/services/${slug}/`}])}/>
  </main>;
}
