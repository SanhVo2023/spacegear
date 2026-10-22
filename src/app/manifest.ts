import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// The web manifest (brand kit, docs/brand/). The static export writes it to /manifest.webmanifest and
// Next adds <link rel="manifest"> to every page. Name and description come from content/site.json (CMS);
// the short name is the logo's name. scripts/check-export.mjs checks that every icon named here ships.
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: "spacegear",
    description: SITE.description,
    start_url: "/",
    display: "browser",
    background_color: "#08080b",
    theme_color: "#161719",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
