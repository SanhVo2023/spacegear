import Link from "next/link";
import { USE_CASES } from "@/lib/content";
export default function Work() {
  return <section className="section-pad" id="work"><div className="site-container">
    <div className="section-top"><p className="eyebrow">Where we create value</p><span className="section-index" aria-hidden="true">01</span></div>
    <div className="section-heading"><h2>Where is your business<br/>getting stuck?</h2><p>A clearer direction. More connected operations. A useful idea brought to life. Start with the challenge.</p></div>
    <div className="challenge-grid">{USE_CASES.map((item, i) => <Link prefetch={false} className={`challenge-card challenge-${i}`} href={`/services/${item.service}/`} key={item.title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image} alt="" width="768" height="768" loading="lazy" decoding="async"/>
      <div className="challenge-copy"><h3>{item.title}</h3><p>{item.text}</p><span className="arrow-square" aria-hidden="true">↗</span></div>
    </Link>)}</div>
  </div></section>;
}
