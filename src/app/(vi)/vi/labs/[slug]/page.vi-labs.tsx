import LabsArticleView from "@/views/LabsArticleView";
import { labsArticleMetadata, labsStaticParams } from "@/views/metadata";

// A route only when Vietnamese has an article (next.config.ts lists the vi-labs extensions only then).
export const dynamicParams = false;
export function generateStaticParams() { return labsStaticParams("vi"); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return labsArticleMetadata("vi", (await params).slug); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <LabsArticleView locale="vi" slug={(await params).slug} />;
}
