import Link from "next/link";
import Brand from "../Brand";
import { SITE } from "@/lib/site";
export default function Footer() {
  return <footer className="site-footer" id="contact">
    <div className="site-container">
      <div className="footer-inquiry"><p className="eyebrow">A useful next step</p><h2>Tell us what you<br/>want to improve.</h2><Link prefetch={false} className="button button-primary" href="/contact/">Discuss a project <span aria-hidden="true">↗</span></Link></div>
      <div className="footer-grid"><div><Link prefetch={false} href="/" aria-label="spacegear.tech home"><Brand /></Link><p>Digital transformation & AI.<br/>From direction to daily use.</p></div>
        <div><p className="footer-label">Explore</p><Link prefetch={false} href="/services/">Services</Link><Link prefetch={false} href="/approach/">Approach</Link><Link prefetch={false} href="/about/">About</Link></div>
        <div><p className="footer-label">Get in touch</p><Link prefetch={false} href="/contact/">Discuss a project ↗</Link>{SITE.contactEmail && <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>}</div>
        <div className="orbit-badge" aria-hidden="true"><span>Ideas into action</span><svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="20" stroke="currentColor"/><ellipse cx="40" cy="40" rx="39" ry="15" transform="rotate(-35 40 40)" stroke="currentColor"/><circle cx="64" cy="22" r="4" fill="currentColor"/></svg></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} {SITE.name}</span><div><Link prefetch={false} href="/privacy/">Privacy</Link><Link prefetch={false} href="/terms/">Terms</Link></div><a href="#top">Back to top ↑</a></div>
    </div>
  </footer>;
}
