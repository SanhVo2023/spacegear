import Link from "next/link";
const steps = [
  ["Direction", "Decide what matters.", "Understand the work, compare opportunities and agree what success looks like.", "A clear priority and roadmap"],
  ["Working solution", "Make it useful.", "Validate the assumptions, build in reviewable steps and test the real workflow.", "A tested, integrated implementation"],
  ["Adoption", "Put it into daily use.", "Prepare the handover, support the change and learn from what happens in practice.", "An operating and improvement plan"],
];
export default function Process() {
  return <section className="section-pad process-section" id="process"><div className="site-container">
    <div className="section-top"><p className="eyebrow">How we work</p><span className="section-index" aria-hidden="true">03</span></div>
    <div className="section-heading"><h2>From direction<br/>to daily use.</h2><p>Strategy and delivery belong in the same conversation. Every stage produces something you can use.</p></div>
    <ol className="process-grid">{steps.map(([label,title,text,output], i) => <li key={label}><div className="process-number">0{i+1}<span aria-hidden="true">↗</span></div><p className="eyebrow">{label}</p><h3>{title}</h3><p>{text}</p><div className="process-output">{output}</div></li>)}</ol>
    <Link prefetch={false} className="text-link" href="/approach/">See how we work <span aria-hidden="true">↗</span></Link>
  </div></section>;
}
