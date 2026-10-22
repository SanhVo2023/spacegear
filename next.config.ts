import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // === FX === React <ViewTransition> on route navigations (the page curtain, src/components/fx/PageTransition.tsx).
  experimental: { viewTransition: true },
};

export default nextConfig;
