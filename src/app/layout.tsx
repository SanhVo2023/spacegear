import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import CurtainShell from "@/components/CurtainShell";
import MotionProvider from "@/components/MotionProvider";
import NoScriptStyles from "@/components/NoScriptStyles";
import FxLayer from "@/components/fx/FxLayer";
import IntroGate from "@/components/IntroGate";
import IntroOverlay from "@/components/IntroOverlay";
import Footer from "@/components/sections/Footer";
import StructuredData from "@/components/StructuredData";
import { SITE } from "@/lib/site";
import "./globals.css";
// The type families (Inter and JetBrains Mono, latin and Vietnamese subsets): src/app/fonts/fonts.ts.
import "./fonts/fonts";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin), title: `${SITE.name} | Digital Transformation & AI Consulting`, description: SITE.description,
  robots: { index: SITE.publicationMode === "production", follow: SITE.publicationMode === "production" },
  // Brand kit (docs/brand/): favicon.ico comes from the src/app convention; the web manifest is src/app/manifest.ts.
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }] },
};
// Night, the page colour (docs/brand/guidelines.md, "Colour"); Next 16 takes themeColor here, not in metadata.
export const viewport: Viewport = { themeColor: "#161719" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning: the inline intro gate may add data-intro to <html> before hydration.
  return <html lang="en" className="antialiased" suppressHydrationWarning><body id="top">
    <IntroGate />
    <NoScriptStyles />
    <a className="skip-link" href="#main">Skip to content</a>
    {/* Outside main, aria-hidden and never focusable; shown only while the gate's data-intro is set. */}
    <IntroOverlay />
    <MotionProvider>
      <Nav />
      {/* Original curtain: page content lifts away to reveal the pinned footer (desktop). */}
      <CurtainShell footer={<Footer />}>{children}</CurtainShell>
      {/* === FX === smooth scroll, cursor and grain on fine-pointer desktops (src/components/fx) */}
      <FxLayer />
    </MotionProvider>
    <StructuredData data={{ "@context": "https://schema.org", "@graph": [
      { "@type": "Organization", "@id": `${SITE.origin}/#organization`, name: SITE.name, url: SITE.origin, description: SITE.description, logo: `${SITE.origin}/icon-512.png`, ...(SITE.contactEmail ? { email: SITE.contactEmail } : {}) },
      { "@type": "WebSite", "@id": `${SITE.origin}/#website`, url: SITE.origin, name: SITE.name, publisher: { "@id": `${SITE.origin}/#organization` } }
    ] }} />
  </body></html>;
}
