import ServiceView from "@/views/ServiceView";
import { serviceMetadata, serviceStaticParams } from "@/views/metadata";

export const dynamicParams = false;
export function generateStaticParams() { return serviceStaticParams("en"); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return serviceMetadata("en", (await params).slug); }
export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  return <ServiceView locale="en" slug={(await params).slug} />;
}
