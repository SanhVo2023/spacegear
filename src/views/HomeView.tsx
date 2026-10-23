import OrbitalCinematic from "@/components/sections/OrbitalCinematic";
import Work from "@/components/sections/Work";
import Services from "@/components/sections/Services";
import Analytics from "@/components/sections/Analytics";
import Process from "@/components/sections/Process";
import Pricing from "@/components/sections/Pricing";
import Faq from "@/components/sections/Faq";
import Team from "@/components/sections/Team";
import Testimonials, { hasTestimonials } from "@/components/sections/Testimonials";
import Labs, { hasLabs } from "@/components/sections/Labs";
import ScrollProgressRail, { type RailItem } from "@/components/fx/ScrollProgressRail";
import StructuredData from "@/components/StructuredData";
import { getContent } from "@/lib/content";
import type { Locale } from "@/lib/i18n/locales";
import { webPageData } from "@/lib/seo";
import { homeMetadata } from "@/views/metadata";

export default function HomeView({ locale }: { locale: Locale }) {
  const { SECTIONS } = getContent(locale);
  /** Home sections for the progress rail, labelled with their section titles (no new copy). */
  const rail: RailItem[] = [
    { id: "work", label: SECTIONS.work.title },
    { id: "services", label: SECTIONS.services.title },
    { id: "process", label: SECTIONS.process.title },
    { id: "analytics", label: SECTIONS.analytics.title },
    { id: "pricing", label: SECTIONS.pricing.title },
    { id: "faq", label: SECTIONS.faq.title },
    { id: "team", label: SECTIONS.team.title },
    ...(hasTestimonials(locale) ? [{ id: "testimonials", label: SECTIONS.testimonials.title }] : []),
    ...(hasLabs(locale) ? [{ id: "labs", label: SECTIONS.labs.title }] : []),
  ];
  return (
    <>
      {/* === FX === before <main> in the tab order, so Tab from the last section still enters the footer */}
      <ScrollProgressRail items={rail} />
      <main id="main" className="relative bg-bg">
        <OrbitalCinematic />
        {/* curtain: this panel slides up over the locked hero background */}
        <div className="relative z-10 rounded-t-[28px] border-t border-line bg-bg shadow-[0_-30px_60px_-20px_rgba(0,0,0,0.75)]">
          <Work />
          <Services />
          <Process />
          <Analytics />
          <Pricing />
          <Faq />
          <Team />
          <Testimonials locale={locale} />
          <Labs locale={locale} />
        </div>
        <StructuredData data={webPageData(homeMetadata(locale), locale)} />
      </main>
    </>
  );
}
