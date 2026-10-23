import { llmsText } from "@/lib/labs-feed";

// /llms.txt (llmstxt.org): every published page in both languages and every Labs article, written at build time.
export const dynamic = "force-static";
export function GET() {
  return new Response(llmsText(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
