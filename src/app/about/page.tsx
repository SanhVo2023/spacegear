import Link from "next/link";
import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
export const metadata = buildMetadata({title:"About",description:"spacegear.tech connects digital transformation and AI strategy with hands-on delivery, practical implementation and adoption.",path:"/about/"});
export default function About() {
  return <main id="main"><PageIntro eyebrow="About spacegear.tech" title="Good thinking should become useful work." description="We connect business strategy, technology and delivery to help you make a meaningful change in the way work gets done."/>
    <div className="site-container detail-content"><div className="detail-split"><div><h2>Business context first.<br/>Technology with a purpose.</h2><p>Digital transformation starts with a real challenge. We look at the work, the people using the systems and the constraints around them, then choose an approach that makes sense.</p><p>AI and deep learning are part of the toolkit. So are process design, integration and thoughtful software engineering. The goal is a solution you can operate, understand and improve.</p></div><aside className="deliverables"><p className="eyebrow">Our working principles</p><ul><li>Understand before recommending</li><li>Make assumptions visible and testable</li><li>Design for the whole workflow</li><li>Keep human judgment where it matters</li><li>Make handover part of delivery</li></ul></aside></div>
      <section className="detail-section"><h2>From the first decision<br/>to what happens next.</h2><p>We bring strategy and implementation into the same conversation. That means defining a useful starting point, delivering in reviewable increments and planning for how the change will be used.</p><Link prefetch={false} className="text-link" href="/approach/">See how we work <span aria-hidden="true">↗</span></Link></section>
    </div></main>;
}
