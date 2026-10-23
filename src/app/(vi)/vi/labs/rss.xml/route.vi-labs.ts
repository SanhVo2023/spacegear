import { rssFeed } from "@/lib/labs-feed";

// /vi/labs/rss.xml, only when Vietnamese has an article (next.config.ts lists the vi-labs extensions only then).
export const dynamic = "force-static";
export function GET() {
  return new Response(rssFeed("vi"), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
