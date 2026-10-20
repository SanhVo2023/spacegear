import type { Metadata } from "next";
import localFont from "next/font/local";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import StructuredData from "@/components/StructuredData";
import { SITE } from "@/lib/site";
import "./globals.css";
import "./legacy.css";

const inter = localFont({ src: "./fonts/inter-latin.woff2", variable: "--font-inter", display: "swap" });
const mono = localFont({ src: "./fonts/jetbrains-mono-latin.woff2", variable: "--font-code", display: "swap", preload: false });
export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin), title: `${SITE.name} | Digital Transformation & AI Consulting`, description: SITE.description,
  robots: { index: SITE.publicationMode === "production", follow: SITE.publicationMode === "production" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${inter.variable} ${mono.variable}`}><body id="top">
    <a className="skip-link" href="#main">Skip to content</a><Nav />
    <div className="page-curtain">{children}</div><Footer />
    <StructuredData data={{ "@context": "https://schema.org", "@graph": [
      { "@type": "Organization", "@id": `${SITE.origin}/#organization`, name: SITE.name, url: SITE.origin, description: SITE.description, logo: `${SITE.origin}/icon.svg`, ...(SITE.contactEmail ? { email: SITE.contactEmail } : {}) },
      { "@type": "WebSite", "@id": `${SITE.origin}/#website`, url: SITE.origin, name: SITE.name, publisher: { "@id": `${SITE.origin}/#organization` } }
    ] }} />
  </body></html>;
}
