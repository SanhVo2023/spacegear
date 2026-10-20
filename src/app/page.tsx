import { buildMetadata } from "@/lib/seo";
import OrbitalCinematic from "@/components/sections/OrbitalCinematic";
import Work from "@/components/sections/Work";
import Services from "@/components/sections/Services";
import DeliveryExample from "@/components/sections/DeliveryExample";
import Process from "@/components/sections/Process";
import Pricing from "@/components/sections/Pricing";
import Faq from "@/components/sections/Faq";
export const metadata = buildMetadata({ title: "Digital Transformation & AI Consulting", description: "Turn business challenges into working digital systems. spacegear.tech brings digital transformation, AI strategy and hands-on delivery together.", path: "/" });
export default function Home() {
  return <main id="main"><OrbitalCinematic/><Work/><Services/><DeliveryExample/><Process/><Pricing/><Faq/></main>;
}
