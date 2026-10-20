"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PRODUCTS, ARTICLES } from "@/lib/content";

type Item = { label: string; href: string };

const PRIMARY: Item[] = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
];
const PRODUCT_ITEMS: Item[] = PRODUCTS.map((p) => ({
  label: p.name,
  href: `/work/${p.slug}`,
}));
const LAB_ITEMS: Item[] = ARTICLES.map((a) => ({
  label: a.title,
  href: `/labs/${a.slug}`,
}));
const TAIL: Item[] = [
  { label: "Pricing", href: "/#pricing" },
  { label: "Contact", href: "/#contact" },
];

function Dropdown({ label, items }: { label: string; items: Item[] }) {
  return (
    <li className="group relative">
      <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors group-hover:text-ink">
        {label}
        <span className="text-[9px] text-mut-3 transition-transform group-hover:rotate-180">
          ▾
        </span>
      </button>
      <div className="invisible absolute left-0 top-full z-10 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
        <ul className="w-64 rounded-xl border border-line bg-[#161719]/95 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {items.map((it) => (
            <li key={it.href}>
              <Link
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

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={`flex w-full max-w-[1180px] items-center justify-between gap-4 rounded-2xl border px-3 py-2 transition-all duration-500 ${
          scrolled
            ? "border-line bg-[#161719]/85 backdrop-blur-xl"
            : "border-transparent bg-[#161719]/30 backdrop-blur-md"
        }`}
      >
        <Link href="/" className="flex items-center gap-2 pl-2">
          <span className="text-[19px] font-medium tracking-tight text-flame">
            plat<span className="text-ink">—</span>form
            <sup className="ml-0.5 text-[9px] text-mut-3">®</sup>
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {PRIMARY.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className="rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors hover:text-ink"
              >
                {it.label}
              </Link>
            </li>
          ))}
          <Dropdown label="Products" items={PRODUCT_ITEMS} />
          <Dropdown label="Labs" items={LAB_ITEMS} />
          {TAIL.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className="rounded-lg px-3 py-2 text-[13px] text-mut-2 transition-colors hover:text-ink"
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/#contact"
            className="hidden rounded-xl border border-line px-4 py-2 text-[13px] text-ink transition-colors hover:border-mut-3 sm:inline-flex"
          >
            Book a Demo
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink lg:hidden"
            aria-label="Menu"
          >
            <div className="space-y-1">
              <span className="block h-px w-4 bg-current" />
              <span className="block h-px w-4 bg-current" />
            </div>
          </button>
        </div>
      </nav>

      {/* mobile sitemap */}
      {open && (
        <div className="scrollbar-none absolute left-4 right-4 top-[72px] max-h-[78vh] overflow-y-auto rounded-2xl border border-line bg-[#161719]/97 p-3 backdrop-blur-xl lg:hidden">
          {[...PRIMARY, ...TAIL].map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-4 py-3 text-[15px] text-ink hover:bg-card-2"
            >
              {it.label}
            </Link>
          ))}

          <MobileGroup title="Products" items={PRODUCT_ITEMS} onNavigate={() => setOpen(false)} />
          <MobileGroup title="Platform Labs®" items={LAB_ITEMS} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </header>
  );
}

function MobileGroup({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: Item[];
  onNavigate: () => void;
}) {
  return (
    <div className="mt-2 border-t border-line-soft pt-2">
      <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">
        {title}
      </p>
      {items.map((it) => (
        <Link
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
