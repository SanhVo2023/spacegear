import ServiceView from "@/views/ServiceView";
import { serviceMetadata, serviceStaticParams } from "@/views/metadata";

export const dynamicParams = false;
export function generateStaticParams() { return serviceStaticParams("vi"); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return serviceMetadata("vi", (await params).slug); }
export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  return <ServiceView locale="vi" slug={(await params).slug} />;
}
