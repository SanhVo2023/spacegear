import Link from "next/link";
import { BrandSymbol } from "@/components/Brand";
import QuickStart from "@/components/QuickStart";
import { MagneticLink } from "@/components/fx/Magnetic";
import { ringText } from "@/components/ring-text";
import { Container } from "@/components/ui";
import { FOOTER } from "@/lib/content";
import { SITE } from "@/lib/site";
import FooterWordmark from "./FooterWordmark";

/** The badge's ring: its copy runs exactly once round the circle (ring-text.ts). */
const BADGE_RING = ringText(FOOTER.badge, 37, { size: 8.5 });

/** Rotating circular wordmark badge around the brand symbol, which stays still (docs/brand/guidelines.md, "Motion").
 *  The copy is sized to close the circle exactly, its closing "·" one gap before the first letter. */
function CircleBadge() {
  return (
    <div aria-hidden className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="spin-18 h-full w-full">
        <defs>
          <path id="circlePath" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
        </defs>
        <text className="fill-mut-2 font-mono uppercase" style={{ fontSize: BADGE_RING.fontSize, letterSpacing: BADGE_RING.letterSpacing }}>
          <textPath href="#circlePath" startOffset="0%" textLength={BADGE_RING.textLength} lengthAdjust="spacing">{FOOTER.badge}</textPath>
        </text>
      </svg>
      <BrandSymbol className="absolute left-1/2 top-1/2 block h-7 w-auto -translate-x-1/2 -translate-y-1/2 text-flame" />
    </div>
  );
}

function DotHeader() {
  return (
    <div aria-hidden className="mb-6 flex gap-1.5">
      <span className="h-1.5 w-5 rounded-full bg-flame" />
      <span className="h-1.5 w-1.5 rounded-full bg-mut-3/60" />
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  const pill = "grid h-9 place-items-center rounded-lg border border-line px-3 text-mut-2 transition-colors hover:border-flame hover:text-flame";
  return (
    <footer id="contact" className="relative overflow-hidden border-t border-line bg-[#0c0d0f]">
      <Container className="py-12">
        {/* top bento */}
        <div className="grid overflow-hidden rounded-3xl border border-line bg-card/30 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col items-center gap-6 border-b border-line-soft p-6 text-center sm:p-8 lg:items-start lg:justify-between lg:gap-10 lg:border-b-0 lg:border-r lg:text-left">
            <CircleBadge />
            <p className="max-w-xs text-[15px] leading-snug text-mut lg:border-l lg:border-line lg:pl-4">{FOOTER.tagline}</p>
          </div>

          <div className="relative overflow-hidden p-6 text-center sm:p-8 lg:text-left">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_70%_40%,rgba(250,110,67,0.08),transparent_60%)]" />
            {SITE.contactEmail ? (
              <a href={`mailto:${SITE.contactEmail}`} className="fx-underline relative inline-block text-[13px] text-mut-2 transition-colors hover:text-flame lg:float-right">
                {SITE.contactEmail}
              </a>
            ) : (
              <Link prefetch={false} href="/contact/" className="fx-underline relative inline-block text-[13px] text-mut-2 transition-colors hover:text-flame lg:float-right">
                Discuss a project ↗
              </Link>
            )}
            <div className="relative mt-4 lg:mt-8">
              {/* drawn wordmark (docs/brand/); 1em is the type size, so the clamps keep the cell's size. The ™ shows here only.
                  Its letters sit in a flex row, so flex centring stands in for text-center on phones. On fine-pointer
                  desktops the letters rise as the curtain opens and lean away from the pointer (FooterWordmark.tsx). */}
              <FooterWordmark />
              <div className="mt-5 text-[13px] leading-relaxed text-mut-2 lg:mt-6">
                <p>{FOOTER.identity[0]}</p>
                <p>{FOOTER.identity[1]}</p>
                <p className="font-medium text-ink">{FOOTER.identityStrong}</p>
              </div>
            </div>
          </div>
        </div>

        {/* middle bento */}
        <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-card/30 lg:grid lg:grid-cols-[0.6fr_0.6fr_1.1fr]">
          <div className="grid grid-cols-2 border-b border-line-soft lg:contents lg:border-b-0">
            {FOOTER.columns.map((col, ci) => (
              <nav
                key={ci}
                aria-label={ci === 0 ? "Home page sections" : "Pages"}
                className={`p-6 sm:p-8 lg:border-r lg:border-line-soft ${ci === 0 ? "border-r border-line-soft lg:border-r" : ""}`}
              >
                <DotHeader />
                <ul className="space-y-3">
                  {col.map((it) => (
                    <li key={it.href}>
                      <Link prefetch={false} href={it.href} className="fx-underline text-[14px] text-mut-2 transition-colors hover:text-ink">{it.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            <h2 className="display text-2xl text-ink-strong">{FOOTER.quickStart.title}</h2>
            <p className="mt-2 text-[13px] text-mut-2">
              {FOOTER.quickStart.text} <span className="text-flame">*</span>
            </p>
            <QuickStart />
            <p className="mt-4 text-[12px] text-mut-2">
              Read how we handle your details in our{" "}
              <Link prefetch={false} href="/privacy/" className="fx-underline text-flame">Privacy policy.</Link>
            </p>
            <p className="mt-2 text-[12px] text-flame">* {FOOTER.quickStart.note}</p>
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-4 grid overflow-hidden rounded-3xl border border-line bg-card/30 text-[12px] lg:grid-cols-[1fr_1.2fr_auto_auto]">
          <div className="border-b border-line-soft p-6 text-mut-2 lg:border-b-0 lg:border-r">
            <p>© {year} spacegear.tech. All rights reserved.</p>
            <p className="mt-2">Digital transformation &amp; AI consulting.</p>
          </div>
          <div className="border-b border-line-soft p-6 text-mut-2 lg:border-b-0 lg:border-r">
            <span className="font-medium text-ink">spacegear.tech</span> {FOOTER.about}
          </div>
          <div className="flex items-center gap-3 border-b border-line-soft p-6 lg:border-b-0 lg:border-r">
            {SITE.socialProfiles.length > 0 ? (
              SITE.socialProfiles.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={new URL(url).hostname} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-mut-2 transition-colors hover:border-flame hover:text-flame">
                  {new URL(url).hostname.replace(/^www\./, "").slice(0, 2)}
                </a>
              ))
            ) : (
              <>
                {/* magnetic on fine-pointer desktops only (Magnetic.tsx) */}
                <MagneticLink href="/privacy/" className={pill} max={6}>Privacy</MagneticLink>
                <MagneticLink href="/terms/" className={pill} max={6}>Terms</MagneticLink>
              </>
            )}
          </div>
          <a href="#top" aria-label="Back to top" className="grid place-items-center p-6 text-flame transition-colors hover:bg-card-2">
            <span aria-hidden className="text-xl">↑</span>
          </a>
        </div>
      </Container>
    </footer>
  );
}
