"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import Brand from "@/components/Brand";
import { MagneticLink } from "@/components/fx/Magnetic";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useLocale } from "@/components/LocaleProvider";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import { localizedHref, stripLocale, type Locale } from "@/lib/i18n/locales";

type Item = { label: string; href: string };

/** The nav's links in one language. Their hrefs are English site paths; they are localized where they render. */
function navItems(locale: Locale) {
  const t = dictionary(locale).nav;
  return {
    primary: [{ label: t.home, href: "/" }] as Item[],
    services: getContent(locale).SERVICES.map((s) => ({ label: s.name, href: `/services/${s.slug}/` })) as Item[],
    tail: [
      { label: t.approach, href: "/approach/" },
      { label: t.about, href: "/about/" },
      { label: t.engagements, href: "/#pricing" },
      { label: t.contact, href: "/contact/" },
    ] as Item[],
  };
}
const PAGE_HREFS = ["/approach/", "/about/", "/contact/"];

/** The pathname with a trailing slash: the export uses trailingSlash, and either form must give the same link. */
const withSlash = (path: string) => (path.endsWith("/") ? path : `${path}/`);

/** The desktop link for the current page, from the path without its language prefix: "/" at home, the Services
 *  trigger anywhere under /services/, otherwise the page link whose path the pathname starts with. Hash links are never current. */
function currentHref(path: string): string | null {
  if (path === "/") return "/";
  if (path.startsWith("/services/")) return "/services/";
  return PAGE_HREFS.find((href) => path.startsWith(href)) ?? null;
}

/** aria-current for a desktop link: "page" on the page itself, "true" on the section the page belongs to. */
type Current = "page" | "true" | undefined;

/** Hover moves the pill only for a mouse: a tap on a touch screen would leave it behind on the tapped link. */
const mouseOnly = (onHover: () => void) => (event: PointerEvent) => {
  if (event.pointerType === "mouse") onHover();
};

/** The pill behind the current (or hovered) link; Motion's shared layout slides it between links by
 *  transform only. The radius is a style, so Motion keeps it round while the pill stretches.
 *  === FX === One shared layout per page: a route change starts a fresh pill on the new page's link. Motion
 *  measures in page coordinates, so when Next resets the scroll under this fixed header (and the page
 *  transition shows the nav above its curtain), a shared pill would fly in from where the old scroll put it. */
