"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Brand from "@/components/Brand";
import { SERVICES } from "@/lib/content";

type Item = { label: string; href: string };

const PRIMARY: Item[] = [{ label: "Home", href: "/" }];
const SERVICE_ITEMS: Item[] = SERVICES.map((s) => ({ label: s.name, href: `/services/${s.slug}/` }));
const TAIL: Item[] = [
  { label: "Approach", href: "/approach/" },
  { label: "About", href: "/about/" },
  { label: "Engagements", href: "/#pricing" },
  { label: "Contact", href: "/contact/" },
];

function Dropdown({ label, href, items }: { label: string; href: string; items: Item[] }) {
  const [dismissed, setDismissed] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const open = dismissed
    ? ""
    : "group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100";
  return (
    <li
      className="group relative"
      onMouseEnter={() => setDismissed(false)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDismissed(false); }}
      onKeyDown={(event) => { if (event.key === "Escape") { setDismissed(true); trigger.current?.focus(); } }}
    >
      <Link
        ref={trigger}
        prefetch={false}
        href={href}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors group-hover:text-ink group-focus-within:text-ink"
      >
        {label}
        <span aria-hidden className="text-[9px] text-mut-3 transition-transform group-hover:rotate-180 group-focus-within:rotate-180">
          ▾
        </span>
      </Link>
      <div className={`invisible absolute left-0 top-full z-10 pt-2 opacity-0 transition-all duration-200 ${open}`}>
        <ul className="w-64 rounded-xl border border-line bg-[#161719]/95 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                prefetch={false}
                href={it.href}
                className="block truncate rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors hover:bg-card-2 hover:text-ink"
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function MobileGroup({ title, items, onNavigate }: { title: string; items: Item[]; onNavigate: () => void }) {
  return (
    <div className="mt-2 border-t border-line-soft pt-2">
      <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{title}</p>
      {items.map((it) => (
        <Link
          prefetch={false}
          key={it.href}
          href={it.href}
          onClick={onNavigate}
          className="block truncate rounded-lg px-4 py-2.5 text-[13px] text-mut-2 hover:bg-card-2 hover:text-ink"
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  const close = () => { if (menu.current) menu.current.open = false; };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        aria-label="Main navigation"
        className={`flex w-full max-w-[1180px] items-center justify-between gap-4 rounded-2xl border px-3 py-2 transition-all duration-500 ${
          scrolled ? "border-line bg-[#161719]/85 backdrop-blur-xl" : "border-transparent bg-[#161719]/30 backdrop-blur-md"
        }`}
      >
        <Link prefetch={false} href="/" aria-label="space—gear home" className="flex items-center gap-2 pl-2">
          <Brand />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {PRIMARY.map((it) => (
            <li key={it.href}>
              <Link prefetch={false} href={it.href} className="rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors hover:text-ink">
                {it.label}
              </Link>
            </li>
          ))}
          <Dropdown label="Services" href="/services/" items={SERVICE_ITEMS} />
          {TAIL.map((it) => (
            <li key={it.href}>
              <Link prefetch={false} href={it.href} className="rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors hover:text-ink">
                {it.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            prefetch={false}
            href="/contact/"
            className="hidden rounded-xl border border-line px-4 py-2 text-[13px] text-ink transition-colors hover:border-mut-3 sm:inline-flex"
          >
            Discuss a project
          </Link>
          <details
            ref={menu}
            className="mobile-menu lg:hidden"
            onKeyDown={(event) => { if (event.key === "Escape" && menu.current?.open) { close(); menu.current?.querySelector("summary")?.focus(); } }}
          >
            <summary
              aria-label="Open navigation"
              className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-xl border border-line text-ink"
            >
              <span aria-hidden className="space-y-1">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            </summary>
            {/* mobile sitemap — positioned against the fixed header, like the original */}
            <div className="scrollbar-none absolute -inset-x-px top-[calc(100%+3px)] max-h-[78vh] overflow-y-auto rounded-2xl border border-line bg-[#161719]/97 p-3 backdrop-blur-xl">
              {[...PRIMARY, { label: "Services", href: "/services/" }, ...TAIL].map((it) => (
                <Link
                  prefetch={false}
                  key={it.href}
                  href={it.href}
                  onClick={close}
                  className="block rounded-lg px-4 py-3 text-[15px] text-ink hover:bg-card-2"
                >
                  {it.label}
                </Link>
              ))}
              <MobileGroup title="All services" items={SERVICE_ITEMS} onNavigate={close} />
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
