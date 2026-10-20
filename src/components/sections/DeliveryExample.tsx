import Link from "next/link";
export default function DeliveryExample() {
  return <section className="section-pad" aria-labelledby="delivery-heading"><div className="site-container">
    <div className="section-top"><p className="eyebrow">What delivery looks like</p><span className="section-index" aria-hidden="true">02</span></div>
    <div className="delivery-grid"><div><h2 id="delivery-heading">From scattered information<br/>to a connected workflow.</h2><p className="body-copy">A useful AI solution fits into the work around it. Data comes in, a person stays in control, and the result reaches the right system.</p><Link prefetch={false} href="/services/applied-ai/" className="text-link">Explore applied AI <span aria-hidden="true">↗</span></Link></div>
      <figure className="workflow"><figcaption><span className="status-dot" />Illustrative workflow</figcaption><ol>
        {[["Documents", "Information arrives"], ["AI extraction", "Turn content into structured data"], ["Human review", "Check uncertainty and exceptions"], ["System update", "Send approved information onward"]].map(([title, text], i) => <li key={title}><span className="workflow-step" aria-hidden="true">0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div>{i===2 && <span className="review-tag">Review</span>}</li>)}
      </ol><p className="workflow-note">What to measure: accuracy, time spent and exception rate. This is an example, not a client result.</p></figure>
    </div>
  </div></section>;
}
