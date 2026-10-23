import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // === FX === React <ViewTransition> on route navigations (the page curtain, src/components/fx/PageTransition.tsx).
  // globalNotFound: one 404 (src/app/global-not-found.tsx) for the two root layouts, written to 404.html.
  experimental: { viewTransition: true, globalNotFound: true },
};

export default nextConfig;