function Pill() {
  const page = usePathname();
  return (
    <motion.span
      key={page}
      data-nav-pill=""
      layoutId={`nav-pill:${page}`}
      aria-hidden
      className="absolute inset-0 -z-10 bg-card-2"
      style={{ borderRadius: 8 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    />
  );
}

function NavLink({ it, current, pill, onHover }: { it: Item; current: Current; pill: boolean; onHover: () => void }) {
  const locale = useLocale();
  return (
    <li onPointerEnter={mouseOnly(onHover)}>
      <Link
        prefetch={false}
        href={localizedHref(it.href, locale)}
        aria-current={current}
        className={`relative isolate rounded-lg px-3 py-2 text-[13px] transition-colors hover:text-ink ${current ? "text-ink" : "text-mut-2"}`}
      >
        {pill && <Pill />}
        {it.label}
      </Link>
    </li>
  );
}

function Dropdown({ label, href, items, current, pill, onHover }: { label: string; href: string; items: Item[]; current: Current; pill: boolean; onHover: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const locale = useLocale();
  const open = dismissed
    ? ""
    : "group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100";
  return (
    <li
      className="group relative"
      onMouseEnter={() => setDismissed(false)}
      onPointerEnter={mouseOnly(onHover)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDismissed(false); }}
      onKeyDown={(event) => { if (event.key === "Escape") { setDismissed(true); trigger.current?.focus(); } }}
    >
      <Link
        ref={trigger}
        prefetch={false}
        href={localizedHref(href, locale)}
        aria-current={current}
        className={`relative isolate flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] transition-colors group-hover:text-ink group-focus-within:text-ink ${current ? "text-ink" : "text-mut-2"}`}
      >
        {pill && <Pill />}
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
                href={localizedHref(it.href, locale)}
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
  const locale = useLocale();
  return (
    <div className="mt-2 border-t border-line-soft pt-2">
      <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">{title}</p>
      {items.map((it) => (
        <Link
          prefetch={false}
          key={it.href}
          href={localizedHref(it.href, locale)}
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
  const [hovered, setHovered] = useState<string | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const locale = useLocale();
  const t = dictionary(locale).nav;
  const { primary, services, tail } = navItems(locale);
  const pathname = usePathname();
  const path = stripLocale(withSlash(pathname));
  const current = currentHref(path);
  const pillAt = hovered ?? current;
  const ariaCurrent = (href: string): Current => (current === href ? (path === href ? "page" : "true") : undefined);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A layout effect, so the menu is shut in the route change's own commit: during the page curtain React runs
  // passive effects only once the transition has finished, and the open menu would ride above the curtain.
  useLayoutEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  const close = () => { if (menu.current) menu.current.open = false; };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        aria-label={t.label}
        className={`flex w-full max-w-[1180px] items-center justify-between gap-4 rounded-2xl border px-3 py-2 transition-all duration-500 ${
          scrolled ? "border-line bg-[#161719]/85 backdrop-blur-xl" : "border-transparent bg-[#161719]/30 backdrop-blur-md"
        }`}
      >
        <Link prefetch={false} href={localizedHref("/", locale)} aria-label={t.homeLink} className="flex items-center gap-2 pl-2">
          <Brand />
        </Link>

        {/* === FX === the pill sits behind the current link and follows a hovering mouse (Pill above) */}
        <ul className="hidden items-center gap-1 lg:flex" onPointerLeave={() => setHovered(null)}>
          {primary.map((it) => (
            <NavLink key={it.href} it={it} current={ariaCurrent(it.href)} pill={pillAt === it.href} onHover={() => setHovered(it.href)} />
          ))}
          <Dropdown
            label={t.services}
            href="/services/"
            items={services}
            current={ariaCurrent("/services/")}
            pill={pillAt === "/services/"}
            onHover={() => setHovered("/services/")}
          />
          {tail.map((it) => (
            <NavLink key={it.href} it={it} current={ariaCurrent(it.href)} pill={pillAt === it.href} onHover={() => setHovered(it.href)} />
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <LanguageSwitch variant="bar" />
          <MagneticLink
            href={localizedHref("/contact/", locale)}
            className="fx-sweep fx-sweep-ghost hidden rounded-xl border border-line px-4 py-2 text-[13px] text-ink transition-colors hover:border-mut-3 sm:inline-flex"
          >
            {t.cta}
          </MagneticLink>
          <details
            ref={menu}
            className="mobile-menu lg:hidden"
            onKeyDown={(event) => { if (event.key === "Escape" && menu.current?.open) { close(); menu.current?.querySelector("summary")?.focus(); } }}
          >
            <summary
              aria-label={t.openMenu}
              className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-xl border border-line text-ink"
            >
              <span aria-hidden className="space-y-1">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            </summary>
            {/* mobile sitemap — positioned against the fixed header, like the original */}
            <div className="scrollbar-none absolute -inset-x-px top-[calc(100%+3px)] max-h-[78vh] overflow-y-auto rounded-2xl border border-line bg-[#161719]/97 p-3 backdrop-blur-xl">
              {[...primary, { label: t.services, href: "/services/" }, ...tail].map((it) => (
                <Link
                  prefetch={false}
                  key={it.href}
                  href={localizedHref(it.href, locale)}
                  onClick={close}
                  className="block rounded-lg px-4 py-3 text-[15px] text-ink hover:bg-card-2"
                >
                  {it.label}
                </Link>
              ))}
              <MobileGroup title={t.allServices} items={services} onNavigate={close} />
              <LanguageSwitch variant="menu" />
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
