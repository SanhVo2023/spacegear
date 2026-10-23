import { rssFeed } from "@/lib/labs-feed";

// /labs/rss.xml, only when English has an article (next.config.ts lists the en-labs extensions only then).
export const dynamic = "force-static";
export function GET() {
  return new Response(rssFeed("en"), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
