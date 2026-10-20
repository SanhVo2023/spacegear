import Link from "next/link";
export default function NotFound() {
  return <main id="main" className="site-container not-found"><p className="eyebrow">Page not found</p><h1>A different direction.</h1><p>This page is unavailable. Explore our services or tell us what you would like to improve.</p><div className="hero-actions"><Link prefetch={false} className="button button-primary" href="/services/">Explore services ↗</Link><Link prefetch={false} className="button button-outline" href="/">Back to home</Link></div></main>;
}
