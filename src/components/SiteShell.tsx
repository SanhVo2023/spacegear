import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import CurtainShell from "@/components/CurtainShell";
import MotionProvider from "@/components/MotionProvider";
import NoScriptStyles from "@/components/NoScriptStyles";
import FxLayer from "@/components/fx/FxLayer";
import IntroGate from "@/components/IntroGate";
import IntroOverlay from "@/components/IntroOverlay";
import { LocaleProvider } from "@/components/LocaleProvider";
import Footer from "@/components/sections/Footer";
import StructuredData from "@/components/StructuredData";
import { dictionary } from "@/lib/i18n/dictionary";
import { HTML_LANG, type Locale } from "@/lib/i18n/locales";
import { organizationData, websiteData } from "@/lib/seo";
// The type families (Inter and JetBrains Mono, latin and Vietnamese subsets): src/app/fonts/fonts.ts.
import "@/app/fonts/fonts";
import "@/app/globals.css";

/**
 * The document of every page in one language: <html lang>, the intro gate, the skip link, the nav, the curtain
 * and footer, the motion layer and the site's structured data. The two root layouts (src/app/(en) and
 * src/app/(vi)) and the 404 (src/app/global-not-found.tsx) render it. `notFound` marks the 404, which serves every
 * unknown URL in both languages.
 */
export default function SiteShell({ locale, notFound = false, children }: { locale: Locale; notFound?: boolean; children: ReactNode }) {
  // suppressHydrationWarning: the inline intro gate may add data-intro to <html> before hydration.
  return <html lang={HTML_LANG[locale]} className="antialiased" suppressHydrationWarning><body id="top">
    <IntroGate />
    <NoScriptStyles />
    <a className="skip-link" href="#main">{dictionary(locale).shell.skipToContent}</a>
    {/* Outside main, aria-hidden and never focusable; shown only while the gate's data-intro is set. */}
    <IntroOverlay />
    <LocaleProvider locale={locale} notFound={notFound}>
      <MotionProvider>
        <Nav />
        {/* Original curtain: page content lifts away to reveal the pinned footer (desktop). */}
        <CurtainShell footer={<Footer locale={locale} />}>{children}</CurtainShell>
        {/* === FX === smooth scroll, cursor and grain on fine-pointer desktops (src/components/fx) */}
        <FxLayer />
      </MotionProvider>
    </LocaleProvider>
    <StructuredData data={{ "@context": "https://schema.org", "@graph": [organizationData(locale), websiteData(locale)] }} />
  </body></html>;
}
