import type { NextConfig } from "next";
import { labsLocales } from "./src/lib/labs-files.ts";

// Labs pages exist only for a language that has at least one published article (bilingual spec, Part 3): their
// route files are named page.<locale>-labs.tsx (and route.<locale>-labs.ts) and become routes only when their
// language is listed here. An empty generateStaticParams would fail `output: "export"` (Next's E87). Next compiles
// this file and its local .ts imports itself (SWC), so labs-files.ts stays erasable TypeScript with .ts imports.
const labs = labsLocales();

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  pageExtensions: ["tsx", "ts", "jsx", "js", ...labs.flatMap((locale) => [`${locale}-labs.tsx`, `${locale}-labs.ts`])],
  // === FX === React <ViewTransition> on route navigations (the page curtain, src/components/fx/PageTransition.tsx).
  // globalNotFound: one 404 (src/app/global-not-found.tsx) for the two root layouts, written to 404.html.
  experimental: { viewTransition: true, globalNotFound: true },
};

export default nextConfig;
