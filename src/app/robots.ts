import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
export const dynamic="force-static";
export default function robots(): MetadataRoute.Robots {
  return {rules:SITE.publicationMode==="production"?{userAgent:"*",allow:"/",disallow:"/api/"}:{userAgent:"*",disallow:"/"},sitemap:`${SITE.origin}/sitemap.xml`};
}
