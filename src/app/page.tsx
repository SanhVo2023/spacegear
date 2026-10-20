import Nav from "@/components/Nav";
import CurtainShell from "@/components/CurtainShell";
import OrbitalCinematic from "@/components/sections/OrbitalCinematic";
import Work from "@/components/sections/Work";
import Services from "@/components/sections/Services";
import Process from "@/components/sections/Process";
import Analytics from "@/components/sections/Analytics";
import Pricing from "@/components/sections/Pricing";
import Faq from "@/components/sections/Faq";
import Team from "@/components/sections/Team";
import Testimonials from "@/components/sections/Testimonials";
import Labs from "@/components/sections/Labs";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <main className="relative bg-bg">
      <Nav />
      <CurtainShell footer={<Footer />}>
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
      </CurtainShell>
    </main>
  );
}
