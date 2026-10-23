import type { Viewport } from "next";
import SiteShell from "@/components/SiteShell";
import { siteMetadata } from "@/lib/seo";

export const metadata = siteMetadata("vi");
// Night, the page colour (docs/brand/guidelines.md, "Colour"); Next 16 takes themeColor here, not in metadata.
export const viewport: Viewport = { themeColor: "#161719" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SiteShell locale="vi">{children}</SiteShell>;
}
