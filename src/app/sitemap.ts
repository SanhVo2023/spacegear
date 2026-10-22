import type { MetadataRoute } from "next";
import { getPublishedRoutes, SITE } from "@/lib/site";
export const dynamic="force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return getPublishedRoutes().map(({path})=>({url:new URL(path,SITE.origin).href}));
}
