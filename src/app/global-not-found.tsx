import type { Viewport } from "next";
import SiteShell from "@/components/SiteShell";
import { siteMetadata } from "@/lib/seo";
import NotFoundView from "@/views/NotFoundView";
import { notFoundMetadata } from "@/views/metadata";

// Every unknown URL, in either language, gets this page (out/404.html): English first, then Vietnamese.
export const metadata = { ...siteMetadata("en"), ...notFoundMetadata() };
export const viewport: Viewport = { themeColor: "#161719" };
export default function GlobalNotFound() {
  return <SiteShell locale="en" notFound><NotFoundView /></SiteShell>;
}
