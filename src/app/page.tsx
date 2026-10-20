import { buildMetadata } from "@/lib/seo";
import OrbitalCinematic from "@/components/sections/OrbitalCinematic";
import Work from "@/components/sections/Work";
import Services from "@/components/sections/Services";
import Analytics from "@/components/sections/Analytics";
import Process from "@/components/sections/Process";
import Pricing from "@/components/sections/Pricing";
import Faq from "@/components/sections/Faq";

export const metadata = buildMetadata({ title: "Digital Transformation & AI Consulting", description: "Turn business challenges into working digital systems. spacegear.tech brings digital transformation, AI strategy and hands-on delivery together.", path: "/" });

export default function Home() {
  return (
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
      </div>
    </main>
  );
}
