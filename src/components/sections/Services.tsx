import Link from "next/link";
import { SERVICES } from "@/lib/content";
export default function Services() {
  return <div className="site-container services-home" id="services">
    <div className="services-intro"><p className="eyebrow">Strategy & delivery</p><h2>The thinking.<br/>And the doing.</h2><p>Choose the right next step. Build a working solution. Connect and improve operations.</p><Link prefetch={false} href="/services/" className="text-link">Explore our services <span aria-hidden="true">↗</span></Link></div>
    <div className="service-accordion">{SERVICES.map((service, index) => <details key={service.slug} name="services" open={index === 0}>
      <summary><span className="service-no" aria-hidden="true">0{index + 1}</span><h3>{service.shortName}</h3><span className="expand-icon" aria-hidden="true">+</span></summary>
      <div className="service-panel"><p>{service.summary}</p><Link prefetch={false} href={`/services/${service.slug}/`}>Explore {service.shortName.toLowerCase()} <span aria-hidden="true">↗</span></Link></div>
    </details>)}</div>
  </div>;
}
