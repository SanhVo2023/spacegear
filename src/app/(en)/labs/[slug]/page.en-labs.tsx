import LabsArticleView from "@/views/LabsArticleView";
import { labsArticleMetadata, labsStaticParams } from "@/views/metadata";

// A route only when English has an article (next.config.ts lists the en-labs extensions only then).
export const dynamicParams = false;
export function generateStaticParams() { return labsStaticParams("en"); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return labsArticleMetadata("en", (await params).slug); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <LabsArticleView locale="en" slug={(await params).slug} />;
}
