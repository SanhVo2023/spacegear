import ServicesView from "@/views/ServicesView";
import { servicesMetadata } from "@/views/metadata";

export const metadata = servicesMetadata("vi");
export default function ServicesPage() {
  return <ServicesView locale="vi" />;
}
