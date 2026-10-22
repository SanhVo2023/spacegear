import { buildMetadata } from "@/lib/seo";
import OrbitalCinematic from "@/components/sections/OrbitalCinematic";
import Work from "@/components/sections/Work";
import Services from "@/components/sections/Services";
import Analytics from "@/components/sections/Analytics";
import Process from "@/components/sections/Process";
import Pricing from "@/components/sections/Pricing";
import Faq from "@/components/sections/Faq";
import Team from "@/components/sections/Team";
import Testimonials, { HAS_TESTIMONIALS } from "@/components/sections/Testimonials";
import Labs, { HAS_LABS } from "@/components/sections/Labs";
import ScrollProgressRail, { type RailItem } from "@/components/fx/ScrollProgressRail";
import { SECTIONS } from "@/lib/content";

export const metadata = buildMetadata({ title: "Digital Transformation & AI Consulting", description: "Turn business challenges into working digital systems. spacegear.tech brings digital transformation, AI strategy and hands-on delivery together.", path: "/" });

/** Home sections for the progress rail, labelled with their section titles (no new copy). */
const RAIL: RailItem[] = [
  { id: "work", label: SECTIONS.work.title },
  { id: "services", label: SECTIONS.services.title },
  { id: "process", label: SECTIONS.process.title },
  { id: "analytics", label: SECTIONS.analytics.title },
  { id: "pricing", label: SECTIONS.pricing.title },
  { id: "faq", label: SECTIONS.faq.title },
  { id: "team", label: SECTIONS.team.title },
  ...(HAS_TESTIMONIALS ? [{ id: "testimonials", label: SECTIONS.testimonials.title }] : []),
  ...(HAS_LABS ? [{ id: "labs", label: SECTIONS.labs.title }] : []),
];

export default function Home() {
  return (
    <>
      {/* === FX === before <main> in the tab order, so Tab from the last section still enters the footer */}
      <ScrollProgressRail items={RAIL} />
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
          <Testimonials />
          <Labs />
        </div>
      </main>
    </>
  );
}
