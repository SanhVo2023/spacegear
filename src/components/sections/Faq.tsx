import Link from "next/link";
import { FAQS } from "@/lib/content";
export function FaqList({ items = FAQS }: { items?: { question: string; answer: string }[] }) {
  return <div className="faq-list">{items.map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div>;
}
export default function Faq() {
  return <section className="section-pad faq-section" id="faq"><div className="site-container faq-grid"><div><p className="eyebrow">Before we begin</p><h2>A little clarity<br/>goes a long way.</h2><p className="body-copy">You don’t need every answer before starting a conversation.</p><Link prefetch={false} className="text-link" href="/contact/">Discuss a project <span aria-hidden="true">↗</span></Link></div><FaqList /></div></section>;
}
