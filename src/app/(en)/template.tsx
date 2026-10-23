import type { ReactNode } from "react";
import PageTransition from "@/components/fx/PageTransition";

/** === FX === Wraps every page in the curtain transition (src/components/fx/PageTransition.tsx). It runs within one
 *  language: switching language changes the root layout, which is a full page load. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
