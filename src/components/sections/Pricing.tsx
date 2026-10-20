import Link from "next/link";
import { ENGAGEMENTS } from "@/lib/content";
export default function Pricing() {
  return <section className="section-pad" id="pricing"><div className="site-container">
    <div className="section-top"><p className="eyebrow">Ways to work together</p><span className="section-index" aria-hidden="true">04</span></div>
    <div className="section-heading"><h2>Start where<br/>you are.</h2><p>One challenge or a defined project. We shape the engagement around what you need to move forward.</p></div>
    <div className="engagement-grid">{ENGAGEMENTS.map((item) => <article key={item.name} className={`engagement-card ${item.featured ? "engagement-featured" : ""}`}>
      <p className="eyebrow">{item.label}</p><h3>{item.name}</h3><p>{item.description}</p><ul>{item.deliverables.map((text) => <li key={text}>{text}</li>)}</ul><Link prefetch={false} className={`button ${item.featured ? "button-dark" : "button-outline"}`} href="/contact/">Discuss a project <span aria-hidden="true">↗</span></Link><small>Scope agreed around your objectives</small>
    </article>)}</div>
  </div></section>;
}
