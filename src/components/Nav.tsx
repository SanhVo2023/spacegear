"use client";
import Link from "next/link";
import { useRef } from "react";
import Brand from "./Brand";
const links = [{ label: "Services", href: "/services/" }, { label: "Approach", href: "/approach/" }, { label: "About", href: "/about/" }];
export default function Nav() {
  const menu = useRef<HTMLDetailsElement>(null);
  function close() { if (menu.current) menu.current.open = false; }
  return <header className="site-header">
    <nav className="nav-shell" aria-label="Main navigation">
      <Link prefetch={false} className="brand-link" href="/" aria-label="spacegear.tech home"><Brand /></Link>
      <div className="desktop-links">{links.map((link) => <Link prefetch={false} key={link.href} href={link.href}>{link.label}</Link>)}</div>
      <Link prefetch={false} className="button button-primary nav-cta" href="/contact/">Discuss a project <span aria-hidden="true">↗</span></Link>
      <details ref={menu} className="mobile-menu" onKeyDown={(event) => { if (event.key === "Escape") { close(); menu.current?.querySelector("summary")?.focus(); } }}>
        <summary aria-label="Open navigation"><span className="menu-lines" aria-hidden="true" /></summary>
        <div className="mobile-links">{links.map((link) => <Link prefetch={false} key={link.href} href={link.href} onClick={close}>{link.label}</Link>)}<Link prefetch={false} href="/contact/" onClick={close}>Discuss a project ↗</Link></div>
      </details>
    </nav>
  </header>;
}
