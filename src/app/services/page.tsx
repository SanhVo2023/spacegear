import ServicesView from "@/views/ServicesView";
import { servicesMetadata } from "@/views/metadata";

export const metadata = servicesMetadata("en");
export default function ServicesPage() {
  return <ServicesView locale="en" />;
}
